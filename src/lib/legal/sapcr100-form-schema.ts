// Schema curado para FM-SAPCR-100 (Texas SAPCR Petition - 2025 Sep legis update).
//
// Fuente de verdad para:
// - Mapeo semanticKey ↔ pdfFieldName (nombre real del AcroForm).
// - Etiquetas en español, ayuda contextual y agrupación por secciones.
// - Validación Zod (cliente + servidor).
// - Valores hardcodeados (verdades universales para SIJS / Petition by Parent).
// - Reglas deriveFrom para prefill desde BD (resueltas en sapcr100-prefill.ts).
//
// Si Texas publica una nueva revisión del PDF, re-correr
// `node scripts/inspect-sapcr100-fields.mjs` y actualizar PDF_SHA256 + cualquier
// pdfFieldName que haya cambiado.
//
// Referencia legal: SAPCR_SIJS_field_mapping_jennifer_velasquez.md (sección 3.1).

import { z } from 'zod'

// ──────────────────────────────────────────────────────────────────
// Constantes verificables al runtime
// ──────────────────────────────────────────────────────────────────

export const PDF_PUBLIC_PATH = '/forms/fm-sapcr-100.pdf'
export const PDF_DISK_PATH = 'public/forms/fm-sapcr-100.pdf'
export const PDF_SHA256 = '4734ce12600d86433e048d8a87d9617b592e3a3bda5e8cff7fc7cd23e3017e94'
export const SAPCR_VERSION = '2025-09-legis-update'
export const FORM_SLUG = 'tx-fm-sapcr-100'
export const FORM_NAME = 'TX FM-SAPCR-100 Petition'
export const FORM_DESCRIPTION_ES = 'Petición SAPCR de Texas (filed by parent)'

// ──────────────────────────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────────────────────────

export type FieldType =
  | 'text'
  | 'textarea'
  | 'checkbox'
  | 'date'
  | 'phone'
  | 'state'
  | 'zip'

export interface FieldOption {
  value: string
  labelEs: string
}

export interface FieldSpec {
  /** Clave semántica usada en el form de React (ej. 'petitioner_full_name'). */
  semanticKey: string
  /** Nombre EXACTO del field en el AcroForm. Si null, es un grupo logico (no se serializa al PDF). */
  pdfFieldName: string | null
  type: FieldType
  labelEs: string
  helpEs?: string
  page?: number
  required?: boolean
  /** Valor universal SIJS (siempre se aplica, no editable por defecto pero el admin puede sobreescribir). */
  hardcoded?: string | boolean
  /** Notación dot/bracket para extraer del bag de datos del caso (ver sapcr100-prefill.ts). */
  deriveFrom?: string
  /** Para checkboxes que representan opciones mutuamente excluyentes — el groupKey los agrupa visualmente. */
  groupKey?: string
  options?: FieldOption[]
  /** maxLength para inputs text/textarea (informativo en UI, no validacion estricta). */
  maxLength?: number
  /**
   * Si false, este campo solo es editable por Diana en el admin (datos jurídicos
   * como cause_number, court_number, hardcoded). Si undefined o true, el cliente
   * puede llenarlo desde la pestaña Fases. Default: true vía heurística.
   *
   * Nota: la heurística en isFieldEditableByClient() de field-policy.ts determina
   * el valor cuando esta prop está undefined.
   */
  editableByClient?: boolean
}

export interface SapcrSection {
  id: 1 | 2 | 3 | 4 | 5 | 6 | 7
  titleEs: string
  descriptionEs: string
  fields: FieldSpec[]
}

// ──────────────────────────────────────────────────────────────────
// Secciones
// ──────────────────────────────────────────────────────────────────

