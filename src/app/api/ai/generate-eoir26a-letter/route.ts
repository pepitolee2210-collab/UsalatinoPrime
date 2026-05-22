import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { enqueueJob } from '@/lib/qstash/client'
import { logActivity } from '@/lib/activity/log-activity'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:generate-eoir26a-letter')

/**
 * POST /api/ai/generate-eoir26a-letter
 *
 * Body: { case_id: string }
 *
 * Solo admin/paralegal. Encola un job en QStash para generar la Carta de
 * Exoneración (fee waiver letter EOIR-26A) con Claude. Devuelve INMEDIATAMENTE
 * el draft_id con status `pending` — el cliente hace polling sobre el endpoint
 * de listado para detectar cuando pasa a `ready` (o `failed`).
 *
 * Por qué async: la carta es corta (~30-60s) pero seguimos el mismo patrón
 * que el appeal letter (QStash + worker) por robustez y consistencia.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const service = createServiceClient()
  const { data: actorProfile } = await service
    .from('profiles')
    .select('role, employee_type')
    .eq('id', user.id)
    .single()
  const isAdmin = actorProfile?.role === 'admin'
  const isParalegal = actorProfile?.role === 'employee' && actorProfile?.employee_type === 'paralegal'
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
  if (!caseId) {
    return NextResponse.json({ error: 'case_id requerido' }, { status: 400 })
  }

  // Validar servicio = apelacion
  const { data: caseRow } = await service
    .from('cases')
    .select('id, current_phase, service:service_catalog(slug)')
    .eq('id', caseId)
    .single<{
      id: string
      current_phase: string | null
      service: { slug: string } | { slug: string }[] | null
    }>()
  if (!caseRow) {
    return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
  }
  const serviceSlug = Array.isArray(caseRow.service)
    ? caseRow.service[0]?.slug
    : caseRow.service?.slug
  if (serviceSlug !== 'apelacion') {
    return NextResponse.json(
      { error: 'Este endpoint solo aplica a casos del servicio Apelación' },
      { status: 400 },
    )
  }

  // Idempotencia: si ya hay un job en curso devolvemos su draft_id en vez
  // de crear uno nuevo.
  const { data: inFlight } = await service
    .from('case_eoir26a_letter_drafts')
    .select('id, status')
    .eq('case_id', caseId)
    .in('status', ['pending', 'generating'])
    .limit(1)
    .maybeSingle()
  if (inFlight) {
    return NextResponse.json(
      {
        ok: true,
        draft_id: inFlight.id,
        status: inFlight.status,
        message: 'Ya hay una generación en curso para este caso',
      },
      { status: 202 },
    )
  }

  // Marcar previas como NOT current, insertar nueva fila pending
  await service
    .from('case_eoir26a_letter_drafts')
    .update({ is_current: false })
    .eq('case_id', caseId)
    .eq('is_current', true)

  const { data: lastVer } = await service
    .from('case_eoir26a_letter_drafts')
    .select('version')
    .eq('case_id', caseId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextVersion = (lastVer?.version ?? 0) + 1

  const { data: inserted, error: insertErr } = await service
    .from('case_eoir26a_letter_drafts')
    .insert({
      case_id: caseId,
      version: nextVersion,
      body_md: '',
      status: 'pending',
      generated_by: user.id,
      is_current: true,
    })
    .select('id, version, generated_at')
    .single()

  if (insertErr || !inserted) {
    log.error('error insertando draft pending', { caseId, error: insertErr })
    return NextResponse.json({ error: 'Error al iniciar la generación' }, { status: 500 })
  }

  // Encolar QStash → worker. Usamos el origin del request actual — QStash
  // necesita una URL HTTPS pública y debe llegar al MISMO deploy que recibió
  // el POST inicial (para que verifyQStashSignature use la misma signing key).
  const workerUrl = `${request.nextUrl.origin}/api/workers/generate-eoir26a-letter`

  try {
    await enqueueJob({
      endpoint: workerUrl,
      body: { draftId: inserted.id, caseId, userId: user.id },
      deduplicationId: `eoir26a-letter-${inserted.id}`,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.error('enqueue QStash falló', { caseId, workerUrl, err: msg })
    await service
      .from('case_eoir26a_letter_drafts')
      .update({ status: 'failed', error_message: `Encolar QStash: ${msg.slice(0, 500)}` })
      .eq('id', inserted.id)
    return NextResponse.json(
      { error: 'Error al encolar el job', detail: msg, workerUrl },
      { status: 500 },
    )
  }

  await logActivity({
    caseId,
    category: 'system',
    subcategory: 'system.eoir26a_letter_enqueued',
    description: `Carta de Exoneración encolada (versión ${nextVersion}, draft ${inserted.id})`,
    metadata: { draft_id: inserted.id, version: nextVersion },
    visibleToClient: false,
    actor: { kind: 'session', supabase },
    client: service,
  })

  return NextResponse.json({
    ok: true,
    draft_id: inserted.id,
    version: inserted.version,
    status: 'pending',
    message: 'Generación iniciada en segundo plano. Tarda 30-60s.',
  })
}
