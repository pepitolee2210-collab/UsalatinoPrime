// Schema curado para "Order Regarding SIJ Findings" (DFPS Section 13, 2019).
//
// Es la PROPUESTA DE ORDEN que el juez familiar firma con los predicate findings
// requeridos por INA 101(a)(27)(J) tras la audiencia de la Motion + Affidavit.
//
// Adaptable Pro Se vs DFPS:
//  - Pro Se: conservator_name = "Petitioner [name]" / conservator_short = "Petitioner"
//  - DFPS:   conservator_name = "The Texas Department of Family & Protective Services (DFPS)"
//            conservator_short = "DFPS"

import { z } from 'zod'

export const PDF_PUBLIC_PATH = '/forms/order-sij-findings.docx'
export const PDF_DISK_PATH = 'public/forms/order-sij-findings.docx'
export const PDF_SHA256 = '63c8df1f165cc06d886029c591d321df876664c688e0783180afbdc0c0a34ff5'
export const SCHEMA_VERSION = '2019-dfps-section-13'
export const FORM_SLUG = 'tx-dfps-order-sij-findings'
export const FORM_NAME = 'TX DFPS Order Regarding SIJ Findings'
export const FORM_DESCRIPTION_ES = 'Propuesta de orden con los predicate findings de SIJS (DFPS Section 13). Sin esta orden firmada por el juez NO se puede presentar el I-360 ante USCIS.'

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

const SECTION_1: FormSection = {
  id: 1,
  titleEs: '1. Caption del juicio',
  descriptionEs: 'Encabezado obligatorio (cause number lo asigna el clerk).',
  fields: [
    { semanticKey: 'cause_number', pdfFieldName: 'cause_number', type: 'text',
      labelEs: 'Cause Number', helpEs: 'Vacío al filing inicial.', page: 1 },
    { semanticKey: 'child_caption_name', pdfFieldName: 'child_caption_name', type: 'text',
      labelEs: 'Iniciales del menor (caption — ej. B.Y.R.V.)',
      page: 1, required: true, deriveFrom: 'child.caption_name' },
    { semanticKey: 'county_name', pdfFieldName: 'county_name', type: 'text',
      labelEs: 'Condado', page: 1, required: true, deriveFrom: 'jurisdiction.county' },
    { semanticKey: 'judicial_district', pdfFieldName: 'judicial_district', type: 'text',
      labelEs: 'Distrito Judicial (número)', page: 1 },
  ],
}

const SECTION_2: FormSection = {
  id: 2,
  titleEs: '2. Conservator (managing conservator)',
  descriptionEs: 'Pro Se: la peticionaria. DFPS: el Department.',
  fields: [
    { semanticKey: 'conservator_name', pdfFieldName: 'conservator_name', type: 'text',
      labelEs: 'Nombre completo del conservator (oficial)',
      helpEs: 'Pro Se: "Petitioner [Name]". DFPS: "The Texas Department of Family & Protective Services (DFPS)".',
      page: 1, required: true, deriveFrom: 'conservator.name_full' },
    { semanticKey: 'conservator_short', pdfFieldName: 'conservator_short', type: 'text',
      labelEs: 'Forma corta del conservator (recurrente)',
      helpEs: 'Pro Se: "Petitioner". DFPS: "DFPS".',
      page: 1, required: true, deriveFrom: 'conservator.short' },
    { semanticKey: 'prior_order_date_full', pdfFieldName: 'prior_order_date_full', type: 'text',
      labelEs: 'Fecha de la orden previa de Conservatorship',
      helpEs: 'Formato libre. Ej. "April 28, 2026" o "the date of this hearing".',
      page: 1, required: true, deriveFrom: 'prior_order.date_full' },
  ],
}

const SECTION_3: FormSection = {
  id: 3,
  titleEs: '3. Datos del menor',
  descriptionEs: 'Identificación completa del menor sujeto del SIJS.',
  fields: [
    { semanticKey: 'child_full_name', pdfFieldName: 'child_full_name', type: 'text',
      labelEs: 'Nombre completo del menor', page: 1, required: true,
      deriveFrom: 'child.full_name' },
    { semanticKey: 'child_sex', pdfFieldName: 'child_sex', type: 'text',
      labelEs: 'Sexo (male/female)', page: 1, required: true, deriveFrom: 'child.sex' },
    { semanticKey: 'child_birth_place', pdfFieldName: 'child_birth_place', type: 'text',
      labelEs: 'Lugar de nacimiento', page: 1, required: true, deriveFrom: 'child.birth_place' },
    { semanticKey: 'child_birth_date', pdfFieldName: 'child_birth_date', type: 'date',
      labelEs: 'Fecha de nacimiento (MM/DD/YYYY)', page: 1, required: true,
      deriveFrom: 'child.birth_date' },
  ],
}