const SECTION_1: SapcrSection = {
  id: 1,
  titleEs: '1. Peticionario y datos de la corte',
  descriptionEs: 'Identificación del peticionario, número de causa (lo asigna el clerk al filing), corte y datos de identificación personal (DL/SSN parciales).',
  fields: [
    { semanticKey: 'case_cause_number', pdfFieldName: 'Cause Number', type: 'text', labelEs: 'Cause Number', helpEs: 'Dejar vacío al filing — lo asigna el clerk.', page: 1 },
    { semanticKey: 'case_court_number', pdfFieldName: 'Court Number', type: 'text', labelEs: 'Court Number', helpEs: 'Número del juzgado (ej. 245th, 246th, 312th). Si lo asigna el clerk, dejar vacío.', page: 1, deriveFrom: 'jurisdiction.court_number' },
    { semanticKey: 'case_court_type_district', pdfFieldName: 'District Court', type: 'checkbox', labelEs: 'District Court', helpEs: 'Marcar si es District Court.', page: 1, hardcoded: true },
    { semanticKey: 'case_court_type_county_at_law', pdfFieldName: 'County Court at Law of', type: 'checkbox', labelEs: 'County Court at Law of', page: 1 },
    { semanticKey: 'case_county', pdfFieldName: 'County Name', type: 'text', labelEs: 'County, Texas', helpEs: 'Condado donde se radica (ej. Harris).', page: 1, required: true, deriveFrom: 'jurisdiction.county' },

    { semanticKey: 'petitioner_full_name', pdfFieldName: 'Your Full Name', type: 'text', labelEs: 'Mi nombre completo (Petitioner)', page: 1, required: true, deriveFrom: 'petitioner.full_name' },
    { semanticKey: 'petitioner_dl_state', pdfFieldName: "Driver's License State", type: 'state', labelEs: 'Estado emisor de mi licencia de manejo', helpEs: 'Si no tiene DL, marcar "I do not have a drivers license".', page: 1, deriveFrom: 'petitioner.dl_state' },
    { semanticKey: 'petitioner_dl_1', pdfFieldName: 'DL 1', type: 'text', labelEs: 'DL — dígito 1 (de los últimos 3)', maxLength: 1, page: 1 },
    { semanticKey: 'petitioner_dl_2', pdfFieldName: 'DL 2', type: 'text', labelEs: 'DL — dígito 2', maxLength: 1, page: 1 },
    { semanticKey: 'petitioner_dl_3', pdfFieldName: 'DL 3', type: 'text', labelEs: 'DL — dígito 3', maxLength: 1, page: 1 },
    { semanticKey: 'petitioner_no_dl', pdfFieldName: 'I do not have a drivers license', type: 'checkbox', labelEs: 'No tengo licencia de manejo', page: 1, deriveFrom: 'petitioner.no_dl' },

    { semanticKey: 'petitioner_ssn_1', pdfFieldName: 'SSN 1', type: 'text', labelEs: 'SSN — dígito 1 (de los últimos 3)', maxLength: 1, page: 1, deriveFrom: 'petitioner.ssn_last3.0' },
    { semanticKey: 'petitioner_ssn_2', pdfFieldName: 'SSN 2', type: 'text', labelEs: 'SSN — dígito 2', maxLength: 1, page: 1, deriveFrom: 'petitioner.ssn_last3.1' },
    { semanticKey: 'petitioner_ssn_3', pdfFieldName: 'SSN 3', type: 'text', labelEs: 'SSN — dígito 3', maxLength: 1, page: 1, deriveFrom: 'petitioner.ssn_last3.2' },
    { semanticKey: 'petitioner_no_ssn', pdfFieldName: 'I do not have a social security number', type: 'checkbox', labelEs: 'No tengo Social Security Number', helpEs: 'Si tiene ITIN pero no SSN, marcar este campo.', page: 1, deriveFrom: 'petitioner.no_ssn' },

    { semanticKey: 'petitioner_relationship_to_child', pdfFieldName: 'Relationship to the Child(ren)', type: 'text', labelEs: 'Relación con el menor', helpEs: 'Ejemplo: mother (en inglés). Para SIJS típicamente "mother".', page: 1, required: true, deriveFrom: 'petitioner.relationship_en' },
  ],
}

const SECTION_2: SapcrSection = {
  id: 2,
  titleEs: '2. Información del menor',
  descriptionEs: 'Datos del menor (o menores). Hasta 5 hijos. Si solo hay 1, dejar 2-5 vacíos.',
  fields: [
    { semanticKey: 'child_1_initials', pdfFieldName: "Child's Initials 1", type: 'text', labelEs: 'Iniciales del menor 1', helpEs: 'Ej. B.Y.R.V. — Brandon Yair Ramirez Velasquez.', page: 1, required: true, deriveFrom: 'child_1.initials' },
    { semanticKey: 'child_1_full_name', pdfFieldName: "Child's Name 1", type: 'text', labelEs: 'Nombre completo del menor 1', page: 1, required: true, deriveFrom: 'child_1.full_name' },
    { semanticKey: 'child_1_dob', pdfFieldName: "Child's Date of Birth 1", type: 'date', labelEs: 'Fecha de nacimiento del menor 1', helpEs: 'Formato MM/DD/YYYY.', page: 1, required: true, deriveFrom: 'child_1.dob' },
    { semanticKey: 'child_1_lives_county_state', pdfFieldName: 'Where Child Lives 1', type: 'text', labelEs: 'Condado y estado donde vive el menor 1', helpEs: 'Ej. Harris County, Texas.', page: 1, required: true, deriveFrom: 'child_1.lives_county_state' },

    { semanticKey: 'child_2_initials', pdfFieldName: "Child's Initials 2", type: 'text', labelEs: 'Iniciales del menor 2', page: 1 },
    { semanticKey: 'child_2_full_name', pdfFieldName: "Child's Name 2", type: 'text', labelEs: 'Nombre completo del menor 2', page: 1 },
    { semanticKey: 'child_2_dob', pdfFieldName: "Child's Date of Birth 2", type: 'date', labelEs: 'Fecha de nacimiento del menor 2', page: 1 },
    { semanticKey: 'child_2_lives_county_state', pdfFieldName: 'Where Child Lives Now 2', type: 'text', labelEs: 'Condado y estado donde vive el menor 2', page: 1 },

    { semanticKey: 'child_3_initials', pdfFieldName: "Child's Initials 3", type: 'text', labelEs: 'Iniciales del menor 3', page: 1 },
    { semanticKey: 'child_3_full_name', pdfFieldName: "Child's Name 3", type: 'text', labelEs: 'Nombre completo del menor 3', page: 1 },
    { semanticKey: 'child_3_dob', pdfFieldName: "Child's Date of Birth 3", type: 'date', labelEs: 'Fecha de nacimiento del menor 3', page: 1 },
    { semanticKey: 'child_3_lives_county_state', pdfFieldName: 'Where Child Lives Now 3', type: 'text', labelEs: 'Condado y estado donde vive el menor 3', page: 1 },

    { semanticKey: 'child_4_initials', pdfFieldName: "Child's Initials 4", type: 'text', labelEs: 'Iniciales del menor 4', page: 1 },
    { semanticKey: 'child_4_full_name', pdfFieldName: "Child's Name 4", type: 'text', labelEs: 'Nombre completo del menor 4', page: 1 },
    { semanticKey: 'child_4_dob', pdfFieldName: "Child's Date of Birth 4", type: 'date', labelEs: 'Fecha de nacimiento del menor 4', page: 1 },
    { semanticKey: 'child_4_lives_county_state', pdfFieldName: 'Where Child Lives Now 4', type: 'text', labelEs: 'Condado y estado donde vive el menor 4', page: 1 },

    { semanticKey: 'child_5_initials', pdfFieldName: "Child's Initials 5", type: 'text', labelEs: 'Iniciales del menor 5', page: 1 },
    { semanticKey: 'child_5_full_name', pdfFieldName: "Child's Name 5", type: 'text', labelEs: 'Nombre completo del menor 5', page: 1 },
    { semanticKey: 'child_5_dob', pdfFieldName: "Child's Date of Birth 5", type: 'date', labelEs: 'Fecha de nacimiento del menor 5', page: 1 },
    { semanticKey: 'child_5_lives_county_state', pdfFieldName: 'Where Child Lives Now 5', type: 'text', labelEs: 'Condado y estado donde vive el menor 5', page: 1 },
  ],
}

