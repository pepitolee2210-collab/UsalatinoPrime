import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { createLogger } from '@/lib/logger'

const log = createLogger('anthropic-legal')

// Claude Opus 4.7 — the most capable model for legal reasoning.
// BigLaw Bench leader. Adaptive thinking only (no budget_tokens,
// no temperature/top_p/top_k).
const LEGAL_REVIEWER_MODEL = 'claude-opus-4-7' as const

// ----- Structured output schema -----
// Zod schemas validate Claude's response at parse time. `messages.parse()`
// rejects any response that doesn't match exactly, so we never get a "review"
// with half-filled fields into the DB.

export const LegalFindingSchema = z.object({
  severity: z.enum(['critical', 'moderate', 'suggestion']).describe(
    'critical = blocks filing with the court. moderate = should fix. suggestion = nice to have.',
  ),
  category: z.string().describe(
    'Short label: "missing_evidence", "date_inconsistency", "weak_narrative", "legal_citation_missing", etc.',
  ),
  location: z.string().describe(
    'Where in the document(s) the issue appears. Include document name and section/paragraph when possible.',
  ),
  description: z.string().describe(
    'What exactly is wrong, in 1-2 sentences as if explaining to the attorney.',
  ),
  recommendation: z.string().describe(
    'Concrete action to fix it. What to add, what to change, or what to verify.',
  ),
})

export const LegalReviewSchema = z.object({
  score: z.number().min(0).max(100).describe(
    '0 = unacceptable for court. 100 = ready to file. Deduct ~15 per critical, ~5 per moderate, ~1 per suggestion.',
  ),
  ready_to_file: z.boolean().describe(
    'true only if there are NO critical findings and the overall narrative satisfies the legal standard.',
  ),
  summary: z.string().describe(
    '2-3 sentence executive summary for the attorney: what is the case strength, what are the biggest gaps.',
  ),
  findings: z.array(LegalFindingSchema).describe(
    'All issues found, ordered by severity (critical first). Max 15 findings — focus on the most important.',
  ),
  strengths: z.array(z.string()).describe(
    'What is GOOD about this case. 2-4 bullet points. Useful so the attorney knows what NOT to change.',
  ),
})

export type LegalReview = z.infer<typeof LegalReviewSchema>
export type LegalFinding = z.infer<typeof LegalFindingSchema>

// ----- Client wrapper -----

let _client: Anthropic | null = null

function getClient(): Anthropic {
  if (_client) return _client
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY no configurada. Agrégala en Vercel → Settings → Environment Variables.',
    )
  }
  _client = new Anthropic({
    apiKey,
    // SDK already retries 5xx / 429 with exponential backoff. Bump the budget
    // a bit for long legal reviews that may be slow.
    maxRetries: 3,
    timeout: 180_000, // 180s — legal review on a 5-document case takes ~30-60s
  })
  return _client
}

// ----- Prompt composition -----

const REVIEWER_ROLE = `Eres un abogado senior de inmigración con 20+ años de experiencia en Cortes de EE.UU. Tu trabajo es revisar documentos legales generados por otro sistema ANTES de que sean presentados ante un juez.

Actúas como el último filtro de calidad. Tu revisión evita que se presenten casos débiles que puedan ser negados.

REGLAS DE TU REVISIÓN:
- Sé riguroso pero constructivo. No inventes problemas. No exageres.
- Piensa como el juez que va a leer esto: ¿qué le haría dudar? ¿qué le faltaría?
- Verifica cada documento contra el playbook específico del tipo de caso.
- Identifica inconsistencias entre documentos (fechas, nombres, hechos).
- Detecta secciones vacías, contenido genérico, lenguaje débil, evidencia insuficiente.
- Detecta [FALTA:...] y otros placeholders sin resolver.
- NUNCA devuelvas texto libre fuera del JSON solicitado.

Tu output debe ser ESTRICTAMENTE el JSON del schema. No agregues explicaciones, no uses markdown, no hagas preámbulos.`

