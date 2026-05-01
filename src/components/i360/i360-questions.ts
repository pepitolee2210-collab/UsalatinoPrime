/**
 * Definición declarativa de las preguntas del Form I-360 SIJS.
 *
 * Reemplaza el copy técnico/legal del wizard antiguo (`i360-wizard.tsx`)
 * con preguntas en lenguaje claro, empático y de 5to grado, con tooltips
 * para términos legales (A-Number, I-94, HHS, ORR).
 *
 * IMPORTANTE: los `key` de cada pregunta son los MISMOS keys que el
 * generador PDF (`src/lib/pdf/i360/generate-i360.ts`) espera. NO renombrar
 * sin actualizar el mapper del PDF.
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
  | 'voice_textarea'

export interface I360Field {
  key: string
  label: string
  help?: string
  placeholder?: string
  type: FieldType
  options?: { value: string; label: string }[]
  required?: boolean
  prefillFrom?: 'tutor' | 'minor_basic' | 'absent_parent'
  /** Visible solo si otro campo cumple condición. */
  showIf?: { key: string; equals: string | string[] }
}

export interface I360Section {
  title: string
  description?: string
  fields: I360Field[]
}

export interface I360Step {
  id: string
  number: string
  title: string
  intro: string
  sections: I360Section[]
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

const REUNIFICATION_REASONS = [
  { value: 'abuso', label: 'Abuso (físico, emocional, sexual)' },
  { value: 'negligencia', label: 'Negligencia (descuido, no recibió cuidado adecuado)' },
  { value: 'abandono', label: 'Abandono (los padres dejaron de cuidar al menor)' },
  { value: 'similar', label: 'Otra causa similar bajo la ley estatal' },
]

const PLACEMENT_REASON_OPTIONS = [
  { value: 'adopted', label: 'Fue adoptado o tiene un guardián permanente' },
  { value: 'aged_out', label: 'Cumplió 18 años y ya no aplica la corte juvenil' },
  { value: 'other', label: 'Otra razón' },
]

const LANGUAGE_OPTIONS = [
  { value: 'Español', label: 'Español' },
  { value: 'Inglés', label: 'Inglés' },
  { value: 'Portugués', label: 'Portugués' },
  { value: 'Otro', label: 'Otro idioma' },
]

export const I360_STEPS: I360Step[] = [
  // ─────────────────────────────────────────────────────────────────
  // STEP 1 — PETITIONER (Tutor)
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'petitioner',
    number: 'Paso 1 de 6',
    title: 'Datos del tutor',
    intro:
      'Información de la persona que presenta esta petición ante USCIS. ' +
      'Algunos campos vienen pre-llenados de tu historia. Verifica que sean correctos.',
    sections: [
      {
        title: 'Nombre completo del tutor',
        fields: [
          {
            key: 'petitioner_last_name',
            label: 'Apellido(s)',
            type: 'text',
            required: true,
            prefillFrom: 'tutor',
            placeholder: 'Apellido paterno y materno',
          },
          {
            key: 'petitioner_first_name',
            label: 'Nombre(s)',
            type: 'text',
            required: true,
            prefillFrom: 'tutor',
            placeholder: 'Primer y segundo nombre',
          },
          {
            key: 'petitioner_middle_name',
            label: 'Inicial del segundo nombre',
            help: 'Solo si tiene un segundo nombre. Ejemplo: si se llama "María Elena", aquí va "E".',
            type: 'text',
            placeholder: 'Solo si aplica',
          },
        ],
      },
      {
        title: 'Identificación del tutor',
        description: 'Si no tiene alguno de estos números, déjalo en blanco.',
        fields: [
          {
            key: 'petitioner_ssn',
            label: 'Número de Seguro Social (SSN)',
            help: 'Es un número de 9 dígitos emitido por el gobierno de EE.UU. Solo tienes uno si trabajas legalmente en el país.',
            type: 'ssn',
            placeholder: '123-45-6789',
          },
          {
            key: 'petitioner_a_number',
            label: 'Número de Extranjero (A-Number)',
            help: 'Empieza con "A" seguido de 8 o 9 dígitos. Solo aplica si ya tienes un proceso de inmigración abierto.',
            type: 'a_number',
            placeholder: 'A-12345678',
          },
        ],
      },
      {
        title: 'Dirección donde vive el tutor',
        fields: [
          {
            key: 'petitioner_address',
            label: 'Calle, número y apartamento',
            type: 'text',
            required: true,
            prefillFrom: 'tutor',
            placeholder: 'Ej: 123 Main St Apt 4',
          },
          {
            key: 'petitioner_city',
            label: 'Ciudad',
            type: 'text',
            required: true,
            placeholder: 'Ciudad donde vive',
          },
          {
            key: 'petitioner_state',
            label: 'Estado',
            type: 'us_state',
            required: true,
          },
          {
            key: 'petitioner_zip',
            label: 'Código postal (ZIP)',
            type: 'text',
            required: true,
            placeholder: '5 dígitos',
          },
        ],
      },
      {
        title: 'Dirección segura para correo (opcional)',
        description:
          'Si NO quieres que USCIS envíe cartas a tu casa, escribe aquí otra dirección donde puedas recibir correo seguro. Si no aplica, deja todo en blanco.',
        fields: [
          {
            key: 'safe_mailing_name',
            label: '¿A nombre de quién?',
            type: 'text',
            placeholder: 'Ej: A nombre de Juan Pérez',
          },
          { key: 'safe_mailing_address', label: 'Calle y número', type: 'text', placeholder: 'Calle alternativa' },
          { key: 'safe_mailing_city', label: 'Ciudad', type: 'text' },
          { key: 'safe_mailing_state', label: 'Estado', type: 'us_state' },
          { key: 'safe_mailing_zip', label: 'Código postal', type: 'text' },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // STEP 2 — BENEFICIARY (Menor)
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'beneficiary',
    number: 'Paso 2 de 6',
    title: 'Datos del menor',
    intro:
      'Información del menor que recibirá la visa SIJS. La mayoría de campos vienen pre-llenados de tu historia.',
    sections: [
      {
        title: 'Nombre del menor',
        fields: [
          {
            key: 'beneficiary_last_name',
            label: 'Apellido(s)',
            type: 'text',
            required: true,
            prefillFrom: 'minor_basic',
          },
          {
            key: 'beneficiary_first_name',
            label: 'Nombre(s)',
            type: 'text',
            required: true,
            prefillFrom: 'minor_basic',
          },
          {
            key: 'beneficiary_middle_name',
            label: 'Inicial del segundo nombre',
            type: 'text',
          },
          {
            key: 'other_names',
            label: '¿El menor ha usado otros nombres? (alias, apodos, nombres anteriores)',
            help: 'Si el menor SIEMPRE ha usado el mismo nombre, escribe "Ninguno".',
            type: 'text',
            placeholder: 'Ej: Ninguno / María García',
          },
        ],
      },
      {
        title: 'Dónde vive el menor actualmente',
        fields: [
          { key: 'beneficiary_address', label: 'Calle, número y apartamento', type: 'text', prefillFrom: 'minor_basic' },
          { key: 'beneficiary_city', label: 'Ciudad', type: 'text' },
          { key: 'beneficiary_state', label: 'Estado', type: 'us_state' },
          { key: 'beneficiary_zip', label: 'Código postal', type: 'text' },
        ],
      },
      {
        title: 'Nacimiento del menor',
        fields: [
          {
            key: 'beneficiary_dob',
            label: 'Fecha de nacimiento',
            type: 'date',
            required: true,
            prefillFrom: 'minor_basic',
          },
          {
            key: 'beneficiary_country_birth',
            label: 'País donde nació',
            type: 'country',
            required: true,
            prefillFrom: 'minor_basic',
          },
          {
            key: 'beneficiary_city_birth',
            label: 'Ciudad donde nació',
            type: 'text',
            prefillFrom: 'minor_basic',
          },
        ],
      },
      {
        title: 'Características del menor',
        fields: [
          {
            key: 'beneficiary_sex',
            label: 'Sexo',
            type: 'select',
            options: SEX_OPTIONS,
            required: true,
          },
          {
            key: 'beneficiary_marital_status',
            label: 'Estado civil',
            type: 'select',
            options: MARITAL_OPTIONS,
            required: true,
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // STEP 3 — IMMIGRATION HISTORY
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'immigration',
    number: 'Paso 3 de 6',
    title: 'Historia migratoria',
    intro:
      'Información sobre cómo entró el menor a EE.UU. y su situación migratoria. Si no sabes algún dato exacto, déjalo en blanco — tu equipo legal te puede ayudar.',
    sections: [
      {
        title: 'Documentos del menor',
        fields: [
          {
            key: 'beneficiary_ssn',
            label: 'Número de Seguro Social del menor (si tiene)',
            type: 'ssn',
            placeholder: '123-45-6789',
          },
          {
            key: 'beneficiary_a_number',
            label: 'A-Number del menor (si tiene)',
            help: 'Es un número que empieza con "A" emitido por inmigración. Si nunca ha tenido proceso, déjalo en blanco.',
            type: 'a_number',
            placeholder: 'A-12345678',
            prefillFrom: 'minor_basic',
          },
        ],
      },
      {
        title: 'Pasaporte del menor',
        fields: [
          { key: 'beneficiary_passport_number', label: 'Número de pasaporte', type: 'text', prefillFrom: 'minor_basic' },
          { key: 'beneficiary_passport_country', label: 'País que emitió el pasaporte', type: 'country' },
          { key: 'beneficiary_passport_expiry', label: 'Fecha de vencimiento', type: 'date' },
        ],
      },
      {
        title: 'Entrada a Estados Unidos',
        fields: [
          {
            key: 'beneficiary_i94_number',
            label: 'Número I-94 (si tiene)',
            help: 'Es el registro de entrada/salida que emite la frontera. Lo puedes buscar en cbp.gov/I94 si no lo tienes a mano.',
            type: 'text',
            placeholder: 'Ej: 12345678901',
          },
          {
            key: 'beneficiary_last_arrival_date',
            label: '¿Cuándo entró por última vez a EE.UU.?',
            type: 'date',
            prefillFrom: 'minor_basic',
          },
          {
            key: 'beneficiary_nonimmigrant_status',
            label: '¿Con qué tipo de permiso entró?',
            help: 'Ejemplos: "Parole", "Visa de turista (B-2)", "Cruzó por frontera sin visa", "TPS". Si no sabes, escribe "No sé".',
            type: 'text',
            placeholder: 'Ej: Parole, B-2, sin visa',
            prefillFrom: 'minor_basic',
          },
          {
            key: 'beneficiary_status_expiry',
            label: 'Fecha de vencimiento del permiso (si aplica)',
            type: 'date',
          },
          {
            key: 'beneficiary_i94_expiry',
            label: 'Fecha de vencimiento del I-94 (si aplica)',
            type: 'date',
          },
        ],
      },
      {
        title: 'Situación legal actual',
        fields: [
          {
            key: 'in_removal_proceedings',
            label: '¿El menor tiene un caso de inmigración (corte) abierto actualmente?',
            help: 'Por ejemplo: una orden de la corte de inmigración (EOIR), un Notice to Appear (NTA), o cualquier proceso de deportación.',
            type: 'yesno',
          },
          {
            key: 'other_petitions',
            label: '¿Hay otras peticiones de inmigración para este menor?',
            help: 'Como una I-130 (familiar), I-589 (asilo), u otra similar.',
            type: 'yesno',
          },
          {
            key: 'worked_without_permission',
            label: '¿El menor ha trabajado en EE.UU. sin permiso de trabajo?',
            help: 'Solo aplica si trabajó sin tener un EAD (Employment Authorization Document) válido.',
            type: 'yesno',
          },
          {
            key: 'adjustment_attached',
            label: '¿Está presentando también el formulario I-485 (ajuste de estatus) junto con esta I-360?',
            help: 'Normalmente NO. La mayoría presenta primero la I-360 y luego la I-485.',
            type: 'yesno',
          },
        ],
      },
      {
        title: 'Padre/madre que vive en otro país (si aplica)',
        description:
          'Solo llena esta sección si uno de los padres del menor vive fuera de Estados Unidos. Si ambos padres viven en EE.UU. o no se sabe dónde están, deja en blanco.',
        fields: [
          { key: 'foreign_parent_last_name', label: 'Apellido(s) del padre/madre en el extranjero', type: 'text' },
          { key: 'foreign_parent_first_name', label: 'Nombre(s)', type: 'text' },
          { key: 'foreign_parent_middle_name', label: 'Segundo nombre', type: 'text' },
          { key: 'foreign_parent_address', label: 'Calle y número', type: 'text' },
          { key: 'foreign_parent_city', label: 'Ciudad', type: 'text' },
          { key: 'foreign_parent_province', label: 'Estado/Provincia', type: 'text' },
          { key: 'foreign_parent_postal', label: 'Código postal', type: 'text' },
          { key: 'foreign_parent_country', label: 'País', type: 'country' },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // STEP 4 — SIJS Part 8 (la parte clave)
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'sijs',
    number: 'Paso 4 de 6',
    title: 'Sobre la corte juvenil',
    intro:
      'Estas preguntas son sobre la decisión de la corte juvenil que protege al menor. ' +
      'Si ya tienes la orden de custodia con los hallazgos SIJS, casi todas las respuestas están ahí. ' +
      'Si no estás seguro, contacta a tu equipo legal — pueden ayudarte a encontrar la respuesta correcta.',
    sections: [
      {
        title: 'Decisión de la corte',
        fields: [
          {
            key: 'declared_dependent_court',
            label: '¿Una corte de menores declaró al menor como dependiente del estado?',
            help:
              'Significa que un juez ordenó que el estado se haga responsable del menor por abuso, abandono o negligencia de los padres. Para SIJS, la respuesta normalmente es Sí.',
            type: 'yesno',
            required: true,
          },
          {
            key: 'state_agency_name',
            label: 'Nombre exacto de la corte o agencia que cuida al menor',
            help:
              'Búscalo en tus documentos legales. Ejemplo: "Juvenile Court of Travis County, Texas" o "Department of Children and Families, Florida".',
            type: 'text',
            placeholder: 'Ej: Juvenile Court of Harris County',
          },
          {
            key: 'currently_under_jurisdiction',
            label: '¿La corte sigue activa en el caso del menor hoy?',
            help:
              'Si el menor cumplió 18 años o ya fue adoptado, la respuesta puede ser No. Si el caso sigue abierto, es Sí.',
            type: 'yesno',
            required: true,
          },
        ],
      },
      {
        title: 'Donde vive el menor',
        fields: [
          {
            key: 'in_court_ordered_placement',
            label: '¿El menor vive donde la corte ordenó?',
            help:
              'Por ejemplo: hogar de crianza (foster), casa de un familiar autorizado por la corte, hogar grupal del estado, etc.',
            type: 'yesno',
            required: true,
          },
          {
            key: 'placement_reason',
            label: 'Si NO vive en colocación de la corte, ¿por qué?',
            type: 'select',
            options: PLACEMENT_REASON_OPTIONS,
            showIf: { key: 'in_court_ordered_placement', equals: 'No' },
          },
        ],
      },
      {
        title: 'Razón por la que no puede regresar con los padres',
        fields: [
          {
            key: 'reunification_not_viable_reason',
            label: '¿Por qué la corte dijo que NO es seguro que el menor regrese con sus padres? (puedes elegir varias)',
            help: 'Marca todas las razones que la corte mencionó en sus documentos.',
            type: 'multiselect',
            options: REUNIFICATION_REASONS,
            required: true,
          },
          {
            key: 'parent_names_not_viable',
            label: 'Nombres de los padres a quienes aplica esta razón',
            help: 'Escribe el nombre completo de cada padre/madre que la corte mencionó (mamá, papá o ambos).',
            type: 'voice_textarea',
            prefillFrom: 'absent_parent',
            placeholder: 'Ej: María Carmen López (madre) y Juan Carlos Pérez (padre)',
          },
          {
            key: 'best_interest_not_return',
            label: '¿La corte determinó que es MEJOR para el menor quedarse en EE.UU. que regresar a su país?',
            help: 'Es el "best interest finding" en términos legales. Para SIJS, normalmente Sí.',
            type: 'yesno',
            required: true,
          },
        ],
      },
      {
        title: 'Albergue del gobierno federal (HHS / ORR)',
        fields: [
          {
            key: 'previously_hhs_custody',
            label: '¿El menor estuvo alguna vez en un albergue del gobierno federal (ORR / HHS)?',
            help:
              'ORR = Office of Refugee Resettlement. HHS = Department of Health and Human Services. Son los albergues federales donde a veces se queda un menor que cruza la frontera solo.',
            type: 'yesno',
          },
          {
            key: 'hhs_court_order',
            label: '¿Hubo una orden de la corte para que ORR/HHS cuide al menor?',
            help: 'Solo aplica si la respuesta anterior fue Sí.',
            type: 'yesno',
            showIf: { key: 'previously_hhs_custody', equals: 'Sí' },
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // STEP 5 — CONTACT
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'contact',
    number: 'Paso 5 de 6',
    title: 'Contacto e idioma',
    intro:
      'Cómo USCIS y tu equipo legal pueden contactarte si necesitan información adicional.',
    sections: [
      {
        title: 'Datos de contacto del tutor',
        fields: [
          {
            key: 'petitioner_phone',
            label: 'Teléfono fijo (si tiene)',
            type: 'phone',
            placeholder: '(123) 456-7890',
          },
          {
            key: 'petitioner_mobile',
            label: 'Teléfono celular',
            type: 'phone',
            required: true,
            placeholder: '(123) 456-7890',
          },
          {
            key: 'petitioner_email',
            label: 'Correo electrónico',
            type: 'email',
            required: true,
            placeholder: 'tucorreo@ejemplo.com',
          },
        ],
      },
      {
        title: 'Idioma',
        fields: [
          {
            key: 'language_understood',
            label: '¿En qué idioma puedes leer y escribir cómodamente?',
            type: 'select',
            options: LANGUAGE_OPTIONS,
            required: true,
          },
          {
            key: 'interpreter_needed',
            label: '¿Necesitas un intérprete para entrevistas o cartas en inglés?',
            type: 'yesno',
            required: true,
          },
        ],
      },
      {
        title: 'Información adicional',
        fields: [
          {
            key: 'additional_info',
            label: 'Si quieres agregar algo más sobre el caso del menor, escríbelo aquí (opcional)',
            help: 'Puedes usar el botón de micrófono para hablar en vez de escribir.',
            type: 'voice_textarea',
            placeholder: 'Cualquier detalle importante que tu equipo legal deba saber…',
          },
        ],
      },
    ],
  },
]

/**
 * Lista plana de todos los campos del wizard (útil para conteo de
 * progreso y validación).
 */
export const I360_ALL_FIELDS: I360Field[] = I360_STEPS.flatMap((s) =>
  s.sections.flatMap((sec) => sec.fields),
)

/**
 * Total de campos visibles. Usado en `required-forms/route.ts` para
 * calcular el progreso del FormCard.
 */
export const TOTAL_I360_FIELDS = I360_ALL_FIELDS.length
