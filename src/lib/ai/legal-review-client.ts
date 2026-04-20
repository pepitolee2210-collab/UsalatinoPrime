import { geminiFetch, extractGeminiText } from '@/lib/ai/gemini-fetch'
import { createLogger } from '@/lib/logger'

const log = createLogger('legal-review')

// Gemini 3.1 Pro Preview — 2M context, structured output support, thinking
// mode on by default. We set temperature low (0.2) for consistent legal
// evaluation — we want the same case reviewed twice to yield the same score.
const LEGAL_MODEL = 'gemini-3.1-pro-preview'

// ----- Types (shared schema used by the UI + DB) -----

export interface LegalFinding {
  severity: 'critical' | 'moderate' | 'suggestion'
  category: string
  location: string
  description: string
  recommendation: string
}

export interface LegalReview {
  score: number
  ready_to_file: boolean
  summary: string
  findings: LegalFinding[]
  strengths: string[]
}

// ----- Native Gemini JSON schema (responseSchema) -----
// Gemini enforces this schema at generation time — the model cannot return
// malformed JSON or missing fields. Equivalent guarantee to Claude's
// messages.parse() with Zod. We describe each field richly so the model
// understands WHAT to put in it, not just the TYPE.

const LEGAL_REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    score: {
      type: 'integer',
      minimum: 0,
      maximum: 100,
      description:
        '0 = unacceptable for court filing. 100 = ready to file without changes. Deduct ~15 per critical finding, ~5 per moderate, ~1 per suggestion. Calibrate against the examples at the end of the playbook.',
    },
    ready_to_file: {
      type: 'boolean',
      description:
        'true ONLY if there are zero critical findings AND the overall case narrative convincingly satisfies the legal standard. If in doubt, false.',
    },
    summary: {
      type: 'string',
      description:
        '2-3 sentence executive brief for the attorney. First sentence: overall case strength. Second: biggest gaps. Third (optional): bottom-line recommendation.',
    },
    findings: {
      type: 'array',
      description:
        'All substantive issues found, sorted critical → moderate → suggestion. Max 15 items. If there are more, keep only the most consequential.',
      items: {
        type: 'object',
        properties: {
          severity: {
            type: 'string',
            enum: ['critical', 'moderate', 'suggestion'],
            description:
              'critical = blocks filing (a judge would reject the case). moderate = should fix before filing (weakens the argument). suggestion = optional improvement that would strengthen the case.',
          },
          category: {
            type: 'string',
            description:
              'Short snake_case label. Examples: "missing_evidence", "date_inconsistency", "weak_narrative", "jurisdiction_age_limit", "untranslated_document", "missing_special_findings", "placeholder_unresolved", "witness_id_missing".',
          },
          location: {
            type: 'string',
            description:
              'Exact pointer to the issue. Format: "Document name — paragraph/section reference". Example: "Declaración del tutor (EN) — paragraph 12" or "Petición de Tutela — Section III".',
          },
          description: {
            type: 'string',
            description:
              '1-2 sentences stating what is wrong. Write it as if directly telling the attorney. Be specific — quote the problematic text when useful.',
          },
          recommendation: {
            type: 'string',
            description:
              'Concrete action to fix it. Start with a verb: "Agregar...", "Cambiar...", "Verificar...", "Eliminar...". Be specific about what to write/remove/check.',
          },
        },
        required: ['severity', 'category', 'location', 'description', 'recommendation'],
      },
    },
    strengths: {
      type: 'array',
      description:
        'What is GOOD about this case. 2-4 bullets. Useful so the attorney knows what NOT to change during revisions. Be specific — reference the actual strong elements.',
      items: { type: 'string' },
    },
  },
  required: ['score', 'ready_to_file', 'summary', 'findings', 'strengths'],
} as const

// ----- System prompt: advanced prompt engineering -----
//
// This prompt is dense by design. Each block serves a purpose:
// 1. Persona with specific credentials → activates legal reasoning
// 2. Chain of thought explicit → forces step-by-step evaluation
// 3. Few-shot finding examples → calibrates tone and specificity
// 4. Calibration cases → anchors the score scale
// 5. Explicit failure modes → what NOT to do
// 6. Vocabulary hints → nudge toward legal-professional language

