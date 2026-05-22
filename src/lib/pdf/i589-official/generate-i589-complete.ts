/**
 * Generador del PDF I-589 oficial USCIS COMPLETO (páginas 1-12) — Parte A
 * con datos del wizard + Parte B/C/D con Miedo Creíble structured + Part D
 * con política hardcoded + Supplement B cuando hay respuestas extendidas.
 *
 * Un solo fillAcroForm con valores mergeados, devuelve las 12 páginas + las
 * páginas de Supplement B necesarias.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { fillAcroForm } from '@/lib/legal/acroform-service'
import { buildPartAValues, type I589PartsData } from './generate-i589-part-a'
import { buildPartBCValues, appendSupplementBPages, type SupplementBEntry } from './generate-i589-part-b'
import { buildPartDValues } from './generate-i589-part-d'
import type { StructuredI589BC } from './parse-structured'

const PDF_DISK_PATH = path.join('public', 'forms', 'usa-i-589-asylum.pdf')

export interface GenerateI589CompleteOptions {
  parts: I589PartsData
  structured: StructuredI589BC
  applicantFullName: string
  applicantTelephone?: string | null
  supplementBEntries?: SupplementBEntry[]
}

export async function generateI589CompletePdf(
  options: GenerateI589CompleteOptions,
): Promise<Uint8Array> {
  const partA = buildPartAValues(options.parts)
  const partBC = buildPartBCValues(options.structured)
  const partD = buildPartDValues({
    applicantFullName: options.applicantFullName,
    applicantTelephone: options.applicantTelephone ?? null,
  })
  const merged = { ...partA, ...partBC, ...partD }

  const pdfPath = path.join(process.cwd(), PDF_DISK_PATH)
  const pdfBytes = await fs.readFile(pdfPath)
  const filledBytes = await fillAcroForm(new Uint8Array(pdfBytes), merged, { flatten: false })

  // Truncar a las primeras 12 páginas IN-PLACE para preservar el /AcroForm dict.
  const filledDoc = await PDFDocument.load(filledBytes)
  for (let i = filledDoc.getPageCount() - 1; i >= 12; i--) {
    filledDoc.removePage(i)
  }

  // Adjuntar Supplement B cuando hay entradas extendidas.
  if (options.supplementBEntries && options.supplementBEntries.length > 0) {
    await appendSupplementBPages(filledDoc, options.supplementBEntries, options.applicantFullName)
  }

  return await filledDoc.save()
}
