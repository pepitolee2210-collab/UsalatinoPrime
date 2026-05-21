// Schema curado para EOIR-26 — Notice of Appeal from a Decision of an
// Immigration Judge (presentado ante la BIA — Board of Immigration Appeals).
//
// Fuente de verdad para:
// - Mapeo semanticKey ↔ pdfFieldName (nombre real del AcroForm).
// - Etiquetas en español, ayuda contextual y agrupación por secciones.
// - Validación Zod (cliente + servidor).
// - Valores hardcodeados (verdades universales para una apelación BIA).
// - Reglas deriveFrom para prefill desde BD (resueltas en eoir-26-prefill.ts).
//
// Si EOIR publica una nueva revisión del PDF, re-ejecutar el script de
// inspección y actualizar PDF_SHA256 + cualquier pdfFieldName que haya cambiado.

import { z } from 'zod'
import type { FieldSpec, SapcrSection } from './sapcr100-form-schema'

// ──────────────────────────────────────────────────────────────────
// Constantes verificables al runtime
// ──────────────────────────────────────────────────────────────────

export const PDF_PUBLIC_PATH = '/forms/eoir-26.pdf'
export const PDF_DISK_PATH = 'public/forms/eoir-26.pdf'
export const PDF_SHA256 = 'd1aeeb70e3a23b579ffad092aaa99d118a1a4c5f42f0429d6a036faa53811313'
export const SCHEMA_VERSION = '2026-05-21'
export const FORM_SLUG = 'eoir-26'
export const FORM_NAME = 'EOIR-26 — Notice of Appeal'
export const FORM_DESCRIPTION_ES =
  'Notificación de Apelación ante la BIA contra la decisión adversa del Juez de Inmigración. Debe presentarse dentro de los 30 días siguientes a la decisión.'

// Valores válidos para los RadioGroups del PDF (deben coincidir EXACTO con
// `form.getField(name).getOptions()` — verificado vía pdf-lib en la inspección).
// Re-confirmados por scripts/inspect-eoir-26-fields.mjs (output en
// scripts/eoir-26-raw-fields.json):
//   '2'    → ['Respondent/Applicant', 'DHS-ICE']
//   '3'    → ['Detained', 'Not Detained']
//   '5'    → 4 opciones de tipo de apelación
//   '5DHS' → ['Yes', 'No']
//   '7'    → ['No', 'Choice1']      ← Brief intent (item #8 del PDF físico).
//                                     'Choice1' = Yes; 'No' = No.
//   '8'    → ['Choice3', 'Yes']     ← Oral argument (item #7 del PDF físico).
//                                     'Yes' = Yes; 'Choice3' = No.
//
// Cross-mapping importante: el pdfFieldName NO refleja el número visible de
// la pregunta del PDF. El semanticKey describe la función real (brief_intent /
// oral_argument_request) y resuelve la confusión.

// ──────────────────────────────────────────────────────────────────
// Secciones
// ──────────────────────────────────────────────────────────────────

const SECTION_1: SapcrSection = {
  id: 1,
  titleEs: '1. Datos del apelante',
  descriptionEs:
    'Identificación de la persona que presenta la apelación (Respondent/Applicant). Esta información se imprime en el encabezado del Notice of Appeal.',
  fields: [
    { semanticKey: 'appellant_print_name', pdfFieldName: 'Print Name', type: 'text', labelEs: 'Nombre completo del apelante', helpEs: 'Como aparece en su pasaporte y en el caso ante la Corte de Inmigración.', page: 1, required: true, deriveFrom: 'appellant.full_name' },
    { semanticKey: 'appellant_signature_placeholder', pdfFieldName: 'Sign Here', type: 'text', labelEs: 'Firma (texto)', helpEs: 'El apelante firmará a mano sobre la copia impresa.', page: 1, deriveFrom: 'appellant.full_name', editableByClient: false },
    { semanticKey: 'appellant_street_address', pdfFieldName: 'Street Address', type: 'text', labelEs: 'Dirección (calle y número)', page: 1, required: true, deriveFrom: 'appellant.street_address' },
    { semanticKey: 'appellant_apartment', pdfFieldName: 'Apartment or Room Number', type: 'text', labelEs: 'Apartamento o número de habitación', page: 1, deriveFrom: 'appellant.apartment' },
    { semanticKey: 'appellant_city_state_zip', pdfFieldName: 'City State Zip Code', type: 'text', labelEs: 'Ciudad, estado y código postal', helpEs: 'Ej. Houston, TX 77002.', page: 1, required: true, deriveFrom: 'appellant.city_state_zip' },
    { semanticKey: 'appellant_telephone', pdfFieldName: 'Telephone Number', type: 'phone', labelEs: 'Teléfono', page: 1, required: true, deriveFrom: 'appellant.phone' },
  ],
}

