// Construye el nombre de archivo del PDF "Información del cliente".
//
// Política de privacidad: NO incluimos el nombre del cliente en el filename
// (puede contener datos personales que aparecen en logs/email subjects).
// Sólo case_number + fecha YYYY-MM-DD. Esto coincide con el patrón de
// /api/contracts/export → "contratos-YYYY-MM-DD.xlsx".

const UNSAFE_FILENAME_CHARS = /[^a-zA-Z0-9_-]+/g

export interface BuildFilenameInput {
  caseNumber: string
  /** ISO o Date — default: ahora. */
  generatedAt?: string | Date
}

export function buildClientInfoFilename(input: BuildFilenameInput): string {
  const safeCaseNumber = sanitizeSegment(input.caseNumber || 'caso')
  const date = toDate(input.generatedAt) ?? new Date()
  const ymd = date.toISOString().slice(0, 10)
  return `info-cliente-${safeCaseNumber}-${ymd}.pdf`
}

function sanitizeSegment(s: string): string {
  return s.replace(UNSAFE_FILENAME_CHARS, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 64)
}

function toDate(input: string | Date | undefined): Date | null {
  if (!input) return null
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input
  const d = new Date(input)
  return isNaN(d.getTime()) ? null : d
}
