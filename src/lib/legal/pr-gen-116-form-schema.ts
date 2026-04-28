// Schema curado para PR-GEN-116 (Texas Civil Case Information Sheet, Rev 2/13).
// Aprobado por Texas Judicial Council. Obligatorio bajo Tex. R. Civ. P. 78a
// con toda petition original o post-judgment motion en family law.
//
// Pese al nombre del archivo (pr-gen-116), es un formulario del Texas Office of
// Court Administration — el prefijo `pr-gen-` es convencional, no de Puerto Rico.
//
// Re-correr scripts/normalize-pr-gen-116.mjs + scripts/inspect-pr-gen-116-fields.mjs
// si Texas publica una nueva revisión del PDF y actualizar PDF_SHA256.
//
// Misión: que el caso SIJS de Jennifer Velasquez (madre Pro Se en Harris County)
// pueda imprimir el CCIS pre-rellenado con sus datos consolidados ya en BD,
// sin que tenga que abrir Acrobat y llenar 144 campos a mano.

import { z } from 'zod'

// ──────────────────────────────────────────────────────────────────
// Constantes verificables al runtime
// ──────────────────────────────────────────────────────────────────

export const PDF_PUBLIC_PATH = '/forms/pr-gen-116.pdf'
export const PDF_DISK_PATH = 'public/forms/pr-gen-116.pdf'
// SHA-256 del PDF normalizado (post `scripts/normalize-pr-gen-116.mjs`).
// El PDF original de Texas usa object streams + encryption con password vacía
// que pdf-lib 1.17 no maneja; se normaliza una vez con mupdf y este hash es del
// resultado. Si Texas publica una nueva versión, re-correr ambos scripts.
export const PDF_SHA256 = '7e5c63b4b327dbe37285c309b040c31476ced3988832f7871e8f6ce51f6f8189'
export const SCHEMA_VERSION = '2013-02-rev'
export const FORM_SLUG = 'tx-pr-gen-116'
export const FORM_NAME = 'TX PR-GEN-116 Civil Case Information Sheet'
export const FORM_DESCRIPTION_ES = 'Hoja de Información de Caso Civil de Texas (CCIS) — obligatoria al iniciar SAPCR'

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
  | 'select'

export interface FieldOption {
  value: string
  labelEs: string
}

export interface FieldSpec {
  semanticKey: string
  /** Nombre EXACTO del field en el AcroForm. Si null, es virtual (no se serializa al PDF). */
  pdfFieldName: string | null
  type: FieldType
  labelEs: string
  helpEs?: string
  page?: number
  required?: boolean
  hardcoded?: string | boolean
  deriveFrom?: string
  groupKey?: string
  options?: FieldOption[]
  maxLength?: number
  /** Oculto por default en el modal (sólo visible cuando case_type === '__show_all__'). */
  hiddenByDefault?: boolean
}

export interface CcisSection {
  id: 1 | 2 | 3 | 4
  titleEs: string
  descriptionEs: string
  fields: FieldSpec[]
}

// ──────────────────────────────────────────────────────────────────
// SECCIÓN 1 — Caption + Contact + Parties
// ──────────────────────────────────────────────────────────────────

