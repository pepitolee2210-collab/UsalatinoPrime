import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { AUTOMATED_FORMS } from '@/lib/legal/automated-forms-registry'
import { isFieldEditableByClient, hasResolvedValue } from '@/lib/legal/field-policy'
import { formApplies } from '@/lib/legal/phase-form-mapping'
import { TOTAL_I360_FIELDS, countI360FilledFields } from '@/components/i360/i360-questions'
import type { CasePhase } from '@/types/database'

/**
 * GET /api/cita/[token]/required-forms
 *
 * Lista los formularios que el cliente debe llenar según fase + estado.
 * Para cada form computa cuántos campos REALMENTE necesita el cliente
 * (excluye los hardcoded, los jurídicos solo-Diana, los ya resueltos por
 * prefill desde otras fuentes, y los ya guardados en filled_values).
 *
 * Estructura optimizada para que la pantalla Fases muestre un bento de
 * FormCards con progreso real "Te faltan 5 campos".
 *
 * Incluye además una FormCard especial "Mi Historia" que apunta al
 * ClientStoryWizard existente — esta no proviene del registry, vive en la
 * tabla case_form_submissions con form_type='client_story'.
 */

interface FormSummary {
  slug: string
  form_name: string
  description_es: string
  state: string | null
  packet_type: string
  template_type: string
  icon: string
  total_user_fields: number
  completed_user_fields: number
  pct: number
  instance_status: string | null
  locked_for_client: boolean
  is_special_story?: boolean
  is_special_i360?: boolean
  client_last_edit_at: string | null
  client_submitted_at: string | null
}

interface ResponseShape {
  case_id: string
  current_phase: CasePhase | null
  state_us: string | null
  total_forms: number
  total_complete: number
  forms: FormSummary[]
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const supabase = createServiceClient()

  const { data: tokenData } = await supabase
    .from('appointment_tokens')
    .select('client_id, case_id, is_active')
    .eq('token', token)
    .single()

