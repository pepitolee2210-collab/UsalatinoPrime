export const TIMEZONE = 'America/Denver'

/** Días de penalización por no_show o cancelación tardía */
export const PENALTY_DAYS = 7

/** Horas mínimas de anticipación para cancelar sin penalización */
export const MIN_CANCEL_HOURS = 24

/** Documentos organizados por categoría */
export const DOCUMENT_CATEGORIES = [
  {
    id: 'personal',
    title: 'Documentos Personales y/o Familia',
    icon: 'users',
    docs: [
      { key: 'tutor_id', label: 'Pasaporte o ID del Tutor', required: true },
      { key: 'minor_id', label: 'Pasaporte o ID de Menores', required: true },
      { key: 'birth_certificates', label: 'Actas de Nacimiento de Menores', required: true },
    ],
  },
  {
    id: 'residencia',
    title: 'Documentos de Residencia',
    icon: 'home',
    docs: [
      { key: 'lease_or_utility', label: 'Contrato de Arrendamiento', required: true },
      { key: 'utility_bill', label: 'Factura de Servicio (agua, luz, gas)', required: false },
    ],
  },
  {
    id: 'sustentatorios',
    title: 'Documentos Sustentatorios',
    icon: 'file',
    docs: [
      { key: 'tax_declaration', label: 'Declaración de Taxes', required: false },
      { key: 'school_proof', label: 'Prueba Domiciliaria Escolar', required: false },
    ],
  },
  {
    id: 'testigos',
    title: 'Documentos de Testigos',
    icon: 'witness',
    accept: '.pdf,.jpg,.jpeg,.png,.webp',
    docs: [
      { key: 'witness_id_1', label: 'ID o Pasaporte del Testigo 1', required: false },
      { key: 'witness_id_2', label: 'ID o Pasaporte del Testigo 2', required: false },
      { key: 'witness_id_3', label: 'ID o Pasaporte del Testigo 3', required: false },
      { key: 'witness_declaration', label: 'Declaraciones escritas de testigos', required: false },
      { key: 'witness_other', label: 'Otros documentos de testigos', required: false },
    ],
  },
  {
    id: 'probatorios',
    title: 'Otros Documentos Probatorios',
    icon: 'camera',
    accept: '.pdf,.jpg,.jpeg,.png,.webp',
    docs: [
      { key: 'probatory_photos', label: 'Fotos y evidencia visual', required: false },
      { key: 'probatory_other', label: 'Otros documentos de soporte', required: false },
    ],
  },
]

/** Documentos para Ajuste de Estatus (I-485) */
export const I485_DOCUMENT_CATEGORIES = [
  {
    id: 'identidad_menor',
    title: 'Identidad del Menor',
    icon: 'users',
    docs: [
      { key: 'i485_passport', label: 'Pasaporte vigente (todas las páginas usadas)', required: true },
      { key: 'i485_birth_certificate', label: 'Acta de nacimiento (con traducción al inglés)', required: true },
      { key: 'i485_additional_id', label: 'ID adicional (DNI, cédula, etc.)', required: false },
    ],
  },
  {
    id: 'entrada_eeuu',
    title: 'Entrada a EE.UU.',
    icon: 'file',
    docs: [
      { key: 'i485_i94', label: 'I-94 (si ingresó con visa o parole)', required: false },
      { key: 'i485_cbp_doc', label: 'Documento de CBP', required: false },
      { key: 'i485_nta', label: 'Notice to Appear (NTA)', required: false },
      { key: 'i485_parole', label: 'Parole', required: false },
    ],
  },
  {
    id: 'sij_docs',
    title: 'Documentos de SIJ (Lo Más Importante)',
    icon: 'file',
    note: 'Sin estos documentos NO se puede proceder con el ajuste.',
    docs: [
      { key: 'i485_custody_order', label: 'Orden de la corte juvenil (custodia o tutela)', required: true },
      { key: 'i485_sij_findings', label: 'SIJ Findings Order (abuso/negligencia/abandono + best interest)', required: true },
      { key: 'i485_i360_approval', label: 'Aprobación de la I-360 (Notice I-797)', required: true },
    ],
  },
  {
    id: 'examen_medico',
    title: 'Examen Médico',
    icon: 'camera',
    note: 'El formulario I-693 se envía en sobre sellado. NO lo abra. NO lo cargue aquí.',
    infoOnly: true,
    docs: [],
  },
  {
    id: 'i485_probatorios',
    title: 'Otros Documentos de Soporte',
    icon: 'camera',
    accept: '.pdf,.jpg,.jpeg,.png,.webp',
    docs: [
      { key: 'i485_photos', label: 'Fotos y evidencia adicional', required: false },
      { key: 'i485_other', label: 'Otros documentos de soporte', required: false },
    ],
  },
]

/** Get document categories based on service slug */
export function getDocumentCategories(serviceSlug?: string) {
  if (serviceSlug === 'ajuste-de-estatus') return I485_DOCUMENT_CATEGORIES
  return DOCUMENT_CATEGORIES
}

/** Flat list for backward compatibility */
export const APPOINTMENT_DOCUMENT_KEYS = [
  ...DOCUMENT_CATEGORIES,
  ...I485_DOCUMENT_CATEGORIES,
].flatMap(c =>
  c.docs.map(d => ({ key: d.key, label: d.label, required: d.required }))
)

export type AppointmentDocumentKey = string
