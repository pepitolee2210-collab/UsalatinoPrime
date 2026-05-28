// Tipos centrales del export "Información del cliente" en PDF.
//
// La idea es desacoplar tres capas:
//   1. Fuentes heterogéneas (case_form_submissions, case_form_instances,
//      ajuste_submissions) → se normalizan a `RawFormRecord`.
//   2. Adapters por familia de form_type → producen `ClientInfoSection[]`.
//   3. Generator pdf-lib → consume secciones agnósticas de fuente.
//
// Para agregar un nuevo form_type basta con escribir un nuevo adapter y
// registrarlo en `adapter-registry.ts`. El endpoint y el generator no cambian.

import type { CasePhase } from '@/types/database'

/** Estado normalizado del form. Coincide con valores en BD + 'unknown' como fallback. */
export type FormStatus = 'draft' | 'submitted' | 'reviewed' | 'approved' | 'unknown'

/** Origen del registro, útil para diagnósticos y dispatch del adapter genérico. */
export type RawFormSource =
  | 'case_form_submissions'
  | 'case_form_instances'
  | 'ajuste_submissions'

/**
 * Versión normalizada de un registro de form llenado por el cliente,
 * independiente de la tabla de origen. Los adapters reciben esto.
 */
export interface RawFormRecord {
  source: RawFormSource
  /** Identificador semántico estable (ej. 'i360_sijs', 'uscis-i-485', 'i589_part_a1'). */
  formType: string
  /** Slug del AUTOMATED_FORMS si aplica (case_form_instances). */
  formSlug?: string | null
  /** Nombre canónico del form (ej. 'USCIS Form I-485'). */
  formName?: string | null
  /** Payload con los datos del cliente. Estructura varía por form_type. */
  data: Record<string, unknown>
  status: FormStatus
  /** Para forms per-minor (SIJS): índice del menor (0-based). null si no aplica. */
  minorIndex: number | null
  /** Última edición del cliente / cuando se envió, en ISO. */
  updatedAt: string | null
  /** Hint de fase si está disponible (para ordering). null si la inferimos en el generator. */
  phaseHint: CasePhase | string | null
}

/** Banner de estado renderizado en el header de cada sección del PDF. */
export interface StatusBadge {
  /** Texto literal a renderizar (ej. "Enviado 12 may 2026", "Borrador"). */
  label: string
  tone: 'submitted' | 'draft' | 'reviewed' | 'unknown'
}

/**
 * Tipo semántico para el renderer del PDF. El adapter decide qué render usar
 * por field; el generator solo lo respeta.
 */
export type FieldRenderKind =
  | 'scalar'       // label arriba, value debajo (texto corto/medio)
  | 'longText'     // bloque full-width con wrap (relatos)
  | 'multiselect'  // valor pre-formateado como "A, B, C"
  | 'objectArray'  // tabla N×M

/** Field listo para render en PDF — el adapter ya hizo el formato y lookup de label. */
export interface RenderRow {
  label: string
  value: string
  kind?: FieldRenderKind
}

/** Sub-sección dentro de una sección — usada para "Datos personales", "Padres", "Testigos", etc. */
export interface RenderSubsection {
  title: string
  rows: RenderRow[]
  /** Si se renderiza como tabla (objectArray colapsado), header y filas pre-construidas. */
  table?: {
    headers: string[]
    rows: string[][]
  }
}

/**
 * Una sección del PDF (un formulario completo). El generator itera estas en
 * orden y renderiza cada una en una o más páginas según contenido.
 */
export interface ClientInfoSection {
  /** ID estable (ej. 'i360-0', 'instance-uscis-i-485'). */
  id: string
  /** Título a renderizar (ej. "I-360 SIJS — Brandon"). */
  title: string
  /** Phase code (para ordering según SERVICE_REGISTRY). */
  phase: CasePhase | string | null
  /** Pill de estado en header. */
  statusBadge: StatusBadge
  /** Cantidad de campos llenados (para contador en portada). */
  filledCount: number
  /** Filas planas (cuando no se subdividen por subsection). */
  rows: RenderRow[]
  /** Sub-secciones agrupadas (testigos, padres, empleos, hijos, etc.). */
  subsections?: RenderSubsection[]
  /** Warning visible en el header (ej. "Sin mapeo de labels — claves técnicas"). */
  warning?: string
}

/** Contexto inyectado a cada adapter. Permite lookups sin acoplar al adapter al registry. */
export interface AdapterContext {
  caseId: string
  caseNumber: string
  clientFullName: string
  serviceSlug: string
  /** Resuelve fieldByKey del registry para un slug. Devuelve null si el slug no existe. */
  getRegistryFieldByKey: (slugOrFormName: string | null | undefined) =>
    | Record<string, RegistryFieldDef>
    | null
  /** Nombre del menor por index (cuando aplica). */
  getMinorName: (minorIndex: number | null) => string | null
}

/**
 * Subset mínimo de FieldSpec del registry (`automated-forms-registry`) que el
 * adapter genérico necesita para formatear filled_values. NO importamos
 * `FieldSpec` directo para evitar pull-in del schema de Zod en el bundle del
 * adapter.
 */
export interface RegistryFieldDef {
  semanticKey: string
  labelEs: string
  type: string
  options?: { value: string; labelEs: string }[]
}

/** El contrato canónico del adapter. */
export interface FormAdapter {
  /** Identificador único (para debug). */
  id: string
  /** Predicate: ¿este adapter maneja este record? */
  matches: (rec: RawFormRecord) => boolean
  /**
   * Transforma un record en una o más secciones del PDF. Múltiples secciones
   * son útiles cuando un solo form_type produce sub-formularios per-minor.
   *
   * El adapter NO debe lanzar errores en condiciones normales (datos vacíos,
   * keys inesperadas). El orquestador captura excepciones por record.
   */
  toSections: (rec: RawFormRecord, ctx: AdapterContext) => ClientInfoSection[]
}

/** Datos crudos del cliente del caso, usados para la sección "Perfil" del PDF. */
export interface ClientProfileSnapshot {
  firstName: string | null
  middleName: string | null
  lastName: string | null
  phone: string | null
  email: string | null
  dateOfBirth: string | null
  countryOfBirth: string | null
  nationality: string | null
  aNumber: string | null
  ssn: string | null
  addressStreet: string | null
  addressUnit: string | null
  addressCity: string | null
  addressState: string | null
  addressZip: string | null
}

/** Snapshot del caso para la portada. */
export interface CaseSnapshot {
  id: string
  caseNumber: string
  serviceSlug: string
  serviceName: string
  currentPhase: CasePhase | null
  currentPhaseLabel: string | null
}

/** Input completo para `generateClientInfoPdf`. */
export interface ClientInfoPdfInput {
  caseSnapshot: CaseSnapshot
  clientProfile: ClientProfileSnapshot
  sections: ClientInfoSection[]
  /** Errores parciales recogidos por adapter — se muestran al final del PDF si hay. */
  partialErrors: string[]
  /** Fecha de generación (ISO). Inyectada por el endpoint para tests deterministas. */
  generatedAt: string
}
