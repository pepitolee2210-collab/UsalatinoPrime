// Normaliza el PDF USCIS I-485 — descomprime object streams y re-serializa con
// xref tradicional para que pdf-lib 1.17 pueda leer/rellenar el AcroForm.
//
// Por qué: el PDF tal como lo publica USCIS usa /ObjStm (object streams,
// PDF 1.5+) que pdf-lib 1.17 no descomprime correctamente. mupdf-js
// (Artifex MuPDF wrapped en WASM) sí los maneja y al re-guardar con flags
// { compress: false, garbage: 4 } produce un PDF equivalente con xref
// tradicional + objetos individuales.
//
// Uso: node scripts/normalize-i485.mjs
// Input : public/forms/i-485.pdf  (compressed)
// Output: public/forms/i-485.pdf  (normalized in place — backup .original.pdf)

import * as mupdf from 'mupdf'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const PDF_PATH = path.join(repoRoot, 'public', 'forms', 'i-485.pdf')
const BACKUP_PATH = path.join(repoRoot, 'public', 'forms', 'i-485.original.pdf')

async function main() {
  const bytes = fs.readFileSync(PDF_PATH)
  const sha256Before = crypto.createHash('sha256').update(bytes).digest('hex')
  console.log('Original SHA-256:', sha256Before)
  console.log('Original size   :', bytes.length, 'bytes')

  if (!fs.existsSync(BACKUP_PATH)) {
    fs.writeFileSync(BACKUP_PATH, bytes)
    console.log('Backup escrito en', BACKUP_PATH)
  }

  const doc = mupdf.PDFDocument.openDocument(bytes, 'application/pdf')
  console.log('Páginas:', doc.countPages())

  // Eliminar /Encrypt del trailer si existe (USCIS publica sin password pero
  // a veces vienen con marker de encryption)
  try {
    const trailer = doc.getTrailer()
    if (trailer && typeof trailer.delete === 'function') {
      trailer.delete('Encrypt')
      console.log('/Encrypt removido del trailer (si existía)')
    }
  } catch (err) {
    console.warn('No se pudo tocar /Encrypt:', err.message)
  }

  const buffer = doc.saveToBuffer('compress=no,decompress=yes,garbage=4,sanitize=yes,clean=yes,decrypt=yes,encryption=none')
  const out = buffer.asUint8Array()
  console.log('Normalized size:', out.length, 'bytes')

  fs.writeFileSync(PDF_PATH, out)

  const sha256After = crypto.createHash('sha256').update(out).digest('hex')
  console.log('Normalized SHA-256:', sha256After)
  console.log('Sobreescrito:', PDF_PATH)

  doc.destroy()
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
