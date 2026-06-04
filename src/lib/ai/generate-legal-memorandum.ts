// Fases 4-5 del Miedo Creíble v7 — redacción del Legal Brief seccionado,
// la tabla cronológica, y el ENSAMBLAJE del documento final (~20 págs) en
// markdown (body_md), que es la fuente única para preview y Word.

import { jsonrepair } from 'jsonrepair'
import { generateTextWithUsage, type UsageStats } from './anthropic-client'
import type { BuildAnalysisUserPromptInput } from './credible-fear-prompt-v6'
import {
  LEGAL_BRIEF_SECTIONS,
  buildBriefSectionUserPrompt,
  CHRONOLOGY_SYSTEM,
  buildChronologyUserPrompt,
  type V7CaseContext,
} from './credible-fear-prompt-v7'
import {
  chronologyOutputSchema,
  type ChronologyRow,
  type JurisprudenceCase,
  type NewsAppendixItem,
  type LegalBriefSection,
} from './credible-fear-schema'
import { createLogger } from '@/lib/logger'

const log = createLogger('generate-legal-memorandum')

function countWords(s: string): number {
  return (s.trim().match(/\S+/g) ?? []).length
}

// ──────────────────────────────────────────────────────────────────
// Bloques de contexto que se inyectan en los user prompts del brief
// ──────────────────────────────────────────────────────────────────

export function buildVerifiedJurisprudenceBlock(cases: JurisprudenceCase[]): string {
  if (!cases.length) return ''
  const lines: string[] = ['<verified_jurisprudence>']
  lines.push('Real federal/BIA precedents found and (where url_verified=true) link-checked. Use these — do NOT invent others:')
  for (const c of cases) {
    lines.push(`<case name="${c.name}" citation="${c.citation}" url_verified="${c.url_verified}">`)
    lines.push(`  court: ${c.court}`)
    lines.push(`  year: ${c.year}`)
    lines.push(`  holding: ${c.holding}`)
    lines.push(`  factual_analogy: ${c.factual_analogy_to_applicant}`)
    if (c.url_verified && c.url) lines.push(`  url: ${c.url}`)
    lines.push('</case>')
  }
  lines.push('</verified_jurisprudence>')
  return lines.join('\n')
}

export function buildCountryConditionsBlock(news: NewsAppendixItem[]): string {
  if (!news.length) return ''
  const lines: string[] = ['<country_conditions>']
  lines.push('Verified country-condition sources (cite by source name + URL when used):')
  for (const n of news) {
    lines.push(`<source name="${n.source_name}" date="${n.published_date}" url="${n.verified_url}">`)
    lines.push(`  summary: ${n.executive_summary}`)
    lines.push(`  context: ${n.full_context.slice(0, 1200)}`)
    lines.push('</source>')
  }
  lines.push('</country_conditions>')
  return lines.join('\n')
}

// ──────────────────────────────────────────────────────────────────
// Fase 4 — Legal Brief seccionado (5 sub-llamadas en paralelo)
// ──────────────────────────────────────────────────────────────────

export interface BriefResult {
  sections: LegalBriefSection[]
  usage: UsageStats
}

export async function generateLegalBrief(
  inputs: BuildAnalysisUserPromptInput,
  ctx: V7CaseContext,
  jurisprudence: JurisprudenceCase[],
  news: NewsAppendixItem[],
  opts: { signal?: AbortSignal } = {},
): Promise<BriefResult> {
  const jurisBlock = buildVerifiedJurisprudenceBlock(jurisprudence)
  const ccBlock = buildCountryConditionsBlock(news)

  const settled = await Promise.all(
    LEGAL_BRIEF_SECTIONS.map(async (def) => {
      const user = buildBriefSectionUserPrompt(def.id, inputs, ctx, jurisBlock, ccBlock)
      try {
        const { text, usage } = await generateTextWithUsage({
          system: def.system,
          user,
          maxTokens: 8000, // densa pero acotada para caber en el worker (300s)
          disableThinking: true, // redacción (hechos ya decididos en case_analysis) → sin extended thinking
          signal: opts.signal,
          logLabel: `credible-fear-v7-brief-${def.id}`,
        })
        const markdown = stripFences(text).trim()
        return {
          section: { section_id: def.id, heading: def.heading, markdown, words: countWords(markdown) } as LegalBriefSection,
          usage,
        }
      } catch (err) {
        log.warn('brief section failed', { section: def.id, err: String(err) })
        return {
          section: { section_id: def.id, heading: def.heading, markdown: `### ${def.heading}\n\n*[This section could not be generated automatically — please complete manually.]*`, words: 0 } as LegalBriefSection,
          usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 } as UsageStats,
        }
      }
    }),
  )

  const usage = settled.reduce<UsageStats>(
    (acc, s) => ({
      inputTokens: acc.inputTokens + s.usage.inputTokens,
      outputTokens: acc.outputTokens + s.usage.outputTokens,
      cacheReadTokens: acc.cacheReadTokens + s.usage.cacheReadTokens,
      cacheCreationTokens: acc.cacheCreationTokens + s.usage.cacheCreationTokens,
    }),
    { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 },
  )
  // Mantener el orden I.1..I.5 (Promise.all preserva el orden del input)
  return { sections: settled.map((s) => s.section), usage }
}

// ──────────────────────────────────────────────────────────────────
// Fase 5 — Tabla cronológica
// ──────────────────────────────────────────────────────────────────

