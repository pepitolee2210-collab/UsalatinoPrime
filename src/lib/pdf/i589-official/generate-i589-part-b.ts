/**
 * Generador del PDF I-589 oficial USCIS — Parte B/C/D (páginas 5-12)
 * rellenado con el JSON estructurado del Miedo Creíble (prompt v3).
 *
 * Pipeline:
 *   1. Carga PDF normalizado.
 *   2. Parsea `case_credible_fear_drafts.body_md` con `parseStructuredI589`
 *      para obtener el objeto `StructuredI589BC`.
 *   3. Mapea protected_grounds + b1_a/b1_b/b2/b3a/b3b/b4 + c1..c6 a fields.
 *   4. `fillAcroForm` rellena + aplana.
 *   5. Recorta a páginas 5-12 (indexes 4..11).
 *
 * Si el draft no tiene el bloque structured (drafts v2 viejos), defaults
 * seguros: todas las preguntas con yes=false → PDF queda vacío para que
 * Diana lo llene a mano.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { fillAcroForm } from '@/lib/legal/acroform-service'
import {
  I589_PART_B_PROTECTED_GROUNDS,
  I589_PART_B_QUESTIONS,
  I589_PART_C_QUESTIONS,
} from './field-map'
import type { StructuredI589BC } from './parse-structured'

export interface SupplementBEntry {
  part: 'B' | 'C'
  question: string
  extended_text: string
}

const PDF_DISK_PATH = path.join('public', 'forms', 'usa-i-589-asylum.pdf')

/**
 * Construye el mapa de valores PDF (fieldName → value) a partir del
 * structured. Exportada para reuso por el generador "Completo".
 */
export function buildPartBCValues(structured: StructuredI589BC): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {}

  // Protected grounds (B.1, checkbox múltiple — varias pueden estar marcadas)
  for (const g of structured.protected_grounds) {
    const fld = I589_PART_B_PROTECTED_GROUNDS[g]
    if (fld) out[fld] = true
  }

  // Parte B — preguntas con Yes/No + textarea.
  // El textarea solo se rellena cuando la respuesta es "Sí". Si es "No", el
  // espacio queda vacío: el solicitante no debe justificar la negación, y la
  // IA suele generar textos del estilo "Applicant has not been accused..."
  // que no aportan información a USCIS y consumen espacio del field.
  for (const [qKey, fields] of Object.entries(I589_PART_B_QUESTIONS)) {
    const q = structured[qKey as keyof StructuredI589BC] as
      | { yes: boolean; explanation: string }
      | undefined
    if (!q) continue
    out[q.yes ? fields.yes : fields.no] = true
    if (q.yes && q.explanation) out[fields.text] = q.explanation
  }

  // Parte C — preguntas con Yes/No; algunas tienen textarea (misma regla:
  // solo se llena cuando la respuesta es "Sí").
  for (const [qKey, fields] of Object.entries(I589_PART_C_QUESTIONS)) {
    const q = structured[qKey as keyof StructuredI589BC] as
      | { yes: boolean; explanation?: string }
      | undefined
    if (!q) continue
    out[q.yes ? fields.yes : fields.no] = true
    if (q.yes && fields.text && q.explanation) out[fields.text] = q.explanation
  }

  return out
}

/**
 * Genera el PDF I-589 Parte B/C/D (páginas 5-12) listo para descargar.
 */
export async function generateI589PartBPdf(structured: StructuredI589BC): Promise<Uint8Array> {
  const values = buildPartBCValues(structured)
  const pdfPath = path.join(process.cwd(), PDF_DISK_PATH)
  const pdfBytes = await fs.readFile(pdfPath)
  const filledBytes = await fillAcroForm(new Uint8Array(pdfBytes), values, { flatten: false })

  // Truncar a páginas 5-12 removiendo las extras IN-PLACE. Crear un nuevo
  // PDFDocument + copyPages perdería el /AcroForm dict y los widgets quedarían
  // huérfanos; removePage preserva el AcroForm para que Diana pueda editar.
  const filledDoc = await PDFDocument.load(filledBytes)
  // Borrar del final hacia adelante para que los índices no se desfasen.
  for (let i = filledDoc.getPageCount() - 1; i >= 12; i--) {
    filledDoc.removePage(i)
  }
  // Borrar páginas 0-3 (Parte A), también del final hacia adelante.
  for (let i = 3; i >= 0; i--) {
    filledDoc.removePage(i)
  }
  return await filledDoc.save()
}

/**
 * Añade páginas de Supplement B al PDF cuando hay respuestas extendidas que
 * exceden el espacio de los TextField originales (Part B/C).
 *
 * Cada entrada se imprime como una página adicional con encabezado
 * estandarizado USCIS — "Form I-589 Supplement B, Part [X] Question [N]" —
 * seguido del texto extendido. Diana puede imprimir todas las hojas y
 * adjuntarlas al expediente.
 *
 * Implementación: usa `drawText` sobre páginas en blanco en lugar de
 * intentar duplicar la página 12 (Supplement B) del PDF original, porque
 * duplicar conserva los widgets del AcroForm originales que apuntan al
 * mismo field name, causando colisiones. Las páginas nuevas son flat
 * (texto pintado), perfectamente legibles y aceptadas por USCIS.
 */
export async function appendSupplementBPages(
  pdfDoc: PDFDocument,
  entries: SupplementBEntry[],
  applicantFullName: string,
): Promise<void> {
  if (entries.length === 0) return
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman)
  const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold)
  for (const entry of entries) {
    const page = pdfDoc.addPage([612, 792]) // US Letter
    const margin = 60
    let y = 792 - margin

    page.drawText('Form I-589 Supplement B', { x: margin, y, size: 14, font: fontBold })
    y -= 22
    page.drawText(`Part ${entry.part} — Question ${entry.question}`, {
      x: margin,
      y,
      size: 12,
      font: fontBold,
    })
    y -= 20
    page.drawText(`Applicant: ${applicantFullName}`, { x: margin, y, size: 10, font })
    y -= 24

    // Wrap del extended_text dentro del ancho útil (612 - 2*margin = 492).
    const maxWidth = 612 - margin * 2
    const lines = wrapText(entry.extended_text, font, 11, maxWidth)
    for (const line of lines) {
      if (y < margin + 12) {
        // Crear otra página de continuación si el texto no cabe.
        const cont = pdfDoc.addPage([612, 792])
        y = 792 - margin
        cont.drawText(`Form I-589 Supplement B (cont.) — Part ${entry.part} Q${entry.question}`, {
          x: margin,
          y,
          size: 10,
          font: fontBold,
        })
        y -= 20
        cont.drawText(line, { x: margin, y, size: 11, font })
        y -= 14
      } else {
        page.drawText(line, { x: margin, y, size: 11, font })
        y -= 14
      }
    }
  }
}

function wrapText(
  text: string,
  font: import('pdf-lib').PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const out: string[] = []
  for (const paragraph of text.split(/\r?\n/)) {
    if (paragraph.trim() === '') {
      out.push('')
      continue
    }
    const words = paragraph.split(/\s+/)
    let current = ''
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      const width = font.widthOfTextAtSize(candidate, size)
      if (width <= maxWidth) {
        current = candidate
      } else {
        if (current) out.push(current)
        current = word
      }
    }
    if (current) out.push(current)
  }
  return out
}
