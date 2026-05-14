import type { CasePhase, DocumentType } from '@/types/database'

/**
 * Resolver data-driven de categoría visible por (servicio, fase, código de doc).
 *
 * Reemplaza el archivo TS estático `phase-category-overrides.ts` con un helper
 * que consulta la tabla M2M `document_type_phases` (migración 20260515). El
 * llamador trae las filas M2M ya cargadas (junto con `document_types`) y este
 * módulo encapsula el merge entre overrides M2M y campos del catálogo.
 *
 * NOTA: el helper TS legacy sigue funcionando para SIJS — esta función es la
 * nueva ruta canónica, pero los consumidores migran gradualmente. Cuando
 * todos migren se borra `phase-category-overrides.ts`.
 */

/** Fila relevante de la tabla M2M `document_type_phases`. */
export interface DocumentTypePhaseRow {
  document_type_id: number
  service_slug: string
  phase_code: CasePhase
  sort_order: number
  category_code_override: string | null
  category_name_es_override: string | null
  category_icon_override: string | null
  is_required_override: boolean | null
  conditional_logic_override: unknown
}

export interface ResolvedPhaseCategory {
  category_code: string
  category_name_es: string
  category_icon: string | null
  sort_order: number
}

/**
 * Resuelve la categoría visible de un `document_type` para una combinación
 * (servicio, fase). Si la fila M2M tiene overrides, gana. Si no, cae al
 * catálogo.
 */
export function resolvePhaseCategory(
  dt: Pick<DocumentType, 'category_code' | 'category_name_es' | 'category_icon' | 'sort_order'>,
  m2mRow: DocumentTypePhaseRow | null | undefined,
): ResolvedPhaseCategory {
  return {
    category_code: m2mRow?.category_code_override ?? dt.category_code,
    category_name_es: m2mRow?.category_name_es_override ?? dt.category_name_es,
    category_icon: m2mRow?.category_icon_override ?? dt.category_icon ?? null,
    sort_order: m2mRow?.sort_order ?? dt.sort_order,
  }
}
