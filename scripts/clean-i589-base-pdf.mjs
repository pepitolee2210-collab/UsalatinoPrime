// One-shot cleaner for the I-589 base PDF.
//
// Problem: `public/forms/usa-i-589-asylum.pdf` was originally produced by
// converting the official USCIS XFA PDF into an AcroForm one. The conversion
// left behind XFA XML streams + XMP metadata containing absolute developer
// paths (e.g. `Z:\Logos\DHS Seal Black.jpg`, `C:\Users\ctabron\Documents\Doc2.jpg`).
// Some PDF viewers (Word, Chrome PDF viewer) read these as image alt-text
// and re-render them as caption-like text in the page footer, substituting
// the local user's home dir for missing paths (so the user sees
// `C:\Users\<them>\...\imagen1.jpg`).
//
// This script:
//   1. Removes `/Metadata` (XMP) and `/XFA` (legacy XFA tree) from the catalog.
//   2. Walks every page resource's XObjects and clears `/Alt` strings that
//      hold absolute paths.
//   3. Iterates the indirect object map; for each Flate-encoded stream whose
//      decoded body contains `embeddedHref` paths, rewrites the body with
//      the paths neutralized and re-encodes the stream.
//   4. Asserts: 460 AcroForm fields remain, 0 hits for leaked needles.
//   5. Overwrites `public/forms/usa-i-589-asylum.pdf` in place.
//
// One-shot: not invoked at runtime. Run manually (`node scripts/clean-i589-base-pdf.mjs`)
// when the base PDF needs to be re-cleaned.

import fs from 'node:fs/promises'
import zlib from 'node:zlib'
import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFRawStream,
  PDFString,
  PDFHexString,
  PDFArray,
} from 'pdf-lib'

const PDF_PATH = 'public/forms/usa-i-589-asylum.pdf'

