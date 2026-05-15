// Renderiza cada página del PDF debug a PNG usando mupdf.
// Output: scripts/debug-pages/page-{N}.png
//
// Uso: node scripts/render-debug-pages.mjs

import * as mupdf from 'mupdf'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const PDF_IN = path.join(repoRoot, 'public', 'forms', 'usa-i-589-asylum-debug.pdf')
const OUT_DIR = path.join(__dirname, 'debug-pages')

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

const bytes = fs.readFileSync(PDF_IN)
const doc = mupdf.PDFDocument.openDocument(bytes, 'application/pdf')
const total = doc.countPages()
console.log('Páginas:', total)

const zoom = 1.5
const matrix = mupdf.Matrix.scale(zoom, zoom)

for (let i = 0; i < total; i++) {
  const page = doc.loadPage(i)
  const pix = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false, true)
  const png = pix.asPNG()
  const out = path.join(OUT_DIR, `page-${String(i + 1).padStart(2, '0')}.png`)
  fs.writeFileSync(out, png)
  console.log('Escrito:', out)
}

doc.destroy()
