// Schema curado para FM-SAPCR-AFF-100 (Texas SAPCR Affidavit for Standing
// of Nonparent — Rev. 09-2025).
//
// Obligatorio desde 09-01-2025 bajo Texas Family Code §102.0031: TODO no-padre
// que radique un SAPCR debe acompañar la petición con esta declaración jurada
// (notariada) declarando que negar el remedio dañaría significativamente la
// salud física o desarrollo emocional del menor.
//
// PDF: 4 páginas, 31 campos AcroForm. La estructura es relativamente simple
// vs. FM-SAPCR-100 (262 campos): encabezado de cause/court/county, lista de
// niños, datos del affiant, 4 secciones de hechos (físico / emocional /
// incapacidad parental / otros), firma + notario.
//
// Re-correr `node scripts/inspect-sapcr-aff-100-fields.mjs` cada vez que
// TexasLawHelp publique nueva revisión y actualizar PDF_SHA256.

import { z } from 'zod'

// ──────────────────────────────────────────────────────────────────
// Constantes verificables al runtime
// ──────────────────────────────────────────────────────────────────

export const PDF_PUBLIC_PATH = '/forms/fm-sapcr-aff-100.pdf'
export const PDF_DISK_PATH = 'public/forms/fm-sapcr-aff-100.pdf'
export const PDF_SHA256 = '15def7191f35a18bfec93c6572a26b37c1251e95640af419d2e1f23d2f3ccef0'
export const SAPCR_AFF_VERSION = '2025-09'
export const FORM_SLUG = 'tx-fm-sapcr-aff-100'
export const FORM_NAME = 'TX FM-SAPCR-AFF-100 Affidavit'
export const FORM_DESCRIPTION_ES = 'Afidávit de standing del no-padre (Texas SAPCR — TFC §102.0031)'

// ──────────────────────────────────────────────────────────────────
// Tipos (idénticos a sapcr100-form-schema para reuso del modal genérico)
// ──────────────────────────────────────────────────────────────────

export type FieldType =
  | 'text'
  | 'textarea'
  | 'checkbox'
  | 'date'
  | 'phone'
  | 'state'
  | 'zip'

export interface FieldOption {
  value: string
  labelEs: string
}

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

export interface SapcrAffSection {
  id: 1 | 2 | 3 | 4 | 5 | 6 | 7
  titleEs: string
  descriptionEs: string
  fields: FieldSpec[]
}

// ──────────────────────────────────────────────────────────────────
// Secciones (7 grupos lógicos sobre los 31 campos del AcroForm)
// ──────────────────────────────────────────────────────────────────

const SECTION_1: SapcrAffSection = {
  id: 1,
  titleEs: '1. Caso y corte',
  descriptionEs: 'Identificación del caso, tipo y número de corte (lo asigna el clerk al filing) y condado.',
  fields: [
    { semanticKey: 'case_cause_number', pdfFieldName: 'Cause Number', type: 'text', labelEs: 'Cause Number', helpEs: 'Dejar vacío al filing — lo asigna el clerk.', page: 1 },
    { semanticKey: 'case_court_type_district', pdfFieldName: 'District Court', type: 'checkbox', labelEs: 'District Court', helpEs: 'Marcar si es District Court (típico en Harris County).', page: 1, hardcoded: true },
    { semanticKey: 'case_district_court_number', pdfFieldName: 'District Court Number', type: 'text', labelEs: 'Número de District Court', helpEs: 'Ej. 245th, 257th, 312th. Si lo asigna el clerk, dejar vacío.', page: 1, deriveFrom: 'jurisdiction.court_number' },
    { semanticKey: 'case_court_type_county_at_law', pdfFieldName: 'County Court at Law', type: 'checkbox', labelEs: 'County Court at Law', page: 1 },
    { semanticKey: 'case_county_court_at_law_number', pdfFieldName: 'County Court at Law Number', type: 'text', labelEs: 'Número de County Court at Law', page: 1 },
    { semanticKey: 'case_county', pdfFieldName: 'County', type: 'text', labelEs: 'County, Texas', helpEs: 'Condado donde se radica (ej. Harris).', page: 1, required: true, deriveFrom: 'jurisdiction.county' },
  ],
}

const SECTION_2: SapcrAffSection = {
  id: 2,
  titleEs: '2. Menor(es) involucrados',
  descriptionEs: 'Nombres de los menores en el caso (hasta 5). Si solo hay 1, dejar 2-5 vacíos.',
  fields: [
    { semanticKey: 'child_1_full_name', pdfFieldName: "Child's Name 1", type: 'text', labelEs: 'Nombre completo del menor 1', page: 1, required: true, deriveFrom: 'child_1.full_name' },
    { semanticKey: 'child_2_full_name', pdfFieldName: "Child's Name 2", type: 'text', labelEs: 'Nombre completo del menor 2', page: 1 },
    { semanticKey: 'child_3_full_name', pdfFieldName: "Child's Name 3", type: 'text', labelEs: 'Nombre completo del menor 3', page: 1 },
    { semanticKey: 'child_4_full_name', pdfFieldName: "Child's Name 4", type: 'text', labelEs: 'Nombre completo del menor 4', page: 1 },
    { semanticKey: 'child_5_full_name', pdfFieldName: "Child's Name 5", type: 'text', labelEs: 'Nombre completo del menor 5', page: 1 },
  ],
}

