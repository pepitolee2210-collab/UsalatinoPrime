// Schema Zod del output del prompt v5 del Miedo Creíble.
//
// La IA devuelve un JSON object canónico con todo lo necesario para:
//   1. Persistir un draft tipado en `case_credible_fear_drafts`.
//   2. Llenar el I-589 oficial páginas 5-9 desde `i589_field_values`.
//   3. Generar Supplement B para textos que excedan el espacio del field.
//   4. Mostrar la declaración EN+ES al admin con audit trail (claims +
//      module sources).
//   5. Devolver gaps al cliente cuando faltan datos críticos.
//
// IMPORTANTE: las claves de `i589_field_values` siguen el spec
// `documentos/i589_pages_4_to_12_mapping.json`. Si cambia el PDF I-589
// oficial, actualizar el field-map del PDF Y este schema.

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
// Case analysis (siempre poblado)
// ──────────────────────────────────────────────────────────────────

// case_analysis es siempre poblado, pero cuando status != DRAFT_COMPLETE
// muchos campos pueden no estar perfectamente determinados. Mantenemos el
// contrato pero hacemos opcionales/default los campos que Claude puede
// omitir, y usamos .catch para tolerar valores fuera del enum (Claude a
// veces inventa categorías cuando el caso es híbrido — ej. "state + colectivos"
// no encaja en un solo enum, así que cae a 'other').
export const caseAnalysisSchema = z.object({
  protected_grounds_identified_by_applicant: z.array(
    z.enum([
      'race',
      'religion',
      'nationality',
      'political_opinion',
      'particular_social_group',
      'torture',
    ]),
  ).default([]),
  psg_articulated_by_applicant: z.string().nullable().optional(),
  primary_perpetrator_type: z.enum([
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
  ]).catch('other').default('other'),
  primary_perpetrator_name: z.string().nullable().optional(),
  government_role: z.enum([
    'perpetrator',
    'acquiescent',
    'unable',
    'unwilling',
    'unclear',
  ]).catch('unclear').default('unclear'),
  first_incident_date_approx: z.string().default(''),
  last_incident_date_approx: z.string().default(''),
  date_left_country: z.string().default(''),
  date_entered_us: z.string().default(''),
  one_year_status: z.enum(['within', 'outside_with_exception', 'outside_no_exception']).catch('within').default('within'),
  case_strength_indicators: z.array(z.string()).default([]),
  case_thinness_indicators: z.array(z.string()).default([]),
})
export type CaseAnalysis = z.infer<typeof caseAnalysisSchema>

// ──────────────────────────────────────────────────────────────────
// Declaración (EN + ES)
// ──────────────────────────────────────────────────────────────────

export const declarationParagraphSchema = z.object({
  number: z.number().int().positive(),
  text: z.string(),
  source_modules: z.array(z.string()),
})

export const declarationSectionSchema = z.object({
  heading: z.string(),
  paragraphs: z.array(declarationParagraphSchema),
})

export const declarationSchema = z.object({
  title: z.string(),
  applicant_full_name_uppercase: z.string(),
  opening_statement: z.string(),
  sections: z.array(declarationSectionSchema),
  closing_attestation: z.string(),
  signature_line: z.string(),
  date_line: z.string(),
})
export type Declaration = z.infer<typeof declarationSchema>

// ──────────────────────────────────────────────────────────────────
// I-589 field values (páginas 5-9)
// ──────────────────────────────────────────────────────────────────

const yesNoTextSchema = z.object({
  answer_yes: z.boolean(),
  summary_text: z.string(),
})

export const i589FieldValuesSchema = z.object({
  // Página 5 — Part B Q1
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
  // Página 6 — Part B Q2-Q4
  part_b_q2_legal_trouble: yesNoTextSchema,
  part_b_q3a_organizations: yesNoTextSchema,
  part_b_q3b_continued_participation: yesNoTextSchema,
  part_b_q4_torture_fear: yesNoTextSchema,
  // Página 7 — Part C Q1, Q2a, Q2b, Q3
  part_c_q1_prior_applications: yesNoTextSchema,
  part_c_q2a_transit_countries: yesNoTextSchema,
  part_c_q2b_third_country_status: yesNoTextSchema,
  part_c_q3_persecutor_bar: yesNoTextSchema,
  // Página 8 — Part C Q4, Q5, Q6
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

export const evidenceItemSchema = z.object({
  exhibit_number: z.string(),
  category: z.enum([
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
  ]),
  title: z.string(),
  source: z.string(),
  date: z.string(),
  language: z.enum(['es', 'en', 'other']),
  translation_required: z.boolean(),
  supports_paragraphs: z.array(z.number().int().positive()),
})
export type EvidenceItem = z.infer<typeof evidenceItemSchema>

// ──────────────────────────────────────────────────────────────────
// Factual claims audit
// ──────────────────────────────────────────────────────────────────

export const factualClaimSchema = z.object({
  claim_id: z.string(),
  claim_text: z.string(),
  in_paragraph: z.number().int().positive(),
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
// Output completo del prompt v5
// ──────────────────────────────────────────────────────────────────

export const credibleFearStructuredOutputSchema = z.object({
  status: credibleFearStatusSchema,
  gaps_found: z.array(gapFoundSchema).optional().default([]),
  review_required_flags: z.array(reviewFlagSchema).optional().default([]),
  case_analysis: caseAnalysisSchema,
  declaration_en: declarationSchema.nullable(),
  declaration_es: declarationSchema.nullable(),
  i589_field_values: i589FieldValuesSchema.nullable(),
  supplement_b_entries: z.array(supplementBEntrySchema).optional().default([]),
  evidence_index: z.array(evidenceItemSchema).optional().default([]),
  factual_claims_audit: z.array(factualClaimSchema).optional().default([]),
  self_check: selfCheckSchema,
})
export type CredibleFearStructuredOutput = z.infer<typeof credibleFearStructuredOutputSchema>