const SECTION_2: SapcrSection = {
  id: 2,
  titleEs: '2. Aliens del caso (nombres y A-Numbers)',
  descriptionEs:
    'Lista todos los nombres y A-Numbers (Alien Registration Numbers) de las personas cubiertas por esta apelación. Si la apelación cubre solo al apelante, listar uno.',
  fields: [
    { semanticKey: 'aliens_list', pdfFieldName: '1. List names and alien numbers', type: 'textarea', labelEs: 'Nombre(s) y A-Number(s)', helpEs: 'Formato: "Apellido, Nombre — A123456789". Una persona por línea.', page: 1, required: true, deriveFrom: 'appellant.aliens_list' },
  ],
}

const SECTION_3: SapcrSection = {
  id: 3,
  titleEs: '3. Decisión apelada',
  descriptionEs:
    'Detalles de la decisión del Juez de Inmigración (IJ) que se está apelando. Estos datos los obtiene del auto de denegación del juez.',
  fields: [
    {
      semanticKey: 'appeal_party',
      pdfFieldName: '2',
      type: 'radio',
      labelEs: '¿Quién presenta la apelación?',
      helpEs: 'Para apelaciones del solicitante de asilo: "El apelante (Respondent/Applicant)".',
      page: 1,
      required: true,
      defaultValue: 'Respondent/Applicant',
      editableByClient: true,
      options: [
        { value: 'Respondent/Applicant', labelEs: 'El apelante (Respondent / Applicant)' },
        { value: 'DHS-ICE', labelEs: 'DHS-ICE' },
      ],
    },
    {
      semanticKey: 'custody_status',
      pdfFieldName: '3',
      type: 'radio',
      labelEs: '¿El apelante está detenido?',
      helpEs: 'Marca "No detenido" por defecto. Cambia a "Detenido" solo si el cliente está bajo custodia de ICE.',
      page: 1,
      required: true,
      defaultValue: 'Not Detained',
      editableByClient: true,
      deriveFrom: 'appellant.custody_status',
      options: [
        { value: 'Not Detained', labelEs: 'No detenido' },
        { value: 'Detained', labelEs: 'Detenido (en custodia ICE)' },
      ],
    },
    {
      semanticKey: 'last_hearing_location',
      pdfFieldName: '4. Last hearing',
      type: 'textarea',
      labelEs: 'Ciudad y estado de la última audiencia ante el IJ',
      helpEs: 'Ej. Houston, TX. Aparece en el auto de denegación.',
      page: 1,
      required: true,
      deriveFrom: 'appeal_decision.last_hearing_location',
    },
    {
      semanticKey: 'appeal_type',
      pdfFieldName: '5',
      type: 'radio',
      labelEs: 'Tipo de apelación',
      helpEs: 'Selecciona el tipo de decisión que estás apelando ante la BIA.',
      page: 1,
      required: true,
      editableByClient: true,
      options: [
        { value: 'Merits proceedings appeal', labelEs: 'Apelación directa por denegación de asilo (Merits)' },
        { value: 'Bond proceedings appeal', labelEs: 'Apelación en procedimiento de fianza (Bond)' },
        { value: 'Denial of motion to reopen or a motion to reconsider appeal', labelEs: 'Moción de Reapertura o Reconsideración' },
        { value: 'Interlocutory appeal', labelEs: 'Apelación interlocutoria' },
      ],
    },
    {
      semanticKey: 'dhs_interlocutory',
      pdfFieldName: '5DHS',
      type: 'radio',
      labelEs: '¿Es apelación interlocutoria del DHS?',
      helpEs: 'Solo aplica cuando el tipo es "Apelación en procedimiento de fianza".',
      page: 1,
      editableByClient: true,
      defaultValue: 'No',
      dependsOn: { semanticKey: 'appeal_type', equals: 'Bond proceedings appeal' },
      options: [
        { value: 'Yes', labelEs: 'Sí' },
        { value: 'No', labelEs: 'No' },
      ],
    },
    {
      semanticKey: 'decision_description',
      pdfFieldName: '6',
      type: 'textarea',
      labelEs: 'Resumen de la decisión que se apela',
      helpEs: 'Describe brevemente qué decidió el IJ (ej. "Denegación de Asilo bajo §208 del INA"). Si solicitas argumento oral (pregunta #7), explica aquí por qué tu caso amerita revisión por panel de tres miembros.',
      page: 1,
      required: true,
      deriveFrom: 'appeal_decision.summary',
    },
    {
      // Item #7 del PDF físico: "Do you desire oral argument before the BIA?"
      // Cross-mapping: pdfFieldName '8' (no '7') — confirmado por inspect.
      semanticKey: 'oral_argument_request',
      pdfFieldName: '8',
      type: 'radio',
      labelEs: '#7 — ¿Desea argumento oral ante la BIA?',
      helpEs: 'Si marcas "Sí": debes explicar en el item #6 por qué tu caso amerita revisión por panel de tres miembros. La BIA normalmente no concede argumento oral salvo que también se presente un brief.',
      page: 1,
      required: true,
      editableByClient: true,
      options: [
        { value: 'Yes', labelEs: 'Sí, solicito argumento oral' },
        { value: 'Choice3', labelEs: 'No solicito argumento oral' },
      ],
    },
    {
      // Item #8 del PDF físico: "Do you intend to file a separate written brief?"
      // Cross-mapping: pdfFieldName '7' (no '8') — confirmado por inspect.
      semanticKey: 'brief_intent',
      pdfFieldName: '7',
      type: 'radio',
      labelEs: '#8 — ¿Presentará un brief o declaración escrita separada después de este Notice of Appeal?',
      helpEs: 'Si marcas "Sí", deberás enviar el brief a la BIA dentro del plazo que se te indique.',
      page: 1,
      required: true,
      editableByClient: true,
      options: [
        { value: 'Choice1', labelEs: 'Sí, presentaré brief separado' },
        { value: 'No', labelEs: 'No presentaré brief separado' },
      ],
    },
  ],
}

