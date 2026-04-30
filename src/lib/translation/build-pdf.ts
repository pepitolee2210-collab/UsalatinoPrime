'use client'

import jsPDF from 'jspdf'
import type { TranslatedDoc } from './schema'

interface BuildOptions {
  doc: TranslatedDoc
  translatorName: string
  translatorSignature?: string
  translatorDate: string
  translatorAddress?: string
  translatorContact?: string // phone / email
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

/**
 * Replica el template oficial que Henry usa para inmigración. Sin colores
 * ni decoraciones — texto plano negro, dos páginas:
 *  P1 — traducción del documento.
 *  P2 — Certification of Translation Accuracy con campos del traductor.
 */
export function buildTranslationPDF({
  doc, translatorName, translatorSignature, translatorDate, translatorAddress, translatorContact,
}: BuildOptions): Blob {
  const pdf = new jsPDF('p', 'mm', 'letter')
  pdf.setTextColor(...TEXT)

  let y = MT

  // ── PÁGINA 1 ─────────────────────────────────────────────────────
  // Header: "CERTIFIED TRANSLATION FROM SPANISH INTO ENGLISH"
  pdf.setFont(FONT, 'bold')
  pdf.setFontSize(12)
  pdf.text('CERTIFIED TRANSLATION FROM SPANISH INTO ENGLISH', PAGE_W / 2, y, { align: 'center' })
  y += 10

  // Jurisdiction header (REPUBLIC OF X / ELECTORAL TRIBUNAL ...)
  pdf.setFontSize(11)
  for (const line of doc.jurisdiction_header || []) {
    if (!line.trim()) continue
    y = ensureSpace(pdf, y, 6)
    pdf.setFont(FONT, 'bold')
    pdf.text(line, ML, y)
    y += 6
  }

  // Document type (CERTIFICATE)
  if (doc.document_type) {
    y += 2
    y = ensureSpace(pdf, y, 7)
    pdf.setFont(FONT, 'bold')
    pdf.setFontSize(11.5)
    pdf.text(doc.document_type, ML, y)
    y += 6
  }

  // Registration Number
  if (doc.registration_number) {
    pdf.setFont(FONT, 'normal')
    pdf.setFontSize(11)
    y = drawLabelValue(pdf, 'Registration Number', doc.registration_number, y)
  }

  // Issuing authority
  if (doc.issuing_authority) {
    y += 2
    y = ensureSpace(pdf, y, 6)
    pdf.setFont(FONT, 'normal')
    pdf.setFontSize(11)
    y = drawWrapped(pdf, doc.issuing_authority, y)
  }

  // Certification verb (CERTIFIES)
  if (doc.certification_verb) {
    y += 2
    y = ensureSpace(pdf, y, 7)
    pdf.setFont(FONT, 'bold')
    pdf.setFontSize(11.5)
    pdf.text(doc.certification_verb, ML, y)
    y += 6
  }

  // Certification paragraph
  if (doc.certification_paragraph) {
    pdf.setFont(FONT, 'normal')
    pdf.setFontSize(11)
    y = drawWrapped(pdf, doc.certification_paragraph, y)
  }

  // Registered person name (destacado)
  if (doc.registered_person_name) {
    y += 4
    y = ensureSpace(pdf, y, 8)
    pdf.setFont(FONT, 'bold')
    pdf.setFontSize(13)
    pdf.text(doc.registered_person_name, ML, y)
    y += 7
  }

  // Primary fields (SEX, DATE OF BIRTH, ...)
  pdf.setFontSize(11)
  for (const f of doc.primary_fields || []) {
    y = drawLabelValue(pdf, f.label, f.value, y)
  }

  // Parents (FATHER / MOTHER)
  if ((doc.parents || []).length) {
    y += 2
    for (const p of doc.parents) {
      y = drawLabelLine(pdf, p.label, p.line, y)
    }
  }

  // Registration fields
  if ((doc.registration_fields || []).length) {
    y += 2
    for (const f of doc.registration_fields) {
      y = drawLabelValue(pdf, f.label, f.value, y)
    }
  }

  // Validation paragraph (texto legal)
  if (doc.validation_paragraph) {
    y += 4
    pdf.setFont(FONT, 'normal')
    pdf.setFontSize(10.5)
    y = drawWrapped(pdf, doc.validation_paragraph, y, 5)
  }

  // Reference codes (Validation Code, Barcode Number, etc.)
  if ((doc.reference_codes || []).length) {
    y += 2
    pdf.setFontSize(11)
    for (const c of doc.reference_codes) {
      y = drawLabelValue(pdf, c.label, c.value, y)
    }
  }

  // Signatory
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

  // Closing fields (Date of Issue / Expiration Date)
  if ((doc.closing_fields || []).length) {
    y += 4
    pdf.setFontSize(11)
    for (const f of doc.closing_fields) {
      y = drawLabelValue(pdf, f.label, f.value, y)
    }
  }

  // Closing note
  if (doc.closing_note) {
    y += 2
    pdf.setFont(FONT, 'normal')
    pdf.setFontSize(10.5)
    y = drawWrapped(pdf, doc.closing_note, y, 5)
  }

  // ── PÁGINA 2: Certification of Translation Accuracy ──────────────
  pdf.addPage()
  y = MT + 5

  pdf.setFont(FONT, 'bold')
  pdf.setFontSize(13)
  pdf.text('CERTIFICATION OF TRANSLATION ACCURACY', PAGE_W / 2, y, { align: 'center' })
  y += 14

  pdf.setFont(FONT, 'normal')
  pdf.setFontSize(11)
  const certName = translatorName.trim() || '____________________________'
  const certTitleQuoted = doc.original_document_title
    ? `titled "${doc.original_document_title}"`
    : ''
  const body = `I, ${certName}, certify that I am competent to translate from Spanish into English and that the foregoing is a complete and accurate translation of the attached Spanish-language document ${certTitleQuoted}, to the best of my knowledge and ability.`.replace(/\s+/g, ' ').trim()
  y = drawWrapped(pdf, body, y, 6)
  y += 8

  // Campos del traductor
  pdf.setFont(FONT, 'normal')
  pdf.setFontSize(11)
  const fieldGap = 14
  y = drawTranslatorField(pdf, "Translator's Name", translatorName, y); y += fieldGap
  y = drawTranslatorField(pdf, 'Signature', translatorSignature || '', y); y += fieldGap
  y = drawTranslatorField(pdf, 'Date', translatorDate, y); y += fieldGap
  y = drawTranslatorField(pdf, 'Address', translatorAddress || '', y); y += fieldGap
  y = drawTranslatorField(pdf, 'Phone / Email', translatorContact || '', y)

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

function drawLabelLine(pdf: jsPDF, label: string, line: string, y: number): number {
  // FATHER / MOTHER: label en bold, una línea de texto larga después.
  return drawLabelValue(pdf, label, line, y)
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

function drawTranslatorField(pdf: jsPDF, label: string, value: string, y: number): number {
  y = ensureSpace(pdf, y, 8)
  const labelStr = `${label}: `
  pdf.setFont(FONT, 'normal')
  pdf.text(labelStr, ML, y)
  const labelW = pdf.getTextWidth(labelStr)

  if (value && value.trim()) {
    pdf.text(value, ML + labelW, y)
  }
  // Línea inferior para escribir / firmar a mano si no hay valor
  const lineY = y + 1.5
  pdf.setLineWidth(0.2)
  pdf.line(ML + labelW, lineY, PAGE_W - MR, lineY)
  return y + 5
}

function ensureSpace(pdf: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_H - MB) {
    pdf.addPage()
    return MT
  }
  return y
}
