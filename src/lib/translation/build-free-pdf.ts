'use client'

import jsPDF from 'jspdf'
import type { FreeTranslationResult } from './free-translate'

interface BuildOptions {
  result: FreeTranslationResult
  /** @deprecated Ya no se usa — el flujo libre no tiene página de certificación con fecha.
   *  Se mantiene en la interface para no romper a callers existentes. */
  certDate?: string
  /** @deprecated Ya no se usa — el flujo libre no tiene firma del traductor. La firma
   *  sigue activa en el sistema de actas civiles (build-pdf.ts). */
  signatureDataUrl?: string | null
}

// ────────────────────────────────────────────────────────────────────
// Constantes de estilo
// ────────────────────────────────────────────────────────────────────

const BLACK: [number, number, number] = [0, 0, 0]
const FOOTER_GRAY: [number, number, number] = [110, 110, 110]

// Página letter (8.5" × 11") en milímetros
const PAGE_W = 216
const PAGE_H = 279
// Márgenes de 1 pulgada (25.4 mm) en los 4 lados — estándar para traducciones legales
const ML = 25.4
const MR = 25.4
const MT = 25.4
const MB = 25.4
const CONTENT_W = PAGE_W - ML - MR

const FONT = 'times' // serif estándar (Times-Roman) — apropiado para texto legal

const TITLE_SIZE = 14       // "CERTIFIED ENGLISH TRANSLATION"
const DOC_TITLE_SIZE = 12   // Título del documento original (puede ser multi-línea)
const SUBTITLE_SIZE = 11    // Línea parentética bajo el título
const BODY_SIZE = 11        // Cuerpo del texto
const FOOTER_SIZE = 9       // Footer en cursiva
const BODY_LINE_H = 5.2     // Altura de línea en mm para body
const PARAGRAPH_GAP = 3.5   // Espacio entre párrafos
const NUMBERED_GAP = 4.5    // Espacio extra antes de un párrafo numerado

const FOOTER_TEXT_EN = 'English translation prepared from the scanned Spanish document provided.'
const FOOTER_TEXT_ES = 'Traducción al español preparada a partir del documento escaneado en inglés.'

/**
 * Arma el PDF descargable de traducción libre.
 *
 * Estructura:
 *  - Página 1: header "CERTIFIED ENGLISH TRANSLATION" + título del documento + subtítulo +
 *    body justificado en Times.
 *  - Páginas 2..N: solo body (sin repetir headers), separación por págines del documento
 *    original tal como Gemini las devolvió.
 *  - Cada página: footer en cursiva gris al pie indicando el origen de la traducción.
 *  - No hay página final de certificación (esa lógica vive solo en build-pdf.ts para actas
 *    civiles, donde sí se requiere firma del traductor).
 *
 * El preview en pantalla (componente FreePreview) sigue mostrando 2 columnas para que
 * Diana revise — pero el PDF que se entrega solo tiene la traducción.
 */
export function buildFreeTranslationPDF({ result }: BuildOptions): Blob {
  const pdf = new jsPDF('p', 'mm', 'letter')
  pdf.setTextColor(...BLACK)

  const footerText = result.target_language === 'en' ? FOOTER_TEXT_EN : FOOTER_TEXT_ES

  for (let i = 0; i < result.pages.length; i++) {
    if (i > 0) pdf.addPage()

    let y = MT
    if (i === 0) {
      y = renderTitleBlock(pdf, result.document_title_lines, result.document_subtitle, y)
    }

    const bodyText = result.pages[i].translated || ''
    if (bodyText.trim().length > 0) {
      renderBody(pdf, bodyText, y, footerText)
    } else if (i > 0) {
      // Página intencionalmente en blanco (e.g., reverso de una hoja). Si Gemini
      // no devolvió ni "[blank page]", agregar un marcador centrado para que el
      // usuario sepa que la página está vacía a propósito y no es un bug.
      pdf.setFont(FONT, 'italic')
      pdf.setFontSize(BODY_SIZE)
      pdf.setTextColor(...FOOTER_GRAY)
      pdf.text('[blank page]', PAGE_W / 2, PAGE_H / 2, { align: 'center' })
      pdf.setTextColor(...BLACK)
      pdf.setFont(FONT, 'normal')
    }
    renderFooter(pdf, footerText)
  }

  return pdf.output('blob')
}