const SECTION_3: SapcrSection = {
  id: 3,
  titleEs: '3. Standing — relación con el menor',
  descriptionEs: 'Por qué el peticionario tiene capacidad legal para presentar la petición (Texas Family Code §102.003). Para SIJS por madre biológica: marcar "Child(ren)\'s Mother".',
  fields: [
    { semanticKey: 'petitioner_not_related', pdfFieldName: 'Not related to the child(ren)', type: 'checkbox', labelEs: 'No estoy relacionado con el menor (peticionario no-pariente)', helpEs: 'NO marcar si es la madre/padre/abuelo.', page: 1, groupKey: 'standing_related' },
    { semanticKey: 'petitioner_related', pdfFieldName: 'Related to the Child(ren)', type: 'checkbox', labelEs: 'Estoy relacionado con el menor', helpEs: 'Para padre/madre/abuelo/tío/hermano.', page: 1, groupKey: 'standing_related' },

    { semanticKey: 'petitioner_standing_mother', pdfFieldName: "Child(ren)'s Mother", type: 'checkbox', labelEs: 'Soy la madre del menor', page: 2, deriveFrom: 'petitioner.standing.mother' },
    { semanticKey: 'petitioner_standing_father', pdfFieldName: "Child(ren)'s Father", type: 'checkbox', labelEs: 'Soy el padre legal del menor (con AOP firmado)', page: 2, deriveFrom: 'petitioner.standing.father' },
    { semanticKey: 'petitioner_standing_caregiver_6mo', pdfFieldName: 'Exclusive care, control, and possession for at least 6 months. Not a foster parent, relative, or designated caregiver', type: 'checkbox', labelEs: 'Cuidado exclusivo del menor por al menos 6 meses (no soy padre adoptivo/pariente)', page: 2, deriveFrom: 'petitioner.standing.caregiver_6mo' },
    { semanticKey: 'petitioner_standing_relative', pdfFieldName: 'Blood Relative', type: 'checkbox', labelEs: 'Soy familiar de sangre (abuelo/tío/hermano/sobrino)', page: 2, deriveFrom: 'petitioner.standing.relative' },
    { semanticKey: 'petitioner_standing_relative_both_parents_dead', pdfFieldName: 'Both Parents are Dead', type: 'checkbox', labelEs: 'Ambos padres están fallecidos', page: 2 },
    { semanticKey: 'petitioner_standing_relative_parents_agree', pdfFieldName: 'Agreed Filing', type: 'checkbox', labelEs: 'Ambos padres / managing conservator están de acuerdo', page: 2 },
    { semanticKey: 'petitioner_standing_relative_significant_impairment', pdfFieldName: 'Present circumstances will significantly harm the child(ren)', type: 'checkbox', labelEs: 'Las circunstancias actuales dañarán al menor significativamente', page: 2 },
    { semanticKey: 'petitioner_standing_other', pdfFieldName: 'Other Reason', type: 'checkbox', labelEs: 'Otra razón (explicar abajo)', page: 2 },
    { semanticKey: 'petitioner_standing_other_text', pdfFieldName: 'Other reason why you are allowed to file this case', type: 'textarea', labelEs: 'Explicación de la otra razón', page: 2 },
  ],
}

const SECTION_4: SapcrSection = {
  id: 4,
  titleEs: '4. Jurisdicción del menor',
  descriptionEs: 'Por qué Texas tiene jurisdicción sobre el menor (UCCJEA — Texas Family Code §152.201).',
  fields: [
    { semanticKey: 'jurisdiction_lived_tx_6mo', pdfFieldName: 'Children Live in Texas for at least 6 months or since birth', type: 'checkbox', labelEs: 'El menor vive en Texas y ha vivido aquí al menos 6 meses (o desde nacimiento)', page: 2, hardcoded: true, deriveFrom: 'jurisdiction.lived_tx_6mo' },
    { semanticKey: 'jurisdiction_not_in_tx_lt_6mo', pdfFieldName: 'Children do not live in Texas but have been gone less than 6 months', type: 'checkbox', labelEs: 'El menor NO vive en Texas pero ha estado fuera menos de 6 meses', page: 2 },
  ],
}

