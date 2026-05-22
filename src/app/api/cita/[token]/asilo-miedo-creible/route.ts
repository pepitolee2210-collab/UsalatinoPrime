import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  CREDIBLE_FEAR_QUESTIONNAIRE,
  CREDIBLE_FEAR_QUESTIONNAIRE_SLUG,
  calculateProgress,
  getApplicableModules,
  type CFAnswers,
  type CFOption,
} from '@/lib/legal/asilo-miedo-creible-form-schema'
import { isAsylumService } from '@/lib/services/asylum'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:asilo-miedo-creible')

/**
 * GET /api/cita/[token]/asilo-miedo-creible
 *
 * Devuelve el schema del cuestionario, las respuestas guardadas, los valores
 * de prefill (nombre del cliente, país de nacimiento, fecha de entrada al
 * I-589 Parte A), opciones para el módulo M9 derivadas de
 * `country_evidence_links` filtradas por país del solicitante, y el cálculo
 * de progreso. Lazy-crea la fila en `case_form_instances` si no existe.
 *
 * PUT /api/cita/[token]/asilo-miedo-creible
 * Body: { answers: CFAnswers }
 *
 * Autosave: mergea con filled_values existente y actualiza
 * client_last_edit_at. Falla con 423 si locked_for_client=true.
 *
 * POST /api/cita/[token]/asilo-miedo-creible/submit  (vive en /submit/route.ts)
 *   Marca status='submitted' y client_submitted_at=now().
 */

interface AsiloMiedoCreibleResponse {
  case_id: string
  form_instance_id: string | null
  current_phase: string | null
  country_code: string | null
  modules: typeof CREDIBLE_FEAR_QUESTIONNAIRE
  applicable_module_ids: string[]
  answers: CFAnswers
  prefill: Record<string, string | null>
  country_evidence_options: CFOption[]
  progress: ReturnType<typeof calculateProgress>
  locked_for_client: boolean
  status: string | null
}

async function loadToken(token: string) {
  const supabase = createServiceClient()
  const { data: tokenData } = await supabase
    .from('appointment_tokens')
    .select('client_id, case_id, is_active')
    .eq('token', token)
    .single()
  if (!tokenData?.is_active) return { supabase, tokenData: null as null }
  return { supabase, tokenData }
}

async function loadCase(supabase: ReturnType<typeof createServiceClient>, caseId: string) {
  const { data: caseRow } = await supabase
    .from('cases')
    .select(`
      id,
      current_phase,
      client_id,
      service:service_catalog(slug),
      client:profiles!cases_client_id_fkey(
        first_name,
        last_name,
        middle_name,
        date_of_birth,
        country_of_birth,
        nationality,
        last_entry_date
      )
    `)
    .eq('id', caseId)
    .single<{
      id: string
      current_phase: string | null
      client_id: string
      service: { slug: string } | { slug: string }[] | null
      client: {
        first_name: string | null
        last_name: string | null
        middle_name: string | null
        date_of_birth: string | null
        country_of_birth: string | null
        nationality: string | null
        last_entry_date: string | null
      } | null
    }>()
  return caseRow ?? null
}

function pickServiceSlug(svc: { slug: string } | { slug: string }[] | null): string | null {
  if (!svc) return null
  if (Array.isArray(svc)) return svc[0]?.slug ?? null
  return svc.slug ?? null
}

/**
 * Resuelve los valores de prefill que el wizard mostrará como "ya confirmados"
 * desde otras fuentes (profile, I-589 Parte A wizard).
 */
