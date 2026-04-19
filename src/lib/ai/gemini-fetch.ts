/**
 * Robust fetch wrapper for Gemini API calls.
 * Adds timeout via AbortSignal, exponential backoff on 5xx / network errors,
 * and a consistent error shape so endpoints don't hang the serverless function.
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

export interface GeminiFetchOptions {
  /** Model ID, e.g. 'gemini-3.1-pro-preview' */
  model: string
  /** API key (from process.env) */
  apiKey: string
  /** Request body sent verbatim to :generateContent */
  body: Record<string, unknown>
  /** Max time for the whole call (default 45s — under Vercel's 60s hobby limit) */
  timeoutMs?: number
  /** Max retry attempts on retryable failures (default 2) */
  maxRetries?: number
  /** Optional external abort (e.g. user navigated away) */
  externalSignal?: AbortSignal
  /** Endpoint: 'generateContent' (default) or 'streamGenerateContent' */
  endpoint?: string
}

export interface GeminiFetchResult<T = unknown> {
  ok: boolean
  status: number
  data: T | null
  error?: string
  blockReason?: string
  finishReason?: string
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function geminiFetch<T = Record<string, unknown>>({
  model,
  apiKey,
  body,
  timeoutMs = 45_000,
  maxRetries = 2,
  externalSignal,
  endpoint = 'generateContent',
}: GeminiFetchOptions): Promise<GeminiFetchResult<T>> {
  const url = `${GEMINI_BASE}/${model}:${endpoint}?key=${apiKey}`

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    // If caller aborts, propagate
    const onExternalAbort = () => controller.abort()
    externalSignal?.addEventListener('abort', onExternalAbort)

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      clearTimeout(timer)
      externalSignal?.removeEventListener('abort', onExternalAbort)

      // 5xx → retry
      if (res.status >= 500 && attempt < maxRetries) {
        await sleep(500 * Math.pow(2, attempt))
        continue
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        return {
          ok: false,
          status: res.status,
          data: null,
          error: `HTTP ${res.status}: ${text.slice(0, 300)}`,
        }
      }

      const data = (await res.json()) as Record<string, unknown>

      // Surface block / finish reasons for the caller
      const promptFeedback = data.promptFeedback as { blockReason?: string } | undefined
      const candidates = data.candidates as Array<{ finishReason?: string }> | undefined
      const blockReason = promptFeedback?.blockReason
      const finishReason = candidates?.[0]?.finishReason

      return {
        ok: true,
        status: res.status,
        data: data as T,
        blockReason,
        finishReason,
      }
    } catch (err) {
      clearTimeout(timer)
      externalSignal?.removeEventListener('abort', onExternalAbort)

      const isAbort = err instanceof Error && err.name === 'AbortError'
      const isTimeout = isAbort && !externalSignal?.aborted

      if (isAbort && externalSignal?.aborted) {
        return { ok: false, status: 0, data: null, error: 'Cancelado por el cliente' }
      }

      if (isTimeout) {
        // Retry on timeout unless it was the last attempt
        if (attempt < maxRetries) {
          await sleep(500 * Math.pow(2, attempt))
          continue
        }
        return {
          ok: false,
          status: 504,
          data: null,
          error: 'La IA tardó demasiado en responder (timeout)',
        }
      }

      // Network error — retry
      if (attempt < maxRetries) {
        await sleep(500 * Math.pow(2, attempt))
        continue
      }

      return {
        ok: false,
        status: 0,
        data: null,
        error: err instanceof Error ? err.message : 'Network error',
      }
    }
  }

  // Exhausted — this branch is only reachable if every attempt decided to retry
  // without reaching a terminal state, which shouldn't happen with the guards
  // above, but we fall through defensively.
  return { ok: false, status: 500, data: null, error: 'Se agotaron los reintentos' }
}

/**
 * Extracts the text from a standard generateContent response.
 * Returns '' if the response has no text (caller should treat as missing).
 */
export function extractGeminiText(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const d = data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  return d.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
}
