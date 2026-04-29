// Schema curado para "Florida Permanent Guardianship of a Minor" (Probate
// Court). Demuestra la escalabilidad por estado del registry: agregar este
// schema + entry al registry + estado del cliente='FL' → el form aparece
// automáticamente en su pantalla Fases sin tocar UI.
//
// El template binario (.docx) es un placeholder pendiente de la fuente
// oficial. Cuando se obtenga el PDF/DOCX oficial, actualizar PDF_SHA256
// y volver a tokenizar con scripts/tokenize-fl-guardianship.mjs.
//
// Referencia legal:
//  - Fla. Stat. § 744.3021 — Guardianship of minors (probate court)
//  - Fla. R. Prob. P. 5.560 — Petition for appointment of guardian of minor
//  - INA 101(a)(27)(J) + 8 CFR 204.11 — SIJS predicate findings
//  - NIWAP Florida SIJS Manual (2023):
//    https://niwaplibrary.wcl.american.edu/wp-content/uploads/2023.09.01-Florida-SIJS-Manual.pdf

import { z } from 'zod'

// ── Constantes verificables al runtime ──────────────────────────────────────

export const PDF_PUBLIC_PATH = '/forms/fl-permanent-guardianship-petition.docx'
export const PDF_DISK_PATH = 'public/forms/fl-permanent-guardianship-petition.docx'
// PLACEHOLDER — actualizar cuando se obtenga el template oficial tokenizado
export const PDF_SHA256 = 'placeholder-update-when-template-obtained'
export const SCHEMA_VERSION = '2026-04-fl-stub'
export const FORM_SLUG = 'fl-permanent-guardianship-petition'
export const FORM_NAME = 'FL Petition for Permanent Guardianship of a Minor'
export const FORM_DESCRIPTION_ES =
  'Petición de tutela permanente de menor (Florida Probate Court — Fla. Stat. §744.3021) con findings SIJS.'

// ── Tipos ───────────────────────────────────────────────────────────────────

export type FieldType = 'text' | 'textarea' | 'checkbox' | 'date' | 'phone' | 'state' | 'zip'

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
  options?: { value: string; labelEs: string }[]
  maxLength?: number
  editableByClient?: boolean
}

export interface FormSection {
  id: number
  titleEs: string
  descriptionEs: string
  fields: FieldSpec[]
}

// ── Sección 1 — Caption Probate Court ────────────────────────────────────────

const SECTION_1: FormSection = {
  id: 1,
  titleEs: '1. Caption del juicio (Probate Court)',
  descriptionEs: 'Encabezado del expediente probate. El clerk asigna case number al filing.',
  fields: [
    { semanticKey: 'case_number', pdfFieldName: 'case_number', type: 'text',
      labelEs: 'Case Number',
      helpEs: 'El clerk lo asigna al e-filing. Vacío al inicio.', page: 1, editableByClient: false },
    { semanticKey: 'county_name', pdfFieldName: 'county_name', type: 'text',
      labelEs: 'Condado de Florida', helpEs: 'Ej. Miami-Dade, Broward, Orange.', page: 1,
      required: true, deriveFrom: 'jurisdiction.county', editableByClient: false },
    { semanticKey: 'judicial_circuit', pdfFieldName: 'judicial_circuit', type: 'text',
      labelEs: 'Circuito Judicial', helpEs: 'Ej. 11th Judicial Circuit (Miami-Dade).',
      page: 1, editableByClient: false },
  ],
}

// ── Sección 2 — Peticionario (proposed guardian) ─────────────────────────────

const SECTION_2: FormSection = {
  id: 2,
  titleEs: '2. Peticionario (proposed guardian)',
  descriptionEs: 'La persona que solicita ser guardian permanente del menor.',
  fields: [
    { semanticKey: 'petitioner_full_name', pdfFieldName: 'petitioner_full_name', type: 'text',
      labelEs: 'Nombre completo del peticionario', page: 1, required: true,
      deriveFrom: 'petitioner.full_name' },
    { semanticKey: 'petitioner_relationship_to_minor', pdfFieldName: 'petitioner_relationship_to_minor', type: 'text',
      labelEs: 'Relación con el menor',
      helpEs: 'Ej. madre biológica, abuela, tía, hermana mayor, no familiar cuidador.',
      page: 1, required: true, deriveFrom: 'petitioner.relationship_en' },
    { semanticKey: 'petitioner_full_address', pdfFieldName: 'petitioner_full_address', type: 'textarea',
      labelEs: 'Dirección completa', page: 1, required: true,
      deriveFrom: 'petitioner.full_address' },
    { semanticKey: 'petitioner_phone', pdfFieldName: 'petitioner_phone', type: 'phone',
      labelEs: 'Teléfono', page: 1, required: true, deriveFrom: 'petitioner.phone' },
    { semanticKey: 'petitioner_email', pdfFieldName: 'petitioner_email', type: 'text',
      labelEs: 'Email', page: 1, deriveFrom: 'petitioner.email' },
  ],
}

