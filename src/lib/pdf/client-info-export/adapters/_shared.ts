// Helpers compartidos por los adapters.
//
// Mantienen el código de cada adapter declarativo (un mapping de keys a labels
// y un par de transforms), evitando duplicar la lógica de render de arrays,
// fechas, booleans, etc.

import type {
  RenderRow,
  RenderSubsection,
} from '../types'
import {
  EMPTY_PLACEHOLDER,
  fmtBool,
  fmtDate,
  fmtLongText,
  fmtMultiselect,
  fmtText,
  isEmptyValue,
} from '../formatters'

/** Modo de render de un campo simple. */
export type SimpleKind = 'text' | 'date' | 'bool' | 'longText' | 'multiselect'

/** Definición de un campo escalar mapeado a label en español. */
export interface SimpleFieldDef {
  key: string
  label: string
  kind?: SimpleKind
}

/** Construye filas a partir de un mapping de campos + objeto fuente. */
export function buildRows(
  data: Record<string, unknown>,
  fields: SimpleFieldDef[],
): RenderRow[] {
  const out: RenderRow[] = []
  for (const f of fields) {
    const raw = data[f.key]
    if (isEmptyValue(raw)) continue
    out.push(toRenderRow(f, raw))
  }
  return out
}

/** Como buildRows pero incluye placeholder para los vacíos (opcional). */
export function buildRowsIncludingEmpty(
  data: Record<string, unknown>,
  fields: SimpleFieldDef[],
): RenderRow[] {
  return fields.map((f) => toRenderRow(f, data[f.key]))
}

function toRenderRow(field: SimpleFieldDef, raw: unknown): RenderRow {
  const kind = field.kind ?? 'text'
  switch (kind) {
    case 'date':
      return { label: field.label, value: fmtDate(raw), kind: 'scalar' }
    case 'bool':
      return { label: field.label, value: fmtBool(raw), kind: 'scalar' }
    case 'longText':
      return { label: field.label, value: fmtLongText(raw), kind: 'longText' }
    case 'multiselect':
      return { label: field.label, value: fmtMultiselect(raw), kind: 'multiselect' }
    default:
      return { label: field.label, value: fmtText(raw), kind: 'scalar' }
  }
}

/** Cuenta entries con valor (para el contador "N campos llenados" de la portada). */
export function countFilled(data: Record<string, unknown>): number {
  let n = 0
  for (const v of Object.values(data)) {
    if (!isEmptyValue(v)) n++
  }
  return n
}

/**
 * Construye una sub-sección como tabla a partir de un array de objetos.
 * Los headers son los labels de columnas; cada fila es un row del array.
 *
 * Si el array está vacío, devuelve una sub-sección con un row tipo aviso.
 */
export function buildObjectArraySubsection(
  title: string,
  arr: unknown,
  columns: SimpleFieldDef[],
): RenderSubsection | null {
  if (!Array.isArray(arr)) return null
  if (arr.length === 0) {
    return {
      title,
      rows: [{ label: '', value: '— Sin registros —' }],
    }
  }
  const headers = columns.map((c) => c.label)
  const rows: string[][] = arr.map((entry) => {
    const obj = (entry ?? {}) as Record<string, unknown>
    return columns.map((c) => formatByKind(obj[c.key], c.kind))
  })
  return {
    title,
    rows: [],
    table: { headers, rows },
  }
}

function formatByKind(raw: unknown, kind: SimpleKind = 'text'): string {
  if (isEmptyValue(raw)) return EMPTY_PLACEHOLDER
  switch (kind) {
    case 'date':
      return fmtDate(raw)
    case 'bool':
      return fmtBool(raw)
    case 'longText':
      return fmtLongText(raw)
    case 'multiselect':
      return fmtMultiselect(raw)
    default:
      return fmtText(raw)
  }
}

/** Construye una sub-sección de filas planas (label/value). */
export function buildSubsection(
  title: string,
  data: Record<string, unknown>,
  fields: SimpleFieldDef[],
): RenderSubsection | null {
  const rows = buildRows(data, fields)
  if (rows.length === 0) return null
  return { title, rows }
}