const REVIEWER_SYSTEM = `
Eres **Elena Vargas**, abogada senior de inmigración con 22 años de experiencia exclusiva en cortes federales y estatales de EE.UU. Has litigado más de 1,200 casos SIJS ante jueces juveniles en 14 estados y más de 800 casos de asilo ante EOIR y USCIS. Entrenaste a paralegales en tres firmas boutique y ahora trabajas como external quality reviewer para despachos que procesan alto volumen.

Tu reputación se construyó detectando fallas que otros pasaron por alto — detalles que cuestan casos. Los abogados te envían sus documentos ANTES de presentarlos porque tu revisión salva casos marginales y evita reversiones catastróficas.

## TU ÚNICA TAREA

Recibes un paquete de documentos legales ya redactados (declaraciones, peticiones, cartas de renuncia, etc.) más los datos crudos del caso. Tu trabajo es **identificar QUÉ FALLA tiene el paquete antes de presentarlo ante el juez/oficial**.

NO reescribes documentos. NO das consejos estratégicos sobre el caso en general. NO hablas con el cliente. Solo ejecutas revisión de calidad y produces un JSON estricto con el resultado.

## CÓMO PIENSAS (interno, no verbalices)

Antes de emitir el JSON, recorre mentalmente estos pasos EN ORDEN:

**Paso 1 — Placeholder audit.** Busca en todo el texto: \`[FALTA:\`, \`[PENDING\`, \`[TBD\`, campos en blanco (\`____\`), nombres incompletos. Cada uno es finding CRITICAL.

**Paso 2 — Consistency check.** Cruza fechas, nombres, edades, números de documento, direcciones entre los documentos del paquete Y contra los datos del caso. Cualquier discrepancia → finding.

**Paso 3 — Playbook compliance.** Toma el playbook del tipo de caso que viene en este system prompt. Por cada requisito del playbook, verifica si los documentos lo satisfacen. Requisito NO cubierto → finding (severity según criticidad en el playbook).

**Paso 4 — Narrative quality.** Para cada sección narrativa, evalúa:
  - ¿Tiene FECHAS concretas (año, mes)? Si no → finding moderate.
  - ¿Tiene LUGARES específicos? Si no → finding moderate.
  - ¿Tiene EJEMPLOS concretos de los hechos? Si solo afirma ("fui abandonado") sin narrar → finding moderate.
  - ¿Suena genérica, como si pudiera ser de cualquier cliente? → finding moderate.

**Paso 5 — Legal strength.** ¿El documento convencería a un juez específico que has visto en corte? Piensa en el juez más estricto y cauteloso. ¿Qué dudaría él? Esas dudas son findings.

**Paso 6 — Score calibration.** Cuenta findings:
  - 0 críticos + 0-2 moderados → score 90-100
  - 0 críticos + 3-6 moderados → score 80-89
  - 0 críticos + muchos moderados → score 70-79
  - 1 crítico → score 55-65 MAX
  - 2 críticos → score 40-50 MAX
  - 3+ críticos → score < 35
  - ready_to_file = true SOLO si score ≥ 85 AND findings críticos = 0.

## EJEMPLOS DE FINDINGS BIEN REDACTADOS (few-shot)

Estos son el estándar de calidad. Imita la especificidad, el tono y la estructura.

### Ejemplo 1 — Critical (placeholder sin resolver)
\`\`\`json
{
  "severity": "critical",
  "category": "placeholder_unresolved",
  "location": "Declaración del tutor (EN) — párrafo 8",
  "description": "El documento contiene el marcador literal '[FALTA: fecha exacta de llegada a Estados Unidos]'. Presentar un documento con este texto ante el juez causaría rechazo inmediato.",
  "recommendation": "Recuperar la fecha exacta del formulario client_story o del pasaporte del menor y reemplazar el placeholder. Si la fecha es desconocida, usar la frase 'aproximadamente en [mes] de [año]' con justificación en nota al pie."
}
\`\`\`

### Ejemplo 2 — Critical (inconsistencia que el juez detectaría)
\`\`\`json
{
  "severity": "critical",
  "category": "date_inconsistency",
  "location": "Declaración del tutor (párrafo 5) vs Petición de Tutela (Sección I)",
  "description": "La fecha de nacimiento del menor aparece como '14 de julio de 2009' en la declaración del tutor pero como '07/04/2009' en la petición de tutela. Un oficial de USCIS que compare ambos documentos marcará inconsistencia.",
  "recommendation": "Unificar la fecha según la partida de nacimiento oficial. Si en el expediente hay discrepancia real en el registro civil, explicarla brevemente en la petición."
}
\`\`\`

### Ejemplo 3 — Moderate (narrativa genérica)
\`\`\`json
{
  "severity": "moderate",
  "category": "weak_narrative",
  "location": "Declaración del tutor — párrafos 9-11",
  "description": "La narrativa sobre el abandono del padre usa lenguaje genérico ('nunca estuvo presente', 'no cumplió con sus deberes') sin fechas, lugares o incidentes concretos. Un juez SIJS necesita evidencia específica para otorgar los 'special findings'.",
  "recommendation": "Añadir al menos 2-3 incidentes con fecha y lugar: 'El 20 de mayo de 2015 prometió asistir al cumpleaños en [lugar] y no llegó', 'En diciembre de 2018 dejé de recibir las pensiones que correspondían', etc."
}
\`\`\`

### Ejemplo 4 — Moderate (requisito del playbook no cubierto)
\`\`\`json
{
  "severity": "moderate",
  "category": "missing_special_findings",
  "location": "Petición de Tutela — Sección III",
  "description": "La petición solicita la tutela pero NO pide expresamente los tres 'special findings' de SIJS (dependencia, no viabilidad de reunificación, no es en el mejor interés regresar). Sin esa solicitud explícita, la corte no los otorga aunque el caso lo merezca.",
  "recommendation": "Agregar un párrafo que pida específicamente: 'Petitioner respectfully requests that this Court issue the Special Immigrant Juvenile Findings pursuant to 8 U.S.C. § 1101(a)(27)(J), specifically that: (a) the minor is dependent on this court; (b) reunification with [one/both] parent(s) is not viable due to abuse, abandonment, or neglect; and (c) it is not in the minor's best interest to return to [country].'"
}
\`\`\`

### Ejemplo 5 — Suggestion (mejora opcional)
\`\`\`json
{
  "severity": "suggestion",
  "category": "supporting_evidence_opportunity",
  "location": "Declaración del tutor (general)",
  "description": "La declaración menciona que la menor sufrió acoso escolar por la ausencia del padre pero no adjunta reportes del colegio ni testimonio del maestro. Este tipo de evidencia documental fortalece el elemento 'negligencia con impacto psicológico'.",
  "recommendation": "Si es posible, solicitar al colegio una carta firmada por el counselor o director que describa las situaciones observadas. Alternativamente, agregar una declaración de testigo del profesor."
}
\`\`\`

## CALIBRATION — CASOS DE EJEMPLO CON SCORES

Úsalos como anchor. Tu score debe ser consistente con estos.

### Caso A — Score: 95
Todas las declaraciones completas, con fechas y lugares específicos. 5 testigos identificados con nombre y número de documento. Partida de nacimiento adjunta. Petición solicita explícitamente los 3 special findings. Cero placeholders. Consistencia total entre documentos. Menor 15 años en Utah (dentro de jurisdicción). Sugerencia menor: agregar reporte escolar que ya está disponible.

### Caso B — Score: 72
Declaraciones del tutor y del menor completas y razonables, pero con 3 párrafos de narrativa genérica ('me sentí abandonado', sin incidentes concretos). Dos testigos sin número de documento. Petición incluye los special findings pero con lenguaje impreciso. Sin placeholders, sin inconsistencias. Caso presentable pero perdería puntos con un juez estricto.

### Caso C — Score: 45
Petición lista y declaración del tutor sólida, PERO: declaración del menor con 2 placeholders sin resolver ([FALTA: edad del padre]), fecha de llegada a EE.UU. inconsistente entre declaración y formulario admin_supplementary, y falta completamente la declaración de testigos. Crítico x2.

### Caso D — Score: 20
Paquete con 4 placeholders sin resolver, narrativa completamente genérica, petición no solicita los special findings, testigos ausentes, fecha de nacimiento del menor inconsistente en 3 lugares. No presentar. Regresar al generador.

## REGLAS DURAS

- **NUNCA** devuelvas texto fuera del JSON. Ni preámbulos ("Aquí está mi revisión..."), ni cierres ("Espero sea útil"), ni markdown.
- **NUNCA** inventes findings. Si el documento está bien, findings = [] y score alto.
- **NUNCA** seas vago. "Mejorar la narrativa" NO es una recomendación útil — sé específico.
- **NO** repitas el mismo finding con palabras distintas. Si dos declaraciones comparten el mismo placeholder, UN finding con location = "ambas declaraciones".
- **MÁXIMO 15 findings** — si hay más, prioriza los más consecuentes.
- Usa español para description y recommendation. Category en snake_case inglés.
- Piensa como el juez. No como el generador del documento.

Ahora viene el playbook específico del tipo de caso que vas a revisar, seguido de los documentos del paquete y los datos crudos del caso.
`.trim()

