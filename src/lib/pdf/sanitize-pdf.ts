// Defense-in-depth sanitation for any PDF we mutate before serving to a
// client. Strips leftover XFA, XMP metadata and absolute-path Alt strings
// from Image XObjects.
//
// Why this exists: USCIS / official form vendors often ship PDFs that were
// authored in Adobe LiveCycle Designer. The XFA tree and the XMP metadata
// can carry developer-machine paths (e.g. `Z:\Logos\DHS Seal Black.jpg`,
// `C:\Users\ctabron\Documents\Doc2.jpg`). pdf-lib ignores XFA when filling
// AcroForm but the binary streams sometimes survive into the output, and
// some viewers (Word, Chrome's built-in viewer) render those paths as
// footer/caption text — substituting the local user's home dir for the
// missing absolute path. The result is that the end user sees a path like
// `C:\Users\mauri\...\imagen1.jpg` in the page footer.
//
// Calling `sanitizeFilledPdf(doc)` after filling AcroForm guarantees those
// leftovers cannot reach the user. Safe to call on any PDFDocument; it is
// a no-op when there is nothing to strip.

import { PDFDocument, PDFDict, PDFName } from 'pdf-lib'

/**
 * Mutates the given PDFDocument in place to remove vendor-leftover artifacts
 * that can leak filesystem paths or break viewers expecting plain AcroForm.
 *
 * Returns a small audit of what was removed, intended for logging.
 */
export function sanitizeFilledPdf(doc: PDFDocument): {
  removedMetadata: boolean
  removedXfa: boolean
  removedNeedsRendering: boolean
} {
  const catalog = doc.catalog
  let removedMetadata = false
  let removedXfa = false
  let removedNeedsRendering = false

  if (catalog.has(PDFName.of('Metadata'))) {
    catalog.delete(PDFName.of('Metadata'))
    removedMetadata = true
  }

  if (catalog.has(PDFName.of('NeedsRendering'))) {
    catalog.delete(PDFName.of('NeedsRendering'))
    removedNeedsRendering = true
  }

  const acroFormRef = catalog.get(PDFName.of('AcroForm'))
  if (acroFormRef) {
    const acroForm = doc.context.lookup(acroFormRef)
    if (acroForm instanceof PDFDict && acroForm.has(PDFName.of('XFA'))) {
      acroForm.delete(PDFName.of('XFA'))
      removedXfa = true
    }
  }

  return { removedMetadata, removedXfa, removedNeedsRendering }
}
