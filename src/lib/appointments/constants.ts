export const TIMEZONE = 'America/Denver'

/** Días de penalización por no_show o cancelación tardía */
export const PENALTY_DAYS = 7

/** Horas mínimas de anticipación para cancelar sin penalización */
export const MIN_CANCEL_HOURS = 24

/** Documentos requeridos para la cita */
export const APPOINTMENT_DOCUMENT_KEYS = [
  {
    key: 'tutor_id',
    label: 'Pasaporte o ID del Tutor',
    required: true,
  },
  {
    key: 'minor_id',
    label: 'Pasaporte o ID de Menores',
    required: true,
  },
  {
    key: 'birth_certificates',
    label: 'Actas de Nacimiento de Menores',
    required: true,
  },
  {
    key: 'lease_or_utility',
    label: 'Contrato de Arrendamiento o Factura de Servicio',
    required: true,
  },
  {
    key: 'supporting_docs',
    label: 'Documentos Sustentatorios',
    required: true,
  },
  {
    key: 'tax_declaration',
    label: 'Declaración de Taxes',
    required: false,
  },
  {
    key: 'school_proof',
    label: 'Prueba Domiciliaria Escolar',
    required: false,
  },
] as const

export type AppointmentDocumentKey = typeof APPOINTMENT_DOCUMENT_KEYS[number]['key']
