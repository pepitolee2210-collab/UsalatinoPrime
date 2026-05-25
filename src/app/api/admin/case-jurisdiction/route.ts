import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { resolveClientLocation } from '@/lib/legal/resolve-client-location'
import { ensureJurisdictionPlaceholder, runJurisdictionResearchSync } from '@/lib/legal/trigger-research-async'
import { getInjectedFormsForState, mergeWithInjectedForms } from '@/lib/legal/automated-forms-registry'
import { enqueueJob } from '@/lib/qstash/client'
import { createLogger } from '@/lib/logger'

const log = createLogger('case-jurisdiction')

/**
 * Enriquece la fila cacheada de jurisdicción con los formularios del registry
 * que aplican al estado, sin tocar la BD. Permite que casos investigados ANTES
 * de que un formulario se automatizara empiecen a mostrar los botones "Abrir
 * formulario" + "Imprimir" inmediatamente, sin re-research costoso.
 *
 * Es runtime-only: la fila en BD queda intacta. Cuando se haga re-investigar,
 * la IA registrará los slugs nativamente (vía SLUG_CATALOG en su prompt).
 */
function enrichWithRegistryForms<T extends { state_code?: string | null; intake_required_forms?: unknown; required_forms?: unknown } | null>(
  row: T
): T {
  if (!row) return row
  const stateCode = row.state_code ?? null
  const intakeInjected = getInjectedFormsForState(stateCode, 'intake')
  const meritsInjected = getInjectedFormsForState(stateCode, 'merits')

  return {
    ...row,
    intake_required_forms: mergeWithInjectedForms(
      (row.intake_required_forms as Parameters<typeof mergeWithInjectedForms>[0]) ?? [],
      intakeInjected
    ),
    required_forms: mergeWithInjectedForms(
      (row.required_forms as Parameters<typeof mergeWithInjectedForms>[0]) ?? [],
      meritsInjected
    ),
  } as T
}

// El research POST corre en background vía QStash worker (espejo del patrón
// de generate-appeal-letter y generate-eoir26a-letter). Devolvemos `queued`
// y placeholder pending inmediato — el frontend pollea cada 5s vía
// jurisdiction-panel mientras research_status='pending', así Diana puede
// cerrar la pestaña y volver luego.
//
// El GET sigue siendo síncrono (?research=true) por compatibilidad con flujos
// pre-existentes que esperan la fila completa en el response.

async function ensureAdminOrEmployee() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin' && profile?.role !== 'employee') return null
  return { userId: user.id, service: createServiceClient() }
}

async function readCachedRow(service: ReturnType<typeof createServiceClient>, caseId: string) {
  const { data } = await service
    .from('case_jurisdictions')
    .select('*')
    .eq('case_id', caseId)
    .maybeSingle()
  return data
}

/**
 * GET /api/admin/case-jurisdiction?caseId=X[&research=true]
 *
 * Default: lee de cache y NO dispara research. Si no hay cache devuelve
 * `{ jurisdiction: null, reason }` con 200.
 *
 * Con `?research=true` corre el research SÍNCRONO (60-120s); el frontend
 * mantiene el spinner durante la espera. Devuelve la fila final.
 */
export async function GET(req: NextRequest) {
  const auth = await ensureAdminOrEmployee()
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const caseId = (req.nextUrl.searchParams.get('caseId') || '').trim()
  if (!caseId) {
    return NextResponse.json({ error: 'caseId requerido' }, { status: 400 })
  }

  const researchRequested = req.nextUrl.searchParams.get('research') === 'true'
  const { service } = auth

  const cached = await readCachedRow(service, caseId)
  const location = await resolveClientLocation(caseId, service)

  // Cualquier row 'completed' o 'pending' la devolvemos tal cual.
  // 'failed' permite retry vía ?research=true.
  if (cached && cached.research_status !== 'failed') {
    return NextResponse.json({ jurisdiction: enrichWithRegistryForms(cached), clientLocation: location, cached: true })
  }

  if (!researchRequested) {
    return NextResponse.json({
      jurisdiction: cached ? enrichWithRegistryForms(cached) : null,
      clientLocation: location,
      cached: Boolean(cached),
      reason: cached ? 'previous_research_failed' : 'no_cache_research_not_triggered',
    })
  }

  if (!location) {
    return NextResponse.json({
      jurisdiction: null,
      clientLocation: null,
      cached: false,
      reason: 'no_location_detected',
    }, { status: 400 })
  }

  log.info('GET research síncrono iniciado', { caseId, state: location.stateCode })
  await runJurisdictionResearchSync(caseId)
  const final = await readCachedRow(service, caseId)

  return NextResponse.json({
    jurisdiction: enrichWithRegistryForms(final),
    clientLocation: location,
    cached: false,
  })
}

