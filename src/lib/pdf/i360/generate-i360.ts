import { PDFDocument, PDFTextField, PDFCheckBox, PDFName, StandardFonts, rgb } from 'pdf-lib'

// ============================================================================
// HELPERS
// ============================================================================

const digitsOnly = (v: any): string => String(v ?? '').replace(/\D/g, '')

/** yyyy-mm-dd → mm/dd/yyyy (formato USCIS). */
function formatDate(v: any): string {
  const s = String(v ?? '')
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return `${m[2]}/${m[3]}/${m[1]}`
  return s
}

function isYes(v: any): boolean {
  if (v === true || v === 1) return true
  const s = String(v ?? '').trim().toLowerCase()
  return s === 'sí' || s === 'si' || s === 'yes' || s === 'true' || s === '1'
}

function isNo(v: any): boolean {
  if (v === false || v === 0) return true
  const s = String(v ?? '').trim().toLowerCase()
  return s === 'no' || s === 'false' || s === '0'
}

// ============================================================================
// MAPEO DE CAMPOS DE TEXTO (46 campos)
// ============================================================================

type TextFieldEntry = { dataKey: string; transform?: (value: any) => string }

const TEXT_FIELD_MAP: Record<string, TextFieldEntry> = {
  // Pág.1 — Part 1: Peticionario
  last_name:          { dataKey: 'petitioner_last_name' },
  first_name:         { dataKey: 'petitioner_first_name' },
  middle_name:        { dataKey: 'petitioner_middle_name' },
  ssn:                { dataKey: 'petitioner_ssn',      transform: digitsOnly },
  arn:                { dataKey: 'petitioner_a_number', transform: digitsOnly },
  petitioner_address: { dataKey: 'petitioner_address' },
  petitioner_city:    { dataKey: 'petitioner_city' },
  petitioner_state:   { dataKey: 'petitioner_state' },
  petitioner_zip:     { dataKey: 'petitioner_zip' },
  // Pág.2 — Dirección segura
  safe_mailing_name:    { dataKey: 'safe_mailing_name' },
  safe_mailing_address: { dataKey: 'safe_mailing_address' },
  safe_mailing_city:    { dataKey: 'safe_mailing_city' },
  safe_mailing_state:   { dataKey: 'safe_mailing_state' },
  safe_mailing_zip:     { dataKey: 'safe_mailing_zip' },
  // Pág.3 — Part 3: Beneficiario
  beneficiary_last_name:           { dataKey: 'beneficiary_last_name' },
  beneficiary_first_name:          { dataKey: 'beneficiary_first_name' },
  beneficiary_middle_name:         { dataKey: 'beneficiary_middle_name' },
  other_names:                     { dataKey: 'other_names' },
  beneficiary_address:             { dataKey: 'beneficiary_address' },
  beneficiary_city:                { dataKey: 'beneficiary_city' },
  beneficiary_state:               { dataKey: 'beneficiary_state' },
  beneficiary_zip:                 { dataKey: 'beneficiary_zip' },
  beneficiary_dob:                 { dataKey: 'beneficiary_dob',               transform: formatDate },
  beneficiary_country_birth:       { dataKey: 'beneficiary_country_birth' },
  beneficiary_ssn:                 { dataKey: 'beneficiary_ssn',               transform: digitsOnly },
  beneficiary_a_number:            { dataKey: 'beneficiary_a_number',          transform: digitsOnly },
  beneficiary_city_birth:          { dataKey: 'beneficiary_last_arrival_date', transform: formatDate },
  beneficiary_i94_number:          { dataKey: 'beneficiary_i94_number',        transform: digitsOnly },
  beneficiary_passport_number:     { dataKey: 'beneficiary_passport_number' },
  beneficiary_passport_country:    { dataKey: 'beneficiary_passport_country' },
  beneficiary_passport_expiry:     { dataKey: 'beneficiary_passport_expiry',   transform: formatDate },
  beneficiary_nonimmigrant_status: { dataKey: 'beneficiary_nonimmigrant_status' },
  beneficiary_status_expiry:       { dataKey: 'beneficiary_i94_expiry',        transform: formatDate },
  // Pág.4 — Part 4: Padre extranjero
  foreign_parent_last_name:   { dataKey: 'foreign_parent_last_name' },
  foreign_parent_first_name:  { dataKey: 'foreign_parent_first_name' },
  foreign_parent_middle_name: { dataKey: 'foreign_parent_middle_name' },
  foreign_parent_address:     { dataKey: 'foreign_parent_address' },
  foreign_parent_city:        { dataKey: 'foreign_parent_city' },
  foreign_parent_province:    { dataKey: 'foreign_parent_province' },
  foreign_parent_postal:      { dataKey: 'foreign_parent_postal' },
  foreign_parent_country:     { dataKey: 'foreign_parent_country' },
  // Pág.8 — Part 8: SIJS
  department_juice: { dataKey: 'state_agency_name' },
  // Pág.15 — Part 11: Contacto
  petitioner_phone:  { dataKey: 'petitioner_phone' },
  petitioner_mobile: { dataKey: 'petitioner_mobile' },
  petitioner_email:  { dataKey: 'petitioner_email' },
  // Pág.19
  additional_info: { dataKey: 'additional_info' },
}