// ────────────────────────────────────────────────────────────────────
// Renderizado de bloques
// ────────────────────────────────────────────────────────────────────

/**
 * Página 1: bloque superior con CERTIFIED ENGLISH TRANSLATION + título del documento +
 * subtítulo opcional. Retorna el Y donde empieza el body.
 */
function renderTitleBlock(
  pdf: jsPDF,
  titleLines: string[],
  subtitle: string | null,
  startY: number,
): number {
  let y = startY

  pdf.setFont(FONT, 'bold')
  pdf.setFontSize(TITLE_SIZE)
  pdf.setTextColor(...BLACK)
  pdf.text('CERTIFIED ENGLISH TRANSLATION', PAGE_W / 2, y, { align: 'center' })
  y += 9

  pdf.setFontSize(DOC_TITLE_SIZE)
  for (const line of titleLines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    // Wrap manual: si el título es más ancho que el contenido, dividir
    const wrapped = pdf.splitTextToSize(trimmed.toUpperCase(), CONTENT_W)
    for (const sub of wrapped) {
      pdf.text(sub, PAGE_W / 2, y, { align: 'center' })
      y += 6
    }
  }

  if (subtitle && subtitle.trim()) {
    y += 1
    pdf.setFont(FONT, 'normal')
    pdf.setFontSize(SUBTITLE_SIZE)
    const wrapped = pdf.splitTextToSize(subtitle.trim(), CONTENT_W)
    for (const sub of wrapped) {
      pdf.text(sub, PAGE_W / 2, y, { align: 'center' })
      y += 5.5
    }
  }

  y += 4
  return y
}

function renderFooter(pdf: jsPDF, text: string) {
  pdf.setFont(FONT, 'italic')
  pdf.setFontSize(FOOTER_SIZE)
  pdf.setTextColor(...FOOTER_GRAY)
  pdf.text(text, PAGE_W / 2, PAGE_H - MB + 8, { align: 'center' })
  pdf.setTextColor(...BLACK)
  pdf.setFont(FONT, 'normal')
}

/**
 * Renderiza el cuerpo del texto traducido. Detecta:
 *  - Párrafos numerados (1. ..., 2. ...) → número en bold, gap extra antes
 *  - Headings ALL-CAPS que terminan en ":" (e.g., "I DECLARE AND STATE:") → bold completo
 *  - Resto: párrafo normal justificado
 *
 * No agrega nuevas páginas — si el texto excede, se trunca con un marcador. La división
 * en páginas físicas ya viene de Gemini en result.pages[].
 */
