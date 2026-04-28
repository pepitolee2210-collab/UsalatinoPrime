// Schema curado para "Motion for Findings Regarding SIJ Status" (DFPS Section 13).
//
// El template oficial es un .docx narrativo (no un AcroForm). Los placeholders
// originales del template ([NAME], [DATE], [COUNTRY], _____, etc.) fueron
// pre-tokenizados con scripts/tokenize-motion-sij-findings.mjs a la convención
// {{semanticKey}}, y el runtime fillDocxTemplate sustituye cada token por el
// valor del cliente.
//
// Convención: en este schema, `pdfFieldName` (heredado del registry) se
// reinterpreta como el NOMBRE DEL TOKEN dentro del .docx (ej. "child_full_name"
// matchea {{child_full_name}}). Si se deja null, el semanticKey ES el token.
//
// Re-correr scripts/tokenize-motion-sij-findings.mjs si DFPS publica una nueva
// versión del template y actualizar PDF_SHA256.

import { z } from 'zod'

// ── Constantes verificables al runtime ───────────────────────────────────────

export const PDF_PUBLIC_PATH = '/forms/motion-sij-findings.docx'
export const PDF_DISK_PATH = 'public/forms/motion-sij-findings.docx'
// SHA del .docx tokenizado (post-tokenize-motion-sij-findings.mjs).
export const PDF_SHA256 = '1b9928ef4ff7782af9a7f453f409971147de518773855516212b324910af928c'
export const SCHEMA_VERSION = '2016-04-dfps-section-13'
export const FORM_SLUG = 'tx-dfps-sij-findings-motion'
export const FORM_NAME = 'TX DFPS Motion for Findings Regarding SIJ Status'
export const FORM_DESCRIPTION_ES = 'Moción de findings de SIJS (DFPS Section 13) — solicita al juez familiar emitir los predicate findings de INA 101(a)(27)(J)'

// ── Tipos ────────────────────────────────────────────────────────────────────

export type FieldType = 'text' | 'textarea' | 'date'

