// Cuestionario "Miedo Creíble" — 11 módulos que el cliente completa en la
// pestaña Formularios para casos de Asilo Político (Fase 2 = `asilo_reforzar`)
// o del servicio standalone `reforzar-asilo`.
//
// El JSON de respuestas se persiste en `case_form_instances.filled_values`
// con `form_name='asilo_miedo_creible_cuestionario'`. La IA (Claude Opus 4.7
// con prompt v5) lo lee como `<questionnaire_responses>` junto con metadata
// del solicitante, documentos OCRed y URLs de country conditions para
// producir el JSON estructurado del Miedo Creíble.
//
// IMPORTANTE: Este schema NO reusa `ClientSection`/`ClientField` del
// `FormRunner` porque necesitamos tipos ricos (repeaters de incidentes y
// testigos, multi-checkbox de grounds, fechas aproximadas, URLs categorizadas).
// El wizard custom `credible-fear-questionnaire-wizard.tsx` lo consume directo.

import { z } from 'zod'

export const CREDIBLE_FEAR_QUESTIONNAIRE_SLUG = 'asilo_miedo_creible_cuestionario'
export const CREDIBLE_FEAR_QUESTIONNAIRE_VERSION = '2026-05-22-v1'

// ──────────────────────────────────────────────────────────────────
// Tipos de campo del cuestionario
// ──────────────────────────────────────────────────────────────────

export type CFQuestionType =
  | 'text'
  | 'textarea'
  | 'radio_yes_no'
  | 'multi_checkbox'
  | 'select'
  | 'date'
  | 'approximate_date'
  | 'incident_block'
  | 'incident_list'
  | 'witness_list'
  | 'url_list'

export interface CFDependsOn {
  semanticKey: string
  equals?: 'yes' | 'no' | string | string[]
  includesAny?: string[]
}

export interface CFOption {
  value: string
  labelEs: string
  helpEs?: string
}

export interface CFQuestion {
  semanticKey: string
  type: CFQuestionType
  labelEs: string
  helpEs?: string
  placeholderEs?: string
  required?: boolean
  maxLength?: number
  options?: CFOption[]
  dependsOn?: CFDependsOn
  /** Para incident_block: campos anidados del bloque. */
  subFields?: CFQuestion[]
  /** Para list types (incident_list, witness_list, url_list). */
  minItems?: number
  maxItems?: number
  /** Pre-fill source (datos resueltos por el endpoint GET). */
  prefillFrom?: 'profile.full_name' | 'profile.country_of_birth' | 'profile.date_of_birth' | 'i589_part_a.date_entered_us' | 'i589_part_a.port_of_entry'
}

export interface CFModule {
  id: ModuleId
  numberLabel: string
  titleEs: string
  shortTitleEs: string
  descriptionEs: string
  icon: string
  /** Si presente, el módulo se muestra solo cuando la condición es true. */
  conditional?: CFDependsOn
  questions: CFQuestion[]
}

export type ModuleId = 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'M7' | 'M8' | 'M9' | 'M10' | 'M11'

// ──────────────────────────────────────────────────────────────────
// Tipos del valor persistido en filled_values JSONB
// ──────────────────────────────────────────────────────────────────

export interface CFIncidentValue {
  date?: string
  isApproximateDate?: boolean
  location?: string
  whatHappened?: string
  who?: string
  whyTarget?: string
  effect?: string
  witnesses?: string
}

export interface CFWitnessValue {
  name?: string
  relationship?: string
  whatTheyKnow?: string
  availableForAffidavit?: boolean
  contactInfo?: string
}

export interface CFUrlValue {
  url: string
  title?: string
  category?: 'international_press' | 'local_press' | 'official_report' | 'social_media' | 'other'
  selectedFromPrefill?: boolean
}

export interface CFApproximateDate {
  date: string
  isApproximate: boolean
}

export type CFAnswerValue =
  | string
  | string[]
  | boolean
  | CFApproximateDate
  | CFIncidentValue
  | CFIncidentValue[]
  | CFWitnessValue[]
  | CFUrlValue[]
  | null
  | undefined

export type CFAnswers = Record<string, CFAnswerValue>

// ──────────────────────────────────────────────────────────────────
// Schema Zod (validación servidor)
// ──────────────────────────────────────────────────────────────────

export const cfApproximateDateSchema = z.object({
  date: z.string(),
  isApproximate: z.boolean(),
})

