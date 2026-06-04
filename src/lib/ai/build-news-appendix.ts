// Fase 3 del Miedo Creíble v7 — Apéndice C (Public Sources of Corroboration).
//
// 1. Tavily busca noticias/reportes de country conditions por país + tipo de
//    persecución (searchCountryConditions, ya existente).
// 2. checkUrlReachable verifica que CADA link resuelva (exigencia de Henry:
//    el link debe existir para poder descargarlo/imprimirlo). Los muertos se
//    descartan.
// 3. Claude redacta una carátula (Nota de Guía) por cada artículo verificado:
//    fuente, autor, resumen ejecutivo (quién lo dijo + qué pasó) y contexto.
//
// Devuelve 4-5 items con carátula + URL verificada + fecha.

import { jsonrepair } from 'jsonrepair'
import { generateTextWithUsage } from './anthropic-client'
import { searchCountryConditions, type AsylumPersecutionType } from './web-search-tavily'
import { checkUrlReachable } from '@/lib/legal/verify-url-reachability'
import {
  newsCaratulaOutputSchema,
  type NewsAppendixItem,
} from './credible-fear-schema'
import { NEWS_CARATULA_SYSTEM, buildNewsCaratulaUserPrompt } from './credible-fear-prompt-v7'
import { createLogger } from '@/lib/logger'

const log = createLogger('build-news-appendix')

const TARGET_ITEMS = 5
const MAX_CONCURRENT_VERIFY = 5

export interface NewsAppendixResult {
  items: NewsAppendixItem[]
  usage: { inputTokens: number; outputTokens: number }
}

export async function buildNewsAppendix(
  country: string,
  persecutionType: AsylumPersecutionType,
  opts: { signal?: AbortSignal } = {},
): Promise<NewsAppendixResult> {
  // 1. Buscar (hasta 12 para tener margen tras filtrar los muertos)
  let results: Awaited<ReturnType<typeof searchCountryConditions>> = []
  try {
    results = await searchCountryConditions(country, { persecutionType, maxResults: 12 })
  } catch (err) {
    log.warn('Tavily search falló', { country, persecutionType, err: String(err) })
    return { items: [], usage: { inputTokens: 0, outputTokens: 0 } }
  }
  if (results.length === 0) return { items: [], usage: { inputTokens: 0, outputTokens: 0 } }

  // 2. Verificar links (en chunks) — conservar solo los que resuelven
  const verified: typeof results = []
  for (let i = 0; i < results.length && verified.length < TARGET_ITEMS; i += MAX_CONCURRENT_VERIFY) {
    const chunk = results.slice(i, i + MAX_CONCURRENT_VERIFY)
    const checks = await Promise.allSettled(chunk.map((r) => checkUrlReachable(r.url)))
    chunk.forEach((r, idx) => {
      const c = checks[idx]
      if (verified.length < TARGET_ITEMS && c.status === 'fulfilled' && c.value.reachable) {
        verified.push(r)
      }
    })
  }

  if (verified.length === 0) {
    log.warn('ningún link de noticias resolvió', { country, found: results.length })
    return { items: [], usage: { inputTokens: 0, outputTokens: 0 } }
  }

  // 3. Claude redacta las carátulas
  const articles = verified.map((r, index) => ({
    index,
    url: r.url,
    title: r.title,
    content: r.content,
    published_date: r.published_date,
  }))

  let caratulas: { index: number; source_name: string; author: string; executive_summary: string; full_context: string }[] = []
  let usage = { inputTokens: 0, outputTokens: 0 }
  try {
    const { text, usage: u } = await generateTextWithUsage({
      system: NEWS_CARATULA_SYSTEM,
      user: buildNewsCaratulaUserPrompt(articles),
      maxTokens: 6000,
      signal: opts.signal,
      logLabel: 'credible-fear-v7-news-caratula',
    })
    usage = { inputTokens: u.inputTokens, outputTokens: u.outputTokens }
    caratulas = parseCaratulas(text)
  } catch (err) {
    log.warn('carátulas IA fallaron — uso fallback con title/content', { err: String(err) })
  }

  // 4. Combinar carátula (IA) con url/fecha (Tavily verificado). Si la IA no
  //    produjo carátula para un índice, usar fallback con el contenido de Tavily.
  const byIndex = new Map(caratulas.map((c) => [c.index, c]))
  const items: NewsAppendixItem[] = verified.map((r, index) => {
    const c = byIndex.get(index)
    return {
      source_name: c?.source_name || hostnameOf(r.url),
      author: c?.author || '',
      verified_url: r.url,
      executive_summary: c?.executive_summary || (r.content ?? '').slice(0, 280),
      full_context: c?.full_context || (r.content ?? '').slice(0, 1200),
      published_date: r.published_date || '',
      url_verified: true,
    }
  })

  log.info('news appendix built', { country, items: items.length })
  return { items, usage }
}

function parseCaratulas(rawText: string): { index: number; source_name: string; author: string; executive_summary: string; full_context: string }[] {
  if (!rawText) return []
  let jsonText = rawText.trim()
  if (jsonText.startsWith('```')) jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
  const first = jsonText.indexOf('{')
  const last = jsonText.lastIndexOf('}')
  if (first !== -1 && last > first) jsonText = jsonText.slice(first, last + 1)
  try {
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      parsed = JSON.parse(jsonrepair(jsonText))
    }
    const validation = newsCaratulaOutputSchema.safeParse(parsed)
    if (!validation.success) return []
    return validation.data.items.map((i) => ({
      index: i.index,
      source_name: i.source_name,
      author: i.author ?? '',
      executive_summary: i.executive_summary,
      full_context: i.full_context,
    }))
  } catch {
    return []
  }
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'Source'
  }
}