const SECTION_1: CcisSection = {
  id: 1,
  titleEs: '1. Identificación del caso, peticionario y partes',
  descriptionEs: 'Caption del caso, datos de contacto del peticionario, nombres de las partes y persona/entidad que completa la hoja.',
  fields: [
    // Caption (encabezado del juicio)
    { semanticKey: 'styled_caption', pdfFieldName: 'STYLED', type: 'text', labelEs: 'Caption del caso (Styled)', helpEs: 'Ej. "In the interest of B.Y.R.V., a child" — formato SAPCR estándar usando iniciales del menor.', page: 1, required: true, deriveFrom: 'caption.styled' },

    // Persona o entidad que completa
    { semanticKey: 'person_completing_attorney', pdfFieldName: 'Attorney for PlaintiffPetitioner', type: 'checkbox', labelEs: 'Attorney for Plaintiff/Petitioner', page: 1, groupKey: 'person_completing' },
    { semanticKey: 'person_completing_pro_se', pdfFieldName: 'Pro Se PlaintiffPetitioner', type: 'checkbox', labelEs: 'Pro Se Plaintiff/Petitioner', helpEs: 'CRÍTICO PARA SIJS — la peticionaria se representa a sí misma.', page: 1, groupKey: 'person_completing', hardcoded: true, deriveFrom: 'person_completing.pro_se' },
    { semanticKey: 'person_completing_titleivd', pdfFieldName: 'Title IVD Agency', type: 'checkbox', labelEs: 'Title IV-D Agency', helpEs: 'Sólo si el peticionario es Texas OAG Child Support Division.', page: 1, groupKey: 'person_completing' },
    { semanticKey: 'person_completing_other', pdfFieldName: 'Other', type: 'checkbox', labelEs: 'Other (especificar abajo)', page: 1, groupKey: 'person_completing' },
    { semanticKey: 'person_completing_other_text', pdfFieldName: 'undefined', type: 'text', labelEs: 'Otra (descripción)', page: 1 },

    // Datos de contacto del peticionario (Pro Se)
    { semanticKey: 'petitioner_name', pdfFieldName: 'Name', type: 'text', labelEs: 'Nombre del peticionario', page: 1, required: true, deriveFrom: 'petitioner.full_name' },
    { semanticKey: 'petitioner_email', pdfFieldName: 'Email', type: 'text', labelEs: 'Email', page: 1, deriveFrom: 'petitioner.email' },
    { semanticKey: 'petitioner_address', pdfFieldName: 'Address', type: 'text', labelEs: 'Dirección (calle)', page: 1, required: true, deriveFrom: 'petitioner.street' },
    { semanticKey: 'petitioner_city_state_zip', pdfFieldName: 'CityStateZip', type: 'text', labelEs: 'Ciudad, estado y ZIP', page: 1, required: true, deriveFrom: 'petitioner.city_state_zip' },
    { semanticKey: 'petitioner_phone', pdfFieldName: 'Telephone', type: 'phone', labelEs: 'Teléfono', page: 1, required: true, deriveFrom: 'petitioner.phone' },
    { semanticKey: 'petitioner_fax', pdfFieldName: 'Fax', type: 'text', labelEs: 'Fax (si tiene)', page: 1 },
    { semanticKey: 'petitioner_signature', pdfFieldName: 'Signature', type: 'text', labelEs: 'Firma (impresa)', helpEs: 'El admin firma a mano sobre la copia descargada — aquí se imprime el nombre.', page: 1, deriveFrom: 'petitioner.full_name' },
    { semanticKey: 'petitioner_state_bar_no', pdfFieldName: 'State Bar No', type: 'text', labelEs: 'Texas State Bar No', helpEs: 'Vacío si es Pro Se.', page: 1 },

    // Plaintiff(s)/Petitioner(s) — hasta 2 nombres
    { semanticKey: 'plaintiff_petitioner_1', pdfFieldName: 'PlaintiffsPetitioners 1', type: 'text', labelEs: 'Plaintiff/Petitioner #1', page: 1, required: true, deriveFrom: 'parties.plaintiff_1' },
    { semanticKey: 'plaintiff_petitioner_2', pdfFieldName: 'PlaintiffsPetitioners 2', type: 'text', labelEs: 'Plaintiff/Petitioner #2', page: 1 },

    // Defendant(s)/Respondent(s) — hasta 3 nombres
    { semanticKey: 'defendant_respondent_1', pdfFieldName: 'DefendantsRespondents 1', type: 'text', labelEs: 'Defendant/Respondent #1', page: 1, required: true, deriveFrom: 'parties.defendant_1' },
    { semanticKey: 'defendant_respondent_2', pdfFieldName: 'DefendantsRespondents 2', type: 'text', labelEs: 'Defendant/Respondent #2', page: 1 },
    { semanticKey: 'defendant_respondent_3', pdfFieldName: 'DefendantsRespondents 3', type: 'text', labelEs: 'Defendant/Respondent #3', page: 1 },

    // Additional parties in Child Support case
    { semanticKey: 'custodial_parent', pdfFieldName: 'Custodial Parent', type: 'text', labelEs: 'Custodial Parent', helpEs: 'Quien tiene derecho a decidir dónde vive el menor (peticionaria en SIJS por madre).', page: 1, deriveFrom: 'parties.custodial_parent' },
    { semanticKey: 'non_custodial_parent', pdfFieldName: 'NonCustodial Parent', type: 'text', labelEs: 'Non-Custodial Parent', helpEs: 'El otro padre (Respondent).', page: 1, deriveFrom: 'parties.non_custodial_parent' },
    { semanticKey: 'presumed_father', pdfFieldName: 'Presumed Father', type: 'text', labelEs: 'Presumed Father', helpEs: 'Vacío si no hay AOP firmado.', page: 1 },
  ],
}