export const cfIncidentSchema = z.object({
  date: z.string().optional(),
  isApproximateDate: z.boolean().optional(),
  location: z.string().optional(),
  whatHappened: z.string().optional(),
  who: z.string().optional(),
  whyTarget: z.string().optional(),
  effect: z.string().optional(),
  witnesses: z.string().optional(),
})

export const cfWitnessSchema = z.object({
  name: z.string().optional(),
  relationship: z.string().optional(),
  whatTheyKnow: z.string().optional(),
  availableForAffidavit: z.boolean().optional(),
  contactInfo: z.string().optional(),
})

export const cfUrlSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  category: z.enum(['international_press', 'local_press', 'official_report', 'social_media', 'other']).optional(),
  selectedFromPrefill: z.boolean().optional(),
})

// ──────────────────────────────────────────────────────────────────
// Opciones reusables
// ──────────────────────────────────────────────────────────────────

const YES_NO_OPTIONS: CFOption[] = [
  { value: 'yes', labelEs: 'Sí' },
  { value: 'no', labelEs: 'No' },
]

const PROTECTED_GROUNDS: CFOption[] = [
  {
    value: 'race',
    labelEs: 'Raza o etnia',
    helpEs: 'Por ejemplo: indígena, afrodescendiente, judío, romaní.',
  },
  {
    value: 'religion',
    labelEs: 'Religión',
    helpEs: 'Cualquier creencia o práctica religiosa por la que te persigan.',
  },
  {
    value: 'nationality',
    labelEs: 'Nacionalidad',
    helpEs: 'Ser de un país, grupo étnico o nacional específico.',
  },
  {
    value: 'political_opinion',
    labelEs: 'Opinión política (real o imputada)',
    helpEs: 'Lo que piensas o lo que tu perseguidor cree que piensas.',
  },
  {
    value: 'particular_social_group',
    labelEs: 'Pertenencia a un grupo social particular',
    helpEs: 'Por ejemplo: orientación sexual, género, ex-pandillero, familia de testigo.',
  },
  {
    value: 'torture',
    labelEs: 'Miedo a tortura (Convención contra la Tortura)',
    helpEs: 'Solo si temes que un agente del Estado (o con su aquiescencia) te torture.',
  },
]

// ──────────────────────────────────────────────────────────────────
// Módulos M1 — M11
// ──────────────────────────────────────────────────────────────────

const M1_BARS: CFModule = {
  id: 'M1',
  numberLabel: 'Módulo 1',
  titleEs: 'Verificación inicial',
  shortTitleEs: 'Verificación',
  descriptionEs: 'Algunas preguntas iniciales para entender si hay obstáculos legales que debamos resolver antes.',
  icon: 'rule',
  questions: [
    {
      semanticKey: 'm1_date_entered_us',
      type: 'date',
      labelEs: '¿Cuándo entraste a Estados Unidos por última vez?',
      helpEs: 'Tu fecha más reciente de ingreso. Si tienes I-94, está ahí.',
      required: true,
      prefillFrom: 'i589_part_a.date_entered_us',
    },
    {
      semanticKey: 'm1_filed_more_than_year_ago',
      type: 'radio_yes_no',
      labelEs: '¿Hace más de un año que entraste a EE. UU.?',
      helpEs: 'Si sí, en el Módulo 11 te pediremos explicar por qué presentas la solicitud después del año.',
      required: true,
      options: YES_NO_OPTIONS,
    },
    {
      semanticKey: 'm1_firm_resettlement',
      type: 'radio_yes_no',
      labelEs: '¿Recibiste residencia legal en algún otro país antes de venir a EE. UU.?',
      helpEs: 'Esto incluye residencia permanente o asilo aprobado en otro país. Tránsito o visa de turista NO cuenta.',
      required: true,
      options: YES_NO_OPTIONS,
    },
    {
      semanticKey: 'm1_firm_resettlement_details',
      type: 'textarea',
      labelEs: 'Cuéntanos sobre ese estatus que recibiste',
      helpEs: 'País, año, qué tipo de permiso, por qué saliste de ahí.',
      dependsOn: { semanticKey: 'm1_firm_resettlement', equals: 'yes' },
      maxLength: 2000,
    },
    {
      semanticKey: 'm1_criminal_history',
      type: 'radio_yes_no',
      labelEs: '¿Has sido arrestado, acusado o condenado por algún delito (en cualquier país)?',
      helpEs: 'Si sí, necesitamos saber los detalles para asesorarte bien. Esto no descalifica automáticamente.',
      required: true,
      options: YES_NO_OPTIONS,
    },
    {
      semanticKey: 'm1_criminal_history_details',
      type: 'textarea',
      labelEs: 'Cuéntanos qué pasó',
      helpEs: 'Tipo de cargo, año, país, resultado (sobreseído, condenado, fianza, etc.).',
      dependsOn: { semanticKey: 'm1_criminal_history', equals: 'yes' },
      maxLength: 3000,
    },
    {
      semanticKey: 'm1_persecutor_bar',
      type: 'radio_yes_no',
      labelEs: '¿Has participado, asistido u ordenado daño a otra persona por su raza, religión, nacionalidad, grupo social u opinión política?',
      helpEs: 'Por ejemplo: ¿fuiste militar, policía, paramilitar o miembro de un grupo que persigue a otros? Si la respuesta es sí, necesitamos ayuda legal especializada.',
      required: true,
      options: YES_NO_OPTIONS,
    },
    {
      semanticKey: 'm1_persecutor_bar_details',
      type: 'textarea',
      labelEs: 'Cuéntanos los detalles',
      helpEs: 'Qué rol tuviste, qué hiciste o presenciaste, cuándo, por qué saliste.',
      dependsOn: { semanticKey: 'm1_persecutor_bar', equals: 'yes' },
      maxLength: 3000,
    },
  ],
}

