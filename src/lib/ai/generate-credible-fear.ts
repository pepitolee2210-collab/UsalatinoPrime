// Generador del Miedo Creíble v6 — split en 2 llamadas a Claude Opus 4.7.
//
// Llamada 1 (`generateAsylumAnalysis`): análisis estructurado del caso sin
//                                       declaración (~5-8k output tokens).
// Llamada 2 (`generateAsylumDeclaration`): declaración_es de 3000-5000
//                                          palabras con URLs citadas y datos
//                                          estadísticos (~10-14k output tokens).
//
// El route handler orquesta ambas llamadas y mergea el output en
// `CredibleFearMergedOutputV6` para persistir.

import { generateTextWithUsage, CLAUDE_MODEL, type UsageStats } from './anthropic-client'
import {
  CREDIBLE_FEAR_ANALYSIS_SYSTEM_V6,
  CREDIBLE_FEAR_DECLARATION_SYSTEM_V6,
  CREDIBLE_FEAR_PROMPT_VERSION_V6,
  buildAnalysisUserPrompt,
  buildDeclarationUserPrompt,
  type BuildAnalysisUserPromptInput,
  type BuildDeclarationUserPromptInput,
} from './credible-fear-prompt-v6'
import {
  analysisOutputSchema,
  declarationOutputSchema,
  type AnalysisOutput,
  type DeclarationOutput,
} from './credible-fear-schema'
import { createLogger } from '@/lib/logger'

const log = createLogger('credible-fear-v6')

/** Versión que el route handler persiste en `prompt_version`. */
export const CREDIBLE_FEAR_PROMPT_VERSION = CREDIBLE_FEAR_PROMPT_VERSION_V6

export interface GenerateAsylumAnalysisInput extends BuildAnalysisUserPromptInput {
  signal?: AbortSignal
}

export interface GenerateAsylumDeclarationInput extends BuildDeclarationUserPromptInput {
  signal?: AbortSignal
}

export interface AnalysisCallResult {
  output: AnalysisOutput
  raw: string
  usage: UsageStats
}

export interface DeclarationCallResult {
  output: DeclarationOutput
  raw: string
  usage: UsageStats
}

/**
 * Lanza este error cuando el output de Claude no es JSON válido o no satisface
 * el schema Zod. El caller captura `raw` y `usage` para persistir un draft
 * REQUIRES_REVIEW con el output crudo en `body_md` para revisión humana.
 */
export class CredibleFearGenerationError extends Error {
  constructor(
    message: string,
    public readonly raw: string,
    public readonly usage: UsageStats,
    public readonly phase: 'analysis' | 'declaration',
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'CredibleFearGenerationError'
  }
}

// ──────────────────────────────────────────────────────────────────
// Llamada 1: análisis estructurado
// ──────────────────────────────────────────────────────────────────

export async function generateAsylumAnalysis(
  input: GenerateAsylumAnalysisInput,
): Promise<AnalysisCallResult> {
  const userPrompt = buildAnalysisUserPrompt(input)
  const { text, usage } = await generateTextWithUsage({
    system: CREDIBLE_FEAR_ANALYSIS_SYSTEM_V6,
    user: userPrompt,
    maxTokens: 12000, // ~5-8k típico, hard cap conservador para no truncar
    signal: input.signal,
    logLabel: 'credible-fear-v6-analysis',
  })

  let parsed: unknown
  try {
    parsed = JSON.parse(extractJson(text))
  } catch (err) {
    throw new CredibleFearGenerationError(
      'La IA devolvió un JSON inválido (análisis)',
      text,
      usage,
      'analysis',
      err,
    )
  }

  const validation = analysisOutputSchema.safeParse(parsed)
  if (!validation.success) {
    const issues = validation.error.issues.slice(0, 10)
    log.warn('Zod analysis validation failed', { issues })
    const issuesSummary = issues
      .map((i) => `  • path=${i.path.join('.') || '(root)'} — ${i.message}`)
      .join('\n')
    throw new CredibleFearGenerationError(
      `El JSON del análisis no satisface el schema esperado. Primeros ${issues.length} issues:\n${issuesSummary}`,
      text,
      usage,
      'analysis',
      validation.error,
    )
  }

  return { output: validation.data, raw: text, usage }
}

// ──────────────────────────────────────────────────────────────────
// Llamada 2: declaración detallada
// ──────────────────────────────────────────────────────────────────

export async function generateAsylumDeclaration(
  input: GenerateAsylumDeclarationInput,
): Promise<DeclarationCallResult> {
  const userPrompt = buildDeclarationUserPrompt(input)
  const { text, usage } = await generateTextWithUsage({
    system: CREDIBLE_FEAR_DECLARATION_SYSTEM_V6,
    user: userPrompt,
    maxTokens: 16000, // necesario para 3000-5000 palabras + audit + URLs
    signal: input.signal,
    logLabel: 'credible-fear-v6-declaration',
  })

  let parsed: unknown
  try {
    parsed = JSON.parse(extractJson(text))
  } catch (err) {
    throw new CredibleFearGenerationError(
      'La IA devolvió un JSON inválido (declaración)',
      text,
      usage,
      'declaration',
      err,
    )
  }

  const validation = declarationOutputSchema.safeParse(parsed)
  if (!validation.success) {
    const issues = validation.error.issues.slice(0, 10)
    log.warn('Zod declaration validation failed', { issues })
    const issuesSummary = issues
      .map((i) => `  • path=${i.path.join('.') || '(root)'} — ${i.message}`)
      .join('\n')
    throw new CredibleFearGenerationError(
      `El JSON de la declaración no satisface el schema esperado. Primeros ${issues.length} issues:\n${issuesSummary}`,
      text,
      usage,
      'declaration',
      validation.error,
    )
  }

  return { output: validation.data, raw: text, usage }
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

/** Conveniencia para el route handler — modelo + versión del prompt. */
export const CREDIBLE_FEAR_MODEL = CLAUDE_MODEL

/**
 * Extrae un JSON object de un texto que puede tener prosa, code fences o
 * espacios alrededor. La IA debería devolver SOLO JSON, pero a veces añade
 * ```json o un breve comentario antes/después.
 */
function extractJson(text: string): string {
  const trimmed = text.trim()
  if (trimmed.startsWith('{')) return trimmed

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenceMatch) return fenceMatch[1].trim()

  // Empareja llaves balanceadas desde el primer "{"
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