// ──────────────────────────────────────────────────────────────────
// SECCIÓN 2 — Tipo de caso
//
// El PDF tiene ~80 checkboxes para que el filer marque UNO. La UI
// presenta un selector único `case_type` (virtual) con 5 opciones rápidas
// + "Mostrar todas". El campo virtual NO se escribe al PDF; en su lugar
// processForPrint() traduce el valor seleccionado al checkbox real.
// ──────────────────────────────────────────────────────────────────

/** Mapa virtual `case_type` → field name del checkbox real en el AcroForm. */
export const CASE_TYPE_TO_PDF_CHECKBOX: Record<string, string> = {
  // Family Law — Parent-Child Relationship (top-level SIJS)
  'family_law__parent_child__custody_or_visitation': 'Custody or Visitation',
  'family_law__parent_child__adoption_with_termination': 'AdoptionAdoption with',
  'family_law__parent_child__termination_of_parental_rights': 'Termination of Parental',
  'family_law__parent_child__child_protection': 'Child Protection',
  'family_law__parent_child__child_support': 'Child Support',
  'family_law__parent_child__gestational_parenting': 'Gestational Parenting',
  'family_law__parent_child__grandparent_access': 'Grandparent Access',
  'family_law__parent_child__parentage_paternity': 'ParentagePaternity',
  'family_law__parent_child__other': 'Other ParentChild',

  // Family Law — Marriage Relationship
  'family_law__marriage__annulment': 'undefined_2',
  'family_law__marriage__declare_void': 'undefined_3',

  // Family Law — Post-judgment (non-Title IV-D)
  'family_law__post_judgment__enforcement': 'Enforcement',
  'family_law__post_judgment__modification_custody': 'ModificationCustody',
  'family_law__post_judgment__modification_other': 'ModificationOther',

  // Family Law — Title IV-D
  'family_law__title_ivd__enforcement_modification': 'EnforcementModification',
  'family_law__title_ivd__paternity': 'Paternity',
  'family_law__title_ivd__reciprocals_uifsa': 'Reciprocals UIFSA',
  'family_law__title_ivd__support_order': 'Support Order',

  // Family Law — Other
  'family_law__other__enforce_foreign': 'Enforce Foreign',
  'family_law__other__habeas_corpus': 'Habeas Corpus',
  'family_law__other__name_change': 'Name Change',
  'family_law__other__protective_order': 'Protective Order',
  'family_law__other__removal_disabilities_minority': 'Removal of Disabilities',
  'family_law__other__other': 'Other_4',

  // Civil — Contract
  'civil__contract__consumer_dtpa': 'ConsumerDTPA',
  'civil__contract__debt_contract': 'DebtContract',
  'civil__contract__fraud_misrep': 'FraudMisrepresentation',
  'civil__contract__other_debt': 'Other DebtContract',
  'civil__contract__home_equity_expedited': 'Home EquityExpedited',
  'civil__contract__other_foreclosure': 'Other Foreclosure',
  'civil__contract__franchise': 'Franchise',
  'civil__contract__insurance': 'Insurance',
  'civil__contract__landlord_tenant': 'LandlordTenant',
  'civil__contract__non_competition': 'NonCompetition',
  'civil__contract__partnership': 'Partnership',
  'civil__contract__other_contract': 'Other Contract',

  // Civil — Injury or Damage
  'civil__injury__assault_battery': 'AssaultBattery',
  'civil__injury__construction': 'Construction',
  'civil__injury__defamation': 'Defamation',
  'civil__injury__malpractice_accounting': 'Accounting',
  'civil__injury__malpractice_legal': 'Legal',
  'civil__injury__malpractice_medical': 'Medical',
  'civil__injury__malpractice_other': 'Other Professional',
  'civil__injury__motor_vehicle': 'Motor Vehicle Accident',
  'civil__injury__premises': 'Premises',
  'civil__injury__product_asbestos': 'AsbestosSilica',
  'civil__injury__product_other': 'Other Product Liability',
  'civil__injury__other': 'Other Injury or Damage',

  // Civil — Real Property
  'civil__real_property__eminent_domain': 'Eminent Domain',
  'civil__real_property__partition': 'Partition',
  'civil__real_property__quiet_title': 'Quiet Title',
  'civil__real_property__trespass_to_try_title': 'Trespass to Try Title',
  'civil__real_property__other': 'Other Property',

  // Civil — Related to Criminal Matters
  'civil__criminal__expunction': 'Expunction',
  'civil__criminal__judgment_nisi': 'Judgment Nisi',
  'civil__criminal__non_disclosure': 'NonDisclosure',
  'civil__criminal__seizure_forfeiture': 'SeizureForfeiture',
  'civil__criminal__habeas_corpus_preindictment': 'Writ of Habeas Corpus',
  'civil__criminal__other': 'Other_2',

  // Employment
  'employment__discrimination': 'Discrimination',
  'employment__retaliation': 'Retaliation',
  'employment__termination': 'Termination',
  'employment__workers_comp': 'Workers Compensation',
  'employment__other': 'Other Employment',

  // Other Civil
  'other_civil__administrative_appeal': 'Administrative Appeal',
  'other_civil__antitrust_unfair': 'AntitrustUnfair',
  'other_civil__code_violations': 'Code Violations',
  'other_civil__foreign_judgment': 'Foreign Judgment',
  'other_civil__intellectual_property': 'Intellectual Property',
  'other_civil__lawyer_discipline': 'Lawyer Discipline',
  'other_civil__perpetuate_testimony': 'Perpetuate Testimony',
  'other_civil__securities_stock': 'toggle_73',
  'other_civil__tortious_interference': 'Tortious Interference',
  'other_civil__other': 'Other_3',

  // Tax
  'tax__appraisal': 'Tax Appraisal',
  'tax__delinquency': 'Tax Delinquency',
  'tax__other': 'toggle_86',

  // Probate & Mental Health
  'probate__dependent_administration': 'Dependent Administration',
  'probate__independent_administration': 'Independent Administration',
  'probate__other_estate': 'Other Estate Proceedings',
  'probate__guardianship_adult': 'GuardianshipAdult',
  'probate__guardianship_minor': 'GuardianshipMinor',
  'probate__mental_health': 'Mental Health',
  'probate__other': 'Other_5',
}

