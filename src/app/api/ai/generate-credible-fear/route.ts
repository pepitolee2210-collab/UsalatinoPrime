import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  generateCredibleFear,
  CredibleFearGenerationError,
  CREDIBLE_FEAR_PROMPT_VERSION,
} from '@/lib/ai/generate-credible-fear'
import { extractDocumentsForCase } from '@/lib/ai/extract-documents'
import { searchCountryConditions } from '@/lib/ai/web-search-tavily'
import {
  CREDIBLE_FEAR_QUESTIONNAIRE_SLUG,
  type CFAnswers,
  type CFUrlValue,
} from '@/lib/legal/asilo-miedo-creible-form-schema'
import { validateCaseBeforeGeneration } from '@/lib/asylum/validate-case-before-generation'
import { logActivity } from '@/lib/activity/log-activity'
import { createLogger } from '@/lib/logger'
import { isAsylumService } from '@/lib/services/asylum'
import type { Declaration } from '@/lib/ai/credible-fear-schema'
import { CLAUDE_MODEL } from '@/lib/ai/anthropic-client'

const log = createLogger('api:generate-credible-fear')

/**
 * POST /api/ai/generate-credible-fear
 *
 * Body: { case_id: string }
 *
 * Solo admin / paralegal. Genera el JSON estructurado del Miedo Creíble
 * (v5) combinando:
 *   - applicantMetadata: profiles + I-589 Parte A submissions.
 *   - questionnaire M1-M11: case_form_instances con form_name CREDIBLE_FEAR_QUESTIONNAIRE_SLUG.
 *   - uploadedDocuments: documents con extracted_text (todas las categorías
 *     de evidencia, no solo el affidavit que ya retiramos del flow cliente).
 *   - evidence_links: case_evidence_urls + URLs marcadas en M9
 *     (country_evidence_links) + country conditions de Tavily si faltan.
 *
 * Persiste en case_credible_fear_drafts:
 *   - status del output (DRAFT_COMPLETE | GAPS_FOUND | REQUIRES_REVIEW)
 *   - JSONB de cada bloque
 *   - body_md (Markdown renderizado desde declaration_es_json) para que el
 *     preview existente y el endpoint .docx sigan funcionando.
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
        declared_category: dt?.category_code ?? dt?.code ?? 'unknown',
        language: 'es',
        extracted_text: d.extracted_text ?? '',
      }
    })

  // ──────────────────────────────────────────────────────────────────
  // 6. Cargar evidence_links
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

  // URLs marcadas por el cliente en M9 (multi_checkbox de country_evidence_links)
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

  // M9 custom URLs (url_list)
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

  // Tavily (country conditions) — solo si no hay evidencia suficiente.
  const totalLinks = clientEvidenceLinks.length + m9EvidenceLinks.length + m9CustomLinks.length
  let tavilyLinks: Array<{
    url: string
    title: string | null
    source_organization: string | null
    description: string | null
    category: string | null
    scraped_content?: string
  }> = []
  if (totalLinks < 3) {
    try {
      const tavily = await searchCountryConditions(country)
      tavilyLinks = tavily.map((r) => ({
        url: r.url,
        title: r.title,
        source_organization: null,
        description: r.content?.slice(0, 400) ?? null,
        category: 'country_conditions_auto',
        scraped_content: r.content ?? undefined,
      }))
    } catch (err) {
      log.warn('Tavily fallback falló', { country, err: String(err) })
    }
  }

  const evidenceLinks = [...clientEvidenceLinks, ...m9EvidenceLinks, ...m9CustomLinks, ...tavilyLinks]

  // ──────────────────────────────────────────────────────────────────
  // 7. Llamar generador v5
  // ──────────────────────────────────────────────────────────────────
  const t0 = Date.now()
  try {
    const result = await generateCredibleFear({
      applicantMetadata: {
        full_name: fullName || 'Solicitante',
        a_number: caseRow.client?.a_number,
        date_of_birth: caseRow.client?.date_of_birth,
        city_country_of_birth: caseRow.client?.country_of_birth,
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
    })
    const durationMs = Date.now() - t0
    log.info('credible-fear v5 generado', {
      caseId,
      status: result.output.status,
      ...result.usage,
      durationMs,
    })

    // ────────────────────────────────────────────────────────────────
    // 8. Renderizar body_md desde declaration_es_json (compat preview)
    // ────────────────────────────────────────────────────────────────
    const bodyMd = renderDeclarationMarkdown(result.output.declaration_es ?? result.output.declaration_en)

    // ────────────────────────────────────────────────────────────────
    // 9. Persistir draft
    // ────────────────────────────────────────────────────────────────
    if (result.output.status === 'DRAFT_COMPLETE') {
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

    const { data: inserted, error } = await service
      .from('case_credible_fear_drafts')
      .insert({
        case_id: caseId,
        version: nextVersion,
        body_md: bodyMd,
        sources: sourcesForLegacy,
        model_used: result.modelUsed,
        prompt_version: result.promptVersion,
        generated_by: user.id,
        is_current: result.output.status === 'DRAFT_COMPLETE',
        status: result.output.status,
        case_analysis_json: result.output.case_analysis,
        gaps_found_json: result.output.gaps_found ?? [],
        review_required_flags_json: result.output.review_required_flags ?? [],
        declaration_en_json: result.output.declaration_en,
        declaration_es_json: result.output.declaration_es,
        i589_field_values_json: result.output.i589_field_values,
        supplement_b_entries_json: result.output.supplement_b_entries ?? [],
        evidence_index_json: result.output.evidence_index ?? [],
        factual_claims_audit_json: result.output.factual_claims_audit ?? [],
        self_check_json: result.output.self_check,
        input_tokens: result.usage.inputTokens,
        output_tokens: result.usage.outputTokens,
        cached_tokens: result.usage.cacheReadTokens,
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
      subcategory: 'system.credible_fear_generated_v5',
      description: `Miedo Creíble v5 generado (versión ${nextVersion}, status ${result.output.status})`,
      metadata: {
        version: nextVersion,
        status: result.output.status,
        prompt_version: result.promptVersion,
        gaps_count: (result.output.gaps_found ?? []).length,
        review_flags_count: (result.output.review_required_flags ?? []).length,
        input_tokens: result.usage.inputTokens,
        output_tokens: result.usage.outputTokens,
        cached_tokens: result.usage.cacheReadTokens,
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
      output: result.output,
    })
  } catch (err) {
    if (err instanceof CredibleFearGenerationError) {
      log.error('Generación falló por output inválido — persistiendo como REQUIRES_REVIEW', {
        caseId,
        message: err.message,
      })
      // Persistir un draft con status REQUIRES_REVIEW. Guardamos el raw output
      // dentro de body_md envuelto con cabecera para que Diana pueda revisarlo,
      // editarlo a mano y usarlo como punto de partida — el .docx generado
      // desde este draft NO sale en blanco. Truncamos a 80k chars para no
      // explotar la fila (Claude rara vez produce >50k).
      const rawTruncated = err.raw.slice(0, 80_000)
      const reviewBody = [
        '# OUTPUT REQUIERE REVISIÓN MANUAL',
        '',
        'La IA devolvió un JSON que no satisface el schema esperado para esta versión del prompt.',
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
            { flag_type: 'inconsistency', details: `Output inválido: ${err.message}` },
          ],
          input_tokens: err.usage.inputTokens,
          output_tokens: err.usage.outputTokens,
          cached_tokens: err.usage.cacheReadTokens,
        })
      return NextResponse.json(
        {
          ok: false,
          status: 'REQUIRES_REVIEW',
          error: 'La IA devolvió un output inválido. La firma revisará manualmente.',
        },
        { status: 422 },
      )
    }
    log.error('Error inesperado generando Miedo Creíble', { caseId, err: String(err) })
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}

/**
 * Renderiza una Declaration JSON como Markdown legible para el preview
 * en el portal cliente y la descarga .docx existente.
 */
function renderDeclarationMarkdown(d: Declaration | null | undefined): string {
  if (!d) return ''
  const lines: string[] = []
  lines.push(`# ${d.title}`)
  lines.push('')
  lines.push(d.applicant_full_name_uppercase)
  lines.push('')
  lines.push(d.opening_statement)
  lines.push('')
  for (const section of d.sections) {
    lines.push(`## ${section.heading}`)
    lines.push('')
    for (const p of section.paragraphs) {
      lines.push(`${p.number}. ${p.text}`)
      lines.push('')
    }
  }
  lines.push(d.closing_attestation)
  lines.push('')
  lines.push(d.signature_line)
  lines.push(d.date_line)
  return lines.join('\n').trim()
}