// ── Sección 3 — Menor ────────────────────────────────────────────────────────

const SECTION_3: FormSection = {
  id: 3,
  titleEs: '3. Datos del menor',
  descriptionEs: 'Identificación del menor sujeto de la guardianship.',
  fields: [
    { semanticKey: 'minor_full_name', pdfFieldName: 'minor_full_name', type: 'text',
      labelEs: 'Nombre completo del menor', page: 1, required: true,
      deriveFrom: 'child.full_name' },
    { semanticKey: 'minor_dob', pdfFieldName: 'minor_dob', type: 'date',
      labelEs: 'Fecha de nacimiento del menor', helpEs: 'MM/DD/YYYY.',
      page: 1, required: true, deriveFrom: 'child.dob' },
    { semanticKey: 'minor_country_of_birth', pdfFieldName: 'minor_country_of_birth', type: 'text',
      labelEs: 'País de nacimiento del menor', page: 1, required: true,
      deriveFrom: 'child.country_of_birth' },
    { semanticKey: 'minor_current_address', pdfFieldName: 'minor_current_address', type: 'textarea',
      labelEs: 'Dirección actual del menor en Florida', page: 1, required: true,
      deriveFrom: 'child.current_address' },
  ],
}

// ── Sección 4 — Findings SIJS ────────────────────────────────────────────────

const SECTION_4: FormSection = {
  id: 4,
  titleEs: '4. Findings SIJS solicitados',
  descriptionEs: 'Hallazgos predicate del INA 101(a)(27)(J) que el menor pide a la corte declarar.',
  fields: [
    { semanticKey: 'finding_dependent_or_guardianship', pdfFieldName: 'finding_dependent_or_guardianship', type: 'checkbox',
      labelEs: 'El menor está bajo guardianship o dependencia de la corte estatal',
      page: 1, hardcoded: true, editableByClient: false },
    { semanticKey: 'finding_no_reunification_one_or_both_parents', pdfFieldName: 'finding_no_reunification_one_or_both_parents', type: 'checkbox',
      labelEs: 'No es viable la reunificación con uno o ambos padres por abuso, abandono o negligencia',
      page: 1, hardcoded: true, editableByClient: false },
    { semanticKey: 'finding_not_in_best_interest_to_return', pdfFieldName: 'finding_not_in_best_interest_to_return', type: 'checkbox',
      labelEs: 'No es de mejor interés del menor regresar a su país de origen',
      page: 1, hardcoded: true, editableByClient: false },
    { semanticKey: 'abuse_narrative_short', pdfFieldName: 'abuse_narrative_short', type: 'textarea',
      labelEs: 'Resumen breve de los hechos de abuso/abandono/negligencia',
      helpEs: 'La declaración jurada completa va por separado en Mi Historia.',
      page: 1, deriveFrom: 'child.abuse_narrative' },
  ],
}

// ── Re-exports ──────────────────────────────────────────────────────────────

export const FORM_SECTIONS: FormSection[] = [SECTION_1, SECTION_2, SECTION_3, SECTION_4]

export const HARDCODED_VALUES: Record<string, string | boolean> = {
  finding_dependent_or_guardianship: true,
  finding_no_reunification_one_or_both_parents: true,
  finding_not_in_best_interest_to_return: true,
}

export const REQUIRED_FOR_PRINT: string[] = [
  'county_name',
  'petitioner_full_name',
  'petitioner_relationship_to_minor',
  'minor_full_name',
  'minor_dob',
  'minor_country_of_birth',
]

export const FIELD_BY_KEY: Record<string, FieldSpec> = FORM_SECTIONS.flatMap((s) => s.fields).reduce(
  (acc, f) => {
    acc[f.semanticKey] = f
    return acc
  },
  {} as Record<string, FieldSpec>,
)

// Zod schema parcial para validación incremental (autosave)
export const flGuardianshipFormSchema = z.object({
  case_number: z.string().optional(),
  county_name: z.string().optional(),
  judicial_circuit: z.string().optional(),
  petitioner_full_name: z.string().optional(),
  petitioner_relationship_to_minor: z.string().optional(),
  petitioner_full_address: z.string().optional(),
  petitioner_phone: z.string().optional(),
  petitioner_email: z.string().optional(),
  minor_full_name: z.string().optional(),
  minor_dob: z.string().optional(),
  minor_country_of_birth: z.string().optional(),
  minor_current_address: z.string().optional(),
  finding_dependent_or_guardianship: z.boolean().optional(),
  finding_no_reunification_one_or_both_parents: z.boolean().optional(),
  finding_not_in_best_interest_to_return: z.boolean().optional(),
  abuse_narrative_short: z.string().optional(),
})

export type FlGuardianshipFormValues = z.infer<typeof flGuardianshipFormSchema>
