/**
 * Wrapper sobre `fetch` que SIEMPRE termina en JSON tipado o un error
 * accionable. Evita el bug histórico donde Vercel devuelve `text/plain
 * "An error occurred..."` en timeouts (`FUNCTION_INVOCATION_FAILED`) y el
 * frontend hacía `await res.json()` directo, crasheando con
 * `SyntaxError: Unexpected token 'A'`.
 *
 * Reglas:
 *   - lee SIEMPRE el body como texto antes de parsear
 *   - si la respuesta no parsea como JSON, el preview del body viaja en el mensaje
 *   - los errores incluyen `status` + `contentType` para diagnóstico rápido
 */

export class FetchJsonError extends Error {
  readonly status: number
  readonly contentType: string | null
  readonly bodyPreview: string

  constructor(opts: {
    status: number
    contentType: string | null
    bodyPreview: string
    message: string
  }) {
    super(opts.message)
    this.name = 'FetchJsonError'
    this.status = opts.status
    this.contentType = opts.contentType
    this.bodyPreview = opts.bodyPreview
  }
}

function previewOf(text: string, max = 180): string {
  return text.slice(0, max).replace(/\s+/g, ' ').trim() || '(body vacío)'
}

function tryParseJson(text: string): unknown | undefined {
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function extractErrorMessage(parsed: unknown): string | null {
  if (!parsed || typeof parsed !== 'object') return null
  const obj = parsed as Record<string, unknown>
  if (typeof obj.error === 'string' && obj.error.trim()) return obj.error.trim()
  if (typeof obj.message === 'string' && obj.message.trim()) return obj.message.trim()
  return null
}

export async function fetchJsonSafe<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  let res: Response
  try {
    res = await fetch(input, init)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new FetchJsonError({
      status: 0,
      contentType: null,
      bodyPreview: '',
      message: `Error de red: ${msg}`,
    })
  }

  const contentType = res.headers.get('content-type')
  const text = await res.text()
  const parsed = tryParseJson(text)

  if (res.ok) {
    if (parsed !== undefined) return parsed as T
    throw new FetchJsonError({
      status: res.status,
      contentType,
      bodyPreview: previewOf(text),
      message: `Respuesta no-JSON del servidor (status ${res.status}): ${previewOf(text)}`,
    })
  }

  const serverMsg = extractErrorMessage(parsed)
  if (serverMsg) {
    throw new FetchJsonError({
      status: res.status,
      contentType,
      bodyPreview: previewOf(text),
      message: serverMsg,
    })
  }

  throw new FetchJsonError({
    status: res.status,
    contentType,
    bodyPreview: previewOf(text),
    message: `HTTP ${res.status}: ${previewOf(text)}`,
  })
}