const SECTION_5: SapcrSection = {
  id: 5,
  titleEs: '5. Respondent A (padre/madre ausente)',
  descriptionEs: 'Datos del otro padre y modo de servicio (citation). Para SIJS típicamente padre ausente que vive fuera de TX. Respondent B/C/D se omiten — el form predetermina "No Respondent" para los demás.',
  fields: [
    { semanticKey: 'respondent_a_full_name', pdfFieldName: "Print Respondent A's Full Name", type: 'text', labelEs: "Nombre completo de Respondent A", page: 3, required: true, deriveFrom: 'respondent_a.full_name' },
    { semanticKey: 'respondent_a_is_mother', pdfFieldName: 'Mother', type: 'checkbox', labelEs: 'Respondent A es la madre del menor', page: 3, groupKey: 'respondent_a_relation' },
    { semanticKey: 'respondent_a_is_legal_father', pdfFieldName: 'Legal Father', type: 'checkbox', labelEs: 'Respondent A es el padre legal (con AOP)', page: 3, groupKey: 'respondent_a_relation' },
    { semanticKey: 'respondent_a_legal_father_children', pdfFieldName: 'Name of Child(ren) A is Legal Father', type: 'text', labelEs: 'Nombres de hijos para los que A es padre legal', page: 3 },
    { semanticKey: 'respondent_a_is_alleged_father', pdfFieldName: 'Alleged Father', type: 'checkbox', labelEs: 'Respondent A es el padre presunto (sin AOP)', page: 3, groupKey: 'respondent_a_relation', deriveFrom: 'respondent_a.is_alleged_father' },
    { semanticKey: 'respondent_a_alleged_father_children', pdfFieldName: 'Name of Child(ren) A is Alleged Father', type: 'text', labelEs: 'Nombres de hijos para los que A es padre presunto', page: 3, deriveFrom: 'respondent_a.alleged_father_children' },
    { semanticKey: 'respondent_a_is_other', pdfFieldName: 'Other Relationship', type: 'checkbox', labelEs: 'Otra relación de Respondent A', page: 3, groupKey: 'respondent_a_relation' },
    { semanticKey: 'respondent_a_is_other_text', pdfFieldName: 'Explain Other Relationship to the Child(ren)', type: 'text', labelEs: 'Explicar otra relación de Respondent A', page: 3 },

    { semanticKey: 'respondent_a_service_address', pdfFieldName: "Write Respondent A's Address", type: 'textarea', labelEs: 'Dirección para servicio (Sheriff/Constable/Process Server)', helpEs: 'Si no se conoce dirección, marcar "Cannot Find Respondent A" abajo.', page: 3, deriveFrom: 'respondent_a.service_address' },
    { semanticKey: 'respondent_a_service_business', pdfFieldName: 'Name of Business', type: 'text', labelEs: 'Nombre de negocio donde servir (si aplica)', page: 3 },
    { semanticKey: 'respondent_a_service_sheriff', pdfFieldName: 'Serve Respondent A', type: 'checkbox', labelEs: 'Servir mediante Sheriff/Constable/Process Server', page: 3, groupKey: 'respondent_a_service' },
    { semanticKey: 'respondent_a_waiver', pdfFieldName: 'Waiver of Service or Answer', type: 'checkbox', labelEs: 'Respondent A firmará Waiver of Service / responderá voluntariamente', page: 3, groupKey: 'respondent_a_service' },
    { semanticKey: 'respondent_a_publication', pdfFieldName: 'Cannot Find Respondent A', type: 'checkbox', labelEs: 'No se puede encontrar — solicitar service by publication', helpEs: 'Para SIJS donde el padre vive en otro país sin dirección conocida.', page: 3, groupKey: 'respondent_a_service', deriveFrom: 'respondent_a.publication' },

    { semanticKey: 'respondent_b_none', pdfFieldName: 'No Respondent B', type: 'checkbox', labelEs: 'No hay Respondent B', page: 3, hardcoded: true },
    { semanticKey: 'respondent_c_none', pdfFieldName: 'No Respondent C', type: 'checkbox', labelEs: 'No hay Respondent C', page: 4, hardcoded: true },
    { semanticKey: 'respondent_d_none', pdfFieldName: 'No Respondent D', type: 'checkbox', labelEs: 'No hay Respondent D', page: 5, hardcoded: true },

    // Out-of-state respondent (sec 6 del PDF)
    { semanticKey: 'oos_everyone_in_tx', pdfFieldName: 'Everyone in Texas', type: 'checkbox', labelEs: 'Todos los involucrados viven en Texas', page: 5, groupKey: 'oos' },
    { semanticKey: 'oos_party_lives_oos', pdfFieldName: 'A party lives out of state', type: 'checkbox', labelEs: 'Un party vive fuera de Texas', page: 5, groupKey: 'oos', deriveFrom: 'respondent_a.lives_outside_tx' },
    { semanticKey: 'oos_respondent_outside_tx_name', pdfFieldName: 'Print full name of the Out-of-State Respondent', type: 'text', labelEs: 'Nombre del respondent fuera de Texas', page: 5, deriveFrom: 'respondent_a.full_name_if_oos' },
    { semanticKey: 'oos_respondent_agrees', pdfFieldName: 'Respondent Agrees to Texas', type: 'checkbox', labelEs: 'El respondent fuera de TX acepta jurisdicción de Texas', page: 5 },
    { semanticKey: 'oos_children_in_tx_due_to_respondent', pdfFieldName: "Child(ren) Live in Texas Because of Respondent's Actions", type: 'checkbox', labelEs: 'El menor vive en Texas por acciones del respondent', page: 5 },
    { semanticKey: 'oos_respondent_lived_tx_with_children', pdfFieldName: 'The Respondent has lived in Texas with the children', type: 'checkbox', labelEs: 'El respondent ha vivido en Texas con el menor', page: 5 },
    { semanticKey: 'oos_respondent_provided_support_tx', pdfFieldName: 'The Respondent has lived in Texas and provided prenatal expenses or support', type: 'checkbox', labelEs: 'El respondent vivió en TX y dio prenatal expenses/support', page: 5 },
    { semanticKey: 'oos_respondent_intercourse_tx', pdfFieldName: 'The Respondent had sexual intercourse in Texas and the children may have', type: 'checkbox', labelEs: 'El respondent tuvo intercourse en TX y el menor pudo concebirse aquí', page: 5 },
    { semanticKey: 'oos_child_born_tx_paternity_registry', pdfFieldName: 'The child was born in Texas and the Respondent registered with the paternity', type: 'checkbox', labelEs: 'El menor nació en TX y respondent se registró en TX paternity registry', page: 5 },
    { semanticKey: 'oos_personal_service_tx', pdfFieldName: 'The Respondent will be personally served with citation in Texas', type: 'checkbox', labelEs: 'El respondent será servido personalmente en Texas', page: 5 },
  ],
}

