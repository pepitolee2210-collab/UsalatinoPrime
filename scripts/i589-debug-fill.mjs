// Genera un PDF I-589 con CADA field rellenado con un nombre corto e
// identificable. Sirve para mapear visualmente los TextField anónimos
// (TextField1[N], DateTimeField1[N], CheckBox3[N], etc.) a las preguntas
// del wizard cliente.
//
// Uso: node scripts/i589-debug-fill.mjs
// Output: public/forms/usa-i-589-asylum-debug.pdf

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PDFDocument, PDFTextField, PDFCheckBox } from 'pdf-lib'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const PDF_IN = path.join(repoRoot, 'public', 'forms', 'usa-i-589-asylum.pdf')
const PDF_OUT = path.join(repoRoot, 'public', 'forms', 'usa-i-589-asylum-debug.pdf')

function shortName(fullName) {
  // Quitar el prefijo `form1[0].#subform[N].` y truncar.
  // Ejemplo: form1[0].#subform[0].PtAILine4_LastName[0] → PtAILine4_LastName
  // Ejemplo: form1[0].#subform[0].TextField1[3] → TextField1[3]
  // Ejemplo: form1[0].#subform[1].NotMarried[0].PtAIILine5_LastName[0] → NotMarried/PtAIILine5_LastName
  let s = fullName.replace(/^form1\[0\]\.#subform\[\d+\]\.?/, '')
  s = s.replace(/\[0\]$/, '') // quitar [0] final irrelevante
  return s.slice(0, 28)
}

async function main() {
  const bytes = fs.readFileSync(PDF_IN)
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const form = doc.getForm()
  const fields = form.getFields()

  let filledText = 0
  let checkedBoxes = 0

  for (const f of fields) {
    const fullName = f.getName()
    if (fullName.includes('PDF417BarCode')) continue
    const label = shortName(fullName)
    try {
      if (f instanceof PDFTextField) {
        // Remover maxLen para evitar truncamiento
        try {
          const ml = f.getMaxLength()
          if (typeof ml === 'number' && ml > 0 && label.length > ml) f.setMaxLength(undefined)
        } catch {}
        f.setText(label)
        filledText++
      } else if (f instanceof PDFCheckBox) {
        f.check()
        checkedBoxes++
      }
    } catch (err) {
      console.warn('Skip', fullName, ':', err.message)
    }
  }

  try {
    form.flatten()
  } catch (err) {
    console.warn('flatten failed:', err.message)
  }

  const outBytes = await doc.save({ updateFieldAppearances: false })
  fs.writeFileSync(PDF_OUT, outBytes)
  console.log('Total fields:', fields.length)
  console.log('Text filled :', filledText)
  console.log('Checks      :', checkedBoxes)
  console.log('Generado    :', PDF_OUT)
}

main().catch((err) => { console.error(err); process.exit(1) })