function renderBody(pdf: jsPDF, text: string, startY: number, footerText: string) {
  pdf.setFont(FONT, 'normal')
  pdf.setFontSize(BODY_SIZE)
  pdf.setTextColor(...BLACK)

  // Espacio reservado para el footer + un poco de margen para que el texto no toque el footer
  const endY = PAGE_H - MB - 4
  // Ancho disponible para body
  const bodyWidth = CONTENT_W

  // Split por dobles saltos de línea para separar párrafos. Gemini usa \n para líneas
  // dentro de un mismo párrafo y \n\n para separar párrafos.
  const paragraphs = (text || '').split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 0)

  let y = startY

  for (let pi = 0; pi < paragraphs.length; pi++) {
    const paragraph = paragraphs[pi]
    const trimmed = paragraph.trim()

    // ¿Es un heading ALL-CAPS? Sin letras minúsculas en absoluto, mínimo 3 caracteres,
    // y empieza con letra. Captura tanto "I DECLARE AND STATE:" como
    // "ACKNOWLEDGMENT OF SIGNATURE AND CONTENT OF PRIVATE DOCUMENT" (sin colon).
    const isAllCapsHeading =
      /^[A-Z][A-Z0-9\s,.'"():/\-—–]{2,}$/.test(trimmed) &&
      // Excluir párrafos largos para evitar falsos positivos (un párrafo todo en mayúsculas
      // de 500 caracteres probablemente no es un heading sino contenido enfatizado)
      trimmed.length <= 200

    // ¿Es un párrafo numerado? Acepta dos formas:
    //  - Dígitos: "1. That I am the biological father..."
    //  - Ordinales en palabra (algunos docs legales usan estos en lugar de dígitos):
    //    "FIRST. That I am the biological father..." / "SECOND. ..." / "THEREFORE. ..."
    // Ambos se renderizan con el prefijo en bold y el resto normal justificado.
    const numberedMatch = paragraph.match(/^(\d+)\.\s+([\s\S]+)$/)
    const ordinalWordMatch = !numberedMatch
      ? paragraph.match(/^([A-Z]{2,})\.\s+([\s\S]+)$/)
      : null

    // ¿Empieza con prefijo ALL-CAPS + coma (e.g., "THEREFORE, I sign...", "WHEREAS, ...")?
    const allCapsPrefixMatch = paragraph.match(/^([A-Z]{2,}),\s+([\s\S]+)$/)

    if (numberedMatch) {
      if (pi > 0) y += NUMBERED_GAP - PARAGRAPH_GAP
      y = renderNumberedParagraph(pdf, numberedMatch[1], numberedMatch[2], y, bodyWidth, endY, footerText)
    } else if (ordinalWordMatch) {
      if (pi > 0) y += NUMBERED_GAP - PARAGRAPH_GAP
      y = renderNumberedParagraph(pdf, ordinalWordMatch[1], ordinalWordMatch[2], y, bodyWidth, endY, footerText)
    } else if (isAllCapsHeading) {
      y = renderHeading(pdf, paragraph, y, bodyWidth, endY, footerText)
    } else if (allCapsPrefixMatch) {
      y = renderAllCapsPrefixParagraph(pdf, allCapsPrefixMatch[1], allCapsPrefixMatch[2], y, bodyWidth, endY, footerText)
    } else {
      y = renderRegularParagraph(pdf, paragraph, y, bodyWidth, endY, footerText)
    }

    // Gap entre párrafos
    if (pi < paragraphs.length - 1) y += PARAGRAPH_GAP

    // Si nos pasamos del límite, abrir nueva página
    if (y > endY) {
      renderFooter(pdf, footerText)
      pdf.addPage()
      pdf.setFont(FONT, 'normal')
      pdf.setFontSize(BODY_SIZE)
      pdf.setTextColor(...BLACK)
      y = MT
    }
  }
}

function renderHeading(
  pdf: jsPDF,
  text: string,
  startY: number,
  width: number,
  endY: number,
  footerText: string,
): number {
  pdf.setFont(FONT, 'bold')
  pdf.setFontSize(BODY_SIZE)
  let y = startY
  // Pequeño gap antes del heading para separarlo del párrafo anterior
  y += 1
  const lines = pdf.splitTextToSize(text, width)
  for (const line of lines) {
    if (y > endY) {
      renderFooter(pdf, footerText)
      pdf.addPage()
      pdf.setFont(FONT, 'bold')
      pdf.setFontSize(BODY_SIZE)
      pdf.setTextColor(...BLACK)
      y = MT
    }
    // Centrado — match al estilo de las traducciones notariales certificadas
    pdf.text(line, PAGE_W / 2, y, { align: 'center' })
    y += BODY_LINE_H
  }
  pdf.setFont(FONT, 'normal')
  return y
}

/**
 * Párrafo que empieza con prefijo ALL-CAPS + coma (e.g., "THEREFORE, I sign this..."):
 * el prefijo en bold y el resto en normal justificado, fluyendo en líneas continuas.
 */
