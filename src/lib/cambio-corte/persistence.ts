// Persistencia compartida entre el endpoint admin y el endpoint cliente de
// la Carta de Cambio de Corte.
//
// La carta vive en case_form_instances con form_name fijo y schema_source
// 'custom'. Las funciones de aquí encapsulan ensureInstance + buildPrefill
// + upsert para que ambos endpoints (/api/admin/cases/[id]/carta-cambio-corte
// y /api/cita/[token]/carta-cambio-corte) compartan la misma lógica y se
// vean la misma fila en BD (bidireccional cliente ↔ admin).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { CartaCambioCorteData } from './letter-generator'
import { createLogger } from '@/lib/logger'

const log = createLogger('cambio-corte-persistence')

export const CARTA_FORM_KEY = {
  packet_type: 'merits' as const,
  form_name: 'Carta de Cambio de Corte (6 págs)',
  form_description_es: 'Moción de Change of Venue redactada en inglés legal — 6 páginas para presentar ante la Corte de Inmigración actual.',
  form_url_official: '',
  slug_internal: 'cc-carta-6pgs',
} as const

export interface CartaInstanceRow {
  id: string
  filled_values: Record<string, unknown> | null
  status: string
  locked_for_client: boolean
  client_last_edit_at: string | null
  client_submitted_at: string | null
  filled_pdf_path: string | null
  filled_pdf_generated_at: string | null
  updated_at: string
}

export function emptyCartaValues(): CartaCambioCorteData {
  return {
    client_full_name: '',
    client_phone: '',
    client_address_street: '',
    client_address_city: '',
    client_address_state: '',
    client_address_zip: '',
    file_number: '',
    judge_name: '',
    next_hearing_date: '',
    next_hearing_time: '',
    current_court_name: '',
    current_court_street: '',
    current_court_city_state_zip: '',
    new_address_street: '',
    new_address_city: '',
    new_address_state: '',
    new_address_zip: '',
    new_court_name: '',
    new_court_street: '',
    new_court_city_state_zip: '',
    chief_counsel_address: '',
    document_date: new Date().toISOString().slice(0, 10),
    residence_proof_docs: [],
    beneficiaries: [],
    new_court_chief_counsel_address: '',
    additional_context: '',
  }
}

/**
 * Crea (si no existe) la fila case_form_instances para la Carta. El form
 * NO es locked_for_client — el cliente lo puede llenar desde su portal.
 */
export async function ensureCartaInstance(
  caseId: string,
  service: SupabaseClient,
): Promise<CartaInstanceRow> {
  const existing = await service
    .from('case_form_instances')
    .select('id, filled_values, status, locked_for_client, client_last_edit_at, client_submitted_at, filled_pdf_path, filled_pdf_generated_at, updated_at')
    .eq('case_id', caseId)
    .eq('packet_type', CARTA_FORM_KEY.packet_type)
    .eq('form_name', CARTA_FORM_KEY.form_name)
    .maybeSingle()
  if (existing.data) return existing.data as CartaInstanceRow

  const ins = await service
    .from('case_form_instances')
    .insert({
      case_id: caseId,
      packet_type: CARTA_FORM_KEY.packet_type,
      form_name: CARTA_FORM_KEY.form_name,
      form_description_es: CARTA_FORM_KEY.form_description_es,
      form_url_official: CARTA_FORM_KEY.form_url_official,
      is_mandatory: true,
      schema_source: 'custom',
      acroform_schema: null,
      filled_values: {},
      status: 'pending',
      locked_for_client: false, // bidireccional cliente ↔ admin
    })
    .select('id, filled_values, status, locked_for_client, client_last_edit_at, client_submitted_at, filled_pdf_path, filled_pdf_generated_at, updated_at')
    .single()
  if (ins.error || !ins.data) {
    log.error('failed to create carta instance', { caseId, err: ins.error?.message })
    throw new Error('No se pudo crear el formulario de carta')
  }
  return ins.data as CartaInstanceRow
}

