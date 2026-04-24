import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { resolveClientLocation, type ClientLocation } from '@/lib/legal/resolve-client-location'
import { researchJurisdiction, type JurisdictionResearchResult } from '@/lib/legal/research-jurisdiction'
import { createLogger } from '@/lib/logger'

const log = createLogger('case-jurisdiction')

/** Cache TTL: 30 días. Pasado ese tiempo, al próximo GET se re-investiga. */
const CACHE_TTL_DAYS = 30

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

function isStale(verifiedAt: string | null | undefined): boolean {
  if (!verifiedAt) return true
  const verified = new Date(verifiedAt).getTime()
  const ageMs = Date.now() - verified
  const ageDays = ageMs / (1000 * 60 * 60 * 24)
  return ageDays >= CACHE_TTL_DAYS
}

/**
 * GET /api/admin/case-jurisdiction?caseId=X
 *
 * Devuelve la jurisdicción del caso. Si no existe en cache o está vencida,
 * la investiga con Claude+web_search y la persiste. Timeout generoso (60s)
 * porque la investigación puede hacer hasta 5 web_searches.
 */
export async function GET(req: NextRequest) {
  const auth = await ensureAdminOrEmployee()
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const caseId = (req.nextUrl.searchParams.get('caseId') || '').trim()
  if (!caseId) {
    return NextResponse.json({ error: 'caseId requerido' }, { status: 400 })
  }

  // `?lookup=cache` → no dispara research, solo lee lo que haya en DB. Usado
  // por paneles secundarios (readiness) que no quieren gatillar llamadas caras.
  const cacheOnly = req.nextUrl.searchParams.get('lookup') === 'cache'

  const { service } = auth

  // --- 1. Intenta cache ---
  const cached = await service
    .from('case_jurisdictions')
    .select('*')
    .eq('case_id', caseId)
    .maybeSingle()

  const location = await resolveClientLocation(caseId, service)

  if (cached.data && !isStale(cached.data.verified_at)) {
    return NextResponse.json({ jurisdiction: cached.data, clientLocation: location, cached: true })
  }

  if (cacheOnly) {
    return NextResponse.json({
      jurisdiction: cached.data ?? null,
      clientLocation: location,
      cached: Boolean(cached.data),
      reason: cached.data ? 'stale_cache_not_refreshed' : 'no_cache',
    })
  }

  // --- 2. Si no hay ubicación resoluble, no podemos investigar ---
  if (!location) {
    return NextResponse.json({
      jurisdiction: null,
      clientLocation: null,
      cached: false,
      reason: 'no_location_detected',
    })
  }

  // --- 3. Investigar con Claude+web_search ---
  let research: JurisdictionResearchResult
  try {
    research = await researchJurisdiction(location, req.signal)
  } catch (err) {
    log.error('researchJurisdiction failed', err)
    // Degradación gracil: devolvemos lo que tengamos (location) y marcamos error
    return NextResponse.json({
      jurisdiction: cached.data ?? null,
      clientLocation: location,
      cached: Boolean(cached.data),
      error: err instanceof Error ? err.message : 'Research failed',
    }, { status: cached.data ? 200 : 502 })
  }

  // --- 4. Upsert ---
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
      jurisdiction: research, // devolvemos igual lo investigado, aunque no quedó persistido
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