const M2_BACKGROUND: CFModule = {
  id: 'M2',
  numberLabel: 'Módulo 2',
  titleEs: 'Quién soy y de dónde vengo',
  shortTitleEs: 'Mi historia',
  descriptionEs: 'Ayúdanos a contar quién eres como persona. Estos datos hacen el caso humano, no solo un expediente.',
  icon: 'person',
  questions: [
    {
      semanticKey: 'm2_full_name',
      type: 'text',
      labelEs: 'Tu nombre completo (como aparece en tu pasaporte)',
      required: true,
      prefillFrom: 'profile.full_name',
    },
    {
      semanticKey: 'm2_country_of_birth',
      type: 'text',
      labelEs: 'País donde naciste',
      required: true,
      prefillFrom: 'profile.country_of_birth',
    },
    {
      semanticKey: 'm2_city_of_birth',
      type: 'text',
      labelEs: 'Ciudad o pueblo donde naciste',
    },
    {
      semanticKey: 'm2_date_of_birth',
      type: 'date',
      labelEs: 'Fecha de nacimiento',
      required: true,
      prefillFrom: 'profile.date_of_birth',
    },
    {
      semanticKey: 'm2_grew_up',
      type: 'textarea',
      labelEs: '¿Dónde y cómo creciste?',
      helpEs: 'Pueblo o ciudad, barrio, contexto general. No necesita ser largo — basta con que un oficial pueda ubicarte.',
      maxLength: 1500,
    },
    {
      semanticKey: 'm2_family',
      type: 'textarea',
      labelEs: 'Cuéntanos sobre tu familia',
      helpEs: 'Padres, hermanos, esposo(a), hijos. Quiénes son, dónde están ahora, si alguno también está en peligro.',
      maxLength: 2000,
    },
    {
      semanticKey: 'm2_education',
      type: 'textarea',
      labelEs: '¿Hasta qué nivel estudiaste?',
      helpEs: 'Primaria, secundaria, universidad, oficio. Si estudiaste algo específico relacionado con tu caso (derecho, periodismo, activismo), menciónalo.',
      maxLength: 1000,
    },
    {
      semanticKey: 'm2_work',
      type: 'textarea',
      labelEs: '¿En qué trabajabas en tu país?',
      helpEs: 'Tu(s) trabajo(s) más recientes antes de salir. Si tu trabajo te puso en peligro, dilo aquí.',
      maxLength: 1500,
    },
    {
      semanticKey: 'm2_religion',
      type: 'textarea',
      labelEs: '¿Practicabas alguna religión o creencia?',
      helpEs: 'Cuál, qué tan activa(o) eras, si era parte importante de tu identidad.',
      maxLength: 1000,
    },
    {
      semanticKey: 'm2_community',
      type: 'textarea',
      labelEs: '¿A qué comunidades o grupos pertenecías?',
      helpEs: 'Por ejemplo: sindicato, partido político, iglesia, ONG, equipo deportivo, grupo cultural, comunidad LGBTQ+, etc.',
      maxLength: 1500,
    },
  ],
}