function renderAllCapsPrefixParagraph(
  pdf: jsPDF,
  prefix: string,
  rest: string,
  startY: number,
  width: number,
  endY: number,
  footerText: string,
): number {
  pdf.setFont(FONT, 'bold')
  pdf.setFontSize(BODY_SIZE)
  const prefixWithComma = `${prefix}, `
  const prefixW = pdf.getTextWidth(prefixWithComma)

  if (startY > endY) {
    renderFooter(pdf, footerText)
    pdf.addPage()
    pdf.setFont(FONT, 'bold')
    pdf.setFontSize(BODY_SIZE)
    pdf.setTextColor(...BLACK)
    startY = MT
  }
  pdf.text(`${prefix},`, ML, startY)

  pdf.setFont(FONT, 'normal')
  let y = startY
  const initialWidth = width - prefixW
  const restLines = wrapWithFirstLineIndent(pdf, rest, width, initialWidth)
  for (let i = 0; i < restLines.length; i++) {
    if (y > endY) {
      renderFooter(pdf, footerText)
      pdf.addPage()
      pdf.setFont(FONT, 'normal')
      pdf.setFontSize(BODY_SIZE)
      pdf.setTextColor(...BLACK)
      y = MT
    }
    const isFirst = i === 0
    const isLast = i === restLines.length - 1
    const x = isFirst ? ML + prefixW : ML
    const lineWidth = isFirst ? initialWidth : width
    drawLine(pdf, restLines[i], x, y, lineWidth, !isLast)
    y += BODY_LINE_H
  }
  return y
}

function renderRegularParagraph(
  pdf: jsPDF,
  text: string,
  startY: number,
  width: number,
  endY: number,
  footerText: string,
): number {
  pdf.setFont(FONT, 'normal')
  pdf.setFontSize(BODY_SIZE)
  let y = startY
  // Respetar saltos de línea simples dentro del párrafo (raro pero posible)
  const subLines = text.split('\n').flatMap((sub) => pdf.splitTextToSize(sub, width))
  for (let i = 0; i < subLines.length; i++) {
    if (y > endY) {
      renderFooter(pdf, footerText)
      pdf.addPage()
      pdf.setFont(FONT, 'normal')
      pdf.setFontSize(BODY_SIZE)
      pdf.setTextColor(...BLACK)
      y = MT
    }
    const isLast = i === subLines.length - 1
    drawLine(pdf, subLines[i], ML, y, width, /*justify*/ !isLast)
    y += BODY_LINE_H
  }
  return y
}

/**
 * Renderiza un párrafo numerado tipo "1. That I am the biological father..." con el número
 * en bold y el resto en peso normal, justificado. Las líneas envueltas continúan flush
 * left (sin hanging indent) — coincide con el estilo de las traducciones certificadas
 * que ya circulan en el despacho.
 */
function renderNumberedParagraph(
  pdf: jsPDF,
  number: string,
  rest: string,
  startY: number,
  width: number,
  endY: number,
  footerText: string,
): number {
  pdf.setFont(FONT, 'bold')
  pdf.setFontSize(BODY_SIZE)
  const prefix = `${number}.`
  const prefixW = pdf.getTextWidth(`${prefix} `)

  // Render del número en bold
  if (startY > endY) {
    renderFooter(pdf, footerText)
    pdf.addPage()
    pdf.setFont(FONT, 'bold')
    pdf.setFontSize(BODY_SIZE)
    pdf.setTextColor(...BLACK)
    startY = MT
  }
  pdf.text(prefix, ML, startY)

  // Render del resto en normal — partir en líneas considerando que la primera línea
  // tiene menos ancho (porque empieza tras el prefijo).
  pdf.setFont(FONT, 'normal')
  let y = startY

  // Estrategia: dividir el texto restante en líneas usando el ancho COMPLETO, luego
  // ajustar la primera línea para que quepa en (width - prefixW). En la práctica, dado
  // que el prefijo es muy corto ("1. ", "10. "), basta con tratar la primera palabra/frase
  // como cabe en el espacio restante de la línea, y el resto fluye normal.
  //
  // Implementación simple: dividir el resto con maxWidth = width (igual que el resto del
  // body) y renderizar la primera línea desplazada por prefixW. Si la primera línea es
  // más ancha que (width - prefixW), recortar palabras del final y mandarlas a la línea 2.

  const initialWidth = width - prefixW
  const restLines = wrapWithFirstLineIndent(pdf, rest, width, initialWidth)

  for (let i = 0; i < restLines.length; i++) {
    if (y > endY) {
      renderFooter(pdf, footerText)
      pdf.addPage()
      pdf.setFont(FONT, 'normal')
      pdf.setFontSize(BODY_SIZE)
      pdf.setTextColor(...BLACK)
      y = MT
    }
    const isFirst = i === 0
    const isLast = i === restLines.length - 1
    const x = isFirst ? ML + prefixW : ML
    const lineWidth = isFirst ? initialWidth : width
    drawLine(pdf, restLines[i], x, y, lineWidth, /*justify*/ !isLast)
    y += BODY_LINE_H
  }
  return y
}