const SECTION_6: SapcrSection = {
  id: 6,
  titleEs: '6. Conservatorship + visitación',
  descriptionEs: 'Quién tiene la custodia legal y reglas de visitación. Para SIJS recomendado: Mother Sole Managing Conservator + No Possession or Access para el padre ausente + Exclusive Right to Passports.',
  fields: [
    { semanticKey: 'conservator_a_joint', pdfFieldName: 'Joint Managing Conservators', type: 'checkbox', labelEs: 'Mother y Father como Joint Managing Conservators', helpEs: 'NO recomendado para SIJS (contradice el predicate finding de no-reunificación).', page: 5, groupKey: 'conservator' },

    // Geographic restrictions for joint MC father primary residence (omito porque hardcoded para SIJS)
    { semanticKey: 'conservator_b_mother_sole', pdfFieldName: 'Mother should be Sole Managing Conservator', type: 'checkbox', labelEs: 'Mother como Sole Managing Conservator', helpEs: 'CRÍTICO PARA SIJS — predicate finding INA §101(a)(27)(J)(i).', page: 6, groupKey: 'conservator', deriveFrom: 'sijs_defaults.mother_sole_mc' },
    { semanticKey: 'conservator_c_father_sole', pdfFieldName: 'Father Sole Managing Conservator', type: 'checkbox', labelEs: 'Father como Sole Managing Conservator', page: 6, groupKey: 'conservator' },
    { semanticKey: 'conservator_d_nonparent_sole', pdfFieldName: 'Nonparent Sole Managing Conservator', type: 'checkbox', labelEs: 'Nonparent como Sole Managing Conservator', page: 6, groupKey: 'conservator' },
    { semanticKey: 'conservator_d_nonparent_sole_name', pdfFieldName: 'Name of Nonparent Sole Managing Conservator', type: 'text', labelEs: 'Nombre del nonparent (Sole)', page: 6 },
    { semanticKey: 'conservator_e_nonparent_joint', pdfFieldName: 'Nonparent Joint Managing Conservators', type: 'checkbox', labelEs: 'Nonparents como Joint Managing Conservators', page: 6, groupKey: 'conservator' },
    { semanticKey: 'conservator_e_nonparent_joint_name_1', pdfFieldName: 'Name of First NonParent JMC', type: 'text', labelEs: 'Primer nonparent JMC', page: 6 },
    { semanticKey: 'conservator_e_nonparent_joint_name_2', pdfFieldName: 'Name of Second Nonparent JMC', type: 'text', labelEs: 'Segundo nonparent JMC', page: 6 },

    // Passport
    { semanticKey: 'passport_exclusive_right_petitioner', pdfFieldName: 'Exclusive Right to Passports', type: 'checkbox', labelEs: 'Solicito el derecho exclusivo de aplicar/renovar pasaportes del menor', helpEs: 'CRÍTICO PARA SIJS — sin esta cláusula USCIS puede pedir Acknowledgment del padre ausente.', page: 6, hardcoded: true, deriveFrom: 'sijs_defaults.exclusive_passport' },

    // Possession & access
    { semanticKey: 'possession_a_father_standard', pdfFieldName: 'Father SPO', type: 'checkbox', labelEs: 'Father con Standard Possession Order', page: 6, groupKey: 'possession' },
    { semanticKey: 'possession_b_mother_standard', pdfFieldName: 'Mother SPO', type: 'checkbox', labelEs: 'Mother con Standard Possession Order', page: 6, groupKey: 'possession' },
    { semanticKey: 'possession_c_unworkable', pdfFieldName: 'SPO Unworkable', type: 'checkbox', labelEs: 'SPO inviable — proponer schedule personalizado', helpEs: 'CRÍTICO PARA SIJS — usar para pedir No Possession o supervised.', page: 6, groupKey: 'possession', deriveFrom: 'sijs_defaults.spo_unworkable' },
    { semanticKey: 'possession_c_unworkable_text', pdfFieldName: 'Possession Orders', type: 'textarea', labelEs: 'Schedule de possession personalizado', helpEs: 'Texto sugerido para SIJS: "No possession or access by Father at this time given his complete abandonment of the child."', page: 6, deriveFrom: 'sijs_defaults.possession_text' },
    { semanticKey: 'possession_c_continued_text', pdfFieldName: 'Continued Possession Orders', type: 'textarea', labelEs: 'Continuación del schedule (si no cabe arriba)', page: 6 },
    { semanticKey: 'possession_d_under_3', pdfFieldName: 'Under the Age of 3 Schedule', type: 'checkbox', labelEs: 'Hay menor de 3 años (schedule especial)', page: 6 },
    { semanticKey: 'possession_d_under_3_text', pdfFieldName: 'Modified Possession Schedule for Child(ren) Under Age of Three', type: 'textarea', labelEs: 'Schedule modificado para menor de 3 años', page: 7 },

    // Safety
    { semanticKey: 'safety_concern', pdfFieldName: 'Safety Concern', type: 'checkbox', labelEs: 'Tengo preocupación por seguridad del menor', page: 6 },
    { semanticKey: 'safety_concern_father', pdfFieldName: 'Safety Concern with Father', type: 'checkbox', labelEs: 'Preocupación con el padre', page: 6, deriveFrom: 'sijs_defaults.safety_concern_father' },
    { semanticKey: 'safety_concern_mother', pdfFieldName: 'Safety Concern with Mother', type: 'checkbox', labelEs: 'Preocupación con la madre', page: 7 },
    { semanticKey: 'safety_e1_supervised_exchanges', pdfFieldName: 'Supervised or Public Exchange', type: 'checkbox', labelEs: 'Intercambios supervisados / lugar público', page: 7 },
    { semanticKey: 'safety_e2_limited_visitation', pdfFieldName: 'Limited Visitation', type: 'checkbox', labelEs: 'Visitación limitada', page: 7 },
    { semanticKey: 'safety_e3_supervised_visitation', pdfFieldName: 'Supervised Visitation', type: 'checkbox', labelEs: 'Visitación supervisada', page: 7 },
    { semanticKey: 'safety_e4_no_possession', pdfFieldName: 'No Possession or Access', type: 'checkbox', labelEs: 'Sin posesión ni acceso', helpEs: 'CRÍTICO PARA SIJS con padre ausente.', page: 7, deriveFrom: 'sijs_defaults.no_possession' },
    { semanticKey: 'safety_e5_no_alcohol_drugs', pdfFieldName: 'Alcohol and Illegal Drug Use 24 Hours prior', type: 'checkbox', labelEs: 'Sin alcohol/drogas 24h antes', page: 7 },
    { semanticKey: 'safety_e6_other', pdfFieldName: 'Other Restricted Possession and Access', type: 'checkbox', labelEs: 'Otra restricción', page: 7 },
    { semanticKey: 'safety_e6_text', pdfFieldName: 'Other restricted possession and access schedule', type: 'textarea', labelEs: 'Otra restricción — descripción', page: 7 },

    { semanticKey: 'international_kidnapping_concern', pdfFieldName: 'International Kidnapping Risk', type: 'checkbox', labelEs: 'Riesgo de secuestro internacional (passport hold)', helpEs: 'Recomendado para SIJS si el padre vive fuera de US.', page: 7, deriveFrom: 'sijs_defaults.kidnapping_concern' },
  ],
}

