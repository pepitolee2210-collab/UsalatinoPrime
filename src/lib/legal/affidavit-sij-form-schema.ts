// Schema curado para "Affidavit to Support SIJ Motion" (DFPS Section 13).
//
// El template original DFPS 2019 es un .doc (Word 97-2003 binario) que
// fillDocxTemplate (jszip + OOXML) NO puede procesar. Lo regeneramos en .docx
// tokenizado con scripts/generate-affidavit-sij-docx.mjs preservando la
// estructura legal del DFPS toolkit.
//
// El affidavit puede ser firmado por:
//  - Caseworker DFPS (uso original): role = 'CPS Specialist'
//  - Madre Pro Se (caso típico UsaLatinoPrime): role = 'mother and petitioner'
//
// El prefill detecta la relación del peticionario y adapta affiant_name,
// affiant_role_intro, affiant_title, conservator_name, conservator_pronoun.

import { z } from 'zod'

// ── Constantes ───────────────────────────────────────────────────────────────

export const PDF_PUBLIC_PATH = '/forms/affidavit-sij.docx'
export const PDF_DISK_PATH = 'public/forms/affidavit-sij.docx'
export const PDF_SHA256 = '8a84099c49675eeadabe0d1db105078191b1c6579f1a325a909d733ccdaf0646'
export const SCHEMA_VERSION = '2019-dfps-section-13'
export const FORM_SLUG = 'tx-dfps-affidavit-sij'
export const FORM_NAME = 'TX DFPS Affidavit to Support SIJ Motion'
export const FORM_DESCRIPTION_ES = 'Declaración jurada en apoyo de la Motion for SIJ Findings (DFPS Section 13). Narra los hechos de abuso/abandono/negligencia y por qué el regreso al país no es de mejor interés.'

// ── Tipos ────────────────────────────────────────────────────────────────────

export type FieldType = 'text' | 'textarea' | 'date'

export interface FieldSpec {
  semanticKey: string
  pdfFieldName: string | null
  type: FieldType
  labelEs: string
  helpEs?: string
  page?: number
  required?: boolean
  hardcoded?: string
  deriveFrom?: string
  groupKey?: string
  options?: { value: string; labelEs: string }[]
  maxLength?: number
}

export interface FormSection {
  id: number
  titleEs: string
  descriptionEs: string
  fields: FieldSpec[]
}

// ── Sección 1 — Caption ──────────────────────────────────────────────────────

const SECTION_1: FormSection = {
  id: 1,
  titleEs: '1. Caption del juicio',
  descriptionEs: 'Encabezado obligatorio. La mayoría se asignan al e-filing.',
  fields: [
    { semanticKey: 'cause_number', pdfFieldName: 'cause_number', type: 'text',
      labelEs: 'Cause Number', helpEs: 'Vacío al filing inicial.', page: 1 },
    { semanticKey: 'child_caption_name', pdfFieldName: 'child_caption_name', type: 'text',
      labelEs: 'Nombre del menor (caption — iniciales B.Y.R.V.)',
      page: 1, required: true, deriveFrom: 'child.caption_name' },
    { semanticKey: 'county_name', pdfFieldName: 'county_name', type: 'text',
      labelEs: 'Condado', page: 1, required: true, deriveFrom: 'jurisdiction.county' },
    { semanticKey: 'judicial_district', pdfFieldName: 'judicial_district', type: 'text',
      labelEs: 'Distrito Judicial (número)', page: 1 },
  ],
}

// ── Sección 2 — Identificación del declarante (affiant) ──────────────────────

const SECTION_2: FormSection = {
  id: 2,
  titleEs: '2. Declarante (Affiant)',
  descriptionEs: 'Quién firma el affidavit. Para Pro Se: la madre/padre peticionaria. Para DFPS: el caseworker.',
  fields: [
    { semanticKey: 'affiant_name', pdfFieldName: 'affiant_name', type: 'text',
      labelEs: 'Nombre completo del declarante',
      helpEs: 'Quien firma bajo juramento. Para Jennifer Pro Se: ella misma.',
      page: 1, required: true, deriveFrom: 'affiant.name' },
    { semanticKey: 'affiant_role_intro', pdfFieldName: 'affiant_role_intro', type: 'textarea',
      labelEs: 'Rol del declarante (frase introductoria)',
      helpEs: 'Default Pro Se: "I am the petitioner and biological mother of the child." Default DFPS: vacío (el rol va en el title abajo).',
      page: 1, required: true, deriveFrom: 'affiant.role_intro' },
    { semanticKey: 'affiant_title', pdfFieldName: 'affiant_title', type: 'text',
      labelEs: 'Título debajo de la firma',
      helpEs: 'Pro Se: "Petitioner, Pro Se". DFPS: "Child Protective Services Specialist".',
      page: 1, required: true, deriveFrom: 'affiant.title' },
  ],
}

// ── Sección 3 — Datos del menor ──────────────────────────────────────────────

