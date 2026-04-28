// Normaliza el PDF PR-GEN-116 — descomprime object streams y re-serializa con
// xref tradicional para que pdf-lib 1.17 pueda leer/rellenar el AcroForm.
//
// Por qué: el PDF tal como lo publica Texas Office of Court Administration
// usa /ObjStm (object streams, PDF 1.5+) que pdf-lib 1.17 no descomprime
// correctamente. mupdf-js (Artifex MuPDF wrapped en WASM) sí los maneja y al
// re-guardar con flags { compress: false, garbage: 4 } produce un PDF
// equivalente con xref tradicional + objetos individuales.
//
// Uso: node scripts/normalize-pr-gen-116.mjs
// Input : public/forms/pr-gen-116.pdf  (encrypted/compressed)
// Output: public/forms/pr-gen-116.pdf  (normalized in place — backup .original.pdf)

import * as mupdf from 'mupdf'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const PDF_PATH = path.join(repoRoot, 'public', 'forms', 'pr-gen-116.pdf')
const BACKUP_PATH = path.join(repoRoot, 'public', 'forms', 'pr-gen-116.original.pdf')

async function main() {
  const bytes = fs.readFileSync(PDF_PATH)
  const sha256Before = crypto.createHash('sha256').update(bytes).digest('hex')
  console.log('Original SHA-256:', sha256Before)
  console.log('Original size   :', bytes.length, 'bytes')

  // Backup original (sólo si no existe ya — para no machacar)
  if (!fs.existsSync(BACKUP_PATH)) {
    fs.writeFileSync(BACKUP_PATH, bytes)
    console.log('Backup escrito en', BACKUP_PATH)
  }

  // Cargar con mupdf
  const doc = mupdf.PDFDocument.openDocument(bytes, 'application/pdf')
  console.log('Páginas:', doc.countPages())

  // Eliminar el diccionario /Encrypt del trailer. mupdf decifra strings/streams al
  // leer (porque la password es vacía), pero por defecto re-encripta al guardar y
  // pdf-lib lee los nombres de los fields como bytes RC4 ilegibles. Quitar
  // /Encrypt del trailer fuerza a mupdf a serializar texto plano.
  try {
    const trailer = doc.getTrailer()
    if (trailer && typeof trailer.delete === 'function') {
      trailer.delete('Encrypt')
      console.log('/Encrypt removido del trailer')
    }
  } catch (err) {
    console.warn('No se pudo remover /Encrypt:', err.message)
  }

  // Re-serializar sin compresión + descomprimiendo streams + sin encriptación.
  // - compress=no       → no comprimir streams nuevos
  // - decompress=yes    → descomprime los object streams existentes
  // - garbage=4         → garbage collect / renumera objetos
  // - sanitize=yes      → reescribe entradas malformadas
  // - clean=yes         → limpia, normaliza
  const buffer = doc.saveToBuffer('compress=no,decompress=yes,garbage=4,sanitize=yes,clean=yes,decrypt=yes,encryption=none')
  const out = buffer.asUint8Array()
  console.log('Normalized size:', out.length, 'bytes')

  // Sobreescribir
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
