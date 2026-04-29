// Schema curado para FM-SAPCR-205 (Texas Order in Suit Affecting Parent-Child
// Relationship — Nonparent Custody Order, Rev. 05-2024).
//
// Es la ORDEN FINAL del SAPCR que el juez firma en la audiencia nombrando
// conservator al peticionario no-padre. Diferente del Order Regarding SIJS
// Findings: este es el orden de custodia estatal, aquel es el orden con
// findings federales. Ambos suelen firmarse en la misma audiencia.
//
// El PDF tiene 281 fields en 23 páginas. Sólo mapeamos los críticos para
// SIJS (~30 fields). El admin puede rellenar los demás manualmente con
// "Descargar oficial" si necesita.

import { z } from 'zod'

export const PDF_PUBLIC_PATH = '/forms/fm-sapcr-205.pdf'
export const PDF_DISK_PATH = 'public/forms/fm-sapcr-205.pdf'
export const PDF_SHA256 = '002fa0c7ffeb176cfcac510015abd5649e8d61267596a8199ef5d6010be4b1fc'
export const SCHEMA_VERSION = '2024-05-rev'
export const FORM_SLUG = 'tx-fm-sapcr-205'
export const FORM_NAME = 'TX FM-SAPCR-205 Nonparent Custody Order'
export const FORM_DESCRIPTION_ES = 'Orden FINAL del SAPCR que el juez firma nombrando conservador al peticionario no-padre. Mapeo enfocado a casos SIJS — el admin puede rellenar campos adicionales manualmente con "Descargar oficial".'

export type FieldType = 'text' | 'textarea' | 'checkbox' | 'date' | 'phone' | 'state' | 'zip' | 'select'

export interface FieldOption { value: string; labelEs: string }
export interface FieldSpec {
  semanticKey: string
  pdfFieldName: string | null
  type: FieldType
  labelEs: string
  helpEs?: string
  page?: number
  required?: boolean
  hardcoded?: string | boolean
  deriveFrom?: string
  groupKey?: string
  options?: FieldOption[]
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
  descriptionEs: 'Encabezado obligatorio del Order. El cause number lo asigna el clerk al filing.',
  fields: [
    { semanticKey: 'cause_number', pdfFieldName: 'Cause Number', type: 'text',
      labelEs: 'Cause Number', helpEs: 'Vacío al filing inicial.', page: 1 },
    { semanticKey: 'court_district_number', pdfFieldName: 'District Court', type: 'text',
      labelEs: 'Número del District Court', helpEs: 'Ej. 245th. Lo asigna el clerk.', page: 1 },
    { semanticKey: 'court_type_district', pdfFieldName: 'County Court at Law No', type: 'checkbox',
      labelEs: 'Marcar si es County Court at Law (no marcar para District Court)', page: 1 },
    { semanticKey: 'county_name', pdfFieldName: 'County', type: 'text',
      labelEs: 'Condado', page: 1, required: true, deriveFrom: 'jurisdiction.county' },
    { semanticKey: 'hearing_date', pdfFieldName: 'A hearing took place on date', type: 'text',
      labelEs: 'Fecha de la audiencia (Month, Day, Year)',
      helpEs: 'Ej. April 28, 2026.', page: 1, required: true, deriveFrom: 'final_order.date' },
  ],
}

// ── Sección 2 — Identificación de partes ─────────────────────────────────────

const SECTION_2: FormSection = {
  id: 2,
  titleEs: '2. Partes',
  descriptionEs: 'Nombres del Peticionario y Respondents.',
  fields: [
    { semanticKey: 'petitioner_full_name', pdfFieldName: 'Petitioners full name is', type: 'text',
      labelEs: 'Nombre completo del Peticionario', page: 1, required: true,
      deriveFrom: 'petitioner.full_name' },
    { semanticKey: 'respondent_a_full_name', pdfFieldName: 'Respondent As full name is', type: 'text',
      labelEs: 'Nombre completo de Respondent A', page: 1, required: true,
      deriveFrom: 'respondent_a.full_name' },
    { semanticKey: 'respondent_b_full_name', pdfFieldName: 'Respondent Bs full name is', type: 'text',
      labelEs: 'Respondent B full name (vacío si no aplica)', page: 1 },
    { semanticKey: 'respondent_c_full_name', pdfFieldName: 'Respondent Cs full name is', type: 'text',
      labelEs: 'Respondent C full name (vacío si no aplica)', page: 1 },
    { semanticKey: 'respondent_d_full_name', pdfFieldName: 'Respondent Ds full name is', type: 'text',
      labelEs: 'Respondent D full name (vacío si no aplica)', page: 1 },
  ],
}

// ── Sección 3 — Datos del menor ──────────────────────────────────────────────