// ────────────────────────────────────────────────────────────────────
// Helpers de layout
// ────────────────────────────────────────────────────────────────────

/**
 * Divide un texto en líneas donde la PRIMERA línea tiene un ancho diferente (menor) que
 * las subsecuentes. Útil para párrafos numerados donde la primera línea cabe tras "1. ".
 */
function wrapWithFirstLineIndent(
  pdf: jsPDF,
  text: string,
  fullWidth: number,
  firstLineWidth: number,
): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0)
  if (words.length === 0) return ['']

  const lines: string[] = []
  let current = ''
  let widthForThisLine = firstLineWidth

  for (const word of words) {
    const candidate = current.length === 0 ? word : `${current} ${word}`
    if (pdf.getTextWidth(candidate) <= widthForThisLine) {
      current = candidate
    } else {
      if (current.length > 0) lines.push(current)
      current = word
      widthForThisLine = fullWidth
    }
  }
  if (current.length > 0) lines.push(current)
  return lines.length > 0 ? lines : ['']
}

/**
 * Renderiza una línea de texto en (x, y). Si justify=true, distribuye los espacios entre
 * palabras para que la línea alcance exactamente targetWidth. La última línea de cada
 * párrafo NO se justifica (queda flush left).
 *
 * jsPDF no tiene soporte nativo de justified word-based, así que renderizamos palabra
 * por palabra con offsets calculados manualmente.
 */
function drawLine(pdf: jsPDF, line: string, x: number, y: number, targetWidth: number, justify: boolean) {
  if (!justify) {
    pdf.text(line, x, y)
    return
  }
  const words = line.split(' ').filter((w) => w.length > 0)
  if (words.length <= 1) {
    pdf.text(line, x, y)
    return
  }

  const wordWidths = words.map((w) => pdf.getTextWidth(w))
  const totalWordsW = wordWidths.reduce((a, b) => a + b, 0)
  const naturalSpaceW = pdf.getTextWidth(' ')
  const spaceCount = words.length - 1
  const naturalTotalW = totalWordsW + naturalSpaceW * spaceCount

  // Si la línea ya es más ancha que el target (raro pero posible con palabras largas),
  // no estirar — render normal.
  if (naturalTotalW >= targetWidth) {
    pdf.text(line, x, y)
    return
  }

  const extraPerSpace = (targetWidth - naturalTotalW) / spaceCount
  // Sanity check: si el espacio extra es absurdo (>3x el espacio natural), no justificar
  // — es una línea con muy pocas palabras y se vería rara estirada.
  if (extraPerSpace > naturalSpaceW * 3) {
    pdf.text(line, x, y)
    return
  }

  let cursorX = x
  for (let i = 0; i < words.length; i++) {
    pdf.text(words[i], cursorX, y)
    cursorX += wordWidths[i]
    if (i < words.length - 1) cursorX += naturalSpaceW + extraPerSpace
  }
}