const M3_GROUNDS: CFModule = {
  id: 'M3',
  numberLabel: 'Módulo 3',
  titleEs: 'Por qué te perseguían',
  shortTitleEs: 'Motivos',
  descriptionEs: 'Marca todos los motivos por los que crees que te perseguían o te perseguirían si regresas. Puedes elegir varios.',
  icon: 'flag',
  questions: [
    {
      semanticKey: 'm3_grounds',
      type: 'multi_checkbox',
      labelEs: '¿Por cuál(es) de estos motivos te persiguen o temes persecución?',
      helpEs: 'Marca todas las que apliquen. Si no estás seguro, marca lo que más se parezca a tu situación — luego explicas en las preguntas siguientes.',
      required: true,
      options: PROTECTED_GROUNDS,
    },
    {
      semanticKey: 'm3_political_belief',
      type: 'textarea',
      labelEs: 'Describe tu opinión política',
      helpEs: 'Qué piensas o qué hacías políticamente. O qué creen tus perseguidores que piensas (incluso si no es cierto).',
      dependsOn: { semanticKey: 'm3_grounds', includesAny: ['political_opinion'] },
      maxLength: 2500,
    },
    {
      semanticKey: 'm3_religion_practice',
      type: 'textarea',
      labelEs: 'Describe tu práctica religiosa',
      helpEs: 'Qué religión practicas, cómo, qué te identifica como practicante (asistencia, ministerio, ropa, símbolos).',
      dependsOn: { semanticKey: 'm3_grounds', includesAny: ['religion'] },
      maxLength: 2000,
    },
    {
      semanticKey: 'm3_psg_articulation',
      type: 'textarea',
      labelEs: 'Describe el grupo social al que perteneces',
      helpEs: 'En tus propias palabras. Por ejemplo: "mujeres que escapan de violencia doméstica en mi pueblo", "personas LGBTQ+ en mi país", "ex-policías que rechazaron órdenes de corrupción", "familiares de testigos protegidos".',
      dependsOn: { semanticKey: 'm3_grounds', includesAny: ['particular_social_group'] },
      maxLength: 2500,
    },
    {
      semanticKey: 'm3_torture_basis',
      type: 'textarea',
      labelEs: 'Describe por qué crees que serías torturado(a)',
      helpEs: 'Por quién (gobierno, policía, militares, o un grupo con la aquiescencia del Estado), qué tipo de tortura temes y por qué.',
      dependsOn: { semanticKey: 'm3_grounds', includesAny: ['torture'] },
      maxLength: 2000,
    },
    {
      semanticKey: 'm3_race_or_nationality_detail',
      type: 'textarea',
      labelEs: 'Si seleccionaste raza, etnia o nacionalidad, cuenta tu identidad',
      helpEs: 'Qué grupo, cómo se manifiesta tu identidad ante los perseguidores.',
      dependsOn: { semanticKey: 'm3_grounds', includesAny: ['race', 'nationality'] },
      maxLength: 1500,
    },
  ],
}

const M4_PERSECUTION: CFModule = {
  id: 'M4',
  numberLabel: 'Módulo 4',
  titleEs: 'Lo que te pasó',
  shortTitleEs: 'Lo que viví',
  descriptionEs: 'Aquí contamos los incidentes específicos de daño, amenaza o maltrato. El primero, el peor y el último son los más importantes. Si hubo más, agrégalos como "incidentes intermedios".',
  icon: 'warning',
  questions: [
    {
      semanticKey: 'm4_1_first_incident',
      type: 'incident_block',
      labelEs: 'El primer incidente',
      helpEs: 'La primera vez que algo te pasó por los motivos del Módulo 3.',
      required: true,
      subFields: incidentSubFields('m4_1_first'),
    },
    {
      semanticKey: 'm4_2_worst_incident',
      type: 'incident_block',
      labelEs: 'El peor incidente (si es distinto del primero o el último)',
      helpEs: 'Si el peor incidente coincide con el primero o el último, déjalo en blanco.',
      subFields: incidentSubFields('m4_2_worst'),
    },
    {
      semanticKey: 'm4_3_last_incident',
      type: 'incident_block',
      labelEs: 'El último incidente — el que te decidió a salir del país',
      required: true,
      subFields: incidentSubFields('m4_3_last'),
    },
    {
      semanticKey: 'm4_4_intermediate_incidents',
      type: 'incident_list',
      labelEs: 'Otros incidentes (opcional)',
      helpEs: 'Cualquier otro incidente entre el primero y el último que sea importante. Añade tantos como necesites.',
      minItems: 0,
      maxItems: 15,
      subFields: incidentSubFields('m4_4_other'),
    },
    {
      semanticKey: 'm4_5_family_harm',
      type: 'textarea',
      labelEs: '¿Tu familia o personas como tú también sufrieron daño?',
      helpEs: 'Esto demuestra patrón. Quién, qué pasó, cuándo, si fue por la misma razón.',
      maxLength: 3000,
    },
    {
      semanticKey: 'm4_6_psychological_effect',
      type: 'textarea',
      labelEs: '¿Cómo te afectó psicológicamente?',
      helpEs: 'Si has tenido ansiedad, depresión, pesadillas, miedo, tratamiento médico o psicológico. Si tienes reportes médicos súbelos en la pestaña Documentos.',
      maxLength: 2000,
    },
  ],
}