const SECTION_3: FormSection = {
  id: 3,
  titleEs: '3. Datos del menor',
  descriptionEs: 'Información del menor sujeto del caso.',
  fields: [
    { semanticKey: 'child_1_name', pdfFieldName: '1_2', type: 'text',
      labelEs: 'Nombre del menor 1 (iniciales por privacidad — ej. B.Y.R.V.)',
      page: 1, required: true, deriveFrom: 'child.caption_name' },
    { semanticKey: 'child_1_sex', pdfFieldName: 'Sex 1', type: 'text',
      labelEs: 'Sexo del menor 1 (M/F)', page: 1, required: true, deriveFrom: 'child.sex' },
    { semanticKey: 'child_1_dob', pdfFieldName: 'Date of Birth 1', type: 'date',
      labelEs: 'Fecha de nacimiento del menor 1', page: 1, required: true,
      deriveFrom: 'child.dob' },
    { semanticKey: 'child_1_home_state', pdfFieldName: 'Home State 1', type: 'state',
      labelEs: 'Home State del menor 1', helpEs: 'Default Texas.',
      page: 1, hardcoded: 'TX', deriveFrom: 'jurisdiction.state_code' },
    { semanticKey: 'child_1_ssn', pdfFieldName: 'Social Security No 1', type: 'text',
      labelEs: 'SSN del menor 1 (si tiene)', helpEs: 'Vacío si el menor no tiene SSN.', page: 1 },
  ],
}

// ── Sección 4 — Hearing & Presence ───────────────────────────────────────────

const SECTION_4: FormSection = {
  id: 4,
  titleEs: '4. Audiencia y comparecencia',
  descriptionEs: 'Quiénes estuvieron presentes en la audiencia. Defaults: peticionaria presente y de acuerdo, Respondent A defaulted (servido por publicación / no apareció).',
  fields: [
    { semanticKey: 'petitioner_present_agreed', pdfFieldName: 'Petitioner was present selfrepresented and agreed to the terms of this Order', type: 'checkbox',
      labelEs: 'Peticionario presente, self-represented y de acuerdo con la orden', page: 1,
      hardcoded: true },
    { semanticKey: 'respondent_a_defaulted', pdfFieldName: 'Respondent A was not present but was served and has defaulted', type: 'checkbox',
      labelEs: 'Respondent A defaulted (servido pero no apareció)',
      helpEs: 'Default para SIJS donde el padre fue servido por publicación.',
      page: 1, hardcoded: true },
    { semanticKey: 'no_respondent_b', pdfFieldName: 'Check this box if there is no Respondent B and skip to section 2', type: 'checkbox',
      labelEs: 'No hay Respondent B', page: 1, hardcoded: true },
    { semanticKey: 'no_respondent_c', pdfFieldName: 'Check this box if there is no Respondent C and skip to section 2', type: 'checkbox',
      labelEs: 'No hay Respondent C', page: 1, hardcoded: true },
    { semanticKey: 'no_respondent_d', pdfFieldName: 'Check this box if there is no Respondent D and skip to section 2', type: 'checkbox',
      labelEs: 'No hay Respondent D', page: 1, hardcoded: true },
    { semanticKey: 'court_reporter_no_record', pdfFieldName: 'A court reporter did not record todays hearing because the parties agreed not to make a record', type: 'checkbox',
      labelEs: 'No hubo court reporter (las partes acordaron no grabar)',
      helpEs: 'Típico para audiencias uncontested.', page: 1 },
  ],
}

// ── Sección 5 — Conservatorship ──────────────────────────────────────────────

const SECTION_5: FormSection = {
  id: 5,
  titleEs: '5. Conservatorship',
  descriptionEs: 'Quién es nombrado managing conservator. Default SIJS: peticionario como Sole Managing Conservator.',
  fields: [
    { semanticKey: 'sole_mc_nonparent_name', pdfFieldName: 'Print Full Name of Nonparent Appointed Sole Managing Conservator', type: 'text',
      labelEs: 'Nombre del Nonparent Sole Managing Conservator',
      helpEs: 'Para SIJS típico (madre o cuidador no-padre como SMC) — escribe aquí el nombre del peticionario.',
      page: 1, deriveFrom: 'petitioner.full_name' },
    { semanticKey: 'mother_full_name', pdfFieldName: 'Print Mothers Full Name', type: 'text',
      labelEs: 'Nombre completo de la madre del menor', page: 1, required: true,
      deriveFrom: 'mother.full_name' },
    { semanticKey: 'father_full_name', pdfFieldName: 'Print Fathers Full Name', type: 'text',
      labelEs: 'Nombre completo del padre del menor', page: 1, required: true,
      deriveFrom: 'father.full_name' },
  ],
}

// ── Master export ────────────────────────────────────────────────────────────

export const FORM_SECTIONS: FormSection[] = [SECTION_1, SECTION_2, SECTION_3, SECTION_4, SECTION_5]

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
export const fmSapcr205FormSchema = z.object(dynamicShape)
export type FmSapcr205FormValues = z.infer<typeof fmSapcr205FormSchema>

export const REQUIRED_FOR_PRINT: string[] = ALL_FIELDS
  .filter((f) => f.required)
  .map((f) => f.semanticKey)
