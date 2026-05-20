// Schema curado para EOIR-33/IC (Change of Address / Change of Venue —
// Department of Justice, Executive Office for Immigration Review).
//
// Versión bilingüe en español publicada por EOIR en febrero 2024 (508_1).
// El formulario lo usa el inmigrante (respondent) en proceso de remoción
// para notificar a la corte de inmigración un cambio de domicilio y/o
// solicitar transferencia de venue a otra corte. Su presentación es
// obligatoria cuando hay cambio de jurisdicción de residencia.
//
// PDF: 2 páginas, 26 campos AcroForm:
//   - 14 text (Nombre, Número A, direcciones anterior/actual, encabezado,
//     fecha, datos del acuse y oficina del Chief Counsel)
//   - 1 textarea read-only ("Dropdown Instructions" — texto informativo)
//   - 1 checkbox ("No es necesaria ninguna notificación")
//   - 1 dropdown ("Seleccione el Tribunal de Inmigración") — 74 cortes
//   - 3 text read-only ("Address1/2/3" — autopobladas por el PDF al elegir
//     el tribunal vía JavaScript embedded; las dejamos intactas)
//   - 2 PDFSignature — firmas manuales sobre la copia impresa, no se llenan
//
// Re-correr `node scripts/inspect-eoir-33-fields.mjs` cada vez que EOIR
// publique nueva revisión y actualizar PDF_SHA256.

import { z } from 'zod'

// ──────────────────────────────────────────────────────────────────
// Constantes verificables al runtime
// ──────────────────────────────────────────────────────────────────

export const PDF_PUBLIC_PATH = '/forms/eoir-33.pdf'
export const PDF_DISK_PATH = 'public/forms/eoir-33.pdf'
export const PDF_SHA256 = '30976d0a2246524f1a58e6f87e00daec394b16abf07fb66ff79c901921a4a63b'
export const SCHEMA_VERSION = '2024-02'
export const FORM_SLUG = 'eoir-33'
export const FORM_NAME = 'EOIR-33 — Cambio de Dirección / Cambio de Venue'
export const FORM_DESCRIPTION_ES = 'Notificación de cambio de domicilio y/o solicitud de transferencia de venue ante la Corte de Inmigración (EOIR-33/IC, versión bilingüe).'

// ──────────────────────────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────────────────────────

export type FieldType =
  | 'text'
  | 'textarea'
  | 'checkbox'
  | 'date'
  | 'phone'
  | 'state'
  | 'zip'
  | 'select'

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

export interface Eoir33Section {
  id: 1 | 2 | 3 | 4 | 5 | 6
  titleEs: string
  descriptionEs: string
  fields: FieldSpec[]
}

// ──────────────────────────────────────────────────────────────────
// Catálogo de tribunales (74 opciones del dropdown del PDF original)
// ──────────────────────────────────────────────────────────────────