const M5_WITNESSES: CFModule = {
  id: 'M5',
  numberLabel: 'Módulo 5',
  titleEs: 'Testigos',
  shortTitleEs: 'Testigos',
  descriptionEs: 'Personas que pueden confirmar lo que te pasó. No tienen que estar en EE. UU. Sus cartas juradas son muy valiosas.',
  icon: 'groups',
  questions: [
    {
      semanticKey: 'm5_witnesses',
      type: 'witness_list',
      labelEs: 'Lista tus testigos',
      helpEs: 'Para cada uno: quién es, cómo se relaciona contigo, qué presenció y si puede firmar una carta jurada.',
      minItems: 0,
      maxItems: 20,
    },
  ],
}

const M6_HELP: CFModule = {
  id: 'M6',
  numberLabel: 'Módulo 6',
  titleEs: 'Intenté pedir ayuda',
  shortTitleEs: 'Pedir ayuda',
  descriptionEs: 'Si presentaste denuncia o pediste protección, cuéntanos. Si NO lo hiciste, también — explicar por qué es importante.',
  icon: 'support_agent',
  questions: [
    {
      semanticKey: 'm6_filed_denuncia',
      type: 'radio_yes_no',
      labelEs: '¿Presentaste alguna denuncia o queja formal en tu país?',
      required: true,
      options: YES_NO_OPTIONS,
    },
    {
      semanticKey: 'm6_denuncia_details',
      type: 'textarea',
      labelEs: 'Cuéntanos sobre la(s) denuncia(s)',
      helpEs: 'Ante qué autoridad, qué denunciaste, número de expediente si lo tienes, fecha aproximada. Si tienes copia de la denuncia, súbela en la pestaña Documentos.',
      dependsOn: { semanticKey: 'm6_filed_denuncia', equals: 'yes' },
      maxLength: 3000,
    },
    {
      semanticKey: 'm6_authority_response',
      type: 'textarea',
      labelEs: '¿Qué hizo la autoridad?',
      helpEs: 'Si te ayudaron, te ignoraron, te amenazaron, perdieron la denuncia, te dijeron que regresaras después.',
      dependsOn: { semanticKey: 'm6_filed_denuncia', equals: 'yes' },
      maxLength: 2500,
    },
    {
      semanticKey: 'm6_why_no_denuncia',
      type: 'textarea',
      labelEs: '¿Por qué no denunciaste?',
      helpEs: 'Por ejemplo: la policía es cómplice, no había autoridad, te amenazaron si denunciabas, no tenías a quién acudir, miedo a represalias.',
      dependsOn: { semanticKey: 'm6_filed_denuncia', equals: 'no' },
      required: true,
      maxLength: 2500,
    },
  ],
}

const M7_RELOCATION: CFModule = {
  id: 'M7',
  numberLabel: 'Módulo 7',
  titleEs: 'Tratar de irme a otro lugar',
  shortTitleEs: 'Reubicación',
  descriptionEs: 'Una pregunta común es: ¿por qué no te mudaste a otra parte de tu país en lugar de venir a EE. UU.?',
  icon: 'directions',
  questions: [
    {
      semanticKey: 'm7_tried_relocate',
      type: 'radio_yes_no',
      labelEs: '¿Intentaste mudarte a otra ciudad o región dentro de tu país?',
      required: true,
      options: YES_NO_OPTIONS,
    },
    {
      semanticKey: 'm7_where_relocated',
      type: 'text',
      labelEs: '¿A dónde te mudaste?',
      dependsOn: { semanticKey: 'm7_tried_relocate', equals: 'yes' },
    },
    {
      semanticKey: 'm7_relocation_outcome',
      type: 'textarea',
      labelEs: '¿Qué pasó ahí?',
      helpEs: 'Te encontraron, te amenazaron de nuevo, no podías sobrevivir económicamente, el perseguidor era estatal y operaba en todo el país.',
      dependsOn: { semanticKey: 'm7_tried_relocate', equals: 'yes' },
      maxLength: 2500,
    },
    {
      semanticKey: 'm7_why_not_relocate',
      type: 'textarea',
      labelEs: '¿Por qué crees que mudarte dentro del país no era seguro?',
      helpEs: 'Por ejemplo: tu perseguidor tiene alcance nacional (gobierno, cártel, iglesia mayoritaria), no tenías familia ni recursos en otra parte, la persecución pasa en todo el país.',
      required: true,
      maxLength: 2500,
    },
  ],
}

