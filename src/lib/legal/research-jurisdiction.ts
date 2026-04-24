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
export type FilingChannel = 'in_person' | 'email' | 'portal' | 'mail' | 'hybrid'

export type AttachmentType =
  | 'birth_certificate'
  | 'school_records'
  | 'medical_records'
  | 'psych_evaluation'
  | 'parental_consent'
  | 'abandonment_proof'
  | 'other'

export interface RequiredForm {
  name: string
  url_official: string
  description_es: string
  is_mandatory: boolean
}

export interface FilingStep {
  step_number: number
  title_es: string
  detail_es: string
  estimated_time: string | null
  requires_client_action: boolean
}

export interface AttachmentRequirement {
  type: AttachmentType
  description_es: string
}

export interface FeesInfo {
  amount_usd: number
  currency: 'USD'
  waivable: boolean
  waiver_form_name: string | null
  waiver_form_url: string | null
}

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
  filing_channel: FilingChannel | null
  required_forms: RequiredForm[]
  filing_steps: FilingStep[]
  attachments_required: AttachmentRequirement[]
  fees: FeesInfo | null
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
  filing_channel: z.enum(['in_person', 'email', 'portal', 'mail', 'hybrid'])
    .nullable().optional().transform(v => v ?? null),
  required_forms: z.array(z.object({
    name: z.string().min(1),
    url_official: z.string().url(),
    description_es: z.string().min(1),
    is_mandatory: z.boolean(),
  })).default([]),
  filing_steps: z.array(z.object({
    step_number: z.number().int().positive(),
    title_es: z.string().min(1),
    detail_es: z.string().min(1),
    estimated_time: z.string().nullable().optional().transform(v => v ?? null),
    requires_client_action: z.boolean(),
  })).default([]),
  attachments_required: z.array(z.object({
    type: z.enum([
      'birth_certificate', 'school_records', 'medical_records',
      'psych_evaluation', 'parental_consent', 'abandonment_proof', 'other',
    ]),
    description_es: z.string().min(1),
  })).default([]),
  fees: z.object({
    amount_usd: z.number().nonnegative(),
    currency: z.literal('USD'),
    waivable: z.boolean(),
    waiver_form_name: z.string().nullable().optional().transform(v => v ?? null),
    waiver_form_url: z.string().url().nullable().optional().transform(v => v ?? null),
  }).nullable().optional().transform(v => v ?? null),
})

