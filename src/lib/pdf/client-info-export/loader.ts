// Loader: lee TODAS las fuentes de datos llenados por el cliente para un caso
// y las normaliza a `RawFormRecord[]`.
//
// Fuentes:
//   1. case_form_submissions  — I-360, testigos, tutor, historia, padre ausente,
//                               partes I-589 y subforms guardados por client_id.
//   2. case_form_instances    — Forms del registry AUTOMATED_FORMS (I-485,
//                               EOIR-26, EOIR-26A, SAPCR-*, FL-Guardianship, etc.)
//
// Para case_form_instances el "formType" canónico es el slug del registry.
// Lo extraemos de `acroform_schema.slug` (guardado al crear la instancia) con
// fallback a `form_name` matcheado contra AUTOMATED_FORMS.
//
// Promise.all paraleliza las queries — overhead típico es ~150ms total.
// Si una fuente falla, la otra continúa: el caller decide qué hacer con
// `partialErrors`.

import type { SupabaseClient } from '@supabase/supabase-js'

import { AUTOMATED_FORMS } from '@/lib/legal/automated-forms-registry'
import type { CasePhase } from '@/types/database'

import type {
  CaseSnapshot,
  ClientProfileSnapshot,
  RawFormRecord,
} from './types'
import { normalizeStatus } from './formatters'
import { selectBestVersions } from './best-version'
import { getServiceRegistry } from '@/lib/services/registry'

/** Snapshot mínimo del row de `cases` que necesitamos. */
interface CaseRow {
  id: string
  case_number: string
  service_id: string | null
  current_phase: CasePhase | null
  client_id: string | null
}

export interface LoadResult {
  caseSnapshot: CaseSnapshot
  clientProfile: ClientProfileSnapshot
  records: RawFormRecord[]
  /** Errores por fuente que NO bloquean la generación del PDF. */
  partialErrors: string[]
}

interface CaseFormSubmissionRow {
  form_type: string | null
  form_data: Record<string, unknown> | null
  status: string | null
  minor_index: number | null
  updated_at: string | null
  submitted_at: string | null
}

interface CaseFormInstanceRow {
  id: string
  form_name: string | null
  acroform_schema: { slug?: string | null } | null
  filled_values: Record<string, unknown> | null
  status: string | null
  updated_at: string | null
  filled_at: string | null
  phase_when_submitted: string | null
}

/** Carga el snapshot del cliente, caso, y todos los registros de forms. */
export async function loadClientInfoSnapshot(
  caseId: string,
  service: SupabaseClient,
): Promise<LoadResult | null> {
  // 1. Carga el caso. El service_slug NO vive en cases — se resuelve via
  //    service_catalog en una segunda query (patrón de case-overview).
  //    El profile también se trae aparte para evitar fallos del join.
  const { data: caseRow, error: caseErr } = await service
    .from('cases')
    .select('id, case_number, service_id, current_phase, client_id')
    .eq('id', caseId)
    .single()

  if (caseErr || !caseRow) {
    if (caseErr) {
      console.warn('[client-info-pdf] case lookup failed:', caseErr.message)
    }
    return null
  }

  const typedRow = caseRow as unknown as CaseRow

  // Resolver service_slug
  let serviceSlug: string | null = null
  if (typedRow.service_id) {
    const { data: serviceRow } = await service
      .from('service_catalog')
      .select('slug')
      .eq('id', typedRow.service_id)
      .maybeSingle()
    serviceSlug = (serviceRow?.slug as string | undefined) ?? null
  }

  // Cargar profile del cliente
  let profile: Record<string, unknown> | null = null
  if (typedRow.client_id) {
    const { data: profileRow } = await service
      .from('profiles')
      .select(
        'first_name, middle_name, last_name, phone, email, date_of_birth, country_of_birth, nationality, a_number, ssn, address_street, address_unit, address_city, address_state, address_zip',
      )
      .eq('id', typedRow.client_id)
      .maybeSingle()
    profile = profileRow as Record<string, unknown> | null
  }
  const caseSnapshot = buildCaseSnapshot(typedRow, serviceSlug)
  const clientProfile = buildProfileSnapshot(profile)

  // 2. Lee fuentes de datos en paralelo
  const [submissionsRes, instancesRes] = await Promise.allSettled([
    service
      .from('case_form_submissions')
      .select('form_type, form_data, status, minor_index, updated_at, submitted_at')
      .eq('case_id', caseId),
    service
      .from('case_form_instances')
      .select('id, form_name, acroform_schema, filled_values, status, updated_at, filled_at, phase_when_submitted')
      .eq('case_id', caseId),
  ])

  const partialErrors: string[] = []
  const records: RawFormRecord[] = []

  if (submissionsRes.status === 'fulfilled') {
    const rows = ((submissionsRes.value.data ?? []) as unknown) as CaseFormSubmissionRow[]
    for (const row of rows) {
      const formType = (row.form_type ?? '').trim()
      if (!formType) continue
      const data = row.form_data ?? {}
      if (isPayloadEmpty(data)) continue
      records.push({
        source: 'case_form_submissions',
        formType,
        formSlug: null,
        formName: null,
        data,
        status: normalizeStatus(row.status),
        minorIndex: row.minor_index ?? null,
        updatedAt: row.submitted_at ?? row.updated_at ?? null,
        phaseHint: null,
      })
    }
  } else {
    partialErrors.push(`case_form_submissions: ${submissionsRes.reason?.message ?? 'error desconocido'}`)
  }

  if (instancesRes.status === 'fulfilled') {
    const rows = ((instancesRes.value.data ?? []) as unknown) as CaseFormInstanceRow[]
    for (const row of rows) {
      const slug = resolveInstanceSlug(row)
      const data = row.filled_values ?? {}
      if (isPayloadEmpty(data)) continue
      records.push({
        source: 'case_form_instances',
        formType: slug ?? `instance:${row.form_name ?? row.id}`,
        formSlug: slug,
        formName: row.form_name ?? null,
        data,
        status: normalizeStatus(row.status === 'ready' && hasAnyValue(data) ? 'submitted' : row.status),
        minorIndex: null,
        updatedAt: row.filled_at ?? row.updated_at ?? null,
        phaseHint: row.phase_when_submitted ?? null,
      })
    }
  } else {
    partialErrors.push(`case_form_instances: ${instancesRes.reason?.message ?? 'error desconocido'}`)
  }

  // 3. Dedupe por (formType, minorIndex) priorizando submitted > draft
  const best = selectBestVersions(records)

  return {
    caseSnapshot,
    clientProfile,
    records: best,
    partialErrors,
  }
}

