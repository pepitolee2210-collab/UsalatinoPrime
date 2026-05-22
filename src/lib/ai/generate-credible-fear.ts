// Generador del Miedo Creíble (v5) usando Claude Opus 4.7 con prompt
// estructurado. Reemplaza la versión v4 (markdown + JSON embebido en HTML
// comment) por un único JSON canónico validado con Zod.
//
// Inputs:
//   - applicantMetadata: profile + I-589 Parte A.
//   - questionnaireResponses: respuestas M1-M11 del cuestionario nuevo.
//   - uploadedDocuments: documentos del cliente con OCR (categorías B-G).
//   - evidenceLinks: URLs del cliente + selecciones de country_evidence_links.
//
// Output: CredibleFearStructuredOutput (validado por Zod) + UsageStats.
// El route handler decide qué columnas JSONB poblar según `status`.

import { generateTextWithUsage, CLAUDE_MODEL, type UsageStats } from './anthropic-client'
import {
  CREDIBLE_FEAR_SYSTEM_V5,
  CREDIBLE_FEAR_PROMPT_VERSION_V5,
  buildCredibleFearUserPrompt,
  type BuildUserPromptInput,
} from './credible-fear-prompt-v5'
import {
  credibleFearStructuredOutputSchema,
  type CredibleFearStructuredOutput,
} from './credible-fear-schema'
import { createLogger } from '@/lib/logger'

const log = createLogger('credible-fear-v5')

/** Versión exportada para que el route handler la persista en BD. */
export const CREDIBLE_FEAR_PROMPT_VERSION = CREDIBLE_FEAR_PROMPT_VERSION_V5

export interface GenerateCredibleFearInput extends BuildUserPromptInput {
  signal?: AbortSignal
}

export interface GenerateCredibleFearResult {
  output: CredibleFearStructuredOutput
  raw: string
  usage: UsageStats
  modelUsed: string
  promptVersion: string
}

export class CredibleFearGenerationError extends Error {
  constructor(
    message: string,
    public readonly raw: string,
    public readonly usage: UsageStats,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'CredibleFearGenerationError'
  }
}

/**
 * Genera el output estructurado del Miedo Creíble.
 *
 * Lanza `CredibleFearGenerationError` si:
 *   - Claude devuelve texto que no contiene un JSON válido.
 *   - El JSON no satisface el schema Zod.
 *
 * El caller (route handler) captura el error y persiste el `raw` con
 * status='REQUIRES_REVIEW' + flag 'inconsistency' para que un humano revise.
 */
export async function generateCredibleFear(
  input: GenerateCredibleFearInput,
): Promise<GenerateCredibleFearResult> {
  const userPrompt = buildCredibleFearUserPrompt(input)

  const { text, usage } = await generateTextWithUsage({
    system: CREDIBLE_FEAR_SYSTEM_V5,
    user: userPrompt,
    maxTokens: 16384,
    signal: input.signal,
    logLabel: 'credible-fear-v5',
  })

  let parsed: unknown
  try {
    parsed = JSON.parse(extractJson(text))
  } catch (err) {
    throw new CredibleFearGenerationError(
      'La IA devolvió un JSON inválido',
      text,
      usage,
      err,
    )
  }

  const validation = credibleFearStructuredOutputSchema.safeParse(parsed)
  if (!validation.success) {
    const issues = validation.error.issues.slice(0, 10)
    log.warn('Zod validation failed', { issues })
    const issuesSummary = issues
      .map((i) => `  • path=${i.path.join('.') || '(root)'} — ${i.message}`)
      .join('\n')
    throw new CredibleFearGenerationError(
      `La IA devolvió un JSON que no satisface el schema esperado. Primeros ${issues.length} issues:\n${issuesSummary}`,
      text,
      usage,
      validation.error,
    )
  }

  return {
    output: validation.data,
    raw: text,
    usage,
    modelUsed: CLAUDE_MODEL,
    promptVersion: CREDIBLE_FEAR_PROMPT_VERSION_V5,
  }
}

/**
 * Extrae un objeto JSON de un texto que puede tener prosa, code fences o
 * espacios alrededor. La IA debería devolver solo JSON, pero a veces
 * añade "```json" y "```" o un comentario al inicio.
 */
function extractJson(text: string): string {
  // Intenta primero parsear directo
  const trimmed = text.trim()
  if (trimmed.startsWith('{')) return trimmed

  // Si hay un fence ```json ... ```, extraerlo
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenceMatch) return fenceMatch[1].trim()

  // Buscar el primer { y emparejar llaves balanceadas
  const start = trimmed.indexOf('{')
  if (start < 0) return trimmed
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i]
    if (inString) {
      if (escape) escape = false
      else if (ch === '\\') escape = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return trimmed.slice(start, i + 1)
    }
  }
  return trimmed.slice(start)
}
