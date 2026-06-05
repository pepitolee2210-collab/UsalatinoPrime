// Test end-to-end del I-130 fill (sin levantar Next.js).
// Simula el flujo del endpoint /print: toma valores por semanticKey (como los
// produce el prefill + lo que el cliente llena a mano), los mapea a pdfFieldName
// vía el i130-raw-fields.json, rellena el AcroForm y guarda el PDF.
//
// Output: scripts/i130-test-output.pdf — para inspección visual.
// Uso: node scripts/test-i130-fill.mjs

import { PDFDocument, PDFTextField, PDFCheckBox, PDFName } from 'pdf-lib'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const PDF_PATH = path.join(repoRoot, 'public', 'forms', 'i-130.pdf')
const RAW_PATH = path.join(__dirname, 'i130-raw-fields.json')
const OUTPUT_PATH = path.join(__dirname, 'i130-test-output.pdf')

// SHA-256 esperado (debe coincidir con el hardcodeado en i130-form-schema.ts)
const EXPECTED_SHA = '2cfcf456c1c66cb1cdc55cc19bd1f218522f9ef60faadb2700adde07b4ba2c9f'

// shortName replicado de build-i130-schema.mjs → semanticKey
function shortName(fullName) {
  const m = fullName.match(/\.([^.\[]+)\[(\d+)\]$/)
  if (!m) return fullName
  const base = m[1]
  const idx = m[2] === '0' ? '' : `_${m[2]}`
  return `${base}${idx}`
}

// Valores simulados por semanticKey (peticionario esposo desde prefill +
// beneficiaria esposa llenada a mano + matrimonio).
const SIMULATED_VALUES = {
  // Parte 1 — relación (hardcoded)
  pt1line1_spouse: true,
  // Parte 2 — peticionario (esposo ciudadano), prefill desde su perfil
  pt2line4a_familyname: 'Smith',
  pt2line4b_givenname: 'James',
  pt2line4c_middlename: 'Robert',
  pt2line11_ssn: '123-45-6789',
  pt2line8_dateofbirth: '07/04/1990',
  pt2line9_male: true,
  pt2line7_countryofbirth: 'United States',
  pt2line10_streetnumbername: '123 Main St',
  pt2line10_cityortown: 'Miami',
  pt2line10_state: 'FL',
  pt2line10_zipcode: '33101',
  pt2line10_country: 'United States',
  pt2line17_married: true,
  pt2line36_uscitizen: true,
  // Parte 2 — matrimonio actual (manual)
  pt2line16_numberofmarriages: '1',
  pt2line18_dateofmarriage: '09/20/2024',
  // Parte 6 — contacto del peticionario
  pt6line3_daytimephonenumber: '(305) 555-0101',
  pt6line5_email: 'james.smith@email.com',
  // Parte 4 — beneficiaria (esposa), llenada a mano
  pt4line4a_familyname: 'Mendoza Rojas',
  pt4line4b_givenname: 'Vianka',
  pt4line9_female: true,
  pt4line7_citytownofbirth: 'Trujillo',
  pt4line8_countryofbirth: 'Peru',
  pt4line9_dateofbirth: '03/15/1995',
  pt4line22_passportnumber: '1234567',
  pt4line24_countryofissuance: 'Peru',
}

function isTruthyValue(v) {
  if (v === true) return true
  if (v === false || v === null || v === undefined) return false
  const s = String(v).trim().toLowerCase()
  return s === 'yes' || s === 'true' || s === '1' || s === 'on' || s === 'sí' || s === 'si'
}

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

async function fillAcroForm(pdfBytes, valuesByPdfName) {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
  const form = doc.getForm()

  let filledCount = 0
  let warningCount = 0

  for (const [name, rawValue] of Object.entries(valuesByPdfName)) {
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

  const raw = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'))
  // Mapa semanticKey → pdfFieldName (primer match gana, como en el schema).
  const skToPdf = {}
  for (const f of raw.fields) {
    const sk = shortName(f.name).toLowerCase()
    if (!(sk in skToPdf)) skToPdf[sk] = f.name
  }

  const valuesByPdfName = {}
  const missing = []
  for (const [sk, value] of Object.entries(SIMULATED_VALUES)) {
    const pdfName = skToPdf[sk]
    if (!pdfName) { missing.push(sk); continue }
    valuesByPdfName[pdfName] = value
  }

  if (missing.length) {
    console.warn('\n⚠ semanticKeys SIN campo PDF (revisar nombres):', missing.join(', '))
  } else {
    console.log('\nTodos los semanticKeys simulados mapean a un campo PDF ✓')
  }

  console.log('\nFields a escribir:', Object.keys(valuesByPdfName).length)

  const filledBytes = await fillAcroForm(bytes, valuesByPdfName)
  fs.writeFileSync(OUTPUT_PATH, filledBytes)
  console.log('\nPDF rellenado guardado:', OUTPUT_PATH)
  console.log('Tamaño:', filledBytes.length, 'bytes')
  if (missing.length) process.exit(1)
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
