/**
 * Verificación REAL de que las URLs oficiales devueltas por el research
 * realmente respondan algo útil. La IA pasa el filtro `.gov`/`.us` de
 * `research-jurisdiction.ts` pero puede:
 *   - Inventar subdominios (caso real KS: `kjc.ks.gov` no resuelve; el oficial
 *     es `kansasjudicialcouncil.org`).
 *   - Devolver páginas-directorio bloqueadas por WAF agresivo del estado.
 *   - Citar URLs muertas que devolvían 200 cuando se entrenó el modelo.
 *
 * Estrategia: HEAD con timeout corto. Si HEAD no se soporta o el servidor
 * responde 5xx, fallback a GET con Range bytes=0-2047. Si la URL declara ser
 * PDF (extensión `.pdf` o pdf_format='acroform'), validamos los primeros
 * 4 bytes `%PDF` — algunos servidores devuelven HTML con status 200.
 *
 * Falsos positivos: un WAF puede dejar pasar al usuario residencial USA pero
 * bloquear el IP de Vercel. Aceptamos ese tradeoff — el retry SIJ existente
 * (ver `research-jurisdiction.ts` validateSIJCorePackage) pedirá alternativas
 * a la IA cuando una familia core quede vacía.
 */

import { createLogger } from '@/lib/logger'
import type { RequiredForm } from './research-jurisdiction'

const log = createLogger('verify-url-reachability')

const TIMEOUT_MS = 5_000
const MAX_CONCURRENT = 5
const PROBE_BYTES = 2048

const BROWSER_LIKE_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (compatible; UsaLatinoPrime/1.0; +https://usalatinoprime.com)',
  'Accept': 'application/pdf,text/html,*/*;q=0.8',
}

export interface ReachabilityResult {
  reachable: boolean
  status?: number
  reason: string
}

export interface DroppedForm {
  name: string
  url: string
  reason: string
}

const memCache = new Map<string, ReachabilityResult>()

function isPdfUrl(url: string): boolean {
  return /\.pdf(\?|#|$)/i.test(url)
}

async function probeBody(url: string, expectPdf: boolean): Promise<ReachabilityResult> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        ...BROWSER_LIKE_HEADERS,
        'Range': `bytes=0-${PROBE_BYTES}`,
      },
    })
    if (res.status < 200 || res.status >= 400) {
      return { reachable: false, status: res.status, reason: `GET respondió ${res.status}` }
    }
    if (expectPdf) {
      const buf = await res.arrayBuffer()
      const head = String.fromCharCode(...new Uint8Array(buf).slice(0, 4))
      if (head !== '%PDF') {
        return { reachable: false, status: res.status, reason: `respuesta no es PDF (header=${head})` }
      }
    }
    return { reachable: true, status: res.status, reason: `GET ${res.status}` }
  } finally {
    clearTimeout(timer)
  }
}

export async function checkUrlReachable(
  url: string,
  opts: { expectPdf?: boolean } = {}
): Promise<ReachabilityResult> {
  const cached = memCache.get(url)
  if (cached) return cached

  const expectPdf = opts.expectPdf ?? isPdfUrl(url)
  let result: ReachabilityResult

  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    let headRes: Response
    try {
      headRes = await fetch(url, {
        method: 'HEAD',
        signal: ctrl.signal,
        redirect: 'follow',
        headers: BROWSER_LIKE_HEADERS,
      })
    } finally {
      clearTimeout(timer)
    }

    if (headRes.status >= 200 && headRes.status < 400) {
      // Si declaramos PDF necesitamos los primeros bytes para confirmar %PDF.
      // Si no, basta con el status 2xx/3xx.
      if (expectPdf) {
        result = await probeBody(url, true)
      } else {
        result = { reachable: true, status: headRes.status, reason: `HEAD ${headRes.status}` }
      }
    } else if (headRes.status === 405 || headRes.status === 501 || headRes.status >= 500) {
      // HEAD no soportado o error del server — probar GET Range.
      result = await probeBody(url, expectPdf)
    } else {
      result = { reachable: false, status: headRes.status, reason: `HEAD respondió ${headRes.status}` }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    result = { reachable: false, reason: `fetch falló: ${msg.slice(0, 120)}` }
  }

  memCache.set(url, result)
  return result
}

async function processInChunks<T, R>(
  items: T[],
  chunkSize: number,
  fn: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = []
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize)
    const settled = await Promise.allSettled(chunk.map(fn))
    results.push(...settled)
  }
  return results
}

export async function filterReachableForms(
  forms: RequiredForm[]
): Promise<{ kept: RequiredForm[]; dropped: DroppedForm[] }> {
  if (!forms || forms.length === 0) return { kept: [], dropped: [] }

  const settled = await processInChunks(forms, MAX_CONCURRENT, (f) =>
    checkUrlReachable(f.url_official, {
      expectPdf: f.pdf_format === 'acroform' || isPdfUrl(f.url_official),
    })
  )

  const kept: RequiredForm[] = []
  const dropped: DroppedForm[] = []
  forms.forEach((f, i) => {
    const r = settled[i]
    if (r.status === 'fulfilled' && r.value.reachable) {
      kept.push(f)
    } else {
      const reason =
        r.status === 'fulfilled'
          ? r.value.reason
          : `promesa rechazada: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`
      dropped.push({ name: f.name, url: f.url_official, reason })
    }
  })

  if (dropped.length > 0) {
    log.info('reachability batch — algunos formularios descartados', {
      total: forms.length,
      kept: kept.length,
      dropped: dropped.length,
    })
  }

  return { kept, dropped }
}