const SECTION_3: SapcrAffSection = {
  id: 3,
  titleEs: '3. Affiant (peticionario/a)',
  descriptionEs: 'Datos del affiant — la persona que firma el afidávit bajo juramento. Por TFC §102.0031, debe tener al menos 18 años, estar de mente sana y declarar los hechos basados en conocimiento personal.',
  fields: [
    { semanticKey: 'affiant_full_name', pdfFieldName: 'Your Full Name', type: 'text', labelEs: 'Mi nombre completo (Affiant)', page: 1, required: true, deriveFrom: 'petitioner.full_name' },
  ],
}

const SECTION_4: SapcrAffSection = {
  id: 4,
  titleEs: '4. Daño a la salud física',
  descriptionEs: 'Hechos sobre lesiones físicas o negligencia que los padres causaron al menor. Si no aplica al caso, marcar "No aplica" y dejar los textareas vacíos.',
  fields: [
    { semanticKey: 'harm_physical_not_applicable', pdfFieldName: 'Not applicable', type: 'checkbox', labelEs: 'No aplica (sin daño físico documentable)', page: 2, deriveFrom: 'sijs_aff_defaults.physical_not_applicable' },
    { semanticKey: 'harm_physical_check', pdfFieldName: 'The parents physically hurt or neglected the child on the following occasions', type: 'checkbox', labelEs: 'Los padres hirieron físicamente o descuidaron al menor en las siguientes ocasiones', page: 2 },
    { semanticKey: 'harm_physical_facts', pdfFieldName: 'Harm to Physical Health Facts', type: 'textarea', labelEs: 'Hechos de daño físico', helpEs: 'Describir incidentes específicos: fechas, lugares, lesiones, falta de comida/medicina, abandono físico.', page: 2 },
    { semanticKey: 'harm_physical_facts_continued', pdfFieldName: 'Harm to Physical Health Facts Continued', type: 'textarea', labelEs: 'Hechos de daño físico (continuación)', page: 2 },
  ],
}

const SECTION_5: SapcrAffSection = {
  id: 5,
  titleEs: '5. Daño al desarrollo emocional',
  descriptionEs: 'Hechos sobre daño emocional o psicológico causado por los padres. Por jurisprudencia de Texas, alegaciones genéricas de "love and bonding" sin hechos concretos NO satisfacen el standing.',
  fields: [
    { semanticKey: 'harm_emotional_not_applicable', pdfFieldName: 'Not applicable_2', type: 'checkbox', labelEs: 'No aplica (sin daño emocional documentable)', page: 2, deriveFrom: 'sijs_aff_defaults.emotional_not_applicable' },
    { semanticKey: 'harm_emotional_check', pdfFieldName: 'The parents emotionally harmed the child through the following acts or behavior', type: 'checkbox', labelEs: 'Los padres dañaron emocionalmente al menor con los siguientes actos o conducta', page: 2 },
    { semanticKey: 'harm_emotional_facts', pdfFieldName: 'Harm to Emotional Development Facts', type: 'textarea', labelEs: 'Hechos de daño emocional', helpEs: 'Describir abandono emocional, indiferencia, ausencia, rechazo, conducta verbal abusiva, etc., con fechas y contexto.', page: 2 },
    { semanticKey: 'harm_emotional_facts_continued', pdfFieldName: 'Harm to Emotional Development Facts Continued', type: 'textarea', labelEs: 'Hechos de daño emocional (continuación)', page: 3 },
  ],
}

const SECTION_6: SapcrAffSection = {
  id: 6,
  titleEs: '6. Incapacidad de los padres para proveer cuidado',
  descriptionEs: 'Hechos sobre la incapacidad de los padres (por enfermedad, encarcelamiento, ausencia geográfica, falta de recursos) que causa daño al menor.',
  fields: [
    { semanticKey: 'harm_incapacity_not_applicable', pdfFieldName: 'Not applicable_3', type: 'checkbox', labelEs: 'No aplica (sin incapacidad documentable)', page: 3, deriveFrom: 'sijs_aff_defaults.incapacity_not_applicable' },
    { semanticKey: 'harm_incapacity_check', pdfFieldName: 'The parents are unable to provide care thus causing physical or emotional', type: 'checkbox', labelEs: 'Los padres no pueden proveer cuidado, causando daño físico o emocional', page: 3 },
    { semanticKey: 'harm_incapacity_facts', pdfFieldName: 'Harm Due to Parental Incapacity', type: 'textarea', labelEs: 'Hechos de incapacidad parental', helpEs: 'Describir por qué los padres no pueden cuidar (enfermedad, encarcelamiento, residencia en otro país, falta de recursos económicos verificable, etc.).', page: 3 },
  ],
}

