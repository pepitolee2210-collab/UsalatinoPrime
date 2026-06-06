// Verificación end-to-end de la capa curada del cliente I-485 (sin Next.js).
//
// 1. INTEGRIDAD: toda `key` real y todo destino de `real` referenciado por las
//    secciones curadas existe como campo del acroform (= el assert del módulo,
//    ejecutado aquí contra scripts/i485-tooltips.json).
// 2. MAPEO Sí/No: para cada control virtual con `real: { Y, N }`, el campo Y
//    tiene onValue 'Y' y el N tiene 'N' (anclado al acroform, no al sufijo).
// 3. FILL REAL: rellena el PDF con la categoría SIJS hardcodeada + valores de
//    muestra y confirma 0 warnings y que la categoría 3.c y la exención de carga
//    pública quedan marcadas con su on-value correcto.
//
// Uso: node scripts/test-i485-client-fill.mjs

import { PDFDocument, PDFTextField, PDFCheckBox, PDFName, PDFDict, PDFBool } from 'pdf-lib'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const PDF_PATH = path.join(repoRoot, 'public', 'forms', 'i-485.pdf')
const TOOLTIPS_PATH = path.join(__dirname, 'i485-tooltips.json')
const OUTPUT_PATH = path.join(__dirname, 'i485-client-test-output.pdf')
const EXPECTED_SHA = 'dff6e0288a1cefa9b4209ea67d2a30dac6c360b7a448f1bfcbfb30e3698d4af2'

const SECTIONS_DIR = path.join(repoRoot, 'src', 'lib', 'legal', 'i485-sections')
const CURATED_FILES = ['personal.ts', 'family.ts', 'legal.ts']

let failures = 0
const fail = (msg) => { console.error('  ✗ ' + msg); failures++ }

// ── Cargar la verdad del acroform desde el JSON de tooltips ────────────────
const tips = JSON.parse(fs.readFileSync(TOOLTIPS_PATH, 'utf8'))
const skToPdf = {}
const skOnValue = {}
for (const f of tips.fields) {
  if (!(f.semanticKey in skToPdf)) skToPdf[f.semanticKey] = f.pdfFieldName
  if (f.onValue) skOnValue[f.semanticKey] = f.onValue
}

// ── Parsear las secciones curadas (.txt) ───────────────────────────────────
let curated = ''
for (const file of CURATED_FILES) {
  const p = path.join(SECTIONS_DIR, file)
  if (!fs.existsSync(p)) { fail(`falta ${file}`); continue }
  curated += '\n' + fs.readFileSync(p, 'utf8')
}

const directKeys = [...curated.matchAll(/\bkey:\s*['"]([^'"]+)['"]/g)].map((m) => m[1])
const realBlocks = [...curated.matchAll(/\breal:\s*\{([^}]+)\}/g)].map((m) => m[1])

console.log(`Secciones curadas: ${directKeys.length} campos; ${realBlocks.length} mapeos virtuales.`)

// 1. INTEGRIDAD de keys reales (las virtuales v_* no están en el PDF)
console.log('\n[1] Integridad de semanticKeys reales')
let orphanKeys = 0
for (const k of directKeys) {
  if (k.startsWith('v_')) continue
  if (!(k in skToPdf)) { fail(`key inexistente en acroform: ${k}`); orphanKeys++ }
}
if (orphanKeys === 0) console.log(`  ✓ las ${directKeys.filter((k) => !k.startsWith('v_')).length} keys reales existen en el acroform`)