// ============================================================================
// CHECKBOXES — POSICIONES FÍSICAS EN EL PDF
// ============================================================================
//
// form.flatten() de pdf-lib NO renderiza correctamente los checkboxes creados
// con export values personalizados (ej: "sex_male_value" en vez de "Yes").
// La solución probada y usada en el I-589 del mismo proyecto: dibujar "X"
// directamente en la página con page.drawText() en las coordenadas del checkbox.

type CheckboxPos = { page: number; x: number; y: number; w: number; h: number }

const CHECKBOX_POS: Record<string, CheckboxPos> = {
  // Pág.3 (index 2) — Estado civil
  marital_single:   { page: 2, x: 137, y: 378, w: 8, h: 8 },
  marital_married:  { page: 2, x: 195, y: 379, w: 8, h: 8 },
  marital_divorced: { page: 2, x: 259, y: 378, w: 8, h: 8 },
  marital_widowed:  { page: 2, x: 330, y: 378, w: 8, h: 8 },
  // Pág.4 (index 3) — Sexo + Yes/No de Part 4/5
  sex_male:                        { page: 3, x: 178, y: 501, w: 8, h: 8 },
  sex_female:                      { page: 3, x: 225, y: 501, w: 8, h: 8 },
  in_removal_yes:                  { page: 3, x: 487, y: 478, w: 8, h: 8 },
  in_removal_no:                   { page: 3, x: 528, y: 478, w: 8, h: 8 },
  other_petitions_yes:             { page: 3, x: 487, y: 414, w: 8, h: 8 },
  other_petitions_no:              { page: 3, x: 529, y: 414, w: 8, h: 8 },
  worked_without_permission_yes:   { page: 3, x: 488, y: 390, w: 8, h: 8 },
  worked_without_permission_no:    { page: 3, x: 528, y: 390, w: 8, h: 8 },
  adjustment_attached_yes:         { page: 3, x: 488, y: 361, w: 8, h: 8 },
  adjustment_attached_no:          { page: 3, x: 529, y: 361, w: 8, h: 8 },
  children_filed_yes:              { page: 3, x: 488, y: 262, w: 8, h: 8 },
  children_filed_no:               { page: 3, x: 528, y: 261, w: 8, h: 8 },
  // Pág.8 (index 7) — Part 8 SIJS
  declared_dependent_yes:  { page: 7, x: 488, y: 201, w: 8, h: 8 },
  declared_dependent_no:   { page: 7, x: 529, y: 201, w: 8, h: 8 },
  under_jurisdiction_yes:  { page: 7, x: 488, y: 113, w: 8, h: 8 },
  under_jurisdiction_no:   { page: 7, x: 528, y: 113, w: 8, h: 8 },
  // Pág.9 (index 8) — Part 8 cont.
  court_placement_yes:         { page: 8, x: 488, y: 714, w: 8, h: 8 },
  court_placement_no:          { page: 8, x: 528, y: 714, w: 8, h: 8 },
  juvenile_court_one:          { page: 8, x: 302, y: 606, w: 8, h: 8 },
  juvenile_court_both:         { page: 8, x: 354, y: 606, w: 8, h: 8 },
  juvenile_court_abuse:        { page: 8, x:  77, y: 586, w: 8, h: 8 },
  juvenile_court_neglect:      { page: 8, x: 136, y: 586, w: 8, h: 8 },
  juvenile_court_abandonment:  { page: 8, x: 200, y: 586, w: 8, h: 8 },
  best_interest_return_yes:    { page: 8, x: 488, y: 510, w: 8, h: 8 },
  best_interest_return_no:     { page: 8, x: 528, y: 510, w: 8, h: 8 },
  hhs_custody_yes:             { page: 8, x: 488, y: 481, w: 8, h: 8 },
  hhs_custody_no:              { page: 8, x: 528, y: 481, w: 8, h: 8 },
  // Pág.15 (index 14) — Intérprete
  interpreter_yes: { page: 14, x: 78, y: 136, w: 8, h: 8 },
  interpreter_no:  { page: 14, x: 78, y: 107, w: 8, h: 8 },
}

