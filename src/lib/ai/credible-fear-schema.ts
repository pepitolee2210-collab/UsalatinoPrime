// Schema Zod del output del prompt v6 del Miedo Creíble.
//
// Cambio principal vs v5: la generación se divide en DOS llamadas a Claude
// Opus 4.7 (16k output cap):
//
//   1. `analysisOutputSchema` — análisis estructurado del caso (case_analysis,
//      i589_field_values, supplement_b, evidence_index, self_check, audit_seed).
//      Sin declaración. Cabe en ~5-8k output tokens.
//
//   2. `declarationOutputSchema` — declaración_es de 3000-5000 palabras con
//      estructura I-VI (idéntica a la carta de referencia del caso Karen
//      Maleni Rivas Avalos), URLs citadas en el body de la sección VI, y
//      factual_claims_audit completo. Cabe en ~10-14k output tokens.
//
// El route handler las combina en `CredibleFearMergedOutput` y persiste todo
// en `case_credible_fear_drafts` con tokens separados por sub-llamada.
//
// Comparado con v5: solo declaration_es (sin EN), nueva estructura con
// roman_numeral y subpart en sections, nuevo cited_urls_in_body.

import { z } from 'zod'

// ──────────────────────────────────────────────────────────────────
// Status + diagnósticos
// ──────────────────────────────────────────────────────────────────

export const credibleFearStatusSchema = z.enum([
  'DRAFT_COMPLETE',
  'GAPS_FOUND',
  'REQUIRES_REVIEW',
])
export type CredibleFearStatus = z.infer<typeof credibleFearStatusSchema>

export const gapFoundSchema = z.object({
  element: z.enum(['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8']),
  missing_or_thin: z.string(),
  module_to_revisit: z.string(),
  clarifying_question_for_applicant: z.string(),
})
export type GapFound = z.infer<typeof gapFoundSchema>

export const reviewFlagSchema = z.object({
  flag_type: z.enum([
    'one_year_bar',
    'firm_resettlement',
    'criminal_history',
    'persecutor_bar',
    'material_support',
    'inconsistency',
    'frivolous_risk',
  ]),
  details: z.string(),
  module_source: z.string().optional().nullable(),
})
export type ReviewFlag = z.infer<typeof reviewFlagSchema>

// ──────────────────────────────────────────────────────────────────
// Case analysis (siempre poblado, robusto contra valores no-enum de Claude)
// ──────────────────────────────────────────────────────────────────

const PERPETRATOR_VALUES = [
  'state_military',
  'state_police',
  'state_other',
  'armed_group',
  'organized_crime',
  'gang',
  'religious_extremist',
  'family_partner',
  'private_individual',
  'other',
] as const

const GOVERNMENT_ROLE_VALUES = [
  'perpetrator',
  'acquiescent',
  'unable',
  'unwilling',
  'unclear',
] as const

const ONE_YEAR_STATUS_VALUES = ['within', 'outside_with_exception', 'outside_no_exception'] as const

const PROTECTED_GROUND_VALUES = [
  'race',
  'religion',
  'nationality',
  'political_opinion',
  'particular_social_group',
  'torture',
] as const

/**
 * Aliases que Claude tiende a emitir cuando confunde el enum de
 * `protected_grounds_identified_by_applicant` (que usa "torture") con la key
 * `part_b_q1_grounds.torture_convention` del schema I-589 (donde el sufijo
 * "_convention" sí es correcto). Normalizamos antes de validar para que el
 * análisis no sea rechazado por una etiqueta sinonímica.
 */
const PROTECTED_GROUND_ALIASES: Record<string, (typeof PROTECTED_GROUND_VALUES)[number]> = {
  torture_convention: 'torture',
  cat: 'torture',
}

function coerceEnum<T extends readonly string[]>(
  values: T,
  fallback: T[number],
): (v: unknown) => T[number] {
  return (v) => {
    if (typeof v === 'string' && (values as readonly string[]).includes(v)) {
      return v as T[number]
    }
    return fallback
  }
}

/**
 * Normaliza cada elemento del array contra el enum válido. Descarta valores
 * irrecuperables en vez de devolver el array completo a fallback — así el
 * análisis no pierde grounds legítimos por culpa de uno mal etiquetado.
 */
function coerceProtectedGroundArray(v: unknown): (typeof PROTECTED_GROUND_VALUES)[number][] {
  if (!Array.isArray(v)) return []
  const out: (typeof PROTECTED_GROUND_VALUES)[number][] = []
  for (const item of v) {
    if (typeof item !== 'string') continue
    if ((PROTECTED_GROUND_VALUES as readonly string[]).includes(item)) {
      out.push(item as (typeof PROTECTED_GROUND_VALUES)[number])
      continue
    }
    const aliased = PROTECTED_GROUND_ALIASES[item]
    if (aliased) out.push(aliased)
  }
  return out
}

