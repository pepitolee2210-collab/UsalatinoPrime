import type { CasePhase } from '@/types/database'

export type PhaseStatus = 'completed' | 'active' | 'blocked' | 'archived'

export type PhaseKey = CasePhase | 'sin_fase'

export interface PhaseTokens {
  label: string
  shortLabel: string
  description: string
  icon: string
  bg: string
  bgSoft: string
  text: string
  border: string
  ring: string
  dot: string
}

export const PHASE_TOKENS: Record<PhaseKey, PhaseTokens> = {
  custodia: {
    label: 'Fase 1 — Custodia',
    shortLabel: 'Fase 1',
    description: 'Orden de custodia con hallazgos SIJS',
    icon: 'child_care',
    bg: 'bg-purple-50',
    bgSoft: 'bg-purple-100',
    text: 'text-purple-800',
    border: 'border-purple-200',
    ring: 'ring-purple-400',
    dot: 'bg-purple-500',
  },
  i360: {
    label: 'Fase 2 — I-360',
    shortLabel: 'Fase 2',
    description: 'Petición SIJS ante USCIS',
    icon: 'assignment',
    bg: 'bg-blue-50',
    bgSoft: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-200',
    ring: 'ring-blue-400',
    dot: 'bg-blue-500',
  },
  i485: {
    label: 'Fase 3 — I-485',
    shortLabel: 'Fase 3',
    description: 'Ajuste de estatus / Green Card',
    icon: 'verified',
    bg: 'bg-emerald-50',
    bgSoft: 'bg-emerald-100',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    ring: 'ring-emerald-400',
    dot: 'bg-emerald-500',
  },
  completado: {
    label: 'Completado',
    shortLabel: 'Completado',
    description: 'Proceso SIJS completado',
    icon: 'flag',
    bg: 'bg-amber-50',
    bgSoft: 'bg-amber-100',
    text: 'text-amber-800',
    border: 'border-amber-200',
    ring: 'ring-amber-400',
    dot: 'bg-amber-500',
  },
  matrimonio_i130: {
    label: 'Fase 1 — Petición (I-130)',
    shortLabel: 'Fase 1',
    description: 'Petición de familiar por matrimonio (I-130)',
    icon: 'family_restroom',
    bg: 'bg-purple-50',
    bgSoft: 'bg-purple-100',
    text: 'text-purple-800',
    border: 'border-purple-200',
    ring: 'ring-purple-400',
    dot: 'bg-purple-500',
  },
  matrimonio_i485: {
    label: 'Fase 2 — Ajuste (I-485)',
    shortLabel: 'Fase 2',
    description: 'Ajuste de estatus de la cónyuge (I-485)',
    icon: 'verified',
    bg: 'bg-emerald-50',
    bgSoft: 'bg-emerald-100',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    ring: 'ring-emerald-400',
    dot: 'bg-emerald-500',
  },
  sin_fase: {
    label: 'Sin fase asignada',
    shortLabel: 'Sin fase',
    description: 'Cargados antes del sistema de fases',
    icon: 'inventory_2',
    bg: 'bg-gray-50',
    bgSoft: 'bg-gray-100',
    text: 'text-gray-700',
    border: 'border-gray-200',
    ring: 'ring-gray-300',
    dot: 'bg-gray-400',
  },
  asilo_sustentos: {
    label: 'Fase 1 — Sustentos',
    shortLabel: 'Fase 1',
    description: 'Identidad, estatus de ingreso e I-589 partes 1-5',
    icon: 'folder_managed',
    bg: 'bg-purple-50',
    bgSoft: 'bg-purple-100',
    text: 'text-purple-800',
    border: 'border-purple-200',
    ring: 'ring-purple-400',
    dot: 'bg-purple-500',
  },
  asilo_reforzar: {
    label: 'Fase 2 — Reforzar Asilo',
    shortLabel: 'Fase 2',
    description: 'Declaración jurada, evidencias y Miedo Creíble',
    icon: 'shield_person',
    bg: 'bg-blue-50',
    bgSoft: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-200',
    ring: 'ring-blue-400',
    dot: 'bg-blue-500',
  },
  asilo_completado: {
    label: 'Completado',
    shortLabel: 'Completado',
    description: 'Expediente presentado ante USCIS',
    icon: 'flag',
    bg: 'bg-amber-50',
    bgSoft: 'bg-amber-100',
    text: 'text-amber-800',
    border: 'border-amber-200',
    ring: 'ring-amber-400',
    dot: 'bg-amber-500',
  },
  apelacion: {
    label: 'Apelación',
    shortLabel: 'Apelación',
    description: 'Notice of Appeal ante la BIA (EOIR-26)',
    icon: 'gavel',
    bg: 'bg-rose-50',
    bgSoft: 'bg-rose-100',
    text: 'text-rose-800',
    border: 'border-rose-200',
    ring: 'ring-rose-400',
    dot: 'bg-rose-500',
  },
  cambio_de_corte: {
    label: 'Cambio de Corte',
    shortLabel: 'Cambio Corte',
    description: 'Notificación de cambio de domicilio / venue (EOIR-33)',
    icon: 'location_on',
    bg: 'bg-blue-50',
    bgSoft: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-200',
    ring: 'ring-blue-400',
    dot: 'bg-blue-500',
  },
}

export const STATUS_BADGE: Record<PhaseStatus, { label: string; className: string }> = {
  completed: {
    label: 'Completada',
    className: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  },
  active: {
    label: 'Fase actual',
    className: 'bg-amber-100 text-amber-800 border border-amber-200',
  },
  blocked: {
    label: 'Bloqueada',
    className: 'bg-gray-100 text-gray-500 border border-gray-200',
  },
  archived: {
    label: 'Archivada',
    className: 'bg-gray-100 text-gray-600 border border-gray-200',
  },
}

export function formatCompletedAt(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}
