import type { CasePhase } from '@/types/database'

/**
 * Source of truth de servicios con fases y su metadata visual.
 *
 * Antes vivía hardcoded en varios sitios (`PHASE_META`, `PHASE_ORDER`,
 * `NEXT_PHASE` en `phase-status-panel.tsx`, `advance-phase/route.ts`,
 * `case-overview/route.ts`, etc.). Centralizado aquí para que añadir un
 * servicio nuevo con fases sea un solo cambio.
 *
 * Convención de iconos: nombre de Material Symbols outlined.
 * Convención de colores: clases Tailwind `bg-*-100` / `text-*-800` para
 * mantener consistencia con badges existentes.
 */

export interface ServicePhaseDef {
  /** Valor literal del enum BD `case_phase` */
  code: CasePhase
  /** Forma corta para keys, atributos data-*, slugs internos */
  shortCode: string
  /** Texto largo, ej. "Fase 1 — Custodia" */
  label: string
  /** Solo el número, ej. "Fase 1" */
  number: string
  /** Una línea descriptiva de qué ocurre en la fase */
  description: string
  /** Material Symbol outlined */
  icon: string
  bgClass: string
  textClass: string
  /** Orden interno dentro del servicio (0-based) */
  sortOrder: number
  /** Si esta fase representa el cierre del proceso */
  isCompletion?: boolean
}

export interface ServiceRegistryEntry {
  slug: string
  name: string
  usesPhases: boolean
  phases: ServicePhaseDef[]
}

const VISA_JUVENIL_PHASES: ServicePhaseDef[] = [
  {
    code: 'custodia',
    shortCode: 'custodia',
    label: 'Fase 1 — Custodia',
    number: 'Fase 1',
    description: 'Obtener orden de custodia con hallazgos SIJS de la corte estatal',
    icon: 'child_care',
    bgClass: 'bg-purple-100',
    textClass: 'text-purple-800',
    sortOrder: 0,
  },
  {
    code: 'i360',
    shortCode: 'i360',
    label: 'Fase 2 — I-360',
    number: 'Fase 2',
    description: 'Petición SIJS ante USCIS',
    icon: 'description',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-800',
    sortOrder: 1,
  },
  {
    code: 'i485',
    shortCode: 'i485',
    label: 'Fase 3 — I-485',
    number: 'Fase 3',
    description: 'Ajuste de estatus / Green Card',
    icon: 'card_membership',
    bgClass: 'bg-emerald-100',
    textClass: 'text-emerald-800',
    sortOrder: 2,
  },
  {
    code: 'completado',
    shortCode: 'completado',
    label: 'Completado',
    number: 'Final',
    description: 'Proceso SIJS completado',
    icon: 'check_circle',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-800',
    sortOrder: 3,
    isCompletion: true,
  },
]

const APELACION_PHASES: ServicePhaseDef[] = [
  {
    code: 'apelacion',
    shortCode: 'apelacion',
    label: 'Apelación',
    number: 'Fase única',
    description: 'Apelación ante la BIA (Junta de Apelaciones) — Notice of Appeal vía Formulario EOIR-26',
    icon: 'gavel',
    bgClass: 'bg-rose-100',
    textClass: 'text-rose-800',
    sortOrder: 0,
    isCompletion: true,
  },
]

const CAMBIO_DE_CORTE_PHASES: ServicePhaseDef[] = [
  {
    code: 'cambio_de_corte',
    shortCode: 'cambio_de_corte',
    label: 'Cambio de Corte',
    number: 'Fase única',
    description: 'Moción de Cambio de Venue (EOIR-33) ante la Corte de Inmigración actual',
    icon: 'location_on',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-800',
    sortOrder: 0,
    isCompletion: true,
  },
]

