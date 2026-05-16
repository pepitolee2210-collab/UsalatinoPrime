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

const ROWS_COUNT_OPTIONS = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
]

/**
 * Construye una sección por hijo (1..4), visible si `children_count` >= N.
 * Cada sección agrupa los datos USCIS que el PDF I-589 espera por hijo:
 * nombre, fecha de nacimiento, ciudad/país, nacionalidad, A-Number,
 * pasaporte, SSN, estado civil, sexo.
 *
 * showIf usa `equals: [...]` con todos los valores ≥ N: el wizard ya
 * soporta arrays en `equals`, así no necesitamos extender el engine.
 */
function buildChildSections(): I589Section[] {
  const out: I589Section[] = []
  for (let n = 1; n <= 4; n++) {
    const valuesGte = ['5+'] as string[]
    for (let v = n; v <= 4; v++) valuesGte.push(String(v))
    const showIf = { key: 'children_count', equals: valuesGte }

    out.push({
      title: `Hijo ${n}`,
      description:
        n === 1
          ? 'Datos del primer hijo. Todos los campos van directo al PDF oficial.'
          : `Datos del hijo ${n}. Se muestran porque indicaste tener ${n} o más hijos.`,
      fields: [
        { key: `child_${n}_last_name`, label: 'Apellido', type: 'text', showIf },
        { key: `child_${n}_first_name`, label: 'Nombre', type: 'text', showIf },
        { key: `child_${n}_middle_name`, label: 'Segundo nombre', type: 'text', showIf },
        { key: `child_${n}_dob`, label: 'Fecha de nacimiento', type: 'date', showIf },
        { key: `child_${n}_city_of_birth`, label: 'Ciudad de nacimiento', type: 'text', showIf },
        { key: `child_${n}_nationality`, label: 'Nacionalidad', type: 'country', showIf },
        { key: `child_${n}_alien_number`, label: 'Número A (si tiene)', type: 'a_number', showIf },
        { key: `child_${n}_passport`, label: 'Número de pasaporte (si tiene)', type: 'text', showIf },
        { key: `child_${n}_ssn`, label: 'SSN (si tiene)', type: 'ssn', showIf },
        {
          key: `child_${n}_marital_status`,
          label: 'Estado civil',
          type: 'select',
          options: MARITAL_OPTIONS,
          showIf,
        },
        {
          key: `child_${n}_gender`,
          label: 'Sexo',
          type: 'select',
          options: SEX_OPTIONS,
          showIf,
        },
      ],
    })
  }
  return out
}

/**
 * Construye 5 secciones de residencias (residence_1..5). La primera
 * (residence_1) es siempre visible cuando el usuario indica ≥ 1 fila.
 * El usuario selecciona cuántas filas con `residence_count` (1-5).
 */
function buildResidenceSections(): I589Section[] {
  const out: I589Section[] = []
  for (let n = 1; n <= 5; n++) {
    const valuesGte: string[] = []
    for (let v = n; v <= 5; v++) valuesGte.push(String(v))
    const showIf = { key: 'residence_count', equals: valuesGte }

    out.push({
      title: `Residencia ${n}`,
      description: n === 1
        ? 'Tu residencia actual en EE.UU. (más reciente).'
        : `Residencia anterior ${n - 1}. Lista desde la más reciente.`,
      fields: [
        { key: `residence_${n}_street`, label: 'Calle y número', type: 'text', showIf },
        { key: `residence_${n}_city`, label: 'Ciudad', type: 'text', showIf },
        {
          key: `residence_${n}_state`,
          label: 'Estado / Departamento / Provincia',
          type: 'text',
          showIf,
        },
        { key: `residence_${n}_country`, label: 'País', type: 'country', showIf },
        {
          key: `residence_${n}_from`,
          label: 'Desde (mes/año)',
          type: 'text',
          placeholder: '03/2018',
          showIf,
        },
        {
          key: `residence_${n}_to`,
          label: 'Hasta (mes/año)',
          type: 'text',
          placeholder: '01/2024',
          showIf,
        },
      ],
    })
  }
  return out
}

/**
 * Construye 5 secciones de empleos (employment_1..5).
 */
