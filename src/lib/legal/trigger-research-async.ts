import { after } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveClientLocation } from './resolve-client-location'
import { researchJurisdiction } from './research-jurisdiction'
import { detectAcroFormFields } from './acroform-service'
import { detectOcrSchema } from './acroform-ocr'
import { suggestFieldValues } from './acroform-suggestions'
import { createLogger } from '@/lib/logger'

const log = createLogger('trigger-research-async')

/**
 * Marca el caso con `research_status='pending'` en `case_jurisdictions` y
 * lanza la investigación real en background usando `after()` de Next.js.
 *
 * Uso: desde el endpoint que crea el contrato+case para servicios SIJS —
 * cuando el user guarda el contrato, el response vuelve de inmediato y la
 * investigación corre por ~30-60s en el servidor. El panel admin pollea
 * la tabla cada 5s hasta ver `research_status='completed'`.
 *
 * Si ya hay un row con status `completed` (research previo), NO se reinicia
 * — usamos el botón "Re-verificar" manual para eso (más caro).
 *
 * Si ya hay un row `pending`, no lanzamos otro research paralelo.
 */
export async function triggerJurisdictionResearchAsync(
  caseId: string,
  service: SupabaseClient,
): Promise<{ triggered: boolean; reason: string }> {
  // 1. Idempotencia — si ya hay cache válido o está pending, salimos.
  const { data: existing } = await service
    .from('case_jurisdictions')
    .select('case_id, research_status')
    .eq('case_id', caseId)
    .maybeSingle()

  if (existing) {
    if (existing.research_status === 'completed') {
      return { triggered: false, reason: 'already_completed' }
    }
    if (existing.research_status === 'pending') {
      return { triggered: false, reason: 'already_pending' }
    }
    // status='failed' → permitimos retry
  }

  // 2. Resolver ubicación antes de marcar pending, para no guardar rows
  //    sin estado útil si no hay dirección alguna.
  const location = await resolveClientLocation(caseId, service)
  if (!location) {
    log.warn('trigger skipped — no location resoluble', { caseId })
    return { triggered: false, reason: 'no_location' }
  }

  // 3. Marcar pending inmediatamente (placeholder row) para que la UI
  //    pueda mostrar el spinner de "investigando" desde el momento cero.
  const placeholder = {
    case_id: caseId,
    state_code: location.stateCode,
    state_name: location.stateName,
    client_zip: location.zip,
    court_name: 'Investigando…',
    court_name_es: null,
    court_address: null,
    filing_procedure: null,
    filing_procedure_es: null,
    age_limit_sijs: null,
    sources: [],
    confidence: 'low' as const,
    notes: null,
    required_forms: [],
    filing_steps: [],
    attachments_required: [],
    fees: null,
    filing_channel: null,
    research_status: 'pending',
    research_error: null,
    verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const { error: upsertErr } = await service
    .from('case_jurisdictions')
    .upsert(placeholder, { onConflict: 'case_id' })

  if (upsertErr) {
    log.error('placeholder upsert failed', upsertErr)
    return { triggered: false, reason: 'placeholder_failed' }
  }

  // 4. Lanzar research en background con after(). Next.js garantiza que
  //    la función corra antes de recycle del isolate en Vercel.
  after(async () => {
    const startMs = Date.now()
    try {
      log.info('background research started', { caseId, state: location.stateCode })
      const research = await researchJurisdiction(location)

      const { error: updateErr } = await service
        .from('case_jurisdictions')
        .update({
          state_code: research.state_code,
          state_name: research.state_name,
          court_name: research.court_name,
          court_name_es: research.court_name_es,
          court_address: research.court_address,
          filing_procedure: research.filing_procedure,
          filing_procedure_es: research.filing_procedure_es,
          age_limit_sijs: research.age_limit_sijs,
          sources: research.sources,
          confidence: research.confidence,
          notes: research.notes,
          filing_channel: research.filing_channel,
          required_forms: research.required_forms,
          filing_steps: research.filing_steps,
          attachments_required: research.attachments_required,
          fees: research.fees,
          intake_required_forms: research.intake_packet.required_forms,
          intake_filing_steps: research.intake_packet.filing_steps,
          intake_filing_channel: research.intake_packet.filing_channel,
          intake_procedure_es: research.intake_packet.procedure_es,
          intake_notes: research.intake_packet.notes,
          research_status: 'completed',
          research_error: null,
          verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('case_id', caseId)

      if (updateErr) {
        log.error('completion update failed', updateErr)
        return
      }

      log.info('background research completed', {
        caseId,
        court: research.court_name,
        elapsedMs: Date.now() - startMs,
      })

      // Una vez que el research está completo, inicializar los form instances.
      // Corre en secuencia dentro del mismo after() para garantizar orden.
      try {
        await initializeCaseForms(caseId, service)
      } catch (initErr) {
        log.warn('form initialization failed (non-critical)', {
          caseId,
          err: initErr instanceof Error ? initErr.message : initErr,
        })
      }
    } catch (err) {
      log.error('background research failed', { caseId, err: err instanceof Error ? err.message : err })

      await service
        .from('case_jurisdictions')
        .update({
          research_status: 'failed',
          research_error: err instanceof Error ? err.message : 'Error desconocido',
          updated_at: new Date().toISOString(),
        })
        .eq('case_id', caseId)
    }
  })

  return { triggered: true, reason: 'research_queued' }
}

// ══════════════════════════════════════════════════════════════════
// Inicialización de form instances después del research
// ══════════════════════════════════════════════════════════════════

interface FormSource {
  name: string
  url_official: string
  description_es: string
  is_mandatory: boolean
}

/**
 * Una vez que la jurisdicción del caso tiene required_forms + intake_required_forms,
 * creamos una instance por cada form y lanzamos detección de schema + AI
 * suggestions para cada uno. Corre en secuencia dentro del mismo after().
 *
 * Usa el mismo pipeline que /api/admin/case-forms/initialize pero sin pasar
 * por el endpoint HTTP (evita un round-trip y mantiene el work dentro de un
 * solo after() por caseId).
 */
async function initializeCaseForms(
  caseId: string,
  service: SupabaseClient,
): Promise<void> {
  const { data: jurisdiction } = await service
    .from('case_jurisdictions')
    .select('required_forms, intake_required_forms')
    .eq('case_id', caseId)
    .maybeSingle()

  if (!jurisdiction) return

  const intakeForms = ((jurisdiction.intake_required_forms as FormSource[]) || []).map(f => ({
    ...f, packet_type: 'intake' as const,
  }))
  const meritsForms = ((jurisdiction.required_forms as FormSource[]) || []).map(f => ({
    ...f, packet_type: 'merits' as const,
  }))
  const allForms = [...intakeForms, ...meritsForms]
  if (allForms.length === 0) {
    log.info('no forms to initialize', { caseId })
    return
  }

  const rows = allForms.map(f => ({
    case_id: caseId,
    packet_type: f.packet_type,
    form_name: f.name,
    form_url_official: f.url_official,
    form_description_es: f.description_es,
    is_mandatory: f.is_mandatory,
    schema_source: 'pending',
    status: 'detecting',
  }))

  const { data: inserted } = await service
    .from('case_form_instances')
    .upsert(rows, { onConflict: 'case_id,packet_type,form_name' })
    .select('id, form_url_official, form_name, packet_type, schema_source')

  const toProcess = (inserted || []).filter(r => r.schema_source === 'pending')
  if (toProcess.length === 0) return

  // Contexto del caso para las sugerencias de IA
  const caseCtx = await buildCaseContextForSuggestions(service, caseId)

  for (const instance of toProcess) {
    try {
      log.info('initializeCaseForms: detecting', { id: instance.id, form: instance.form_name })

      let fields: import('./acroform-service').DetectedField[] = []
      let source: 'acroform' | 'ocr_gemini' | 'failed' = 'failed'

      const acro = await detectAcroFormFields(instance.form_url_official)
      if (acro.source === 'acroform' && acro.fields.length > 0) {
        fields = acro.fields
        source = 'acroform'
      } else {
        try {
          fields = await detectOcrSchema(instance.form_url_official)
          source = 'ocr_gemini'
        } catch (ocrErr) {
          log.error('OCR failed', { id: instance.id, err: ocrErr })
          await service
            .from('case_form_instances')
            .update({
              schema_source: 'failed',
              schema_error: ocrErr instanceof Error ? ocrErr.message : 'OCR error',
              status: 'failed',
            })
            .eq('id', instance.id)
          continue
        }
      }

      let enriched = fields
      try {
        enriched = await suggestFieldValues(fields, caseCtx)
      } catch (suggestErr) {
        log.warn('suggestions failed', { err: suggestErr })
      }

      await service
        .from('case_form_instances')
        .update({
          acroform_schema: enriched,
          schema_source: source,
          schema_error: null,
          status: 'ready',
        })
        .eq('id', instance.id)

      log.info('form ready', { id: instance.id, fields: enriched.length, source })
    } catch (err) {
      log.error('instance processing failed', { id: instance.id, err })
      await service
        .from('case_form_instances')
        .update({
          schema_source: 'failed',
          schema_error: err instanceof Error ? err.message : 'Unknown error',
          status: 'failed',
        })
        .eq('id', instance.id)
    }
  }
}

async function buildCaseContextForSuggestions(service: SupabaseClient, caseId: string) {
  const { data: caseRow } = await service
    .from('cases')
    .select('case_number, client_id, form_data')
    .eq('id', caseId)
    .single()

  if (!caseRow) return {}

  const { data: profile } = await service
    .from('profiles')
    .select('first_name, last_name, date_of_birth, address_street, address_city, address_state, address_zip, passport_number')
    .eq('id', caseRow.client_id)
    .single()

  const { data: contract } = await service
    .from('contracts')
    .select('client_full_name, client_passport, client_dob, client_address, client_city, client_state, client_zip, minors')
    .eq('client_id', caseRow.client_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: jurisdiction } = await service
    .from('case_jurisdictions')
    .select('court_name')
    .eq('case_id', caseId)
    .maybeSingle()

  const formData = (caseRow.form_data || {}) as Record<string, string>

  return {
    caseNumber: caseRow.case_number,
    clientName: contract?.client_full_name || `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim(),
    clientPassport: contract?.client_passport || profile?.passport_number,
    clientDOB: contract?.client_dob || profile?.date_of_birth,
    clientAddress: contract?.client_address || profile?.address_street,
    clientCity: contract?.client_city || profile?.address_city,
    clientState: contract?.client_state || profile?.address_state,
    clientZip: contract?.client_zip || profile?.address_zip,
    minors: contract?.minors as Array<{ fullName: string; dob?: string; countryOfBirth?: string }> | undefined,
    courtName: jurisdiction?.court_name,
    motherName: formData.mother_first_name
      ? `${formData.mother_first_name} ${formData.mother_last_name ?? ''}`.trim()
      : null,
    fatherName: formData.father_first_name
      ? `${formData.father_first_name} ${formData.father_last_name ?? ''}`.trim()
      : null,
  }
}
