import { PDFDocument } from 'pdf-lib'

// ============================================================================
// HELPERS DE NORMALIZACIÓN
// ============================================================================

/** Extrae solo dígitos (para SSN, A-Number, I-94 Number). */
const digitsOnly = (v: any): string => String(v ?? '').replace(/\D/g, '')

/**
 * Tolera múltiples formatos de valor "Sí":
 * 'Sí', 'Si', 'sí', 'si', 'yes', 'Yes', 'true', true, 1, '1'.
 * El wizard guarda 'Sí' pero defendemos contra futuros cambios de formato.
 */
function isYes(v: any): boolean {
  if (v === true || v === 1) return true
  const s = String(v ?? '').trim().toLowerCase()
  return s === 'sí' || s === 'si' || s === 'yes' || s === 'true' || s === '1'
}

/** Tolera múltiples formatos de valor "No". */
function isNo(v: any): boolean {
  if (v === false || v === 0) return true
  const s = String(v ?? '').trim().toLowerCase()
  return s === 'no' || s === 'false' || s === '0'
}

// ============================================================================
// MAPEO DE CAMPOS DE TEXTO (46 campos)
// Casi todos son 1:1 con las claves del form_data porque los nombres del PDF
// fueron renombrados para coincidir. Solo hay algunas excepciones.
// ============================================================================

type TextFieldEntry = {
  dataKey: string
  transform?: (value: any) => string
}

const TEXT_FIELD_MAP: Record<string, TextFieldEntry> = {
  // Part 1 — Peticionario
  last_name:          { dataKey: 'petitioner_last_name' },
  first_name:         { dataKey: 'petitioner_first_name' },
  middle_name:        { dataKey: 'petitioner_middle_name' },
  ssn:                { dataKey: 'petitioner_ssn',      transform: digitsOnly },
  arn:                { dataKey: 'petitioner_a_number', transform: digitsOnly },
  petitioner_address: { dataKey: 'petitioner_address' },
  petitioner_city:    { dataKey: 'petitioner_city' },
  petitioner_state:   { dataKey: 'petitioner_state' },
  petitioner_zip:     { dataKey: 'petitioner_zip' },

  // Part 1 cont — Dirección segura
  safe_mailing_name:    { dataKey: 'safe_mailing_name' },
  safe_mailing_address: { dataKey: 'safe_mailing_address' },
  safe_mailing_city:    { dataKey: 'safe_mailing_city' },
  safe_mailing_state:   { dataKey: 'safe_mailing_state' },
  safe_mailing_zip:     { dataKey: 'safe_mailing_zip' },

  // Part 3 — Beneficiario (menor)
  beneficiary_last_name:           { dataKey: 'beneficiary_last_name' },
  beneficiary_first_name:          { dataKey: 'beneficiary_first_name' },
  beneficiary_middle_name:         { dataKey: 'beneficiary_middle_name' },
  other_names:                     { dataKey: 'other_names' },
  beneficiary_address:             { dataKey: 'beneficiary_address' },
  beneficiary_city:                { dataKey: 'beneficiary_city' },
  beneficiary_state:               { dataKey: 'beneficiary_state' },
  beneficiary_zip:                 { dataKey: 'beneficiary_zip' },
  beneficiary_dob:                 { dataKey: 'beneficiary_dob' },
  beneficiary_country_birth:       { dataKey: 'beneficiary_country_birth' },
  beneficiary_ssn:                 { dataKey: 'beneficiary_ssn',      transform: digitsOnly },
  beneficiary_a_number:            { dataKey: 'beneficiary_a_number', transform: digitsOnly },
  beneficiary_city_birth:          { dataKey: 'beneficiary_city_birth' },
  beneficiary_i94_number:          { dataKey: 'beneficiary_i94_number', transform: digitsOnly },
  beneficiary_passport_number:     { dataKey: 'beneficiary_passport_number' },
  beneficiary_passport_country:    { dataKey: 'beneficiary_passport_country' },
  beneficiary_nonimmigrant_status: { dataKey: 'beneficiary_nonimmigrant_status' },
  beneficiary_passport_expiry:     { dataKey: 'beneficiary_passport_expiry' },
  beneficiary_status_expiry:       { dataKey: 'beneficiary_status_expiry' },

  // Part 4 — Padre/Madre extranjero
  foreign_parent_last_name:   { dataKey: 'foreign_parent_last_name' },
  foreign_parent_first_name:  { dataKey: 'foreign_parent_first_name' },
  foreign_parent_middle_name: { dataKey: 'foreign_parent_middle_name' },
  foreign_parent_address:     { dataKey: 'foreign_parent_address' },
  foreign_parent_city:        { dataKey: 'foreign_parent_city' },
  foreign_parent_province:    { dataKey: 'foreign_parent_province' },
  foreign_parent_postal:      { dataKey: 'foreign_parent_postal' },
  foreign_parent_country:     { dataKey: 'foreign_parent_country' },

  // Part 8 — SIJS (2B. Nombre de la agencia estatal/corte)
  // El campo PDF se llama "department_juice" (nombre interno) pero contiene
  // el dato de state_agency_name del wizard.
  department_juice: { dataKey: 'state_agency_name' },

  // Part 11 — Contacto
  petitioner_phone:  { dataKey: 'petitioner_phone' },
  petitioner_mobile: { dataKey: 'petitioner_mobile' },
  petitioner_email:  { dataKey: 'petitioner_email' },

  // Info adicional (textarea final)
  additional_info: { dataKey: 'additional_info' },
}