const CASE_TYPE_QUICK_OPTIONS: FieldOption[] = [
  { value: 'family_law__parent_child__custody_or_visitation', labelEs: 'Family Law → Parent-Child → Custody or Visitation (típico SIJS)' },
  { value: 'family_law__parent_child__termination_of_parental_rights', labelEs: 'Family Law → Parent-Child → Termination of Parental Rights' },
  { value: 'family_law__parent_child__adoption_with_termination', labelEs: 'Family Law → Parent-Child → Adoption with Termination' },
  { value: 'family_law__post_judgment__modification_custody', labelEs: 'Family Law → Post-judgment → Modification—Custody' },
  { value: 'family_law__other__name_change', labelEs: 'Family Law → Other → Name Change' },
  { value: '__show_all__', labelEs: '— Mostrar las 80 categorías —' },
]

/** Genera el array de field specs para los 80 checkboxes individuales (ocultos por default). */
function buildCaseTypeCheckboxes(): FieldSpec[] {
  return Object.entries(CASE_TYPE_TO_PDF_CHECKBOX).map(([virtualValue, pdfName]) => ({
    semanticKey: `case_type_cb_${virtualValue}`,
    pdfFieldName: pdfName,
    type: 'checkbox' as const,
    labelEs: CASE_TYPE_QUICK_OPTIONS.find((o) => o.value === virtualValue)?.labelEs
      ?? virtualValue.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    page: 1,
    hiddenByDefault: true,
  }))
}

