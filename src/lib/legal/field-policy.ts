import type { FieldSpec } from './sapcr100-form-schema'

/**
 * Heurística para decidir si un FieldSpec lo edita el cliente desde la
 * pestaña Fases o si queda exclusivo del admin (Diana) en jurisdiction-panel.
 *
 * Reglas:
 *   1. Si el FieldSpec tiene `editableByClient` explícito, ese gana.
 *   2. Si tiene `hardcoded`, NO editable (es una verdad universal SIJS).
 *   3. Si su semanticKey calza con un patrón "jurídico" (court, cause, service,
 *      respondent service, hardcoded standing/jurisdiction), NO editable.
 *   4. En todos los otros casos: editable por el cliente.
 *
 * Esto evita tener que anotar manualmente los ~600 fields de los 7 schemas TX.
 * Si en algún form se descubre un campo mal clasificado, se puede anotar
 * `editableByClient: true|false` en su FieldSpec para sobrescribir la heurística.
 */
export function isFieldEditableByClient(field: FieldSpec): boolean {
  if (field.editableByClient !== undefined) return field.editableByClient
  if (field.hardcoded !== undefined) return false

  const k = field.semanticKey
  // Datos asignados por el clerk de la corte
  if (k === 'case_cause_number' || k === 'case_court_number') return false
  // Tipo de corte (decisión legal)
  if (k.startsWith('case_court_type_')) return false
  // Decisiones de servicio del respondent (estrategia legal)
  if (k.startsWith('respondent_a_service_')) return false
  if (k === 'respondent_a_publication' || k === 'respondent_a_waiver') return false
  // Out-of-state checkboxes legales
  if (k.startsWith('oos_')) return false
  // Jurisdicción UCCJEA
  if (k.startsWith('jurisdiction_lived_') || k.startsWith('jurisdiction_not_in_')) return false
  // No-respondent flags (siempre hardcoded para SIJS)
  if (k.match(/^respondent_[bcd]_none$/)) return false
  // Standing (lo determina Diana legalmente)
  if (k.startsWith('petitioner_standing_')) return false
  if (k === 'petitioner_not_related' || k === 'petitioner_related') return false

  return true
}

export function hasResolvedValue(prefill: Record<string, string | boolean | null | undefined>, key: string): boolean {
  if (!(key in prefill)) return false
  const v = prefill[key]
  if (v === null || v === undefined) return false
  if (typeof v === 'string' && v.trim() === '') return false
  return true
}
