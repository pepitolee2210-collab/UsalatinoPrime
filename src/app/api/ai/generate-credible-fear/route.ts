import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAsylumService } from '@/lib/services/asylum'
import { validateCaseBeforeGeneration } from '@/lib/asylum/validate-case-before-generation'
import {
  createCredibleFearV7Draft,
  runResearchPhase,
  runDraftPhase,
} from '@/lib/ai/credible-fear-pipeline'
import { enqueueJob } from '@/lib/qstash/client'
import { logActivity } from '@/lib/activity/log-activity'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:generate-credible-fear')

/**
 * POST /api/ai/generate-credible-fear  — Miedo Creíble v7 (Memorándum Legal).
 *
 * Body: { case_id }. Solo admin / paralegal.
 *
 * Valida rápido (servicio asilo + caso listo), crea un draft `RESEARCHING`, y
 * dispara el pipeline ASÍNCRONO en 2 workers QStash (research → draft). Devuelve
 * de inmediato `{ queued, draft_id }`; la UI poolea `status` hasta DRAFT_COMPLETE.
 *
 * Sin QSTASH_TOKEN (dev) corre el pipeline en background con `after()`.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role, employee_type')
    .eq('id', user.id)
    .single()
  const isAdmin = profile?.role === 'admin'
  const isParalegal = profile?.role === 'employee' && profile?.employee_type === 'paralegal'
  if (!isAdmin && !isParalegal) {
    return NextResponse.json({ error: 'Solo admin o paralegal' }, { status: 403 })
  }

  let body: { case_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }
  const caseId = body.case_id?.trim()
  if (!caseId) return NextResponse.json({ error: 'case_id requerido' }, { status: 400 })

  // Check ligero de servicio (asilo) para feedback inmediato.
  const { data: caseRow } = await service
    .from('cases')
    .select('id, service:service_catalog(slug)')
    .eq('id', caseId)
    .single<{ id: string; service: { slug: string } | { slug: string }[] | null }>()
  if (!caseRow) return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
  const serviceSlug = Array.isArray(caseRow.service) ? caseRow.service[0]?.slug : caseRow.service?.slug
  if (!isAsylumService(serviceSlug)) {
    return NextResponse.json(
      { error: 'Solo aplica a Asilo Político (asilo-politico, reforzar-asilo)' },
      { status: 400 },
    )
  }

  // Gate de validación (documentos + cuestionario + país) — preserva el UX v6.
  const validation = await validateCaseBeforeGeneration(service, caseId)
  if (!validation.ready) {
    return NextResponse.json(
      { error: 'El caso aún no está listo para generar el Miedo Creíble.', validation },
      { status: 400 },
    )
  }

  // Crear el draft inicial (RESEARCHING) que la UI verá de inmediato.
  let draftId: string
  try {
    draftId = await createCredibleFearV7Draft(caseId, user.id, service)
  } catch (err) {
    log.error('no se pudo crear draft v7', { caseId, err: String(err) })
    return NextResponse.json({ error: 'No se pudo iniciar la generación' }, { status: 500 })
  }

  await logActivity({
    caseId,
    category: 'system',
    subcategory: 'system.credible_fear_v7_started',
    description: 'Miedo Creíble v7 (Memorándum Legal) — generación iniciada',
    metadata: { draft_id: draftId },
    visibleToClient: false,
    actor: { kind: 'session', supabase },
    client: service,
  }).catch(() => {})

  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const hasQStash = Boolean(process.env.QSTASH_TOKEN)

  if (hasQStash && host) {
    try {
      await enqueueJob({
        endpoint: `${proto}://${host}/api/workers/credible-fear-research`,
        body: { caseId, draftId },
        retries: 0,
        deduplicationId: `cf-v7-research:${draftId}`,
      })
      return NextResponse.json({ ok: true, queued: true, draft_id: draftId, status: 'RESEARCHING' })
    } catch (err) {
      log.error('enqueue research worker failed — fallback a after()', { caseId, err: String(err) })
      // cae al fallback de abajo
    }
  }

  // Fallback (dev sin QStash o enqueue falló): corre el pipeline en background.
  after(async () => {
    const bgService = createServiceClient()
    const r = await runResearchPhase({ caseId, draftId, service: bgService })
    if (r.status === 'DRAFTING') {
      await runDraftPhase({ caseId, draftId, service: bgService })
    }
  })
  return NextResponse.json({ ok: true, queued: true, draft_id: draftId, status: 'RESEARCHING' })
}