export interface FieldSpec {
  semanticKey: string
  /** En docx-template, este campo es el nombre del token {{X}}. */
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

// ── Sección 1 — Caption del juicio ───────────────────────────────────────────

const SECTION_1: FormSection = {
  id: 1,
  titleEs: '1. Caption del juicio',
  descriptionEs: 'Encabezado obligatorio: cause number, condado, distrito judicial. La mayoría se asignan al e-filing — déjalos vacíos si aún no tienes la asignación.',
  fields: [
    { semanticKey: 'cause_number', pdfFieldName: 'cause_number', type: 'text',
      labelEs: 'Cause Number', helpEs: 'El clerk asigna al e-filing. Vacío al filing inicial.', page: 1 },
    { semanticKey: 'child_caption_name', pdfFieldName: 'child_caption_name', type: 'text',
      labelEs: 'Nombre del menor (caption)', page: 1, required: true,
      deriveFrom: 'child.caption_name' },
    { semanticKey: 'county_name', pdfFieldName: 'county_name', type: 'text',
      labelEs: 'Condado', helpEs: 'Ej. Harris.', page: 1, required: true,
      deriveFrom: 'jurisdiction.county' },
    { semanticKey: 'judicial_district', pdfFieldName: 'judicial_district', type: 'text',
      labelEs: 'Distrito Judicial (número)', helpEs: 'Ej. 245th. El clerk lo asigna aleatoriamente al filing.', page: 1 },
  ],
}

// ── Sección 2 — Identificación del peticionario y orden previa ───────────────

const SECTION_2: FormSection = {
  id: 2,
  titleEs: '2. Peticionario + Orden previa de Conservatorship',
  descriptionEs: 'Quién presenta la moción y la orden previa que nombró al peticionario como managing conservator del menor (requisito SIJS).',
  fields: [
    { semanticKey: 'petitioner_org_name', pdfFieldName: 'petitioner_org_name', type: 'text',
      labelEs: 'Nombre del peticionario / agencia',
      helpEs: 'Default DFPS para foster care. Para casos de no-padre Pro Se: el nombre del peticionario (ej. "Petitioner Jennifer Velasquez Mejia").',
      page: 1, required: true, deriveFrom: 'petitioner.org_name' },
    { semanticKey: 'prior_order_date', pdfFieldName: 'prior_order_date', type: 'text',
      labelEs: 'Fecha de la orden previa de Conservatorship',
      helpEs: 'Formato MM/DD. El año va aparte. Si aún no hay final order firmada, usa la fecha estimada de la audiencia de findings.',
      page: 1, required: true, deriveFrom: 'prior_order.date' },
    { semanticKey: 'prior_order_year', pdfFieldName: 'prior_order_year', type: 'text',
      labelEs: 'Año (4 dígitos) de la orden previa',
      helpEs: 'Ej. 2026.', page: 1, required: true, deriveFrom: 'prior_order.year' },
  ],
}

// ── Sección 3 — Datos del menor ──────────────────────────────────────────────

const SECTION_3: FormSection = {
  id: 3,
  titleEs: '3. Datos del menor',
  descriptionEs: 'Identificación completa del menor sujeto de la moción.',
  fields: [
    { semanticKey: 'child_full_name', pdfFieldName: 'child_full_name', type: 'text',
      labelEs: 'Nombre completo del menor', page: 1, required: true,
      deriveFrom: 'child.full_name' },
    { semanticKey: 'child_sex', pdfFieldName: 'child_sex', type: 'text',
      labelEs: 'Sexo', helpEs: 'M o F.', page: 1, deriveFrom: 'child.sex' },
    { semanticKey: 'child_birth_place', pdfFieldName: 'child_birth_place', type: 'text',
      labelEs: 'Lugar de nacimiento (país, estado, ciudad)', page: 1,
      deriveFrom: 'child.birth_place' },
    { semanticKey: 'child_birth_date', pdfFieldName: 'child_birth_date', type: 'date',
      labelEs: 'Fecha de nacimiento (MM/DD/YYYY)', page: 1, required: true,
      deriveFrom: 'child.birth_date' },
  ],
}

// ── Sección 4 — Reunificación con la madre ────────────────────────────────────

const SECTION_4: FormSection = {
  id: 4,
  titleEs: '4. Reunificación NO viable con la madre',
  descriptionEs: 'Sólo si aplica. Llena este bloque si el predicate finding incluye a la madre. Para el caso típico de Jennifer (madre Pro Se buscando custodia del padre ausente), normalmente NO aplica este bloque.',
  fields: [
    { semanticKey: 'mother_name', pdfFieldName: 'mother_name', type: 'text',
      labelEs: 'Nombre de la madre', page: 1, deriveFrom: 'mother.name' },
  ],
}

// ── Sección 5 — Reunificación con el padre ────────────────────────────────────

const SECTION_5: FormSection = {
  id: 5,
  titleEs: '5. Reunificación NO viable con el padre',
  descriptionEs: 'Si aplica. Para SIJS por madre Pro Se contra padre ausente, ESTE es el bloque crítico — describe abuso/abandono/negligencia.',
  fields: [
    { semanticKey: 'father_name', pdfFieldName: 'father_name', type: 'text',
      labelEs: 'Nombre del padre', page: 1, deriveFrom: 'father.name' },
  ],
}

// ── Sección 6 — Final order de Conservatorship ───────────────────────────────

const SECTION_6: FormSection = {
  id: 6,
  titleEs: '6. Final Order de Conservatorship',
  descriptionEs: 'Fecha y descripción de la orden final que nombra al peticionario como managing conservator. Si la audiencia es la misma día, esto coincide con la fecha de la motion hearing.',
  fields: [
    { semanticKey: 'final_order_date', pdfFieldName: 'final_order_date', type: 'text',
      labelEs: 'Fecha de la final order (DATE)',
      helpEs: 'Formato libre. Ej. "April 28, 2026" o "the date of this hearing".',
      page: 1, deriveFrom: 'final_order.date' },
  ],
}

// ── Sección 7 — Mejor interés del menor ───────────────────────────────────────

const SECTION_7: FormSection = {
  id: 7,
  titleEs: '7. NO en mejor interés regresar al país',
  descriptionEs: 'País de nacionalidad/última residencia habitual del menor. La narrativa de hechos se lleva en el Affidavit adjunto, no aquí.',
  fields: [
    { semanticKey: 'child_country', pdfFieldName: 'child_country', type: 'text',
      labelEs: 'País de nacionalidad / última residencia habitual',
      helpEs: 'Ej. Honduras, El Salvador, Guatemala.', page: 1, required: true,
      deriveFrom: 'child.country' },
  ],
}

// ── Sección 8 — Datos del abogado / peticionario Pro Se ───────────────────────

const SECTION_8: FormSection = {
  id: 8,
  titleEs: '8. Firma + datos de contacto del peticionario',
  descriptionEs: 'Para Pro Se: deja Bar No vacío. El admin firma a mano sobre la copia descargada.',
  fields: [
    { semanticKey: 'attorney_bar_no', pdfFieldName: 'attorney_bar_no', type: 'text',
      labelEs: 'Texas State Bar No', helpEs: 'Vacío si Pro Se.', page: 1 },
  ],
}

// ── Sección 9 — Notice of hearing + Certificate of service ───────────────────

const SECTION_9: FormSection = {
  id: 9,
  titleEs: '9. Notice de hearing + Certificate of service',
  descriptionEs: 'El admin completa estos campos cuando agenda la audiencia con el court coordinator. Pueden quedar vacíos en la primera versión y editarse luego.',
  fields: [
    { semanticKey: 'hearing_day', pdfFieldName: 'hearing_day', type: 'text',
      labelEs: 'Día de la audiencia', helpEs: 'Ej. 15.', page: 1 },
    { semanticKey: 'hearing_month', pdfFieldName: 'hearing_month', type: 'text',
      labelEs: 'Mes de la audiencia', helpEs: 'Ej. May.', page: 1 },
    { semanticKey: 'hearing_year', pdfFieldName: 'hearing_year', type: 'text',
      labelEs: 'Año (4 dígitos)', helpEs: 'Ej. 2026.', page: 1 },
    { semanticKey: 'hearing_hour', pdfFieldName: 'hearing_hour', type: 'text',
      labelEs: 'Hora', helpEs: 'Ej. 9:00.', page: 1 },
    { semanticKey: 'hearing_ampm', pdfFieldName: 'hearing_ampm', type: 'text',
      labelEs: 'AM/PM', helpEs: 'Ej. a o p.', page: 1 },
    { semanticKey: 'hearing_court_number', pdfFieldName: 'hearing_court_number', type: 'text',
      labelEs: 'Número/nombre de la corte', helpEs: 'Ej. 245th District.', page: 1 },
    { semanticKey: 'hearing_court_location', pdfFieldName: 'hearing_court_location', type: 'text',
      labelEs: 'Ubicación de la corte', helpEs: 'Ej. Houston.', page: 1 },
    { semanticKey: 'service_day', pdfFieldName: 'service_day', type: 'text',
      labelEs: 'Día del Certificate of Service', page: 1 },
    { semanticKey: 'service_month_year', pdfFieldName: 'service_month_year', type: 'text',
      labelEs: 'Mes y año del Certificate', helpEs: 'Ej. April 2026.', page: 1,
      deriveFrom: 'today.month_year' },
  ],
}

// ── Export master ─────────────────────────────────────────────────────────────

export const MOTION_SECTIONS: FormSection[] = [
  SECTION_1, SECTION_2, SECTION_3, SECTION_4, SECTION_5, SECTION_6, SECTION_7, SECTION_8, SECTION_9,
]

export const ALL_FIELDS: FieldSpec[] = MOTION_SECTIONS.flatMap((s) => s.fields)
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
export const motionSijFormSchema = z.object(dynamicShape)
export type MotionSijFormValues = z.infer<typeof motionSijFormSchema>

export const REQUIRED_FOR_PRINT: string[] = ALL_FIELDS
  .filter((f) => f.required)
  .map((f) => f.semanticKey)