interface RunLegalReviewParams {
  /** Service-specific legal playbook (what the judge looks for). Cached across requests of the same service. */
  playbook: string
  /** Documents to evaluate. Already-generated declarations, petitions, etc. */
  documents: Array<{ name: string; type: string; content: string }>
  /** Structured case data (client names, dates, etc.) for cross-reference. */
  caseSummary: string
  /** Optional abort signal (e.g. request cancelled by client). */
  signal?: AbortSignal
}

/**
 * Runs a legal review of the given documents against the provided playbook.
 *
 * Caching strategy: the role + playbook are stable across all reviews of the
 * same service, so we mark them with `cache_control: {type: "ephemeral"}`.
 * First review costs normal price + cache write (~1.25x). Every subsequent
 * review of the same service hits the cache and pays ~10% for that prefix.
 *
 * At 25K input / 3K output tokens uncached ≈ $0.20 per review.
 * With cache hits on playbook ≈ $0.10 per review.
 */
export async function runLegalReview(params: RunLegalReviewParams): Promise<LegalReview> {
  const client = getClient()

  // Build the user message: documents concatenated, then the case summary.
  // Volatile per-case content goes AFTER the cached playbook.
  const docsBlock = params.documents
    .map(d => `\n═══ DOCUMENTO: ${d.name} (tipo: ${d.type}) ═══\n\n${d.content.trim()}`)
    .join('\n')

  const userPrompt = `Revisa estos documentos del caso aplicando el playbook del system prompt.

DATOS DEL CASO (para verificar consistencia):
${params.caseSummary}

DOCUMENTOS A REVISAR:
${docsBlock}

Produce el JSON estricto del schema. NO agregues explicaciones fuera del JSON.`

  log.debug('Running legal review', {
    docsCount: params.documents.length,
    totalChars: docsBlock.length + params.caseSummary.length + params.playbook.length,
  })

  try {
    const response = await client.messages.parse({
      model: LEGAL_REVIEWER_MODEL,
      max_tokens: 8000,
      // Role + playbook are the stable prefix — cacheable and reusable.
      // Place cache_control on the LAST system block; everything before it
      // (tools + earlier system blocks) is cached with it.
      system: [
        { type: 'text', text: REVIEWER_ROLE },
        {
          type: 'text',
          text: `\n══════════════════════════════════════════════════\n\nPLAYBOOK LEGAL PARA ESTE TIPO DE CASO:\n\n${params.playbook}`,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userPrompt }],
      output_config: { format: zodOutputFormat(LegalReviewSchema) },
    }, { signal: params.signal })

    const parsed = response.parsed_output
    if (!parsed) {
      throw new Error('Claude devolvió una respuesta que no coincide con el schema esperado')
    }

    log.info('Legal review complete', {
      score: parsed.score,
      findingsCount: parsed.findings.length,
      criticalCount: parsed.findings.filter(f => f.severity === 'critical').length,
      cacheRead: response.usage.cache_read_input_tokens,
      cacheWrite: response.usage.cache_creation_input_tokens,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    })

    return parsed
  } catch (err) {
    if (err instanceof Anthropic.BadRequestError) {
      log.error('Claude bad request', err.message)
      throw new Error(`Error en la solicitud: ${err.message}`)
    }
    if (err instanceof Anthropic.AuthenticationError) {
      log.error('Claude auth error', err.message)
      throw new Error('API key de Anthropic inválida o no configurada.')
    }
    if (err instanceof Anthropic.RateLimitError) {
      log.warn('Claude rate limit', err.message)
      throw new Error('Límite de uso alcanzado. Intenta en unos minutos.')
    }
    if (err instanceof Anthropic.APIError) {
      log.error('Claude API error', { status: err.status, message: err.message })
      throw new Error(`Error de Claude (${err.status}): ${err.message}`)
    }
    throw err
  }
}