const COURT_OPTIONS: FieldOption[] = [
  { value: 'Seleccione el Tribunal de Inmigración', labelEs: '— Seleccione un tribunal —' },
  { value: 'Adelanto', labelEs: 'Adelanto' },
  { value: 'Annandale', labelEs: 'Annandale' },
  { value: 'Atlanta - Ted Turner Drive', labelEs: 'Atlanta — Ted Turner Drive' },
  { value: 'Atlanta - W. Peachtree Street', labelEs: 'Atlanta — W. Peachtree Street' },
  { value: 'Aurora', labelEs: 'Aurora' },
  { value: 'Baltimore', labelEs: 'Baltimore' },
  { value: 'Batavia', labelEs: 'Batavia' },
  { value: 'Baton Rouge', labelEs: 'Baton Rouge' },
  { value: 'Boston', labelEs: 'Boston' },
  { value: 'Buffalo', labelEs: 'Buffalo' },
  { value: 'Charlotte', labelEs: 'Charlotte' },
  { value: 'Chelmsford', labelEs: 'Chelmsford' },
  { value: 'Chicago', labelEs: 'Chicago' },
  { value: 'Cleveland', labelEs: 'Cleveland' },
  { value: 'Concord', labelEs: 'Concord' },
  { value: 'Conroe', labelEs: 'Conroe' },
  { value: 'Dallas', labelEs: 'Dallas' },
  { value: 'Denver', labelEs: 'Denver' },
  { value: 'Detroit', labelEs: 'Detroit' },
  { value: 'El Paso', labelEs: 'El Paso' },
  { value: 'El Paso SPC', labelEs: 'El Paso SPC' },
  { value: 'Elizabeth', labelEs: 'Elizabeth' },
  { value: 'Eloy', labelEs: 'Eloy' },
  { value: 'Florence', labelEs: 'Florence' },
  { value: 'Fort Snelling', labelEs: 'Fort Snelling' },
  { value: 'Guaynabo (San Juan)', labelEs: 'Guaynabo (San Juan)' },
  { value: 'Harlingen', labelEs: 'Harlingen' },
  { value: 'Hartford', labelEs: 'Hartford' },
  { value: 'Honolulu', labelEs: 'Honolulu' },
  { value: 'Houston - Greenspoint Park', labelEs: 'Houston — Greenspoint Park' },
  { value: 'Houston - S. Gessner Road', labelEs: 'Houston — S. Gessner Road' },
  { value: 'Hyattsville', labelEs: 'Hyattsville' },
  { value: 'Imperial', labelEs: 'Imperial' },
  { value: 'Indianapolis', labelEs: 'Indianapolis' },
  { value: 'Kansas City', labelEs: 'Kansas City' },
  { value: 'Laredo', labelEs: 'Laredo' },
  { value: 'Las Vegas', labelEs: 'Las Vegas' },
  { value: 'LaSalle', labelEs: 'LaSalle' },
  { value: 'Los Angeles - N. Los Angeles Street', labelEs: 'Los Angeles — N. Los Angeles Street' },
  { value: 'Los Angeles - Van Nuys Boulevard', labelEs: 'Los Angeles — Van Nuys Boulevard' },
  { value: 'Los Angeles - West Los Angeles', labelEs: 'Los Angeles — West Los Angeles' },
  { value: 'Memphis', labelEs: 'Memphis' },
  { value: 'Miami', labelEs: 'Miami' },
  { value: 'Miami Krome', labelEs: 'Miami Krome' },
  { value: 'New Orleans', labelEs: 'New Orleans' },
  { value: 'New York - Broadway', labelEs: 'New York — Broadway' },
  { value: 'New York - Federal Plaza', labelEs: 'New York — Federal Plaza' },
  { value: 'New York - Varick', labelEs: 'New York — Varick' },
  { value: 'Newark', labelEs: 'Newark' },
  { value: 'Oakdale', labelEs: 'Oakdale' },
  { value: 'Omaha', labelEs: 'Omaha' },
  { value: 'Orlando', labelEs: 'Orlando' },
  { value: 'Otay Mesa', labelEs: 'Otay Mesa' },
  { value: 'Otero', labelEs: 'Otero' },
  { value: 'Pearsall', labelEs: 'Pearsall' },
  { value: 'Philadelphia', labelEs: 'Philadelphia' },
  { value: 'Phoenix', labelEs: 'Phoenix' },
  { value: 'Port Isabel', labelEs: 'Port Isabel' },
  { value: 'Portland', labelEs: 'Portland' },
  { value: 'Sacramento', labelEs: 'Sacramento' },
  { value: 'Saipan', labelEs: 'Saipan' },
  { value: 'Salt Lake City', labelEs: 'Salt Lake City' },
  { value: 'San Antonio', labelEs: 'San Antonio' },
  { value: 'San Diego', labelEs: 'San Diego' },
  { value: 'San Francisco', labelEs: 'San Francisco' },
  { value: 'San Juan', labelEs: 'San Juan' },
  { value: 'Santa Ana', labelEs: 'Santa Ana' },
  { value: 'Seattle', labelEs: 'Seattle' },
  { value: 'Sterling', labelEs: 'Sterling' },
  { value: 'Stewart', labelEs: 'Stewart' },
  { value: 'Tacoma', labelEs: 'Tacoma' },
  { value: 'Tucson', labelEs: 'Tucson' },
  { value: 'Ulster', labelEs: 'Ulster' },
]

// ──────────────────────────────────────────────────────────────────
// Secciones (6 grupos lógicos sobre los 19 campos editables del PDF)
// ──────────────────────────────────────────────────────────────────

