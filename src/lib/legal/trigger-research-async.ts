import { after } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveClientLocation } from './resolve-client-location'
import { researchJurisdiction } from './research-jurisdiction'
import { createLogger } from '@/lib/logger'

const log = createLogger('trigger-research-async')

/**
 * Marca el caso con `research_status='pending'` en `case_jurisdictions` y
 * lanza la investigación real en background usando `after()` de Next.js.
 *
 * Uso: desde el endpoint que crea el contrato+case para servicios SIJS, y
 * desde el panel admin (POST/GET re-verificar). El handler HTTP responde en
 * <2 s; la investigación corre por ~30-90 s en el servidor. El panel admin
 * pollea la tabla cada 5 s hasta ver `research_status='completed'`.
 *
 * - Si ya hay un row `completed` y `force` es false, NO se reinicia.
 * - Si ya hay un row `pending`, no se lanza otro research paralelo.
 * - Si `force` es true, el caller ya borró la fila previa; igual lo
 *   reforzamos aquí ignorando el chequeo de existing.
 */
export async function triggerJurisdictionResearchAsync(
  caseId: string,
  service: SupabaseClient,
  opts: { force?: boolean } = {},
): Promise<{ triggered: boolean; reason: string }> {
  const force = Boolean(opts.force)

  // 1. Idempotencia (saltable con force).
  if (!force) {
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
  }

  // 2. Resolver ubicación antes de marcar pending.
  const location = await resolveClientLocation(caseId, service)
  if (!location) {
    log.warn('trigger skipped — no location resoluble', { caseId })
    return { triggered: false, reason: 'no_location' }
  }

  // 3. Placeholder pending para que la UI muestre spinner.
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
    intake_required_forms: [],
    intake_filing_steps: [],
    intake_filing_channel: null,
    intake_procedure_es: null,
    intake_notes: null,
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

  // 4. Lanzar research en background con after(). Vercel garantiza ~5 min de
  //    ejecución post-respuesta — más que suficiente para el research más caro
  //    (15 web_searches + 8k tokens output).
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
        intakeForms: research.intake_packet.required_forms.length,
        meritsForms: research.required_forms.length,
        elapsedMs: Date.now() - startMs,
      })
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
