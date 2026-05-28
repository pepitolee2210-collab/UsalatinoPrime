/**
 * Generador del PDF I-589 oficial USCIS COMPLETO (páginas 1-12) — Parte A
 * con datos del wizard + Parte B/C/D con Miedo Creíble structured + Part D
 * con política hardcoded + Supplement B cuando hay respuestas extendidas.
 *
 * Pipeline (sigue el mismo patrón "single-instance, single-save" del I-360,
 * `src/lib/pdf/i360/generate-i360.ts`):
 *
 *   1. Load PDF base UNA sola vez.
 *   2. `fillAcroFormInPlace` — llena fields sin save intermedio.
 *   3. `removePage` para truncar a 12 páginas.
 *   4. `sanitizeFilledPdf` — quita XFA/XMP leftovers.
 *   5. `renderPdf417Barcodes` — dibuja los 12 PDF417 sobre los widgets.
 *   6. `appendSupplementBPages` — agrega páginas extra si aplica.
 *   7. NeedAppearances=true → save() único.
 *
 * El bug histórico era hacer `fillAcroForm` + reload + segundo save: ese
 * patrón "double-save" hacía que pdf-lib regenerara appearances en el save
 * final, tapando los PDF417 ya dibujados. El I-360 nunca tuvo este bug
 * porque carga el PDF, fill, render y save en una sola instance.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, PDFName, PDFDict, PDFBool } from 'pdf-lib'
import { fillAcroFormInPlace } from '@/lib/legal/acroform-service'
import { sanitizeFilledPdf } from '@/lib/pdf/sanitize-pdf'
import { renderPdf417Barcodes } from '@/lib/pdf/render-barcodes'
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

  // ── ÚNICA instance del PDFDocument (patrón I-360) ──
  const pdfPath = path.join(process.cwd(), PDF_DISK_PATH)
  const pdfBytes = await fs.readFile(pdfPath)
  const doc = await PDFDocument.load(new Uint8Array(pdfBytes))

  // Fill sin save intermedio
  fillAcroFormInPlace(doc, merged)

  // Truncar a las primeras 12 páginas (preserva /AcroForm para post-edición)
  for (let i = doc.getPageCount() - 1; i >= 12; i--) {
    doc.removePage(i)
  }

  // Defense-in-depth: si en el futuro alguien sube un PDF base con XFA/XMP
  // leftovers, esto garantiza que no lleguen al cliente como paths absolutos
  // en el footer.
  sanitizeFilledPdf(doc)

  // Renderiza los 12 códigos PDF417 del footer (mismo helper que el I-360,
  // adaptado a Node server-side).
  await renderPdf417Barcodes(doc)

  // Adjuntar Supplement B cuando hay entradas extendidas.
  if (options.supplementBEntries && options.supplementBEntries.length > 0) {
    await appendSupplementBPages(doc, options.supplementBEntries, options.applicantFullName)
  }

  // NeedAppearances=true → los viewers regeneran appearances al abrir, así
  // los valores se ven y los campos siguen editables para Diana.
  const acroForm = doc.catalog.lookup(PDFName.of('AcroForm'))
  if (acroForm instanceof PDFDict) {
    acroForm.set(PDFName.of('NeedAppearances'), PDFBool.True)
  }

  // ÚNICO save (igual que I-360). Default `updateFieldAppearances: true` —
  // pdf-lib regenera appearances vacías sobre los TextFields del barcode
  // (que ya fueron clearados con `setText('')` por `renderPdf417Barcodes`);
  // esas appearances vacías no tapan la imagen drawn.
  return await doc.save()
}
