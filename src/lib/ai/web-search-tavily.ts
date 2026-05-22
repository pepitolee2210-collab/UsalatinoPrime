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
 * Tipo de persecución para enriquecer las queries de Tavily. Se deriva en el
 * route handler desde `m3_grounds` del cuestionario M3 + heurísticas sobre
 * las respuestas. Permite que la búsqueda traiga casos emblemáticos del
 * país directamente relacionados con el tipo de persecución del cliente
 * (ej. en MX abuso policial → caso Giovanni López; HN defensores ambientales
 * → caso Berta Cáceres).
 */
export type AsylumPersecutionType =
  | 'political'         // opinión política (real o imputada)
  | 'religious'         // persecución religiosa
  | 'lgbtq'             // PSG: orientación sexual / identidad de género
  | 'gang'              // PSG: víctimas de pandillas / crimen organizado
  | 'gender_violence'   // PSG: violencia de género / doméstica
  | 'ethnic'            // raza / etnia / nacionalidad
  | 'general'           // catch-all

export interface CountryConditionsOptions {
  /** Tipo de persecución del cliente (M3 grounds + heurística). */
  persecutionType?: AsylumPersecutionType
  /** Máximo de resultados consolidados a devolver (default 8). */
  maxResults?: number
}

const PERSECUTION_KEYWORDS: Record<AsylumPersecutionType, string> = {
  political: 'political prisoners persecution opposition activists',
  religious: 'religious persecution churches pastors believers',
  lgbtq: 'LGBTQ persecution violence transgender gay rights',
  gang: 'gang violence organized crime extortion forced recruitment',
  gender_violence: 'gender violence domestic violence women femicide',
  ethnic: 'ethnic persecution indigenous minority',
  general: 'human rights violations persecution',
}

/**
 * Búsqueda especializada en country conditions para casos de asilo.
 * Combina queries paralelas: state department + hrw/amnesty, news reciente,
 * y una query enfocada en el tipo de persecución específico del cliente.
 */
export async function searchCountryConditions(
  country: string,
  opts: CountryConditionsOptions = {},
): Promise<TavilySearchResult[]> {
  const year = new Date().getFullYear()
  const persecutionType = opts.persecutionType ?? 'general'
  const persecutionKeywords = PERSECUTION_KEYWORDS[persecutionType]
  const maxResults = opts.maxResults ?? 8

  const queries = [
    // 1. State Department + HRW + Amnesty (informe canónico)
    {
      query: `country conditions ${country} ${year} state department human rights report`,
      includeDomains: ['state.gov', 'travel.state.gov', 'hrw.org', 'amnesty.org', 'oas.org'],
      topic: 'general' as const,
      maxResults: 4,
    },
    // 2. Noticias recientes específicas al tipo de persecución (últimos 365 días)
    {
      query: `${country} ${persecutionKeywords} news ${year}`,
      topic: 'news' as const,
      days: 365,
      maxResults: 5,
    },
    // 3. Casos emblemáticos relacionados al tipo de persecución
    {
      query: `${country} ${persecutionKeywords} emblematic case investigation`,
      topic: 'general' as const,
      maxResults: 4,
    },
    // 4. Reportajes en medios de tier alto (NYT/WaPo/CNN/BBC/Reuters/Guardian)
    {
      query: `${country} ${persecutionKeywords} report investigation`,
      includeDomains: ['nytimes.com', 'washingtonpost.com', 'bbc.com', 'cnn.com', 'reuters.com', 'theguardian.com', 'apnews.com', 'dw.com', 'aljazeera.com'],
      topic: 'general' as const,
      maxResults: 5,
    },
  ]

  const responses = await Promise.all(queries.map((q) => tavilySearch(q)))
  // Dedupe por URL, manteniendo el primer hit (mayor prioridad por orden de query)
  const seen = new Set<string>()
  const merged: TavilySearchResult[] = []
  for (const r of responses) {
    for (const item of r.results) {
      if (seen.has(item.url)) continue
      seen.add(item.url)
      merged.push(item)
    }
  }
  return merged.slice(0, maxResults)
}
