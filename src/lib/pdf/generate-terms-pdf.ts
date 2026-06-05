import jsPDF from 'jspdf'
import {
  TERMS_SECTIONS,
  COMPANY_NAME,
  interpolate,
  type TermsTokens,
} from '@/lib/legal/terms-and-conditions'

/**
 * Genera el PDF inmutable de aceptación de Términos y Condiciones.
 *
 * Reutiliza el andamiaje visual de generate-contract-pdf.ts (header navy + línea
 * dorada, helpers de sección/párrafo/footer/salto de página, embebido de la firma
 * dibujada). El contenido proviene de TERMS_SECTIONS (fuente única de verdad),
 * interpolado con los datos del caso. El resultado es un snapshot: refleja exactamente
 * lo que el cliente leyó y firmó en ese momento.
 */
export interface TermsPDFInput {
  clientFullName: string
  serviceName: string
  caseNumber: string
  acceptedDateISO: string
  termsVersion: string
  clientSignatureImage: string // base64 PNG data URL (de SignatureCanvas)
}

const NAVY = [0, 40, 85] as const
const BODY_COLOR = [40, 40, 40] as const
const BODY_SIZE = 9.5
const SECTION_TITLE_SIZE = 11
const FONT = 'helvetica'
const WEIGHT = 'normal'

function formatDateTimeSpanish(iso: string): string {
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ]
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const time = d.toLocaleTimeString('es-US', { hour: '2-digit', minute: '2-digit' })
  return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}, ${time}`
}

export function generateTermsPDF(input: TermsPDFInput): jsPDF {
  const { clientFullName, serviceName, caseNumber, acceptedDateISO, termsVersion, clientSignatureImage } = input

  const acceptedDate = formatDateTimeSpanish(acceptedDateISO)
  const tokens: TermsTokens = {
    clientName: clientFullName,
    serviceName,
    caseNumber,
    acceptedDate,
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - margin * 2
  let y = margin

  function bodyStyle() {
    doc.setFont(FONT, WEIGHT)
    doc.setFontSize(BODY_SIZE)
    doc.setTextColor(...BODY_COLOR)
  }

  function addFooter() {
    doc.setFont(FONT, WEIGHT)
    doc.setFontSize(7)
    doc.setTextColor(160, 160, 160)
    doc.text(`${COMPANY_NAME} - Términos y Condiciones (v${termsVersion})`, margin, pageHeight - 12)
    const genDate = new Date().toLocaleString('es-US')
    doc.text(`Generado: ${genDate}`, pageWidth - margin, pageHeight - 12, { align: 'right' })
    doc.setDrawColor(230, 230, 230)
    doc.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16)
  }

  function checkPageBreak(neededSpace: number) {
    if (y + neededSpace > pageHeight - 25) {
      addFooter()
      doc.addPage()
      y = margin
    }
  }

  function sectionTitle(text: string) {
    checkPageBreak(16)
    doc.setFont(FONT, 'bold')
    doc.setFontSize(SECTION_TITLE_SIZE)
    doc.setTextColor(...NAVY)
    const lines = doc.splitTextToSize(text, contentWidth)
    doc.text(lines, margin, y)
    y += (lines.length - 1) * 5 + 1.5
    doc.setDrawColor(229, 231, 235)
    doc.setLineWidth(0.3)
    doc.line(margin, y, pageWidth - margin, y)
    y += 6
    bodyStyle()
  }

  function paragraph(text: string) {
    bodyStyle()
    const lines = doc.splitTextToSize(text, contentWidth - 4)
    checkPageBreak(lines.length * 4 + 5)
    doc.text(lines, margin + 2, y)
    y += lines.length * 4 + 5
  }

  function metaLine(label: string, value: string) {
    checkPageBreak(7)
    doc.setFont(FONT, 'bold')
    doc.setFontSize(BODY_SIZE)
    doc.setTextColor(...NAVY)
    doc.text(label, margin + 2, y)
    const labelWidth = doc.getTextWidth(label) + 2
    bodyStyle()
    doc.text(value, margin + 2 + labelWidth, y)
    y += 6
  }

  // === HEADER ===
  doc.setFont(FONT, 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...NAVY)
  doc.text(COMPANY_NAME, margin, y)
  y += 8

  doc.setDrawColor(242, 169, 0)
  doc.setLineWidth(0.8)
  doc.line(margin, y, pageWidth - margin, y)
  y += 10

  doc.setFont(FONT, 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...NAVY)
  const titleLines = doc.splitTextToSize('TÉRMINOS Y CONDICIONES DE SERVICIO Y DESCARGO DE RESPONSABILIDAD', contentWidth - 10)
  doc.text(titleLines, pageWidth / 2, y, { align: 'center' })
  y += titleLines.length * 6 + 4

  // === METADATA ===
  metaLine('Versión:', termsVersion)
  metaLine('Cliente:', clientFullName)
  metaLine('Trámite:', serviceName)
  metaLine('Número de caso:', caseNumber || '—')
  metaLine('Fecha de aceptación:', acceptedDate)
  y += 4

  // === SECCIONES DEL DISCLAIMER ===
  for (const section of TERMS_SECTIONS) {
    sectionTitle(section.title)
    for (const p of section.paragraphs) {
      paragraph(interpolate(p, tokens))
    }
  }

  // === BLOQUE DE FIRMA ===
  checkPageBreak(60)
  y += 4
  doc.setFont(FONT, 'bold')
  doc.setFontSize(SECTION_TITLE_SIZE)
  doc.setTextColor(...NAVY)
  doc.text('FIRMA ELECTRÓNICA DEL CLIENTE', margin, y)
  y += 2
  doc.setDrawColor(229, 231, 235)
  doc.setLineWidth(0.3)
  doc.line(margin, y, pageWidth - margin, y)
  y += 10

  // Imagen de la firma dibujada, sobre la línea
  const sigWidth = 70
  const sigHeight = 24
  if (clientSignatureImage) {
    try {
      doc.addImage(clientSignatureImage, 'PNG', margin + 2, y - 4, sigWidth, sigHeight)
    } catch {
      // Si la imagen falla, dejamos la línea y el nombre como respaldo.
    }
  }
  y += sigHeight

  doc.setDrawColor(150, 150, 150)
  doc.setLineWidth(0.3)
  doc.line(margin, y, margin + sigWidth + 10, y)
  y += 5

  bodyStyle()
  doc.text(clientFullName, margin, y)
  y += 5
  doc.setTextColor(110, 110, 110)
  doc.setFontSize(8.5)
  doc.text(`Aceptado electrónicamente el ${acceptedDate}`, margin, y)
  y += 4.5
  doc.text(`Versión del documento: ${termsVersion}  ·  Trámite: ${serviceName}  ·  Caso: ${caseNumber || '—'}`, margin, y)

  addFooter()

  return doc
}
