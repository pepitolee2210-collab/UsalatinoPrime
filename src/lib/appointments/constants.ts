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

/** Flat list for backward compatibility */
export const APPOINTMENT_DOCUMENT_KEYS = DOCUMENT_CATEGORIES.flatMap(c =>
  c.docs.map(d => ({ key: d.key, label: d.label, required: d.required }))
)

export type AppointmentDocumentKey = string
