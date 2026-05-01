import type { CasePhase, DocumentType } from '@/types/database'

/**
 * Override de categoría visible por fase.
 *
 * Algunos `document_types` aparecen en múltiples fases (acta, pasaporte,
 * I-94, sello CBP, etc.) pero la columna `category_code` es escalar — un
 * doc tiene UNA categoría que aplica donde sea que aparezca.
 *
 * Para que el cliente vea categorías limpias y específicas por fase
 * (ej. "Identificación del menor" en I-360 vs "Documentos del Menor" en
 * Custodia), usamos este override que el endpoint `/api/cita/[token]/
 * required-documents` consulta al construir las categorías de la
 * respuesta.
 *
 * **Mantener sincronizado con la migración**
 * `20260430_simplify_i360_i485_documents.sql`. Si se agrega un nuevo
 * doc con `shown_in_i360=true` o `shown_in_i485=true`, considerar si
 * necesita un override aquí (de lo contrario aparecerá bajo la
 * categoría legacy del catálogo).
 *
 * Custodia no tiene overrides — usa `category_code` del catálogo
 * directamente, lo cual está validado por la migración
 * 20260430_simplify_custodia_documents.sql.
 */

export interface PhaseCategoryOverride {
  category_code: string
  category_name_es: string
  category_icon: string | null
  /**
   * Sort order DENTRO de la fase. Se usa tanto para el orden del doc
   * dentro de su categoría como para el orden de la categoría
   * (la categoría se ordena por el `sort_order_override` mínimo de
   * sus docs).
   */
  sort_order_override: number
}

const I360_IDENT: Pick<PhaseCategoryOverride, 'category_code' | 'category_name_es' | 'category_icon'> = {
  category_code: 'identificacion_menor_i360',
  category_name_es: 'Identificación del menor',
  category_icon: 'badge',
}

const I360_COURT: Pick<PhaseCategoryOverride, 'category_code' | 'category_name_es' | 'category_icon'> = {
  category_code: 'orden_judicial_i360',
  category_name_es: 'Orden judicial',
  category_icon: 'gavel',
}

const I360_MIGRATION: Pick<PhaseCategoryOverride, 'category_code' | 'category_name_es' | 'category_icon'> = {
  category_code: 'historial_migratorio_i360',
  category_name_es: 'Historial migratorio',
  category_icon: 'flight_land',
}

const I485_IDENTITY: Pick<PhaseCategoryOverride, 'category_code' | 'category_name_es' | 'category_icon'> = {
  category_code: 'i360_aprobada_i485',
  category_name_es: 'I-360 aprobada e identidad',
  category_icon: 'verified',
}

const I485_ENTRY: Pick<PhaseCategoryOverride, 'category_code' | 'category_name_es' | 'category_icon'> = {
  category_code: 'entrada_eeuu_i485',
  category_name_es: 'Entrada a EE.UU.',
  category_icon: 'flight_land',
}

const I485_MEDICAL: Pick<PhaseCategoryOverride, 'category_code' | 'category_name_es' | 'category_icon'> = {
  category_code: 'medico_antecedentes_i485',
  category_name_es: 'Examen médico y antecedentes',
  category_icon: 'medical_services',
}

const I485_PAYMENT: Pick<PhaseCategoryOverride, 'category_code' | 'category_name_es' | 'category_icon'> = {
  category_code: 'pago_i912_i485',
  category_name_es: 'Pago / I-912',
  category_icon: 'payments',
}

export const PHASE_CATEGORY_OVERRIDES: Record<CasePhase, Record<string, PhaseCategoryOverride>> = {
  custodia: {},

  i360: {
    minor_birth_certificate:        { ...I360_IDENT,     sort_order_override: 10 },
    minor_passport:                 { ...I360_IDENT,     sort_order_override: 20 },
    uscis_passport_photos:          { ...I360_IDENT,     sort_order_override: 30 },
    // other_minor_i360_documents tiene category_code='identificacion_menor_i360' en BD,
    // pero igualmente se incluye aquí para que el sort_order_override sea explícito.
    other_minor_i360_documents:     { ...I360_IDENT,     sort_order_override: 40 },

    predicate_order_certified:      { ...I360_COURT,     sort_order_override: 100 },
    other_court_i360_documents:     { ...I360_COURT,     sort_order_override: 110 },

    minor_i94:                      { ...I360_MIGRATION, sort_order_override: 200 },
    minor_cbp_stamp:                { ...I360_MIGRATION, sort_order_override: 210 },
    orr_consent:                    { ...I360_MIGRATION, sort_order_override: 220 },
    other_migration_i360_documents: { ...I360_MIGRATION, sort_order_override: 230 },
  },

  i485: {
    i797_receipt:                   { ...I485_IDENTITY,  sort_order_override: 10 },
    minor_birth_certificate:        { ...I485_IDENTITY,  sort_order_override: 20 },
    passport_full_pages:            { ...I485_IDENTITY,  sort_order_override: 30 },
    minor_current_id:               { ...I485_IDENTITY,  sort_order_override: 40 },
    uscis_passport_photos:          { ...I485_IDENTITY,  sort_order_override: 50 },

    minor_i94:                      { ...I485_ENTRY,     sort_order_override: 100 },
    minor_cbp_stamp:                { ...I485_ENTRY,     sort_order_override: 110 },
    orr_consent:                    { ...I485_ENTRY,     sort_order_override: 120 },
    other_entry_i485_documents:     { ...I485_ENTRY,     sort_order_override: 130 },

    i693_medical:                   { ...I485_MEDICAL,   sort_order_override: 200 },
    criminal_records:               { ...I485_MEDICAL,   sort_order_override: 210 },
    i601_waiver:                    { ...I485_MEDICAL,   sort_order_override: 220 },
    i601_supporting_docs:           { ...I485_MEDICAL,   sort_order_override: 230 },
    juvenile_court_records:         { ...I485_MEDICAL,   sort_order_override: 240 },

    i485_filing_fee:                { ...I485_PAYMENT,   sort_order_override: 300 },
    i912_income_proof:              { ...I485_PAYMENT,   sort_order_override: 310 },
    other_i485_documents:           { ...I485_PAYMENT,   sort_order_override: 320 },
  },

  completado: {},
}

export interface ResolvedPhaseCategory {
  category_code: string
  category_name_es: string
  category_icon: string | null
  sort_order: number
}

/**
 * Resuelve la categoría visible (y sort_order) de un document_type
 * según la fase actual del caso.
 *
 * Si existe un override para `(code, phase)`, lo usa. Si no, usa los
 * campos `category_*` y `sort_order` del catálogo `document_types`.
 */
export function getPhaseCategory(
  dt: Pick<
    DocumentType,
    'code' | 'category_code' | 'category_name_es' | 'category_icon' | 'sort_order'
  >,
  phase: CasePhase,
): ResolvedPhaseCategory {
  const override = PHASE_CATEGORY_OVERRIDES[phase]?.[dt.code]
  if (override) {
    return {
      category_code: override.category_code,
      category_name_es: override.category_name_es,
      category_icon: override.category_icon,
      sort_order: override.sort_order_override,
    }
  }
  return {
    category_code: dt.category_code,
    category_name_es: dt.category_name_es,
    category_icon: dt.category_icon ?? null,
    sort_order: dt.sort_order,
  }
}