const SECTION_2: CcisSection = {
  id: 2,
  titleEs: '2. Tipo de caso (selecciona 1)',
  descriptionEs: 'El PDF requiere marcar UNA categoría. Para casos SIJS via SAPCR la opción correcta es "Family Law → Parent-Child → Custody or Visitation". Si necesitas otra categoría, elige "Mostrar las 80" para ver todas.',
  fields: [
    {
      semanticKey: 'case_type',
      pdfFieldName: null,
      type: 'select',
      labelEs: 'Categoría del caso',
      helpEs: 'Sólo una opción. Para SIJS via SAPCR (custodia de no-padre o de la madre buscando sole MC), usa "Custody or Visitation".',
      page: 1,
      required: true,
      hardcoded: 'family_law__parent_child__custody_or_visitation',
      options: CASE_TYPE_QUICK_OPTIONS,
    },

    // Textos libres asociados a opciones "Other:_____" — sólo para casos atípicos
    { semanticKey: 'case_type_other_contract_text', pdfFieldName: 'undefined_6', type: 'text', labelEs: 'Other Contract — descripción', page: 1, hiddenByDefault: true },
    { semanticKey: 'case_type_foreclosure_text', pdfFieldName: 'Foreclosure', type: 'text', labelEs: 'Foreclosure — texto', page: 1, hiddenByDefault: true },
    { semanticKey: 'case_type_liability_text', pdfFieldName: 'Liability', type: 'text', labelEs: 'Other Professional Liability — descripción', page: 1, hiddenByDefault: true },
    { semanticKey: 'case_type_list_product_1', pdfFieldName: 'List Product 1', type: 'text', labelEs: 'Product Liability — producto (línea 1)', page: 1, hiddenByDefault: true },
    { semanticKey: 'case_type_list_product_2', pdfFieldName: 'List Product 2', type: 'text', labelEs: 'Product Liability — producto (línea 2)', page: 1, hiddenByDefault: true },
    { semanticKey: 'case_type_other_injury_text', pdfFieldName: 'undefined_7', type: 'text', labelEs: 'Other Injury or Damage — descripción', page: 1, hiddenByDefault: true },
    { semanticKey: 'case_type_other_property_text', pdfFieldName: 'undefined_8', type: 'text', labelEs: 'Other Property — descripción', page: 1, hiddenByDefault: true },
    { semanticKey: 'case_type_preindictment_text', pdfFieldName: 'Preindictment', type: 'text', labelEs: 'Habeas Corpus pre-indictment — descripción', page: 1, hiddenByDefault: true },
    { semanticKey: 'case_type_other_criminal_text', pdfFieldName: 'undefined_10', type: 'text', labelEs: 'Other (Related to Criminal) — descripción', page: 1, hiddenByDefault: true },
    { semanticKey: 'case_type_other_family_text', pdfFieldName: 'undefined_11', type: 'text', labelEs: 'Other (Other Family Law) — descripción', page: 1, hiddenByDefault: true },
    { semanticKey: 'case_type_other_employment_text', pdfFieldName: 'undefined_12', type: 'text', labelEs: 'Other Employment — descripción', page: 1, hiddenByDefault: true },
    { semanticKey: 'case_type_other_civil_text', pdfFieldName: 'undefined_9', type: 'text', labelEs: 'Other (Other Civil / Tax / Probate) — descripción', page: 1, hiddenByDefault: true },

    // Los 80 checkboxes individuales — ocultos por default; se muestran cuando case_type === '__show_all__'
    ...buildCaseTypeCheckboxes(),
  ],
}

