import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { AUTOMATED_FORMS } from '@/lib/legal/automated-forms-registry'
import { isFieldEditableByClient, hasResolvedValue } from '@/lib/legal/field-policy'
import { formApplies } from '@/lib/legal/phase-form-mapping'
import { TOTAL_I360_FIELDS, countI360FilledFields } from '@/components/i360/i360-questions'
import { TOTAL_I589_PART_A_FIELDS, countI589PartAFilledFields } from '@/components/i589/i589-part-a-questions'
import type { CasePhase } from '@/types/database'
import { isAsylumService } from '@/lib/services/asylum'

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
  /** Si false, el formulario es opcional para el cliente (ej. EOIR-26A Fee Waiver). */
  is_mandatory: boolean
  is_special_story?: boolean
  is_special_i360?: boolean
  /** Wizard I-589 Parte A (Asilo Político Fase 1) — abre I589PartAWizardCore. */
  is_special_i589?: boolean
  /** Form de URLs de noticias/evidencia (Asilo Político Fase 2). */
  is_special_evidence_urls?: boolean
  /** Carta de Cambio de Corte (6 págs custom, Cambio de Corte). */
  is_special_cc_carta?: boolean
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
      .select('form_name, filled_values, status, locked_for_client, client_last_edit_at, client_submitted_at, is_mandatory')
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
      // Si ya hay instance, refleja el valor en BD; si no, hereda del registry def.
      is_mandatory:
        typeof instance?.is_mandatory === 'boolean'
          ? instance.is_mandatory
          : def.isMandatory !== false,
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
      is_mandatory: true,
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
      is_mandatory: true,
      is_special_story: true,
      client_last_edit_at: (storyRes.data?.updated_at as string | undefined) ?? null,
      client_submitted_at: (storyRes.data?.submitted_at as string | undefined) ?? null,
    })
  }

  // Asilo Político — Fase 1 (Sustentos): wizard I-589 Parte A real.
  // 4 sub-formularios (a1, a2, a3, a4) que cubren páginas 1-4 del I-589.
  // El cliente responde, autosaves a `case_form_submissions` con
  // `form_type='i589_part_aN'`. Diana imprime el PDF AcroForm con esos datos.
  const isAsiloPolitico = serviceSlug === 'asilo-politico'
  if (isAsiloPolitico && currentPhase === 'asilo_sustentos') {
    type I589Sub = {
      form_type: string
      form_data: Record<string, unknown> | null
      status: string | null
      updated_at: string | null
      submitted_at: string | null
    }

    const { data: i589Subs } = await supabase
      .from('case_form_submissions')
      .select('form_type, form_data, status, updated_at, submitted_at')
      .eq('case_id', tokenData.case_id)
      .in('form_type', ['i589_part_a1', 'i589_part_a2', 'i589_part_a3', 'i589_part_a4'])
      .eq('minor_index', 0)
      .returns<I589Sub[]>()

    const partsByType = new Map<string, I589Sub>()
    for (const s of i589Subs ?? []) partsByType.set(s.form_type, s)

    const filledFields = countI589PartAFilledFields({
      a1: partsByType.get('i589_part_a1')?.form_data ?? null,
      a2: partsByType.get('i589_part_a2')?.form_data ?? null,
      a3: partsByType.get('i589_part_a3')?.form_data ?? null,
      a4: partsByType.get('i589_part_a4')?.form_data ?? null,
    })

    const allSubmitted = (['i589_part_a1','i589_part_a2','i589_part_a3','i589_part_a4'] as const).every(
      (t) => partsByType.get(t)?.status === 'submitted',
    )

    const lastEdit = (i589Subs ?? []).reduce<string | null>((max, s) => {
      const u = s.updated_at
      if (!u) return max
      if (!max || u > max) return u
      return max
    }, null)
    const lastSubmit = (i589Subs ?? []).reduce<string | null>((max, s) => {
      const u = s.submitted_at
      if (!u) return max
      if (!max || u > max) return u
      return max
    }, null)

    summaries.unshift({
      slug: '__i589_wizard__',
      form_name: 'Formulario I-589 — Páginas 1 a 4',
      description_es:
        'Datos personales, inmigración, cónyuge e hijos, e historial. Esta es la Parte A del I-589 que tu equipo legal usará para presentar tu caso.',
      state: null,
      packet_type: 'merits',
      template_type: 'special',
      icon: 'description',
      total_user_fields: TOTAL_I589_PART_A_FIELDS,
      completed_user_fields: Math.min(TOTAL_I589_PART_A_FIELDS, filledFields),
      pct: TOTAL_I589_PART_A_FIELDS === 0
        ? 0
        : Math.min(100, Math.round((filledFields / TOTAL_I589_PART_A_FIELDS) * 100)),
      instance_status: allSubmitted ? 'submitted' : 'draft',
      locked_for_client: false,
      is_mandatory: true,
      is_special_i589: true,
      client_last_edit_at: lastEdit,
      client_submitted_at: lastSubmit,
    })
  }

  // Cambio de Corte — fase única: además del EOIR-33 (que ya entra por el
  // registry de AcroForms), inyectar la "Carta de Cambio de Corte" (6 págs,
  // jsPDF custom) para que el cliente también la llene. La fila vive en
  // case_form_instances con form_name = 'Carta de Cambio de Corte (6 págs)'
  // y schema_source = 'custom'.
  if (serviceSlug === 'cambio-de-corte' && currentPhase === 'cambio_de_corte') {
    const cartaInstance = instances.find((i) => i.form_name === 'Carta de Cambio de Corte (6 págs)')
    const cartaValues = (cartaInstance?.filled_values as Record<string, unknown> | undefined) ?? {}

    // 15 campos críticos del formulario (excluyen los prellenados del profile
    // y los completamente opcionales). Cuenta progreso para la barra del card.
    const CRITICAL_KEYS = [
      'file_number', 'judge_name', 'next_hearing_date', 'next_hearing_time', 'document_date',
      'current_court_name', 'current_court_street', 'current_court_city_state_zip',
      'new_address_street', 'new_address_city', 'new_address_state', 'new_address_zip',
      'new_court_name', 'new_court_street', 'new_court_city_state_zip',
    ]
    const filled = CRITICAL_KEYS.reduce((n, k) => {
      const v = cartaValues[k]
      if (v != null && (typeof v !== 'string' || v.trim() !== '')) return n + 1
      return n
    }, 0)

    summaries.push({
      slug: '__cc_carta__',
      form_name: 'Carta de Cambio de Corte (6 págs)',
      description_es: 'Moción detallada en inglés legal con beneficiarios, jueces y dirección del Chief Counsel.',
      state: null,
      packet_type: 'merits',
      template_type: 'special',
      icon: 'mail',
      total_user_fields: CRITICAL_KEYS.length,
      completed_user_fields: filled,
      pct: Math.round((filled / CRITICAL_KEYS.length) * 100),
      instance_status: (cartaInstance?.status as string | undefined) ?? null,
      locked_for_client: false,
      is_mandatory: true,
      is_special_cc_carta: true,
      client_last_edit_at: (cartaInstance?.client_last_edit_at as string | undefined) ?? null,
      client_submitted_at: (cartaInstance?.client_submitted_at as string | undefined) ?? null,
    })
  }

  // Familia Asilo Político — Fase 2 (Reforzar): formulario para que el
  // cliente pegue URLs de noticias / reportes que respalden su caso. La
  // tabla `case_evidence_urls` ya guarda los links; este card abre el
  // manager. Aplica TANTO a 'asilo-politico' (cuando avanza a Fase 2) como
  // a 'reforzar-asilo' (donde es la fase única). Por eso usamos
  // isAsylumService en lugar del flag local isAsiloPolitico — ese flag
  // sigue siendo específico de 'asilo-politico' porque la Fase 1 (I-589
  // Parte A) NO aplica a 'reforzar-asilo'.
  if (isAsylumService(serviceSlug) && currentPhase === 'asilo_reforzar') {
    const { count: urlsCount } = await supabase
      .from('case_evidence_urls')
      .select('id', { count: 'exact', head: true })
      .eq('case_id', tokenData.case_id)

    const TARGET_URLS = 3 // sugerencia mínima para 100% de la barra
    const filled = Math.min(urlsCount ?? 0, TARGET_URLS)

    summaries.unshift({
      slug: '__evidence_urls__',
      form_name: 'Enlaces de noticias y evidencia',
      description_es:
        'Pega URLs de reportes, noticias o publicaciones que respalden tu caso. Sugerencia: al menos 3 fuentes confiables.',
      state: null,
      packet_type: 'merits',
      template_type: 'special',
      icon: 'link',
      total_user_fields: TARGET_URLS,
      completed_user_fields: filled,
      pct: Math.min(100, Math.round((filled / TARGET_URLS) * 100)),
      instance_status: filled >= TARGET_URLS ? 'submitted' : 'draft',
      locked_for_client: false,
      is_mandatory: true,
      is_special_evidence_urls: true,
      client_last_edit_at: null,
      client_submitted_at: null,
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
