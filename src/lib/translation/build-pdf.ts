'use client'

import jsPDF from 'jspdf'
import type { TranslatedDoc } from './schema'

interface BuildOptions {
  doc: TranslatedDoc
  /** Fecha que va al lado de "Date:" en la página de certificación. */
  certDate: string
  /** Firma del traductor como dataURL ("data:image/png;base64,..."). */
  signatureDataUrl: string | null
}

const TEXT: [number, number, number] = [20, 20, 20]
const PAGE_W = 216
const PAGE_H = 279
const ML = 25
const MR = 25
const MT = 25
const MB = 25
const CONTENT_W = PAGE_W - ML - MR
const FONT = 'helvetica'

// Bloque fijo de la certificación — el experto de Henry (Andrew Sonny Navarro)
// es el traductor oficial. Henry pidió que aparezca igual en TODOS los PDFs.
const CERT_BLOCK = {
  title: 'Translation Certification',
  body: 'I, Andrew Sonny Navarro, hereby certify that I translated the attached document from Spanish into English and that, to the best of my ability, it is a true and correct translation. I further certify that I am competent in both Spanish and English to render and certify such translation.',
}

export function buildTranslationPDF({ doc, certDate, signatureDataUrl }: BuildOptions): Blob {
  const pdf = new jsPDF('p', 'mm', 'letter')
  pdf.setTextColor(...TEXT)

  let y = MT

  // ── PÁGINA 1: traducción ─────────────────────────────────────────
  pdf.setFont(FONT, 'bold')
  pdf.setFontSize(12)
  pdf.text('CERTIFIED TRANSLATION FROM SPANISH INTO ENGLISH', PAGE_W / 2, y, { align: 'center' })
  y += 10

  pdf.setFontSize(11)
  for (const line of doc.jurisdiction_header || []) {
    if (!line.trim()) continue
    y = ensureSpace(pdf, y, 6)
    pdf.setFont(FONT, 'bold')
    pdf.text(line, ML, y)
    y += 6
  }

  if (doc.document_type) {
    y += 2
    y = ensureSpace(pdf, y, 7)
    pdf.setFont(FONT, 'bold')
    pdf.setFontSize(11.5)
    pdf.text(doc.document_type, ML, y)
    y += 6
  }

  if (doc.registration_number) {
    pdf.setFont(FONT, 'normal')
    pdf.setFontSize(11)
    y = drawLabelValue(pdf, 'Registration Number', doc.registration_number, y)
  }

  if (doc.issuing_authority) {
    y += 2
    y = ensureSpace(pdf, y, 6)
    pdf.setFont(FONT, 'normal')
    pdf.setFontSize(11)
    y = drawWrapped(pdf, doc.issuing_authority, y)
  }

  if (doc.certification_verb) {
    y += 2
    y = ensureSpace(pdf, y, 7)
    pdf.setFont(FONT, 'bold')
    pdf.setFontSize(11.5)
    pdf.text(doc.certification_verb, ML, y)
    y += 6
  }

  if (doc.certification_paragraph) {
    pdf.setFont(FONT, 'normal')
    pdf.setFontSize(11)
    y = drawWrapped(pdf, doc.certification_paragraph, y)
  }

  if (doc.registered_person_name) {
    y += 4
    y = ensureSpace(pdf, y, 8)
    pdf.setFont(FONT, 'bold')
    pdf.setFontSize(13)
    pdf.text(doc.registered_person_name, ML, y)
    y += 7
  }

  pdf.setFontSize(11)
  for (const f of doc.primary_fields || []) {
    y = drawLabelValue(pdf, f.label, f.value, y)
  }

  if ((doc.parents || []).length) {
    y += 2
    for (const p of doc.parents) {
      y = drawLabelValue(pdf, p.label, p.line, y)
    }
  }

  if ((doc.registration_fields || []).length) {
    y += 2
    for (const f of doc.registration_fields) {
      y = drawLabelValue(pdf, f.label, f.value, y)
    }
  }

  if (doc.validation_paragraph) {
    y += 4
    pdf.setFont(FONT, 'normal')
    pdf.setFontSize(10.5)
    y = drawWrapped(pdf, doc.validation_paragraph, y, 5)
  }

  if ((doc.reference_codes || []).length) {
    y += 2
    pdf.setFontSize(11)
    for (const c of doc.reference_codes) {
      y = drawLabelValue(pdf, c.label, c.value, y)
    }
  }

  if (doc.signatory_name || doc.signatory_title) {
    y += 6
    if (doc.signatory_name) {
      y = ensureSpace(pdf, y, 6)
      pdf.setFont(FONT, 'bold')
      pdf.setFontSize(11)
      pdf.text(doc.signatory_name, ML, y)
      y += 5.5
    }
    if (doc.signatory_title) {
      y = ensureSpace(pdf, y, 6)
      pdf.setFont(FONT, 'normal')
      pdf.setFontSize(11)
      pdf.text(doc.signatory_title, ML, y)
      y += 5.5
    }
  }

  if ((doc.closing_fields || []).length) {
    y += 4
    pdf.setFontSize(11)
    for (const f of doc.closing_fields) {
      y = drawLabelValue(pdf, f.label, f.value, y)
    }
  }

  if (doc.closing_note) {
    y += 2
    pdf.setFont(FONT, 'normal')
    pdf.setFontSize(10.5)
    y = drawWrapped(pdf, doc.closing_note, y, 5)
  }

  // ── PÁGINA 2: Translation Certification (FIJA, igual al docx de Henry) ──
  pdf.addPage()
  y = MT + 8

  pdf.setFont(FONT, 'normal')
  pdf.setFontSize(13)
  pdf.text(CERT_BLOCK.title, PAGE_W / 2, y, { align: 'center' })
  y += 14

  pdf.setFont(FONT, 'normal')
  pdf.setFontSize(11)
  y = drawWrapped(pdf, CERT_BLOCK.body, y, 6)
  y += 10

  // "Signature:" + firma incrustada como imagen
  pdf.text('Signature:', ML, y)
  const signatureLabelWidth = pdf.getTextWidth('Signature: ')
  if (signatureDataUrl) {
    // Imagen real ~449x106 px (ratio 4.24:1). Mantener proporción para que
    // no se vea estirada. 55mm de ancho ≈ 13mm de alto.
    const sigW = 55
    const sigH = 13
    // Se solapa un poco arriba de la baseline para que dé la sensación
    // de que la firma cruza la línea de "Signature:" igual que en el docx.
    pdf.addImage(signatureDataUrl, 'PNG', ML + signatureLabelWidth, y - 9, sigW, sigH)
  }
  y += 14

  pdf.text(`Date: ${certDate}`, ML, y)

  return pdf.output('blob')
}

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