const SECTION_1: Eoir33Section = {
  id: 1,
  titleEs: '1. Identificación del extranjero',
  descriptionEs: 'Nombre completo del respondent (extranjero en proceso) y su número A asignado por el gobierno.',
  fields: [
    { semanticKey: 'respondent_full_name', pdfFieldName: 'Nombre', type: 'text', labelEs: 'Nombre completo', helpEs: 'Tal como aparece en sus notificaciones de la corte (ej. "JENY LORENA BARRERA").', page: 1, required: true, deriveFrom: 'respondent.full_name' },
    { semanticKey: 'a_number', pdfFieldName: 'Número A', type: 'text', labelEs: 'Número A (Alien Number)', helpEs: 'Formato típico: 245-205-119 o A245205119.', page: 1, required: true, deriveFrom: 'respondent.a_number' },
  ],
}

const SECTION_2: Eoir33Section = {
  id: 2,
  titleEs: '2. Dirección anterior (donde vivía antes)',
  descriptionEs: 'Dirección que el gobierno tiene registrada hoy (la dirección que está cambiando). Si no recuerda algún dato, déjelo vacío.',
  fields: [
    { semanticKey: 'prior_street', pdfFieldName: 'número calle apartamento, anterior', type: 'text', labelEs: 'Calle, número y apartamento (anterior)', page: 1, deriveFrom: 'respondent.prior_address.street' },
    { semanticKey: 'prior_city_state_zip_country', pdfFieldName: 'ciudad estado código postal país, anterior', type: 'text', labelEs: 'Ciudad, estado, código postal y país (anterior)', helpEs: 'Ej. "Seattle, WA 98101, USA"', page: 1, deriveFrom: 'respondent.prior_address.city_state_zip_country' },
    { semanticKey: 'prior_phone', pdfFieldName: 'número de teléfono, anterior', type: 'phone', labelEs: 'Teléfono anterior', page: 1, deriveFrom: 'respondent.prior_phone' },
    { semanticKey: 'prior_email', pdfFieldName: 'dirección de correo electrónico, anterior', type: 'text', labelEs: 'Correo electrónico anterior', page: 1, deriveFrom: 'respondent.prior_email' },
  ],
}

const SECTION_3: Eoir33Section = {
  id: 3,
  titleEs: '3. Dirección actual (donde vive ahora)',
  descriptionEs: 'Nueva dirección donde reside hoy. Esta dirección se vuelve oficial al firmar el formulario.',
  fields: [
    { semanticKey: 'current_street', pdfFieldName: 'número calle apartamento, actual', type: 'text', labelEs: 'Calle, número y apartamento (actual)', page: 1, required: true, deriveFrom: 'respondent.current_address.street' },
    { semanticKey: 'current_city_state_zip_country', pdfFieldName: 'ciudad estado código postal país, actual', type: 'text', labelEs: 'Ciudad, estado, código postal y país (actual)', helpEs: 'Ej. "Highland, UT 84003, USA"', page: 1, required: true, deriveFrom: 'respondent.current_address.city_state_zip_country' },
    { semanticKey: 'current_phone', pdfFieldName: 'número de teléfono, actual', type: 'phone', labelEs: 'Teléfono actual', page: 1, required: true, deriveFrom: 'respondent.current_phone' },
    { semanticKey: 'current_email', pdfFieldName: 'dirección de correo electrónico, actual', type: 'text', labelEs: 'Correo electrónico actual', page: 1, deriveFrom: 'respondent.current_email' },
  ],
}