/**
 * POST /api/admin/case-jurisdiction
 * Body: { caseId: string, force?: boolean }
 *
 * Marca placeholder pending + encola job a QStash. Devuelve INMEDIATAMENTE
 * con `{ queued: true, jurisdiction: pendingRow }`. El worker corre el
 * research real con maxDuration=300 y persiste el resultado; el frontend
 * pollea cada 5s vía jurisdiction-panel.
 *
 * `force: true` → borra cache + encola un nuevo job. Idempotencia por
 * deduplicationId: si Diana hace doble-clic, QStash descarta el segundo.
 */
export async function POST(req: NextRequest) {
  const auth = await ensureAdminOrEmployee()
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let body: { caseId?: string; force?: boolean }
  try {
    body = (await req.json()) as { caseId?: string; force?: boolean }
  } catch {
    return NextResponse.json({ error: 'Body inválido (JSON requerido)' }, { status: 400 })
  }

  const { caseId, force = false } = body
  if (!caseId) return NextResponse.json({ error: 'caseId requerido' }, { status: 400 })

  const { service } = auth

  if (force) {
    await service.from('case_jurisdictions').delete().eq('case_id', caseId)
  }

  // Idempotencia: si ya hay row 'completed' y no es force, devolverla sin encolar.
  if (!force) {
    const cached = await readCachedRow(service, caseId)
    if (cached && cached.research_status === 'completed') {
      const location = await resolveClientLocation(caseId, service)
      return NextResponse.json({
        jurisdiction: enrichWithRegistryForms(cached),
        clientLocation: location,
        cached: true,
      })
    }
    if (cached && cached.research_status === 'pending') {
      const location = await resolveClientLocation(caseId, service)
      return NextResponse.json({
        jurisdiction: enrichWithRegistryForms(cached),
        clientLocation: location,
        queued: true,
        reason: 'already_pending',
      })
    }
  }

  // UPSERT placeholder pending para que el frontend lo vea de inmediato.
  const ensured = await ensureJurisdictionPlaceholder(caseId, service)
  if (!ensured) {
    return NextResponse.json({
      jurisdiction: null,
      clientLocation: null,
      reason: 'no_location_detected',
    })
  }

  const { location } = ensured
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  const workerUrl = `${proto}://${host}/api/workers/research-jurisdiction`

  try {
    const { messageId } = await enqueueJob({
      endpoint: workerUrl,
      body: { caseId },
      deduplicationId: `research-jurisdiction:${caseId}`,
    })
    log.info('research encolado a QStash', { caseId, force, state: location.stateCode, messageId })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.error('enqueue QStash falló — fallback a sync', { caseId, err: msg })
    // Fallback: si QStash no está disponible (dev sin token, fallo
    // transitorio), corremos el research síncrono como antes.
    await runJurisdictionResearchSync(caseId)
    const final = await readCachedRow(service, caseId)
    return NextResponse.json({
      jurisdiction: enrichWithRegistryForms(final),
      clientLocation: location,
      cached: false,
      queued: false,
      fallback: 'sync',
    })
  }

  const pendingRow = await readCachedRow(service, caseId)
  return NextResponse.json({
    jurisdiction: enrichWithRegistryForms(pendingRow),
    clientLocation: location,
    queued: true,
  })
}

// El GET puede correr sync (60-120s). El POST sólo encola a QStash y
// devuelve rápido, así que el maxDuration alto sigue siendo necesario sólo
// para el flujo GET con ?research=true.
export const maxDuration = 300
