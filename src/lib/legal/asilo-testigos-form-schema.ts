// Formulario "Cartas de Testigos" — captura estructurada de los testigos que
// corroboran el caso de Asilo Político (Fase 2 = `asilo_reforzar`) o del
// servicio standalone `reforzar-asilo`.
//
// El cliente llena este formulario en la pestaña Formularios de su portal
// (/cita/[token]). Reemplaza el upload del documento libre de testigo
// (`asylum_witness_affidavit_uploaded`) por datos estructurados.
//
// El JSON se persiste en `case_form_instances.filled_values` con
// `form_name='asilo_testigos_carta'`, en la forma `{ witnesses: WitnessLetterValue[] }`.
// Luego Diana genera, desde el dashboard, una declaración jurada de testigo en
// inglés (Claude Opus 4.7) lista para descargar en PDF, firmar y notarizar.
//
// Las preguntas se derivan de la guía legal para witness affidavits de asilo
// afirmativo: identificación del testigo, relación con el solicitante,
// conocimiento PERSONAL de la persecución (qué presenció directamente),
// evidencia de daño, riesgo futuro y disposición a declarar bajo juramento.

import { z } from 'zod'

export const WITNESS_FORM_SLUG = 'asilo_testigos_carta'
export const WITNESS_FORM_VERSION = '2026-06-03-v1'

// ──────────────────────────────────────────────────────────────────
// Valor persistido por testigo
// ──────────────────────────────────────────────────────────────────

export interface WitnessLetterValue {
  // Sección 1 — Identificación del testigo
  full_name?: string
  date_of_birth?: string
  birth_place?: string
  nationality?: string
  id_type?: string
  id_number?: string
  current_residence?: string
  occupation?: string
  location_now?: string
  declaration_language?: string
  // Sección 2 — Relación con el solicitante
  relationship?: string
  known_since?: string
  relationship_detail?: string
  // Sección 3 — Lo que presenció (conocimiento personal)
  witnessed_events?: string
  events_when?: string
  events_where?: string
  perpetrators?: string
  why_targeted?: string
  physical_harm_seen?: string
  emotional_impact_seen?: string
  // Sección 4 — Riesgo futuro / condiciones del país
  future_risk?: string
  country_conditions_knowledge?: string
  // Sección 5 — Logística
  willing_to_swear?: boolean
  contact_info?: string
}

export type WitnessLetterAnswers = {
  witnesses: WitnessLetterValue[]
}

// ──────────────────────────────────────────────────────────────────
// Definición de campos (para renderizar el repeater)
// ──────────────────────────────────────────────────────────────────

export type WitnessFieldType = 'text' | 'textarea' | 'date' | 'select' | 'checkbox'

export interface WitnessFieldOption {
  value: string
  labelEs: string
}

export interface WitnessField {
  key: keyof WitnessLetterValue
  type: WitnessFieldType
  labelEs: string
  helpEs?: string
  required?: boolean
  placeholderEs?: string
  maxLength?: number
  options?: WitnessFieldOption[]
}

export interface WitnessSection {
  id: string
  titleEs: string
  descriptionEs?: string
  icon: string
  fields: WitnessField[]
}

const ID_TYPE_OPTIONS: WitnessFieldOption[] = [
  { value: 'pasaporte', labelEs: 'Pasaporte' },
  { value: 'cedula', labelEs: 'Cédula de identidad' },
  { value: 'dni', labelEs: 'DNI' },
  { value: 'licencia', labelEs: 'Licencia de conducir' },
  { value: 'otro', labelEs: 'Otro documento' },
]

const LOCATION_OPTIONS: WitnessFieldOption[] = [
  { value: 'us', labelEs: 'En Estados Unidos' },
  { value: 'abroad', labelEs: 'En el extranjero (país de origen u otro)' },
]

const RELATIONSHIP_OPTIONS: WitnessFieldOption[] = [
  { value: 'familiar', labelEs: 'Familiar' },
  { value: 'pareja', labelEs: 'Cónyuge o pareja' },
  { value: 'vecino', labelEs: 'Vecino(a)' },
  { value: 'amigo', labelEs: 'Amigo(a) cercano(a)' },
  { value: 'colega', labelEs: 'Colega o compañero(a) de trabajo' },
  { value: 'lider_religioso', labelEs: 'Líder religioso (pastor, sacerdote, etc.)' },
  { value: 'activismo', labelEs: 'Compañero(a) de activismo, partido o sindicato' },
  { value: 'profesional', labelEs: 'Profesional que lo atendió (médico, abogado, etc.)' },
  { value: 'otro', labelEs: 'Otro' },
]

