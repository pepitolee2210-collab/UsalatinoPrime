import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { AUTOMATED_FORMS } from '@/lib/legal/automated-forms-registry'
import { isFieldEditableByClient, hasResolvedValue } from '@/lib/legal/field-policy'
import type { CasePhase } from '@/types/database'

/**
 * GET /api/cita/[token]/forms/[slug]
 *
 * Carga (o crea) la instancia de un formulario para el cliente. Devuelve:
 *   - sections: solo los user fields editables y NO resueltos por prefill
 *   - prefillBag: lo que ya viene auto-llenado (read-only, mostrar como confirmado)
 *   - savedValues: lo que el cliente ya escribió antes
 *   - locked_for_client: si Diana bloqueó la edición
 *
 * PUT — autosave del cliente. Body: { values: {} }
 *   Mergea con filled_values existente y actualiza client_last_edit_at.
 *   Falla con 423 si locked_for_client=true.
 *
 * Nota: la pregunta del cliente es "¿qué necesitas que llene?" — los campos
 * jurídicos (court_number, hardcoded SIJS, decisiones de servicio) los
 * sigue manejando Diana en /admin/cases/[id]/jurisdiction-panel.
 */

type FieldType = 'text' | 'textarea' | 'checkbox' | 'date' | 'phone' | 'state' | 'zip'

interface ClientField {
  semanticKey: string
  type: FieldType
  labelEs: string
  helpEs?: string
  required: boolean
  groupKey?: string
  options?: { value: string; labelEs: string }[]
  maxLength?: number
}

interface ClientSection {
  id: number
  titleEs: string
  descriptionEs: string
  fields: ClientField[]
}