// ============================================================================
// CHECKBOXES YES/NO (11 pares = 22 checkboxes)
// Formato: [nombrePDF_Sí, nombrePDF_No, claveEnFormData]
// ============================================================================

const YES_NO_MAP: Array<[string, string, string]> = [
  ['in_removal_yes',               'in_removal_no',               'in_removal_proceedings'],
  ['other_petitions_yes',          'other_petitions_no',          'other_petitions'],
  ['worked_without_permission_yes','worked_without_permission_no','worked_without_permission'],
  ['adjustment_attached_yes',      'adjustment_attached_no',      'adjustment_attached'],
  ['children_filed_yes',           'children_filed_no',           'children_filed_separate'],
  ['declared_dependent_yes',       'declared_dependent_no',       'declared_dependent_court'],
  ['under_jurisdiction_yes',       'under_jurisdiction_no',       'currently_under_jurisdiction'],
  ['court_placement_yes',          'court_placement_no',          'in_court_ordered_placement'],
  ['best_interest_return_yes',     'best_interest_return_no',     'best_interest_not_return'],
  ['hhs_custody_yes',              'hhs_custody_no',              'previously_hhs_custody'],
  ['interpreter_yes',              'interpreter_no',              'interpreter_needed'],
]

// ============================================================================
// CHECKBOXES RADIO-LIKE (solo uno marcado por grupo)
// ============================================================================

/** Sexo — 2 opciones mutuamente exclusivas. */
const SEX_MAP: Record<string, string> = {
  Masculino: 'sex_male',
  Femenino:  'sex_female',
}

/** Estado civil — 4 opciones mutuamente exclusivas. */
const MARITAL_MAP: Record<string, string> = {
  'Soltero/a':    'marital_single',
  'Casado/a':     'marital_married',
  'Divorciado/a': 'marital_divorced',
  'Viudo/a':      'marital_widowed',
}

// ============================================================================
// PARSER DE REUNIFICACIÓN SIJS (5 checkboxes)
// El wizard guarda reunification_not_viable_reason como CSV estructurado:
//   "Uno de mis padres, Abuse, Neglect"
//   "Ambos padres, Abandonment"
// ============================================================================

function parseReunificationReason(raw: any): Set<string> {
  const result = new Set<string>()
  if (!raw) return result

  const parts = String(raw).split(',').map((s) => s.trim())

  if (parts.includes('Uno de mis padres')) result.add('juvenile_court_one')
  if (parts.includes('Ambos padres'))      result.add('juvenile_court_both')
  if (parts.includes('Abuse'))             result.add('juvenile_court_abuse')
  if (parts.includes('Neglect'))           result.add('juvenile_court_neglect')
  if (parts.includes('Abandonment'))       result.add('juvenile_court_abandonment')

  return result
}

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================

export async function generateI360PDF(
  formData: Record<string, any>,
): Promise<Uint8Array> {
  const response = await fetch('/forms/i-360.pdf')
  if (!response.ok) {
    throw new Error(`No se pudo cargar la plantilla I-360: ${response.statusText}`)
  }
  const templateBytes = await response.arrayBuffer()

  const pdfDoc = await PDFDocument.load(templateBytes)
  const form = pdfDoc.getForm()

  // --- 1. Campos de texto ---
  for (const [pdfName, entry] of Object.entries(TEXT_FIELD_MAP)) {
    const raw = formData[entry.dataKey]
    if (raw == null || raw === '') continue

    const value = entry.transform ? entry.transform(raw) : String(raw)
    if (!value) continue

    try {
      const field = form.getTextField(pdfName)
      const maxLength = field.getMaxLength()
      const finalValue = maxLength != null ? value.substring(0, maxLength) : value
      field.setText(finalValue)
    } catch (err: any) {
      console.warn(`No se llenó el campo texto "${pdfName}": ${err.message}`)
    }
  }

  // --- Helper para marcar checkboxes con logging tolerante ---
  const checkBox = (name: string): void => {
    try {
      form.getCheckBox(name).check()
    } catch (err: any) {
      console.warn(`No se marcó el checkbox "${name}": ${err.message}`)
    }
  }

  // --- 2. Checkboxes Yes/No (11 pares) ---
  for (const [yesName, noName, dataKey] of YES_NO_MAP) {
    const v = formData[dataKey]
    if (isYes(v)) checkBox(yesName)
    else if (isNo(v)) checkBox(noName)
  }

  // --- 3. Sexo (radio-like) ---
  const sexField = SEX_MAP[formData.beneficiary_sex]
  if (sexField) checkBox(sexField)

  // --- 4. Estado civil (radio-like) ---
  const maritalField = MARITAL_MAP[formData.beneficiary_marital_status]
  if (maritalField) checkBox(maritalField)

  // --- 5. Reunificación SIJS (5 checkboxes parseados de un CSV) ---
  const reunifSet = parseReunificationReason(formData.reunification_not_viable_reason)
  reunifSet.forEach(checkBox)

  // --- 6. Aplanar y guardar ---
  form.flatten()
  return pdfDoc.save()
}

// ============================================================================
// NOTA: Campos del wizard que NO tienen campo en el PDF actual
// ============================================================================
// Estos datos los llena el cliente en el wizard pero no se escriben en el PDF
// porque no existe el campo correspondiente en el template. Agregarlos en el
// PDF editor si se necesitan:
//   - petitioner_country, language_understood, other_petitions_count
//   - beneficiary_last_arrival_date, beneficiary_i94_expiry
//   - placement_reason, parent_names_not_viable, hhs_court_order
//   - spouse_child_1_* (last_name, first_name, middle_name, dob, country,
//                       relationship, a_number)