export const caseAnalysisSchema = z.object({
  protected_grounds_identified_by_applicant: z.preprocess(
    coerceProtectedGroundArray,
    z.array(z.enum(PROTECTED_GROUND_VALUES)),
  ).default([]),
  psg_articulated_by_applicant: z.string().nullable().optional(),
  primary_perpetrator_type: z.preprocess(
    coerceEnum(PERPETRATOR_VALUES, 'other'),
    z.enum(PERPETRATOR_VALUES),
  ),
  primary_perpetrator_name: z.string().nullable().optional(),
  government_role: z.preprocess(
    coerceEnum(GOVERNMENT_ROLE_VALUES, 'unclear'),
    z.enum(GOVERNMENT_ROLE_VALUES),
  ),
  first_incident_date_approx: z.string().default(''),
  last_incident_date_approx: z.string().default(''),
  date_left_country: z.string().default(''),
  date_entered_us: z.string().default(''),
  one_year_status: z.preprocess(
    coerceEnum(ONE_YEAR_STATUS_VALUES, 'within'),
    z.enum(ONE_YEAR_STATUS_VALUES),
  ),
  case_strength_indicators: z.array(z.string()).default([]),
  case_thinness_indicators: z.array(z.string()).default([]),
})
export type CaseAnalysis = z.infer<typeof caseAnalysisSchema>

// ──────────────────────────────────────────────────────────────────
// I-589 field values (páginas 5-9)
// ──────────────────────────────────────────────────────────────────

const yesNoTextSchema = z.object({
  answer_yes: z.boolean(),
  summary_text: z.string(),
})

export const i589FieldValuesSchema = z.object({
  part_b_q1_grounds: z.object({
    race: z.boolean(),
    religion: z.boolean(),
    nationality: z.boolean(),
    political_opinion: z.boolean(),
    particular_social_group: z.boolean(),
    torture_convention: z.boolean(),
  }),
  part_b_q1a_past_persecution: yesNoTextSchema,
  part_b_q1b_future_fear: yesNoTextSchema,
  part_b_q2_legal_trouble: yesNoTextSchema,
  part_b_q3a_organizations: yesNoTextSchema,
  part_b_q3b_continued_participation: yesNoTextSchema,
  part_b_q4_torture_fear: yesNoTextSchema,
  part_c_q1_prior_applications: yesNoTextSchema,
  part_c_q2a_transit_countries: yesNoTextSchema,
  part_c_q2b_third_country_status: yesNoTextSchema,
  part_c_q3_persecutor_bar: yesNoTextSchema,
  part_c_q4_returned_to_country: yesNoTextSchema,
  part_c_q5_one_year_late: yesNoTextSchema,
  part_c_q6_us_crimes: yesNoTextSchema,
})
export type I589FieldValues = z.infer<typeof i589FieldValuesSchema>

// ──────────────────────────────────────────────────────────────────
// Supplement B
// ──────────────────────────────────────────────────────────────────

export const supplementBEntrySchema = z.object({
  part: z.enum(['B', 'C']),
  question: z.string(),
  extended_text: z.string(),
})
export type SupplementBEntry = z.infer<typeof supplementBEntrySchema>

// ──────────────────────────────────────────────────────────────────
// Evidence index
// ──────────────────────────────────────────────────────────────────

// String fields que pueden venir null/undefined cuando Claude no tiene el
// dato (p.ej. fecha de un documento no detectada por OCR). Usamos
// preprocess para convertir null → '' antes del enum/string check, y así
// el schema no rechaza outputs por campos opcionales mal poblados.
const nullableString = z.preprocess(
  (v) => (v === null || v === undefined ? '' : v),
  z.string().default(''),
)

const evidenceCategoryValues = [
  'personal_id',
  'membership_proof',
  'witness_affidavit',
  'medical_report',
  'psychological_report',
  'police_report',
  'documented_threat',
  'injury_photo',
  'press_article',
  'country_conditions_report',
  'social_media',
  'other',
] as const

const evidenceLanguageValues = ['es', 'en', 'other'] as const

export const evidenceItemSchema = z.object({
  exhibit_number: nullableString,
  category: z.preprocess(
    coerceEnum(evidenceCategoryValues, 'other'),
    z.enum(evidenceCategoryValues),
  ),
  title: nullableString,
  source: nullableString,
  date: nullableString,
  language: z.preprocess(
    coerceEnum(evidenceLanguageValues, 'other'),
    z.enum(evidenceLanguageValues),
  ),
  translation_required: z.boolean().default(false),
  supports_paragraphs: z.array(z.number().int().positive()).default([]),
})
export type EvidenceItem = z.infer<typeof evidenceItemSchema>

// ──────────────────────────────────────────────────────────────────
// Factual claims audit
// ──────────────────────────────────────────────────────────────────

export const factualClaimSchema = z.object({
  claim_id: z.string(),
  claim_text: z.string(),
  in_section: z.string().default(''), // "III", "IV", etc.
  source_module: z.string(),
  source_excerpt: z.string(),
})
export type FactualClaim = z.infer<typeof factualClaimSchema>

// ──────────────────────────────────────────────────────────────────
// Self-check
// ──────────────────────────────────────────────────────────────────