function buildCaseSnapshot(row: CaseRow, serviceSlug: string | null): CaseSnapshot {
  const registry = getServiceRegistry(serviceSlug)
  const phaseDef = registry?.phases.find((p) => p.code === row.current_phase) ?? null
  return {
    id: row.id,
    caseNumber: row.case_number,
    serviceSlug: serviceSlug ?? '',
    serviceName: registry?.name ?? serviceSlug ?? 'Servicio sin nombre',
    currentPhase: row.current_phase ?? null,
    currentPhaseLabel: phaseDef?.label ?? null,
  }
}

function buildProfileSnapshot(profile: Record<string, unknown> | null): ClientProfileSnapshot {
  const get = (key: string): unknown => (profile?.[key] ?? null)
  return {
    firstName: stringOrNull(get('first_name')),
    middleName: stringOrNull(get('middle_name')),
    lastName: stringOrNull(get('last_name')),
    phone: stringOrNull(get('phone')),
    email: stringOrNull(get('email')),
    dateOfBirth: stringOrNull(get('date_of_birth')),
    countryOfBirth: stringOrNull(get('country_of_birth')),
    nationality: stringOrNull(get('nationality')),
    aNumber: stringOrNull(get('a_number')),
    ssn: stringOrNull(get('ssn')),
    addressStreet: stringOrNull(get('address_street')),
    addressUnit: stringOrNull(get('address_unit')),
    addressCity: stringOrNull(get('address_city')),
    addressState: stringOrNull(get('address_state')),
    addressZip: stringOrNull(get('address_zip')),
  }
}

function stringOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s ? s : null
}

function resolveInstanceSlug(row: CaseFormInstanceRow): string | null {
  // Preferencia 1: acroform_schema.slug (escrito por /api/admin/case-forms/[slug]/route.ts)
  const schemaSlug = row.acroform_schema?.slug
  if (schemaSlug && AUTOMATED_FORMS[schemaSlug]) return schemaSlug
  // Preferencia 2: match por formName contra el registry
  const name = row.form_name?.trim()
  if (!name) return null
  for (const [slug, def] of Object.entries(AUTOMATED_FORMS)) {
    if (def.formName === name) return slug
  }
  // Preferencia 3: heurística detectByName del registry
  for (const [slug, def] of Object.entries(AUTOMATED_FORMS)) {
    if (def.detectByName(name)) return slug
  }
  return null
}

function isPayloadEmpty(data: Record<string, unknown>): boolean {
  for (const v of Object.values(data)) {
    if (v === null || v === undefined) continue
    if (typeof v === 'string' && v.trim() === '') continue
    if (Array.isArray(v) && v.length === 0) continue
    if (typeof v === 'object' && Object.keys(v as Record<string, unknown>).length === 0) continue
    if (v === false) continue
    return false
  }
  return true
}

function hasAnyValue(data: Record<string, unknown>): boolean {
  return !isPayloadEmpty(data)
}
