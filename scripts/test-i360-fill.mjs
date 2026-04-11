// Script de prueba local para verificar el mapeo del PDF I-360.
// Uso: node scripts/test-i360-fill.mjs
//
// Lee el PDF template desde public/forms/i-360.pdf, lo llena con datos de
// prueba simulando lo que vendría de la BD, y guarda el resultado en
// I-360-test-output.pdf en la raíz del repo. NO se debe commitear.

import { PDFDocument } from 'pdf-lib'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

// --- Replicas de la lógica de generate-i360.ts ---

const digitsOnly = (v) => String(v ?? '').replace(/\D/g, '')

function isYes(v) {
  if (v === true || v === 1) return true
  const s = String(v ?? '').trim().toLowerCase()
  return s === 'sí' || s === 'si' || s === 'yes' || s === 'true' || s === '1'
}
function isNo(v) {
  if (v === false || v === 0) return true
  const s = String(v ?? '').trim().toLowerCase()
  return s === 'no' || s === 'false' || s === '0'
}

const TEXT_FIELD_MAP = {
  last_name: { dataKey: 'petitioner_last_name' },
  first_name: { dataKey: 'petitioner_first_name' },
  middle_name: { dataKey: 'petitioner_middle_name' },
  ssn: { dataKey: 'petitioner_ssn', transform: digitsOnly },
  arn: { dataKey: 'petitioner_a_number', transform: digitsOnly },
  petitioner_address: { dataKey: 'petitioner_address' },
  petitioner_city: { dataKey: 'petitioner_city' },
  petitioner_state: { dataKey: 'petitioner_state' },
  petitioner_zip: { dataKey: 'petitioner_zip' },
  safe_mailing_name: { dataKey: 'safe_mailing_name' },
  safe_mailing_address: { dataKey: 'safe_mailing_address' },
  safe_mailing_city: { dataKey: 'safe_mailing_city' },
  safe_mailing_state: { dataKey: 'safe_mailing_state' },
  safe_mailing_zip: { dataKey: 'safe_mailing_zip' },
  beneficiary_last_name: { dataKey: 'beneficiary_last_name' },
  beneficiary_first_name: { dataKey: 'beneficiary_first_name' },
  beneficiary_middle_name: { dataKey: 'beneficiary_middle_name' },
  other_names: { dataKey: 'other_names' },
  beneficiary_address: { dataKey: 'beneficiary_address' },
  beneficiary_city: { dataKey: 'beneficiary_city' },
  beneficiary_state: { dataKey: 'beneficiary_state' },
  beneficiary_zip: { dataKey: 'beneficiary_zip' },
  beneficiary_dob: { dataKey: 'beneficiary_dob' },
  beneficiary_country_birth: { dataKey: 'beneficiary_country_birth' },
  beneficiary_ssn: { dataKey: 'beneficiary_ssn', transform: digitsOnly },
  beneficiary_a_number: { dataKey: 'beneficiary_a_number', transform: digitsOnly },
  beneficiary_city_birth: { dataKey: 'beneficiary_city_birth' },
  beneficiary_i94_number: { dataKey: 'beneficiary_i94_number', transform: digitsOnly },
  beneficiary_passport_number: { dataKey: 'beneficiary_passport_number' },
  beneficiary_passport_country: { dataKey: 'beneficiary_passport_country' },
  beneficiary_nonimmigrant_status: { dataKey: 'beneficiary_nonimmigrant_status' },
  beneficiary_passport_expiry: { dataKey: 'beneficiary_passport_expiry' },
  beneficiary_status_expiry: { dataKey: 'beneficiary_status_expiry' },
  foreign_parent_last_name: { dataKey: 'foreign_parent_last_name' },
  foreign_parent_first_name: { dataKey: 'foreign_parent_first_name' },
  foreign_parent_middle_name: { dataKey: 'foreign_parent_middle_name' },
  foreign_parent_address: { dataKey: 'foreign_parent_address' },
  foreign_parent_city: { dataKey: 'foreign_parent_city' },
  foreign_parent_province: { dataKey: 'foreign_parent_province' },
  foreign_parent_postal: { dataKey: 'foreign_parent_postal' },
  foreign_parent_country: { dataKey: 'foreign_parent_country' },
  department_juice: { dataKey: 'state_agency_name' },
  petitioner_phone: { dataKey: 'petitioner_phone' },
  petitioner_mobile: { dataKey: 'petitioner_mobile' },
  petitioner_email: { dataKey: 'petitioner_email' },
  additional_info: { dataKey: 'additional_info' },
}

