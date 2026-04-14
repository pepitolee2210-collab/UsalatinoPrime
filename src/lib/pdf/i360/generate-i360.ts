import { PDFDocument, PDFTextField, PDFCheckBox, PDFName } from 'pdf-lib'

// ============================================================================
// HELPERS
// ============================================================================

/** Extrae solo dígitos (para SSN, A-Number, I-94 Number). */
const digitsOnly = (v: any): string => String(v ?? '').replace(/\D/g, '')

/**
 * Convierte fecha ISO yyyy-mm-dd → mm/dd/yyyy (formato USCIS).
 * Si el valor ya está en otro formato, lo devuelve tal cual.
 */
function formatDate(v: any): string {
  const s = String(v ?? '')
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return `${m[2]}/${m[3]}/${m[1]}`
  return s
}

/** Tolera múltiples formatos de "Sí": 'Sí','Si','sí','yes','true',true,1. */
function isYes(v: any): boolean {
  if (v === true || v === 1) return true
  const s = String(v ?? '').trim().toLowerCase()
  return s === 'sí' || s === 'si' || s === 'yes' || s === 'true' || s === '1'
}

/** Tolera múltiples formatos de "No": 'No','no','false',false,0. */
function isNo(v: any): boolean {
  if (v === false || v === 0) return true
  const s = String(v ?? '').trim().toLowerCase()
  return s === 'no' || s === 'false' || s === '0'
}

// ============================================================================
// MAPEO DE CAMPOS DE TEXTO (46 campos)
// ============================================================================

type TextFieldEntry = {
  dataKey: string
  transform?: (value: any) => string
}

const TEXT_FIELD_MAP: Record<string, TextFieldEntry> = {
  // ---- Pág.1 — Part 1: Peticionario ----
  last_name:          { dataKey: 'petitioner_last_name' },
  first_name:         { dataKey: 'petitioner_first_name' },
  middle_name:        { dataKey: 'petitioner_middle_name' },
  ssn:                { dataKey: 'petitioner_ssn',      transform: digitsOnly },
  arn:                { dataKey: 'petitioner_a_number', transform: digitsOnly },
  petitioner_address: { dataKey: 'petitioner_address' },
  petitioner_city:    { dataKey: 'petitioner_city' },
  petitioner_state:   { dataKey: 'petitioner_state' },
  petitioner_zip:     { dataKey: 'petitioner_zip' },

  // ---- Pág.2 — Dirección segura ----
  safe_mailing_name:    { dataKey: 'safe_mailing_name' },
  safe_mailing_address: { dataKey: 'safe_mailing_address' },
  safe_mailing_city:    { dataKey: 'safe_mailing_city' },
  safe_mailing_state:   { dataKey: 'safe_mailing_state' },
  safe_mailing_zip:     { dataKey: 'safe_mailing_zip' },

  // ---- Pág.3 — Part 3: Beneficiario (menor) ----
  beneficiary_last_name:           { dataKey: 'beneficiary_last_name' },
  beneficiary_first_name:          { dataKey: 'beneficiary_first_name' },
  beneficiary_middle_name:         { dataKey: 'beneficiary_middle_name' },
  other_names:                     { dataKey: 'other_names' },
  beneficiary_address:             { dataKey: 'beneficiary_address' },
  beneficiary_city:                { dataKey: 'beneficiary_city' },
  beneficiary_state:               { dataKey: 'beneficiary_state' },
  beneficiary_zip:                 { dataKey: 'beneficiary_zip' },
  beneficiary_dob:                 { dataKey: 'beneficiary_dob',             transform: formatDate },
  beneficiary_country_birth:       { dataKey: 'beneficiary_country_birth' },
  beneficiary_ssn:                 { dataKey: 'beneficiary_ssn',             transform: digitsOnly },
  beneficiary_a_number:            { dataKey: 'beneficiary_a_number',        transform: digitsOnly },
  // FIX: El campo PDF "beneficiary_city_birth" está posicionado donde va
  //      "Fecha de última llegada" en el formulario oficial I-360.
  beneficiary_city_birth:          { dataKey: 'beneficiary_last_arrival_date', transform: formatDate },
  beneficiary_i94_number:          { dataKey: 'beneficiary_i94_number',      transform: digitsOnly },
  beneficiary_passport_number:     { dataKey: 'beneficiary_passport_number' },
  beneficiary_passport_country:    { dataKey: 'beneficiary_passport_country' },
  beneficiary_passport_expiry:     { dataKey: 'beneficiary_passport_expiry', transform: formatDate },
  beneficiary_nonimmigrant_status: { dataKey: 'beneficiary_nonimmigrant_status' },
  // FIX: El campo PDF "beneficiary_status_expiry" está posicionado donde va
  //      "I-94 expira" en el formulario oficial I-360.
  beneficiary_status_expiry:       { dataKey: 'beneficiary_i94_expiry',      transform: formatDate },

  // ---- Pág.4 — Part 4: Padre/Madre extranjero ----
  foreign_parent_last_name:   { dataKey: 'foreign_parent_last_name' },
  foreign_parent_first_name:  { dataKey: 'foreign_parent_first_name' },
  foreign_parent_middle_name: { dataKey: 'foreign_parent_middle_name' },
  foreign_parent_address:     { dataKey: 'foreign_parent_address' },
  foreign_parent_city:        { dataKey: 'foreign_parent_city' },
  foreign_parent_province:    { dataKey: 'foreign_parent_province' },
  foreign_parent_postal:      { dataKey: 'foreign_parent_postal' },
  foreign_parent_country:     { dataKey: 'foreign_parent_country' },

  // ---- Pág.8 — Part 8: SIJS ----
  department_juice: { dataKey: 'state_agency_name' },

  // ---- Pág.15 — Part 11: Contacto ----
  petitioner_phone:  { dataKey: 'petitioner_phone' },
  petitioner_mobile: { dataKey: 'petitioner_mobile' },
  petitioner_email:  { dataKey: 'petitioner_email' },

  // ---- Pág.19 — Información adicional ----
  additional_info: { dataKey: 'additional_info' },
}