const M8_FUTURE_FEAR: CFModule = {
  id: 'M8',
  numberLabel: 'Módulo 8',
  titleEs: 'Lo que temo si regreso',
  shortTitleEs: 'Miedo futuro',
  descriptionEs: 'La sección más importante. Sé específico: quién, qué, cómo sabes que sigue siendo real.',
  icon: 'shield_with_heart',
  questions: [
    {
      semanticKey: 'm8_who_would_harm',
      type: 'textarea',
      labelEs: '¿Quién te haría daño si regresas?',
      helpEs: 'Nombre o descripción del perseguidor: gobierno, cártel, grupo armado, familia, vecino, ex pareja, policía, etc.',
      required: true,
      maxLength: 2500,
    },
    {
      semanticKey: 'm8_what_they_would_do',
      type: 'textarea',
      labelEs: '¿Qué te harían?',
      helpEs: 'Sé concreto: matar, encarcelar, torturar, secuestrar, violar, reclutar a la fuerza, expulsar de tu casa.',
      required: true,
      maxLength: 2500,
    },
    {
      semanticKey: 'm8_why_still_real',
      type: 'textarea',
      labelEs: '¿Cómo sabes que este miedo sigue siendo real hoy?',
      helpEs: 'Por ejemplo: el régimen sigue en el poder, te siguen amenazando por mensajes, mataron a alguien parecido a ti recientemente, tu familia te dice que aún preguntan por ti.',
      required: true,
      maxLength: 3000,
    },
    {
      semanticKey: 'm8_last_threat_date',
      type: 'approximate_date',
      labelEs: '¿Cuándo fue la última amenaza o señal de que aún te buscan?',
      helpEs: 'Marca "Aproximada" si no recuerdas el día exacto.',
    },
    {
      semanticKey: 'm8_proof_still_active',
      type: 'textarea',
      labelEs: 'Evidencia de que el peligro está vigente',
      helpEs: 'Mensajes recientes, publicaciones, gente que sigue desapareciendo, llamadas a tu familia. Súbe las pruebas en la pestaña Documentos.',
      maxLength: 2500,
    },
  ],
}

const M9_EVIDENCE: CFModule = {
  id: 'M9',
  numberLabel: 'Módulo 9',
  titleEs: 'Evidencia externa',
  shortTitleEs: 'Evidencia externa',
  descriptionEs: 'Enlaces a noticias, reportes de DD.HH. y publicaciones que documenten lo que pasa en tu país. Ya pre-cargamos fuentes confiables según tu país; marca las que apliquen y agrega las tuyas.',
  icon: 'link',
  questions: [
    {
      semanticKey: 'm9_prefilled_country_urls',
      type: 'multi_checkbox',
      labelEs: 'Reportes oficiales y prensa de tu país (pre-cargados)',
      helpEs: 'Marca los que apliquen a tu caso. La IA usará estas fuentes como soporte. Si tu país no aparece o necesitas más, agrégalas en el siguiente campo.',
      options: [],
    },
    {
      semanticKey: 'm9_custom_urls',
      type: 'url_list',
      labelEs: 'Otros enlaces que quieres incluir',
      helpEs: 'Noticias, reportes, publicaciones tuyas en redes, cualquier URL que apoye tu caso. Máximo 20.',
      minItems: 0,
      maxItems: 20,
    },
  ],
}

