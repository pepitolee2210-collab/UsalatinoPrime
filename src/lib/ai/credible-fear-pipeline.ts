// Pipeline del Miedo Creíble v7 — lógica compartida por los workers async y el
// fallback síncrono (dev sin QStash). Dos fases encadenadas:
//
//   runResearchPhase  (Worker A): análisis E1-E8 + jurisprudencia + noticias.
//                                 status RESEARCHING → DRAFTING | GAPS_FOUND | FAILED
//   runDraftPhase     (Worker B): brief seccionado + cronología + ensamblaje.
//                                 status DRAFTING → DRAFT_COMPLETE | FAILED
//
// El estado vive en case_credible_fear_drafts.status (la UI lo poolea).

import type { SupabaseClient } from '@supabase/supabase-js'
import { CLAUDE_MODEL } from './anthropic-client'
import { collectCredibleFearInputs } from './collect-credible-fear-inputs'
import { generateAsylumAnalysis } from './generate-credible-fear'
import { researchAsylumJurisprudence } from './research-asylum-jurisprudence'
import { buildNewsAppendix } from './build-news-appendix'
import {
  generateLegalBrief,
  generateChronology,
  assembleMemorandumMarkdown,
} from './generate-legal-memorandum'
import { CF_V7_PROMPT_VERSION, type V7CaseContext } from './credible-fear-prompt-v7'
import type {
  CaseAnalysis,
  JurisprudenceCase,
  NewsAppendixItem,
  LegalBriefSection,
  ChronologyRow,
} from './credible-fear-schema'
import { createLogger } from '@/lib/logger'

const log = createLogger('credible-fear-pipeline')

const TABLE = 'case_credible_fear_drafts'

// ──────────────────────────────────────────────────────────────────
// Crear el draft inicial (status RESEARCHING) — llamado por el orquestador
// ──────────────────────────────────────────────────────────────────