const SECTION_4: FormSection = {
  id: 4,
  titleEs: '4. Reunificación NO viable con la madre',
  descriptionEs: 'Sólo si la madre del menor es respondent (no peticionaria).',
  fields: [
    { semanticKey: 'mother_name', pdfFieldName: 'mother_name', type: 'text',
      labelEs: 'Nombre de la madre (respondent)', page: 1,
      deriveFrom: 'mother.respondent_name' },
    { semanticKey: 'mother_grounds', pdfFieldName: 'mother_grounds', type: 'text',
      labelEs: 'Motivos legales (abuse / neglect / abandonment)',
      page: 1 },
    { semanticKey: 'mother_facts', pdfFieldName: 'mother_facts', type: 'textarea',
      labelEs: 'Hechos que sustentan los motivos (narrativa)',
      page: 1 },
  ],
}

const SECTION_5: FormSection = {
  id: 5,
  titleEs: '5. Reunificación NO viable con el padre',
  descriptionEs: 'Para SIJS por madre Pro Se contra padre ausente, ESTE es el bloque crítico.',
  fields: [
    { semanticKey: 'father_name', pdfFieldName: 'father_name', type: 'text',
      labelEs: 'Nombre del padre (respondent)', page: 1, required: true,
      deriveFrom: 'father.name' },
    { semanticKey: 'father_grounds', pdfFieldName: 'father_grounds', type: 'text',
      labelEs: 'Motivos legales (abuse / neglect / abandonment)',
      page: 1, required: true, deriveFrom: 'father.grounds_default' },
    { semanticKey: 'father_facts', pdfFieldName: 'father_facts', type: 'textarea',
      labelEs: 'Hechos que sustentan los motivos (narrativa)',
      helpEs: 'CRÍTICO. Sé específico: fechas, ausencias, falta de contacto/soporte, paradero desconocido.',
      page: 1, required: true, deriveFrom: 'father.facts_default' },
  ],
}

const SECTION_6: FormSection = {
  id: 6,
  titleEs: '6. Final Order de Conservatorship',
  descriptionEs: 'Fecha y descripción de la orden final.',
  fields: [
    { semanticKey: 'final_order_date', pdfFieldName: 'final_order_date', type: 'text',
      labelEs: 'Fecha de la final order',
      helpEs: 'Ej. "April 28, 2026" o "the date of this hearing".',
      page: 1, required: true },
    { semanticKey: 'final_order_action', pdfFieldName: 'final_order_action', type: 'textarea',
      labelEs: 'Descripción de la acción de la orden',
      helpEs: 'Pro Se default: "granting Petitioner Permanent Managing Conservatorship". DFPS: "granting DFPS Permanent Managing Conservatorship".',
      page: 1, required: true, deriveFrom: 'final_order.action_default' },
  ],
}

const SECTION_7: FormSection = {
  id: 7,
  titleEs: '7. NO en mejor interés regresar al país',
  descriptionEs: 'Predicate finding crítico de INA 101(a)(27)(J).',
  fields: [
    { semanticKey: 'child_country', pdfFieldName: 'child_country', type: 'text',
      labelEs: 'País de nacionalidad / última residencia habitual',
      page: 1, required: true, deriveFrom: 'child.country' },
    { semanticKey: 'best_interest_facts', pdfFieldName: 'best_interest_facts', type: 'textarea',
      labelEs: 'Factores de mejor interés (narrativa)',
      helpEs: 'Lista cada factor: parientes/cuidadores en país de origen, ties en EE.UU., necesidades médicas/educativas/psicológicas que no se cubren en el país.',
      page: 1, required: true, deriveFrom: 'best_interest.facts_default' },
  ],
}

export const FORM_SECTIONS: FormSection[] = [
  SECTION_1, SECTION_2, SECTION_3, SECTION_4, SECTION_5, SECTION_6, SECTION_7,
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
export const orderSijFormSchema = z.object(dynamicShape)
export type OrderSijFormValues = z.infer<typeof orderSijFormSchema>

export const REQUIRED_FOR_PRINT: string[] = ALL_FIELDS
  .filter((f) => f.required)
  .map((f) => f.semanticKey)