export async function generateChronology(
  inputs: BuildAnalysisUserPromptInput,
  ctx: V7CaseContext,
  opts: { signal?: AbortSignal } = {},
): Promise<{ rows: ChronologyRow[]; usage: UsageStats }> {
  try {
    const { text, usage } = await generateTextWithUsage({
      system: CHRONOLOGY_SYSTEM,
      user: buildChronologyUserPrompt(inputs, ctx),
      maxTokens: 4000,
      disableThinking: true,
      signal: opts.signal,
      logLabel: 'credible-fear-v7-chronology',
    })
    let jsonText = stripFences(text).trim()
    const first = jsonText.indexOf('{')
    const last = jsonText.lastIndexOf('}')
    if (first !== -1 && last > first) jsonText = jsonText.slice(first, last + 1)
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      parsed = JSON.parse(jsonrepair(jsonText))
    }
    const validation = chronologyOutputSchema.safeParse(parsed)
    return { rows: validation.success ? validation.data.rows : [], usage }
  } catch (err) {
    log.warn('chronology generation failed', { err: String(err) })
    return { rows: [], usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 } }
  }
}

// ──────────────────────────────────────────────────────────────────
// Ensamblaje del documento final (body_md)
// ──────────────────────────────────────────────────────────────────

export interface AssembleArgs {
  applicantName: string
  aNumber: string | null | undefined
  todayLabel: string
  sections: LegalBriefSection[]
  chronology: ChronologyRow[]
  jurisprudence: JurisprudenceCase[]
  news: NewsAppendixItem[]
}

export function assembleMemorandumMarkdown(a: AssembleArgs): string {
  const L: string[] = []
  L.push('# LEGAL MEMORANDUM AND APPLICANT DECLARATION IN SUPPORT OF ASYLUM')
  L.push('')
  L.push(`**Applicant:** ${a.applicantName.toUpperCase()}`)
  L.push(`**A-Number:** ${a.aNumber || 'Pending assignment'}`)
  L.push(`**Date:** ${a.todayLabel}`)
  L.push('')
  L.push('## I. LEGAL BRIEF & ARGUMENTATION')
  L.push('')
  for (const s of a.sections) {
    L.push(s.markdown.trim())
    L.push('')
  }

  // Apéndice A — Tabla cronológica (markdown table → docx Table en el renderer)
  L.push('## II. APPENDIX A — CHRONOLOGICAL ANALYSIS TABLE')
  L.push('')
  if (a.chronology.length) {
    L.push('| Date | Event & Parties Involved | Direct Consequences | Exhibit |')
    L.push('| --- | --- | --- | --- |')
    for (const r of a.chronology) {
      L.push(`| ${cell(r.date)} | ${cell(r.event)} | ${cell(r.consequence)} | ${cell(r.exhibit)} |`)
    }
  } else {
    L.push('*No chronological entries were generated for this case.*')
  }
  L.push('')

  // Apéndice B — Jurisprudencia
  L.push('## III. APPENDIX B — JURISPRUDENTIAL REINFORCEMENT')
  L.push('')
  if (a.jurisprudence.length) {
    for (const c of a.jurisprudence) {
      L.push(`### ${c.name}${c.citation ? ` — ${c.citation}` : ''}`)
      L.push('')
      if (c.holding) L.push(`**Holding.** ${c.holding}`)
      if (c.factual_analogy_to_applicant) {
        L.push('')
        L.push(`**Relevance to this applicant.** ${c.factual_analogy_to_applicant}`)
      }
      if (c.url_verified && c.url) {
        L.push('')
        L.push(`Source: ${c.url}`)
      }
      L.push('')
    }
  } else {
    L.push('*No federal precedents were retrieved for this profile in this version.*')
    L.push('')
  }

  // Apéndice C — Noticias con carátula
  L.push('## IV. APPENDIX C — PUBLIC SOURCES OF CORROBORATION (COUNTRY CONDITIONS)')
  L.push('')
  if (a.news.length) {
    a.news.forEach((n, i) => {
      L.push(`### ${i + 1}. ${n.source_name}${n.published_date ? ` — ${n.published_date}` : ''}`)
      L.push('')
      L.push(`**Source & Author:** ${n.source_name}${n.author ? ` — ${n.author}` : ''}`)
      L.push(`**Verified URL:** ${n.verified_url}`)
      L.push('')
      L.push(`**Executive Summary.** ${n.executive_summary}`)
      L.push('')
      L.push(`**Full Context.** ${n.full_context}`)
      L.push('')
    })
  } else {
    L.push('*No corroborating public sources with live links were included in this version.*')
    L.push('')
  }

  // Cierre (lo agrega el renderer una sola vez)
  L.push('---')
  L.push('')
  L.push('I declare under penalty of perjury under the laws of the United States that the foregoing is true and correct to the best of my knowledge and belief.')
  L.push('')
  L.push('Signature: ___________________________')
  L.push('')
  L.push('Date: ___________________________')
  return L.join('\n').trim()
}

function cell(v: string | null | undefined): string {
  return (v ?? '').replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim() || '—'
}

function stripFences(text: string): string {
  const t = text.trim()
  if (t.startsWith('```')) return t.replace(/^```(?:json|markdown|md)?\s*/i, '').replace(/\s*```\s*$/i, '')
  return t
}
