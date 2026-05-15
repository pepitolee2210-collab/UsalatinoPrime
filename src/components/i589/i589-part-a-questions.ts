/**
 * Definición declarativa de las preguntas del Form I-589 — Parte A
 * (páginas 1 a 4 del formulario USCIS).
 *
 * Cubre 4 secciones que el cliente llena en Fase 1 (Sustentos):
 *   - a1: Información Personal del solicitante (página 1)
 *   - a2: Información de Inmigración / Estatus (página 2)
 *   - a3: Información de Cónyuge e Hijos (página 3)
 *   - a4: Historial de Residencia, Empleo y Educación (página 4)
 *
 * Las páginas 5-14 (Parte B "motivos de persecución" + Parte C "preguntas
 * adicionales") las llena Diana con asistencia de la IA del Miedo Creíble
 * en Fase 2 — el cliente NO las responde directamente.
 *
 * IMPORTANTE: los `key` de cada pregunta deben coincidir con los nombres
 * de field del PDF AcroForm I-589 cuando Diana imprima el formulario.
 * Por ahora el cliente solo guarda el data en `case_form_submissions` —
 * el mapeo al PDF se hará en una iteración posterior.
 */

export type FieldType =
  | 'text'
  | 'textarea'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'yesno'
  | 'phone'
  | 'email'
  | 'ssn'
  | 'a_number'
  | 'us_state'
  | 'country'

export interface I589Field {
  key: string
  label: string
  help?: string
  placeholder?: string
  type: FieldType
  options?: { value: string; label: string }[]
  required?: boolean
  /** Visible solo si otro campo cumple condición. */
  showIf?: { key: string; equals: string | string[] }
}

export interface I589Section {
  title: string
  description?: string
  fields: I589Field[]
}

export interface I589Step {
  /** ID de la sección Parte A. Se mapea a form_type en case_form_submissions. */
  id: 'a1' | 'a2' | 'a3' | 'a4'
  number: string
  title: string
  intro: string
  sections: I589Section[]
}

const SEX_OPTIONS = [
  { value: 'Masculino', label: 'Masculino' },
  { value: 'Femenino', label: 'Femenino' },
]

const MARITAL_OPTIONS = [
  { value: 'Soltero/a', label: 'Soltero/a' },
  { value: 'Casado/a', label: 'Casado/a' },
  { value: 'Divorciado/a', label: 'Divorciado/a' },
  { value: 'Viudo/a', label: 'Viudo/a' },
]

const ENTRY_STATUS_OPTIONS = [
  { value: 'B-1/B-2', label: 'Visa de turista (B-1/B-2)' },
  { value: 'F-1', label: 'Visa de estudiante (F-1)' },
  { value: 'Trabajo', label: 'Visa de trabajo' },
  { value: 'Parole', label: 'Parole' },
  { value: 'NTA', label: 'NTA (Notice to Appear)' },
  { value: 'Sin inspección', label: 'Sin inspección (cruzó la frontera)' },
  { value: 'TPS', label: 'TPS' },
  { value: 'Otro', label: 'Otro' },
]