/**
 * Construye los valores precargados de la carta desde profile + legacy
 * cambio_corte_submissions (matched por phone). Devuelve un objeto completo
 * con defaults vacíos para los campos no resueltos.
 */
export async function buildCartaPrefill(
  caseId: string,
  service: SupabaseClient,
): Promise<CartaCambioCorteData> {
  const base = emptyCartaValues()
  const caseRes = await service.from('cases').select('client_id').eq('id', caseId).single()
  const clientId = caseRes.data?.client_id ?? null
  if (!clientId) return base

  const profileRes = await service
    .from('profiles')
    .select('first_name, middle_name, last_name, phone, a_number, address_street, address_city, address_state, address_zip')
    .eq('id', clientId)
    .single()
  const profile = (profileRes.data ?? {}) as Record<string, string | null>

  const fullName = [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(' ').trim()
  base.client_full_name = fullName || base.client_full_name
  base.client_phone = profile.phone ?? ''
  base.client_address_street = profile.address_street ?? ''
  base.client_address_city = profile.address_city ?? ''
  base.client_address_state = profile.address_state ?? ''
  base.client_address_zip = profile.address_zip ?? ''
  base.file_number = profile.a_number ?? ''

  if (base.client_phone) {
    const legacyRes = await service
      .from('cambio_corte_submissions')
      .select('*')
      .eq('client_phone', base.client_phone)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const legacy = (legacyRes.data ?? {}) as Record<string, unknown>
    if (legacy && Object.keys(legacy).length > 0) {
      base.file_number = (legacy.file_number as string) || base.file_number
      base.judge_name = (legacy.judge_name as string) || ''
      base.next_hearing_date = (legacy.next_hearing_date as string) || ''
      base.next_hearing_time = (legacy.next_hearing_time as string) || ''
      base.current_court_name = (legacy.current_court_name as string) || ''
      base.current_court_street = (legacy.current_court_street as string) || ''
      base.current_court_city_state_zip = (legacy.current_court_city_state_zip as string) || ''
      base.new_address_street = (legacy.new_address_street as string) || base.client_address_street
      base.new_address_city = (legacy.new_address_city as string) || base.client_address_city
      base.new_address_state = (legacy.new_address_state as string) || base.client_address_state
      base.new_address_zip = (legacy.new_address_zip as string) || base.client_address_zip
      base.new_court_name = (legacy.new_court_name as string) || ''
      base.new_court_street = (legacy.new_court_street as string) || ''
      base.new_court_city_state_zip = (legacy.new_court_city_state_zip as string) || ''
      base.chief_counsel_address = (legacy.chief_counsel_address as string) || ''
      const proofs = legacy.residence_proof_docs
      base.residence_proof_docs = Array.isArray(proofs) ? (proofs as string[]) : []
      const bens = legacy.beneficiaries
      base.beneficiaries = Array.isArray(bens)
        ? (bens as Array<{ full_name: string; file_number: string }>)
        : []
    }
  }

  return base
}

/**
 * Upsert de filled_values + actualizar timestamps de edición. El caller
 * decide si setea `client_last_edit_at` (cliente) o no (admin).
 */
export async function saveCartaValues(
  caseId: string,
  values: Partial<CartaCambioCorteData>,
  service: SupabaseClient,
  source: 'admin' | 'client',
): Promise<{ updated_at: string }> {
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    filled_values: values,
    status: 'ready',
    updated_at: now,
  }
  if (source === 'client') {
    patch.client_last_edit_at = now
  }

  const upd = await service
    .from('case_form_instances')
    .update(patch)
    .eq('case_id', caseId)
    .eq('packet_type', CARTA_FORM_KEY.packet_type)
    .eq('form_name', CARTA_FORM_KEY.form_name)
    .select('updated_at')
    .single()
  if (upd.error) {
    log.error('save carta error', { caseId, source, err: upd.error.message })
    throw new Error('No se pudieron guardar los datos')
  }
  return { updated_at: (upd.data?.updated_at as string) ?? now }
}