const SECTION_7: SapcrSection = {
  id: 7,
  titleEs: '7. Confidencialidad, seguros, propiedad y firma',
  descriptionEs: 'Protective orders, confidencialidad de la información del peticionario, propiedad del menor, seguros de salud/dental, beneficios públicos y firma.',
  fields: [
    // Protective orders
    { semanticKey: 'protective_order_none_petitioner', pdfFieldName: 'No Active or Pending Protective Order', type: 'checkbox', labelEs: 'No tengo ni pedí protective order', page: 7, deriveFrom: 'sijs_defaults.no_protective_order' },
    { semanticKey: 'protective_order_none_against_petitioner', pdfFieldName: 'No One Else has Active or Pending Protective Order Against Me', type: 'checkbox', labelEs: 'Nadie tiene ni pidió protective order contra mí', page: 7, deriveFrom: 'sijs_defaults.no_protective_order' },

    // Confidentiality (sec 12 del PDF)
    { semanticKey: 'confidentiality_request', pdfFieldName: 'Risk of harm if family information disclosed', type: 'checkbox', labelEs: 'Pido confidencialidad de mi información (riesgo de daño)', helpEs: 'CRÍTICO para SIJS donde el padre podría reaparecer.', page: 8, hardcoded: true, deriveFrom: 'sijs_defaults.confidentiality' },
    { semanticKey: 'confidentiality_home_address', pdfFieldName: 'home address', type: 'checkbox', labelEs: 'Confidencial: home address', page: 8, deriveFrom: 'sijs_defaults.confidentiality' },
    { semanticKey: 'confidentiality_mailing_address', pdfFieldName: 'mailing address', type: 'checkbox', labelEs: 'Confidencial: mailing address', page: 8, deriveFrom: 'sijs_defaults.confidentiality' },
    { semanticKey: 'confidentiality_employer', pdfFieldName: 'employer', type: 'checkbox', labelEs: 'Confidencial: employer', page: 8, deriveFrom: 'sijs_defaults.confidentiality' },
    { semanticKey: 'confidentiality_work_address', pdfFieldName: 'work address', type: 'checkbox', labelEs: 'Confidencial: work address', page: 8, deriveFrom: 'sijs_defaults.confidentiality' },
    { semanticKey: 'confidentiality_home_phone', pdfFieldName: 'home phone no', type: 'checkbox', labelEs: 'Confidencial: home phone', page: 8, deriveFrom: 'sijs_defaults.confidentiality' },
    { semanticKey: 'confidentiality_work_phone', pdfFieldName: 'work phone no', type: 'checkbox', labelEs: 'Confidencial: work phone', page: 8, deriveFrom: 'sijs_defaults.confidentiality' },
    { semanticKey: 'confidentiality_ssn', pdfFieldName: 'social security no', type: 'checkbox', labelEs: 'Confidencial: SSN', page: 8, deriveFrom: 'sijs_defaults.confidentiality' },
    { semanticKey: 'confidentiality_dl', pdfFieldName: 'drivers license no', type: 'checkbox', labelEs: "Confidencial: driver's license no", page: 8, deriveFrom: 'sijs_defaults.confidentiality' },
    { semanticKey: 'confidentiality_email', pdfFieldName: 'email address', type: 'checkbox', labelEs: 'Confidencial: email', page: 8, deriveFrom: 'sijs_defaults.confidentiality' },

    // Children's property
    { semanticKey: 'child_no_property', pdfFieldName: "No Child(ren)'s Property", type: 'checkbox', labelEs: 'El menor no tiene propiedad significativa', page: 8, hardcoded: true, deriveFrom: 'sijs_defaults.child_no_property' },
    { semanticKey: 'child_has_property', pdfFieldName: 'Child(ren) Own Property of Significant Value', type: 'checkbox', labelEs: 'El menor tiene propiedad significativa', page: 8 },
    { semanticKey: 'child_property_description', pdfFieldName: "Write Child(ren)'s Property", type: 'textarea', labelEs: 'Descripción de la propiedad', page: 8 },

    // Health insurance
    { semanticKey: 'health_ins_private', pdfFieldName: 'Private Health Insurance', type: 'checkbox', labelEs: 'El menor tiene seguro de salud privado', page: 8, groupKey: 'health_ins' },
    { semanticKey: 'health_ins_company', pdfFieldName: 'Name of Private Health Insurance Company', type: 'text', labelEs: 'Nombre de la aseguradora privada', page: 8 },
    { semanticKey: 'health_ins_policy_number', pdfFieldName: 'Health Insurance Policy Number', type: 'text', labelEs: 'Número de póliza', page: 8 },
    { semanticKey: 'health_ins_premium', pdfFieldName: 'Cost of Health Insurance Premium', type: 'text', labelEs: 'Costo del premium', page: 8 },
    { semanticKey: 'health_ins_payer', pdfFieldName: 'Name of person who pays for healt insurance', type: 'text', labelEs: 'Quien paga el seguro', page: 8 },
    { semanticKey: 'health_ins_through_work_yes', pdfFieldName: "Health insurance is available through parent's work", type: 'checkbox', labelEs: 'Disponible a través del trabajo del padre/madre', page: 8 },
    { semanticKey: 'health_ins_through_work_no', pdfFieldName: "Health insurance is NOT available through parent's work", type: 'checkbox', labelEs: 'NO disponible a través del trabajo', page: 8 },
    { semanticKey: 'health_ins_medicaid', pdfFieldName: 'Health Insurance Through Medicaid', type: 'checkbox', labelEs: 'El menor tiene Medicaid', page: 8, groupKey: 'health_ins', deriveFrom: 'minor.medicaid' },
    { semanticKey: 'health_ins_chip', pdfFieldName: 'Health Insurance Through C.H.I.P', type: 'checkbox', labelEs: 'El menor tiene CHIP', page: 8, groupKey: 'health_ins' },
    { semanticKey: 'health_ins_chip_premium', pdfFieldName: 'Cost of CHIP Premium (if any)', type: 'text', labelEs: 'Costo del CHIP premium', page: 8 },
    { semanticKey: 'health_ins_none', pdfFieldName: 'No Health Insurance', type: 'checkbox', labelEs: 'El menor no tiene seguro de salud', page: 8, groupKey: 'health_ins' },
    { semanticKey: 'health_ins_father_available', pdfFieldName: 'Private health insurance is available to Father', type: 'checkbox', labelEs: 'Seguro privado disponible al padre', page: 8 },
    { semanticKey: 'health_ins_father_not_available', pdfFieldName: 'Private health insurance is NOT available to Father', type: 'checkbox', labelEs: 'Seguro privado NO disponible al padre', page: 8, deriveFrom: 'sijs_defaults.health_father_unavailable' },
    { semanticKey: 'health_ins_mother_available', pdfFieldName: 'Private health insurance is available to Mother', type: 'checkbox', labelEs: 'Seguro privado disponible a la madre', page: 8 },
    { semanticKey: 'health_ins_mother_not_available', pdfFieldName: 'Private health insurance is NOT available to Mother', type: 'checkbox', labelEs: 'Seguro privado NO disponible a la madre', page: 8 },

    // Dental
    { semanticKey: 'dental_ins_private', pdfFieldName: 'Have Private Dental Insurance', type: 'checkbox', labelEs: 'El menor tiene seguro dental privado', page: 9, groupKey: 'dental_ins' },
    { semanticKey: 'dental_ins_company', pdfFieldName: 'Name of Dental Insurance Company', type: 'text', labelEs: 'Aseguradora dental', page: 9 },
    { semanticKey: 'dental_ins_policy_number', pdfFieldName: 'Dental Insurance Policy Number', type: 'text', labelEs: 'Número de póliza dental', page: 9 },
    { semanticKey: 'dental_ins_premium', pdfFieldName: 'Cost of Dental Premium', type: 'text', labelEs: 'Costo del dental premium', page: 9 },
    { semanticKey: 'dental_ins_payer', pdfFieldName: 'Name of person who pays for dental insurance', type: 'text', labelEs: 'Quien paga el seguro dental', page: 9 },
    { semanticKey: 'dental_ins_through_work_yes', pdfFieldName: "Dental is available through parent's work", type: 'checkbox', labelEs: 'Dental disponible a través del trabajo', page: 9 },
    { semanticKey: 'dental_ins_through_work_no', pdfFieldName: "Dental is NOT available through parent's work", type: 'checkbox', labelEs: 'Dental NO disponible a través del trabajo', page: 9 },
    { semanticKey: 'dental_ins_none', pdfFieldName: 'No Dental Insurance', type: 'checkbox', labelEs: 'Sin seguro dental', page: 9, groupKey: 'dental_ins' },
    { semanticKey: 'dental_ins_father_available', pdfFieldName: 'Private dental is available to Father', type: 'checkbox', labelEs: 'Dental privado disponible al padre', page: 9 },
    { semanticKey: 'dental_ins_father_not_available', pdfFieldName: 'Private dental is NOT available to Father', type: 'checkbox', labelEs: 'Dental privado NO disponible al padre', page: 9, deriveFrom: 'sijs_defaults.dental_father_unavailable' },
    { semanticKey: 'dental_ins_mother_available', pdfFieldName: 'Private dental is available to Mother', type: 'checkbox', labelEs: 'Dental privado disponible a la madre', page: 9 },
    { semanticKey: 'dental_ins_mother_not_available', pdfFieldName: 'Private dental is NOT available to Mother', type: 'checkbox', labelEs: 'Dental privado NO disponible a la madre', page: 9 },

    // Public benefits
    { semanticKey: 'child_medicaid_now_or_past', pdfFieldName: 'Child(ren) have or have had Medicaid', type: 'checkbox', labelEs: 'El menor tiene/tuvo Medicaid', helpEs: 'Si SÍ, hay obligación de servir Texas OAG Child Support Division.', page: 9, deriveFrom: 'minor.medicaid_now_or_past' },
    { semanticKey: 'child_tanf_now_or_past', pdfFieldName: 'Child(ren) get TANF now or in the past', type: 'checkbox', labelEs: 'El menor recibe/recibió TANF', page: 9 },

    // Signature
    { semanticKey: 'petitioner_signature', pdfFieldName: 'Your Signature', type: 'text', labelEs: 'Firma — escribir nombre completo (placeholder)', helpEs: 'El admin firmará a mano sobre la copia impresa.', page: 9, deriveFrom: 'petitioner.full_name' },
    { semanticKey: 'petition_signed_date', pdfFieldName: 'Date of Signature', type: 'date', labelEs: 'Fecha de la firma (Petition)', page: 9 },
    { semanticKey: 'petitioner_name_print', pdfFieldName: 'Your Full Name', type: 'text', labelEs: 'Nombre del peticionario (impreso)', page: 9, required: true, deriveFrom: 'petitioner.full_name' },
    { semanticKey: 'petitioner_phone', pdfFieldName: 'Your Phone Number', type: 'phone', labelEs: 'Teléfono del peticionario', page: 9, deriveFrom: 'petitioner.phone' },
    { semanticKey: 'petitioner_mailing_address', pdfFieldName: 'Mailing Address', type: 'text', labelEs: 'Mailing address (street, city, state, zip)', page: 9, required: true, deriveFrom: 'petitioner.full_address' },
    { semanticKey: 'petitioner_email', pdfFieldName: 'Email Address', type: 'text', labelEs: 'Email del peticionario', page: 9, deriveFrom: 'petitioner.email' },
    { semanticKey: 'petitioner_fax', pdfFieldName: 'Fax if available', type: 'text', labelEs: 'Fax (si tiene)', page: 9 },

    // Sec 18 OAG (only filed if Medicaid/TANF)
    { semanticKey: 'oag_signature', pdfFieldName: 'Your Signature_2', type: 'text', labelEs: 'Firma OAG (solo si Medicaid/TANF)', page: 10 },
    { semanticKey: 'oag_signed_date', pdfFieldName: 'Date of Signature_2', type: 'date', labelEs: 'Fecha firma OAG', page: 10 },
    { semanticKey: 'petitioner_name_print_oag', pdfFieldName: 'Your Full Name_2', type: 'text', labelEs: 'Nombre del peticionario (OAG cert)', page: 10 },
  ],
}