// Strings we hunt for inside decoded streams. Anything containing one of
// these is rewritten so absolute developer paths leave the PDF.
const PATH_NEEDLES = [
  /[A-Z]:\\[^"<>\r\n]+\.(?:jpg|jpeg|png|gif|bmp|tiff)/gi,
  /[A-Z]:\/[^"<>\r\n]+\.(?:jpg|jpeg|png|gif|bmp|tiff)/gi,
]
// Standalone audit needles for the final verification pass.
// `embeddedHref` is intentionally NOT here — after cleaning, the XML attribute
// name may survive as `<text name="embeddedHref"/>` (empty element), which
// carries no leaked path and is harmless for viewers.
const AUDIT_NEEDLES = [
  'ctabron',
  'Z:\\Logos',
  'Z:/Logos',
  'C:\\Users',
  'C:/Users',
  'DHS Seal Black.jpg',
  'Doc2.jpg',
  'imagen1',
  'Trabajos',
]

function countNeedle(buffer, needle) {
  const target = Buffer.from(needle.replace(/\\\\/g, '\\'))
  let count = 0
  let i = 0
  while ((i = buffer.indexOf(target, i)) !== -1) {
    count++
    i += target.length
  }
  return count
}

/**
 * Replaces every absolute filesystem path inside a string with an empty alt-text
 * placeholder. Leaves the surrounding XML structure intact so XFA/XMP parsers
 * keep working.
 */
function neutralizePaths(text) {
  let out = text
  for (const pattern of PATH_NEEDLES) {
    out = out.replace(pattern, '')
  }
  // Optional belt-and-suspenders: strip `embeddedHref` text content entirely,
  // e.g. <text name="embeddedHref">PATH</text> → <text name="embeddedHref"/>.
  out = out.replace(
    /<text\b[^>]*name=["']embeddedHref["'][^>]*>[\s\S]*?<\/text>/gi,
    '<text name="embeddedHref"/>',
  )
  out = out.replace(
    /<rdf:value>[^<]*\.(?:jpg|jpeg|png|gif)[^<]*<\/rdf:value>/gi,
    '<rdf:value></rdf:value>',
  )
  return out
}

function tryInflate(buf) {
  try {
    return zlib.inflateSync(buf)
  } catch {
    try {
      return zlib.inflateRawSync(buf)
    } catch {
      return null
    }
  }
}

function deflate(buf) {
  return zlib.deflateSync(buf)
}

async function main() {
  const original = await fs.readFile(PDF_PATH)
  console.log('Loaded base PDF:', PDF_PATH, '(' + original.length + ' bytes)')

  const doc = await PDFDocument.load(original, { ignoreEncryption: true, updateMetadata: false })

  // ── 1. Drop /Metadata (XMP) from catalog ───────────────────────────────
  const catalog = doc.catalog
  if (catalog.has(PDFName.of('Metadata'))) {
    catalog.delete(PDFName.of('Metadata'))
    console.log('  ✓ removed /Metadata from catalog')
  }

  // ── 2. Drop /XFA from AcroForm ─────────────────────────────────────────
  const acroFormRef = catalog.get(PDFName.of('AcroForm'))
  if (acroFormRef) {
    const acroForm = doc.context.lookup(acroFormRef)
    if (acroForm instanceof PDFDict && acroForm.has(PDFName.of('XFA'))) {
      acroForm.delete(PDFName.of('XFA'))
      console.log('  ✓ removed /XFA from AcroForm')
    }
  }

  // Also drop /NeedsRendering (XFA-only hint) which can keep readers
  // searching for the XFA tree we just removed.
  if (catalog.has(PDFName.of('NeedsRendering'))) {
    catalog.delete(PDFName.of('NeedsRendering'))
    console.log('  ✓ removed /NeedsRendering from catalog')
  }

  // ── 3. Sweep ALL indirect dict-like objects; clear /Alt strings holding paths ──
  // (Walking only page resources misses XObjects referenced from the XFA tree.)
  let altCleared = 0
  for (const [, obj] of doc.context.indirectObjects.entries()) {
    const dict = obj instanceof PDFDict ? obj : obj?.dict instanceof PDFDict ? obj.dict : null
    if (!dict) continue
    const altKey = PDFName.of('Alt')
    const alt = dict.get(altKey)
    if (!alt) continue
    const altText = alt instanceof PDFString || alt instanceof PDFHexString ? alt.decodeText() : ''
    if (/[A-Z]:[\\/]/.test(altText) || /embeddedHref|imagen\d/i.test(altText)) {
      dict.set(altKey, PDFString.of('(image)'))
      altCleared++
    }
  }
  if (altCleared > 0) console.log('  ✓ cleared /Alt path text on ' + altCleared + ' object(s)')

  // ── 4. Rewrite Flate-encoded streams whose decoded body contains paths ──
  let streamsRewritten = 0
  for (const [, obj] of doc.context.indirectObjects.entries()) {
    if (!(obj instanceof PDFRawStream)) continue
    const filter = obj.dict.get(PDFName.of('Filter'))
    const filterName = filter instanceof PDFName ? filter.asString()
      : filter instanceof PDFArray && filter.size() > 0 ? filter.get(0).asString?.()
      : null
    let decoded
    if (filterName === '/FlateDecode') {
      decoded = tryInflate(Buffer.from(obj.contents))
    } else if (filterName == null) {
      decoded = Buffer.from(obj.contents)
    } else {
      continue
    }
    if (!decoded) continue
    const text = decoded.toString('latin1')
    if (!/embeddedHref|[A-Z]:\\|[A-Z]:\/|DHS Seal|Doc2\.jpg|imagen\d/.test(text)) continue

    const cleaned = neutralizePaths(text)
    if (cleaned === text) continue

    const cleanedBuf = Buffer.from(cleaned, 'latin1')
    if (filterName === '/FlateDecode') {
      const reEncoded = deflate(cleanedBuf)
      obj.contents = new Uint8Array(reEncoded)
      obj.dict.set(PDFName.of('Length'), doc.context.obj(reEncoded.length))
    } else {
      obj.contents = new Uint8Array(cleanedBuf)
      obj.dict.set(PDFName.of('Length'), doc.context.obj(cleanedBuf.length))
    }
    streamsRewritten++
  }
  console.log('  ✓ rewrote ' + streamsRewritten + ' stream(s) with leaked paths')

  // ── 5. Save and audit ───────────────────────────────────────────────────
  const out = await doc.save({ useObjectStreams: false })
  const outBuf = Buffer.from(out)

  console.log('\nAudit:')
  console.log('  output size:', outBuf.length, 'bytes (was ' + original.length + ')')

  let totalHits = 0
  for (const needle of AUDIT_NEEDLES) {
    const c = countNeedle(outBuf, needle)
    if (c > 0) {
      console.log('  ⚠ ' + JSON.stringify(needle).padEnd(28) + ' → ' + c + ' hits')
      totalHits += c
    }
  }
  if (totalHits === 0) {
    console.log('  ✓ all leaked path needles eliminated')
  }

  // Verify field count survived
  const verifyDoc = await PDFDocument.load(outBuf, { ignoreEncryption: true })
  const fieldCount = verifyDoc.getForm().getFields().length
  console.log('  AcroForm fields after clean:', fieldCount, '(expected 460)')
  if (fieldCount !== 460) {
    console.error('  ✗ FIELD COUNT CHANGED — aborting write')
    process.exit(1)
  }
  if (totalHits > 0) {
    console.error('  ✗ some needles still present — aborting write so the previous file is not lost')
    process.exit(2)
  }

  await fs.writeFile(PDF_PATH, outBuf)
  console.log('\n✓ Wrote cleaned PDF to', PDF_PATH)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