// ──────────────────────────────────────────────────────────────────
// SECCIÓN 3 — Procedure or remedy (multi-select, opcional)
// ──────────────────────────────────────────────────────────────────

const SECTION_3: CcisSection = {
  id: 3,
  titleEs: '3. Procedimiento o remedio (puedes marcar más de uno)',
  descriptionEs: 'Sólo si el caso requiere remedios procesales adicionales. Para SIJS estándar — vacío.',
  fields: [
    { semanticKey: 'procedure_appeal_municipal', pdfFieldName: 'Appeal from Municipal or Justice Court', type: 'checkbox', labelEs: 'Appeal from Municipal or Justice Court', page: 1 },
    { semanticKey: 'procedure_arbitration_related', pdfFieldName: 'Arbitrationrelated', type: 'checkbox', labelEs: 'Arbitration-related', page: 1 },
    { semanticKey: 'procedure_attachment', pdfFieldName: 'Attachment', type: 'checkbox', labelEs: 'Attachment', page: 1 },
    { semanticKey: 'procedure_bill_of_review', pdfFieldName: 'Bill of Review', type: 'checkbox', labelEs: 'Bill of Review', page: 1 },
    { semanticKey: 'procedure_certiorari', pdfFieldName: 'Certiorari', type: 'checkbox', labelEs: 'Certiorari', page: 1 },
    { semanticKey: 'procedure_class_action', pdfFieldName: 'Class Action', type: 'checkbox', labelEs: 'Class Action', page: 1 },
    { semanticKey: 'procedure_declaratory_judgment', pdfFieldName: 'Declaratory Judgment', type: 'checkbox', labelEs: 'Declaratory Judgment', page: 1 },
    { semanticKey: 'procedure_garnishment', pdfFieldName: 'Garnishment', type: 'checkbox', labelEs: 'Garnishment', page: 1 },
    { semanticKey: 'procedure_interpleader', pdfFieldName: 'Interpleader', type: 'checkbox', labelEs: 'Interpleader', page: 1 },
    { semanticKey: 'procedure_license', pdfFieldName: 'License', type: 'checkbox', labelEs: 'License', page: 1 },
    { semanticKey: 'procedure_mandamus', pdfFieldName: 'Mandamus', type: 'checkbox', labelEs: 'Mandamus', page: 1 },
    { semanticKey: 'procedure_post_judgment', pdfFieldName: 'Postjudgment', type: 'checkbox', labelEs: 'Post-judgment', page: 1 },
    { semanticKey: 'procedure_prejudgment_remedy', pdfFieldName: 'Prejudgment Remedy', type: 'checkbox', labelEs: 'Prejudgment Remedy', page: 1 },
    { semanticKey: 'procedure_protective_order', pdfFieldName: 'Protective Order_2', type: 'checkbox', labelEs: 'Protective Order', page: 1 },
    { semanticKey: 'procedure_receiver', pdfFieldName: 'Receiver', type: 'checkbox', labelEs: 'Receiver', page: 1 },
    { semanticKey: 'procedure_sequestration', pdfFieldName: 'Sequestration', type: 'checkbox', labelEs: 'Sequestration', page: 1 },
    { semanticKey: 'procedure_tro_injunction', pdfFieldName: 'Temporary Restraining OrderInjunction', type: 'checkbox', labelEs: 'Temporary Restraining Order / Injunction', page: 1 },
    { semanticKey: 'procedure_turnover', pdfFieldName: 'Turnover', type: 'checkbox', labelEs: 'Turnover', page: 1 },
  ],
}