const ASILO_POLITICO_PHASES: ServicePhaseDef[] = [
  {
    code: 'asilo_sustentos',
    shortCode: 'sustentos',
    label: 'Fase 1 — Sustentos',
    number: 'Fase 1',
    description: 'Identidad, estatus de ingreso y formulario I-589 (partes 1-5)',
    icon: 'folder_managed',
    bgClass: 'bg-purple-100',
    textClass: 'text-purple-800',
    sortOrder: 0,
  },
  {
    code: 'asilo_reforzar',
    shortCode: 'reforzar',
    label: 'Fase 2 — Reforzar Asilo',
    number: 'Fase 2',
    description: 'Declaración jurada, evidencias y generación del Miedo Creíble',
    icon: 'shield_person',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-800',
    sortOrder: 1,
  },
  {
    code: 'asilo_completado',
    shortCode: 'completado',
    label: 'Completado',
    number: 'Final',
    description: 'Expediente presentado ante USCIS',
    icon: 'check_circle',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-800',
    sortOrder: 2,
    isCompletion: true,
  },
]

export const SERVICE_REGISTRY: Record<string, ServiceRegistryEntry> = {
  'visa-juvenil': {
    slug: 'visa-juvenil',
    name: 'Visa Juvenil (SIJS)',
    usesPhases: true,
    phases: VISA_JUVENIL_PHASES,
  },
  'asilo-politico': {
    slug: 'asilo-politico',
    name: 'Asilo Político',
    usesPhases: true,
    phases: ASILO_POLITICO_PHASES,
  },
  'apelacion': {
    slug: 'apelacion',
    name: 'Apelación',
    usesPhases: true,
    phases: APELACION_PHASES,
  },
  'cambio-de-corte': {
    slug: 'cambio-de-corte',
    name: 'Cambio de Corte',
    usesPhases: true,
    phases: CAMBIO_DE_CORTE_PHASES,
  },
}

export function getServiceRegistry(slug: string | null | undefined): ServiceRegistryEntry | null {
  if (!slug) return null
  return SERVICE_REGISTRY[slug] ?? null
}

export function isPhasedService(slug: string | null | undefined): boolean {
  return getServiceRegistry(slug)?.usesPhases ?? false
}

export function getServicePhases(slug: string | null | undefined): ServicePhaseDef[] {
  return getServiceRegistry(slug)?.phases ?? []
}

export function getPhaseDef(
  slug: string | null | undefined,
  code: CasePhase | string | null | undefined,
): ServicePhaseDef | null {
  if (!code) return null
  const phases = getServicePhases(slug)
  return phases.find((p) => p.code === code) ?? null
}

/**
 * Resuelve la fase siguiente. Devuelve `null` si la actual es la última o
 * desconocida.
 */
export function getNextPhase(
  slug: string | null | undefined,
  current: CasePhase | string | null | undefined,
): CasePhase | null {
  if (!current) return null
  const phases = getServicePhases(slug)
  const idx = phases.findIndex((p) => p.code === current)
  if (idx < 0 || idx >= phases.length - 1) return null
  return phases[idx + 1].code
}

/** Resuelve la fase anterior. Devuelve `null` si es la primera. */
export function getPreviousPhase(
  slug: string | null | undefined,
  current: CasePhase | string | null | undefined,
): CasePhase | null {
  if (!current) return null
  const phases = getServicePhases(slug)
  const idx = phases.findIndex((p) => p.code === current)
  if (idx <= 0) return null
  return phases[idx - 1].code
}

/** Orden 0-based de la fase dentro del servicio. -1 si no aplica. */
export function getPhaseOrder(
  slug: string | null | undefined,
  code: CasePhase | string | null | undefined,
): number {
  if (!code) return -1
  const phases = getServicePhases(slug)
  return phases.findIndex((p) => p.code === code)
}

/**
 * Lista de TODAS las fases de un servicio en orden. Útil para timelines.
 */
export function listPhaseCodes(slug: string | null | undefined): CasePhase[] {
  return getServicePhases(slug).map((p) => p.code)
}

/**
 * Fase de cierre del servicio (la marcada con `isCompletion: true`).
 * Para SIJS es `completado`, para Asilo es `asilo_completado`.
 */
export function getCompletionPhase(slug: string | null | undefined): CasePhase | null {
  const completion = getServicePhases(slug).find((p) => p.isCompletion)
  return completion?.code ?? null
}
