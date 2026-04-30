import type { CasePhase } from '@/types/database'
import type { PhaseKey, PhaseStatus } from './phase-tokens'

export interface UploadFile {
  id: string
  document_type_id: number | null
  document_type_name_es: string | null
  category_name_es: string | null
  slot_label: string | null
  name: string
  file_type: string | null
  file_size: number | null
  status: string
  rejection_reason: string | null
  uploaded_at: string
  phase_when_uploaded: CasePhase | null
}

export interface FormInstance {
  id: string
  form_name: string
  packet_type: string | null
  status: string
  filled_pdf_path: string | null
  filled_pdf_generated_at: string | null
  client_last_edit_at: string | null
  client_submitted_at: string | null
  phase_when_submitted: CasePhase | null
  total_filled_keys: number
}

export interface PhaseGroup {
  phase: PhaseKey
  label: string
  color: string
  icon: string
  description: string
  status: PhaseStatus
  completed_at: string | null
  completed_by_name: string | null
  counts: {
    client_uploads: number
    client_uploads_approved: number
    firm_documents: number
    forms_total: number
    forms_submitted: number
  }
  documents: {
    client_uploads: UploadFile[]
    firm_documents: UploadFile[]
  }
  forms: FormInstance[]
}

export interface CaseOverview {
  case: {
    id: string
    case_number: string
    current_phase: CasePhase | null
    process_start: CasePhase | null
    state_us: string | null
    service_slug: string | null
  }
  phases: PhaseGroup[]
}
