export type UserRole = 'admin' | 'client' | 'employee'

export type IntakeStatus =
  | 'payment_pending'
  | 'in_progress'
  | 'submitted'
  | 'under_review'
  | 'needs_correction'
  | 'approved_by_henry'
  | 'filed'
  | 'cancelled'

export type ImmigrationStatus =
  | 'not_filed'
  | 'receipt_received'
  | 'biometrics_scheduled'
  | 'biometrics_done'
  | 'interview_scheduled'
  | 'interview_done'
  | 'rfe_received'
  | 'rfe_responded'
  | 'decision_pending'
  | 'approved'
  | 'denied'
  | 'referred_to_court'
  | 'appeal_filed'

export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'overdue'
export type DocumentStatus = 'uploaded' | 'approved' | 'rejected'
export type NotificationType = 'info' | 'warning' | 'success' | 'payment' | 'action_required'

export interface Profile {
  id: string
  role: UserRole
  first_name: string
  last_name: string
  middle_name?: string
  phone: string
  email: string
  date_of_birth?: string
  country_of_birth?: string
  nationality?: string
  gender?: 'male' | 'female'
  marital_status?: 'single' | 'married' | 'divorced' | 'widowed'
  a_number?: string
  uscis_account_number?: string
  ssn?: string
  itin?: string
  address_street?: string
  address_city?: string
  address_state?: string
  address_zip?: string
  last_entry_date?: string
  entry_status?: string
  i94_number?: string
  passport_number?: string
  passport_country?: string
  passport_expiry?: string
  preferred_language: 'es' | 'en'
  /** IANA timezone string. Si NULL, se infiere de contracts.client_state o address_state. */
  preferred_timezone?: string | null
  avatar_url?: string
  notes?: string
  created_at: string
  updated_at: string
  employee_type?: string | null
}

export interface ServiceCatalog {
  id: string
  name: string
  slug: string
  short_description?: string
  full_description?: string
  base_price: number
  allow_installments: boolean
  max_installments: number
  min_down_payment_percent: number
  estimated_duration?: string
  uscis_forms: string[]
  required_documents: RequiredDocument[]
  eligibility_questions?: EligibilityQuestion[]
  is_active: boolean
  icon?: string
  display_order: number
  created_at: string
}

export interface Case {
  id: string
  case_number: string
  client_id: string
  service_id: string
  intake_status: IntakeStatus
  immigration_status: ImmigrationStatus
  form_data: Record<string, unknown>
  current_step: number
  total_steps?: number
  total_cost: number
  payment_type: 'full' | 'installments'
  uscis_receipt_number?: string
  uscis_receipt_date?: string
  biometrics_date?: string
  interview_date?: string
  court_date?: string
  deadline_date?: string
  filed_date?: string
  decision_date?: string
  client_notes?: string
  henry_notes?: string
  correction_notes?: string
  access_granted: boolean
  created_at: string
  updated_at: string
  // Joined fields
  service?: ServiceCatalog
  client?: Profile
}

export interface Payment {
  id: string
  case_id: string
  client_id: string
  amount: number
  installment_number: number
  total_installments: number
  status: PaymentStatus
  payment_method?: string
  stripe_payment_intent_id?: string
  due_date: string
  paid_at?: string
  receipt_url?: string
  notes?: string
  created_at: string
}

export interface Document {
  id: string
  case_id: string
  client_id: string
  document_key: string
  name: string
  file_path: string
  file_type?: string
  file_size?: number
  status: DocumentStatus
  rejection_reason?: string
  uploaded_by?: string
  created_at: string
}

export type CaseActivityCategory =
  | 'case'
  | 'contract'
  | 'appointment'
  | 'document'
  | 'form'
  | 'payment'
  | 'system'
  | 'communication'

export type CaseActivityActorRole = 'admin' | 'employee' | 'client' | 'system'

export interface CaseActivity {
  id: string
  case_id: string
  actor_id?: string | null
  action: string
  description: string
  metadata: Record<string, unknown>
  visible_to_client: boolean
  created_at: string
  event_category?: CaseActivityCategory | null
  event_subcategory?: string | null
  actor_role?: CaseActivityActorRole | null
  actor_label?: string | null
  actor?: Profile
}

export interface Notification {
  id: string
  user_id: string
  case_id?: string
  title: string
  message: string
  type: NotificationType
  is_read: boolean
  created_at: string
}

export interface RequiredDocument {
  key: string
  label: string
  required: boolean
  category?: string
  helper?: string
  multiple?: boolean
}

export interface EligibilityQuestion {
  id: string
  question: string
  type: 'boolean' | 'select' | 'multi_select'
  options?: string[]
  required_answer?: boolean | string
  min_selections?: number
  fail_message: string
}

// ── Appointments ──

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show'

