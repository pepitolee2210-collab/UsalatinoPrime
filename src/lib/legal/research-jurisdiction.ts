import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { createLogger } from '@/lib/logger'
import type { ClientLocation } from './resolve-client-location'
import { getStateCourtHint } from './state-court-registry'

const log = createLogger('research-jurisdiction')

const RESEARCH_MODEL = 'claude-opus-4-7'

/**
 * Resultado estructurado de la investigación. Se guarda tal cual en
 * `case_jurisdictions`. Las URLs en `sources` son la prueba auditable de
 * que la información viene de fuentes oficiales (.gov/.us).
 */
export interface JurisdictionResearchResult {
  state_code: string
  state_name: string
  court_name: string
  court_name_es: string | null
  court_address: string | null
  filing_procedure: string | null
  filing_procedure_es: string | null
  age_limit_sijs: 18 | 21 | null
  sources: string[]
  confidence: 'high' | 'medium' | 'low'
  notes: string | null
}

/**
 * Zod schema — Claude a veces omite campos opcionales. `.nullable()` donde
 * aplica; el client hace el fallback a null.
 */
const ResearchSchema = z.object({
  state_code: z.string().length(2),
  state_name: z.string().min(1),
  court_name: z.string().min(3),
  court_name_es: z.string().nullable().optional().transform(v => v ?? null),
  court_address: z.string().nullable().optional().transform(v => v ?? null),
  filing_procedure: z.string().nullable().optional().transform(v => v ?? null),
  filing_procedure_es: z.string().nullable().optional().transform(v => v ?? null),
  age_limit_sijs: z.union([z.literal(18), z.literal(21)]).nullable().optional().transform(v => v ?? null),
  sources: z.array(z.string().url()).min(1, 'sources must include at least one official URL'),
  confidence: z.enum(['high', 'medium', 'low']).default('medium'),
  notes: z.string().nullable().optional().transform(v => v ?? null),
})

const RESEARCHER_SYSTEM = `Eres una investigadora legal senior especializada en derecho migratorio de EE.UU. y jurisdicción juvenil. Tu única tarea es determinar, con evidencia de fuentes oficiales (.gov/.us), cuál es la corte competente para una petición de custodia/tutela SIJS (Special Immigrant Juvenile Status) en un ZIP específico, y describir el procedimiento de radicación local.

## REGLAS

1. **Usa la herramienta \`web_search\`** para consultar el sitio oficial del state judiciary, de la corte del condado correspondiente y, si aplica, de USCourts.gov. Busca hasta 5 veces; agota las búsquedas si la primera no da resultado claro.
2. **Dominios permitidos**: únicamente .gov y .us. El sistema ya restringe las búsquedas a esos dominios; no intentes otros.
3. **Precisión sobre cobertura**: si no puedes identificar la corte con certeza alta, devuelve \`confidence: "low"\` y deja el campo en null — NUNCA inventes un nombre de corte ni un procedimiento.
4. **Sources obligatorios**: cada dato factual debe estar respaldado por al menos una URL oficial concreta (no la URL raíz del judiciary — páginas específicas).
5. **Output JSON estricto**: sin texto antes o después, sin markdown, sin bloques de código. Solo el JSON.
6. **court_name en inglés formal** como aparece en encabezados oficiales del tribunal. Ej: "Fourth District Juvenile Court, American Fork Location", "Superior Court of California, County of Los Angeles — Juvenile Division".
7. **court_name_es**: traducción formal al español jurídico. Ej: "Cuarto Juzgado de Distrito de Familia de Utah, Sede American Fork".
8. **filing_procedure**: descripción concisa (2-4 oraciones) de cómo se presenta una Petition for Custody / Guardianship / Support en esa corte: en persona, portal en línea, email, formularios previos, aranceles. Sin alucinaciones — si no encuentras el procedimiento local específico, di "Procedimiento estándar del estado: [descripción general]" y baja el \`confidence\`.
9. **age_limit_sijs**: edad máxima hasta la que la corte retiene jurisdicción SIJS en ese estado (18 o 21). Solo verificado si aparece en la normativa oficial o jurisprudencia consultada.
10. **confidence**:
    - \`high\` → corte identificada con certeza desde fuente oficial del judiciary estatal + procedimiento documentado en el sitio oficial.
    - \`medium\` → corte identificada pero procedimiento inferido de fuentes generales (p.ej. state judiciary rules).
    - \`low\` → no se pudo confirmar con certeza la sub-jurisdicción (condado/distrito) — se cae al nivel estatal genérico.

## FORMATO DE SALIDA (JSON estricto)

{
  "state_code": "UT",
  "state_name": "Utah",
  "court_name": "Fourth District Juvenile Court, American Fork Location",
  "court_name_es": "Cuarto Juzgado de Distrito de Familia de Utah, Sede American Fork",
  "court_address": "75 E 80 N, American Fork, UT 84003",
  "filing_procedure": "Petitions for guardianship/custody are filed in person at the juvenile court clerk's office. The clerk scans the petition, assigns a case number the same day, and collects the filing fee (approx. $40, waivable with Form 982). Judge reviews within 30-45 days and sets a hearing.",
  "filing_procedure_es": "Las peticiones de tutela/custodia se presentan en persona en la ventanilla del secretario de la corte juvenil...",
  "age_limit_sijs": 21,
  "sources": [
    "https://www.utcourts.gov/courts/juvenile/fourth-district/",
    "https://www.utcourts.gov/howto/filing/juvenile/"
  ],
  "confidence": "high",
  "notes": "Utah divides juvenile cases into 8 judicial districts; ZIP 84003 (American Fork) falls within the Fourth District."
}
`

