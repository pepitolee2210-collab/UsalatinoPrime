// Resolver canónico del país de origen del solicitante.
//
// El dato puede vivir en 5 lugares distintos por razones históricas:
//   1. case_form_instances.filled_values.m2_country_of_birth (cuestionario M1-M11)
//   2. case_form_submissions.form_data.country_of_birth      (wizard I-589 Parte A)
//   3. documents.ai_extracted_data.country_of_birth          (hook futuro — OCR I-589)
//   4. profiles.country_of_birth                              (perfil del cliente)
//   5. profiles.nationality                                   (fallback de último recurso)
//
// El cuestionario M2 es lo que el cliente confirma en su propia mano y suele
// ser lo más fresco; el profile puede quedar vacío si nunca pasó por un
// formulario que lo capture. Por eso el orden de precedencia es M2 → wizard
// I-589 → OCR → profile → nationality.
//
// Side-effect free: este helper no escribe en BD. La auto-persistencia hacia
// el profile vive en el endpoint del cuestionario (autosave).

import type { SupabaseClient } from '@supabase/supabase-js'
import { CREDIBLE_FEAR_QUESTIONNAIRE_SLUG } from '@/lib/legal/asilo-miedo-creible-form-schema'

export type ApplicantCountrySource =
  | 'questionnaire_m2'
  | 'i589_wizard'
  | 'document_extraction'
  | 'profile_country_of_birth'
  | 'profile_nationality'

export interface ResolvedCountry {
  /** Texto normalizado en Title Case ("Venezuela"). `null` si ninguna fuente respondió. */
  country: string | null
  /** Texto trimmed y lowercased ("venezuela") para alimentar mappers texto→ISO. */
  countryLower: string | null
  /** Fuente que ganó. `null` si ninguna fuente respondió. */
  source: ApplicantCountrySource | null
  /** Auditoría: todas las fuentes consultadas, con su valor crudo (post-trim). */
  trace: Array<{ source: ApplicantCountrySource; rawValue: string | null }>
}

export interface ApplicantProfileSnapshot {
  country_of_birth: string | null
  nationality: string | null
}

export interface ResolveApplicantCountryInput {
  supabase: SupabaseClient
  caseId: string
  /**
   * Snapshot del profile ya cargado por el caller. Pasar `null` si no se ha
   * cargado y se quiere que el helper haga su propio SELECT (caso típico:
   * validate-case-before-generation que solo recibe el caseId).
   */
  profile: ApplicantProfileSnapshot | null
}

function normalize(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Title-case manteniendo whitespace interno. "venezuela " → "Venezuela",
 * "REPÚBLICA DE COLOMBIA" → "República De Colombia". El matching ISO
 * usa `countryLower` aparte, así que la cosmética no afecta la lógica.
 */
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/(\s+)/)
    .map((w) => (/^\s+$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('')
}

function buildResult(
  raw: string,
  source: ApplicantCountrySource,
  trace: ResolvedCountry['trace'],
): ResolvedCountry {
  return {
    country: titleCase(raw),
    countryLower: raw.toLowerCase(),
    source,
    trace,
  }
}

async function loadProfileIfNeeded(
  supabase: SupabaseClient,
  caseId: string,
  provided: ApplicantProfileSnapshot | null,
): Promise<ApplicantProfileSnapshot | null> {
  if (provided) return provided
  const { data } = await supabase
    .from('cases')
    .select('client:profiles!cases_client_id_fkey(country_of_birth, nationality)')
    .eq('id', caseId)
    .single<{
      client: ApplicantProfileSnapshot | ApplicantProfileSnapshot[] | null
    }>()
  if (!data?.client) return null
  return Array.isArray(data.client) ? (data.client[0] ?? null) : data.client
}

export async function resolveApplicantCountry(
  input: ResolveApplicantCountryInput,
): Promise<ResolvedCountry> {
  const { supabase, caseId } = input
  const trace: ResolvedCountry['trace'] = []

  // 1. Cuestionario M2 (la fuente más fresca, llenada por el propio cliente).
  const { data: cfi } = await supabase
    .from('case_form_instances')
    .select('filled_values')
    .eq('case_id', caseId)
    .eq('form_name', CREDIBLE_FEAR_QUESTIONNAIRE_SLUG)
    .maybeSingle<{ filled_values: Record<string, unknown> | null }>()
  const m2Raw = normalize(cfi?.filled_values?.m2_country_of_birth)
  trace.push({ source: 'questionnaire_m2', rawValue: m2Raw })
  if (m2Raw) return buildResult(m2Raw, 'questionnaire_m2', trace)

  // 2. Wizard I-589 Parte A (1-4 piezas).
  const { data: subs } = await supabase
    .from('case_form_submissions')
    .select('form_data')
    .eq('case_id', caseId)
    .in('form_type', ['i589_part_a1', 'i589_part_a2', 'i589_part_a3', 'i589_part_a4'])
    .eq('minor_index', 0)
    .returns<{ form_data: Record<string, unknown> | null }[]>()
  let i589Raw: string | null = null
  for (const sub of subs ?? []) {
    const candidate = normalize(sub.form_data?.country_of_birth)
    if (candidate) {
      i589Raw = candidate
      break
    }
  }
  trace.push({ source: 'i589_wizard', rawValue: i589Raw })
  if (i589Raw) return buildResult(i589Raw, 'i589_wizard', trace)

  // 3. Extracción IA de documentos. Hoy NULL para I-589 (el extractor solo
  // corre para apelacion_denegacion_juez); deja el hook listo para cuando
  // se sume el extractor estructurado de I-589 pag 1-4.
  const { data: docs } = await supabase
    .from('documents')
    .select('ai_extracted_data')
    .eq('case_id', caseId)
    .eq('ai_extraction_status', 'completed')
    .not('ai_extracted_data', 'is', null)
    .returns<{ ai_extracted_data: Record<string, unknown> | null }[]>()
  let docRaw: string | null = null
  for (const doc of docs ?? []) {
    const ext = doc.ai_extracted_data
    const direct = normalize(ext?.country_of_birth)
    if (direct) {
      docRaw = direct
      break
    }
    const nested = ext?.i589
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const fromNested = normalize((nested as Record<string, unknown>).country_of_birth)
      if (fromNested) {
        docRaw = fromNested
        break
      }
    }
  }
  trace.push({ source: 'document_extraction', rawValue: docRaw })
  if (docRaw) return buildResult(docRaw, 'document_extraction', trace)

  // 4 + 5. Profile (cargar si no vino pre-resuelto).
  const profile = await loadProfileIfNeeded(supabase, caseId, input.profile)

  const cobRaw = normalize(profile?.country_of_birth)
  trace.push({ source: 'profile_country_of_birth', rawValue: cobRaw })
  if (cobRaw) return buildResult(cobRaw, 'profile_country_of_birth', trace)

  const natRaw = normalize(profile?.nationality)
  trace.push({ source: 'profile_nationality', rawValue: natRaw })
  if (natRaw) return buildResult(natRaw, 'profile_nationality', trace)

  return { country: null, countryLower: null, source: null, trace }
}

/**
 * Expuesto para reuso (auto-persistencia M2 → profile en el endpoint del
 * cuestionario). Mantener Title Case consistente con el resolver.
 */
export function titleCaseCountry(raw: string): string {
  return titleCase(raw)
}