export async function createCredibleFearV7Draft(
  caseId: string,
  userId: string,
  service: SupabaseClient,
): Promise<string> {
  const { data: lastVer } = await service
    .from(TABLE)
    .select('version')
    .eq('case_id', caseId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextVersion = ((lastVer?.version as number | undefined) ?? 0) + 1

  const { data, error } = await service
    .from(TABLE)
    .insert({
      case_id: caseId,
      version: nextVersion,
      body_md: '⏳ Generando memorándum legal (investigando jurisprudencia y condiciones de país)…',
      sources: [],
      model_used: CLAUDE_MODEL,
      prompt_version: CF_V7_PROMPT_VERSION,
      generated_by: userId,
      is_current: false,
      status: 'RESEARCHING',
    })
    .select('id')
    .single()
  if (error || !data) {
    throw new Error(`No se pudo crear el draft v7: ${error?.message ?? 'sin id'}`)
  }
  return data.id as string
}

async function patchDraft(service: SupabaseClient, draftId: string, patch: Record<string, unknown>): Promise<{ error: string | null }> {
  const { error } = await service.from(TABLE).update(patch).eq('id', draftId)
  if (error) {
    log.error('patchDraft failed', { draftId, err: error.message })
    return { error: error.message }
  }
  return { error: null }
}

// ──────────────────────────────────────────────────────────────────
// Fase A — research (análisis + jurisprudencia + noticias)
// ──────────────────────────────────────────────────────────────────

export async function runResearchPhase(args: {
  caseId: string
  draftId: string
  service: SupabaseClient
}): Promise<{ status: 'DRAFTING' | 'GAPS_FOUND' | 'FAILED' }> {
  const { caseId, draftId, service } = args
  try {
    const collected = await collectCredibleFearInputs(caseId, service)
    if (!collected.ok) {
      await patchDraft(service, draftId, { status: 'FAILED', generation_error: collected.error })
      return { status: 'FAILED' }
    }
    const { baseInputs, country, persecutionType, protectedGrounds } = collected.data

    // Fase 1 — análisis E1-E8 (reusa el motor v6)
    const analysis = await generateAsylumAnalysis(baseInputs)
    if (analysis.output.status === 'GAPS_FOUND') {
      await patchDraft(service, draftId, {
        status: 'GAPS_FOUND',
        case_analysis_json: analysis.output.case_analysis,
        gaps_found_json: analysis.output.gaps_found ?? [],
        review_required_flags_json: analysis.output.review_required_flags ?? [],
        self_check_json: analysis.output.self_check,
        body_md: renderGapsMarkdown(analysis.output.gaps_found ?? []),
        analysis_input_tokens: analysis.usage.inputTokens,
        analysis_output_tokens: analysis.usage.outputTokens,
        analysis_cached_tokens: analysis.usage.cacheReadTokens,
      })
      return { status: 'GAPS_FOUND' }
    }

    const ctx: V7CaseContext = {
      nationality: country,
      persecutionType,
      protectedGrounds,
      analysisJson: JSON.stringify(analysis.output.case_analysis),
      caseSummary: buildCaseSummary(analysis.output.case_analysis),
    }

    // Fase 2 — jurisprudencia (web_search + verificación de links)
    const juris = await researchAsylumJurisprudence(ctx)
    // Fase 3 — noticias verificadas con carátula
    const news = await buildNewsAppendix(country, persecutionType)

    await patchDraft(service, draftId, {
      status: 'DRAFTING',
      case_analysis_json: analysis.output.case_analysis,
      gaps_found_json: analysis.output.gaps_found ?? [],
      review_required_flags_json: analysis.output.review_required_flags ?? [],
      i589_field_values_json: analysis.output.i589_field_values,
      supplement_b_entries_json: analysis.output.supplement_b_entries ?? [],
      evidence_index_json: analysis.output.evidence_index ?? [],
      factual_claims_audit_json: analysis.output.factual_claims_audit_seed ?? [],
      self_check_json: analysis.output.self_check,
      jurisprudence_json: juris.cases,
      news_appendix_json: news.items,
      analysis_input_tokens: analysis.usage.inputTokens,
      analysis_output_tokens: analysis.usage.outputTokens,
      analysis_cached_tokens: analysis.usage.cacheReadTokens,
    })
    log.info('research phase done', { caseId, draftId, cases: juris.cases.length, news: news.items.length })
    return { status: 'DRAFTING' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.error('research phase threw', { caseId, draftId, err: msg })
    await patchDraft(service, draftId, { status: 'FAILED', generation_error: msg.slice(0, 500) })
    return { status: 'FAILED' }
  }
}

// ──────────────────────────────────────────────────────────────────
// Fase B — draft (brief seccionado + cronología + ensamblaje)
// ──────────────────────────────────────────────────────────────────

// La redacción se parte en 2 sub-fases (2 workers) para no exceder el límite de
// tiempo de Vercel: cada worker genera ~2-3 secciones densas.
const BRIEF_SECTIONS_P1 = ['I.1', 'I.2', 'I.3']
const BRIEF_SECTIONS_P2 = ['I.4', 'I.5']

async function loadDraftCtx(caseId: string, draftId: string, service: SupabaseClient) {
  const collected = await collectCredibleFearInputs(caseId, service)
  if (!collected.ok) return { error: collected.error } as const
  const { baseInputs, country, persecutionType, protectedGrounds } = collected.data
  const { data: draft } = await service
    .from(TABLE)
    .select('case_analysis_json, jurisprudence_json, news_appendix_json, legal_brief_json, chronology_json, declaration_input_tokens, declaration_output_tokens, declaration_cached_tokens')
    .eq('id', draftId)
    .single()
  const caseAnalysis = (draft?.case_analysis_json ?? {}) as CaseAnalysis
  const ctx: V7CaseContext = {
    nationality: country,
    persecutionType,
    protectedGrounds,
    analysisJson: JSON.stringify(caseAnalysis),
    caseSummary: buildCaseSummary(caseAnalysis),
  }
  return {
    baseInputs,
    ctx,
    jurisprudence: (draft?.jurisprudence_json ?? []) as JurisprudenceCase[],
    news: (draft?.news_appendix_json ?? []) as NewsAppendixItem[],
    partialSections: (draft?.legal_brief_json ?? []) as LegalBriefSection[],
    chronoRows: (draft?.chronology_json ?? []) as ChronologyRow[],
    prevTokens: {
      input: (draft?.declaration_input_tokens as number | null) ?? 0,
      output: (draft?.declaration_output_tokens as number | null) ?? 0,
      cached: (draft?.declaration_cached_tokens as number | null) ?? 0,
    },
  } as const
}

/** Worker B1: secciones I.1-I.3 del brief + tabla cronológica. Persiste parcial
 *  (status sigue DRAFTING) y deja que el caller encole el Worker B2. */
export async function runDraftPhase1(args: {
  caseId: string
  draftId: string
  service: SupabaseClient
}): Promise<{ status: 'DRAFTING' | 'FAILED' }> {
  const { caseId, draftId, service } = args
  try {
    const loaded = await loadDraftCtx(caseId, draftId, service)
    if ('error' in loaded) {
      await patchDraft(service, draftId, { status: 'FAILED', generation_error: loaded.error })
      return { status: 'FAILED' }
    }
    const { baseInputs, ctx, jurisprudence, news } = loaded
    const [brief, chrono] = await Promise.all([
      generateLegalBrief(baseInputs, ctx, jurisprudence, news, { sectionIds: BRIEF_SECTIONS_P1 }),
      generateChronology(baseInputs, ctx),
    ])
    await patchDraft(service, draftId, {
      legal_brief_json: brief.sections,
      chronology_json: chrono.rows,
      declaration_input_tokens: brief.usage.inputTokens + chrono.usage.inputTokens,
      declaration_output_tokens: brief.usage.outputTokens + chrono.usage.outputTokens,
      declaration_cached_tokens: brief.usage.cacheReadTokens + chrono.usage.cacheReadTokens,
    })
    log.info('draft phase 1 done', { caseId, draftId, sections: brief.sections.length, chrono: chrono.rows.length })
    return { status: 'DRAFTING' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.error('draft phase 1 threw', { caseId, draftId, err: msg })
    await patchDraft(service, draftId, { status: 'FAILED', generation_error: msg.slice(0, 500) })
    return { status: 'FAILED' }
  }
}

/** Worker B2: secciones I.4-I.5, ensambla TODO el documento y persiste DRAFT_COMPLETE. */
export async function runDraftPhase2(args: {
  caseId: string
  draftId: string
  service: SupabaseClient
}): Promise<{ status: 'DRAFT_COMPLETE' | 'FAILED' }> {
  const { caseId, draftId, service } = args
  try {
    const loaded = await loadDraftCtx(caseId, draftId, service)
    if ('error' in loaded) {
      await patchDraft(service, draftId, { status: 'FAILED', generation_error: loaded.error })
      return { status: 'FAILED' }
    }
    const { baseInputs, ctx, jurisprudence, news, partialSections, chronoRows, prevTokens } = loaded

    const brief2 = await generateLegalBrief(baseInputs, ctx, jurisprudence, news, { sectionIds: BRIEF_SECTIONS_P2 })
    const allSections = [...partialSections, ...brief2.sections].sort((a, b) => a.section_id.localeCompare(b.section_id))

    const bodyMd = assembleMemorandumMarkdown({
      applicantName: baseInputs.applicantMetadata.full_name,
      aNumber: baseInputs.applicantMetadata.a_number,
      todayLabel: formatToday(),
      sections: allSections,
      chronology: chronoRows,
      jurisprudence,
      news,
    })
    const totalWords = allSections.reduce((n, s) => n + s.words, 0)

    await service.from(TABLE).update({ is_current: false }).eq('case_id', caseId).eq('is_current', true)

    const finalPatch = {
      status: 'DRAFT_COMPLETE',
      is_current: true,
      legal_brief_json: allSections,
      body_md: bodyMd,
      declaration_total_words: totalWords,
      declaration_input_tokens: prevTokens.input + brief2.usage.inputTokens,
      declaration_output_tokens: prevTokens.output + brief2.usage.outputTokens,
      declaration_cached_tokens: prevTokens.cached + brief2.usage.cacheReadTokens,
    }
    // El write terminal NO puede perderse en silencio (reintenta y, si falla, lanza).
    let saved = await patchDraft(service, draftId, finalPatch)
    if (saved.error) {
      saved = await patchDraft(service, draftId, finalPatch)
      if (saved.error) throw new Error(`No se pudo guardar el memorándum final: ${saved.error}`)
    }
    log.info('draft phase 2 done', { caseId, draftId, words: totalWords })
    return { status: 'DRAFT_COMPLETE' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.error('draft phase 2 threw', { caseId, draftId, err: msg })
    await patchDraft(service, draftId, { status: 'FAILED', generation_error: msg.slice(0, 500) })
    return { status: 'FAILED' }
  }
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function buildCaseSummary(a: CaseAnalysis): string {
  const parts: string[] = []
  if (a.protected_grounds_identified_by_applicant?.length) {
    parts.push(`Protected grounds: ${a.protected_grounds_identified_by_applicant.join(', ')}.`)
  }
  if (a.psg_articulated_by_applicant) parts.push(`Particular social group: ${a.psg_articulated_by_applicant}.`)
  if (a.primary_perpetrator_name) parts.push(`Primary perpetrator: ${a.primary_perpetrator_name} (${a.primary_perpetrator_type}).`)
  parts.push(`Government role: ${a.government_role}.`)
  if (a.first_incident_date_approx) parts.push(`First incident ~${a.first_incident_date_approx}.`)
  if (a.last_incident_date_approx) parts.push(`Last incident ~${a.last_incident_date_approx}.`)
  if (a.case_strength_indicators?.length) parts.push(`Strengths: ${a.case_strength_indicators.join('; ')}.`)
  return parts.join(' ')
}

function renderGapsMarkdown(gaps: Array<{ element: string; missing_or_thin: string; clarifying_question_for_applicant: string }>): string {
  const L: string[] = ['# Faltan datos para el Memorándum Legal', '']
  L.push('El cuestionario tiene huecos críticos. Pídele al cliente que complete:')
  L.push('')
  for (const g of gaps) {
    L.push(`- **${g.element}** — ${g.missing_or_thin}`)
    if (g.clarifying_question_for_applicant) L.push(`  - Pregunta al cliente: ${g.clarifying_question_for_applicant}`)
  }
  return L.join('\n')
}

function formatToday(): string {
  const d = new Date()
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}
