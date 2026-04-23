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