interface ConfirmedValue {
  semanticKey: string
  labelEs: string
  value: string | boolean | null
  source: 'profile' | 'tutor_guardian' | 'client_story' | 'jurisdiction' | 'hardcoded' | 'previous_form'
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; slug: string }> },
) {
  const { token, slug } = await params
  const supabase = createServiceClient()

  const def = AUTOMATED_FORMS[slug]
  if (!def) {
    return NextResponse.json({ error: 'Formulario no encontrado' }, { status: 404 })
  }

  const { data: tokenData } = await supabase
    .from('appointment_tokens')
    .select('case_id, is_active')
    .eq('token', token)
    .single()
  if (!tokenData?.is_active) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 403 })
  }

  // Cargar caso para validar fase aplicable y obtener defaults
  const { data: caseRow } = await supabase
    .from('cases')
    .select('current_phase, state_us')
    .eq('id', tokenData.case_id)
    .single()

  const currentPhase = caseRow?.current_phase as CasePhase | null

  // Cargar o crear instancia
  let { data: instance } = await supabase
    .from('case_form_instances')
    .select('id, filled_values, status, locked_for_client')
    .eq('case_id', tokenData.case_id)
    .eq('form_name', def.formName)
    .maybeSingle()

  if (!instance) {
    const { data: created } = await supabase
      .from('case_form_instances')
      .insert({
        case_id: tokenData.case_id,
        packet_type: def.packetType,
        form_name: def.formName,
        form_url_official: def.pdfPublicPath,
        form_description_es: def.formDescriptionEs,
        is_mandatory: true,
        filled_values: {},
        status: 'pending',
      })
      .select('id, filled_values, status, locked_for_client')
      .single()
    instance = created ?? null
  }

  const savedValues = (instance?.filled_values as Record<string, string | boolean | null> | undefined) ?? {}

  // Construir prefillBag desde el builder del form
  let prefillBag: Record<string, string | boolean | null | undefined> = {}
  try {
    prefillBag = await def.buildPrefilledValues(tokenData.case_id, supabase)
  } catch {
    prefillBag = {}
  }

  // Filtrar secciones a solo user fields no-resueltos
  const sections: ClientSection[] = []
  const confirmedValues: ConfirmedValue[] = []
  for (const section of def.sections) {
    const userFields: ClientField[] = []
    for (const field of section.fields) {
      const editable = isFieldEditableByClient(field)
      if (!editable) {
        // Si tiene valor en prefill, mostrarlo como "confirmado" pero no editable por cliente
        if (hasResolvedValue(prefillBag, field.semanticKey)) {
          confirmedValues.push({
            semanticKey: field.semanticKey,
            labelEs: field.labelEs,
            value: prefillBag[field.semanticKey] as string | boolean | null,
            source: field.hardcoded !== undefined ? 'hardcoded' : 'previous_form',
          })
        }
        continue
      }
      // Campo editable por cliente
      if (hasResolvedValue(prefillBag, field.semanticKey) && !hasResolvedValue(savedValues, field.semanticKey)) {
        // Tiene prefill desde otra fuente (ej. profile, tutor) → mostrar como confirmado
        confirmedValues.push({
          semanticKey: field.semanticKey,
          labelEs: field.labelEs,
          value: prefillBag[field.semanticKey] as string | boolean | null,
          source: detectSource(field.deriveFrom),
        })
        continue
      }
      // Cliente debe llenarlo
      userFields.push({
        semanticKey: field.semanticKey,
        type: field.type as FieldType,
        labelEs: field.labelEs,
        helpEs: field.helpEs,
        required: !!field.required,
        groupKey: field.groupKey,
        options: field.options,
        maxLength: field.maxLength,
      })
    }
    if (userFields.length > 0) {
      sections.push({
        id: section.id,
        titleEs: section.titleEs,
        descriptionEs: section.descriptionEs,
        fields: userFields,
      })
    }
  }

  return NextResponse.json({
    instance_id: instance?.id ?? null,
    slug,
    form_name: def.formName,
    description_es: def.formDescriptionEs,
    state: def.states[0] ?? null,
    current_phase: currentPhase,
    locked_for_client: instance?.locked_for_client ?? false,
    instance_status: instance?.status ?? 'pending',
    sections,
    confirmed_values: confirmedValues,
    saved_values: savedValues,
  })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; slug: string }> },
) {
  const { token, slug } = await params
  const def = AUTOMATED_FORMS[slug]
  if (!def) {
    return NextResponse.json({ error: 'Formulario no encontrado' }, { status: 404 })
  }

  let body: { values?: Record<string, string | boolean | null> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }
  const incoming = body.values ?? {}
  if (typeof incoming !== 'object') {
    return NextResponse.json({ error: 'values debe ser objeto' }, { status: 400 })
  }

  // Validación parcial con Zod del schema del form
  const parsed = def.zodSchema.partial().safeParse(incoming)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validación falló', issues: parsed.error.issues }, { status: 400 })
  }

  // Solo aceptar campos editables por cliente (defensa contra inyección de jurídicos)
  const cleaned: Record<string, string | boolean | null> = {}
  for (const [k, v] of Object.entries(parsed.data)) {
    const field = def.fieldByKey[k]
    if (!field) continue
    if (!isFieldEditableByClient(field)) continue
    cleaned[k] = v as string | boolean | null
  }

  const supabase = createServiceClient()
  const { data: tokenData } = await supabase
    .from('appointment_tokens')
    .select('case_id, is_active')
    .eq('token', token)
    .single()
  if (!tokenData?.is_active) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 403 })
  }

  // Cargar/crear instancia + chequear lock
  const { data: instance } = await supabase
    .from('case_form_instances')
    .select('id, filled_values, locked_for_client')
    .eq('case_id', tokenData.case_id)
    .eq('form_name', def.formName)
    .maybeSingle()

  if (instance?.locked_for_client) {
    return NextResponse.json({ error: 'Este formulario está bloqueado por tu equipo legal' }, { status: 423 })
  }

  const merged = { ...((instance?.filled_values as Record<string, string | boolean | null>) ?? {}), ...cleaned }

  let savedId = instance?.id
  if (!savedId) {
    const { data: created } = await supabase
      .from('case_form_instances')
      .insert({
        case_id: tokenData.case_id,
        packet_type: def.packetType,
        form_name: def.formName,
        form_url_official: def.pdfPublicPath,
        form_description_es: def.formDescriptionEs,
        is_mandatory: true,
        filled_values: merged,
        status: 'partial',
        client_last_edit_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    savedId = created?.id
  } else {
    await supabase
      .from('case_form_instances')
      .update({
        filled_values: merged,
        status: 'partial',
        client_last_edit_at: new Date().toISOString(),
      })
      .eq('id', savedId)
  }

  return NextResponse.json({ saved_at: new Date().toISOString(), instance_id: savedId, fields_saved: Object.keys(cleaned).length })
}

function detectSource(deriveFrom: string | undefined): ConfirmedValue['source'] {
  if (!deriveFrom) return 'previous_form'
  if (deriveFrom.startsWith('petitioner.') && (deriveFrom.includes('first_name') || deriveFrom.includes('last_name') || deriveFrom.includes('phone') || deriveFrom.includes('email') || deriveFrom.includes('full_address') || deriveFrom.includes('ssn'))) {
    return 'profile'
  }
  if (deriveFrom.startsWith('petitioner.')) return 'tutor_guardian'
  if (deriveFrom.startsWith('respondent_a.') || deriveFrom.startsWith('child_')) return 'tutor_guardian'
  if (deriveFrom.startsWith('jurisdiction.')) return 'jurisdiction'
  if (deriveFrom.startsWith('minor.')) return 'client_story'
  if (deriveFrom.startsWith('sijs_defaults.')) return 'hardcoded'
  return 'previous_form'
}
