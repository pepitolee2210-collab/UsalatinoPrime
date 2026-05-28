// Helpers de formato compartidos por los adapters y el generator.
//
// safeWinAnsi:
//   StandardFonts.Helvetica de pdf-lib usa WinAnsi (CP1252). Cubre todo el
//   español (á é í ó ú ñ ü ¿ ¡ Á É Í Ó Ú Ñ) pero falla con emojis, símbolos
//   exóticos o caracteres indígenas. Antes de cada drawText sustituimos los
//   no encodables por '?' para que el PDF se genere sin excepciones.
//
//   Esto NO sustituye usar una embedded TTF para idiomas no-latinos: es la
//   primera barrera defensiva mientras todo el contenido sea español.

import type { FormStatus, StatusBadge } from './types'

// Codepoints adicionales en WinAnsi (CP1252) más allá del rango Latin-1:
// los caracteres especiales asignados en el rango 0x80-0x9F.
const WIN_ANSI_EXTRA = new Set<number>([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6,
  0x2030, 0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c,
  0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a,
  0x0153, 0x017e, 0x0178,
])

function isWinAnsiCode(code: number): boolean {
  // Tab, LF, CR — el generator decide si los normaliza a espacio
  if (code === 0x09 || code === 0x0a || code === 0x0d) return true
  // Printable ASCII
  if (code >= 0x20 && code <= 0x7e) return true
  // Latin-1 supplement (cubre todo el español)
  if (code >= 0xa0 && code <= 0xff) return true
  return WIN_ANSI_EXTRA.has(code)
}

/**
 * Reemplaza caracteres no representables por '?'. Útil antes de pasar strings
 * a `page.drawText` con StandardFonts.Helvetica.
 */
export function safeWinAnsi(input: string): string {
  let out = ''
  let needsReplace = false
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0
    if (isWinAnsiCode(code)) {
      out += ch
    } else {
      out += '?'
      needsReplace = true
    }
  }
  return needsReplace ? out : input
}

/** Lista flexible de valores tratados como "vacío". */
export function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === 'string' && v.trim() === '') return true
  if (Array.isArray(v) && v.length === 0) return true
  return false
}

/** Etiqueta placeholder cuando el cliente no llenó un campo. */
export const EMPTY_PLACEHOLDER = '(No proporcionado)'

/**
 * Formato de fecha "es-MX" corto (DD/MM/YYYY) — usado en cuerpo del PDF.
 * Tolera ISO con o sin tiempo, fechas MM/DD/YYYY, y devuelve raw si no parsea.
 */
export function fmtDate(input: unknown): string {
  if (isEmptyValue(input)) return EMPTY_PLACEHOLDER
  const raw = String(input)
  const date = parseFlexibleDate(raw)
  if (!date) return raw
  const dd = String(date.getUTCDate()).padStart(2, '0')
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = date.getUTCFullYear()
  return `${dd}/${mm}/${yyyy}`
}

/** Formato largo "28 de mayo de 2026" — usado en portada. */
export function fmtDateLong(input: unknown): string {
  if (isEmptyValue(input)) return EMPTY_PLACEHOLDER
  const raw = String(input)
  const date = parseFlexibleDate(raw)
  if (!date) return raw
  return date.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** Formato "28 may 2026" — usado en pills de estado. */
export function fmtDateShort(input: unknown): string {
  if (isEmptyValue(input)) return EMPTY_PLACEHOLDER
  const raw = String(input)
  const date = parseFlexibleDate(raw)
  if (!date) return raw
  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** Tolera ISO, MM/DD/YYYY, DD/MM/YYYY (heurística suave). */
function parseFlexibleDate(raw: string): Date | null {
  // ISO 2026-05-28 o 2026-05-28T...
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw)
  if (iso) {
    const d = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])))
    if (!isNaN(d.getTime())) return d
  }
  // MM/DD/YYYY (formato USCIS)
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw)
  if (slash) {
    const mm = Number(slash[1])
    const dd = Number(slash[2])
    const yyyy = Number(slash[3])
    const d = new Date(Date.UTC(yyyy, mm - 1, dd))
    if (!isNaN(d.getTime())) return d
  }
  const native = new Date(raw)
  if (!isNaN(native.getTime())) return native
  return null
}

/** Boolean a "Sí" / "No" — preserva el dato cuando es false (no usa placeholder). */
export function fmtBool(v: unknown): string {
  if (v === true || v === 'true' || v === 'yes' || v === 'Y' || v === '1') return 'Sí'
  if (v === false || v === 'false' || v === 'no' || v === 'N' || v === '0') return 'No'
  if (isEmptyValue(v)) return EMPTY_PLACEHOLDER
  return String(v)
}

/** Capitaliza primera letra. */
export function capitalize(s: string): string {
  const t = s.trim()
  if (!t) return ''
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
}

/** Render de multiselect: array de strings → "A, B, C" capitalizado. */
export function fmtMultiselect(v: unknown): string {
  if (isEmptyValue(v)) return EMPTY_PLACEHOLDER
  if (Array.isArray(v)) {
    return v
      .filter((x) => !isEmptyValue(x))
      .map((x) => capitalize(String(x).replace(/[_-]+/g, ' ')))
      .join(', ')
  }
  return String(v)
}

/** Formato genérico de string — preserva acentos, recorta espacios extra. */
export function fmtText(v: unknown): string {
  if (isEmptyValue(v)) return EMPTY_PLACEHOLDER
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return fmtBool(v)
  return String(v).trim()
}

/** Render multi-línea preservando saltos. Devuelve placeholder si vacío. */
export function fmtLongText(v: unknown): string {
  if (isEmptyValue(v)) return EMPTY_PLACEHOLDER
  return String(v).trim()
}

/** Resuelve labelEs por value de un campo `select`/multi del registry. */
export function resolveOptionLabel(
  value: string,
  options: { value: string; labelEs: string }[] | undefined,
): string {
  if (!options || options.length === 0) return value
  const opt = options.find((o) => o.value === value)
  return opt?.labelEs ?? value
}

/** Inferir el badge a partir del status + fecha de actualización. */
export function buildStatusBadge(status: FormStatus, updatedAt: string | null): StatusBadge {
  switch (status) {
    case 'submitted':
      return {
        label: `Enviado${updatedAt ? ' · ' + fmtDateShort(updatedAt) : ''}`,
        tone: 'submitted',
      }
    case 'reviewed':
    case 'approved':
      return {
        label: `Revisado${updatedAt ? ' · ' + fmtDateShort(updatedAt) : ''}`,
        tone: 'reviewed',
      }
    case 'draft':
      return {
        label: `Borrador${updatedAt ? ' · última edición ' + fmtDateShort(updatedAt) : ''}`,
        tone: 'draft',
      }
    default:
      return { label: 'Sin estado conocido', tone: 'unknown' }
  }
}

/** Normaliza el status de BD a nuestro tipo cerrado. */
export function normalizeStatus(raw: string | null | undefined): FormStatus {
  if (!raw) return 'unknown'
  const v = raw.toLowerCase()
  if (v === 'submitted' || v === 'draft' || v === 'reviewed' || v === 'approved') return v
  return 'unknown'
}
