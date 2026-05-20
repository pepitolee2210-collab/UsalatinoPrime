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
import { PDFDocument } from 'pdf-lib'
import { fillAcroForm } from '@/lib/legal/acroform-service'
import {
  I589_PART_B_PROTECTED_GROUNDS,
  I589_PART_B_QUESTIONS,
  I589_PART_C_QUESTIONS,
} from './field-map'
import type { StructuredI589BC } from './parse-structured'

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

  // Parte B — preguntas con Yes/No + textarea
  for (const [qKey, fields] of Object.entries(I589_PART_B_QUESTIONS)) {
    const q = structured[qKey as keyof StructuredI589BC] as
      | { yes: boolean; explanation: string }
      | undefined
    if (!q) continue
    out[q.yes ? fields.yes : fields.no] = true
    if (q.explanation) out[fields.text] = q.explanation
  }

  // Parte C — preguntas con Yes/No; algunas tienen textarea
  for (const [qKey, fields] of Object.entries(I589_PART_C_QUESTIONS)) {
    const q = structured[qKey as keyof StructuredI589BC] as
      | { yes: boolean; explanation?: string }
      | undefined
    if (!q) continue
    out[q.yes ? fields.yes : fields.no] = true
    if (fields.text && q.explanation) out[fields.text] = q.explanation
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
