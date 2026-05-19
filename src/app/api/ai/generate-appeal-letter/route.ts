import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  generateAppealLetter,
  MissingClientDocumentError,
} from '@/lib/ai/generate-appeal-letter'
import { logActivity } from '@/lib/activity/log-activity'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:generate-appeal-letter')

/**
 * Anthropic con 4 PDFs grandes + thinking adaptive de Opus puede tomar
 * 30-120s. El default de Vercel es 10s — sin bumpear esto el endpoint
 * fallaría con timeout antes de que Claude termine de razonar.
 */
export const maxDuration = 120

/**
 * POST /api/ai/generate-appeal-letter
 *
 * Body: { case_id: string }
 *
 * Solo admin/paralegal. Genera el "Brief / Carta de Apelación" enviando
 * a Claude:
 *   - Pasaporte del cliente            (document_types.code = apelacion_pasaporte)
 *   - Expediente Asilo completo        (apelacion_asilo_completo)
 *   - Auto de Denegación del Juez      (apelacion_denegacion_juez)
 *   - Template PDF (caso Lina Vanegas) en /public/templates/, marcado cacheable
 *
 * Persiste en `case_appeal_letter_drafts` con versionado (is_current único).
 * Audita tokens y latencia para monitorear el costo de Opus + PDFs nativos.
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

  // Generar (puede tomar 30-120s — los PDFs son grandes y Opus piensa)
  let result
  try {
    result = await generateAppealLetter({ caseId, service })
  } catch (err) {
    if (err instanceof MissingClientDocumentError) {
      return NextResponse.json(
        { error: err.message, missingCodes: err.missingCodes },
        { status: 400 },
      )
    }
    const msg = err instanceof Error ? err.message : String(err)
    log.error('error generando carta', { caseId, err: msg })
    return NextResponse.json(
      { error: 'Error al generar la carta de apelación', detail: msg },
      { status: 500 },
    )
  }

  // Persistir con versionado: marcar previas como NOT current, insert version=N+1
  await service
    .from('case_appeal_letter_drafts')
    .update({ is_current: false })
    .eq('case_id', caseId)
    .eq('is_current', true)

  const { data: lastVer } = await service
    .from('case_appeal_letter_drafts')
    .select('version')
    .eq('case_id', caseId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextVersion = (lastVer?.version ?? 0) + 1

  const { data: inserted, error: insertErr } = await service
    .from('case_appeal_letter_drafts')
    .insert({
      case_id: caseId,
      version: nextVersion,
      body_md: result.bodyMarkdown,
      model_used: result.modelUsed,
      prompt_version: result.promptVersion,
      generated_by: user.id,
      is_current: true,
      input_tokens: result.usage.inputTokens,
      output_tokens: result.usage.outputTokens,
      cache_read_tokens: result.usage.cacheReadTokens,
      cache_creation_tokens: result.usage.cacheCreationTokens,
      generation_seconds: result.generationSeconds,
    })
    .select('id, version, generated_at')
    .single()

  if (insertErr || !inserted) {
    log.error('error insertando draft', { caseId, error: insertErr })
    return NextResponse.json({ error: 'Error al guardar el draft' }, { status: 500 })
  }

  await logActivity({
    caseId,
    category: 'system',
    subcategory: 'system.appeal_letter_generated',
    description: `Carta de Apelación generada con IA (versión ${nextVersion}, ${result.generationSeconds.toFixed(1)}s)`,
    metadata: {
      version: nextVersion,
      input_tokens: result.usage.inputTokens,
      output_tokens: result.usage.outputTokens,
      cache_read_tokens: result.usage.cacheReadTokens,
      generation_seconds: result.generationSeconds,
      documents_used: result.documentsUsed.map((d) => d.code),
    },
    visibleToClient: false,
    actor: { kind: 'session', supabase },
    client: service,
  })

  return NextResponse.json({
    ok: true,
    draft_id: inserted.id,
    version: inserted.version,
    generated_at: inserted.generated_at,
    body_md: result.bodyMarkdown,
    usage: result.usage,
    generation_seconds: result.generationSeconds,
  })
}