export interface Appointment {
  id: string
  case_id: string
  client_id: string
  scheduled_at: string
  duration_minutes: number
  status: AppointmentStatus
  reminder_1h_requested: boolean
  reminder_24h_requested: boolean
  reminder_1h_sent: boolean
  reminder_24h_sent: boolean
  cancelled_at?: string
  cancellation_reason?: string
  penalty_waived?: boolean
  notes?: string
  employee_notes?: string | null
  consultant_notes?: string | null
  session_number: number
  objective_completed?: boolean | null
  created_at: string
  updated_at: string
  // Joined fields
  client?: Profile
  case?: Case
}

export type CaseNoteCategory = 'general' | 'session' | 'legacy'
export type CaseNoteAuthorRole = 'admin' | 'employee' | 'system'

export interface CaseNote {
  id: string
  case_id: string
  appointment_id?: string | null
  author_id?: string | null
  author_role: CaseNoteAuthorRole
  author_label: string
  category: CaseNoteCategory
  body: string
  is_pinned: boolean
  visible_to_client: boolean
  created_at: string
  updated_at: string
  deleted_at?: string | null
  deleted_by?: string | null
  // Joined fields
  author?: Profile
}

export interface AppointmentToken {
  id: string
  client_id: string
  case_id: string
  token: string
  is_active: boolean
  created_at: string
}

export interface TimeBlock {
  start_hour: number
  end_hour: number
}

export interface SchedulingConfig {
  id: string
  day_of_week: number
  start_hour: number
  end_hour: number
  is_available: boolean
  time_blocks: TimeBlock[]
}

export interface SchedulingSettings {
  id: string
  zoom_link: string
  slot_duration_minutes: number
  updated_at: string
}

export interface BlockedDate {
  id: string
  blocked_date: string
  reason?: string
  created_at: string
}

// ──────────────────────────────────────────────────────────────────
// SIJS phases + dynamic document catalog (migration 20260429)
// ──────────────────────────────────────────────────────────────────

export type CasePhase =
  | 'custodia'
  | 'i360'
  | 'i485'
  | 'completado'
  | 'asilo_sustentos'
  | 'asilo_reforzar'
  | 'asilo_completado'
  | 'apelacion'
  | 'cambio_de_corte'

export type DocumentSlotKind = 'single' | 'dual_es_en' | 'multiple_named'

export interface DocumentType {
  id: number
  code: string
  name_es: string
  name_en: string
  description_es?: string | null
  category_code: string
  category_name_es: string
  category_icon?: string | null
  requires_translation: boolean
  requires_certified_copy: boolean
  shown_in_custodia: boolean
  shown_in_i360: boolean
  shown_in_i485: boolean
  conditional_logic?: ConditionalLogic | null
  legal_reference?: string | null
  slot_kind: DocumentSlotKind
  max_slots?: number | null
  sort_order: number
  is_active: boolean
  is_required: boolean
  is_per_minor: boolean
  /** Alias semántico de is_per_minor — generated column tras migración 20260517. */
  is_per_member?: boolean
  /**
   * Cuando is_per_member=true, restringe a qué roles aplica la expansión.
   * NULL = todos los roles (applicant, spouse, minor). Setear ['minor'] para
   * docs que solo aplican a hijos (ej. asylum_birth_cert_child).
   */
  applies_to_roles?: string[] | null
}

export type ConditionalLogic = {
  type: 'flag_eq'
  flag:
    | 'parent_deceased'
    | 'in_orr_custody'
    | 'has_criminal_history'
    | 'minor_close_to_21'
    | 'living_parent_consents'
    | 'requires_foreign_service'
  value: boolean
}

export interface CasePhaseHistory {
  id: string
  case_id: string
  from_phase: CasePhase | null
  to_phase: CasePhase
  changed_by?: string | null
  changed_at: string
  reason?: string | null
}

export interface ServicePhaseAsset {
  id: number
  service_id: string
  phase: CasePhase
  welcome_video_url?: string | null
  welcome_video_poster?: string | null
  description_es?: string | null
}

export interface AppealLetterDraft {
  id: string
  case_id: string
  version: number
  body_md: string
  sources?: Array<{ url: string; title?: string; snippet?: string }> | null
  model_used?: string | null
  prompt_version?: string | null
  generated_at: string
  generated_by?: string | null
  is_current: boolean
  edited_by_diana: boolean
  edited_at?: string | null
  input_tokens?: number | null
  output_tokens?: number | null
  cache_read_tokens?: number | null
  cache_creation_tokens?: number | null
  generation_seconds?: number | null
}

export interface QuickContactRow {
  id: number
  name: string
  role: string
  phone_e164?: string | null
  whatsapp_e164?: string | null
  avatar_url?: string | null
  show_in_inicio: boolean
  show_in_ayuda: boolean
  sort_order: number
  is_active: boolean
}
