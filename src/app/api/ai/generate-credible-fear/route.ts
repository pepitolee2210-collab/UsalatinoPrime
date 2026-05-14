import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generateCredibleFear } from '@/lib/ai/generate-credible-fear'
import { extractDocumentsForCase } from '@/lib/ai/extract-documents'
import { logActivity } from '@/lib/activity/log-activity'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:generate-credible-fear')

/**
 * POST /api/ai/generate-credible-fear
 *
 * Body: { case_id: string, force_regenerate?: boolean }
 *
 * Sólo admin/paralegal. Genera el relato de Miedo Creíble combinando:
 *   - profile del cliente (nombre, país)
 *   - `case_form_submissions` / `case_form_instances` (partes 1-5 I-589)
 *   - documento subido con `code='asylum_personal_affidavit'` (texto OCR Gemini)
 *   - URLs de `case_evidence_urls`
 *   - country conditions vía Tavily
 *
 * Persiste el resultado en `case_credible_fear_drafts` con
 * `version=N+1, is_current=true`. Versiones anteriores quedan
 * `is_current=false`.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

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
  if (!caseId) {
    return NextResponse.json({ error: 'case_id requerido' }, { status: 400 })
  }

  // Cargar caso + servicio + cliente
  const { data: caseRow } = await service
    .from('cases')
    .select('id, current_phase, form_data, client_id, service:service_catalog(slug), profile:profiles!cases_client_id_fkey(first_name, last_name, country_of_birth, nationality)')
    .eq('id', caseId)
    .single<{
      id: string
      current_phase: string | null
      form_data: Record<string, unknown> | null
      client_id: string
      service: { slug: string } | { slug: string }[] | null
      profile: {
        first_name: string | null
        last_name: string | null
        country_of_birth: string | null
        nationality: string | null
      } | { first_name: string | null; last_name: string | null; country_of_birth: string | null; nationality: string | null }[] | null
    }>()
  if (!caseRow) {
    return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
  }

  const serviceSlug = Array.isArray(caseRow.service)
    ? caseRow.service[0]?.slug
    : caseRow.service?.slug
  if (serviceSlug !== 'asilo-politico') {
    return NextResponse.json(
      { error: 'Solo aplica a servicio asilo-politico' },
      { status: 400 },
    )
  }

  const profileData = Array.isArray(caseRow.profile) ? caseRow.profile[0] : caseRow.profile
  const applicantName = `${profileData?.first_name ?? ''} ${profileData?.last_name ?? ''}`.trim() || 'Solicitante'
  const country = profileData?.country_of_birth ?? profileData?.nationality ?? ''
  if (!country) {
    return NextResponse.json(
      { error: 'No se conoce el país de origen del solicitante' },
      { status: 400 },
    )
  }

  // Cargar affidavit (documento `asylum_personal_affidavit`) y forzar OCR si no tiene extracted_text.
  await extractDocumentsForCase(caseId).catch((err) => {
    log.warn('extract docs falló (continuando sin OCR)', { caseId, err: String(err) })
  })

  const { data: affidavitDocs } = await service
    .from('documents')
    .select('id, extracted_text, name')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })
  const affidavitText = (affidavitDocs ?? [])
    .map((d) => d.extracted_text)
    .filter(Boolean)
    .join('\n\n---\n\n')
    .slice(0, 12000)

  if (!affidavitText || affidavitText.length < 100) {
    return NextResponse.json(
      { error: 'El cliente aún no ha subido un affidavit con texto extraíble' },
      { status: 400 },
    )
  }

  // Cargar URLs de evidencia
  const { data: urls } = await service
    .from('case_evidence_urls')
    .select('url, title, description, reachable')
    .eq('case_id', caseId)
    .order('added_at', { ascending: true })

  const clientEvidenceUrls = (urls ?? [])
    .filter((u) => u.reachable !== false)
    .map((u) => ({ url: u.url, title: u.title, description: u.description }))

  // I-589 parts 1-5 ya capturadas en form_data o case_form_submissions
  const i589Data: Record<string, unknown> = { ...(caseRow.form_data ?? {}) }

  // Generar (puede tomar 5-15s)
  const result = await generateCredibleFear({
    applicantName,
    country,
    personalAffidavitText: affidavitText,
    clientEvidenceUrls,
    i589Part1to5Data: i589Data,
    language: 'es',
  })

  // Persistir: marcar anteriores como not current y crear nuevo con version=N+1
  await service
    .from('case_credible_fear_drafts')
    .update({ is_current: false })
    .eq('case_id', caseId)
    .eq('is_current', true)

  const { data: lastVer } = await service
    .from('case_credible_fear_drafts')
    .select('version')
    .eq('case_id', caseId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextVersion = (lastVer?.version ?? 0) + 1

  const { data: inserted, error } = await service
    .from('case_credible_fear_drafts')
    .insert({
      case_id: caseId,
      version: nextVersion,
      body_md: result.bodyMarkdown,
      sources: result.sources,
      model_used: result.modelUsed,
      prompt_version: result.promptVersion,
      generated_by: user.id,
      is_current: true,
    })
    .select('id, version, generated_at')
    .single()

  if (error) {
    log.error('error insertando draft', { caseId, error })
    return NextResponse.json({ error: 'Error al guardar el draft' }, { status: 500 })
  }

  await logActivity({
    caseId,
    category: 'system',
    subcategory: 'system.credible_fear_generated',
    description: `Miedo Creíble generado (versión ${nextVersion})`,
    metadata: { version: nextVersion, sources_count: result.sources.length },
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
    sources: result.sources,
  })
}