// 2. Destinos de `real` + mapeo Y/N
console.log('\n[2] Mapeos virtuales → checkbox real')
let ynChecked = 0
for (const block of realBlocks) {
  const pairs = [...block.matchAll(/(['"]?)([\w]+)\1\s*:\s*['"]([^'"]+)['"]/g)].map((m) => [m[2], m[3]])
  for (const [optValue, realKey] of pairs) {
    if (!(realKey in skToPdf)) fail(`destino real inexistente: ${realKey}`)
    // Para Sí/No, el on-value del campo destino debe coincidir con la opción.
    if ((optValue === 'Y' || optValue === 'N') && skOnValue[realKey] && skOnValue[realKey] !== optValue) {
      fail(`mapeo Y/N invertido: opción ${optValue} → ${realKey} (onValue real=${skOnValue[realKey]})`)
    }
    if (optValue === 'Y' || optValue === 'N') ynChecked++
  }
}
if (failures === 0) console.log(`  ✓ todos los destinos existen; ${ynChecked} mapeos Sí/No con on-value correcto`)

// 3. FILL REAL del PDF
console.log('\n[3] Fill real del PDF')
const bytes = fs.readFileSync(PDF_PATH)
const sha = crypto.createHash('sha256').update(bytes).digest('hex')
if (sha !== EXPECTED_SHA) fail(`SHA del PDF cambió: ${sha}`)

function readCheckboxOnValue(field) {
  try {
    const ap = field.acroField.getWidgets()[0]?.dict.lookup(PDFName.of('AP'))
    const n = ap?.lookup(PDFName.of('N'))
    if (n?.entries) for (const [k] of n.entries()) { const s = k.toString(); if (s !== '/Off') return s.replace('/', '') }
  } catch { /* ignore */ }
  return null
}

// Categoría SIJS hardcodeada (igual que I485_DEFINITION.hardcodedValues) + muestra.
const SAMPLE = {
  pt2line3c_cb_1: true, // SIJS 3.c
  pt9line56_cb_6: true, // exención public charge SIJ
  pt1line1_familyname: 'García López',
  pt1line1_givenname: 'María',
  pt1line3_dob: '03/25/2008',
  pt1line6_cb_sex: true, // F (resultado de v_sex='F')
  pt1line7_countryofbirth: 'Honduras',
}

const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
const form = doc.getForm()
let warnings = 0
for (const [sk, val] of Object.entries(SAMPLE)) {
  const pdfName = skToPdf[sk]
  if (!pdfName) { fail(`muestra: ${sk} sin pdfFieldName`); continue }
  try {
    const field = form.getField(pdfName)
    if (field instanceof PDFTextField) {
      field.setText(String(val))
    } else if (field instanceof PDFCheckBox && val === true) {
      const on = readCheckboxOnValue(field)
      if (on) {
        field.acroField.dict.set(PDFName.of('V'), PDFName.of(on))
        for (const w of field.acroField.getWidgets()) w.dict.set(PDFName.of('AS'), PDFName.of(on))
      } else field.check()
    }
  } catch (e) { warnings++; console.warn('  ⚠ ' + pdfName + ': ' + e.message) }
}
const acro = doc.catalog.lookup(PDFName.of('AcroForm'))
if (acro instanceof PDFDict) acro.set(PDFName.of('NeedAppearances'), PDFBool.True)
const outBytes = await doc.save({ updateFieldAppearances: false })
fs.writeFileSync(OUTPUT_PATH, outBytes)

// Re-leer y confirmar que la categoría SIJS quedó marcada con su on-value.
const verify = await PDFDocument.load(outBytes, { ignoreEncryption: true })
const vform = verify.getForm()
for (const [sk, expectedOn] of [['pt2line3c_cb_1', '3c0'], ['pt9line56_cb_6', '6']]) {
  const field = vform.getField(skToPdf[sk])
  const v = field.acroField.dict.lookup(PDFName.of('V'))
  const got = v ? v.toString().replace('/', '') : null
  if (got === expectedOn) console.log(`  ✓ ${sk} marcado con on-value ${expectedOn}`)
  else fail(`${sk} debía quedar en ${expectedOn}, quedó en ${got}`)
}
console.log(`  warnings de fill: ${warnings}`)
if (warnings > 0) failures++

console.log('\n' + (failures === 0 ? '✅ TODO OK' : `❌ ${failures} fallos`))
process.exit(failures === 0 ? 0 : 1)