let _client: Anthropic | null = null

function getClient(): Anthropic {
  if (_client) return _client
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurada')
  _client = new Anthropic({ apiKey })
  return _client
}

/**
 * Dado un `ClientLocation`, llama a Claude Opus 4.7 con `web_search` habilitado
 * y devuelve la jurisdicción estructurada. Lanza si no se pudo parsear JSON o
 * si Claude no devolvió sources oficiales.
 *
 * Costo típico: ~5 web_search_requests + ~15k tokens input + ~2k tokens output
 * ≈ $0.35-0.45 USD por invocación. Se cachea por caseId en
 * `case_jurisdictions` por 30 días.
 */
export async function researchJurisdiction(
  location: ClientLocation,
  signal?: AbortSignal,
): Promise<JurisdictionResearchResult> {
  const client = getClient()
  const hint = getStateCourtHint(location.stateCode)

  const userPrompt = `Investiga en fuentes oficiales la corte competente y el procedimiento de radicación para una petición SIJS de este cliente:

- Estado: ${location.stateName} (${location.stateCode})
- ZIP: ${location.zip ?? '(desconocido — usa la corte estatal genérica)'}
- Ciudad: ${location.city ?? '(desconocida)'}
- Dirección: ${location.street ?? '(no disponible)'}

## Pistas para tu research

- Sitio oficial del state judiciary a consultar primero: ${hint.officialJudiciaryUrl}
- Nivel típico de corte esperado en este estado: ${hint.likelyCourtLevel}
- Edad máxima SIJS conocida en este estado (verifica en fuente oficial): ${hint.sijsAgeCeiling}

## Lo que necesito

1. Nombre oficial EXACTO de la corte competente para una Petition for Custody / Guardianship / Support en ese ZIP (como aparece en encabezados oficiales del tribunal).
2. Dirección física de la corte si está documentada.
3. Procedimiento local de radicación (en persona, portal en línea, email, formularios previos, aranceles, tiempos).
4. Edad máxima hasta la que esta corte retiene jurisdicción SIJS en este estado.
5. URLs oficiales (.gov/.us) que respaldan cada dato.

Haz hasta 5 web_search queries. Empieza por el judiciary estatal oficial. Si el ZIP identifica un condado/distrito específico, busca la corte de ese condado/distrito.

Devuelve EXCLUSIVAMENTE el JSON estricto definido en el system prompt. Sin texto alrededor, sin markdown, sin backticks.`

  log.debug('researchJurisdiction: calling Claude with web_search', {
    stateCode: location.stateCode,
    zip: location.zip,
    source: location.source,
  })

  // Anthropic's `allowed_domains` no soporta wildcards (`*.gov` falla con
  // invalid_request_error). En vez de enumerar cada .gov/.us posible,
  // dejamos el tool sin restricción y validamos post-hoc que al menos una
  // source esté en un dominio oficial (ver SOURCE_OFFICIAL_REGEX abajo).
  const message = await client.messages.create(
    {
      model: RESEARCH_MODEL,
      max_tokens: 4096,
      system: RESEARCHER_SYSTEM,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 5,
        },
      ] as unknown as Anthropic.Messages.Tool[],
      messages: [{ role: 'user', content: userPrompt }],
    },
    { signal },
  )

  // Extraemos solo los text blocks (ignoramos tool_use y server_tool_use blocks)
  const rawText = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim()

  if (!rawText) {
    throw new Error('Claude devolvió respuesta sin texto (solo tool_use blocks)')
  }

  // Defensive: remove accidental fences
  let jsonText = rawText
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
  }

  let parsed: JurisdictionResearchResult
  try {
    const rawParsed = JSON.parse(jsonText) as unknown
    parsed = ResearchSchema.parse(rawParsed) as JurisdictionResearchResult
  } catch (err) {
    log.error('research JSON parse/validation failed', {
      preview: jsonText.slice(0, 500),
      err: err instanceof Error ? err.message : String(err),
    })
    throw new Error('Claude devolvió un JSON de jurisdicción inválido')
  }

  // Verificación post-hoc: al menos una source debe venir de un dominio oficial
  // (*.gov, *.us, uscourts.gov, state judiciary .org verificable). Esto reemplaza
  // `allowed_domains` que no soporta wildcards.
  const SOURCE_OFFICIAL_REGEX = /\.(gov|us)(\/|$|\?|#)|uscourts\.gov|courts\.state\./i
  const officialSources = parsed.sources.filter(u => SOURCE_OFFICIAL_REGEX.test(u))
  if (officialSources.length === 0) {
    log.warn('research returned no official .gov/.us sources', {
      stateCode: parsed.state_code,
      sources: parsed.sources,
    })
    throw new Error('Claude no citó ninguna fuente oficial (.gov/.us). Rehaga la investigación.')
  }

  const usage = message.usage as Anthropic.Usage & {
    server_tool_use?: { web_search_requests?: number }
  }
  log.info('research complete', {
    stateCode: parsed.state_code,
    court: parsed.court_name,
    confidence: parsed.confidence,
    sources: parsed.sources.length,
    webSearchRequests: usage.server_tool_use?.web_search_requests,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
  })

  return parsed
}
