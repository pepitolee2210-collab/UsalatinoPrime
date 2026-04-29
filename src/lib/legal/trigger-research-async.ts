import { after } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveClientLocation } from './resolve-client-location'
import { researchJurisdiction } from './research-jurisdiction'
import { createServiceClient } from '@/lib/supabase/service'
import { createLogger } from '@/lib/logger'

const log = createLogger('trigger-research-async')

/**
 * Encola investigación de jurisdicción en background — usado por el flujo
 * de creación de contrato (no hay admin esperando). Marca placeholder
 * pending y corre la investigación dentro de `after()`. Si `after()` no
 * sobrevive al reciclaje del isolate, la fila queda `pending`; el primer
 * "Re-verificar" manual del admin la arregla con la versión síncrona del
 * route handler.
 *
 * Para cuando hay admin esperando (botón Re-verificar), usa directamente
 * `runJurisdictionResearchSync` desde el route handler con maxDuration=300.
 */
export async function triggerJurisdictionResearchAsync(
  caseId: string,
  service: SupabaseClient,
  opts: { force?: boolean } = {},
): Promise<{ triggered: boolean; reason: string }> {
  const force = Boolean(opts.force)

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

  const location = await resolveClientLocation(caseId, service)
  if (!location) {
    log.warn('trigger skipped — no location resoluble', { caseId })
    return { triggered: false, reason: 'no_location' }
  }

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
    research_warnings: [],
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

  after(async () => {
    try {
      await runJurisdictionResearchSync(caseId)
    } catch (err) {
      log.error('after() research failed', { caseId, err: err instanceof Error ? err.message : err })
    }
  })

  return { triggered: true, reason: 'research_queued_after' }
}

/**
 * Ejecuta el research SYNC: lee fila pending, llama a Claude con
 * web_search, y persiste resultado o `failed`. Esta es la función que el
 * route handler llama directamente (con maxDuration=300).
 *
 * Idempotente: si la fila ya está `completed` no rehace nada.
 */
export async function runJurisdictionResearchSync(caseId: string): Promise<void> {
  const service = createServiceClient()
  const startMs = Date.now()

  const location = await resolveClientLocation(caseId, service)
  if (!location) {
    log.warn('runJurisdictionResearchSync: no location', { caseId })
    await service
      .from('case_jurisdictions')
      .upsert({
        case_id: caseId,
        state_code: 'XX',
        state_name: 'Desconocido',
        court_name: 'Sin ubicación',
        sources: [],
        confidence: 'low' as const,
        research_status: 'failed',
        research_error: 'No se pudo resolver la ubicación del cliente',
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'case_id' })
    return
  }

  // Marca placeholder por si el route handler lo invoca sin haberlo creado.
  await service
    .from('case_jurisdictions')
    .upsert({
      case_id: caseId,
      state_code: location.stateCode,
      state_name: location.stateName,
      client_zip: location.zip,
      court_name: 'Investigando…',
      sources: [],
      confidence: 'low' as const,
      research_status: 'pending',
      research_error: null,
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'case_id', ignoreDuplicates: false })

  log.info('research started', { caseId, state: location.stateCode })

  // AbortSignal de seguridad: si Claude tarda > 240s (típico ~60-120s),
  // rendimos antes de los 300s de Vercel para poder persistir `failed`.
  const safetyAbort = new AbortController()
  const safetyTimer = setTimeout(() => safetyAbort.abort(new Error('Safety timeout 240s — research demoró demasiado')), 240_000)

  try {
    const research = await researchJurisdiction(location, safetyAbort.signal)
    clearTimeout(safetyTimer)

    // El research devuelve `_missing_families` cuando pasó por retry pero
    // no logró cubrir todas las familias core SIJS. En ese caso persistimos
    // 'incomplete' (no 'completed') para que la UI muestre badge y Henry
    // sepa que falta completar manualmente o re-investigar.
    const missingFamilies = research._missing_families ?? []
    const finalStatus = missingFamilies.length > 0 ? 'incomplete' : 'completed'
    const errorMessage = missingFamilies.length > 0
      ? `Investigación incompleta — faltan familias core SIJS: ${missingFamilies.join(', ')}. Re-verificar.`
      : null

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
        research_status: finalStatus,
        research_error: errorMessage,
        research_warnings: missingFamilies,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('case_id', caseId)

    if (updateErr) {
      log.error('completion update failed', updateErr)
      return
    }

    log.info('research completed', {
      caseId,
      court: research.court_name,
      intakeForms: research.intake_packet.required_forms.length,
      meritsForms: research.required_forms.length,
      finalStatus,
      missingFamilies,
      elapsedMs: Date.now() - startMs,
    })
  } catch (err) {
    clearTimeout(safetyTimer)
    log.error('research failed', { caseId, err: err instanceof Error ? err.message : err })

    await service
      .from('case_jurisdictions')
      .update({
        research_status: 'failed',
        research_error: err instanceof Error ? err.message : 'Error desconocido',
        updated_at: new Date().toISOString(),
      })
      .eq('case_id', caseId)
  }
}
