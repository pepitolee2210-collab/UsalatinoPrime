export type FieldType = 'text' | 'textarea' | 'checkbox' | 'date' | 'phone' | 'state' | 'zip'

export interface ClientField {
  semanticKey: string
  type: FieldType
  labelEs: string
  helpEs?: string
  required: boolean
  groupKey?: string
  options?: { value: string; labelEs: string }[]
  maxLength?: number
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
  is_special_story?: boolean
  is_special_i360?: boolean
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