export const SAPCR_SECTIONS: SapcrSection[] = [SECTION_1, SECTION_2, SECTION_3, SECTION_4, SECTION_5, SECTION_6, SECTION_7]

// ──────────────────────────────────────────────────────────────────
// Map flat por semanticKey (acceso O(1))
// ──────────────────────────────────────────────────────────────────

export const ALL_FIELDS: FieldSpec[] = SAPCR_SECTIONS.flatMap((s) => s.fields)
export const FIELD_BY_KEY: Record<string, FieldSpec> = Object.fromEntries(
  ALL_FIELDS.filter((f) => f.pdfFieldName).map((f) => [f.semanticKey, f])
)

// ──────────────────────────────────────────────────────────────────
// Hardcoded SIJS values (universales para Petition by parent en SIJS)
// ──────────────────────────────────────────────────────────────────

export const HARDCODED_SIJS_VALUES: Record<string, string | boolean> = ALL_FIELDS.reduce(
  (acc, f) => {
    if (f.hardcoded !== undefined) acc[f.semanticKey] = f.hardcoded
    return acc
  },
  {} as Record<string, string | boolean>
)

// ──────────────────────────────────────────────────────────────────
// Zod schema (todos opcionales — la validación de "obligatorio para
// imprimir" se hace por separado con `requiredForPrint`).
// ──────────────────────────────────────────────────────────────────

const valueSchema = z.union([z.string(), z.boolean()]).optional().nullable()
const dynamicShape: Record<string, z.ZodTypeAny> = {}
for (const f of ALL_FIELDS) {
  dynamicShape[f.semanticKey] = valueSchema
}

export const sapcrFormSchema = z.object(dynamicShape)
export type SapcrFormValues = z.infer<typeof sapcrFormSchema>

/** Lista de campos que deben tener valor (no vacío) antes de imprimir el PDF. */
export const REQUIRED_FOR_PRINT: string[] = ALL_FIELDS.filter((f) => f.required).map((f) => f.semanticKey)

/** Valida que los campos obligatorios para imprimir tengan valor no vacío. */
export function validateRequiredForPrint(values: SapcrFormValues): { ok: boolean; missing: string[] } {
  const missing: string[] = []
  for (const key of REQUIRED_FOR_PRINT) {
    const v = (values as Record<string, unknown>)[key]
    if (v === undefined || v === null || v === '' || v === false) {
      missing.push(key)
    }
  }
  return { ok: missing.length === 0, missing }
}
