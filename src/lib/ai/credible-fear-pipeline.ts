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
import { CLAUDE_MODEL, type UsageStats } from './anthropic-client'
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

    // Fases 2 y 3 — jurisprudencia (web_search) y noticias (Tavily) son
    // independientes entre sí: corren EN PARALELO para que el Worker A quepa en
    // el límite de 300s de Vercel (tiempo ≈ análisis + max(juris, noticias) en
    // vez de la suma). Cada una falla de forma aislada y devuelve vacío.
    const [juris, news] = await Promise.all([
      researchAsylumJurisprudence(ctx),
      buildNewsAppendix(country, persecutionType),
    ])

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
// Fase B — draft (brief seccionado por GRUPOS + cronología + ensamblaje)
// ──────────────────────────────────────────────────────────────────

// La redacción (10 secciones densas, ~40-60 págs) se parte en GRUPOS pequeños.
// Un worker procesa un grupo y se re-encola para el siguiente (self-chaining),
// de modo que cada invocación cabe holgada en el límite de tiempo de Vercel sin
// importar el plan. El grupo 0 añade la cronología; el último ensambla todo.
export const SECTION_GROUPS: string[][] = [
  ['I.1', 'I.2'], // grupo 0 (+ cronología)
  ['I.3'], // narrativa larga, sola
  ['I.4', 'I.5'],
  ['I.6'], // nexo, denso
  ['I.7', 'I.8'],
  ['I.9', 'I.10'], // último → ensambla
]

export function isLastDraftGroup(groupIndex: number): boolean {
  return groupIndex >= SECTION_GROUPS.length - 1
}

const ZERO_USAGE: UsageStats = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 }

// 'I.1'..'I.10' en orden NUMÉRICO (localeCompare pondría 'I.10' antes de 'I.2').
function sectionOrder(id: string): number {
  const m = id.match(/I\.(\d+)/)
  return m ? parseInt(m[1], 10) : 999
}

function mergeSections(prev: LegalBriefSection[], next: LegalBriefSection[]): LegalBriefSection[] {
  const byId = new Map<string, LegalBriefSection>()
  for (const s of prev) byId.set(s.section_id, s)
  for (const s of next) byId.set(s.section_id, s) // un reintento sobrescribe la versión previa
  return [...byId.values()].sort((a, b) => sectionOrder(a.section_id) - sectionOrder(b.section_id))
}

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

/**
 * Worker de redacción RE-ENCOLABLE. Procesa SECTION_GROUPS[groupIndex]:
 *  - genera las secciones de ese grupo (y, en el grupo 0, la tabla cronológica),
 *  - las acumula con las ya persistidas y guarda el parcial (sigue DRAFTING),
 *  - si es el último grupo, ensambla TODO el documento y marca DRAFT_COMPLETE.
 * Devuelve `nextGroup` (el índice a encolar) o null si terminó/falló. Cada
 * invocación cabe holgada en el límite de Vercel sin importar el plan.
 */