const SECTION_4: SapcrSection = {
  id: 4,
  titleEs: '4. Fechas relevantes',
  descriptionEs:
    'Fechas de audiencias previas (opcionales) y la fecha CRÍTICA del fallo del IJ. Todas en formato MM/DD/YYYY.',
  fields: [
    {
      semanticKey: 'hearing_date_1',
      pdfFieldName: 'Date 5.1_af_date',
      type: 'date',
      labelEs: 'Fecha de audiencia 1',
      helpEs: 'Primera audiencia relevante ante el IJ (opcional).',
      page: 1,
      groupKey: 'hearings',
      deriveFrom: 'appeal_decision.hearing_date_1',
    },
    {
      semanticKey: 'hearing_date_2',
      pdfFieldName: 'Date 5.2_af_date',
      type: 'date',
      labelEs: 'Fecha de audiencia 2',
      page: 1,
      groupKey: 'hearings',
    },
    {
      semanticKey: 'hearing_date_3',
      pdfFieldName: 'Date 5.3_af_date',
      type: 'date',
      labelEs: 'Fecha de audiencia 3',
      page: 1,
      groupKey: 'hearings',
    },
    {
      semanticKey: 'hearing_date_4',
      pdfFieldName: 'Date 5.4_af_date',
      type: 'date',
      labelEs: 'Fecha de audiencia 4',
      page: 1,
      groupKey: 'hearings',
    },
    {
      semanticKey: 'decision_date',
      pdfFieldName: '9. Date_af_date',
      type: 'date',
      labelEs: 'Fecha del fallo / decisión del IJ (apelada)',
      helpEs: '⚠️ CRÍTICO — esta fecha define el plazo legal de 30 días para presentar la apelación. Es la fecha que aparece al pie del auto de denegación del juez, NO una fecha de audiencia previa. Si subiste el "Auto de Denegación del Juez", la IA puede haberla pre-llenado.',
      page: 1,
      required: true,
      groupKey: 'decision',
      deriveFrom: 'appeal_decision.decision_date',
    },
  ],
}

