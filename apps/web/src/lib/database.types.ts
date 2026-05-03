export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AppRole = "user" | "staff" | "admin";
export type AgencyCode = "USCIS" | "EOIR" | "CBP" | "DMV" | "STATE" | "LOCAL" | "OTHER";
export type ReviewRequirement = "none" | "recommended" | "required";
export type WorkflowStatus =
  | "draft"
  | "in_progress"
  | "needs_user_review"
  | "needs_expert_review"
  | "ready_to_sign"
  | "exported"
  | "submitted_by_user"
  | "cancelled";
export type DocumentStatus = "uploaded" | "processing" | "classified" | "needs_review" | "rejected" | "archived";
export type Severity = "green" | "yellow" | "red";
export type PremiumServiceType = "ANNUALITY_PAYMENT" | "EXPERT_REVIEW" | "SPECIAL_CASE_TRACKING";

type ProfileInsert = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  phone?: string | null;
  preferred_language?: string;
  state_code?: string | null;
  timezone?: string;
  role?: AppRole;
  onboarding_completed_at?: string | null;
  legal_disclaimer_ack_at?: string | null;
  privacy_consent_version?: string | null;
  privacy_consented_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

type CriticalDateInsert = {
  id?: string;
  user_id: string;
  case_id?: string | null;
  document_id?: string | null;
  kind: string;
  title: string;
  details?: string | null;
  due_at: string;
  severity?: Severity;
  source?: string;
  acknowledged_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

type DocumentInsert = {
  id?: string;
  user_id: string;
  agency?: AgencyCode;
  doc_type: string;
  title: string;
  storage_bucket?: string;
  storage_path: string;
  mime_type: string;
  sha256?: string | null;
  size_bytes: number;
  status?: DocumentStatus;
  offline_allowed?: boolean;
  extracted_fields?: Json;
  source_confidence?: number | null;
  issued_at?: string | null;
  expires_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

type ImmigrationCaseInsert = {
  id?: string;
  user_id: string;
  agency: AgencyCode;
  receipt_number?: string | null;
  eoir_case_identifier_ciphertext?: string | null;
  form_code?: string | null;
  status?: string;
  status_source?: string;
  last_checked_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

type DmvQuestionSetInsert = {
  id?: string;
  state_code: string;
  language?: string;
  source_id?: string | null;
  version_label: string;
  active?: boolean;
  verified_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

type DmvQuestionInsert = {
  id?: string;
  question_set_id: string;
  prompt: string;
  options: Json;
  correct_option_key: string;
  explanation?: string | null;
  topic?: string | null;
  created_at?: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          phone: string | null;
          preferred_language: string;
          state_code: string | null;
          timezone: string;
          role: AppRole;
          onboarding_completed_at: string | null;
          legal_disclaimer_ack_at: string | null;
          privacy_consent_version: string | null;
          privacy_consented_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: ProfileInsert;
        Update: Partial<ProfileInsert>;
        Relationships: [];
      };
      critical_dates: {
        Row: {
          id: string;
          user_id: string;
          case_id: string | null;
          document_id: string | null;
          kind: string;
          title: string;
          details: string | null;
          due_at: string;
          severity: Severity;
          source: string;
          acknowledged_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: CriticalDateInsert;
        Update: { acknowledged_at?: string | null; severity?: Severity };
        Relationships: [];
      };
      user_documents: {
        Row: {
          id: string;
          user_id: string;
          agency: AgencyCode;
          doc_type: string;
          title: string;
          storage_bucket: string;
          storage_path: string;
          mime_type: string;
          sha256: string | null;
          size_bytes: number;
          status: DocumentStatus;
          offline_allowed: boolean;
          extracted_fields: Json;
          source_confidence: number | null;
          issued_at: string | null;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: DocumentInsert;
        Update: { offline_allowed?: boolean; status?: DocumentStatus };
        Relationships: [];
      };
      immigration_cases: {
        Row: {
          id: string;
          user_id: string;
          agency: AgencyCode;
          receipt_number: string | null;
          eoir_case_identifier_ciphertext: string | null;
          form_code: string | null;
          status: string;
          status_source: string;
          last_checked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: ImmigrationCaseInsert;
        Update: never;
        Relationships: [];
      };
      form_definitions: {
        Row: {
          id: string;
          agency: AgencyCode;
          form_code: string;
          title: string;
          description: string;
          federal: boolean;
          review_requirement: ReviewRequirement;
          official_page_source_id: string | null;
          enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      form_sessions: {
        Row: {
          id: string;
          user_id: string;
          case_id: string | null;
          form_edition_id: string;
          status: WorkflowStatus;
          language: string;
          current_step: string | null;
          profile_snapshot: Json;
          source_document_ids: string[];
          missing_fields: string[];
          validation_result: Json;
          legal_review_required: ReviewRequirement;
          user_confirmed_truthful_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      premium_services: {
        Row: {
          id: string;
          service_type: PremiumServiceType;
          title: string;
          description: string;
          price_mode: "free" | "one_time" | "annual" | "manual_quote";
          stripe_price_id: string | null;
          enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      dmv_question_sets: {
        Row: {
          id: string;
          state_code: string;
          language: string;
          source_id: string | null;
          version_label: string;
          active: boolean;
          verified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: DmvQuestionSetInsert;
        Update: Partial<DmvQuestionSetInsert>;
        Relationships: [];
      };
      dmv_questions: {
        Row: {
          id: string;
          question_set_id: string;
          prompt: string;
          options: Json;
          correct_option_key: string;
          explanation: string | null;
          topic: string | null;
          created_at: string;
        };
        Insert: DmvQuestionInsert;
        Update: Partial<DmvQuestionInsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      app_role: AppRole;
      agency_code: AgencyCode;
      review_requirement: ReviewRequirement;
      workflow_status: WorkflowStatus;
      document_status: DocumentStatus;
      severity: Severity;
      premium_service_type: PremiumServiceType;
    };
    CompositeTypes: Record<string, never>;
  };
};