async function buildPrefill(
  supabase: ReturnType<typeof createServiceClient>,
  caseId: string,
  profile: {
    first_name: string | null
    last_name: string | null
    middle_name: string | null
    date_of_birth: string | null
    country_of_birth: string | null
    nationality: string | null
    last_entry_date: string | null
  } | null,
): Promise<Record<string, string | null>> {
  const fullName = [profile?.first_name, profile?.middle_name, profile?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim()

  const result: Record<string, string | null> = {
    'm2_full_name': fullName || null,
    'm2_country_of_birth': profile?.country_of_birth || profile?.nationality || null,
    'm2_date_of_birth': profile?.date_of_birth || null,
  }

  // I-589 Parte A submissions: extraer port_of_entry y date_entered_us si
  // están en cualquiera de las 4 partes (a1..a4). El wizard guarda esas
  // claves en `case_form_submissions.form_data`.
  const { data: i589Subs } = await supabase
    .from('case_form_submissions')
    .select('form_data')
    .eq('case_id', caseId)
    .in('form_type', ['i589_part_a1', 'i589_part_a2', 'i589_part_a3', 'i589_part_a4'])
    .eq('minor_index', 0)
    .returns<{ form_data: Record<string, unknown> | null }[]>()

  for (const sub of i589Subs ?? []) {
    if (!sub.form_data) continue
    const d = sub.form_data
    if (!result['m1_date_entered_us'] && typeof d.date_entered_us === 'string') {
      result['m1_date_entered_us'] = d.date_entered_us
      result['m10_us_entry_date'] = d.date_entered_us
    }
    if (!result['m10_us_entry_place'] && typeof d.port_of_entry === 'string') {
      result['m10_us_entry_place'] = d.port_of_entry
    }
  }

  // Fallback al last_entry_date del perfil si el wizard no se ha completado.
  if (!result['m1_date_entered_us'] && profile?.last_entry_date) {
    result['m1_date_entered_us'] = profile.last_entry_date
    result['m10_us_entry_date'] = profile.last_entry_date
  }
  return result
}

/**
 * Mapea el país del cliente (texto libre) a un código ISO-2.
 * El perfil guarda country_of_birth como texto del usuario, así que
 * normalizamos contra una lista corta de países con seed actual en
 * `country_evidence_links`. Si no matchea, devuelve null y el M9 muestra
 * solo el campo de URLs custom.
 */
const COUNTRY_TO_ISO: Record<string, string> = {
  venezuela: 'VE',
  'república bolivariana de venezuela': 'VE',
  'bolivarian republic of venezuela': 'VE',
  mexico: 'MX',
  'méxico': 'MX',
  honduras: 'HN',
  colombia: 'CO',
  nicaragua: 'NI',
  cuba: 'CU',
}

function inferCountryCode(name: string | null | undefined): string | null {
  if (!name) return null
  const key = name.trim().toLowerCase()
  return COUNTRY_TO_ISO[key] ?? null
}

async function loadCountryEvidenceOptions(
  supabase: ReturnType<typeof createServiceClient>,
  countryCode: string | null,
): Promise<CFOption[]> {
  if (!countryCode) return []
  const { data, error } = await supabase
    .from('country_evidence_links')
    .select('id, url, url_title, source_organization, category')
    .eq('country_code', countryCode)
    .eq('is_current', true)
    .order('sort_order', { ascending: true })

  if (error) {
    log.warn('No se pudieron cargar country_evidence_links', { countryCode, error })
    return []
  }
  return (data ?? []).map((row) => ({
    value: row.url,
    labelEs: `${row.source_organization}: ${row.url_title}`,
    helpEs: row.category.replace(/_/g, ' '),
  }))
}

async function ensureFormInstance(
  supabase: ReturnType<typeof createServiceClient>,
  caseId: string,
): Promise<{
  id: string
  filled_values: Record<string, unknown>
  locked_for_client: boolean
  status: string | null
}> {
  const { data: existing } = await supabase
    .from('case_form_instances')
    .select('id, filled_values, locked_for_client, status')
    .eq('case_id', caseId)
    .eq('form_name', CREDIBLE_FEAR_QUESTIONNAIRE_SLUG)
    .maybeSingle()
  if (existing) {
    return {
      id: existing.id as string,
      filled_values: (existing.filled_values as Record<string, unknown>) ?? {},
      locked_for_client: Boolean(existing.locked_for_client),
      status: (existing.status as string | null) ?? null,
    }
  }
  const { data: created, error } = await supabase
    .from('case_form_instances')
    .insert({
      case_id: caseId,
      packet_type: 'merits',
      form_name: CREDIBLE_FEAR_QUESTIONNAIRE_SLUG,
      form_url_official: '',
      form_description_es:
        'Cuestionario guiado para construir el relato de Miedo Creíble y llenar la Parte B/C del I-589.',
      is_mandatory: true,
      filled_values: {},
      acroform_schema: [],
      schema_source: 'custom',
      status: 'pending',
    })
    .select('id, filled_values, locked_for_client, status')
    .single()
  if (error || !created) {
    throw new Error('No se pudo crear la instancia del cuestionario')
  }
  return {
    id: created.id as string,
    filled_values: (created.filled_values as Record<string, unknown>) ?? {},
    locked_for_client: Boolean(created.locked_for_client),
    status: (created.status as string | null) ?? null,
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const { supabase, tokenData } = await loadToken(token)
  if (!tokenData) return NextResponse.json({ error: 'Token inválido' }, { status: 403 })

  const caseRow = await loadCase(supabase, tokenData.case_id)
  if (!caseRow) return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })

  const serviceSlug = pickServiceSlug(caseRow.service)
  if (!isAsylumService(serviceSlug)) {
    return NextResponse.json(
      { error: 'Solo aplica a servicios de Asilo Político.' },
      { status: 400 },
    )
  }

  const instance = await ensureFormInstance(supabase, caseRow.id)
  const answers = instance.filled_values as CFAnswers
  const prefill = await buildPrefill(supabase, caseRow.id, caseRow.client)
  const countryCode = inferCountryCode(
    caseRow.client?.country_of_birth ?? caseRow.client?.nationality ?? null,
  )
  const countryEvidenceOptions = await loadCountryEvidenceOptions(supabase, countryCode)

  const applicableModules = getApplicableModules(answers)
  const progress = calculateProgress(answers)

  const payload: AsiloMiedoCreibleResponse = {
    case_id: caseRow.id,
    form_instance_id: instance.id,
    current_phase: caseRow.current_phase,
    country_code: countryCode,
    modules: CREDIBLE_FEAR_QUESTIONNAIRE,
    applicable_module_ids: applicableModules.map((m) => m.id),
    answers,
    prefill,
    country_evidence_options: countryEvidenceOptions,
    progress,
    locked_for_client: instance.locked_for_client,
    status: instance.status,
  }
  return NextResponse.json(payload, { headers: { 'Cache-Control': 'private, max-age=5' } })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const { supabase, tokenData } = await loadToken(token)
  if (!tokenData) return NextResponse.json({ error: 'Token inválido' }, { status: 403 })

  let body: { answers?: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }
  if (!body.answers || typeof body.answers !== 'object') {
    return NextResponse.json({ error: 'answers requerido' }, { status: 400 })
  }

  const caseRow = await loadCase(supabase, tokenData.case_id)
  if (!caseRow) return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
  if (!isAsylumService(pickServiceSlug(caseRow.service))) {
    return NextResponse.json({ error: 'Caso no aplica' }, { status: 400 })
  }

  const instance = await ensureFormInstance(supabase, caseRow.id)
  if (instance.locked_for_client) {
    return NextResponse.json(
      { error: 'El cuestionario está bloqueado por tu equipo legal.' },
      { status: 423 },
    )
  }

  // Merge no destructivo. El cliente puede borrar campos enviando null
  // explícitamente; el spread mantiene esa intención.
  const merged: Record<string, unknown> = {
    ...instance.filled_values,
    ...body.answers,
  }

  const { error } = await supabase
    .from('case_form_instances')
    .update({
      filled_values: merged,
      client_last_edit_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // CHECK constraint en case_form_instances.status: pending|detecting|ready|partial|complete|downloaded|failed
      status: instance.status === 'complete' ? 'complete' : 'partial',
    })
    .eq('id', instance.id)
  if (error) {
    log.error('Error al guardar respuestas', { caseId: caseRow.id, error })
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
  }

  const progress = calculateProgress(merged as CFAnswers)
  return NextResponse.json({ ok: true, progress })
}