const SECTION_3: FormSection = {
  id: 3,
  titleEs: '3. Datos del menor',
  descriptionEs: 'Identificación completa del menor sujeto del SIJS.',
  fields: [
    { semanticKey: 'child_full_name', pdfFieldName: 'child_full_name', type: 'text',
      labelEs: 'Nombre completo del menor', page: 1, required: true,
      deriveFrom: 'child.full_name' },
    { semanticKey: 'child_mother_name', pdfFieldName: 'child_mother_name', type: 'text',
      labelEs: 'Nombre de la madre del menor', page: 1, required: true,
      deriveFrom: 'mother.name' },
    { semanticKey: 'child_father_name', pdfFieldName: 'child_father_name', type: 'text',
      labelEs: 'Nombre del padre del menor', page: 1, required: true,
      deriveFrom: 'father.name' },
    { semanticKey: 'child_sex', pdfFieldName: 'child_sex', type: 'text',
      labelEs: 'Sexo del menor', helpEs: 'male o female (en inglés).',
      page: 1, required: true, deriveFrom: 'child.sex' },
    { semanticKey: 'child_birth_date', pdfFieldName: 'child_birth_date', type: 'date',
      labelEs: 'Fecha de nacimiento (MM/DD/YYYY)', page: 1, required: true,
      deriveFrom: 'child.birth_date' },
    { semanticKey: 'child_birth_place', pdfFieldName: 'child_birth_place', type: 'text',
      labelEs: 'Lugar de nacimiento (ciudad, país)', page: 1, required: true,
      deriveFrom: 'child.birth_place' },
  ],
}

// ── Sección 4 — Custodia previa (managing conservator) ───────────────────────

const SECTION_4: FormSection = {
  id: 4,
  titleEs: '4. Custodia previa del menor',
  descriptionEs: 'Quién tiene la custodia legal y desde cuándo. Pro Se: la peticionaria. DFPS: el Department.',
  fields: [
    { semanticKey: 'conservator_name', pdfFieldName: 'conservator_name', type: 'text',
      labelEs: 'Nombre del managing conservator',
      helpEs: 'Pro Se: "Petitioner". DFPS: "the Texas Department of Family and Protective Services (DFPS)".',
      page: 1, required: true, deriveFrom: 'conservator.name' },
    { semanticKey: 'conservator_pronoun', pdfFieldName: 'conservator_pronoun', type: 'text',
      labelEs: 'Pronombre/sustantivo del conservator',
      helpEs: 'Pro Se: "her" o "him". DFPS: "the Department".',
      page: 1, required: true, deriveFrom: 'conservator.pronoun' },
    { semanticKey: 'prior_order_date', pdfFieldName: 'prior_order_date', type: 'text',
      labelEs: 'Fecha de la orden previa de Conservatorship',
      helpEs: 'Si aún no hay orden firmada, usa la fecha estimada de la audiencia.',
      page: 1, required: true, deriveFrom: 'prior_order.date' },
  ],
}

// ── Sección 5 — Reunificación NO viable con la madre ─────────────────────────

const SECTION_5: FormSection = {
  id: 5,
  titleEs: '5. Reunificación NO viable con la madre',
  descriptionEs: 'Sólo si la madre del menor es respondent. Si la peticionaria ES la madre, normalmente este bloque queda vacío.',
  fields: [
    { semanticKey: 'mother_name', pdfFieldName: 'mother_name', type: 'text',
      labelEs: 'Nombre de la madre (respondent)',
      page: 1, deriveFrom: 'mother.respondent_name' },
    { semanticKey: 'mother_grounds', pdfFieldName: 'mother_grounds', type: 'text',
      labelEs: 'Motivos legales (abuse, neglect, abandonment)',
      helpEs: 'Texto libre. Ej. "abuse and neglect" o "abandonment".',
      page: 1 },
    { semanticKey: 'mother_facts', pdfFieldName: 'mother_facts', type: 'textarea',
      labelEs: 'Hechos que muestran cada motivo (narrativa)',
      helpEs: 'Describe específicamente qué hizo la madre y por qué la reunificación no es posible.',
      page: 1 },
  ],
}

// ── Sección 6 — Reunificación NO viable con el padre ─────────────────────────

const SECTION_6: FormSection = {
  id: 6,
  titleEs: '6. Reunificación NO viable con el padre',
  descriptionEs: 'Para SIJS por madre Pro Se contra padre ausente, ESTE es el bloque crítico — describe abuso/abandono/negligencia con detalle.',
  fields: [
    { semanticKey: 'father_name', pdfFieldName: 'father_name', type: 'text',
      labelEs: 'Nombre del padre (respondent)',
      page: 1, required: true, deriveFrom: 'father.name' },
    { semanticKey: 'father_grounds', pdfFieldName: 'father_grounds', type: 'text',
      labelEs: 'Motivos legales (abuse, neglect, abandonment)',
      helpEs: 'Texto libre. Ej. "abandonment" si el padre se fue del país.',
      page: 1, required: true, deriveFrom: 'father.grounds_default' },
    { semanticKey: 'father_facts', pdfFieldName: 'father_facts', type: 'textarea',
      labelEs: 'Hechos que muestran cada motivo (narrativa)',
      helpEs: 'CRÍTICO. Sé específico: fechas, ausencias, falta de contacto, falta de soporte económico, paradero desconocido, etc.',
      page: 1, required: true, deriveFrom: 'father.facts_default' },
  ],
}