const LANGUAGE_OPTIONS: WitnessFieldOption[] = [
  { value: 'es', labelEs: 'Español' },
  { value: 'en', labelEs: 'Inglés' },
  { value: 'otro', labelEs: 'Otro idioma' },
]

export const WITNESS_FORM_SECTIONS: WitnessSection[] = [
  {
    id: 'identificacion',
    titleEs: 'Identificación del testigo',
    descriptionEs: 'Datos para identificar al testigo ante USCIS. Si no conoces algún dato, déjalo en blanco — tu equipo legal lo completará.',
    icon: 'badge',
    fields: [
      { key: 'full_name', type: 'text', labelEs: 'Nombre completo del testigo', required: true },
      { key: 'date_of_birth', type: 'date', labelEs: 'Fecha de nacimiento' },
      { key: 'birth_place', type: 'text', labelEs: 'Lugar de nacimiento (ciudad, país)' },
      { key: 'nationality', type: 'text', labelEs: 'Nacionalidad', required: true },
      { key: 'id_type', type: 'select', labelEs: 'Tipo de documento de identidad', options: ID_TYPE_OPTIONS },
      { key: 'id_number', type: 'text', labelEs: 'Número del documento', helpEs: 'Número de pasaporte, cédula o DNI del testigo.' },
      { key: 'current_residence', type: 'text', labelEs: 'Dónde vive actualmente (país y ciudad)' },
      { key: 'occupation', type: 'text', labelEs: 'Ocupación o profesión' },
      { key: 'location_now', type: 'select', labelEs: '¿Dónde se encuentra el testigo ahora?', options: LOCATION_OPTIONS },
      { key: 'declaration_language', type: 'select', labelEs: 'Idioma en que el testigo declara', helpEs: 'La carta se redactará en inglés; si declara en otro idioma se prepara con traducción.', options: LANGUAGE_OPTIONS },
    ],
  },
  {
    id: 'relacion',
    titleEs: 'Relación con el solicitante',
    descriptionEs: 'Cómo conoce el testigo a la persona que pide asilo.',
    icon: 'handshake',
    fields: [
      { key: 'relationship', type: 'select', labelEs: '¿Cómo conoce al solicitante?', required: true, options: RELATIONSHIP_OPTIONS },
      { key: 'known_since', type: 'text', labelEs: '¿Desde cuándo lo conoce?', required: true, placeholderEs: 'Ej. desde 2015, o "hace 10 años"' },
      { key: 'relationship_detail', type: 'textarea', labelEs: 'Describe la relación', helpEs: 'Qué tan cercana es, cómo se conocieron, con qué frecuencia se veían.', maxLength: 1500 },
    ],
  },
  {
    id: 'presencio',
    titleEs: 'Lo que el testigo presenció',
    descriptionEs: 'El corazón de la carta. Importa lo que el testigo vio o vivió DIRECTAMENTE (no lo que le contaron).',
    icon: 'visibility',
    fields: [
      { key: 'witnessed_events', type: 'textarea', labelEs: '¿Qué hechos de persecución, amenazas o daño presenció directamente?', required: true, helpEs: 'Describe con detalle lo que el testigo vio con sus propios ojos: agresiones, amenazas, detenciones, allanamientos, etc.', maxLength: 4000 },
      { key: 'events_when', type: 'text', labelEs: '¿Cuándo ocurrieron?', placeholderEs: 'Fechas o periodo aproximado' },
      { key: 'events_where', type: 'text', labelEs: '¿Dónde ocurrieron?' },
      { key: 'perpetrators', type: 'textarea', labelEs: '¿Quién(es) fueron los responsables?', helpEs: 'Nombres si los sabe, o descripción (policía, militares, grupo armado, pandilla, etc.).', maxLength: 1500 },
      { key: 'why_targeted', type: 'textarea', labelEs: '¿Por qué cree el testigo que atacaron al solicitante?', helpEs: 'Por su raza, religión, opinión política, nacionalidad o grupo social.', maxLength: 1500 },
      { key: 'physical_harm_seen', type: 'textarea', labelEs: '¿El testigo vio señales de daño físico?', helpEs: 'Heridas, hospitalización, marcas, ropa rota. Describe lo que vio.', maxLength: 1500 },
      { key: 'emotional_impact_seen', type: 'textarea', labelEs: '¿El testigo observó el impacto emocional en el solicitante?', helpEs: 'Miedo, llanto, ansiedad, cambios de conducta.', maxLength: 1500 },
    ],
  },
  {
    id: 'riesgo',
    titleEs: 'Riesgo si regresa (opcional)',
    descriptionEs: 'Si el testigo conoce el peligro actual o la situación del país, ayuda mucho.',
    icon: 'shield',
    fields: [
      { key: 'future_risk', type: 'textarea', labelEs: '¿El testigo sabe si el solicitante seguiría en peligro si regresa? ¿Por qué?', maxLength: 2000 },
      { key: 'country_conditions_knowledge', type: 'textarea', labelEs: '¿Conoce hechos sobre la situación del país relevantes al caso?', maxLength: 2000 },
    ],
  },
  {
    id: 'logistica',
    titleEs: 'Disposición del testigo',
    icon: 'task_alt',
    fields: [
      { key: 'willing_to_swear', type: 'checkbox', labelEs: 'El testigo está dispuesto(a) a firmar la declaración bajo juramento (y notarizarla si es posible).' },
      { key: 'contact_info', type: 'text', labelEs: 'Información de contacto del testigo (opcional)', helpEs: 'Teléfono o correo electrónico.' },
    ],
  },
]