function drawLabelValue(pdf: jsPDF, label: string, value: string, y: number): number {
  if (!label && !value) return y
  y = ensureSpace(pdf, y, 6)
  const labelStr = label ? `${label}: ` : ''
  pdf.setFont(FONT, 'bold')
  pdf.text(labelStr, ML, y)
  const labelW = pdf.getTextWidth(labelStr)

  pdf.setFont(FONT, 'normal')
  const availW = CONTENT_W - labelW
  const lines = pdf.splitTextToSize(value || '', availW)
  if (lines.length === 0) return y + 5.5
  pdf.text(lines[0], ML + labelW, y)
  y += 5.5
  for (let i = 1; i < lines.length; i++) {
    y = ensureSpace(pdf, y, 6)
    pdf.text(lines[i], ML + labelW, y)
    y += 5.5
  }
  return y
}

function drawWrapped(pdf: jsPDF, text: string, y: number, lineH: number = 5.5): number {
  if (!text) return y
  pdf.setFont(FONT, 'normal')
  const lines = pdf.splitTextToSize(text, CONTENT_W)
  for (const line of lines) {
    y = ensureSpace(pdf, y, lineH + 1)
    pdf.text(line, ML, y)
    y += lineH
  }
  return y
}

function ensureSpace(pdf: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_H - MB) {
    pdf.addPage()
    return MT
  }
  return y
}
