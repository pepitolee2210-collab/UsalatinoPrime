import { PDFDocument, PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown, PDFName } from 'pdf-lib'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const PDF_PATH = path.join(repoRoot, 'public', 'forms', 'fm-sapcr-205.pdf')
const OUT = path.join(__dirname, 'fm-sapcr-205-raw-fields.json')

function fieldType(f) {
  if (f instanceof PDFTextField) return f.isMultiline() ? 'textarea' : 'text'
  if (f instanceof PDFCheckBox) return 'checkbox'
  if (f instanceof PDFRadioGroup) return 'radio'
  if (f instanceof PDFDropdown) return 'dropdown'
  return 'unknown'
}

function checkboxOnValue(field) {
  try {
    const widgets = field.acroField.getWidgets()
    if (!widgets.length) return null
    const ap = widgets[0].dict.lookup(PDFName.of('AP'))
    if (!ap) return null
    const normal = ap.lookup(PDFName.of('N'))
    if (!normal?.entries) return null
    for (const [k] of normal.entries()) {
      const s = k.toString()
      if (s !== '/Off') return s.replace('/', '')
    }
  } catch { /* ignore */ }
  return null
}

const bytes = fs.readFileSync(PDF_PATH)
const sha = crypto.createHash('sha256').update(bytes).digest('hex')
console.log('SHA-256:', sha)

const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
const fields = doc.getForm().getFields()
console.log('Total fields:', fields.length)
console.log('Pages:', doc.getPageCount())

const inspected = fields.map(f => {
  const entry = { name: f.getName(), type: fieldType(f) }
  if (f instanceof PDFCheckBox) {
    const ov = checkboxOnValue(f); if (ov) entry.checkboxOnValue = ov
  }
  if (f instanceof PDFTextField) {
    try { entry.maxLength = f.getMaxLength() ?? null } catch {}
    try { entry.isMultiline = f.isMultiline() } catch {}
  }
  try {
    const widgets = f.acroField.getWidgets()
    const pages = doc.getPages()
    const ps = new Set()
    for (const w of widgets) for (let i = 0; i < pages.length; i++) if (pages[i].node === w.P()) { ps.add(i + 1); break }
    entry.pages = [...ps].sort((a,b)=>a-b)
  } catch { entry.pages = [] }
  return entry
})

fs.writeFileSync(OUT, JSON.stringify({ pdf_path: 'public/forms/fm-sapcr-205.pdf', sha256: sha, total_fields: inspected.length, fields: inspected }, null, 2))
console.log('Escrito:', OUT)