// ── Sección 7 — Mejor interés del menor ──────────────────────────────────────

const SECTION_7: FormSection = {
  id: 7,
  titleEs: '7. NO en mejor interés regresar al país',
  descriptionEs: 'Predicate finding crítico. Lista factores específicos del menor.',
  fields: [
    { semanticKey: 'child_country', pdfFieldName: 'child_country', type: 'text',
      labelEs: 'País de nacionalidad / última residencia habitual',
      page: 1, required: true, deriveFrom: 'child.country' },
    { semanticKey: 'best_interest_facts', pdfFieldName: 'best_interest_facts', type: 'textarea',
      labelEs: 'Factores de mejor interés (narrativa)',
      helpEs: 'Lista cada factor: ¿hay parientes en el país de origen que puedan cuidar al menor? ¿Tiene siblings/comunidad/escuela en EE.UU.? ¿Necesidades médicas/educativas que no se cubrirían en el país de origen? ¿Habla el idioma?',
      page: 1, required: true, deriveFrom: 'best_interest.facts_default' },
  ],
}

// ── Sección 8 — Final order ──────────────────────────────────────────────────

const SECTION_8: FormSection = {
  id: 8,
  titleEs: '8. Final Order',
  descriptionEs: 'Fecha y descripción de la orden final que nombra al peticionario como managing conservator.',
  fields: [
    { semanticKey: 'final_order_date', pdfFieldName: 'final_order_date', type: 'text',
      labelEs: 'Fecha de la final order',
      helpEs: 'Ej. "April 28, 2026" o "the date of this hearing".',
      page: 1, required: true },
    { semanticKey: 'final_order_action', pdfFieldName: 'final_order_action', type: 'textarea',
      labelEs: 'Descripción de la acción de la orden',
      helpEs: 'Default: "granting Petitioner Permanent Managing Conservatorship of this child". Para DFPS: "granting DFPS Permanent Managing Conservatorship of this child".',
      page: 1, required: true, deriveFrom: 'final_order.action_default' },
  ],
}

// ── Sección 9 — Notarización ─────────────────────────────────────────────────

const SECTION_9: FormSection = {
  id: 9,
  titleEs: '9. Notarización',
  descriptionEs: 'Datos del notary. Se completan al momento de firmar ante notario.',
  fields: [
    { semanticKey: 'notary_county', pdfFieldName: 'notary_county', type: 'text',
      labelEs: 'County donde se firma ante notario', page: 1,
      deriveFrom: 'jurisdiction.county' },
    { semanticKey: 'notary_day', pdfFieldName: 'notary_day', type: 'text',
      labelEs: 'Día de la firma (ej. "28th")', page: 1 },
    { semanticKey: 'notary_month_year', pdfFieldName: 'notary_month_year', type: 'text',
      labelEs: 'Mes y año (ej. "April 2026")', page: 1,
      deriveFrom: 'today.month_year' },
    { semanticKey: 'notary_printed_name', pdfFieldName: 'notary_printed_name', type: 'text',
      labelEs: 'Nombre impreso del Notary', page: 1 },
    { semanticKey: 'notary_commission_expires', pdfFieldName: 'notary_commission_expires', type: 'text',
      labelEs: 'Fecha de expiración de la comisión del Notary', page: 1 },
  ],
}

// ── Master export ────────────────────────────────────────────────────────────

export const FORM_SECTIONS: FormSection[] = [
  SECTION_1, SECTION_2, SECTION_3, SECTION_4, SECTION_5, SECTION_6, SECTION_7, SECTION_8, SECTION_9,
]

export const ALL_FIELDS: FieldSpec[] = FORM_SECTIONS.flatMap((s) => s.fields)
export const FIELD_BY_KEY: Record<string, FieldSpec> = Object.fromEntries(
  ALL_FIELDS.map((f) => [f.semanticKey, f])
)

export const HARDCODED_VALUES: Record<string, string | boolean> = ALL_FIELDS.reduce(
  (acc, f) => {
    if (f.hardcoded !== undefined) acc[f.semanticKey] = f.hardcoded
    return acc
  },
  {} as Record<string, string | boolean>
)

const valueSchema = z.union([z.string(), z.boolean()]).optional().nullable()
const dynamicShape: Record<string, z.ZodTypeAny> = {}
for (const f of ALL_FIELDS) dynamicShape[f.semanticKey] = valueSchema
export const affidavitSijFormSchema = z.object(dynamicShape)
export type AffidavitSijFormValues = z.infer<typeof affidavitSijFormSchema>

export const REQUIRED_FOR_PRINT: string[] = ALL_FIELDS
  .filter((f) => f.required)
  .map((f) => f.semanticKey)
