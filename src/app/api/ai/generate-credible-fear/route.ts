import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  generateAsylumAnalysis,
  generateAsylumDeclaration,
  CredibleFearGenerationError,
  CREDIBLE_FEAR_PROMPT_VERSION,
} from '@/lib/ai/generate-credible-fear'
import { extractDocumentsForCase } from '@/lib/ai/extract-documents'
import { searchCountryConditions, type AsylumPersecutionType } from '@/lib/ai/web-search-tavily'
import {
  CREDIBLE_FEAR_QUESTIONNAIRE_SLUG,
  type CFAnswers,
  type CFUrlValue,
} from '@/lib/legal/asilo-miedo-creible-form-schema'
import { validateCaseBeforeGeneration } from '@/lib/asylum/validate-case-before-generation'
import { logActivity } from '@/lib/activity/log-activity'
import { createLogger } from '@/lib/logger'
import { isAsylumService } from '@/lib/services/asylum'
import type { DeclarationV6 } from '@/lib/ai/credible-fear-schema'
import { CLAUDE_MODEL } from '@/lib/ai/anthropic-client'

const log = createLogger('api:generate-credible-fear')

/**
 * POST /api/ai/generate-credible-fear
 *
 * Body: { case_id: string }
 *
 * Solo admin / paralegal. Genera el Miedo Creíble v6 en DOS llamadas a
 * Claude Opus 4.7 (split necesario por el 16k output cap):
 *
 *   1. Análisis estructurado (case_analysis, i589_field_values, supplement_b,
 *      evidence_index, factual_claims_seed, self_check). ~30-60s.
 *
 *   2. Declaración detallada en español (estructura I-VI, 3000-5000 palabras
 *      con URLs citadas y datos estadísticos del país). ~90-180s.
 *
 * Si la llamada 1 devuelve GAPS_FOUND no se hace la llamada 2 (no hay
 * sustento para declaración).
 *
 * Persiste en `case_credible_fear_drafts` con:
 *   - JSONB columns del schema v6 (analysis + declaration mergeados)
 *   - body_md renderizado para preview / .docx legacy
 *   - tokens separados de las 2 llamadas (analysis_*_tokens + declaration_*_tokens)
 *   - cited_urls_in_body_json para auditar las URLs citadas en sección VI
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

  // ──────────────────────────────────────────────────────────────────
  // 1. Cargar caso + servicio + cliente
  // ──────────────────────────────────────────────────────────────────
  const { data: caseRow } = await service
    .from('cases')
    .select(`
      id,
      current_phase,
      client_id,
      service:service_catalog(slug),
      client:profiles!cases_client_id_fkey(
        first_name,
        last_name,
        middle_name,
        a_number,
        date_of_birth,
        country_of_birth,
        nationality,
        last_entry_date,
        marital_status,
        preferred_language,
        address_street,
        address_city,
        address_state,
        address_zip
      )
    `)
    .eq('id', caseId)
    .single<{
      id: string
      current_phase: string | null
      client_id: string
      service: { slug: string } | { slug: string }[] | null
      client: {
        first_name: string | null
        last_name: string | null
        middle_name: string | null
        a_number: string | null
        date_of_birth: string | null
        country_of_birth: string | null
        nationality: string | null
        last_entry_date: string | null
        marital_status: string | null
        preferred_language: string | null
        address_street: string | null
        address_city: string | null
        address_state: string | null
        address_zip: string | null
      } | null
    }>()
  if (!caseRow) {
    return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
  }

  const serviceSlug = Array.isArray(caseRow.service)
    ? caseRow.service[0]?.slug
    : caseRow.service?.slug
  if (!isAsylumService(serviceSlug)) {
    return NextResponse.json(
      { error: 'Solo aplica a Asilo Político (asilo-politico, reforzar-asilo)' },
      { status: 400 },
    )
  }

  const country = caseRow.client?.country_of_birth ?? caseRow.client?.nationality ?? ''
  if (!country) {
    return NextResponse.json(
      { error: 'No se conoce el país de origen del solicitante' },
      { status: 400 },
    )
  }

  // ──────────────────────────────────────────────────────────────────
  // 2. Validación pre-generación
  // ──────────────────────────────────────────────────────────────────
  const validation = await validateCaseBeforeGeneration(service, caseId)
  if (!validation.ready) {
    return NextResponse.json(
      {
        error: 'El caso aún no está listo para generar el Miedo Creíble.',
        validation,
      },
      { status: 400 },
    )
  }

  // ──────────────────────────────────────────────────────────────────
  // 3. Cargar cuestionario M1-M11
  // ──────────────────────────────────────────────────────────────────
  const { data: questionnaire } = await service
    .from('case_form_instances')
    .select('filled_values, client_submitted_at')
    .eq('case_id', caseId)
    .eq('form_name', CREDIBLE_FEAR_QUESTIONNAIRE_SLUG)
    .maybeSingle()
  const answers = (questionnaire?.filled_values as CFAnswers | undefined) ?? {}

  const countryFromQuestionnaire = typeof answers['m2_country_of_birth'] === 'string'
    ? (answers['m2_country_of_birth'] as string)
    : null
  const effectiveCountry = countryFromQuestionnaire || country

  // Derivar tipo de persecución de M3 grounds para query de Tavily más relevante
  const grounds = Array.isArray(answers['m3_grounds']) ? (answers['m3_grounds'] as string[]) : []
  const persecutionType: AsylumPersecutionType = grounds.includes('political_opinion')
    ? 'political'
    : grounds.includes('religion')
    ? 'religious'
    : grounds.includes('particular_social_group') && /\blgbt|gay|lesbi|trans/i.test(JSON.stringify(answers).slice(0, 8000))
    ? 'lgbtq'
    : grounds.includes('particular_social_group') && /\bgang|pandilla|tren de aragua|mara/i.test(JSON.stringify(answers).slice(0, 8000))
    ? 'gang'
    : grounds.includes('particular_social_group') && /\bmujer|gender|violenc.*domestic|domestic violence/i.test(JSON.stringify(answers).slice(0, 8000))
    ? 'gender_violence'
    : 'general'

  // ──────────────────────────────────────────────────────────────────
  // 4. Cargar I-589 Parte A submissions (para applicantMetadata)
  // ──────────────────────────────────────────────────────────────────
  const { data: i589Subs } = await service
    .from('case_form_submissions')
    .select('form_type, form_data')
    .eq('case_id', caseId)
    .in('form_type', ['i589_part_a1', 'i589_part_a2', 'i589_part_a3', 'i589_part_a4'])
    .eq('minor_index', 0)
    .returns<{ form_type: string; form_data: Record<string, unknown> | null }[]>()

  const i589Merged: Record<string, unknown> = {}
  for (const s of i589Subs ?? []) {
    Object.assign(i589Merged, s.form_data ?? {})
  }

  const fullName = [caseRow.client?.first_name, caseRow.client?.middle_name, caseRow.client?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim()
  const dateEnteredUs =
    (typeof i589Merged.date_entered_us === 'string' ? i589Merged.date_entered_us : null) ??
    caseRow.client?.last_entry_date ??
    null
  const daysSinceEntry = dateEnteredUs
    ? Math.floor((Date.now() - new Date(dateEnteredUs).getTime()) / 86_400_000)
    : null

  // ──────────────────────────────────────────────────────────────────
  // 5. Cargar documentos OCRed
  // ──────────────────────────────────────────────────────────────────
  await extractDocumentsForCase(caseId).catch((err) => {
    log.warn('extract docs falló (continuando)', { caseId, err: String(err) })
  })

  const { data: docs } = await service
    .from('documents')
    .select(`
      id,
      file_name,
      extracted_text,
      document_type:document_types(code, name_es, category_code)
    `)
    .eq('case_id', caseId)
    .order('created_at', { ascending: true })
    .returns<{
      id: string
      file_name: string | null
      extracted_text: string | null
      document_type: { code: string; name_es: string; category_code: string } | { code: string; name_es: string; category_code: string }[] | null
    }[]>()

  const uploadedDocuments = (docs ?? [])
    .filter((d) => d.extracted_text && d.extracted_text.length > 50)
    .map((d) => {
      const dt = Array.isArray(d.document_type) ? d.document_type[0] : d.document_type
      return {
        document_id: d.id,
        filename: d.file_name ?? '(sin nombre)',
        declared_category: dt?.code ?? dt?.category_code ?? 'unknown',
        language: 'es',
        extracted_text: d.extracted_text ?? '',
      }
    })

  // ──────────────────────────────────────────────────────────────────
  // 6. Cargar evidence_links (cliente + M9 + Tavily)
  // ──────────────────────────────────────────────────────────────────
  const { data: clientUrls } = await service
    .from('case_evidence_urls')
    .select('url, title, description, source_domain')
    .eq('case_id', caseId)
    .order('added_at', { ascending: true })

  const clientEvidenceLinks = (clientUrls ?? []).map((u) => ({
    url: u.url,
    title: u.title ?? null,
    source_organization: u.source_domain ?? null,
    description: u.description ?? null,
    category: 'client_provided',
  }))

  const m9Selected = Array.isArray(answers['m9_prefilled_country_urls'])
    ? (answers['m9_prefilled_country_urls'] as string[])
    : []
  let m9EvidenceLinks: Array<{
    url: string
    title: string | null
    source_organization: string | null
    description: string | null
    category: string | null
  }> = []
  if (m9Selected.length > 0) {
    const { data: m9Rows } = await service
      .from('country_evidence_links')
      .select('url, url_title, source_organization, category')
      .in('url', m9Selected)
    m9EvidenceLinks = (m9Rows ?? []).map((r) => ({
      url: r.url,
      title: r.url_title,
      source_organization: r.source_organization,
      description: null,
      category: r.category,
    }))
  }

  const m9Custom = Array.isArray(answers['m9_custom_urls'])
    ? (answers['m9_custom_urls'] as CFUrlValue[])
    : []
  const m9CustomLinks = m9Custom.map((u) => ({
    url: u.url,
    title: u.title ?? null,
    source_organization: null,
    description: u.category ?? null,
    category: u.category ?? 'other',
  }))

  // Tavily: siempre buscar country conditions con persecutionType para enriquecer
  // el prompt v6 con casos emblemáticos y datos estadísticos actuales del país.
  let tavilyLinks: Array<{
    url: string
    title: string | null
    source_organization: string | null
    description: string | null
    category: string | null
    scraped_content?: string
  }> = []
  try {
    const tavily = await searchCountryConditions(effectiveCountry, { persecutionType, maxResults: 8 })
    tavilyLinks = tavily.map((r) => ({
      url: r.url,
      title: r.title,
      source_organization: null,
      description: r.content?.slice(0, 400) ?? null,
      category: 'country_conditions_auto',
      scraped_content: r.content ?? undefined,
    }))
  } catch (err) {
    log.warn('Tavily fallback falló', { country: effectiveCountry, persecutionType, err: String(err) })
  }

  const evidenceLinks = [...clientEvidenceLinks, ...m9EvidenceLinks, ...m9CustomLinks, ...tavilyLinks]

  // ──────────────────────────────────────────────────────────────────
  // 7. Llamada 1 + Llamada 2 IA
  // ──────────────────────────────────────────────────────────────────
  const tStart = Date.now()
  const baseInputs = {
    applicantMetadata: {
      full_name: fullName || 'Solicitante',
      a_number: caseRow.client?.a_number,
      date_of_birth: caseRow.client?.date_of_birth,
      city_country_of_birth: countryFromQuestionnaire || caseRow.client?.country_of_birth,
      current_nationality: caseRow.client?.nationality,
      date_entered_us: dateEnteredUs,
      port_of_entry: typeof i589Merged.port_of_entry === 'string' ? i589Merged.port_of_entry : null,
      days_since_entry: daysSinceEntry,
      marital_status: caseRow.client?.marital_status,
      current_us_address: [
        caseRow.client?.address_street,
        caseRow.client?.address_city,
        caseRow.client?.address_state,
        caseRow.client?.address_zip,
      ]
        .filter(Boolean)
        .join(', ') || null,
      native_language: caseRow.client?.preferred_language ?? 'es',
    },
    questionnaireResponsesJson: answers as Record<string, unknown>,
    uploadedDocuments,
    evidenceLinks,
  }

  try {
    // ─── Llamada 1: análisis ──────────────────────────────────────
    const analysisResult = await generateAsylumAnalysis(baseInputs)
    const analysisDurationMs = Date.now() - tStart
    log.info('credible-fear v6 analysis OK', {
      caseId,
      status: analysisResult.output.status,
      ...analysisResult.usage,
      analysisDurationMs,
    })

    // Si hay GAPS_FOUND, no hace falta la segunda llamada (no hay sustento).
    if (analysisResult.output.status === 'GAPS_FOUND') {
      return await persistAndReturn({
        service,
        caseId,
        userId: user.id,
        supabase,
        analysisOutput: analysisResult.output,
        declarationOutput: null,
        analysisUsage: analysisResult.usage,
        declarationUsage: null,
        evidenceLinks,
      })
    }

    // ─── Llamada 2: declaración ───────────────────────────────────
    const declarationResult = await generateAsylumDeclaration({
      ...baseInputs,
      analysisJson: analysisResult.raw,
    })
    const totalDurationMs = Date.now() - tStart
    log.info('credible-fear v6 declaration OK', {
      caseId,
      ...declarationResult.usage,
      totalDurationMs,
    })

    return await persistAndReturn({
      service,
      caseId,
      userId: user.id,
      supabase,
      analysisOutput: analysisResult.output,
      declarationOutput: declarationResult.output,
      analysisUsage: analysisResult.usage,
      declarationUsage: declarationResult.usage,
      evidenceLinks,
    })
  } catch (err) {
    if (err instanceof CredibleFearGenerationError) {
      log.error('Generación falló por output inválido', {
        caseId,
        phase: err.phase,
        message: err.message,
      })
      const rawTruncated = err.raw.slice(0, 80_000)
      const reviewBody = [
        '# OUTPUT REQUIERE REVISIÓN MANUAL',
        '',
        `La IA devolvió un JSON que no satisface el schema esperado en la fase **${err.phase}**.`,
        '',
        `**Razón técnica:** ${err.message}`,
        '',
        '> Diana / Henry: pueden usar el texto crudo de abajo como punto de partida y editar lo necesario,',
        '> o ajustar el cuestionario del cliente (faltó algún dato crítico) y volver a generar.',
        '',
        '---',
        '',
        '## Output crudo de la IA',
        '',
        '```',
        rawTruncated,
        '```',
      ].join('\n')

      const { data: lastVer } = await service
        .from('case_credible_fear_drafts')
        .select('version')
        .eq('case_id', caseId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()
      const nextVersion = (lastVer?.version ?? 0) + 1
      await service
        .from('case_credible_fear_drafts')
        .insert({
          case_id: caseId,
          version: nextVersion,
          body_md: reviewBody,
          sources: [],
          model_used: CLAUDE_MODEL,
          prompt_version: CREDIBLE_FEAR_PROMPT_VERSION,
          generated_by: user.id,
          is_current: false,
          status: 'REQUIRES_REVIEW',
          review_required_flags_json: [
            { flag_type: 'inconsistency', details: `Output inválido en fase ${err.phase}: ${err.message}` },
          ],
          input_tokens: err.usage.inputTokens,
          output_tokens: err.usage.outputTokens,
          cached_tokens: err.usage.cacheReadTokens,
          ...(err.phase === 'analysis'
            ? {
                analysis_input_tokens: err.usage.inputTokens,
                analysis_output_tokens: err.usage.outputTokens,
                analysis_cached_tokens: err.usage.cacheReadTokens,
              }
            : {
                declaration_input_tokens: err.usage.inputTokens,
                declaration_output_tokens: err.usage.outputTokens,
                declaration_cached_tokens: err.usage.cacheReadTokens,
              }),
        })
      return NextResponse.json(
        {
          ok: false,
          status: 'REQUIRES_REVIEW',
          phase: err.phase,
          error: 'La IA devolvió un output inválido. La firma revisará manualmente.',
        },
        { status: 422 },
      )
    }
    log.error('Error inesperado generando Miedo Creíble', { caseId, err: String(err) })
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}

// ──────────────────────────────────────────────────────────────────
// Persistencia + respuesta
// ──────────────────────────────────────────────────────────────────

async function persistAndReturn(args: {
  service: ReturnType<typeof createServiceClient>
  caseId: string
  userId: string
  supabase: Awaited<ReturnType<typeof createClient>>
  analysisOutput: import('@/lib/ai/credible-fear-schema').AnalysisOutput
  declarationOutput: import('@/lib/ai/credible-fear-schema').DeclarationOutput | null
  analysisUsage: import('@/lib/ai/anthropic-client').UsageStats
  declarationUsage: import('@/lib/ai/anthropic-client').UsageStats | null
  evidenceLinks: Array<{ url: string; title?: string | null }>
}) {
  const {
    service, caseId, userId, supabase,
    analysisOutput, declarationOutput,
    analysisUsage, declarationUsage,
    evidenceLinks,
  } = args

  const declaration = declarationOutput?.declaration_es ?? null
  const bodyMd = renderDeclarationMarkdown(declaration)

  // is_current=true cuando hay declaración poblada (DRAFT_COMPLETE o REQUIRES_REVIEW
  // con declaración). GAPS_FOUND no marca current.
  const willBeCurrent =
    (analysisOutput.status === 'DRAFT_COMPLETE' || analysisOutput.status === 'REQUIRES_REVIEW') &&
    !!declaration

  if (willBeCurrent) {
    await service
      .from('case_credible_fear_drafts')
      .update({ is_current: false })
      .eq('case_id', caseId)
      .eq('is_current', true)
  }

  const { data: lastVer } = await service
    .from('case_credible_fear_drafts')
    .select('version')
    .eq('case_id', caseId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextVersion = (lastVer?.version ?? 0) + 1

  const sourcesForLegacy = evidenceLinks
    .filter((l) => l.url)
    .map((l) => ({ url: l.url, title: l.title ?? l.url }))

  // Suma agregada para columnas legacy `input_tokens`/`output_tokens`.
  const totalInput = analysisUsage.inputTokens + (declarationUsage?.inputTokens ?? 0)
  const totalOutput = analysisUsage.outputTokens + (declarationUsage?.outputTokens ?? 0)
  const totalCached = analysisUsage.cacheReadTokens + (declarationUsage?.cacheReadTokens ?? 0)

  const { data: inserted, error } = await service
    .from('case_credible_fear_drafts')
    .insert({
      case_id: caseId,
      version: nextVersion,
      body_md: bodyMd,
      sources: sourcesForLegacy,
      model_used: CLAUDE_MODEL,
      prompt_version: CREDIBLE_FEAR_PROMPT_VERSION,
      generated_by: userId,
      is_current: willBeCurrent,
      status: analysisOutput.status,
      case_analysis_json: analysisOutput.case_analysis,
      gaps_found_json: analysisOutput.gaps_found ?? [],
      review_required_flags_json: analysisOutput.review_required_flags ?? [],
      // v6: solo declaration_es (sin EN).
      declaration_en_json: null,
      declaration_es_json: declaration,
      i589_field_values_json: analysisOutput.i589_field_values,
      supplement_b_entries_json: analysisOutput.supplement_b_entries ?? [],
      evidence_index_json: analysisOutput.evidence_index ?? [],
      // Audit: usar la versión completa (llamada 2) si está disponible; si no, el seed.
      factual_claims_audit_json:
        declarationOutput?.factual_claims_audit ??
        analysisOutput.factual_claims_audit_seed ??
        [],
      self_check_json: analysisOutput.self_check,
      // Tokens
      input_tokens: totalInput,
      output_tokens: totalOutput,
      cached_tokens: totalCached,
      analysis_input_tokens: analysisUsage.inputTokens,
      analysis_output_tokens: analysisUsage.outputTokens,
      analysis_cached_tokens: analysisUsage.cacheReadTokens,
      declaration_input_tokens: declarationUsage?.inputTokens ?? null,
      declaration_output_tokens: declarationUsage?.outputTokens ?? null,
      declaration_cached_tokens: declarationUsage?.cacheReadTokens ?? null,
      // v6 nuevos
      declaration_total_words: declarationOutput?.declaration_total_words ?? null,
      cited_urls_in_body_json: declarationOutput?.cited_urls_in_body ?? [],
    })
    .select('id, version, generated_at, status')
    .single()
  if (error) {
    log.error('Error insertando draft', { caseId, error })
    return NextResponse.json({ error: 'Error al guardar el draft' }, { status: 500 })
  }

  await logActivity({
    caseId,
    category: 'system',
    subcategory: 'system.credible_fear_generated_v6',
    description: `Miedo Creíble v6 generado (versión ${nextVersion}, status ${analysisOutput.status})`,
    metadata: {
      version: nextVersion,
      status: analysisOutput.status,
      prompt_version: CREDIBLE_FEAR_PROMPT_VERSION,
      declaration_words: declarationOutput?.declaration_total_words ?? 0,
      cited_urls_count: (declarationOutput?.cited_urls_in_body ?? []).length,
      gaps_count: (analysisOutput.gaps_found ?? []).length,
      review_flags_count: (analysisOutput.review_required_flags ?? []).length,
      analysis_input_tokens: analysisUsage.inputTokens,
      analysis_output_tokens: analysisUsage.outputTokens,
      declaration_input_tokens: declarationUsage?.inputTokens,
      declaration_output_tokens: declarationUsage?.outputTokens,
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
    status: inserted.status,
    output: {
      ...analysisOutput,
      declaration_es: declaration,
      cited_urls_in_body: declarationOutput?.cited_urls_in_body ?? [],
      factual_claims_audit: declarationOutput?.factual_claims_audit ?? analysisOutput.factual_claims_audit_seed ?? [],
      declaration_total_words: declarationOutput?.declaration_total_words ?? 0,
    },
  })
}

/**
 * Renderiza una Declaration V6 (estructura I-VI con roman_numeral y subpart)
 * como Markdown legible para el preview en el portal cliente y la descarga
 * .docx existente.
 */
function renderDeclarationMarkdown(d: DeclarationV6 | null | undefined): string {
  if (!d) return ''
  const lines: string[] = []
  lines.push(`# ${d.title}`)
  lines.push('')
  lines.push(d.applicant_full_name_uppercase)
  lines.push('')
  for (const section of d.sections) {
    const subpart = section.subpart ? ` ${section.subpart}` : ''
    lines.push(`## ${section.roman_numeral}${subpart}. ${section.heading}`)
    lines.push('')
    for (const p of section.paragraphs) {
      lines.push(p.text)
      lines.push('')
    }
  }
  lines.push('---')
  lines.push('')
  lines.push(d.closing_attestation)
  lines.push('')
  lines.push(d.signature_line)
  lines.push('')
  lines.push(d.date_line)
  return lines.join('\n').trim()
}
