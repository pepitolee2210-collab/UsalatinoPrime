import Anthropic from '@anthropic-ai/sdk'
import { createLogger } from '@/lib/logger'

const log = createLogger('anthropic')

/**
 * Modelo por defecto del sistema. Claude Opus 4.7 es el mejor para:
 *  - Razonamiento legal complejo
 *  - Generación de documentos con contenido sensible (violencia, abuso)
 *    que Gemini bloquea con PROHIBITED_CONTENT aunque safety = BLOCK_NONE
 *  - Output estructurado + adherencia estricta a instrucciones
 *
 * Adaptive thinking permite que el modelo decida cuándo razonar profundo
 * (caso enredado) vs ir rápido (caso limpio) sin presupuesto fijo.
 */
export const CLAUDE_MODEL = 'claude-opus-4-7' as const

// Singleton — el SDK mantiene su propio pool de conexiones
let _client: Anthropic | null = null

export function getAnthropic(): Anthropic {
  if (_client) return _client
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurada')
  _client = new Anthropic({ apiKey })
  return _client
}

export interface GenerateTextParams {
  /**
   * System prompt — describe persona, reglas y estructura del output.
   * Debe ser estable (no incluir datos variables) para que el cache
   * funcione. Se marca automáticamente con cache_control ephemeral.
   */
  system: string
  /**
   * User message — la parte variable: datos del caso, inputs específicos.
   * NO se cachea.
   */
  user: string
  /**
   * Instrucciones adicionales estables que deben cachearse junto al system.
   * Útil cuando hay un bloque de reglas compartido entre varios endpoints.
   */
  extraSystem?: string
  /** Tokens máximos de output. Default 8192, suficiente para una declaración. */
  maxTokens?: number
  /** AbortSignal para cancelar la llamada. */
  signal?: AbortSignal
  /**
   * Etiqueta para logging — ayuda a medir cache hit rate por feature
   * en los logs de producción. Ej: "declaration-tutor", "improve-answer".
   */
  logLabel?: string
  /**
   * Desactiva el extended thinking (adaptive). Útil para tareas de REDACCIÓN
   * pura (no razonamiento) donde el thinking solo añade latencia — ej. las
   * secciones del memorándum legal v7, cuyos hechos ya vienen decididos en el
   * case_analysis. Reduce el tiempo de generación ~30-40%. Default: false
   * (thinking adaptive activo, como el resto del sistema).
   */
  disableThinking?: boolean
}

/**
 * Generación no-streaming con prompt caching automático del system prompt.
 *
 * Uso: endpoints que devuelven el texto completo de una vez al cliente.
 * Para streaming (chatbot) usar `streamText()`.
 */
export async function generateText(params: GenerateTextParams): Promise<string> {
  const client = getAnthropic()

  const systemBlocks: Anthropic.TextBlockParam[] = [
    {
      type: 'text',
      text: params.system,
      cache_control: { type: 'ephemeral' },
    },
  ]

  if (params.extraSystem) {
    // Segundo bloque cacheable — útil para meter ejemplos largos
    // sin mezclarlos con la persona base.
    systemBlocks.push({
      type: 'text',
      text: params.extraSystem,
      cache_control: { type: 'ephemeral' },
    })
  }

  const stream = client.messages.stream(
    {
      model: CLAUDE_MODEL,
      max_tokens: params.maxTokens ?? 8192,
      thinking: { type: 'adaptive' },
      system: systemBlocks,
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: params.user }],
        },
      ],
    },
    { signal: params.signal }
  )

  const message = await stream.finalMessage()

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim()

  if (!text) {
    throw new Error('Claude devolvió respuesta vacía')
  }

  const usage = message.usage
  log.info(params.logLabel || 'generateText', {
    inputTokens: usage?.input_tokens,
    outputTokens: usage?.output_tokens,
    cacheReadTokens: usage?.cache_read_input_tokens,
    cacheWriteTokens: usage?.cache_creation_input_tokens,
    stopReason: message.stop_reason,
  })

  return text
}

/**
 * Documento PDF a enviar como content block nativo a Claude.
 * Claude "ve" el PDF (texto + layout + firmas) — útil para documentos legales
 * donde el formato visual importa. Más caro que solo-texto, mitigable con
 * `cacheable: true` para templates estáticos.
 */
export interface DocumentInput {
  /** Bytes crudos del PDF (cualquier ArrayBufferLike). */
  pdfBytes: Uint8Array | Buffer
  /** Título descriptivo. Aparece en logs y el modelo lo usa para referenciarlo. */
  title: string
  /**
   * Si true, marca este documento con `cache_control: ephemeral`. Úsalo solo
   * para PDFs que NO cambian entre llamadas (templates de referencia). PDFs
   * variables (datos del cliente) NO deben cachearse — desperdicia el budget.
   */
  cacheable?: boolean
}

export interface GenerateWithDocumentsParams {
  system: string
  extraSystem?: string
  /** PDFs adjuntos al user message. Se envían como content blocks `type: document`. */
  documents: DocumentInput[]
  /** Texto del user message que acompaña a los PDFs (prompt + metadata). */
  userText: string
  maxTokens?: number
  signal?: AbortSignal
  logLabel?: string
}

export interface UsageStats {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
}