const M10_TRAVEL: CFModule = {
  id: 'M10',
  numberLabel: 'Módulo 10',
  titleEs: 'Cómo llegué a EE. UU.',
  shortTitleEs: 'Mi viaje',
  descriptionEs: 'El viaje y los países por los que pasaste. USCIS pregunta esto siempre — sé sincero.',
  icon: 'flight',
  questions: [
    {
      semanticKey: 'm10_date_left_country',
      type: 'approximate_date',
      labelEs: '¿Cuándo saliste de tu país?',
      required: true,
    },
    {
      semanticKey: 'm10_how_left',
      type: 'textarea',
      labelEs: '¿Cómo saliste? (avión, bus, a pie, etc.)',
      helpEs: 'Descripción breve de la salida. Si usaste a un "coyote" o guía, dilo.',
      maxLength: 1500,
    },
    {
      semanticKey: 'm10_transit_countries',
      type: 'textarea',
      labelEs: '¿Por qué países pasaste antes de entrar a EE. UU.?',
      helpEs: 'Por ejemplo: "Colombia (3 días, en tránsito), Panamá (1 semana, en albergue de migración), México (1 mes)".',
      required: true,
      maxLength: 2500,
    },
    {
      semanticKey: 'm10_why_no_asylum_transit',
      type: 'textarea',
      labelEs: '¿Pediste asilo en alguno de esos países? Si no, ¿por qué?',
      helpEs: 'Razones comunes: no sabía que podía, estaba en tránsito sin acceso al sistema, mi destino era EE. UU., el sistema de asilo del país de tránsito no es seguro.',
      required: true,
      maxLength: 2500,
    },
    {
      semanticKey: 'm10_us_entry_date',
      type: 'date',
      labelEs: 'Fecha en que entraste a EE. UU.',
      required: true,
      prefillFrom: 'i589_part_a.date_entered_us',
    },
    {
      semanticKey: 'm10_us_entry_place',
      type: 'text',
      labelEs: '¿Por dónde entraste a EE. UU.?',
      helpEs: 'Ciudad/punto fronterizo o aeropuerto.',
      prefillFrom: 'i589_part_a.port_of_entry',
    },
  ],
}

const M11_ONE_YEAR_EXCEPTION: CFModule = {
  id: 'M11',
  numberLabel: 'Módulo 11',
  titleEs: 'Por qué presento ahora (más de 1 año)',
  shortTitleEs: 'Excepción al año',
  descriptionEs: 'La ley exige presentar asilo dentro de 1 año desde la entrada a EE. UU., salvo excepciones. Como llevas más de un año, explícanos cuál se aplica.',
  icon: 'event_busy',
  conditional: { semanticKey: 'm1_filed_more_than_year_ago', equals: 'yes' },
  questions: [
    {
      semanticKey: 'm11_changed_circumstances',
      type: 'textarea',
      labelEs: '¿Cambiaron las circunstancias en tu país o personales después de llegar?',
      helpEs: 'Por ejemplo: cambio de gobierno, nueva ley contra tu grupo, nueva amenaza desde EE. UU., tu familia fue atacada después de tu salida, te declaraste públicamente LGBTQ+ aquí, te convertiste a otra religión, etc.',
      maxLength: 3000,
    },
    {
      semanticKey: 'm11_extraordinary_circumstances',
      type: 'textarea',
      labelEs: '¿Hubo circunstancias extraordinarias que te impidieron presentar antes?',
      helpEs: 'Por ejemplo: incapacidad médica, eras menor de edad, error grave de un abogado anterior, te dijeron que estabas en otro proceso, no hablabas inglés y no tenías acceso a información.',
      maxLength: 3000,
    },
    {
      semanticKey: 'm11_reasonable_period',
      type: 'textarea',
      labelEs: '¿Por qué presentas ahora y no antes/después?',
      helpEs: 'La ley exige que la presentación sea dentro de un "período razonable" después de que las circunstancias cambiaron. Explica esa conexión.',
      maxLength: 2500,
    },
  ],
}

export const CREDIBLE_FEAR_QUESTIONNAIRE: CFModule[] = [
  M1_BARS,
  M2_BACKGROUND,
  M3_GROUNDS,
  M4_PERSECUTION,
  M5_WITNESSES,
  M6_HELP,
  M7_RELOCATION,
  M8_FUTURE_FEAR,
  M9_EVIDENCE,
  M10_TRAVEL,
  M11_ONE_YEAR_EXCEPTION,
]

function incidentSubFields(prefix: string): CFQuestion[] {
  return [
    {
      semanticKey: `${prefix}_date`,
      type: 'approximate_date',
      labelEs: '¿Cuándo pasó?',
    },
    {
      semanticKey: `${prefix}_location`,
      type: 'text',
      labelEs: '¿Dónde pasó?',
      helpEs: 'Ciudad y lugar específico si aplica.',
    },
    {
      semanticKey: `${prefix}_what_happened`,
      type: 'textarea',
      labelEs: 'Cuéntanos qué pasó',
      helpEs: 'Con tus propias palabras. Si recuerdas frases exactas que te dijeron, ponlas entre comillas.',
      required: true,
      maxLength: 4000,
    },
    {
      semanticKey: `${prefix}_who`,
      type: 'text',
      labelEs: '¿Quién(es) lo hizo(eron)?',
      helpEs: 'Nombres si los sabes, o descripción (uniforme, grupo, vehículo).',
    },
    {
      semanticKey: `${prefix}_why_target`,
      type: 'textarea',
      labelEs: '¿Por qué crees que te atacaron a ti?',
      helpEs: 'Conecta esto con los motivos del Módulo 3 (raza, religión, política, grupo social, etc.).',
      maxLength: 2000,
    },
    {
      semanticKey: `${prefix}_effect`,
      type: 'textarea',
      labelEs: '¿Qué efecto tuvo en ti? (físico, emocional, en tu vida)',
      maxLength: 2000,
    },
    {
      semanticKey: `${prefix}_witnesses_present`,
      type: 'text',
      labelEs: '¿Hubo testigos? (opcional)',
      helpEs: 'Si fueron tus familiares u otros, menciónalos aquí. En el Módulo 5 los detallarás.',
    },
  ]
}

