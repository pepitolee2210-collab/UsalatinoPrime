/**
 * Servicios de la familia "Asilo Político".
 *
 * Comparten:
 *  - El enum case_phase (asilo_sustentos, asilo_reforzar, asilo_completado).
 *  - El concepto de family members (applicant + spouse + minors).
 *  - Los wizards I-589 Parte B/C y el generador de Miedo Creíble en el
 *    dashboard del caso.
 *
 * Diferencias:
 *  - 'asilo-politico'  → proceso completo. Arranca en Fase 1 (sustentos).
 *  - 'reforzar-asilo'  → solo Fase 2 (reforzar). Para clientes que ya
 *    presentaron su I-589 y vienen a reforzar el caso.
 *
 * Cuando una regla deba aplicar a AMBOS slugs (UI de tipo de familia,
 * agrupación de docs por miembro, permiso de generar Miedo Creíble),
 * usar este helper en lugar de comparar contra 'asilo-politico' directo.
 *
 * Cuando una regla aplique solo al proceso completo (wizard I-589 Parte A
 * de Fase 1, endpoint /api/admin/cases/[id]/asilo-politico/expediente),
 * seguir comparando contra el slug literal.
 */
const ASYLUM_SERVICE_SLUGS = new Set<string>(['asilo-politico', 'reforzar-asilo'])

export function isAsylumService(slug: string | null | undefined): boolean {
  if (!slug) return false
  return ASYLUM_SERVICE_SLUGS.has(slug)
}
