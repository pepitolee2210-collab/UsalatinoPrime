import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  WITNESS_FORM_SLUG,
  WITNESS_FORM_SECTIONS,
  calculateWitnessProgress,
  readWitnesses,
  witnessLetterAnswersSchema,
  type WitnessLetterValue,
} from '@/lib/legal/asilo-testigos-form-schema'
import { isAsylumService } from '@/lib/services/asylum'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:asilo-testigos')

/**
 * GET /api/cita/[token]/asilo-testigos
 *   Devuelve el schema de secciones, los testigos guardados y el progreso.
 *   Lazy-crea la fila en `case_form_instances` (form_name='asilo_testigos_carta').
 *
 * PUT /api/cita/[token]/asilo-testigos
 *   Body: { witnesses: WitnessLetterValue[] }
 *   Autosave: reemplaza el array completo de testigos. Falla 423 si locked.
 *
 * POST /api/cita/[token]/asilo-testigos/submit  (vive en /submit/route.ts)
 *   Marca status='complete' y client_submitted_at=now().
 */

interface AsiloTestigosResponse {
  case_id: string
  form_instance_id: string | null
  current_phase: string | null
  sections: typeof WITNESS_FORM_SECTIONS
  witnesses: WitnessLetterValue[]
  progress: ReturnType<typeof calculateWitnessProgress>
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
    .select('id, current_phase, service:service_catalog(slug)')
    .eq('id', caseId)
    .single<{
      id: string
      current_phase: string | null
      service: { slug: string } | { slug: string }[] | null
    }>()
  return caseRow ?? null
}

function pickServiceSlug(svc: { slug: string } | { slug: string }[] | null): string | null {
  if (!svc) return null
  if (Array.isArray(svc)) return svc[0]?.slug ?? null
  return svc.slug ?? null
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
    .eq('form_name', WITNESS_FORM_SLUG)
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
      form_name: WITNESS_FORM_SLUG,
      form_url_official: '',
      form_description_es:
        'Datos de los testigos que corroboran tu caso de asilo. Tu equipo legal genera con ellos las declaraciones juradas de testigo.',
      is_mandatory: false,
      filled_values: {},
      acroform_schema: [],
      schema_source: 'custom',
      status: 'pending',
    })
    .select('id, filled_values, locked_for_client, status')
    .single()
  if (error || !created) {
    throw new Error('No se pudo crear la instancia del formulario de testigos')
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

  if (!isAsylumService(pickServiceSlug(caseRow.service))) {
    return NextResponse.json(
      { error: 'Solo aplica a servicios de Asilo Político.' },
      { status: 400 },
    )
  }

  const instance = await ensureFormInstance(supabase, caseRow.id)
  const witnesses = readWitnesses(instance.filled_values)
  const progress = calculateWitnessProgress(witnesses)

  const payload: AsiloTestigosResponse = {
    case_id: caseRow.id,
    form_instance_id: instance.id,
    current_phase: caseRow.current_phase,
    sections: WITNESS_FORM_SECTIONS,
    witnesses,
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

  let body: { witnesses?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const parsed = witnessLetterAnswersSchema.safeParse({ witnesses: body.witnesses ?? [] })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos de testigos inválidos' }, { status: 400 })
  }

  const caseRow = await loadCase(supabase, tokenData.case_id)
  if (!caseRow) return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
  if (!isAsylumService(pickServiceSlug(caseRow.service))) {
    return NextResponse.json({ error: 'Caso no aplica' }, { status: 400 })
  }

  const instance = await ensureFormInstance(supabase, caseRow.id)
  if (instance.locked_for_client) {
    return NextResponse.json(
      { error: 'El formulario está bloqueado por tu equipo legal.' },
      { status: 423 },
    )
  }

  const { error } = await supabase
    .from('case_form_instances')
    .update({
      filled_values: { witnesses: parsed.data.witnesses },
      client_last_edit_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // CHECK constraint: pending|detecting|ready|partial|complete|downloaded|failed
      status: instance.status === 'complete' ? 'complete' : 'partial',
    })
    .eq('id', instance.id)
  if (error) {
    log.error('Error al guardar testigos', { caseId: caseRow.id, error })
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
  }

  const progress = calculateWitnessProgress(parsed.data.witnesses)
  return NextResponse.json({ ok: true, progress })
}
