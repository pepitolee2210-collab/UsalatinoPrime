import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { resolveClientLocation } from '@/lib/legal/resolve-client-location'
import { triggerJurisdictionResearchAsync } from '@/lib/legal/trigger-research-async'
import { createLogger } from '@/lib/logger'

const log = createLogger('case-jurisdiction')

// El research vive 100% en background (after()): el handler sólo encola
// y responde el placeholder. El frontend ya pollea la fila cada 5s.

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
 * Default: lee de cache y NO dispara research. Si no hay cache devuelve
 * `{ jurisdiction: null, reason }` con 200.
 *
 * Con `?research=true` encola el research en background vía
 * triggerJurisdictionResearchAsync (placeholder pending + after()) y
 * devuelve la fila placeholder. El frontend ya pollea cada 5s mientras
 * `research_status === 'pending'`.
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

  // --- 1. Cache ---
  const cached = await service
    .from('case_jurisdictions')
    .select('*')
    .eq('case_id', caseId)
    .maybeSingle()

  const location = await resolveClientLocation(caseId, service)

  // Cualquier row 'completed' o 'pending' la devolvemos tal cual.
  // Sólo 'failed' permite retry vía ?research=true.
  if (cached.data && cached.data.research_status !== 'failed') {
    return NextResponse.json({
      jurisdiction: cached.data,
      clientLocation: location,
      cached: true,
    })
  }

  // --- 2. Sin research explícito → devolvemos lo que haya ---
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

  // --- 3. Research pedido pero no hay ubicación ---
  if (!location) {
    return NextResponse.json({
      jurisdiction: null,
      clientLocation: null,
      cached: false,
      reason: 'no_location_detected',
    }, { status: 400 })
  }

  // --- 4. Encolar research en background (devuelve en <2s) ---
  const triggered = await triggerJurisdictionResearchAsync(caseId, service, { force: true })
  log.info('GET ?research=true encolado', { caseId, triggered })

  const placeholder = await service
    .from('case_jurisdictions')
    .select('*')
    .eq('case_id', caseId)
    .maybeSingle()

  return NextResponse.json({
    jurisdiction: placeholder.data,
    clientLocation: location,
    cached: false,
    queued: triggered.triggered,
    reason: triggered.reason,
  })
}

/**
 * POST /api/admin/case-jurisdiction
 * Body: { caseId: string, force?: boolean }
 *
 * `force: true` → borra cache + encola re-investigación. Usado por el
 * botón "Re-verificar" del panel de jurisdicción en el admin.
 *
 * Sin `force` se comporta como GET (idempotente: devuelve cached si válido,
 * encola si no había).
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

  const triggered = await triggerJurisdictionResearchAsync(caseId, service, { force })
  log.info('POST encolado', { caseId, force, triggered })

  const placeholder = await service
    .from('case_jurisdictions')
    .select('*')
    .eq('case_id', caseId)
    .maybeSingle()

  return NextResponse.json({
    jurisdiction: placeholder.data,
    clientLocation: location,
    cached: false,
    queued: triggered.triggered,
    reason: triggered.reason,
  })
}

// El handler ya no espera al research (corre en after() ~5min). Mantener
// 60s de margen es de sobra para el upsert + 1-2 lecturas.
export const maxDuration = 60
