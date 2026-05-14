/**
 * Cliente mínimo de Tavily Web Search.
 *
 * Se usa en `generate-credible-fear.ts` para buscar reportes de DD.HH.,
 * noticias y condiciones de país que sustenten el relato del cliente.
 *
 * API key vive en `process.env.TAVILY_API_KEY`. Si la env var no está
 * disponible (ej. en build de Vercel sin secret), las búsquedas devuelven
 * resultados vacíos y el generador degrada gracefully a solo el affidavit
 * + URLs del cliente.
 *
 * Docs: https://docs.tavily.com/docs/rest-api/api-reference
 */

import { createLogger } from '@/lib/logger'

const log = createLogger('tavily')

export interface TavilySearchResult {
  url: string
  title: string
  content: string
  score: number
  published_date: string | null
  raw_content: string | null
}

export interface TavilySearchResponse {
  query: string
  answer: string | null
  results: TavilySearchResult[]
  response_time: number
}

export interface TavilySearchOptions {
  query: string
  /** 'basic' (default) o 'advanced' (más profundidad, más caro) */
  searchDepth?: 'basic' | 'advanced'
  /** 'general' | 'news' — 'news' filtra a fuentes periodísticas. */
  topic?: 'general' | 'news'
  /** Cuántos días atrás considerar — solo aplica si topic='news'. */
  days?: number
  /** Filtrar a dominios específicos (ej. ['state.gov', 'hrw.org']). */
  includeDomains?: string[]
  /** Excluir dominios. */
  excludeDomains?: string[]
  /** Max resultados (default 5). */
  maxResults?: number
  /** Si true, devuelve también `answer` (síntesis de Tavily). */
  includeAnswer?: boolean
}

/**
 * Llama a Tavily Search API. Si TAVILY_API_KEY no está definida o la API
 * falla, retorna respuesta vacía (no lanza) para no bloquear flows.
 */
export async function tavilySearch(opts: TavilySearchOptions): Promise<TavilySearchResponse> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) {
    log.warn('TAVILY_API_KEY no configurada — devolviendo resultados vacíos')
    return { query: opts.query, answer: null, results: [], response_time: 0 }
  }

  const body = {
    api_key: apiKey,
    query: opts.query,
    search_depth: opts.searchDepth ?? 'basic',
    topic: opts.topic ?? 'general',
    days: opts.days,
    include_answer: opts.includeAnswer ?? false,
    include_raw_content: false,
    max_results: opts.maxResults ?? 5,
    include_domains: opts.includeDomains,
    exclude_domains: opts.excludeDomains,
  }

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      log.warn('Tavily devolvió status no-OK', { status: res.status })
      return { query: opts.query, answer: null, results: [], response_time: 0 }
    }

    const data = (await res.json()) as TavilySearchResponse
    log.info('Tavily search OK', {
      query: opts.query,
      results: data.results?.length ?? 0,
      response_time: data.response_time,
    })
    return data
  } catch (err) {
    log.warn('Tavily fetch falló', { err: String(err) })
    return { query: opts.query, answer: null, results: [], response_time: 0 }
  }
}

/**
 * Búsqueda especializada en country conditions para casos de asilo.
 * Combina 3 queries paralelas: state department, human rights, news.
 */
export async function searchCountryConditions(country: string): Promise<TavilySearchResult[]> {
  const year = new Date().getFullYear()
  const queries = [
    {
      query: `country conditions ${country} ${year} state department human rights report`,
      includeDomains: ['state.gov', 'travel.state.gov', 'hrw.org', 'amnesty.org'],
      topic: 'general' as const,
      maxResults: 4,
    },
    {
      query: `${country} persecution violence news ${year}`,
      topic: 'news' as const,
      days: 90,
      maxResults: 4,
    },
    {
      query: `${country} asylum claims country conditions report`,
      topic: 'general' as const,
      maxResults: 3,
    },
  ]

  const responses = await Promise.all(queries.map((q) => tavilySearch(q)))
  // Dedupe por URL
  const seen = new Set<string>()
  const merged: TavilySearchResult[] = []
  for (const r of responses) {
    for (const item of r.results) {
      if (seen.has(item.url)) continue
      seen.add(item.url)
      merged.push(item)
    }
  }
  return merged.slice(0, 10)
}
