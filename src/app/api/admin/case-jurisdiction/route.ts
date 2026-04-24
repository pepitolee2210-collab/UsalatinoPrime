import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { resolveClientLocation, type ClientLocation } from '@/lib/legal/resolve-client-location'
import { researchJurisdiction, type JurisdictionResearchResult } from '@/lib/legal/research-jurisdiction'
import { createLogger } from '@/lib/logger'

const log = createLogger('case-jurisdiction')

// La jurisdicción se guarda en BD y se considera válida indefinidamente.
// Para refrescarla hay que usar el botón "Re-verificar" en la UI (POST force=true).
// Ya no se re-investiga automáticamente por antigüedad.

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

/**
 * GET /api/admin/case-jurisdiction?caseId=X[&research=true]
 *
 * Default: lee de cache y NO dispara research. Si no hay cache o está
 * vencido, devuelve `{ jurisdiction: null, reason }` con 200.
 *
 * Con `?research=true` sí investiga con Claude+web_search y persiste. Este
 * flag lo envía el panel admin solo cuando el usuario clickea explícitamente
 * "Investigar ahora". Así evitamos gastar ~$0.40 cada vez que alguien abre
 * el tab de Declaraciones de un caso sin cache.
 *
 * `?lookup=cache` sigue funcionando como alias del default (legacy readiness-panel).
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

  // --- 1. Intenta cache ---
  const cached = await service
    .from('case_jurisdictions')
    .select('*')
    .eq('case_id', caseId)
    .maybeSingle()

  const location = await resolveClientLocation(caseId, service)

  // Cualquier row en BD con status 'completed' se considera válida.
  // Una row 'pending' también la devolvemos — la UI muestra el spinner.
  // Solo una row 'failed' permite disparar retry via ?research=true.
  if (cached.data && cached.data.research_status !== 'failed') {
    return NextResponse.json({ jurisdiction: cached.data, clientLocation: location, cached: true })
  }

  // --- 2. Sin research explícito → devolvemos lo que haya sin gastar tokens ---
  if (!researchRequested) {
    return NextResponse.json({
      jurisdiction: cached.data ?? null,
      clientLocation: location,
      cached: Boolean(cached.data),
      reason: cached.data
        ? 'previous_research_failed'
        : 'no_cache_research_not_triggered',
    })
  }

  // --- 3. Research explícito pero sin ubicación → 400 ---
  if (!location) {
    return NextResponse.json({
      jurisdiction: null,
      clientLocation: null,
      cached: false,
      reason: 'no_location_detected',
    }, { status: 400 })
  }

  // --- 4. Investigar con Claude+web_search ---
  let research: JurisdictionResearchResult
  try {
    research = await researchJurisdiction(location, req.signal)
  } catch (err) {
    log.error('researchJurisdiction failed', err)
    return NextResponse.json({
      jurisdiction: cached.data ?? null,
      clientLocation: location,
      cached: Boolean(cached.data),
      error: err instanceof Error ? err.message : 'Research failed',
    }, { status: cached.data ? 200 : 502 })
  }

  // --- 5. Upsert ---
  const upsertPayload = {
    case_id: caseId,
    state_code: research.state_code,
    state_name: research.state_name,
    client_zip: location.zip,
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
    verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const upsertRes = await service
    .from('case_jurisdictions')
    .upsert(upsertPayload, { onConflict: 'case_id' })
    .select('*')
    .single()

  if (upsertRes.error) {
    log.error('upsert case_jurisdictions failed', upsertRes.error)
    return NextResponse.json({
      jurisdiction: research,
      clientLocation: location,
      cached: false,
      error: 'No se pudo persistir el resultado',
    }, { status: 200 })
  }

  return NextResponse.json({
    jurisdiction: upsertRes.data,
    clientLocation: location,
    cached: false,
  })
}

/**
 * POST /api/admin/case-jurisdiction
 * Body: { caseId: string, force?: boolean }
 *
 * `force: true` → borra cache + re-investiga. Usado por el botón
 * "Re-verificar" del panel de jurisdicción en el admin.
 *
 * Sin `force` se comporta como GET (idempotente: devuelve cached si válido).
 */
export async function POST(req: NextRequest) {
  const auth = await ensureAdminOrEmployee()
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { caseId, force = false } = await req.json() as { caseId?: string; force?: boolean }
  if (!caseId) return NextResponse.json({ error: 'caseId requerido' }, { status: 400 })

  const { service } = auth

  if (force) {
    await service.from('case_jurisdictions').delete().eq('case_id', caseId)
  }

  const location: ClientLocation | null = await resolveClientLocation(caseId, service)
  if (!location) {
    return NextResponse.json({
      jurisdiction: null,
      clientLocation: null,
      reason: 'no_location_detected',
    })
  }

  let research: JurisdictionResearchResult
  try {
    research = await researchJurisdiction(location, req.signal)
  } catch (err) {
    log.error('force re-research failed', err)
    return NextResponse.json({
      clientLocation: location,
      error: err instanceof Error ? err.message : 'Research failed',
    }, { status: 502 })
  }

  const upsertRes = await service
    .from('case_jurisdictions')
    .upsert({
      case_id: caseId,
      state_code: research.state_code,
      state_name: research.state_name,
      client_zip: location.zip,
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
    }, { onConflict: 'case_id' })
    .select('*')
    .single()

  if (upsertRes.error) {
    log.error('forced upsert failed', upsertRes.error)
    return NextResponse.json({ jurisdiction: research, clientLocation: location, error: 'Persistencia falló' })
  }

  return NextResponse.json({
    jurisdiction: upsertRes.data,
    clientLocation: location,
    cached: false,
  })
}

// Aumentamos el timeout de la ruta porque el research puede hacer 5 web_searches
// y tardar hasta 60s en total.
export const maxDuration = 60
