/**
 * Helpers de testigos compartidos entre UI (DeclarationGenerator) y backend
 * (/api/ai/generate-declaration). Single source of truth: si UI y backend
 * difieren al construir/identificar la lista de testigos, el `index` numérico
 * usado para asociar declaraciones a testigos deja de ser estable y los
 * documentos terminan vinculados al testigo equivocado.
 */

export type WitnessRecord = Record<string, string>

/**
 * Une los testigos de las dos fuentes posibles (`tutor_guardian.witnesses` y
 * `client_witnesses.witnesses`) con deduplicación por nombre normalizado y
 * preservando el orden: primero los de tutor, luego los de client.
 */
export function mergeWitnesses(
  fromTutor: unknown,
  fromClientWitnesses: unknown,
): WitnessRecord[] {
  const a = Array.isArray(fromTutor) ? (fromTutor as WitnessRecord[]) : []
  const b = Array.isArray(fromClientWitnesses) ? (fromClientWitnesses as WitnessRecord[]) : []
  const seen = new Set<string>()
  const merged: WitnessRecord[] = []
  for (const w of [...a, ...b]) {
    const key = normalizeWitnessName(w?.name || '')
    if (!key || seen.has(key)) continue
    seen.add(key)
    merged.push(w)
  }
  return merged
}

/**
 * Normaliza un nombre de testigo para usarlo como llave estable.
 * Trim + lowercase para tolerar diferencias de capitalización y espacios
 * accidentales (frecuentes en los formularios manuales del cliente).
 */
export function normalizeWitnessName(name: string): string {
  return (name || '').trim().toLowerCase()
}
