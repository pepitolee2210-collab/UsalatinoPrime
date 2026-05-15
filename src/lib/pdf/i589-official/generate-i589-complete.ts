/**
 * Generador del PDF I-589 oficial USCIS COMPLETO (páginas 1-12) — Parte A
 * con datos del wizard + Parte B/C/D con Miedo Creíble structured.
 *
 * Un solo fillAcroForm con valores mergeados de ambas fuentes, flatten,
 * y devuelve las 12 páginas. Es el PDF que Diana presenta a USCIS.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { fillAcroForm } from '@/lib/legal/acroform-service'
import { buildPartAValues, type I589PartsData } from './generate-i589-part-a'
import { buildPartBCValues } from './generate-i589-part-b'
import type { StructuredI589BC } from './parse-structured'

const PDF_DISK_PATH = path.join('public', 'forms', 'usa-i-589-asylum.pdf')

export async function generateI589CompletePdf(
  parts: I589PartsData,
  structured: StructuredI589BC,
): Promise<Uint8Array> {
  const partA = buildPartAValues(parts)
  const partBC = buildPartBCValues(structured)
  const merged = { ...partA, ...partBC }

  const pdfPath = path.join(process.cwd(), PDF_DISK_PATH)
  const pdfBytes = await fs.readFile(pdfPath)
  const filledBytes = await fillAcroForm(new Uint8Array(pdfBytes), merged, { flatten: true })

  const filledDoc = await PDFDocument.load(filledBytes)
  const total = filledDoc.getPageCount()
  const indexes = Array.from({ length: Math.min(12, total) }, (_, i) => i)
  const truncated = await PDFDocument.create()
  const copied = await truncated.copyPages(filledDoc, indexes)
  for (const p of copied) truncated.addPage(p)
  return await truncated.save()
}