// SECTION_5: en UsaLatino Prime el cliente presenta la apelación **pro se**
// (sin representante legal acreditado ante EOIR). Esta sección debe quedar
// COMPLETAMENTE en blanco al imprimir el PDF. Los campos se mantienen en el
// schema (sin deriveFrom y sin hardcoded) para que Diana pueda llenarlos
// manualmente si en el futuro algún caso sí lleva representante.
const SECTION_5: SapcrSection = {
  id: 5,
  titleEs: '5. Abogado / Representante (no aplica — cliente pro se)',
  descriptionEs:
    'En UsaLatino Prime el cliente firma y presenta la apelación pro se (sin representante legal acreditado ante EOIR). Esta sección queda en blanco al imprimir.',
  fields: [
    { semanticKey: 'attorney_name', pdfFieldName: '10. Name', type: 'text', labelEs: 'Nombre del abogado supervisor o representante', helpEs: 'Dejar vacío — cliente pro se.', page: 1, editableByClient: false },
    { semanticKey: 'firm_name', pdfFieldName: '11. Name', type: 'text', labelEs: 'Nombre de la firma / organización', page: 1, editableByClient: false },
    { semanticKey: 'firm_street_address', pdfFieldName: '11. Street Address', type: 'text', labelEs: 'Dirección de la firma', page: 1, editableByClient: false },
    { semanticKey: 'firm_suite', pdfFieldName: '11. Suite or Room Number', type: 'text', labelEs: 'Suite o Room Number', page: 1, editableByClient: false },
    { semanticKey: 'firm_city_state_zip', pdfFieldName: '11. City, State, and Zip Code', type: 'text', labelEs: 'Ciudad, estado, zip de la firma', page: 1, editableByClient: false },
    { semanticKey: 'firm_telephone', pdfFieldName: '11. Telephone Number', type: 'phone', labelEs: 'Teléfono de la firma', page: 1, editableByClient: false },
    { semanticKey: 'firm_email', pdfFieldName: '11. Email', type: 'text', labelEs: 'Email de la firma', page: 1, editableByClient: false },
  ],
}

// SECTION_6: "Proof of Service" del item #12 del PDF. La firma del CERTIFICANTE
// (la persona que afirma haber entregado/enviado copia del Notice of Appeal al
// DHS) ES el cliente apelante, no el DHS. Confirmación vía inspect:
//   '12. Name'                                       → firma del certificante (cliente)
//   '12. Copy of Notice to Appeal mailed/delivered to' → nombre del destinatario (oficina DHS)
//   '12. Address'                                    → dirección del destinatario
const SECTION_6: SapcrSection = {
  id: 6,
  titleEs: '6. Servicio de la apelación al DHS (Proof of Service)',
  descriptionEs:
    'El apelante (cliente) certifica que entregó copia de este Notice of Appeal al Office of the District Counsel del DHS-ICE. Aquí va el nombre del cliente (quien certifica), seguido del destinatario y su dirección.',
  fields: [
    {
      semanticKey: 'service_certifier_name',
      pdfFieldName: '12. Name',
      type: 'text',
      labelEs: 'Nombre del cliente (quien certifica el servicio)',
      helpEs: 'Aparece como "I, [nombre]…" — confirma que tú entregaste copia al DHS.',
      page: 1,
      required: true,
      editableByClient: true,
      deriveFrom: 'appellant.full_name',
    },
    {
      semanticKey: 'service_recipient_org',
      pdfFieldName: '12. Copy of Notice to Appeal mailed/delivered to',
      type: 'textarea',
      labelEs: 'Destinatario del servicio (a quién se entregó copia)',
      helpEs: 'Típicamente "Office of the District Counsel, DHS-ICE" de la jurisdicción de la corte.',
      page: 1,
      hardcoded: 'Office of the District Counsel, DHS-ICE',
    },
    {
      semanticKey: 'service_address',
      pdfFieldName: '12. Address',
      type: 'textarea',
      labelEs: 'Dirección del destinatario del servicio',
      helpEs: 'Dirección postal de la oficina del District Counsel donde se envía/entrega la copia.',
      page: 1,
      required: true,
      editableByClient: true,
    },
    {
      semanticKey: 'service_signature_placeholder',
      pdfFieldName: '12. SIGN HERE',
      type: 'text',
      labelEs: 'Firma (sobre el impreso)',
      helpEs: 'El cliente firma a mano sobre la copia impresa — el sistema no lo rellena digitalmente.',
      page: 1,
      editableByClient: false,
    },
    {
      semanticKey: 'no_service_needed',
      pdfFieldName: '12. No service needed',
      type: 'checkbox',
      labelEs: 'No se requiere servicio (caso raro)',
      helpEs: 'Solo marcar si DHS no estaba representado en el caso.',
      page: 1,
    },
    {
      semanticKey: 'service_date',
      pdfFieldName: '12. Date_af_date',
      type: 'date',
      labelEs: 'Fecha del servicio',
      helpEs: 'Fecha en que se entregó/envió la copia al DHS.',
      page: 1,
    },
  ],
}