const elementStatus = z.enum(['yes', 'weak', 'missing', 'n/a_state_actor'])
const e8Status = z.enum(['yes', 'flags_present'])

export const selfCheckSchema = z.object({
  E1_persecution_articulated: elementStatus,
  E2_protected_ground_articulated: elementStatus,
  E3_nexus_articulated: elementStatus,
  E4_perpetrator_identified: elementStatus,
  E5_government_failure_articulated: elementStatus,
  E6_relocation_addressed: elementStatus,
  E7_future_fear_specific: elementStatus,
  E8_bars_cleared: e8Status,
  overall_completeness: z.enum(['ready_for_client_review', 'needs_more_input']),
  estimated_strength: z.enum(['strong', 'moderate', 'thin']),
})
export type SelfCheck = z.infer<typeof selfCheckSchema>

// ──────────────────────────────────────────────────────────────────
// Declaración v6 — estructura I-VI con roman_numeral
// ──────────────────────────────────────────────────────────────────

export const declarationParagraphV6Schema = z.object({
  number: z.number().int().positive(),
  text: z.string(),
  source_modules: z.array(z.string()).default([]),
})

export const declarationSectionV6Schema = z.object({
  roman_numeral: z.enum(['I', 'II', 'III', 'IV', 'V', 'VI']),
  subpart: z.string().nullable().optional(), // "A" o "B" para sección VI
  heading: z.string(),
  paragraphs: z.array(declarationParagraphV6Schema),
})

/**
 * Schema de la declaración v6 (estructura I-VI con roman_numeral y subpart).
 *
 * **Nota sobre el idioma**: a partir de v6.1 (2026-05-23) el CONTENIDO de
 * esta declaración se genera en INGLÉS (USCIS standard). El campo se llama
 * `declaration_es` por compatibilidad con drafts v5/v6 anteriores que sí
 * estaban en español; no renombrar la columna BD evita una migración
 * disruptiva. Las nuevas generaciones poblarán el campo con texto en inglés.
 */
export const declarationV6Schema = z.object({
  title: z.string(),
  applicant_full_name_uppercase: z.string(),
  sections: z.array(declarationSectionV6Schema),
  closing_attestation: z.string(),
  signature_line: z.string(),
  date_line: z.string(),
})
export type DeclarationV6 = z.infer<typeof declarationV6Schema>

// URLs citadas en el body (sección VI Parte A + B). Auditoría de qué URLs
// reales aparecieron en la declaración. Todos los string fields tolerantes
// a null (Claude a veces no tiene fecha de publicación del artículo).
export const citedUrlInBodySchema = z.object({
  roman_numeral: nullableString, // típicamente "VI"
  subpart: z.string().nullable().optional(), // "A" o "B"
  medio: nullableString,
  titulo: nullableString,
  fecha_pub: nullableString,
  url: nullableString,
})
export type CitedUrlInBody = z.infer<typeof citedUrlInBodySchema>

// ──────────────────────────────────────────────────────────────────
// Output llamada 1 — análisis estructurado (sin declaración)
// ──────────────────────────────────────────────────────────────────

export const analysisOutputSchema = z.object({
  status: credibleFearStatusSchema,
  gaps_found: z.array(gapFoundSchema).optional().default([]),
  review_required_flags: z.array(reviewFlagSchema).optional().default([]),
  case_analysis: caseAnalysisSchema,
  i589_field_values: i589FieldValuesSchema.nullable(),
  supplement_b_entries: z.array(supplementBEntrySchema).optional().default([]),
  evidence_index: z.array(evidenceItemSchema).optional().default([]),
  factual_claims_audit_seed: z.array(factualClaimSchema).optional().default([]),
  self_check: selfCheckSchema,
})
export type AnalysisOutput = z.infer<typeof analysisOutputSchema>

// ──────────────────────────────────────────────────────────────────
// Output llamada 2 — declaración detallada
// ──────────────────────────────────────────────────────────────────

export const declarationOutputSchema = z.object({
  declaration_es: declarationV6Schema.nullable(),
  cited_urls_in_body: z.array(citedUrlInBodySchema).optional().default([]),
  factual_claims_audit: z.array(factualClaimSchema).optional().default([]),
  declaration_total_words: z.number().int().nonnegative().default(0),
})
export type DeclarationOutput = z.infer<typeof declarationOutputSchema>

// ──────────────────────────────────────────────────────────────────
// Output mergeado final v6 (combinación de las 2 llamadas)
// ──────────────────────────────────────────────────────────────────

export interface CredibleFearMergedOutputV6 {
  status: CredibleFearStatus
  gaps_found: GapFound[]
  review_required_flags: ReviewFlag[]
  case_analysis: CaseAnalysis
  i589_field_values: I589FieldValues | null
  supplement_b_entries: SupplementBEntry[]
  evidence_index: EvidenceItem[]
  self_check: SelfCheck
  declaration_es: DeclarationV6 | null
  cited_urls_in_body: CitedUrlInBody[]
  factual_claims_audit: FactualClaim[]
  declaration_total_words: number
}