const SECTION_4: Eoir33Section = {
  id: 4,
  titleEs: '4. Encabezado del formulario (página 1)',
  descriptionEs: 'Encabezado en la esquina superior izquierda del PDF: fecha y dirección de contacto a 4 líneas. La fecha se llena con el día de hoy por defecto.',
  fields: [
    { semanticKey: 'date_document', pdfFieldName: 'Fecha', type: 'date', labelEs: 'Fecha del documento', helpEs: 'Por defecto: hoy.', page: 1, required: true, deriveFrom: 'document.date_today' },
    { semanticKey: 'header_addr_line_1', pdfFieldName: 'PONGA SU DIRECCIÓN AQUÍ 1', type: 'text', labelEs: 'Línea 1 — Nombre', page: 1, deriveFrom: 'respondent.full_name_upper' },
    { semanticKey: 'header_addr_line_2', pdfFieldName: 'PONGA SU DIRECCIÓN AQUÍ 2', type: 'text', labelEs: 'Línea 2 — Calle', page: 1, deriveFrom: 'respondent.current_address.street' },
    { semanticKey: 'header_addr_line_3', pdfFieldName: 'PONGA SU DIRECCIÓN AQUÍ 3', type: 'text', labelEs: 'Línea 3 — Ciudad, Estado, ZIP', page: 1, deriveFrom: 'respondent.current_address.city_state_zip' },
    { semanticKey: 'header_addr_line_4', pdfFieldName: 'PONGA SU DIRECCIÓN AQUÍ 4', type: 'text', labelEs: 'Línea 4 — Teléfono', page: 1, deriveFrom: 'respondent.current_phone' },
  ],
}

const SECTION_5: Eoir33Section = {
  id: 5,
  titleEs: '5. Tribunal de Inmigración (cambio de venue)',
  descriptionEs: 'Seleccione el tribunal al que desea transferir su caso. Las direcciones del tribunal (Address 1/2/3) las llena automáticamente el PDF al elegir el tribunal.',
  fields: [
    { semanticKey: 'selected_court', pdfFieldName: 'Seleccione el Tribunal de Inmigración', type: 'select', labelEs: 'Tribunal de Inmigración solicitado', helpEs: 'Elija el tribunal de la ciudad donde reside ahora.', page: 2, options: COURT_OPTIONS, deriveFrom: 'respondent.selected_court' },
  ],
}

const SECTION_6: Eoir33Section = {
  id: 6,
  titleEs: '6. Acuse de notificación al Chief Counsel',
  descriptionEs: 'Confirmación de que se entregó copia del formulario al fiscal principal (Office of the Chief Counsel). Si la corte indica que no es necesaria notificación al gobierno, marque la casilla y deje los demás campos vacíos.',
  fields: [
    { semanticKey: 'no_notice_needed', pdfFieldName: 'No es necesaria ninguna notificación', type: 'checkbox', labelEs: 'No es necesaria ninguna notificación al Chief Counsel', helpEs: 'Marcar solo si la corte explícitamente lo indica.', page: 2 },
    { semanticKey: 'notice_recipient_name', pdfFieldName: 'nombre, acuse de notificación', type: 'text', labelEs: 'Nombre de quien recibe el acuse', page: 2, deriveFrom: 'respondent.full_name' },
    { semanticKey: 'notice_date', pdfFieldName: 'fecha, acuse de notificación', type: 'date', labelEs: 'Fecha del acuse', page: 2, deriveFrom: 'document.date_today' },
    { semanticKey: 'chief_counsel_office_location', pdfFieldName: 'oficina del asesor jurídico principal, ubicación 1', type: 'text', labelEs: 'Oficina del Chief Counsel — Ubicación', helpEs: 'Ej. "Office of the Chief Counsel — Seattle".', page: 2 },
  ],
}

export const EOIR_33_SECTIONS: Eoir33Section[] = [SECTION_1, SECTION_2, SECTION_3, SECTION_4, SECTION_5, SECTION_6]

// ──────────────────────────────────────────────────────────────────
// Maps derivados
// ──────────────────────────────────────────────────────────────────

export const ALL_FIELDS: FieldSpec[] = EOIR_33_SECTIONS.flatMap((s) => s.fields)
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
// Zod schema (todos opcionales — la validación obligatoria para imprimir
// se hace por separado con REQUIRED_FOR_PRINT).
// ──────────────────────────────────────────────────────────────────

const valueSchema = z.union([z.string(), z.boolean()]).optional().nullable()
const dynamicShape: Record<string, z.ZodTypeAny> = {}
for (const f of ALL_FIELDS) {
  dynamicShape[f.semanticKey] = valueSchema
}

export const eoir33FormSchema = z.object(dynamicShape)
export type Eoir33FormValues = z.infer<typeof eoir33FormSchema>

export const REQUIRED_FOR_PRINT: string[] = ALL_FIELDS.filter((f) => f.required).map((f) => f.semanticKey)