const YES_NO_MAP = [
  ['in_removal_yes', 'in_removal_no', 'in_removal_proceedings'],
  ['other_petitions_yes', 'other_petitions_no', 'other_petitions'],
  ['worked_without_permission_yes', 'worked_without_permission_no', 'worked_without_permission'],
  ['adjustment_attached_yes', 'adjustment_attached_no', 'adjustment_attached'],
  ['children_filed_yes', 'children_filed_no', 'children_filed_separate'],
  ['declared_dependent_yes', 'declared_dependent_no', 'declared_dependent_court'],
  ['under_jurisdiction_yes', 'under_jurisdiction_no', 'currently_under_jurisdiction'],
  ['court_placement_yes', 'court_placement_no', 'in_court_ordered_placement'],
  ['best_interest_return_yes', 'best_interest_return_no', 'best_interest_not_return'],
  ['hhs_custody_yes', 'hhs_custody_no', 'previously_hhs_custody'],
  ['interpreter_yes', 'interpreter_no', 'interpreter_needed'],
]

const SEX_MAP = { Masculino: 'sex_male', Femenino: 'sex_female' }
const MARITAL_MAP = {
  'Soltero/a': 'marital_single',
  'Casado/a': 'marital_married',
  'Divorciado/a': 'marital_divorced',
  'Viudo/a': 'marital_widowed',
}

function parseReunificationReason(raw) {
  const result = new Set()
  if (!raw) return result
  const parts = String(raw).split(',').map((s) => s.trim())
  if (parts.includes('Uno de mis padres')) result.add('juvenile_court_one')
  if (parts.includes('Ambos padres')) result.add('juvenile_court_both')
  if (parts.includes('Abuse')) result.add('juvenile_court_abuse')
  if (parts.includes('Neglect')) result.add('juvenile_court_neglect')
  if (parts.includes('Abandonment')) result.add('juvenile_court_abandonment')
  return result
}

// Datos de prueba simulando lo que vendría del wizard en Supabase
const testData = {
  petitioner_last_name: 'DAZA TARAZONA',
  petitioner_first_name: 'HELY',
  petitioner_middle_name: 'VANESA',
  petitioner_ssn: '123-45-6789',
  petitioner_a_number: 'A123456789',
  petitioner_address: '123 Main Street Apt 4',
  petitioner_city: 'Salt Lake City',
  petitioner_state: 'UT',
  petitioner_zip: '84101',
  safe_mailing_name: 'SAFE LLC',
  safe_mailing_address: '456 Safe Ave',
  safe_mailing_city: 'Safe Town',
  safe_mailing_state: 'UT',
  safe_mailing_zip: '84102',
  beneficiary_last_name: 'BENEFICIARY LAST',
  beneficiary_first_name: 'BENE FIRST',
  beneficiary_middle_name: 'MIDDLE',
  beneficiary_sex: 'Masculino',
  beneficiary_marital_status: 'Soltero/a',
  other_names: 'Otros nombres usados',
  beneficiary_address: '789 Beneficiary St',
  beneficiary_city: 'Bene City',
  beneficiary_state: 'UT',
  beneficiary_zip: '84103',
  beneficiary_dob: '2010-05-15',
  beneficiary_country_birth: 'Venezuela',
  beneficiary_city_birth: 'Caracas',
  beneficiary_ssn: '987-65-4321',
  beneficiary_a_number: 'A987654321',
  beneficiary_i94_number: '12345678901',
  beneficiary_passport_number: 'P1234567',
  beneficiary_passport_country: 'Venezuela',
  beneficiary_nonimmigrant_status: 'B2 Tourist',
  beneficiary_passport_expiry: '2030-01-01',
  beneficiary_status_expiry: '2026-12-31',
  in_removal_proceedings: 'Sí',
  other_petitions: 'No',
  worked_without_permission: 'No',
  adjustment_attached: 'Sí',
  children_filed_separate: 'No',
  foreign_parent_last_name: 'PARENT LAST',
  foreign_parent_first_name: 'PARENT FIRST',
  foreign_parent_middle_name: 'PMID',
  foreign_parent_country: 'Venezuela',
  foreign_parent_address: '100 Foreign Street',
  foreign_parent_city: 'Caracas',
  foreign_parent_province: 'Miranda',
  foreign_parent_postal: '1010',
  declared_dependent_court: 'Sí',
  state_agency_name: 'FOURTH DISTRICT JUVENILE COURT OF UTAH AMERICAN FORK',
  currently_under_jurisdiction: 'Sí',
  in_court_ordered_placement: 'Sí',
  reunification_not_viable_reason: 'Ambos padres, Abuse, Neglect',
  best_interest_not_return: 'Sí',
  previously_hhs_custody: 'No',
  petitioner_phone: '801-555-1234',
  petitioner_mobile: '801-555-5678',
  petitioner_email: 'test@email.com',
  interpreter_needed: 'Sí',
  additional_info: 'Información adicional de prueba para verificar el textarea.',
}

