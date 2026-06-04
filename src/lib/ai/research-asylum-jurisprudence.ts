// Fase 2 del Miedo Creíble v7 — Búsqueda de JURISPRUDENCIA FEDERAL REAL.
//
// Claude (con la herramienta nativa web_search_20250305, mismo patrón que
// research-jurisdiction.ts) busca precedentes de asilo/withholding favorables
// según la nacionalidad y el tipo de persecución del solicitante, en
// CourtListener / Justia / scholar. Luego CADA URL se verifica con
// checkUrlReachable: si no resuelve, se conserva el caso (su análisis legal)
// pero NO se imprime una URL muerta.

import Anthropic from '@anthropic-ai/sdk'
import { jsonrepair } from 'jsonrepair'
import { getAnthropic, CLAUDE_MODEL } from './anthropic-client'
import {
  jurisprudenceOutputSchema,
  type JurisprudenceCase,
} from './credible-fear-schema'
import {
  JURISPRUDENCE_SEARCH_SYSTEM,
  buildJurisprudenceUserPrompt,
  type V7CaseContext,
} from './credible-fear-prompt-v7'
import { checkUrlReachable } from '@/lib/legal/verify-url-reachability'
import { createLogger } from '@/lib/logger'

const log = createLogger('research-asylum-jurisprudence')

export interface JurisprudenceResult {
  cases: JurisprudenceCase[]
  usage: { inputTokens: number; outputTokens: number }
}

export async function researchAsylumJurisprudence(
  ctx: V7CaseContext,
  opts: { signal?: AbortSignal; maxUses?: number } = {},
): Promise<JurisprudenceResult> {
  const client = getAnthropic()
  const userPrompt = buildJurisprudenceUserPrompt(ctx)

  let message: Anthropic.Message
  try {
    message = await client.messages.create(
      {
        model: CLAUDE_MODEL,
        max_tokens: 8000,
        system: JURISPRUDENCE_SEARCH_SYSTEM,
        tools: [
          { type: 'web_search_20250305', name: 'web_search', max_uses: opts.maxUses ?? 5 },
        ] as unknown as Anthropic.Messages.Tool[],
        messages: [{ role: 'user', content: userPrompt }],
      },
      { signal: opts.signal, timeout: 150_000 },
    )
  } catch (err) {
    log.error('jurisprudence web_search call failed', {
      err: err instanceof Error ? err.message : String(err),
    })
    return { cases: [], usage: { inputTokens: 0, outputTokens: 0 } }
  }

  const rawText = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()

  const cases = parseCases(rawText)
  const verified = await verifyCaseLinks(cases)

  log.info('jurisprudence research done', {
    nationality: ctx.nationality,
    persecutionType: ctx.persecutionType,
    casesFound: cases.length,
    casesWithVerifiedUrl: verified.filter((c) => c.url_verified).length,
  })

  return {
    cases: verified,
    usage: {
      inputTokens: message.usage?.input_tokens ?? 0,
      outputTokens: message.usage?.output_tokens ?? 0,
    },
  }
}

function parseCases(rawText: string): JurisprudenceCase[] {
  if (!rawText) return []
  let jsonText = rawText
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
  }
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
    const validation = jurisprudenceOutputSchema.safeParse(parsed)
    if (!validation.success) {
      log.warn('jurisprudence JSON failed schema', {
        issues: validation.error.issues.slice(0, 6),
      })
      return []
    }
    return validation.data.cases
  } catch (err) {
    log.warn('jurisprudence JSON parse failed', {
      err: err instanceof Error ? err.message : String(err),
      preview: rawText.slice(0, 300),
    })
    return []
  }
}

/**
 * Verifica que la URL de cada caso resuelva. Conserva SIEMPRE el caso (su
 * análisis legal vale aunque el link no abra); solo marca url_verified y limpia
 * la URL muerta para no imprimirla.
 */
async function verifyCaseLinks(cases: JurisprudenceCase[]): Promise<JurisprudenceCase[]> {
  return Promise.all(
    cases.map(async (c) => {
      const url = (c.url ?? '').trim()
      if (!url || !/^https?:\/\//i.test(url)) {
        return { ...c, url: '', url_verified: false }
      }
      try {
        const r = await checkUrlReachable(url)
        return r.reachable ? { ...c, url, url_verified: true } : { ...c, url: '', url_verified: false }
      } catch {
        return { ...c, url: '', url_verified: false }
      }
    }),
  )
}