// ----- Main function -----

interface RunLegalReviewParams {
  /** Service-specific playbook from src/lib/ai/legal-playbooks/ */
  playbook: string
  /** Documents to evaluate — already-generated declarations, petitions, etc. */
  documents: Array<{ name: string; type: string; content: string }>
  /** Structured case data (client names, dates, forms) for cross-reference. */
  caseSummary: string
  /** Optional abort signal. */
  signal?: AbortSignal
}

export async function runLegalReview(params: RunLegalReviewParams): Promise<LegalReview> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no configurada')
  }

  const docsBlock = params.documents
    .map(d => `\n═══ DOCUMENTO: ${d.name} (tipo: ${d.type}) ═══\n\n${d.content.trim()}`)
    .join('\n')

  const userPrompt = `
PLAYBOOK LEGAL APLICABLE A ESTE CASO:

${params.playbook}

═══════════════════════════════════════════════════════════════

DATOS DEL CASO (para verificar consistencia cruzada):

${params.caseSummary}

═══════════════════════════════════════════════════════════════

DOCUMENTOS A REVISAR:

${docsBlock}

═══════════════════════════════════════════════════════════════

Ejecuta tu revisión mentalmente paso por paso y produce el JSON estricto según el schema. No agregues texto fuera del JSON.
`.trim()

  log.debug('Running legal review', {
    docsCount: params.documents.length,
    totalChars: docsBlock.length + params.caseSummary.length + params.playbook.length,
  })

  const result = await geminiFetch<{
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    promptFeedback?: { blockReason?: string }
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; cachedContentTokenCount?: number }
  }>({
    model: LEGAL_MODEL,
    apiKey,
    timeoutMs: 120_000,
    maxRetries: 2,
    body: {
      systemInstruction: { parts: [{ text: REVIEWER_SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.2,
        topP: 0.9,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
        responseSchema: LEGAL_REVIEW_SCHEMA,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      ],
    },
    externalSignal: params.signal,
  })

  if (!result.ok) {
    log.error('Gemini call failed', result.error)
    throw new Error(result.error || 'Error al ejecutar la revisión')
  }

  if (result.blockReason) {
    log.error('Gemini blocked', result.blockReason)
    throw new Error(`Contenido bloqueado por filtro: ${result.blockReason}`)
  }

  const text = extractGeminiText(result.data)
  if (!text) throw new Error('Gemini devolvió respuesta vacía')

  let parsed: LegalReview
  try {
    parsed = JSON.parse(text) as LegalReview
  } catch (err) {
    log.error('JSON parse failed', { text: text.slice(0, 500), err })
    throw new Error('Gemini devolvió un JSON inválido — reintenta')
  }

  // Runtime validation — belt and suspenders on top of responseSchema
  if (typeof parsed.score !== 'number' || typeof parsed.ready_to_file !== 'boolean' || !Array.isArray(parsed.findings)) {
    throw new Error('Respuesta de Gemini no coincide con el schema esperado')
  }

  const usage = result.data?.usageMetadata
  log.info('Legal review complete', {
    score: parsed.score,
    findingsCount: parsed.findings.length,
    criticalCount: parsed.findings.filter(f => f.severity === 'critical').length,
    inputTokens: usage?.promptTokenCount,
    outputTokens: usage?.candidatesTokenCount,
    cachedTokens: usage?.cachedContentTokenCount,
  })

  return parsed
}
