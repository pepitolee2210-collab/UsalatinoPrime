// Selecciona la "mejor versión disponible" por (formType, minorIndex).
//
// Reglas de prioridad (de mayor a menor): reviewed/approved > submitted > draft
// El usuario confirmó: "si hay submitted, usar esa; si solo hay draft, usar el
// borrador". El badge en el PDF refleja el estado real para que el lector sepa
// si está mirando un envío final o trabajo en progreso.

import type { FormStatus, RawFormRecord } from './types'

const PRIORITY: Record<FormStatus, number> = {
  reviewed: 4,
  approved: 4,
  submitted: 3,
  draft: 2,
  unknown: 1,
}

/**
 * Agrupa records por (formType, minorIndex, formSlug) y deja solo el de mayor
 * prioridad. Empate: el más reciente por updatedAt.
 */
export function selectBestVersions(records: RawFormRecord[]): RawFormRecord[] {
  const groups = new Map<string, RawFormRecord>()
  for (const rec of records) {
    const key = `${rec.formType}::${rec.minorIndex ?? -1}::${rec.formSlug ?? ''}`
    const current = groups.get(key)
    if (!current || isBetter(rec, current)) {
      groups.set(key, rec)
    }
  }
  return [...groups.values()]
}

function isBetter(candidate: RawFormRecord, incumbent: RawFormRecord): boolean {
  const pc = PRIORITY[candidate.status] ?? 0
  const pi = PRIORITY[incumbent.status] ?? 0
  if (pc !== pi) return pc > pi
  // Mismo nivel — el más reciente gana
  const tc = candidate.updatedAt ? new Date(candidate.updatedAt).getTime() : 0
  const ti = incumbent.updatedAt ? new Date(incumbent.updatedAt).getTime() : 0
  return tc > ti
}