export const I589_PART_A_STEPS: I589Step[] = [
  {
    id: 'a1',
    number: 'Página 1',
    title: 'Tu información personal',
    intro:
      'Empezamos con tus datos básicos. Esto identifica al solicitante principal del asilo.',
    sections: [
      {
        title: 'Nombre legal',
        fields: [
          { key: 'legal_last_name', label: 'Apellido legal', type: 'text', required: true },
          { key: 'legal_first_name', label: 'Nombre legal', type: 'text', required: true },
          { key: 'legal_middle_name', label: 'Segundo nombre', type: 'text' },
          {
            key: 'other_names',
            label: 'Otros nombres usados',
            help: 'Nombres de soltera, alias, apodos legales que figuren en otros documentos.',
            type: 'textarea',
          },
        ],
      },
      {
        title: 'Dirección actual en EE.UU.',
        fields: [
          { key: 'residence_address_street', label: 'Calle y número', type: 'text', required: true },
          { key: 'residence_address_city', label: 'Ciudad', type: 'text', required: true },
          { key: 'residence_address_state', label: 'Estado', type: 'us_state', required: true },
          { key: 'residence_address_zip', label: 'Código postal', type: 'text', required: true },
          { key: 'residence_phone', label: 'Teléfono de contacto', type: 'phone', required: true },
        ],
      },
      {
        title: 'Datos personales',
        fields: [
          { key: 'gender', label: 'Sexo', type: 'select', options: SEX_OPTIONS, required: true },
          {
            key: 'marital_status',
            label: 'Estado civil',
            type: 'select',
            options: MARITAL_OPTIONS,
            required: true,
          },
          { key: 'date_of_birth', label: 'Fecha de nacimiento', type: 'date', required: true },
          { key: 'city_of_birth', label: 'Ciudad de nacimiento', type: 'text', required: true },
          { key: 'country_of_birth', label: 'País de nacimiento', type: 'country', required: true },
          { key: 'nationality', label: 'Nacionalidad actual', type: 'country', required: true },
          {
            key: 'native_language',
            label: 'Idioma nativo',
            type: 'text',
            required: true,
            placeholder: 'Ej: Español',
          },
          {
            key: 'speaks_english',
            label: '¿Hablas inglés con fluidez?',
            type: 'yesno',
            required: true,
          },
        ],
      },
    ],
  },
  {
    id: 'a2',
    number: 'Página 2',
    title: 'Tu situación migratoria',
    intro:
      'Cómo entraste a EE.UU., qué documentos tienes y tu estatus actual.',
    sections: [
      {
        title: 'Entrada a EE.UU.',
        fields: [
          {
            key: 'last_entry_date',
            label: 'Fecha de tu última entrada a EE.UU.',
            help:
              'CRÍTICO: el asilo se solicita dentro del primer año de tu llegada (con excepciones).',
            type: 'date',
            required: true,
          },
          {
            key: 'entry_place',
            label: 'Lugar de entrada',
            placeholder: 'Aeropuerto, puerto o punto fronterizo',
            type: 'text',
            required: true,
          },
          {
            key: 'entry_status',
            label: 'Estatus al entrar',
            type: 'select',
            options: ENTRY_STATUS_OPTIONS,
            required: true,
          },
          {
            key: 'entry_status_other',
            label: 'Especifica el estatus',
            type: 'text',
            showIf: { key: 'entry_status', equals: 'Otro' },
          },
          { key: 'i94_number', label: 'Número I-94 (si tienes)', type: 'text' },
          {
            key: 'status_expires',
            label: 'Fecha de expiración del estatus actual',
            type: 'date',
          },
        ],
      },
      {
        title: 'Pasaporte y documentos',
        fields: [
          { key: 'passport_number', label: 'Número de pasaporte', type: 'text', required: true },
          { key: 'passport_country', label: 'País del pasaporte', type: 'country', required: true },
          {
            key: 'passport_expiry',
            label: 'Fecha de expiración del pasaporte',
            type: 'date',
            required: true,
          },
          {
            key: 'travel_document_number',
            label: 'Número de documento de viaje (si tienes)',
            type: 'text',
          },
        ],
      },
      {
        title: 'Identificación en EE.UU.',
        fields: [
          {
            key: 'a_number',
            label: 'Número A (Alien Number)',
            help: 'Comienza con A seguido de 8 o 9 dígitos. Si no tienes, deja en blanco.',
            type: 'a_number',
          },
          { key: 'ssn', label: 'Número de Seguro Social (SSN, si tienes)', type: 'ssn' },
          {
            key: 'uscis_account',
            label: 'Número de cuenta USCIS online (si tienes)',
            type: 'text',
          },
          {
            key: 'immigration_court_proceedings',
            label: '¿Estás actualmente en proceso ante una Corte de Inmigración?',
            type: 'yesno',
            required: true,
          },
        ],
      },
    ],
  },
  {
    id: 'a3',
    number: 'Página 3',
    title: 'Tu cónyuge e hijos',
    intro:
      'Información de tu familia inmediata. Si vienes solo, marca las opciones correspondientes.',
    sections: [
      {
        title: 'Cónyuge',
        fields: [
          {
            key: 'has_spouse',
            label: '¿Tienes cónyuge actualmente?',
            type: 'yesno',
            required: true,
          },
          {
            key: 'spouse_last_name',
            label: 'Apellido del cónyuge',
            type: 'text',
            showIf: { key: 'has_spouse', equals: 'yes' },
          },
          {
            key: 'spouse_first_name',
            label: 'Nombre del cónyuge',
            type: 'text',
            showIf: { key: 'has_spouse', equals: 'yes' },
          },
          {
            key: 'spouse_dob',
            label: 'Fecha de nacimiento del cónyuge',
            type: 'date',
            showIf: { key: 'has_spouse', equals: 'yes' },
          },
          {
            key: 'spouse_nationality',
            label: 'Nacionalidad del cónyuge',
            type: 'country',
            showIf: { key: 'has_spouse', equals: 'yes' },
          },
          {
            key: 'spouse_in_us',
            label: '¿El cónyuge está en EE.UU.?',
            type: 'yesno',
            showIf: { key: 'has_spouse', equals: 'yes' },
          },
          {
            key: 'spouse_include_in_application',
            label: '¿Incluir al cónyuge en tu solicitud de asilo?',
            help:
              'Marca sí si quieres que tu cónyuge reciba el mismo asilo si se aprueba el tuyo.',
            type: 'yesno',
            showIf: { key: 'has_spouse', equals: 'yes' },
          },
          {
            key: 'marriage_date',
            label: 'Fecha de matrimonio',
            type: 'date',
            showIf: { key: 'has_spouse', equals: 'yes' },
          },
          {
            key: 'marriage_place',
            label: 'Lugar de matrimonio',
            type: 'text',
            showIf: { key: 'has_spouse', equals: 'yes' },
          },
        ],
      },
      {
        title: 'Hijos',
        description:
          'Cuéntanos cuántos hijos tienes. En este formulario solo necesitamos resumen — los datos detallados de cada hijo ya los capturamos en tu contrato.',
        fields: [
          {
            key: 'has_children',
            label: '¿Tienes hijos?',
            type: 'yesno',
            required: true,
          },
          {
            key: 'children_count',
            label: '¿Cuántos hijos tienes en total?',
            help:
              'Incluye hijos en cualquier país, biológicos o adoptados.',
            type: 'text',
            placeholder: 'Ej: 3',
            showIf: { key: 'has_children', equals: 'yes' },
          },
          {
            key: 'children_in_us_count',
            label: '¿Cuántos de ellos están en EE.UU.?',
            type: 'text',
            placeholder: 'Ej: 2',
            showIf: { key: 'has_children', equals: 'yes' },
          },
          {
            key: 'children_include_in_application',
            label: '¿Incluir a tus hijos menores de 21 años solteros en tu solicitud?',
            help:
              'Solo aplica para hijos solteros menores de 21 años. Diana confirmará esto contigo.',
            type: 'yesno',
            showIf: { key: 'has_children', equals: 'yes' },
          },
        ],
      },
    ],
  },
  {
    id: 'a4',
    number: 'Página 4',
    title: 'Tu historial',
    intro:
      'Direcciones donde viviste, lugares donde trabajaste y datos de tus padres. Esta es la sección más larga — tómate tu tiempo.',
    sections: [
      {
        title: 'Última dirección antes de venir a EE.UU.',
        fields: [
          {
            key: 'last_address_before_us_street',
            label: 'Calle y número',
            type: 'text',
            required: true,
          },
          { key: 'last_address_before_us_city', label: 'Ciudad', type: 'text', required: true },
          {
            key: 'last_address_before_us_state',
            label: 'Departamento / Estado / Provincia',
            type: 'text',
          },
          {
            key: 'last_address_before_us_country',
            label: 'País',
            type: 'country',
            required: true,
          },
          {
            key: 'last_address_before_us_from',
            label: 'Desde (mes/año)',
            type: 'text',
            placeholder: '03/2018',
          },
          {
            key: 'last_address_before_us_to',
            label: 'Hasta (mes/año)',
            type: 'text',
            placeholder: '01/2024',
          },
        ],
      },
      {
        title: 'Resumen de últimos 5 años',
        description:
          'Aquí pedimos solo un resumen — Diana llenará los detalles contigo en una sesión guiada.',
        fields: [
          {
            key: 'residences_summary',
            label: 'Resumen de las direcciones donde viviste en los últimos 5 años',
            help: 'Lista cada lugar con ciudad, país y fechas aproximadas.',
            type: 'textarea',
          },
          {
            key: 'employment_summary',
            label: 'Resumen de tus empleos en los últimos 5 años',
            help: 'Empleador, cargo, ciudad/país, fechas aproximadas.',
            type: 'textarea',
          },
          {
            key: 'education_summary',
            label: 'Resumen de tu educación',
            help: 'Escuelas, institutos, universidades. Tipo de estudio y fechas.',
            type: 'textarea',
          },
        ],
      },
      {
        title: 'Tus padres',
        fields: [
          { key: 'mother_name', label: 'Nombre completo de tu madre', type: 'text', required: true },
          {
            key: 'mother_country_of_birth',
            label: 'País de nacimiento de tu madre',
            type: 'country',
            required: true,
          },
          {
            key: 'mother_deceased',
            label: '¿Tu madre ha fallecido?',
            type: 'yesno',
            required: true,
          },
          {
            key: 'mother_current_location',
            label: 'Ubicación actual de tu madre',
            type: 'text',
            showIf: { key: 'mother_deceased', equals: 'no' },
          },
          { key: 'father_name', label: 'Nombre completo de tu padre', type: 'text', required: true },
          {
            key: 'father_country_of_birth',
            label: 'País de nacimiento de tu padre',
            type: 'country',
            required: true,
          },
          {
            key: 'father_deceased',
            label: '¿Tu padre ha fallecido?',
            type: 'yesno',
            required: true,
          },
          {
            key: 'father_current_location',
            label: 'Ubicación actual de tu padre',
            type: 'text',
            showIf: { key: 'father_deceased', equals: 'no' },
          },
        ],
      },
    ],
  },
]

/** Total de campos visibles en el wizard (no condicionales — siempre cuentan). */
export const TOTAL_I589_PART_A_FIELDS = I589_PART_A_STEPS.flatMap((s) =>
  s.sections.flatMap((sec) => sec.fields),
).length

/** Cuenta cuántos campos llenos hay en los 4 parts. */
export function countI589PartAFilledFields(parts: {
  a1?: Record<string, unknown> | null
  a2?: Record<string, unknown> | null
  a3?: Record<string, unknown> | null
  a4?: Record<string, unknown> | null
}): number {
  let count = 0
  for (const step of I589_PART_A_STEPS) {
    const data = (parts[step.id] ?? {}) as Record<string, unknown>
    for (const sec of step.sections) {
      for (const f of sec.fields) {
        const v = data[f.key]
        if (v !== undefined && v !== null && String(v).trim() !== '') count++
      }
    }
  }
  return count
}

export type I589PartId = I589Step['id']
export const I589_FORM_TYPES: Record<I589PartId, string> = {
  a1: 'i589_part_a1',
  a2: 'i589_part_a2',
  a3: 'i589_part_a3',
  a4: 'i589_part_a4',
}