// ============================================================================
// CHECKBOXES YES/NO (11 pares = 22 checkboxes)
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
// CHECKBOXES RADIO-LIKE
// ============================================================================

const SEX_MAP: Record<string, string> = {
  Masculino: 'sex_male',
  Femenino:  'sex_female',
}

const MARITAL_MAP: Record<string, string> = {
  'Soltero/a':    'marital_single',
  'Casado/a':     'marital_married',
  'Divorciado/a': 'marital_divorced',
  'Viudo/a':      'marital_widowed',
}

// ============================================================================
// PARSER DE REUNIFICACIÓN SIJS
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
// HELPER DE CHECKBOX: usa el custom "on" export value del PDF
// ============================================================================
//
// Los checkboxes del PDF fueron creados con export values personalizados
// (ej: "sex_male_value" en vez de "Yes"). El método check() de pdf-lib
// setea el valor a "Yes" pero la apariencia visual del checkbox está ligada
// al export value personalizado, así que la X no se muestra.
//
// Esta función lee la apariencia /AP → /N del widget, encuentra la key que
// NO es "Off" (esa es el "on" state), y la setea en /V y /AS para que
// la X se renderice correctamente.

function checkBoxSafe(
  form: ReturnType<PDFDocument['getForm']>,
  doc: PDFDocument,
  name: string,
): void {
  try {
    const cb = form.getCheckBox(name)
    const widgets = cb.acroField.getWidgets()
    if (widgets.length === 0) return

    const ap = widgets[0].dict.lookup(PDFName.of('AP'))
    if (!ap) { cb.check(); return }

    const normalAp = (ap as any).lookup(PDFName.of('N'))
    if (!normalAp || !normalAp.entries) { cb.check(); return }

    let onValue: string | null = null
    for (const [key] of normalAp.entries()) {
      const k = key.toString()
      if (k !== '/Off') {
        onValue = k.replace('/', '')
        break
      }
    }

    if (onValue) {
      cb.acroField.dict.set(PDFName.of('V'), PDFName.of(onValue))
      widgets[0].dict.set(PDFName.of('AS'), PDFName.of(onValue))
    } else {
      cb.check()
    }
  } catch (err: any) {
    console.warn(`No se marcó checkbox "${name}": ${err.message}`)
  }
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

  const pdfDoc = await PDFDocument.load(await response.arrayBuffer())
  const form = pdfDoc.getForm()

  // --- 0. Limpiar TODOS los campos (eliminar placeholders del template) ---
  for (const field of form.getFields()) {
    try {
      if (field instanceof PDFTextField) {
        field.setText('')
      } else if (field instanceof PDFCheckBox) {
        // Usar el mismo approach directo para limpiar custom states
        const w = field.acroField.getWidgets()
        if (w.length > 0) {
          w[0].dict.set(PDFName.of('AS'), PDFName.of('Off'))
        }
        field.acroField.dict.set(PDFName.of('V'), PDFName.of('Off'))
      }
    } catch {
      // Ignorar campos que no soporten limpieza
    }
  }

  // --- 1. Campos de texto ---
  for (const [pdfName, entry] of Object.entries(TEXT_FIELD_MAP)) {
    const raw = formData[entry.dataKey]
    if (raw == null || raw === '') continue
    const value = entry.transform ? entry.transform(raw) : String(raw)
    if (!value) continue
    try {
      const field = form.getTextField(pdfName)
      const maxLength = field.getMaxLength()
      field.setText(maxLength != null ? value.substring(0, maxLength) : value)
    } catch (err: any) {
      console.warn(`No se llenó campo texto "${pdfName}": ${err.message}`)
    }
  }

  // --- 2. Checkboxes Yes/No ---
  for (const [yesName, noName, dataKey] of YES_NO_MAP) {
    const v = formData[dataKey]
    if (isYes(v)) checkBoxSafe(form, pdfDoc, yesName)
    else if (isNo(v)) checkBoxSafe(form, pdfDoc, noName)
  }

  // --- 3. Sexo ---
  const sexField = SEX_MAP[formData.beneficiary_sex]
  if (sexField) checkBoxSafe(form, pdfDoc, sexField)

  // --- 4. Estado civil ---
  const maritalField = MARITAL_MAP[formData.beneficiary_marital_status]
  if (maritalField) checkBoxSafe(form, pdfDoc, maritalField)

  // --- 5. Reunificación SIJS ---
  const reunifSet = parseReunificationReason(formData.reunification_not_viable_reason)
  reunifSet.forEach((name) => checkBoxSafe(form, pdfDoc, name))

  // --- 6. Aplanar y guardar ---
  form.flatten()
  return pdfDoc.save()
}

// ============================================================================
// Campos del wizard que NO tienen campo en el PDF
// ============================================================================
//   - petitioner_country, language_understood, other_petitions_count
//   - beneficiary_city_birth, beneficiary_status_expiry (posiciones usadas
//     para beneficiary_last_arrival_date y beneficiary_i94_expiry)
//   - placement_reason, parent_names_not_viable, hhs_court_order
//   - spouse_child_1_* (last_name, first_name, middle_name, dob, country,
//                       relationship, a_number)