const SECTION_7: SapcrAffSection = {
  id: 7,
  titleEs: '7. Otros hechos, firma y notario',
  descriptionEs: 'Hechos adicionales relevantes, firma del affiant y bloque del notario. El afidávit DEBE notarizarse antes de presentarse al juzgado.',
  fields: [
    // Otros hechos
    { semanticKey: 'other_facts_not_applicable', pdfFieldName: 'Not applicable_4', type: 'checkbox', labelEs: 'No aplica (sin otros hechos)', page: 3 },
    { semanticKey: 'other_facts_check', pdfFieldName: 'The following facts are also important', type: 'checkbox', labelEs: 'Los siguientes hechos también son importantes', page: 3, hardcoded: true, deriveFrom: 'sijs_aff_defaults.other_facts_check' },
    { semanticKey: 'other_facts', pdfFieldName: 'Other Facts', type: 'textarea', labelEs: 'Otros hechos relevantes', helpEs: 'Aquí se prefilla la narrativa "why_cannot_reunify" del intake del tutor. El admin puede editarla y/o moverla a la sección que corresponda.', page: 3, deriveFrom: 'sijs_aff_defaults.narrative_prefill' },

    // Firma del affiant
    { semanticKey: 'affiant_signature', pdfFieldName: 'Your Signature', type: 'textarea', labelEs: 'Firma del affiant — escribir nombre completo (placeholder)', helpEs: 'El affiant firmará a mano sobre la copia impresa antes del notario.', page: 4, deriveFrom: 'petitioner.full_name' },
    { semanticKey: 'affiant_print_name', pdfFieldName: 'Print Your Name', type: 'text', labelEs: 'Nombre del affiant (impreso)', page: 4, required: true, deriveFrom: 'petitioner.full_name' },

    // Bloque notario
    { semanticKey: 'notary_state', pdfFieldName: 'Notary State', type: 'text', labelEs: 'Notary State', page: 4, hardcoded: 'Texas' },
    { semanticKey: 'notary_county', pdfFieldName: 'Notary County', type: 'text', labelEs: 'Notary County', helpEs: 'Condado donde se notariza (típicamente el mismo del filing).', page: 4, deriveFrom: 'jurisdiction.county' },
    { semanticKey: 'affidavit_swore_date', pdfFieldName: 'Date Affiant Swore', type: 'date', labelEs: 'Fecha en que el affiant juró (Date Affiant Swore)', helpEs: 'Formato MM/DD/YYYY. Lo escribe el notario al sellar.', page: 4 },
  ],
}

export const SAPCR_AFF_SECTIONS: SapcrAffSection[] = [SECTION_1, SECTION_2, SECTION_3, SECTION_4, SECTION_5, SECTION_6, SECTION_7]

// ──────────────────────────────────────────────────────────────────
// Maps derivados
// ──────────────────────────────────────────────────────────────────

export const ALL_FIELDS: FieldSpec[] = SAPCR_AFF_SECTIONS.flatMap((s) => s.fields)
export const FIELD_BY_KEY: Record<string, FieldSpec> = Object.fromEntries(
  ALL_FIELDS.filter((f) => f.pdfFieldName).map((f) => [f.semanticKey, f])
)

export const HARDCODED_VALUES: Record<string, string | boolean> = ALL_FIELDS.reduce(
  (acc, f) => {
    if (f.hardcoded !== undefined) acc[f.semanticKey] = f.hardcoded
    return acc
  },
  {} as Record<string, string | boolean>
)

// ──────────────────────────────────────────────────────────────────
// Zod schema (todos opcionales — la validación de "obligatorio para
// imprimir" se hace por separado con `requiredForPrint`).
// ──────────────────────────────────────────────────────────────────

const valueSchema = z.union([z.string(), z.boolean()]).optional().nullable()
const dynamicShape: Record<string, z.ZodTypeAny> = {}
for (const f of ALL_FIELDS) {
  dynamicShape[f.semanticKey] = valueSchema
}

export const sapcrAffFormSchema = z.object(dynamicShape)
export type SapcrAffFormValues = z.infer<typeof sapcrAffFormSchema>

/** Lista de campos que deben tener valor (no vacío) antes de imprimir el PDF. */
export const REQUIRED_FOR_PRINT: string[] = ALL_FIELDS.filter((f) => f.required).map((f) => f.semanticKey)

/** Valida que los campos obligatorios para imprimir tengan valor no vacío. */
export function validateRequiredForPrint(values: SapcrAffFormValues): { ok: boolean; missing: string[] } {
  const missing: string[] = []
  for (const key of REQUIRED_FOR_PRINT) {
    const v = (values as Record<string, unknown>)[key]
    if (v === undefined || v === null || v === '' || v === false) {
      missing.push(key)
    }
  }
  return { ok: missing.length === 0, missing }
}