function buildEmploymentSections(): I589Section[] {
  const out: I589Section[] = []
  for (let n = 1; n <= 5; n++) {
    const valuesGte: string[] = []
    for (let v = n; v <= 5; v++) valuesGte.push(String(v))
    const showIf = { key: 'employment_count', equals: valuesGte }

    out.push({
      title: `Empleo ${n}`,
      description: n === 1
        ? 'Tu empleo más reciente (o actual).'
        : `Empleo anterior ${n - 1}.`,
      fields: [
        {
          key: `employment_${n}_employer`,
          label: 'Nombre y dirección del empleador',
          help: 'Ej: Restaurant ABC, 123 Main St, Houston TX',
          type: 'textarea',
          showIf,
        },
        {
          key: `employment_${n}_occupation`,
          label: 'Tu ocupación / cargo',
          type: 'text',
          showIf,
        },
        {
          key: `employment_${n}_from`,
          label: 'Desde (mes/año)',
          type: 'text',
          placeholder: '03/2020',
          showIf,
        },
        {
          key: `employment_${n}_to`,
          label: 'Hasta (mes/año)',
          type: 'text',
          placeholder: 'Presente o 01/2024',
          showIf,
        },
      ],
    })
  }
  return out
}

/**
 * Construye 5 secciones de educación (education_1..5).
 */
function buildEducationSections(): I589Section[] {
  const out: I589Section[] = []
  for (let n = 1; n <= 5; n++) {
    const valuesGte: string[] = []
    for (let v = n; v <= 5; v++) valuesGte.push(String(v))
    const showIf = { key: 'education_count', equals: valuesGte }

    out.push({
      title: `Educación ${n}`,
      description: n === 1
        ? 'La escuela/institución más reciente a la que asististe.'
        : `Educación anterior ${n - 1}.`,
      fields: [
        {
          key: `education_${n}_school`,
          label: 'Nombre de la escuela / institución',
          type: 'text',
          showIf,
        },
        {
          key: `education_${n}_type`,
          label: 'Tipo de escuela',
          help: 'Ej: Primaria, Secundaria, Universidad, Curso técnico',
          type: 'text',
          showIf,
        },
        {
          key: `education_${n}_location`,
          label: 'Ubicación (ciudad, país)',
          type: 'text',
          showIf,
        },
        {
          key: `education_${n}_from`,
          label: 'Desde (mes/año)',
          type: 'text',
          placeholder: '03/2010',
          showIf,
        },
        {
          key: `education_${n}_to`,
          label: 'Hasta (mes/año)',
          type: 'text',
          placeholder: '11/2015',
          showIf,
        },
      ],
    })
  }
  return out
}

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
          'Cuéntanos cuántos hijos tienes. Si tienes hasta 4, te pediremos los datos de cada uno (USCIS los requiere).',
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
              'Incluye hijos en cualquier país, biológicos o adoptados. Si tienes más de 4, los datos extra los completará Diana en una sesión guiada.',
            type: 'select',
            options: [
              { value: '1', label: '1' },
              { value: '2', label: '2' },
              { value: '3', label: '3' },
              { value: '4', label: '4' },
              { value: '5+', label: '5 o más' },
            ],
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
      ...buildChildSections(),
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
        title: 'Residencias últimos 5 años',
        description:
          '¿En cuántos lugares has vivido en los últimos 5 años? Empieza por el más reciente. Cada uno va a una fila del PDF oficial.',
        fields: [
          {
            key: 'residence_count',
            label: '¿Cuántas residencias quieres listar?',
            type: 'select',
            options: ROWS_COUNT_OPTIONS,
            required: true,
          },
        ],
      },
      ...buildResidenceSections(),
      {
        title: 'Empleos últimos 5 años',
        description:
          '¿En cuántos lugares has trabajado en los últimos 5 años? Empieza por el más reciente.',
        fields: [
          {
            key: 'employment_count',
            label: '¿Cuántos empleos quieres listar?',
            type: 'select',
            options: ROWS_COUNT_OPTIONS,
            required: true,
          },
        ],
      },
      ...buildEmploymentSections(),
      {
        title: 'Educación',
        description:
          '¿En cuántas escuelas/instituciones estudiaste? Empieza por la más reciente.',
        fields: [
          {
            key: 'education_count',
            label: '¿Cuántas escuelas quieres listar?',
            type: 'select',
            options: ROWS_COUNT_OPTIONS,
            required: true,
          },
        ],
      },
      ...buildEducationSections(),
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
