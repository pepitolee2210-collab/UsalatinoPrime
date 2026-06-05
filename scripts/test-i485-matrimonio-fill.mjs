// Test end-to-end del I-485 de matrimonio (sin levantar Next.js).
// Verifica que los semanticKeys que produce el prefill de matrimonio mapean a
// campos reales del PDF I-485 y que el fill funciona. Reusa el MISMO PDF físico
// que el I-485 SIJS (public/forms/i-485.pdf) — la independencia es lógica.
//
// Replica el comportamiento del endpoint real (acroform-service.ts): flatten=false
// (campos editables + NeedAppearances) para no chocar con el rich text de Part 14.
//
// Output: scripts/i485-matrimonio-test-output.pdf
// Uso: node scripts/test-i485-matrimonio-fill.mjs

import { PDFDocument, PDFTextField, PDFCheckBox, PDFName, PDFDict, PDFBool } from 'pdf-lib'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const PDF_PATH = path.join(repoRoot, 'public', 'forms', 'i-485.pdf')
const RAW_PATH = path.join(__dirname, 'i485-raw-fields.json')
const OUTPUT_PATH = path.join(__dirname, 'i485-matrimonio-test-output.pdf')

const EXPECTED_SHA = 'dff6e0288a1cefa9b4209ea67d2a30dac6c360b7a448f1bfcbfb30e3698d4af2'

function shortName(fullName) {
  const m = fullName.match(/\.([^.\[]+)\[(\d+)\]$/)
  if (!m) return fullName
  const base = m[1]
  const idx = m[2] === '0' ? '' : `_${m[2]}`
  return `${base}${idx}`
}

// Valores simulados por semanticKey (los que produce el prefill de matrimonio).
const SIMULATED_VALUES = {
  // Parte 1 — solicitante = la esposa (cross-form desde el I-130)
  pt1line1_familyname: 'Mendoza Rojas',
  pt1line1_givenname: 'Vianka',
  pt1line3_dob: '03/15/1995',
  pt1line6_cb_sex: true, // F
  pt1line7_citytownofbirth: 'Trujillo',
  pt1line7_countryofbirth: 'Peru',
  pt1line10_passportnum: '1234567',
  // Dirección física actual (Parte 1, item 18)
  pt1line18_streetnumbername: '123 Main St',
  pt1line18_cityortown: 'Miami',
  pt1line18_state: 'FL',
  pt1line18_zipcode: '33101',
  // Parte 3 — contacto
  pt3line5_email: 'vianka@email.com',
  // Parte 6 — Married + cónyuge actual = el esposo (desde su perfil)
  pt6line1_maritalstatus_3: true, // Married (on='2')
  pt6line4_familyname: 'Smith',
  pt6line4_givenname: 'James',
  pt6line4_middlename: 'Robert',
  pt6line16_dateofbirth: '07/04/1990',
  pt6line10_country: 'United States',
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
          if (typeof ml === 'number' && ml > 0 && String(rawValue).length > ml) field.setMaxLength(undefined)
        } catch { /* ignore */ }
        field.setText(String(rawValue))
        filledCount++
      } else if (field instanceof PDFCheckBox) {
        if (isTruthyValue(rawValue)) {
          const onValue = readCheckboxOnValue(field)
          if (onValue) {
            field.acroField.dict.set(PDFName.of('V'), PDFName.of(onValue))
            for (const w of field.acroField.getWidgets()) w.dict.set(PDFName.of('AS'), PDFName.of(onValue))
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
  // flatten=false (como el endpoint real): NeedAppearances + save sin regenerar
  // appearances (evita el RichTextFieldReadError de la Part 14).
  const acroForm = doc.catalog.lookup(PDFName.of('AcroForm'))
  if (acroForm instanceof PDFDict) acroForm.set(PDFName.of('NeedAppearances'), PDFBool.True)
  return await doc.save({ updateFieldAppearances: false })
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

  if (missing.length) console.warn('\n⚠ semanticKeys SIN campo PDF:', missing.join(', '))
  else console.log('\nTodos los semanticKeys simulados mapean a un campo PDF ✓')

  console.log('Fields a escribir:', Object.keys(valuesByPdfName).length)
  const filledBytes = await fillAcroForm(bytes, valuesByPdfName)
  fs.writeFileSync(OUTPUT_PATH, filledBytes)
  console.log('\nPDF rellenado guardado:', OUTPUT_PATH)
  if (missing.length) process.exit(1)
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
