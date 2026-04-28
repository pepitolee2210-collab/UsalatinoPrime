// Test end-to-end del PR-GEN-116 fill (sin levantar Next.js).
// Simula el flujo del endpoint /api/admin/case-forms/tx-pr-gen-116/print
// con los datos del caso de prueba (Jennifer Velasquez, SIJS Houston).
//
// Output: scripts/pr-gen-116-test-output.pdf — PDF rellenado para inspección visual.
//
// Uso: node scripts/test-pr-gen-116-fill.mjs

import { PDFDocument, PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown, PDFName } from 'pdf-lib'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const PDF_PATH = path.join(repoRoot, 'public', 'forms', 'pr-gen-116.pdf')
const OUTPUT_PATH = path.join(__dirname, 'pr-gen-116-test-output.pdf')

// SHA-256 esperado (debe coincidir con el hardcodeado en pr-gen-116-form-schema.ts)
const EXPECTED_SHA = '7e5c63b4b327dbe37285c309b040c31476ced3988832f7871e8f6ce51f6f8189'

// Mapeo `case_type` (virtual) → checkbox AcroForm. Mismo que processForPrint().
const CASE_TYPE_TO_PDF_CHECKBOX = {
  'family_law__parent_child__custody_or_visitation': 'Custody or Visitation',
}

// Mapeo semanticKey → pdfFieldName (sólo los campos que vamos a rellenar)
const FIELD_MAP = {
  styled_caption: 'STYLED',
  petitioner_name: 'Name',
  petitioner_email: 'Email',
  petitioner_address: 'Address',
  petitioner_city_state_zip: 'CityStateZip',
  petitioner_phone: 'Telephone',
  petitioner_signature: 'Signature',
  plaintiff_petitioner_1: 'PlaintiffsPetitioners 1',
  defendant_respondent_1: 'DefendantsRespondents 1',
  custodial_parent: 'Custodial Parent',
  non_custodial_parent: 'NonCustodial Parent',
  person_completing_pro_se: 'Pro Se PlaintiffPetitioner',
}

// Datos simulados de Jennifer (lo que prefill produciría en producción)
const SIMULATED_VALUES = {
  // hardcoded
  person_completing_pro_se: true,
  case_type: 'family_law__parent_child__custody_or_visitation',
  // prefill
  styled_caption: 'In the interest of B.Y.R.V., a child',
  petitioner_name: 'Jennifer Samanta Velasquez Mejia',
  petitioner_email: 'client_5043444051@usalatinoprime.temp',
  petitioner_address: '2500 West Mount Houston Road #251',
  petitioner_city_state_zip: 'houston, TX 77038',
  petitioner_phone: '(504) 344-4051',
  petitioner_signature: 'Jennifer Samanta Velasquez Mejia',
  plaintiff_petitioner_1: 'Jennifer Samanta Velasquez Mejia',
  defendant_respondent_1: 'Padre',
  custodial_parent: 'Jennifer Samanta Velasquez Mejia',
  non_custodial_parent: 'Padre',
}

// Reproducción mínima de processForPrint
function processForPrint(values) {
  const out = { ...values }
  const ct = values.case_type
  if (typeof ct === 'string' && ct !== '' && ct !== '__show_all__' && CASE_TYPE_TO_PDF_CHECKBOX[ct]) {
    out[`__case_type_pdf__`] = CASE_TYPE_TO_PDF_CHECKBOX[ct]
  }
  return out
}

// Reproducción mínima de fillAcroForm
function readCheckboxOnValue(field) {
  try {
    const widgets = field.acroField.getWidgets()
    if (widgets.length === 0) return null
    const ap = widgets[0].dict.lookup(PDFName.of('AP'))
    if (!ap) return null
    const normalAp = ap.lookup(PDFName.of('N'))
    if (!normalAp || !normalAp.entries) return null
    for (const [key] of normalAp.entries()) {
      const k = key.toString()
      if (k !== '/Off') return k.replace('/', '')
    }
  } catch { /* ignore */ }
  return null
}

function isTruthyValue(v) {
  if (v === true) return true
  if (v === false || v === null || v === undefined) return false
  const s = String(v).trim().toLowerCase()
  return s === 'yes' || s === 'true' || s === '1' || s === 'on' || s === 'sí' || s === 'si'
}

async function fillAcroForm(pdfBytes, values) {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
  const form = doc.getForm()

  let filledCount = 0
  let warningCount = 0

  for (const [name, rawValue] of Object.entries(values)) {
    if (rawValue === null || rawValue === undefined || rawValue === '') continue
    try {
      const field = form.getField(name)
      if (field instanceof PDFTextField) {
        try {
          const ml = field.getMaxLength()
          if (typeof ml === 'number' && ml > 0 && String(rawValue).length > ml) {
            field.setMaxLength(undefined)
          }
        } catch { /* ignore */ }
        field.setText(String(rawValue))
        filledCount++
      } else if (field instanceof PDFCheckBox) {
        if (isTruthyValue(rawValue)) {
          const onValue = readCheckboxOnValue(field)
          if (onValue) {
            field.acroField.dict.set(PDFName.of('V'), PDFName.of(onValue))
            const widgets = field.acroField.getWidgets()
            for (const w of widgets) {
              w.dict.set(PDFName.of('AS'), PDFName.of(onValue))
            }
          } else {
            field.check()
          }
          filledCount++
        }
      }
    } catch (err) {
      warningCount++
      console.warn(`  ⚠ ${name}: ${err.message}`)
    }
  }

  console.log('Fields rellenados:', filledCount)
  console.log('Warnings:', warningCount)

  try { form.flatten() } catch (err) { console.warn('Flatten falló:', err.message) }

  return await doc.save()
}

async function main() {
  const bytes = fs.readFileSync(PDF_PATH)
  const sha = crypto.createHash('sha256').update(bytes).digest('hex')
  console.log('PDF SHA-256:', sha)
  if (sha !== EXPECTED_SHA) {
    console.error(`ERROR: SHA mismatch. Esperado ${EXPECTED_SHA}.`)
    process.exit(1)
  }
  console.log('SHA verificado ✓')

  // Aplicar processForPrint
  const processed = processForPrint(SIMULATED_VALUES)

  // Construir map por pdfFieldName
  const valuesByPdfName = {}
  for (const [semKey, value] of Object.entries(processed)) {
    if (semKey === '__case_type_pdf__') {
      // El nombre real del checkbox de tipo de caso
      valuesByPdfName[String(value)] = true
      continue
    }
    if (semKey === 'case_type') continue // virtual, no se escribe
    const pdfName = FIELD_MAP[semKey]
    if (!pdfName) continue
    valuesByPdfName[pdfName] = value
  }

  console.log('\nFields a escribir en el PDF:')
  for (const [k, v] of Object.entries(valuesByPdfName)) {
    console.log(`  ${k.padEnd(40)} = ${JSON.stringify(v)}`)
  }
  console.log('')

  const filledBytes = await fillAcroForm(bytes, valuesByPdfName)
  fs.writeFileSync(OUTPUT_PATH, filledBytes)
  console.log('\nPDF rellenado guardado:', OUTPUT_PATH)
  console.log('Tamaño:', filledBytes.length, 'bytes')
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
