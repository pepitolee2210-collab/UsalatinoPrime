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