/**
 * Variante de `generateText` que adjunta PDFs nativos al user message.
 * Soporta Claude 3.5 Sonnet+ y Opus 4.x (que es nuestro modelo por defecto).
 *
 * Devuelve tanto el texto como las estadísticas de uso, porque los callers
 * (apelación, futuros) querrán persistirlas para auditar costos por draft.
 */
export async function generateTextWithDocuments(
  params: GenerateWithDocumentsParams
): Promise<{ text: string; usage: UsageStats; stopReason: string | null }> {
  const client = getAnthropic()

  const systemBlocks: Anthropic.TextBlockParam[] = [
    { type: 'text', text: params.system, cache_control: { type: 'ephemeral' } },
  ]
  if (params.extraSystem) {
    systemBlocks.push({
      type: 'text',
      text: params.extraSystem,
      cache_control: { type: 'ephemeral' },
    })
  }

  // Construir content blocks: documentos primero (Anthropic recomienda PDFs
  // ANTES del texto del prompt), luego el texto.
  const userContent: Anthropic.ContentBlockParam[] = []
  for (const doc of params.documents) {
    const bytes = doc.pdfBytes instanceof Buffer ? doc.pdfBytes : Buffer.from(doc.pdfBytes)
    const block: Anthropic.DocumentBlockParam = {
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: bytes.toString('base64'),
      },
      title: doc.title,
      ...(doc.cacheable ? { cache_control: { type: 'ephemeral' } } : {}),
    }
    userContent.push(block)
  }
  userContent.push({ type: 'text', text: params.userText })

  const stream = client.messages.stream(
    {
      model: CLAUDE_MODEL,
      max_tokens: params.maxTokens ?? 8192,
      thinking: { type: 'adaptive' },
      system: systemBlocks,
      messages: [{ role: 'user', content: userContent }],
    },
    { signal: params.signal },
  )

  const message = await stream.finalMessage()

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim()

  if (!text) {
    throw new Error('Claude devolvió respuesta vacía')
  }

  const usage = message.usage
  const stats: UsageStats = {
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
    cacheCreationTokens: usage?.cache_creation_input_tokens ?? 0,
  }
  log.info(params.logLabel || 'generateTextWithDocuments', {
    documents: params.documents.length,
    cacheableDocs: params.documents.filter(d => d.cacheable).length,
    ...stats,
    stopReason: message.stop_reason,
  })

  return { text, usage: stats, stopReason: message.stop_reason ?? null }
}

/**
 * Variante de `generateText` que también devuelve las estadísticas de uso
 * (input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens).
 * Útil para callers que quieren persistir el costo por draft.
 */
export async function generateTextWithUsage(
  params: GenerateTextParams,
): Promise<{ text: string; usage: UsageStats; stopReason: string | null }> {
  const client = getAnthropic()

  const systemBlocks: Anthropic.TextBlockParam[] = [
    {
      type: 'text',
      text: params.system,
      cache_control: { type: 'ephemeral' },
    },
  ]
  if (params.extraSystem) {
    systemBlocks.push({
      type: 'text',
      text: params.extraSystem,
      cache_control: { type: 'ephemeral' },
    })
  }

  const stream = client.messages.stream(
    {
      model: CLAUDE_MODEL,
      max_tokens: params.maxTokens ?? 8192,
      ...(params.disableThinking ? {} : { thinking: { type: 'adaptive' as const } }),
      system: systemBlocks,
      messages: [{ role: 'user', content: [{ type: 'text', text: params.user }] }],
    },
    { signal: params.signal },
  )

  const message = await stream.finalMessage()
  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()

  if (!text) throw new Error('Claude devolvió respuesta vacía')

  const usage = message.usage
  const stats: UsageStats = {
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
    cacheCreationTokens: usage?.cache_creation_input_tokens ?? 0,
  }
  log.info(params.logLabel || 'generateTextWithUsage', {
    ...stats,
    stopReason: message.stop_reason,
  })
  return { text, usage: stats, stopReason: message.stop_reason ?? null }
}

export interface StreamTextParams extends Omit<GenerateTextParams, 'logLabel'> {
  /** Mensajes previos del chat (opcional). El último user va en `user`. */
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  logLabel?: string
}

/**
 * Streaming para chats conversacionales. El caller obtiene el stream crudo
 * del SDK y puede procesarlo como quiera (SSE al browser, etc.).
 */
export function streamText(params: StreamTextParams) {
  const client = getAnthropic()

  const systemBlocks: Anthropic.TextBlockParam[] = [
    {
      type: 'text',
      text: params.system,
      cache_control: { type: 'ephemeral' },
    },
  ]

  if (params.extraSystem) {
    systemBlocks.push({
      type: 'text',
      text: params.extraSystem,
      cache_control: { type: 'ephemeral' },
    })
  }

  const messages: Anthropic.MessageParam[] = []

  if (params.history && params.history.length > 0) {
    for (const msg of params.history) {
      messages.push({ role: msg.role, content: msg.content })
    }
  }

  messages.push({ role: 'user', content: params.user })

  return client.messages.stream(
    {
      model: CLAUDE_MODEL,
      max_tokens: params.maxTokens ?? 8192,
      thinking: { type: 'adaptive' },
      system: systemBlocks,
      messages,
    },
    { signal: params.signal }
  )
}