// ============================================================================
// LÓGICA DE CHECKBOXES — qué campo de datos marca cuál checkbox
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

const SEX_MAP: Record<string, string> = { Masculino: 'sex_male', Femenino: 'sex_female' }

const MARITAL_MAP: Record<string, string> = {
  'Soltero/a': 'marital_single', 'Casado/a': 'marital_married',
  'Divorciado/a': 'marital_divorced', 'Viudo/a': 'marital_widowed',
}

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

  const pdfDoc = await PDFDocument.load(await response.arrayBuffer())
  const form = pdfDoc.getForm()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const pages = pdfDoc.getPages()

  // --- 0. Limpiar TODOS los campos del template ---
  for (const field of form.getFields()) {
    try {
      if (field instanceof PDFTextField) {
        field.setText('')
      } else if (field instanceof PDFCheckBox) {
        const w = field.acroField.getWidgets()
        if (w.length > 0) w[0].dict.set(PDFName.of('AS'), PDFName.of('Off'))
        field.acroField.dict.set(PDFName.of('V'), PDFName.of('Off'))
      }
    } catch { /* ignorar */ }
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

  // --- 2. Determinar qué checkboxes marcar ---
  const toMark = new Set<string>()

  // Yes/No
  for (const [yesName, noName, dataKey] of YES_NO_MAP) {
    const v = formData[dataKey]
    if (isYes(v)) toMark.add(yesName)
    else if (isNo(v)) toMark.add(noName)
  }

  // Sexo
  const sexCb = SEX_MAP[formData.beneficiary_sex]
  if (sexCb) toMark.add(sexCb)

  // Estado civil
  const maritalCb = MARITAL_MAP[formData.beneficiary_marital_status]
  if (maritalCb) toMark.add(maritalCb)

  // Reunificación SIJS
  parseReunificationReason(formData.reunification_not_viable_reason).forEach((n) => toMark.add(n))

  // --- 3. Dibujar "X" directamente en cada página ---
  // Usamos drawText en vez del mecanismo AcroForm porque form.flatten()
  // de pdf-lib no renderiza checkboxes con custom export values.
  for (const name of toMark) {
    const pos = CHECKBOX_POS[name]
    if (!pos) { console.warn(`Checkbox "${name}" sin posición definida`); continue }
    if (pos.page >= pages.length) continue

    const page = pages[pos.page]
    const fontSize = Math.min(pos.w, pos.h) - 1
    const textWidth = font.widthOfTextAtSize('X', fontSize)
    const xOffset = (pos.w - textWidth) / 2
    const yOffset = (pos.h - fontSize) / 2 + 1

    page.drawText('X', {
      x: pos.x + xOffset,
      y: pos.y + yOffset,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    })
  }

  // --- 4. Aplanar y guardar ---
  form.flatten()
  return pdfDoc.save()
}