  if (!tokenData?.is_active) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 403 })
  }

  const { data: caseRow } = await supabase
    .from('cases')
    .select('id, current_phase, state_us, service:service_catalog(slug)')
    .eq('id', tokenData.case_id)
    .single()

  const currentPhase = (caseRow?.current_phase as CasePhase | null) ?? null
  const stateUs = (caseRow?.state_us as string | null) ?? null
  const serviceRaw = caseRow?.service as unknown
  const serviceSlug =
    Array.isArray(serviceRaw)
      ? (serviceRaw[0] as { slug?: string } | undefined)?.slug ?? null
      : ((serviceRaw as { slug?: string } | null)?.slug ?? null)

  if (!currentPhase) {
    const empty: ResponseShape = {
      case_id: tokenData.case_id,
      current_phase: null,
      state_us: stateUs,
      total_forms: 0,
      total_complete: 0,
      forms: [],
    }
    return NextResponse.json(empty)
  }

  const applicableDefs = Object.values(AUTOMATED_FORMS).filter((def) =>
    formApplies(def, currentPhase, stateUs),
  )

  // Cargar instancias existentes y submissions de Mi Historia + I-360 en paralelo
  const [instancesRes, storyRes, i360Res] = await Promise.all([
    supabase
      .from('case_form_instances')
      .select('form_name, filled_values, status, locked_for_client, client_last_edit_at, client_submitted_at')
      .eq('case_id', tokenData.case_id),
    supabase
      .from('case_form_submissions')
      .select('form_data, status, updated_at, submitted_at')
      .eq('case_id', tokenData.case_id)
      .eq('form_type', 'client_story')
      .maybeSingle(),
    supabase
      .from('case_form_submissions')
      .select('form_data, status, updated_at, submitted_at')
      .eq('case_id', tokenData.case_id)
      .eq('form_type', 'i360_sijs')
      .eq('minor_index', 0)
      .maybeSingle(),
  ])
  const instances = instancesRes.data ?? []

  const summaries: FormSummary[] = []
  for (const def of applicableDefs) {
    // Buscar instancia existente por form_name (UNIQUE constraint)
    const instance = instances.find((i) => i.form_name === def.formName)
    const savedValues = (instance?.filled_values as Record<string, string | boolean | null> | undefined) ?? {}

    let prefill: Record<string, string | boolean | null | undefined> = {}
    try {
      prefill = await def.buildPrefilledValues(tokenData.case_id, supabase)
    } catch {
      prefill = {}
    }

    // Iterar todos los fields, contar user fields pendientes vs completados
    let total = 0
    let completed = 0
    for (const section of def.sections) {
      for (const field of section.fields) {
        if (!isFieldEditableByClient(field)) continue
        // Si ya viene auto-resuelto desde otra fuente, no se cuenta como user field
        if (hasResolvedValue(prefill, field.semanticKey)) continue
        total++
        if (hasResolvedValue(savedValues, field.semanticKey)) completed++
      }
    }

    summaries.push({
      slug: def.slug,
      form_name: def.formName,
      description_es: def.formDescriptionEs,
      state: def.states[0] ?? null,
      packet_type: def.packetType,
      template_type: def.templateType ?? 'acroform',
      icon: pickIconForForm(def.slug),
      total_user_fields: total,
      completed_user_fields: completed,
      pct: total === 0 ? 100 : Math.round((completed / total) * 100),
      instance_status: instance?.status ?? null,
      locked_for_client: instance?.locked_for_client ?? false,
      client_last_edit_at: instance?.client_last_edit_at ?? null,
      client_submitted_at: instance?.client_submitted_at ?? null,
    })
  }

  // Mi Historia (Declaración Jurada del padre/tutor) — siempre visible para
  // SIJS, independientemente del estado.
  const isSijs = serviceSlug === 'visa-juvenil'

  // Form I-360 SIJS — visible para SIJS en fase i360. Se renderiza vía
  // I360WizardCore con UI mejorada (selects, tooltips, voice input).
  if (isSijs && currentPhase === 'i360') {
    const i360Data = (i360Res.data?.form_data as Record<string, unknown> | undefined) ?? {}
    const i360FieldsFilled = countI360FilledFields(i360Data)
    const i360Status = (i360Res.data?.status as string | undefined) ?? null
    summaries.unshift({
      slug: '__i360_wizard__',
      form_name: 'Form I-360 — Petición SIJS',
      description_es:
        'Llena tus datos paso a paso. Tu equipo legal revisará la información y la presentará a USCIS.',
      state: null,
      packet_type: 'merits',
      template_type: 'special',
      icon: 'description',
      total_user_fields: TOTAL_I360_FIELDS,
      completed_user_fields: Math.min(TOTAL_I360_FIELDS, i360FieldsFilled),
      pct: i360FieldsFilled === 0
        ? 0
        : Math.min(100, Math.round((i360FieldsFilled / TOTAL_I360_FIELDS) * 100)),
      instance_status: i360Status,
      locked_for_client: false, // cliente puede seguir editando aún después de submit
      is_special_i360: true,
      client_last_edit_at: (i360Res.data?.updated_at as string | undefined) ?? null,
      client_submitted_at: (i360Res.data?.submitted_at as string | undefined) ?? null,
    })
  }

  if (isSijs && currentPhase === 'custodia') {
    const storyData = (storyRes.data?.form_data as Record<string, unknown> | undefined) ?? {}
    // Heurística simple de progreso: contar campos no vacíos en form_data
    const totalKeys = countDeepKeys(storyData)
    const filledKeys = countDeepFilledKeys(storyData)
    const status = (storyRes.data?.status as string | undefined) ?? null
    summaries.unshift({
      slug: '__client_story__',
      form_name: 'Mi Historia',
      description_es: 'Declaración Jurada del padre/tutor — narrativa completa del caso.',
      state: null,
      packet_type: 'merits',
      template_type: 'special',
      icon: 'menu_book',
      total_user_fields: Math.max(totalKeys, 30),
      completed_user_fields: filledKeys,
      pct: filledKeys === 0 ? 0 : Math.min(100, Math.round((filledKeys / Math.max(totalKeys, 30)) * 100)),
      instance_status: status,
      locked_for_client: false,
      is_special_story: true,
      client_last_edit_at: (storyRes.data?.updated_at as string | undefined) ?? null,
      client_submitted_at: (storyRes.data?.submitted_at as string | undefined) ?? null,
    })
  }

  const totalForms = summaries.length
  const totalComplete = summaries.filter((s) => s.pct === 100).length

  const response: ResponseShape = {
    case_id: tokenData.case_id,
    current_phase: currentPhase,
    state_us: stateUs,
    total_forms: totalForms,
    total_complete: totalComplete,
    forms: summaries,
  }
  return NextResponse.json(response, { headers: { 'Cache-Control': 'private, max-age=10' } })
}

function pickIconForForm(slug: string): string {
  if (slug.includes('sapcr-100')) return 'gavel'
  if (slug.includes('sapcr-aff')) return 'verified'
  if (slug.includes('pr-gen-116')) return 'description'
  if (slug.includes('motion-sij')) return 'rule'
  if (slug.includes('affidavit-sij')) return 'fact_check'
  if (slug.includes('order-sij')) return 'stars'
  if (slug.includes('sapcr-205')) return 'edit_document'
  return 'assignment'
}

function countDeepKeys(obj: unknown): number {
  if (!obj || typeof obj !== 'object') return 0
  let n = 0
  for (const v of Object.values(obj as Record<string, unknown>)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      n += countDeepKeys(v)
    } else {
      n++
    }
  }
  return n
}

function countDeepFilledKeys(obj: unknown): number {
  if (!obj || typeof obj !== 'object') return 0
  let n = 0
  for (const v of Object.values(obj as Record<string, unknown>)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      n += countDeepFilledKeys(v)
    } else if (v != null && (typeof v !== 'string' || v.trim() !== '')) {
      n++
    }
  }
  return n
}
