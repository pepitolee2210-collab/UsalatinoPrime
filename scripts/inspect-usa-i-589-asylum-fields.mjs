// Inspecciona los AcroForm fields del PDF I-589 oficial USCIS.
// Output: scripts/usa-i-589-asylum-raw-fields.json + SHA-256 a stdout.
// Uso: node scripts/inspect-usa-i-589-asylum-fields.mjs
//
// PRE-REQUISITO: el PDF en public/forms/usa-i-589-asylum.pdf debe estar
// normalizado (ejecutar `node scripts/normalize-usa-i-589-asylum.mjs` primero).
// El PDF oficial USCIS usa object streams comprimidos + encryption que pdf-lib
// 1.17 no maneja; el script de normalización los descomprime y elimina la
// encryption preservando los fields del AcroForm.

import { PDFDocument, PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown, PDFName } from 'pdf-lib'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const PDF_PATH = path.join(repoRoot, 'public', 'forms', 'usa-i-589-asylum.pdf')
const OUTPUT_PATH = path.join(__dirname, 'usa-i-589-asylum-raw-fields.json')

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

async function main() {
  if (!fs.existsSync(PDF_PATH)) {
    console.error('PDF no encontrado en', PDF_PATH)
    process.exit(1)
  }

  const bytes = fs.readFileSync(PDF_PATH)
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex')
  console.log('SHA-256:', sha256)
  console.log('Tamaño :', bytes.length, 'bytes')

  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const form = doc.getForm()
  const rawFields = form.getFields()

  console.log('Total fields:', rawFields.length)
  console.log('Total páginas:', doc.getPageCount())

  const inspected = rawFields.map((f) => {
    const name = f.getName()
    const type = fieldType(f)
    const entry = { name, type }

    if (f instanceof PDFCheckBox) {
      const onValue = checkboxOnValue(f)
      if (onValue) entry.checkboxOnValue = onValue
      try { entry.isChecked = f.isChecked() } catch { /* ignore */ }
    }
    if (f instanceof PDFTextField) {
      try { entry.defaultValue = f.getText() ?? '' } catch { /* ignore */ }
      try { entry.maxLength = f.getMaxLength() ?? null } catch { /* ignore */ }
      try { entry.isMultiline = f.isMultiline() } catch { /* ignore */ }
    }
    if (f instanceof PDFRadioGroup || f instanceof PDFDropdown) {
      try { entry.options = f.getOptions() } catch { /* ignore */ }
    }
    try { entry.isReadOnly = f.isReadOnly() } catch { /* ignore */ }
    try { entry.isRequired = f.isRequired() } catch { /* ignore */ }

    try {
      const widgets = f.acroField.getWidgets()
      const pages = doc.getPages()
      const pagesWithField = new Set()
      for (const w of widgets) {
        for (let i = 0; i < pages.length; i++) {
          if (pages[i].node === w.P()) {
            pagesWithField.add(i + 1)
            break
          }
        }
      }
      entry.pages = [...pagesWithField].sort((a, b) => a - b)
    } catch {
      entry.pages = []
    }

    return entry
  })

  const output = {
    pdf_path: 'public/forms/usa-i-589-asylum.pdf',
    sha256,
    bytes: bytes.length,
    total_fields: inspected.length,
    inspected_at: new Date().toISOString(),
    fields: inspected,
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2))
  console.log('Escrito:', OUTPUT_PATH)

  // Resumen por página (útil para validar que páginas 1-4 tienen los fields de Parte A)
  const byPage = new Map()
  for (const e of inspected) {
    for (const p of e.pages ?? []) {
      byPage.set(p, (byPage.get(p) ?? 0) + 1)
    }
  }
  console.log('\nFields por página:')
  for (const [p, count] of [...byPage.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  Página ${p}: ${count} fields`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
