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
const ML = 22
const MR = 22
const MT = 22
const MB = 22
const FONT = 'helvetica'

const HEADER_H = 12
const FOOTER_H = 8

/**
 * Arma el PDF descargable con SOLO la traducción (una columna). Una página
 * por cada página del documento original. Al final agrega la página de
 * Translation Certification firmada por Andrew Sonny Navarro.
 *
 * El preview en pantalla muestra 2 columnas (original | traducción) para
 * que Diana revise — pero el PDF que entrega al cliente / corte / USCIS
 * solo tiene el texto traducido. Para el original, Diana entrega el archivo
 * fuente por separado.
 */
export function buildFreeTranslationPDF({
  result, certDate, signatureDataUrl,
}: BuildOptions): Blob {
  const pdf = new jsPDF('p', 'mm', 'letter')
  pdf.setTextColor(...TEXT)

  const targetIsEnglish = result.target_language === 'en'
  const targetLabel = targetIsEnglish ? 'Translation (English)' : 'Traducción (Español)'

  // ── Páginas 1..N: solo texto traducido ─────────────────────────
  for (let i = 0; i < result.pages.length; i++) {
    if (i > 0) pdf.addPage()

    drawPageHeader(pdf, result.document_title, i + 1, result.pages.length, targetLabel)

    const startY = MT + HEADER_H + 4
    const endY = PAGE_H - MB - FOOTER_H
    const fullWidth = PAGE_W - ML - MR

    drawBodyText(pdf, result.pages[i].translated, ML, startY, fullWidth, endY)

    drawPageFooter(pdf)
  }

  // ── Última página: Translation Certification ───────────────────
  pdf.addPage()
  let y = MT + 8

  pdf.setFont(FONT, 'normal')
  pdf.setFontSize(13)
  pdf.text('Translation Certification', PAGE_W / 2, y, { align: 'center' })
  y += 14

  pdf.setFont(FONT, 'normal')
  pdf.setFontSize(11)
  // El cuerpo de la certificación se redacta en el idioma DESTINO para que
  // sea coherente con el resto del documento que entrega Diana.
  const certBody = targetIsEnglish
    ? 'I, Andrew Sonny Navarro, hereby certify that I translated the attached document from Spanish into English and that, to the best of my ability, it is a true and correct translation. I further certify that I am competent in both Spanish and English to render and certify such translation.'
    : 'Yo, Andrew Sonny Navarro, certifico por la presente que he traducido el documento adjunto del inglés al español y que, según mi leal saber y entender, es una traducción fiel y correcta. Además certifico que soy competente tanto en español como en inglés para realizar y certificar dicha traducción.'

  const wrapW = PAGE_W - ML - MR
  const lines = pdf.splitTextToSize(certBody, wrapW)
  for (const line of lines) {
    pdf.text(line, ML, y)
    y += 6
  }
  y += 10

  const sigLabel = targetIsEnglish ? 'Signature:' : 'Firma:'
  pdf.text(sigLabel, ML, y)
  const sigLabelW = pdf.getTextWidth(`${sigLabel} `)
  if (signatureDataUrl) {
    const sigW = 55
    const sigH = 13
    pdf.addImage(signatureDataUrl, 'PNG', ML + sigLabelW, y - 9, sigW, sigH)
  }
  y += 14

  const dateLabel = targetIsEnglish ? `Date: ${certDate}` : `Fecha: ${certDate}`
  pdf.text(dateLabel, ML, y)

  return pdf.output('blob')
}

// ────────────────────────────────────────────────────────────────────

function drawPageHeader(
  pdf: jsPDF,
  docTitle: string,
  pageIdx: number,
  totalPages: number,
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

  // Etiqueta del idioma destino
  pdf.setFont(FONT, 'bold')
  pdf.setFontSize(8.5)
  pdf.text(targetLabel.toUpperCase(), ML, MT + 6)

  // Línea divisoria
  pdf.setDrawColor(180, 180, 180)
  pdf.setLineWidth(0.2)
  pdf.line(ML, MT + 9, PAGE_W - MR, MT + 9)
  pdf.setTextColor(...TEXT)
}

function drawPageFooter(pdf: jsPDF) {
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
}

/**
 * Dibuja el cuerpo de la traducción ocupando todo el ancho de la página.
 * Si el texto excede la altura disponible, recorta con un indicador (la
 * división por página la define Gemini upstream — respetamos su corte).
 */
function drawBodyText(
  pdf: jsPDF,
  text: string,
  x: number,
  startY: number,
  width: number,
  endY: number,
) {
  pdf.setFont(FONT, 'normal')
  pdf.setFontSize(11)
  pdf.setTextColor(...TEXT)

  const lineH = 5.5
  const paragraphs = (text || '').split(/\n\n+/)
  let y = startY

  for (let pi = 0; pi < paragraphs.length; pi++) {
    const paragraph = paragraphs[pi]
    const subLines = paragraph.split(/\n/).flatMap((sub) =>
      pdf.splitTextToSize(sub, width)
    )

    for (const line of subLines) {
      if (y + lineH > endY) {
        pdf.setTextColor(...MUTED)
        pdf.setFontSize(9)
        pdf.text('[continúa en la siguiente página…]', x, endY)
        pdf.setTextColor(...TEXT)
        pdf.setFontSize(11)
        return
      }
      pdf.text(line, x, y)
      y += lineH
    }
    if (pi < paragraphs.length - 1) y += lineH * 0.7
  }
}
