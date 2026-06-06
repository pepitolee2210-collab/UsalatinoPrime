// Extrae el "tooltip" oficial (/TU = alternate field name) de cada campo del
// AcroForm del PDF USCIS I-485, junto con su semanticKey (la misma derivación
// que usa el schema auto-generado) y su on-value de checkbox.
//
// El /TU contiene el TEXTO HUMANO de USCIS para cada campo (ej. "Part 2. 3.c.
// Special Immigrant. Select Special Immigrant Juvenile, Form I-360."), que es
// la verdad oficial para curar labels en español y resolver el mal-etiquetado
// de secciones del generador.
//
// Output: scripts/i485-tooltips.json
// Uso: node scripts/extract-i485-tooltips.mjs

import { PDFDocument, PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown, PDFName, PDFString, PDFHexString } from 'pdf-lib'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const PDF_PATH = path.join(repoRoot, 'public', 'forms', 'i-485.pdf')
const OUTPUT_PATH = path.join(__dirname, 'i485-tooltips.json')

const EXPECTED_SHA = 'dff6e0288a1cefa9b4209ea67d2a30dac6c360b7a448f1bfcbfb30e3698d4af2'

// Misma derivación de semanticKey que el generador del schema: último segmento
// `.<Base>[<idx>]`, con sufijo `_<idx>` si idx>0, en minúsculas.
function shortName(fullName) {
  const m = fullName.match(/\.([^.\[]+)\[(\d+)\]$/)
  if (!m) return fullName
  const base = m[1]
  const idx = m[2] === '0' ? '' : `_${m[2]}`
  return `${base}${idx}`
}

function fieldType(field) {
  if (field instanceof PDFTextField) return field.isMultiline() ? 'textarea' : 'text'
  if (field instanceof PDFCheckBox) return 'checkbox'
  if (field instanceof PDFRadioGroup) return 'radio'
  if (field instanceof PDFDropdown) return 'dropdown'
  return 'unknown'
}

function checkboxOnValue(field) {
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
  } catch {
    // ignore
  }
  return null
}

function decodePdfText(obj) {
  if (!obj) return null
  if (obj instanceof PDFString || obj instanceof PDFHexString) {
    try { return obj.decodeText() } catch { /* ignore */ }
    try { return obj.asString() } catch { /* ignore */ }
  }
  try { return String(obj) } catch { return null }
}

// El /TU (tooltip / alternate field name) puede vivir en el dict del field o,
// para campos terminales con un solo widget, en el dict del widget.
function getTooltip(field) {
  try {
    const direct = field.acroField.dict.lookup(PDFName.of('TU'))
    const t = decodePdfText(direct)
    if (t) return t
  } catch { /* ignore */ }
  try {
    for (const w of field.acroField.getWidgets()) {
      const t = decodePdfText(w.dict.lookup(PDFName.of('TU')))
      if (t) return t
    }
  } catch { /* ignore */ }
  return null
}

function pagesOf(field, doc) {
  try {
    const widgets = field.acroField.getWidgets()
    const pages = doc.getPages()
    const set = new Set()
    for (const w of widgets) {
      const p = w.P()
      for (let i = 0; i < pages.length; i++) {
        if (pages[i].node === p) { set.add(i + 1); break }
      }
    }
    return [...set].sort((a, b) => a - b)
  } catch {
    return []
  }
}

async function main() {
  if (!fs.existsSync(PDF_PATH)) {
    console.error('PDF no encontrado en', PDF_PATH)
    process.exit(1)
  }

  const bytes = fs.readFileSync(PDF_PATH)
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex')
  console.log('SHA-256:', sha256)
  if (sha256 !== EXPECTED_SHA) {
    console.error(`ERROR: SHA mismatch. Esperado ${EXPECTED_SHA}. ¿Nueva edición de USCIS?`)
    process.exit(1)
  }
  console.log('SHA verificado ✓')

  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const form = doc.getForm()
  const rawFields = form.getFields()
  console.log('Total fields:', rawFields.length)

  let withTooltip = 0
  const fields = rawFields.map((f) => {
    const name = f.getName()
    const semanticKey = shortName(name).toLowerCase()
    const type = fieldType(f)
    const tooltip = getTooltip(f)
    if (tooltip) withTooltip++
    const entry = { semanticKey, pdfFieldName: name, type, tooltip, pages: pagesOf(f, doc) }
    if (f instanceof PDFCheckBox) {
      const onValue = checkboxOnValue(f)
      if (onValue) entry.onValue = onValue
    }
    if (f instanceof PDFRadioGroup || f instanceof PDFDropdown) {
      try { entry.options = f.getOptions() } catch { /* ignore */ }
    }
    if (f instanceof PDFTextField) {
      try { const ml = f.getMaxLength(); if (typeof ml === 'number') entry.maxLength = ml } catch { /* ignore */ }
    }
    return entry
  })

  console.log(`Campos con tooltip /TU: ${withTooltip} / ${fields.length}`)

  const output = {
    pdf_path: 'public/forms/i-485.pdf',
    sha256,
    total_fields: fields.length,
    fields_with_tooltip: withTooltip,
    fields,
  }
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2))
  console.log('Escrito:', OUTPUT_PATH)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