const RESEARCHER_SYSTEM = `Eres una investigadora legal senior especializada en derecho migratorio de EE.UU. y jurisdicción juvenil. Tu única tarea es determinar, con evidencia de fuentes oficiales (.gov/.us), cuál es la corte competente para una petición de custodia/tutela SIJS (Special Immigrant Juvenile Status) en un ZIP específico, y describir el procedimiento de radicación local.

## REGLAS

1. **Usa la herramienta \`web_search\`** para consultar el sitio oficial del state judiciary, de la corte del condado correspondiente y, si aplica, de USCourts.gov. Busca hasta 5 veces; agota las búsquedas si la primera no da resultado claro.
2. **Dominios permitidos**: cita EXCLUSIVAMENTE URLs bajo .gov o .us (ej. utcourts.gov, courts.ca.gov, sc.gov). No uses wikipedia, blogs de abogados, ni páginas .com/.org como fuente primaria. El validador del sistema rechazará cualquier respuesta sin al menos una source .gov o .us.
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
11. **required_forms**: SOLO formularios cuya URL oficial hayas encontrado en .gov/.us. Si no encontraste un formulario concreto, devuelve array vacío — NUNCA inventes nombres de forms. Cada url_official debe ser un PDF o página oficial (no la homepage del judiciary). Marca is_mandatory=true solo cuando la fuente oficial lo indique como obligatorio.
12. **filing_steps**: lista ordenada con pasos concretos y accionables. title_es corto (<8 palabras), detail_es en 1-2 oraciones. estimated_time opcional ("30 min", "1-2 días", "mismo día"). requires_client_action=true cuando el cliente debe moverse/firmar/comparecer, false cuando es trámite interno del clerk.
13. **attachments_required**: documentos que el cliente DEBE aportar al radicar. Usa exclusivamente los types del enum: birth_certificate, school_records, medical_records, psych_evaluation, parental_consent, abandonment_proof, other. Describe en español con precisión.
14. **fees**: null si el judiciary no publica el monto. Si publica arancel y mecanismo de exención, llénalo completo. waiver_form_url solo si encuentras la URL oficial del formulario de exención (ej. fee waiver / in forma pauperis).
15. **filing_channel**: canal primario de radicación. in_person si el clerk recibe físicamente, portal si hay e-filing, email si la corte acepta PDF por correo, mail si es correo postal, hybrid si la corte admite múltiples vías.

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
  "notes": "Utah divides juvenile cases into 8 judicial districts; ZIP 84003 (American Fork) falls within the Fourth District.",
  "filing_channel": "in_person",
  "required_forms": [
    {
      "name": "Petition for Appointment of Guardian of a Minor (Form 1374GE)",
      "url_official": "https://www.utcourts.gov/resources/forms/guardianship/1374GE.pdf",
      "description_es": "Petición principal para nombrar tutor del menor. La firma el tutor propuesto ante notario.",
      "is_mandatory": true
    },
    {
      "name": "Motion to Waive Fees (Form 982GE)",
      "url_official": "https://www.utcourts.gov/resources/forms/fees/982GE.pdf",
      "description_es": "Solicitud de exención de arancel por indigencia. Opcional, solo si no puede pagar los $40.",
      "is_mandatory": false
    }
  ],
  "filing_steps": [
    {
      "step_number": 1,
      "title_es": "Completar formularios",
      "detail_es": "Llenar la Petition for Guardianship y (si aplica) el Motion to Waive Fees. Firmar ante notario.",
      "estimated_time": "1-2 días",
      "requires_client_action": true
    },
    {
      "step_number": 2,
      "title_es": "Radicar en la corte",
      "detail_es": "Presentar los formularios en persona en la ventanilla del juvenile court clerk en American Fork. Pagar $40 o entregar la exención.",
      "estimated_time": "30 min presencial",
      "requires_client_action": true
    },
    {
      "step_number": 3,
      "title_es": "Asignación de caso",
      "detail_es": "El clerk asigna número de caso el mismo día y entrega copia sellada.",
      "estimated_time": "mismo día",
      "requires_client_action": false
    },
    {
      "step_number": 4,
      "title_es": "Audiencia con el juez",
      "detail_es": "El juez revisa la petición y fija fecha de audiencia. El tutor propuesto debe comparecer.",
      "estimated_time": "30-45 días",
      "requires_client_action": true
    }
  ],
  "attachments_required": [
    {
      "type": "birth_certificate",
      "description_es": "Partida de nacimiento original del menor (con traducción certificada si está en otro idioma)."
    },
    {
      "type": "abandonment_proof",
      "description_es": "Evidencia del abandono o ausencia del padre/madre (carta, declaración jurada, testigos)."
    }
  ],
  "fees": {
    "amount_usd": 40,
    "currency": "USD",
    "waivable": true,
    "waiver_form_name": "Motion to Waive Fees (Form 982GE)",
    "waiver_form_url": "https://www.utcourts.gov/resources/forms/fees/982GE.pdf"
  }
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

  // Claude a veces envuelve el JSON en prosa explicativa o markdown. Extraemos
  // el primer bloque {...} balanceado del output. Si hay fences ``` o ```json
  // también los removemos.
  let jsonText = rawText
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
  }
  const firstBrace = jsonText.indexOf('{')
  const lastBrace = jsonText.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    jsonText = jsonText.slice(firstBrace, lastBrace + 1)
  }

  let parsed: JurisdictionResearchResult
  try {
    const rawParsed = JSON.parse(jsonText) as unknown
    parsed = ResearchSchema.parse(rawParsed) as JurisdictionResearchResult
  } catch (err) {
    const preview = rawText.slice(0, 600).replace(/\s+/g, ' ')
    log.error('research JSON parse/validation failed', {
      rawPreview: rawText.slice(0, 800),
      extractedPreview: jsonText.slice(0, 500),
      err: err instanceof Error ? err.message : String(err),
    })
    throw new Error(`Claude devolvió un JSON de jurisdicción inválido. Preview: ${preview}`)
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

  // Las URLs dentro de required_forms y fees.waiver_form_url también deben ser
  // .gov/.us — si no, degradamos grácilmente (el modelo a veces cita una URL
  // parcial). Nunca fallamos la request entera por esto.
  const isOfficial = (u: string | null | undefined) => !!u && SOURCE_OFFICIAL_REGEX.test(u)
  const cleanedForms = parsed.required_forms.filter(f => {
    const ok = isOfficial(f.url_official)
    if (!ok) {
      log.warn('required_form dropped — URL no oficial', { name: f.name, url: f.url_official })
    }
    return ok
  })
  parsed.required_forms = cleanedForms

  if (parsed.fees?.waiver_form_url && !isOfficial(parsed.fees.waiver_form_url)) {
    log.warn('fees.waiver_form_url dropped — URL no oficial', { url: parsed.fees.waiver_form_url })
    parsed.fees = { ...parsed.fees, waiver_form_url: null, waiver_form_name: parsed.fees.waiver_form_name ?? null }
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