// ──────────────────────────────────────────────────────────────────
// SECCIÓN 4 — Damages sought (NO seleccionar para family law)
// ──────────────────────────────────────────────────────────────────

const SECTION_4: CcisSection = {
  id: 4,
  titleEs: '4. Daños buscados',
  descriptionEs: 'NO se selecciona si es family law (como SIJS via SAPCR). Sólo para casos civiles tradicionales.',
  fields: [
    { semanticKey: 'damages_lt_100k', pdfFieldName: 'Less than 100000 including damages of any kind penalties costs expenses prejudgment interest and attorney fees', type: 'checkbox', labelEs: 'Less than $100,000 (incluyendo penalties, costs, fees)', page: 1, groupKey: 'damages' },
    { semanticKey: 'damages_lt_100k_nonmonetary', pdfFieldName: 'Less than 100000 and nonmonetary relief', type: 'checkbox', labelEs: 'Less than $100,000 + non-monetary relief', page: 1, groupKey: 'damages' },
    { semanticKey: 'damages_100k_200k', pdfFieldName: 'Over 100 000 but not more than 200000', type: 'checkbox', labelEs: 'Over $100,000 hasta $200,000', page: 1, groupKey: 'damages' },
    { semanticKey: 'damages_200k_1m', pdfFieldName: 'Over 200000 but not more than 1000000', type: 'checkbox', labelEs: 'Over $200,000 hasta $1,000,000', page: 1, groupKey: 'damages' },
    { semanticKey: 'damages_gt_1m', pdfFieldName: 'Over 1000000', type: 'checkbox', labelEs: 'Over $1,000,000', page: 1, groupKey: 'damages' },
  ],
}

// ──────────────────────────────────────────────────────────────────
// Export master
// ──────────────────────────────────────────────────────────────────

export const CCIS_SECTIONS: CcisSection[] = [SECTION_1, SECTION_2, SECTION_3, SECTION_4]

export const ALL_FIELDS: FieldSpec[] = CCIS_SECTIONS.flatMap((s) => s.fields)
export const FIELD_BY_KEY: Record<string, FieldSpec> = Object.fromEntries(
  ALL_FIELDS.map((f) => [f.semanticKey, f])
)

export const HARDCODED_VALUES: Record<string, string | boolean> = ALL_FIELDS.reduce(
  (acc, f) => {
    if (f.hardcoded !== undefined) acc[f.semanticKey] = f.hardcoded
    return acc
  },
  {} as Record<string, string | boolean>
)

const valueSchema = z.union([z.string(), z.boolean()]).optional().nullable()
const dynamicShape: Record<string, z.ZodTypeAny> = {}
for (const f of ALL_FIELDS) {
  dynamicShape[f.semanticKey] = valueSchema
}

export const ccisFormSchema = z.object(dynamicShape)
export type CcisFormValues = z.infer<typeof ccisFormSchema>

export const REQUIRED_FOR_PRINT: string[] = ALL_FIELDS.filter((f) => f.required).map((f) => f.semanticKey)

/**
 * Procesa los valores antes de pasarlos al endpoint de impresión.
 *
 * Traduce el campo virtual `case_type` (string) al checkbox real
 * correspondiente del PDF (boolean). Sin esto, el PDF saldría sin
 * marcar el tipo de caso (porque `case_type` tiene pdfFieldName: null).
 */
export function processForPrint(
  values: Record<string, string | boolean | null | undefined>
): Record<string, string | boolean | null | undefined> {
  const out = { ...values }
  const ct = values.case_type
  if (typeof ct === 'string' && ct !== '' && ct !== '__show_all__') {
    // Marcar el checkbox correspondiente según el mapeo virtual.
    const checkboxSemKey = `case_type_cb_${ct}`
    out[checkboxSemKey] = true
  }
  // Limpiar el campo virtual para que no termine en valuesByPdfName (es null pdfFieldName, ya se ignora,
  // pero lo dejamos explícito por claridad).
  return out
}
