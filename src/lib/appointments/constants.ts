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
]

/** Flat list for backward compatibility */
export const APPOINTMENT_DOCUMENT_KEYS = DOCUMENT_CATEGORIES.flatMap(c =>
  c.docs.map(d => ({ key: d.key, label: d.label, required: d.required }))
)

export type AppointmentDocumentKey = string