// ──────────────────────────────────────────────────────────────────
// Helpers para el wizard / endpoints
// ──────────────────────────────────────────────────────────────────

/**
 * Devuelve los módulos que aplican según las respuestas actuales (filtra M11
 * cuando el cliente declaró que NO está fuera del año).
 */
export function getApplicableModules(answers: CFAnswers): CFModule[] {
  return CREDIBLE_FEAR_QUESTIONNAIRE.filter((mod) => isConditionSatisfied(mod.conditional, answers))
}

/**
 * Devuelve las preguntas visibles de un módulo (filtra las que tienen
 * `dependsOn` no satisfecho contra las respuestas actuales).
 */
export function getVisibleQuestions(mod: CFModule, answers: CFAnswers): CFQuestion[] {
  return mod.questions.filter((q) => isConditionSatisfied(q.dependsOn, answers))
}

export function isConditionSatisfied(cond: CFDependsOn | undefined, answers: CFAnswers): boolean {
  if (!cond) return true
  const v = answers[cond.semanticKey]
  if (cond.includesAny && Array.isArray(v)) {
    return cond.includesAny.some((needle) => (v as string[]).includes(needle))
  }
  if (cond.equals !== undefined) {
    const expected = Array.isArray(cond.equals) ? cond.equals : [cond.equals]
    return expected.includes(String(v ?? ''))
  }
  return v !== undefined && v !== null && v !== ''
}

/**
 * Marca un módulo como "completo" si todas sus preguntas visibles obligatorias
 * tienen respuesta.
 */
export function isModuleComplete(mod: CFModule, answers: CFAnswers): boolean {
  const visible = getVisibleQuestions(mod, answers)
  for (const q of visible) {
    if (!q.required) continue
    if (!hasAnswerValue(answers[q.semanticKey], q.type)) return false
  }
  return true
}

export function hasAnswerValue(v: CFAnswerValue, type: CFQuestionType): boolean {
  if (v === null || v === undefined) return false
  if (type === 'multi_checkbox') return Array.isArray(v) && v.length > 0
  if (type === 'incident_block') {
    if (typeof v !== 'object' || Array.isArray(v)) return false
    const incident = v as CFIncidentValue
    return Boolean(incident.whatHappened && incident.whatHappened.trim().length > 0)
  }
  if (type === 'incident_list' || type === 'witness_list' || type === 'url_list') {
    return Array.isArray(v) && v.length > 0
  }
  if (type === 'approximate_date') {
    if (typeof v !== 'object' || Array.isArray(v)) return false
    return Boolean((v as CFApproximateDate).date)
  }
  if (typeof v === 'boolean') return true
  if (typeof v === 'string') return v.trim().length > 0
  return false
}

/**
 * Calcula el progreso global del cuestionario (porcentaje de preguntas
 * obligatorias respondidas).
 */
export function calculateProgress(answers: CFAnswers): {
  totalRequired: number
  answeredRequired: number
  pct: number
  modulesComplete: number
  modulesTotal: number
} {
  const applicable = getApplicableModules(answers)
  let totalRequired = 0
  let answeredRequired = 0
  let modulesComplete = 0
  for (const mod of applicable) {
    const visible = getVisibleQuestions(mod, answers)
    let modAllAnswered = true
    for (const q of visible) {
      if (!q.required) continue
      totalRequired++
      if (hasAnswerValue(answers[q.semanticKey], q.type)) {
        answeredRequired++
      } else {
        modAllAnswered = false
      }
    }
    if (modAllAnswered) modulesComplete++
  }
  const pct = totalRequired === 0 ? 100 : Math.round((answeredRequired / totalRequired) * 100)
  return {
    totalRequired,
    answeredRequired,
    pct,
    modulesComplete,
    modulesTotal: applicable.length,
  }
}
