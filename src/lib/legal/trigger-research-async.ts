import { after } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveClientLocation } from './resolve-client-location'
import { researchJurisdiction } from './research-jurisdiction'
import { enqueueJob } from '@/lib/qstash/client'
import { createServiceClient } from '@/lib/supabase/service'
import { createLogger } from '@/lib/logger'

const log = createLogger('trigger-research-async')

/**
 * Encola la investigación de jurisdicción para un caso.
 *
 * Flujo:
 *  1. Marca placeholder `research_status='pending'` en `case_jurisdictions`.
 *  2. Encola un job a QStash → /api/workers/jurisdiction-research, que tiene
 *     maxDuration=300 y puede tardar lo necesario (15 web_searches + Claude
 *     Opus). El handler HTTP no espera al research.
 *  3. Si QStash falla (token mal configurado, red caída), cae a `after()`
 *     como red de seguridad — funciona en local y en deploys sin QStash.
 *
 * El frontend (jurisdiction-panel.tsx) pollea cada 5s mientras la fila esté
 * en `pending` y refresca al verla en `completed` o `failed`.
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

  // 3. Placeholder pending.
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

  // 4. Preferir QStash (worker tiene 300s); si no hay token, after() como
  //    red de seguridad (sirve en local y deploys sin QStash configurada).
  const workerUrl = process.env.JURISDICTION_WORKER_URL ?? deriveWorkerUrl()

  if (process.env.QSTASH_TOKEN && workerUrl) {
    try {
      await enqueueJob({
        endpoint: workerUrl,
        body: { caseId },
        deduplicationId: `jurisdiction-${caseId}-${Date.now()}`,
      })
      log.info('research enqueued to QStash', { caseId, workerUrl })
      return { triggered: true, reason: 'research_queued_qstash' }
    } catch (err) {
      log.error('QStash enqueue failed, falling back to after()', { caseId, err: err instanceof Error ? err.message : err })
      // fall through al after()
    }
  }

  // 5. Fallback: after() — funciona en dev y deploys sin QStash, pero limita
  //    a ~5 min en Vercel y a veces el isolate se recicla antes.
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
 * Ejecuta el research SYNC: lee la fila pending, hace el research con Claude,
 * y persiste resultado o `failed` con error. Esta es la función que llama el
 * worker de QStash (que ya está fuera del handler HTTP del usuario).
 *
 * Idempotente: si la fila ya está `completed` no rehace nada (la deduplicación
 * de QStash hace su parte, esto es defensa adicional).
 */
export async function runJurisdictionResearchSync(caseId: string): Promise<void> {
  const service = createServiceClient()
  const startMs = Date.now()

  const location = await resolveClientLocation(caseId, service)
  if (!location) {
    log.warn('runJurisdictionResearchSync: no location', { caseId })
    await service
      .from('case_jurisdictions')
      .update({
        research_status: 'failed',
        research_error: 'No se pudo resolver la ubicación del cliente',
        updated_at: new Date().toISOString(),
      })
      .eq('case_id', caseId)
    return
  }

  log.info('research started', { caseId, state: location.stateCode })

  try {
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

    log.info('research completed', {
      caseId,
      court: research.court_name,
      intakeForms: research.intake_packet.required_forms.length,
      meritsForms: research.required_forms.length,
      elapsedMs: Date.now() - startMs,
    })
  } catch (err) {
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

function deriveWorkerUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL ?? null
  if (!base) return null
  const url = base.startsWith('http') ? base : `https://${base}`
  return `${url}/api/workers/jurisdiction-research`
}
