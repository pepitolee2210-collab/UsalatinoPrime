'use client'

import jsPDF from 'jspdf'
import type { FreeTranslationResult } from './free-translate'

interface BuildOptions {
  result: FreeTranslationResult
  /** Fecha que va al lado de "Date:" en la página de Translation Certification. */
  certDate: string
  /** Firma del traductor como dataURL ("data:image/png;base64,..."). */
  signatureDataUrl: string | null
}

const TEXT: [number, number, number] = [20, 20, 20]
const MUTED: [number, number, number] = [110, 110, 110]
const PAGE_W = 216
const PAGE_H = 279
const ML = 18
const MR = 18
const MT = 22
const MB = 22
const FONT = 'helvetica'

const COL_GAP = 8
const HEADER_H = 16
const FOOTER_H = 8

// Bloque fijo (mismo del traductor de actas civiles para consistencia legal)
const CERT_BLOCK = {
  title: 'Translation Certification',
  body: 'I, Andrew Sonny Navarro, hereby certify that I translated the attached document from Spanish into English / from English into Spanish and that, to the best of my ability, it is a true and correct translation. I further certify that I am competent in both Spanish and English to render and certify such translation.',
}

/**
 * Arma el PDF de 2 columnas (original | traducción) página por página y
 * agrega al final una página de Translation Certification firmada por
 * Andrew Sonny Navarro — el patrón ya validado por el sistema de actas.
 */
export function buildFreeTranslationPDF({
  result, certDate, signatureDataUrl,
}: BuildOptions): Blob {
  const pdf = new jsPDF('p', 'mm', 'letter')
  pdf.setTextColor(...TEXT)

  const sourceLabel = result.source_language === 'es' ? 'Original (Español)' : 'Original (English)'
  const targetLabel = result.target_language === 'es' ? 'Traducción (Español)' : 'Translation (English)'

  // ── Páginas 1..N: 2 columnas (original | traducción) ────────────
  for (let i = 0; i < result.pages.length; i++) {
    if (i > 0) pdf.addPage()

    drawPageHeader(pdf, result.document_title, i + 1, result.pages.length, sourceLabel, targetLabel)

    const colW = (PAGE_W - ML - MR - COL_GAP) / 2
    const leftX = ML
    const rightX = ML + colW + COL_GAP
    const startY = MT + HEADER_H + 4
    const endY = PAGE_H - MB - FOOTER_H

    drawColumnText(pdf, result.pages[i].original, leftX, startY, colW, endY)
    drawColumnText(pdf, result.pages[i].translated, rightX, startY, colW, endY)

    drawPageFooter(pdf, i + 1, result.pages.length)
  }

  // ── Última página: Translation Certification ───────────────────
  pdf.addPage()
  let y = MT + 8

  pdf.setFont(FONT, 'normal')
  pdf.setFontSize(13)
  pdf.text(CERT_BLOCK.title, PAGE_W / 2, y, { align: 'center' })
  y += 14

  pdf.setFont(FONT, 'normal')
  pdf.setFontSize(11)
  const certBody = result.target_language === 'en'
    ? 'I, Andrew Sonny Navarro, hereby certify that I translated the attached document from Spanish into English and that, to the best of my ability, it is a true and correct translation. I further certify that I am competent in both Spanish and English to render and certify such translation.'
    : 'I, Andrew Sonny Navarro, hereby certify that I translated the attached document from English into Spanish and that, to the best of my ability, it is a true and correct translation. I further certify that I am competent in both Spanish and English to render and certify such translation.'

  const wrapW = PAGE_W - ML - MR
  const lines = pdf.splitTextToSize(certBody, wrapW)
  for (const line of lines) {
    pdf.text(line, ML, y)
    y += 6
  }
  y += 10

  pdf.text('Signature:', ML, y)
  const sigLabelW = pdf.getTextWidth('Signature: ')
  if (signatureDataUrl) {
    const sigW = 55
    const sigH = 13
    pdf.addImage(signatureDataUrl, 'PNG', ML + sigLabelW, y - 9, sigW, sigH)
  }
  y += 14

  pdf.text(`Date: ${certDate}`, ML, y)

  return pdf.output('blob')
}

// ────────────────────────────────────────────────────────────────────

function drawPageHeader(
  pdf: jsPDF,
  docTitle: string,
  pageIdx: number,
  totalPages: number,
  sourceLabel: string,
  targetLabel: string,
) {
  const wrapW = PAGE_W - ML - MR
  pdf.setFont(FONT, 'bold')
  pdf.setFontSize(11)
  pdf.setTextColor(...TEXT)

  const titleLines = pdf.splitTextToSize(docTitle || 'Translated Document', wrapW)
  let titleY = MT
  for (const line of titleLines) {
    pdf.text(line, ML, titleY)
    titleY += 5
  }

  pdf.setFont(FONT, 'normal')
  pdf.setFontSize(8.5)
  pdf.setTextColor(...MUTED)
  pdf.text(`Page ${pageIdx} of ${totalPages}`, PAGE_W - MR, MT, { align: 'right' })

  // Línea divisoria
  pdf.setDrawColor(180, 180, 180)
  pdf.setLineWidth(0.2)
  pdf.line(ML, MT + 7, PAGE_W - MR, MT + 7)

  // Etiquetas de columnas
  const colW = (PAGE_W - ML - MR - COL_GAP) / 2
  pdf.setFont(FONT, 'bold')
  pdf.setFontSize(9)
  pdf.setTextColor(...MUTED)
  pdf.text(sourceLabel.toUpperCase(), ML, MT + 13)
  pdf.text(targetLabel.toUpperCase(), ML + colW + COL_GAP, MT + 13)
  pdf.setTextColor(...TEXT)
}

function drawPageFooter(pdf: jsPDF, pageIdx: number, _total: number) {
  pdf.setFont(FONT, 'normal')
  pdf.setFontSize(7.5)
  pdf.setTextColor(...MUTED)
  pdf.text(
    'Translated by UsaLatino Prime — see Translation Certification on final page.',
    PAGE_W / 2,
    PAGE_H - MB + 3,
    { align: 'center' },
  )
  pdf.setTextColor(...TEXT)
  void pageIdx
}

/**
 * Dibuja texto multilínea dentro de una columna. Si el texto no entra,
 * muestra un indicador "[continúa...]" al final — la división por página
 * la hizo Gemini upstream, así que solo respetamos el corte por página
 * que recibimos.
 */
function drawColumnText(
  pdf: jsPDF,
  text: string,
  x: number,
  startY: number,
  width: number,
  endY: number,
) {
  pdf.setFont(FONT, 'normal')
  pdf.setFontSize(9.5)
  pdf.setTextColor(...TEXT)

  const lineH = 4.4
  const paragraphs = (text || '').split(/\n\n+/)
  let y = startY

  for (let pi = 0; pi < paragraphs.length; pi++) {
    const paragraph = paragraphs[pi]
    // splitTextToSize respeta saltos de línea simples dentro del párrafo
    const subLines = paragraph.split(/\n/).flatMap((sub) =>
      pdf.splitTextToSize(sub, width)
    )

    for (const line of subLines) {
      if (y + lineH > endY) {
        pdf.setTextColor(...MUTED)
        pdf.setFontSize(8)
        pdf.text('[continúa en la siguiente página…]', x, endY)
        pdf.setTextColor(...TEXT)
        pdf.setFontSize(9.5)
        return
      }
      pdf.text(line, x, y)
      y += lineH
    }
    // Espacio entre párrafos
    if (pi < paragraphs.length - 1) y += lineH * 0.7
  }
}
