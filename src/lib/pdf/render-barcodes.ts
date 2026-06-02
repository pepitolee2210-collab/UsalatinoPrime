// Server-side renderer for PDF417 barcode widgets embedded in AcroForm PDFs.
//
// Why this exists: USCIS forms (I-589, I-360, I-130, etc.) originally ship as
// XFA PDFs where the page footer barcode is generated dynamically by form-calc
// when the form is printed. When those PDFs are flattened to AcroForm so
// pdf-lib can fill the fields, the barcode survives only as a read-only
// `PDFTextField` carrying the metadata payload (e.g. "I-589|01/20/25|1") but
// without an appearance stream. Viewers either ignore it (no visible footer)
// or render it as plain text — USCIS scanners then reject the form because
// the actual PDF417 image is missing.
//
// `renderPdf417Barcodes(pdfDoc)` walks every text field whose name contains
// "BarCode", grabs the field value and the widget rectangle, generates a real
// PDF417 PNG with bwip-js, and draws the image over the widget. The field is
// then cleared so the underlying plain text never bleeds through.
//
// Mirrors the pattern in `src/lib/pdf/i360/generate-i360.ts:renderBarcodes`
// but uses `bwip-js` (root export, `toBuffer`) which runs in Node — i360
// imports `bwip-js/browser` because that generator is invoked client-side.

import type { PDFDocument } from 'pdf-lib'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bwipjs = require('bwip-js')

export interface RenderBarcodeResult {
  /** Number of barcode widgets successfully drawn. */
  rendered: number
  /** Number of barcode widgets where rendering threw — generation continues. */
  failed: number
  /** Number of barcode fields found but skipped (no value, no widget, no rect). */
  skipped: number
}

/**
 * Walks every AcroForm field named like `*BarCode*`, generates a PDF417 PNG
 * from the field text, and draws it over the widget rectangle. Tolerant: a
 * single barcode failure logs and continues so the whole PDF still ships.
 */
export async function renderPdf417Barcodes(pdfDoc: PDFDocument): Promise<RenderBarcodeResult> {
  const form = pdfDoc.getForm()
  const pages = pdfDoc.getPages()
  const pageRefMap = new Map<string, number>()
  pages.forEach((page, idx) => pageRefMap.set(page.ref.toString(), idx))

  const result: RenderBarcodeResult = { rendered: 0, failed: 0, skipped: 0 }

  for (const field of form.getFields()) {
    if (!field.getName().includes('BarCode')) continue

    let textValue: string | null = null
    try {
      textValue = (field as { getText?: () => string }).getText?.() ?? null
    } catch {
      // Not a text field (e.g. a button widget mistakenly named BarCode); skip.
    }
    if (!textValue) {
      result.skipped++
      continue
    }

    const widgets = field.acroField.getWidgets()
    if (widgets.length === 0) {
      result.skipped++
      continue
    }

    for (const widget of widgets) {
      const parentPageRef = widget.P()
      const pageIdx = parentPageRef ? pageRefMap.get(parentPageRef.toString()) ?? -1 : -1
      if (pageIdx < 0 || pageIdx >= pages.length) {
        result.skipped++
        continue
      }
      const rect = widget.getRectangle()
      if (!rect) {
        result.skipped++
        continue
      }

      try {
        const png = await generatePdf417Png(textValue)
        const img = await pdfDoc.embedPng(png)
        pages[pageIdx].drawImage(img, {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        })
        // Clear the underlying text so viewers that regenerate appearances
        // don't paint "I-589|01/20/25|3" beneath the barcode image.
        try {
          (field as { setText?: (v: string) => void }).setText?.('')
        } catch {
          // Some viewers / pdf-lib versions throw on read-only fields; ignore.
        }
        result.rendered++
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err)
        console.warn(`renderPdf417Barcodes: failed for "${field.getName()}" — ${reason}`)
        result.failed++
      }
    }
  }

  return result
}

/**
 * Generates a PDF417 PNG encoding `text`. Uses bwip-js's Node API (`toBuffer`),
 * unlike the i360 client-side renderer that uses the browser canvas path.
 *
 * Options mirror the i360 generator (`scale: 2, eclevel: 2, columns: 8`) so
 * the visual barcode density matches what USCIS forms produce in print.
 */
async function generatePdf417Png(text: string): Promise<Uint8Array> {
  return new Promise<Uint8Array>((resolve, reject) => {
    bwipjs.toBuffer(
      {
        bcid: 'pdf417',
        text,
        scale: 2,
        eclevel: 2,
        columns: 8,
      },
      (err: Error | string | null, png: Buffer) => {
        if (err) {
          reject(err instanceof Error ? err : new Error(String(err)))
        } else {
          resolve(new Uint8Array(png))
        }
      },
    )
  })
}