async function run() {
  const pdfPath = path.join(repoRoot, 'public', 'forms', 'i-360.pdf')
  const outPath = path.join(repoRoot, 'I-360-test-output.pdf')

  const buf = fs.readFileSync(pdfPath)
  const doc = await PDFDocument.load(buf)
  const form = doc.getForm()

  const failures = []
  const checkBox = (name) => {
    try { form.getCheckBox(name).check(); return true }
    catch (e) { failures.push(`checkbox ${name}: ${e.message}`); return false }
  }

  let textFilled = 0
  let checkboxesMarked = 0

  for (const [pdfName, entry] of Object.entries(TEXT_FIELD_MAP)) {
    const raw = testData[entry.dataKey]
    if (raw == null || raw === '') continue
    const value = entry.transform ? entry.transform(raw) : String(raw)
    if (!value) continue
    try {
      const field = form.getTextField(pdfName)
      const maxLen = field.getMaxLength()
      field.setText(maxLen != null ? value.substring(0, maxLen) : value)
      textFilled++
    } catch (e) {
      failures.push(`text ${pdfName}: ${e.message}`)
    }
  }

  for (const [yesName, noName, dataKey] of YES_NO_MAP) {
    const v = testData[dataKey]
    if (isYes(v)) { if (checkBox(yesName)) checkboxesMarked++ }
    else if (isNo(v)) { if (checkBox(noName)) checkboxesMarked++ }
  }

  const sexField = SEX_MAP[testData.beneficiary_sex]
  if (sexField && checkBox(sexField)) checkboxesMarked++

  const maritalField = MARITAL_MAP[testData.beneficiary_marital_status]
  if (maritalField && checkBox(maritalField)) checkboxesMarked++

  const reunifSet = parseReunificationReason(testData.reunification_not_viable_reason)
  reunifSet.forEach((name) => { if (checkBox(name)) checkboxesMarked++ })

  console.log('=== RESULTADO ===')
  console.log('Campos de texto llenados:', textFilled, '/ 46')
  console.log('Checkboxes marcados:', checkboxesMarked)
  console.log('Reunificación parseada:', Array.from(reunifSet))
  if (failures.length) {
    console.log('\nFALLAS:')
    failures.forEach((f) => console.log('  -', f))
  } else {
    console.log('\nTodo OK ✓')
  }

  const bytes = await doc.save()
  fs.writeFileSync(outPath, bytes)
  console.log('\nPDF guardado en:', outPath)
}

run().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})