export async function runDraftGroup(args: {
  caseId: string
  draftId: string
  groupIndex: number
  service: SupabaseClient
}): Promise<{ status: 'DRAFTING' | 'DRAFT_COMPLETE' | 'FAILED'; nextGroup: number | null }> {
  const { caseId, draftId, groupIndex, service } = args
  const sectionIds = SECTION_GROUPS[groupIndex]
  if (!sectionIds) {
    await patchDraft(service, draftId, { status: 'FAILED', generation_error: `Grupo de secciones inválido: ${groupIndex}` })
    return { status: 'FAILED', nextGroup: null }
  }
  try {
    const loaded = await loadDraftCtx(caseId, draftId, service)
    if ('error' in loaded) {
      await patchDraft(service, draftId, { status: 'FAILED', generation_error: loaded.error })
      return { status: 'FAILED', nextGroup: null }
    }
    const { baseInputs, ctx, jurisprudence, news, partialSections, chronoRows, prevTokens } = loaded

    // Secuencial (no Promise.all) para no sumar concurrencia de llamadas a Claude.
    const brief = await generateLegalBrief(baseInputs, ctx, jurisprudence, news, { sectionIds })

    // La cronología se genera una sola vez, en el grupo 0; los demás reusan la persistida.
    const chrono = groupIndex === 0 ? await generateChronology(baseInputs, ctx) : { rows: chronoRows, usage: ZERO_USAGE }

    const sections = mergeSections(partialSections, brief.sections)
    const accTokens = {
      input: prevTokens.input + brief.usage.inputTokens + chrono.usage.inputTokens,
      output: prevTokens.output + brief.usage.outputTokens + chrono.usage.outputTokens,
      cached: prevTokens.cached + brief.usage.cacheReadTokens + chrono.usage.cacheReadTokens,
    }

    if (!isLastDraftGroup(groupIndex)) {
      await patchDraft(service, draftId, {
        legal_brief_json: sections,
        ...(groupIndex === 0 ? { chronology_json: chrono.rows } : {}),
        declaration_input_tokens: accTokens.input,
        declaration_output_tokens: accTokens.output,
        declaration_cached_tokens: accTokens.cached,
      })
      log.info('draft group done', { caseId, draftId, groupIndex, sections: brief.sections.length, total: sections.length })
      return { status: 'DRAFTING', nextGroup: groupIndex + 1 }
    }

    // Último grupo: ensamblar TODO el documento + DRAFT_COMPLETE.
    const bodyMd = assembleMemorandumMarkdown({
      applicantName: baseInputs.applicantMetadata.full_name,
      aNumber: baseInputs.applicantMetadata.a_number,
      todayLabel: formatToday(),
      sections,
      chronology: chrono.rows,
      jurisprudence,
      news,
    })
    const totalWords = sections.reduce((n, s) => n + s.words, 0)

    await service.from(TABLE).update({ is_current: false }).eq('case_id', caseId).eq('is_current', true)

    const finalPatch = {
      status: 'DRAFT_COMPLETE',
      is_current: true,
      legal_brief_json: sections,
      body_md: bodyMd,
      declaration_total_words: totalWords,
      declaration_input_tokens: accTokens.input,
      declaration_output_tokens: accTokens.output,
      declaration_cached_tokens: accTokens.cached,
    }
    // El write terminal NO puede perderse en silencio (reintenta y, si falla, lanza).
    let saved = await patchDraft(service, draftId, finalPatch)
    if (saved.error) {
      saved = await patchDraft(service, draftId, finalPatch)
      if (saved.error) throw new Error(`No se pudo guardar el memorándum final: ${saved.error}`)
    }
    log.info('draft assembled', { caseId, draftId, words: totalWords, sections: sections.length })
    return { status: 'DRAFT_COMPLETE', nextGroup: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.error('draft group threw', { caseId, draftId, groupIndex, err: msg })
    await patchDraft(service, draftId, { status: 'FAILED', generation_error: msg.slice(0, 500) })
    return { status: 'FAILED', nextGroup: null }
  }
}

/** Corre los grupos restantes (desde startIndex) en secuencia, en un solo
 *  proceso. Fallback para dev sin QStash y para cuando el re-encolado falla. */
export async function runAllDraftGroups(args: {
  caseId: string
  draftId: string
  service: SupabaseClient
  startIndex?: number
}): Promise<{ status: 'DRAFT_COMPLETE' | 'FAILED' }> {
  const { caseId, draftId, service } = args
  for (let groupIndex = args.startIndex ?? 0; groupIndex < SECTION_GROUPS.length; groupIndex++) {
    const r = await runDraftGroup({ caseId, draftId, groupIndex, service })
    if (r.status === 'FAILED') return { status: 'FAILED' }
    if (r.status === 'DRAFT_COMPLETE') return { status: 'DRAFT_COMPLETE' }
  }
  return { status: 'DRAFT_COMPLETE' }
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
