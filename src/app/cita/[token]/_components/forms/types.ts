export type FieldType =
  | 'text'
  | 'textarea'
  | 'checkbox'
  | 'date'
  | 'phone'
  | 'state'
  | 'zip'
  | 'radio'
  | 'select'

export interface ClientFieldDependsOn {
  semanticKey: string
  equals: string | string[]
}

export interface ClientField {
  semanticKey: string
  type: FieldType
  labelEs: string
  helpEs?: string
  required: boolean
  groupKey?: string
  options?: { value: string; labelEs: string }[]
  maxLength?: number
  defaultValue?: string | boolean
  dependsOn?: ClientFieldDependsOn
}

export interface ClientSection {
  id: number
  titleEs: string
  descriptionEs: string
  fields: ClientField[]
}

export interface ConfirmedValue {
  semanticKey: string
  labelEs: string
  value: string | boolean | null
  source: 'profile' | 'tutor_guardian' | 'client_story' | 'jurisdiction' | 'hardcoded' | 'previous_form'
}

export interface FormDetail {
  instance_id: string | null
  slug: string
  form_name: string
  description_es: string
  state: string | null
  current_phase: string | null
  locked_for_client: boolean
  instance_status: string
  sections: ClientSection[]
  confirmed_values: ConfirmedValue[]
  saved_values: Record<string, string | boolean | null>
}

export interface FormSummary {
  slug: string
  form_name: string
  description_es: string
  state: string | null
  packet_type: string
  template_type: string
  icon: string
  total_user_fields: number
  completed_user_fields: number
  pct: number
  instance_status: string | null
  locked_for_client: boolean
  /** Si false, el form es opcional (ej. EOIR-26A Fee Waiver). Default true para retro-compat. */
  is_mandatory?: boolean
  is_special_story?: boolean
  is_special_i360?: boolean
  /** Wizard I-589 Parte A (Asilo Político Fase 1) — abre I589PartAWizardCore. */
  is_special_i589?: boolean
  /** Form URLs de noticias/evidencia (Asilo Político Fase 2). */
  is_special_evidence_urls?: boolean
  /** Cuestionario de 11 módulos para generar Miedo Creíble (Asilo Político Fase 2). */
  is_special_credible_fear_questionnaire?: boolean
  /** Carta de Cambio de Corte (6 págs custom, Cambio de Corte). */
  is_special_cc_carta?: boolean
  client_last_edit_at: string | null
  client_submitted_at: string | null
}

export interface RequiredFormsResponse {
  case_id: string
  current_phase: string | null
  state_us: string | null
  total_forms: number
  total_complete: number
  forms: FormSummary[]
}

export const SOURCE_LABEL: Record<ConfirmedValue['source'], string> = {
  profile: 'Tu perfil',
  tutor_guardian: 'Datos del tutor',
  client_story: 'Mi Historia',
  jurisdiction: 'Datos de la corte',
  hardcoded: 'Configuración SIJS',
  previous_form: 'Formulario anterior',
}
