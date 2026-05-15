/**
 * Generador del PDF I-589 oficial USCIS — Parte A (páginas 1-4) rellenado
 * con las respuestas del wizard del cliente.
 *
 * Pipeline:
 *   1. Carga el PDF base de `public/forms/usa-i-589-asylum.pdf` (ya
 *      normalizado con `scripts/normalize-usa-i-589-asylum.mjs`).
 *   2. Mergea los 4 submissions del wizard (`i589_part_a1..a4`) en un
 *      solo objeto plano `{ wizardKey: value }`.
 *   3. Traduce wizardKeys → nombres reales de fields AcroForm usando
 *      `field-map.ts`.
 *   4. `fillAcroForm` rellena + aplana.
 *   5. `PDFDocument.create() + copyPages([0,1,2,3])` recorta a páginas 1-4.
 *
 * Diseñado para ser idempotente: si faltan submissions o keys, el campo
 * correspondiente queda en blanco en lugar de fallar.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { fillAcroForm } from '@/lib/legal/acroform-service'
import {
  I589_TEXT_FIELD_MAP,
  I589_RADIO_FIELD_MAP,
  I589_YESNO_FIELD_MAP,
  I589_CHILDREN_TOTAL_FIELD,
} from './field-map'

const PDF_DISK_PATH = path.join('public', 'forms', 'usa-i-589-asylum.pdf')

export interface I589PartsData {
  a1: Record<string, unknown>
  a2: Record<string, unknown>
  a3: Record<string, unknown>
  a4: Record<string, unknown>
}

/**
 * Mergea las 4 partes del wizard y traduce wizardKeys → pdfFieldName.
 * Exportada para reuso por el generador "Completo" (1-12 páginas).
 */
export function buildPartAValues(parts: I589PartsData): Record<string, string | boolean> {
  const merged: Record<string, string> = {}
  for (const data of [parts.a1, parts.a2, parts.a3, parts.a4]) {
    for (const [key, value] of Object.entries(data ?? {})) {
      if (value === null || value === undefined || value === '') continue
      merged[key] = typeof value === 'string' ? value : String(value)
    }
  }

  const out: Record<string, string | boolean> = {}

  for (const [wizardKey, pdfFieldName] of Object.entries(I589_TEXT_FIELD_MAP)) {
    const v = merged[wizardKey]
    if (v) out[pdfFieldName] = v
  }

  for (const [wizardKey, valueMap] of Object.entries(I589_RADIO_FIELD_MAP)) {
    const v = merged[wizardKey]
    if (!v) continue
    const pdfFieldName = valueMap[v]
    if (pdfFieldName) out[pdfFieldName] = true
  }

  for (const [wizardKey, { yes, no }] of Object.entries(I589_YESNO_FIELD_MAP)) {
    const v = merged[wizardKey]
    if (!v) continue
    const normalized = String(v).trim().toLowerCase()
    if (normalized === 'sí' || normalized === 'si' || normalized === 'yes' || normalized === 'true') {
      out[yes] = true
    } else if (normalized === 'no' || normalized === 'false') {
      out[no] = true
    }
  }

  // Children total count, solo si has_children=yes
  const hasChildren = merged['has_children']
  const total = merged['children_count']
  if (hasChildren && /^(sí|si|yes|true)$/i.test(hasChildren) && total) {
    out[I589_CHILDREN_TOTAL_FIELD] = total
  }

  return out
}

/**
 * Genera el PDF I-589 Parte A (páginas 1-4) rellenado con los datos del
 * wizard. Devuelve `Uint8Array` listo para enviar como
 * `application/pdf`.
 */
export async function generateI589PartAPdf(parts: I589PartsData): Promise<Uint8Array> {
  const valuesByPdfName = buildPartAValues(parts)

  const pdfPath = path.join(process.cwd(), PDF_DISK_PATH)
  const pdfBytes = await fs.readFile(pdfPath)
  const filledBytes = await fillAcroForm(new Uint8Array(pdfBytes), valuesByPdfName, { flatten: true })

  const filledDoc = await PDFDocument.load(filledBytes)
  const totalPages = filledDoc.getPageCount()
  const pageIndexes = [0, 1, 2, 3].filter((i) => i < totalPages)

  const truncated = await PDFDocument.create()
  const copiedPages = await truncated.copyPages(filledDoc, pageIndexes)
  for (const p of copiedPages) {
    truncated.addPage(p)
  }

  return await truncated.save()
}
