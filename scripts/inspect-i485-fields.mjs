// Inspecciona los AcroForm fields del PDF USCIS I-485 oficial.
// Output: scripts/i485-raw-fields.json + SHA-256 a stdout.
// Uso: node scripts/inspect-i485-fields.mjs
//
// Re-correr cada vez que USCIS publique una nueva edición del I-485.
// El SHA-256 emitido se hardcodea en src/lib/legal/i485-form-schema.ts
// (PDF_SHA256) para que la ruta /print falle loudly si el archivo cambia
// sin re-mapear el schema.

import { PDFDocument, PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown, PDFName } from 'pdf-lib'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const PDF_PATH = path.join(repoRoot, 'public', 'forms', 'i-485.pdf')
const OUTPUT_PATH = path.join(__dirname, 'i485-raw-fields.json')

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

    // Página(s) donde aparece (puede tener varios widgets en distintas páginas)
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
    pdf_path: 'public/forms/i-485.pdf',
    sha256,
    bytes: bytes.length,
    total_fields: inspected.length,
    inspected_at: new Date().toISOString(),
    fields: inspected,
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2))
  console.log('Escrito:', OUTPUT_PATH)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
