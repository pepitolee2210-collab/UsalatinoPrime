import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { resolveClientLocation } from '@/lib/legal/resolve-client-location'
import { runJurisdictionResearchSync } from '@/lib/legal/trigger-research-async'
import { createLogger } from '@/lib/logger'

const log = createLogger('case-jurisdiction')

// El research corre SÍNCRONO en este handler porque QStash y after() en
// Vercel resultaron poco fiables para esta carga (deployment protection,
// reciclaje de isolate). Con maxDuration=300 (Vercel Pro) cabe sin sobrar:
// 15 web_searches + Claude Opus + persistencia ≈ 60-120s.

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
    return NextResponse.json({ jurisdiction: cached, clientLocation: location, cached: true })
  }

  if (!researchRequested) {
    return NextResponse.json({
      jurisdiction: cached ?? null,
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
    jurisdiction: final,
    clientLocation: location,
    cached: false,
  })
}

/**
 * POST /api/admin/case-jurisdiction
 * Body: { caseId: string, force?: boolean }
 *
 * `force: true` → borra cache + corre research SÍNCRONO. Usado por el
 * botón "Re-verificar" del panel admin. El admin ve spinner ~60-120s.
 *
 * Sin `force` se comporta como GET (idempotente).
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

  const location = await resolveClientLocation(caseId, service)
  if (!location) {
    return NextResponse.json({
      jurisdiction: null,
      clientLocation: null,
      reason: 'no_location_detected',
    })
  }

  // Idempotencia: si ya hay row 'completed' y no es force, devolverla.
  if (!force) {
    const cached = await readCachedRow(service, caseId)
    if (cached && cached.research_status === 'completed') {
      return NextResponse.json({ jurisdiction: cached, clientLocation: location, cached: true })
    }
  }

  log.info('POST research síncrono iniciado', { caseId, force, state: location.stateCode })
  await runJurisdictionResearchSync(caseId)
  const final = await readCachedRow(service, caseId)

  return NextResponse.json({
    jurisdiction: final,
    clientLocation: location,
    cached: false,
  })
}

// Vercel Pro permite hasta 300s. El research síncrono toma 60-120s típico.
export const maxDuration = 300