const SECTION_7: SapcrSection = {
  id: 7,
  titleEs: '7. Checklist de cumplimiento (BIA)',
  descriptionEs:
    'La BIA exige confirmar varios elementos antes de aceptar el Notice of Appeal. Diana marca cada checkbox conforme verifica el paquete final. Todos suelen ir marcados.',
  fields: [
    { semanticKey: 'cert_general_instructions', pdfFieldName: 'General Instructions checkbox', type: 'checkbox', labelEs: 'Leí las instrucciones generales', page: 1, hardcoded: true, editableByClient: false },
    { semanticKey: 'cert_requested_information', pdfFieldName: 'Requested information checkbox', type: 'checkbox', labelEs: 'Completé toda la información solicitada', page: 1, hardcoded: true, editableByClient: false },
    { semanticKey: 'cert_completed_in_english', pdfFieldName: 'Completed form in English checkbox', type: 'checkbox', labelEs: 'El formulario está completado en inglés', page: 1, hardcoded: true, editableByClient: false },
    { semanticKey: 'cert_certified_translation', pdfFieldName: 'Certified translation checkbox', type: 'checkbox', labelEs: 'Adjunté traducciones certificadas (si aplica)', page: 1, editableByClient: false },
    { semanticKey: 'cert_signed_form', pdfFieldName: 'Signed the form checkbox', type: 'checkbox', labelEs: 'Firmé el formulario', page: 1, hardcoded: true, editableByClient: false },
    { semanticKey: 'cert_served_copy', pdfFieldName: 'Served a copy of the form checkbox', type: 'checkbox', labelEs: 'Serví copia del formulario al DHS', page: 1, hardcoded: true, editableByClient: false },
    { semanticKey: 'cert_proof_of_service', pdfFieldName: 'Proof of Service checkbox', type: 'checkbox', labelEs: 'Incluí prueba de servicio', page: 1, hardcoded: true, editableByClient: false },
    { semanticKey: 'cert_receipt', pdfFieldName: 'Receipt checkbox', type: 'checkbox', labelEs: 'Adjunté comprobante de pago o solicitud de fee waiver (EOIR-26A)', page: 1, hardcoded: true, editableByClient: false },
    { semanticKey: 'cert_eoir_27', pdfFieldName: 'EOIR-27 checkbox', type: 'checkbox', labelEs: 'Adjunté EOIR-27 (Notice of Entry of Appearance) si hay representante', page: 1, editableByClient: false },
  ],
}

export const EOIR_26_SECTIONS: SapcrSection[] = [
  SECTION_1,
  SECTION_2,
  SECTION_3,
  SECTION_4,
  SECTION_5,
  SECTION_6,
  SECTION_7,
]

// ──────────────────────────────────────────────────────────────────
// Map flat por semanticKey (acceso O(1)) + hardcoded + required
// ──────────────────────────────────────────────────────────────────

export const ALL_FIELDS: FieldSpec[] = EOIR_26_SECTIONS.flatMap((s) => s.fields)

export const FIELD_BY_KEY: Record<string, FieldSpec> = Object.fromEntries(
  ALL_FIELDS.filter((f) => f.pdfFieldName).map((f) => [f.semanticKey, f]),
)

export const HARDCODED_VALUES: Record<string, string | boolean> = ALL_FIELDS.reduce(
  (acc, f) => {
    if (f.hardcoded !== undefined) acc[f.semanticKey] = f.hardcoded
    return acc
  },
  {} as Record<string, string | boolean>,
)

export const REQUIRED_FOR_PRINT: string[] = ALL_FIELDS.filter((f) => f.required).map(
  (f) => f.semanticKey,
)

// ──────────────────────────────────────────────────────────────────
// Zod schema (todos opcionales — la validación de "obligatorio para
// imprimir" se hace por separado con `REQUIRED_FOR_PRINT`).
// ──────────────────────────────────────────────────────────────────

const valueSchema = z.union([z.string(), z.boolean()]).optional().nullable()
const dynamicShape: Record<string, z.ZodTypeAny> = {}
for (const f of ALL_FIELDS) {
  dynamicShape[f.semanticKey] = valueSchema
}

export const eoir26FormSchema = z.object(dynamicShape)
export type Eoir26FormValues = z.infer<typeof eoir26FormSchema>