/** Campos mínimos para considerar a un testigo "completo" / utilizable. */
export const WITNESS_REQUIRED_KEYS: (keyof WitnessLetterValue)[] = [
  'full_name',
  'nationality',
  'relationship',
  'known_since',
  'witnessed_events',
]

// ──────────────────────────────────────────────────────────────────
// Schema Zod (validación servidor)
// ──────────────────────────────────────────────────────────────────

export const witnessLetterSchema = z.object({
  full_name: z.string().optional(),
  date_of_birth: z.string().optional(),
  birth_place: z.string().optional(),
  nationality: z.string().optional(),
  id_type: z.string().optional(),
  id_number: z.string().optional(),
  current_residence: z.string().optional(),
  occupation: z.string().optional(),
  location_now: z.string().optional(),
  declaration_language: z.string().optional(),
  relationship: z.string().optional(),
  known_since: z.string().optional(),
  relationship_detail: z.string().optional(),
  witnessed_events: z.string().optional(),
  events_when: z.string().optional(),
  events_where: z.string().optional(),
  perpetrators: z.string().optional(),
  why_targeted: z.string().optional(),
  physical_harm_seen: z.string().optional(),
  emotional_impact_seen: z.string().optional(),
  future_risk: z.string().optional(),
  country_conditions_knowledge: z.string().optional(),
  willing_to_swear: z.boolean().optional(),
  contact_info: z.string().optional(),
})

export const witnessLetterAnswersSchema = z.object({
  witnesses: z.array(witnessLetterSchema).max(20),
})

// ──────────────────────────────────────────────────────────────────
// Helpers de progreso
// ──────────────────────────────────────────────────────────────────

function hasValue(v: unknown): boolean {
  if (v === null || v === undefined) return false
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') return v.trim().length > 0
  return false
}

export function isWitnessComplete(w: WitnessLetterValue): boolean {
  return WITNESS_REQUIRED_KEYS.every((k) => hasValue(w[k]))
}

export interface WitnessProgress {
  witnessCount: number
  completeWitnesses: number
  totalRequired: number
  answeredRequired: number
  pct: number
}

/**
 * Progreso del formulario: cuenta los campos obligatorios respondidos a lo
 * largo de todos los testigos. Sin testigos → 0 % (la card muestra "opcional").
 */
export function calculateWitnessProgress(witnesses: WitnessLetterValue[]): WitnessProgress {
  let total = 0
  let answered = 0
  let completeWitnesses = 0
  for (const w of witnesses) {
    let allHere = true
    for (const k of WITNESS_REQUIRED_KEYS) {
      total++
      if (hasValue(w[k])) answered++
      else allHere = false
    }
    if (allHere) completeWitnesses++
  }
  const pct = total === 0 ? 0 : Math.round((answered / total) * 100)
  return {
    witnessCount: witnesses.length,
    completeWitnesses,
    totalRequired: total,
    answeredRequired: answered,
    pct,
  }
}

/** Extrae el array de testigos de un `filled_values` arbitrario, de forma segura. */
export function readWitnesses(filledValues: unknown): WitnessLetterValue[] {
  if (filledValues && typeof filledValues === 'object' && !Array.isArray(filledValues)) {
    const arr = (filledValues as { witnesses?: unknown }).witnesses
    if (Array.isArray(arr)) return arr as WitnessLetterValue[]
  }
  return []
}
