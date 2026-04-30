'use client'

import jsPDF from 'jspdf'
import type { TranslatedDoc, TranslationBlock } from './schema'

interface BuildOptions {
  doc: TranslatedDoc
  translatorName: string
  translatorDate: string // texto libre, ej "April 30, 2026" o "30 Abril 2026"
}

const TITLE_BLUE: [number, number, number] = [74, 144, 226] // #4A90E2 — el azul del PDF de Henry
const TEXT_GRAY: [number, number, number] = [33, 37, 41]
const PAGE_W = 216 // letter en mm
const PAGE_H = 279
const ML = 22 // margen izq
const MR = 22 // margen der
const MT = 22 // margen sup
const MB = 25 // margen inf
const CONTENT_W = PAGE_W - ML - MR
const FONT = 'helvetica'

/**
 * Devuelve el PDF traducido como Blob (2 páginas: traducción + Translation
 * Certification con firma del traductor).
 */
export function buildTranslationPDF({ doc, translatorName, translatorDate }: BuildOptions): Blob {
  const pdf = new jsPDF('p', 'mm', 'letter')

  let y = MT

  // ── PÁGINA 1: traducción ─────────────────────────────────────────
  // Título grande azul centrado
  pdf.setFont(FONT, 'bold')
  pdf.setTextColor(...TITLE_BLUE)
  pdf.setFontSize(22)
  const titleLines = pdf.splitTextToSize(doc.title.toUpperCase(), CONTENT_W)
  for (const line of titleLines) {
    pdf.text(line, PAGE_W / 2, y, { align: 'center' })
    y += 9
  }
  y += 4

  // Header institucional (líneas en bold)
  pdf.setTextColor(...TEXT_GRAY)
  pdf.setFontSize(11)
  for (const headerLine of doc.header || []) {
    y = ensureSpace(pdf, y, 6)
    pdf.setFont(FONT, 'bold')
    pdf.text(headerLine, ML, y)
    y += 5.5
  }
  y += 3

  // Bloques en orden
  for (const block of doc.blocks || []) {
    y = renderBlock(pdf, block, y)
    y += 3
  }

  // Footer paragraph (Issued in...)
  if (doc.footer_paragraph) {
    y += 2
    y = ensureSpace(pdf, y, 14)
    pdf.setFont(FONT, 'normal')
    pdf.setFontSize(11)
    y = renderRichText(pdf, doc.footer_paragraph, y)
  }

  // Signature label
  if (doc.signature_label) {
    y += 6
    y = ensureSpace(pdf, y, 8)
    pdf.setFont(FONT, 'bold')
    pdf.text(doc.signature_label, ML, y)
  }

  // ── PÁGINA 2: Translation Certification ──────────────────────────
  pdf.addPage()
  y = MT + 12

  pdf.setFont(FONT, 'normal')
  pdf.setTextColor(...TITLE_BLUE)
  pdf.setFontSize(20)
  pdf.text('Translation Certification', PAGE_W / 2, y, { align: 'center' })
  y += 18

  pdf.setTextColor(...TEXT_GRAY)
  pdf.setFontSize(11)
  const certBody = `I, ${translatorName || '______________________________'}, hereby certify that I translated the attached document from Spanish into English and that, to the best of my ability, it is a true and correct translation. I further certify that I am competent in both Spanish and English to render and certify such translation.`
  const certLines = pdf.splitTextToSize(certBody, CONTENT_W)
  for (const line of certLines) {
    pdf.text(line, ML, y)
    y += 6
  }

  y += 14
  pdf.setFont(FONT, 'normal')
  pdf.text('Signature: ____________________________________________', ML, y)

  y += 22
  pdf.text(`Date: ${translatorDate || '______________________________'}`, ML, y)

  return pdf.output('blob')
}

// ────────────────────────────────────────────────────────────────────
// Render helpers
// ────────────────────────────────────────────────────────────────────

