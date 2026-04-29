import type { CasePhase, DocumentSlotKind } from '@/types/database'

export type DocStatus =
  | 'pending'
  | 'uploaded'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'needs_translation'

export interface UploadFile {
  id: string
  name: string
  file_type: string | null
  file_size: number | null
  status: string
  rejection_reason: string | null
  uploaded_at: string
  phase_when_uploaded: CasePhase | null
}

export interface DocItem {
  type_id: number
  code: string
  name_es: string
  description_es: string | null
  legal_reference: string | null
  requires_translation: boolean
  requires_certified_copy: boolean
  slot_kind: DocumentSlotKind
  max_slots: number | null
  visible_because: 'phase_default' | 'conditional_match'
  status: DocStatus
  uploads: Record<string, UploadFile[]>
  from_previous_phase: boolean
}

export interface CategoryGroup {
  code: string
  name_es: string
  icon: string | null
  total_required: number
  total_completed: number
  docs: DocItem[]
}

export interface RequiredDocsResponse {
  case_id: string
  current_phase: CasePhase | null
  total_required: number
  total_completed: number
  progress_pct: number
  categories: CategoryGroup[]
}

// ──────────────────────────────────────────────────────────────────
// UI helpers — visualización de status, formato de archivos, etc.
// ──────────────────────────────────────────────────────────────────

interface StatusVisual {
  label: string
  bg: string
  textColor: string
  borderLeftColor: string
  icon: string
}

export const STATUS_VISUAL: Record<DocStatus, StatusVisual> = {
  pending: {
    label: 'Pendiente',
    bg: 'rgb(248 250 252)',                      // slate-50
    textColor: 'rgb(100 116 139)',               // slate-500
    borderLeftColor: 'transparent',
    icon: 'pending',
  },
  uploaded: {
    label: 'En revisión',
    bg: 'rgb(255 247 237)',                      // amber-50
    textColor: 'rgb(180 83 9)',                  // amber-700
    borderLeftColor: 'rgb(245 158 11)',          // amber-500
    icon: 'hourglass_top',
  },
  in_review: {
    label: 'En revisión parcial',
    bg: 'rgb(239 246 255)',                      // blue-50
    textColor: 'rgb(29 78 216)',                 // blue-700
    borderLeftColor: 'rgb(59 130 246)',          // blue-500
    icon: 'visibility',
  },
  approved: {
    label: 'Aprobado',
    bg: 'rgb(236 253 245)',                      // emerald-50
    textColor: 'rgb(4 120 87)',                  // emerald-700
    borderLeftColor: 'rgb(16 185 129)',          // emerald-500
    icon: 'check_circle',
  },
  rejected: {
    label: 'Rechazado',
    bg: 'rgb(254 242 242)',                      // red-50
    textColor: 'rgb(185 28 28)',                 // red-700
    borderLeftColor: 'rgb(239 68 68)',           // red-500
    icon: 'cancel',
  },
  needs_translation: {
    label: 'Falta traducción',
    bg: 'rgb(239 246 255)',                      // blue-50
    textColor: 'rgb(29 78 216)',                 // blue-700
    borderLeftColor: 'rgb(59 130 246)',          // blue-500
    icon: 'translate',
  },
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function fileTypeIcon(mime: string | null): string {
  if (!mime) return 'description'
  if (mime.startsWith('image/')) return 'image'
  if (mime === 'application/pdf') return 'picture_as_pdf'
  return 'description'
}
