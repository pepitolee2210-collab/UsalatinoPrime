/**
 * Generador del PDF I-589 oficial USCIS COMPLETO (páginas 1-12) — Parte A
 * con datos del wizard + Parte B/C/D con Miedo Creíble structured.
 *
 * Un solo fillAcroForm con valores mergeados de ambas fuentes (AcroForm
 * editable, ver acroform-service NeedAppearances) y devuelve las 12 páginas.
 * Es el PDF que Diana presenta a USCIS, editable para correcciones manuales.
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
  const filledBytes = await fillAcroForm(new Uint8Array(pdfBytes), merged, { flatten: false })

  // Truncar a las primeras 12 páginas IN-PLACE para preservar el /AcroForm dict.
  // copyPages() a un PDFDocument nuevo dejaría los widgets sin form root.
  const filledDoc = await PDFDocument.load(filledBytes)
  for (let i = filledDoc.getPageCount() - 1; i >= 12; i--) {
    filledDoc.removePage(i)
  }
  return await filledDoc.save()
}