function renderBlock(pdf: jsPDF, block: TranslationBlock, y: number): number {
  switch (block.type) {
    case 'paragraph':
      pdf.setFont(FONT, 'normal')
      pdf.setFontSize(11)
      return renderRichText(pdf, block.text, y, block.bold_terms)

    case 'fields':
      return renderFields(pdf, block.items, y)

    case 'section': {
      y = ensureSpace(pdf, y, 10)
      pdf.setFont(FONT, 'bold')
      pdf.setFontSize(11.5)
      const heading = block.number != null ? `${block.number}. ${block.heading}` : block.heading
      const headingLines = pdf.splitTextToSize(heading, CONTENT_W)
      for (const line of headingLines) {
        pdf.text(line, ML, y)
        y += 6
      }
      y += 1
      if (block.items && block.items.length) {
        y = renderFields(pdf, block.items, y)
      }
      if (block.paragraph) {
        pdf.setFont(FONT, 'normal')
        pdf.setFontSize(11)
        y = renderRichText(pdf, block.paragraph, y)
      }
      return y
    }

    case 'note':
      pdf.setFont(FONT, 'italic')
      pdf.setFontSize(10.5)
      y = renderRichText(pdf, block.text, y)
      pdf.setFont(FONT, 'normal')
      return y

    default:
      return y
  }
}

function renderFields(pdf: jsPDF, items: Array<{ label: string; value: string }>, y: number): number {
  pdf.setFontSize(11)
  for (const it of items) {
    y = ensureSpace(pdf, y, 6)
    const labelStr = `${it.label}: `
    pdf.setFont(FONT, 'bold')
    pdf.text(labelStr, ML, y)
    const labelW = pdf.getTextWidth(labelStr)

    pdf.setFont(FONT, 'normal')
    const value = it.value || ''
    const availableW = CONTENT_W - labelW
    const valueLines = pdf.splitTextToSize(value, availableW)
    if (valueLines.length === 0) {
      y += 5.5
      continue
    }
    pdf.text(valueLines[0], ML + labelW, y)
    y += 5.5
    for (let i = 1; i < valueLines.length; i++) {
      y = ensureSpace(pdf, y, 6)
      pdf.text(valueLines[i], ML + labelW, y)
      y += 5.5
    }
  }
  return y
}

/**
 * Renderiza texto con énfasis en bold_terms. Hace bold de cualquier
 * ocurrencia de cada término dentro del texto. Maneja line-wrapping.
 *
 * Implementación pragmática: divide el texto en wrapped lines, después
 * para cada línea va dibujando segmentos en el font correspondiente.
 */
function renderRichText(pdf: jsPDF, text: string, y: number, boldTerms?: string[]): number {
  const lineH = 5.5
  pdf.setFont(FONT, 'normal')
  const lines: string[] = pdf.splitTextToSize(text, CONTENT_W)

  for (const line of lines) {
    y = ensureSpace(pdf, y, lineH + 1)
    if (!boldTerms || boldTerms.length === 0) {
      pdf.text(line, ML, y)
      y += lineH
      continue
    }
    // Reemplazar términos por marcadores y luego dibujar segmentos
    const segments = splitByBoldTerms(line, boldTerms)
    let x = ML
    for (const seg of segments) {
      pdf.setFont(FONT, seg.bold ? 'bold' : 'normal')
      pdf.text(seg.text, x, y)
      x += pdf.getTextWidth(seg.text)
    }
    pdf.setFont(FONT, 'normal')
    y += lineH
  }
  return y
}

function splitByBoldTerms(line: string, terms: string[]): Array<{ text: string; bold: boolean }> {
  if (!terms.length) return [{ text: line, bold: false }]
  // Construir un regex con los términos (escapados)
  const escaped = terms
    .filter(t => t && t.length > 0)
    .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (!escaped.length) return [{ text: line, bold: false }]
  const re = new RegExp(`(${escaped.join('|')})`, 'gi')
  const parts = line.split(re)
  const out: Array<{ text: string; bold: boolean }> = []
  for (const p of parts) {
    if (!p) continue
    const isBold = escaped.some(t => p.toLowerCase() === t.toLowerCase().replace(/\\/g, ''))
    out.push({ text: p, bold: isBold })
  }
  return out
}

function ensureSpace(pdf: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_H - MB) {
    pdf.addPage()
    return MT
  }
  return y
}
