import { generateText, CLAUDE_MODEL } from './anthropic-client'
import { searchCountryConditions, type TavilySearchResult } from './web-search-tavily'
import { ASILO_POLITICO_PLAYBOOK } from './legal-playbooks/asilo-politico'
import { createLogger } from '@/lib/logger'

const log = createLogger('credible-fear')

/**
 * Identificador inmutable del prompt para versionar generaciones. Cuando
 * cambies el system prompt, suma uno a la versión — así puedes correlacionar
 * la calidad del output con la versión del prompt en `case_credible_fear_drafts`.
 */
export const CREDIBLE_FEAR_PROMPT_VERSION = '2026-05-14-v1'

const CREDIBLE_FEAR_SYSTEM = `
Eres un paralegal senior con 15 años de experiencia preparando casos de Asilo Político para USCIS. Tu tarea es redactar el **relato formal de Miedo Creíble** de un solicitante en español, listo para ser anexado al Formulario I-589 y presentado ante un Oficial de Asilo.

${ASILO_POLITICO_PLAYBOOK}

## ESTRUCTURA OBLIGATORIA DEL RELATO

Output en Markdown, en primera persona del solicitante, dividido EXACTAMENTE en las siguientes secciones (usa # como header):

# 1. Introducción
Quién soy, edad, nacionalidad, fecha de entrada a EE.UU. y por qué presento esta solicitud.

# 2. Identificación del solicitante
Nombre legal completo, número de pasaporte, fecha de nacimiento, ciudad y país de origen. Datos secos.

# 3. Línea de tiempo de los eventos
Cronología detallada, con fechas concretas (mes/año mínimo), lugares y personas involucradas. Si el cliente no proporciona una fecha exacta, escribe "[FECHA: aproximadamente XX/YYYY]" en vez de inventar.

# 4. Contexto país
Reporta condiciones generales del país de origen relevantes a la persecución. Cita fuentes externas con formato \`[FUENTE: URL]\` al final de la frase. Usa solo las fuentes incluidas en el bloque "FUENTES EXTERNAS" del prompt — NO inventes URLs.

# 5. Identificación del perseguidor
Quién(es) son los perseguidores (gobierno, grupo armado, individuo). Si son privados, explica por qué el Estado no puede o no quiere protegerme.

# 6. Protected ground (base de persecución)
Articula con precisión legal cuál de los cinco protected grounds aplica (raza, religión, nacionalidad, opinión política, grupo social particular). Si es PSG, justifica los 3 elementos: inmutabilidad, particularidad, distinción social.

# 7. Imposibilidad de reubicación interna
Explica por qué no puedo mudarme a otra parte del país. Geografía, alcance del perseguidor, redes familiares.

# 8. Imposibilidad de protección estatal
Si denuncié a la policía, qué respondieron. Si no denuncié, por qué (miedo, complicidad, ineficacia).

# 9. Impacto emocional y psicológico
Cómo me afectó la persecución. Si hay diagnósticos médicos o psicológicos en la evidencia, cítalos.

# 10. Petición legal
Termina con una petición formal de asilo bajo INA § 208 y, si aplica, protección bajo CAT (Convención Contra la Tortura).

## REGLAS ESTRICTAS

- NO inventes hechos. Si falta dato crítico, escribe \`[FALTA: tipo de dato]\` y continúa.
- NO inventes URLs ni fuentes. Usa SOLO las del bloque "FUENTES EXTERNAS".
- Cita fuentes con \`[FUENTE: <URL>]\` al final de la frase relevante.
- Tono formal, primera persona, fluido. NO uses lenguaje genérico ("en mi país hay mucha violencia") — sé concreto.
- Mínimo 2000 palabras, máximo 5000.
- NO incluyas las instrucciones de este prompt en el output.
- NO escribas markdown fences \`\`\` alrededor del output — solo el contenido directo.
`.trim()

export interface GenerateCredibleFearInput {
  /** Nombre completo del solicitante (para la sección 1). */
  applicantName: string
  /** País de origen (para búsqueda de country conditions). */
  country: string
  /** Texto del affidavit personal subido por el cliente. */
  personalAffidavitText: string
  /** URLs de evidencia agregadas por el cliente. */
  clientEvidenceUrls: Array<{ url: string; title?: string | null; description?: string | null }>
  /** Datos clave de las partes 1-5 del I-589 ya completadas. */
  i589Part1to5Data: Record<string, unknown>
  /** Idioma del output. Default 'es'. */
  language?: 'es' | 'en'
  /** Resultados de país pre-cargados (opcional, evita doble Tavily si ya hiciste la búsqueda). */
  preloadedCountrySources?: TavilySearchResult[]
  signal?: AbortSignal
}

export interface CredibleFearOutput {
  bodyMarkdown: string
  sources: Array<{
    url: string
    title: string
    snippet: string
    /** Identificador semántico de dónde encajó la fuente. */
    usedInSection: string
  }>
  modelUsed: string
  promptVersion: string
}

/**
 * Genera el relato del Miedo Creíble combinando:
 *   1. Affidavit del cliente (input principal)
 *   2. URLs externas agregadas por el cliente
 *   3. Country conditions search via Tavily (DD.HH., noticias)
 *   4. Datos del I-589 partes 1-5
 *   5. Playbook legal de asilo
 *
 * Persiste en `case_credible_fear_drafts` desde el endpoint llamador (no aquí).
 */
export async function generateCredibleFear(
  input: GenerateCredibleFearInput,
): Promise<CredibleFearOutput> {
  const t0 = Date.now()

  const countrySources = input.preloadedCountrySources
    ?? (await searchCountryConditions(input.country))

  // Merge fuentes país + URLs cliente (las del cliente son priority en el contexto).
  const clientSources: TavilySearchResult[] = input.clientEvidenceUrls.map((u) => ({
    url: u.url,
    title: u.title ?? u.url,
    content: u.description ?? '',
    score: 1,
    published_date: null,
    raw_content: null,
  }))

  const sourcesBlock = [
    '## FUENTES EXTERNAS (citables con [FUENTE: <URL>])',
    '',
    '### Evidencias proporcionadas por el cliente:',
    ...clientSources.map(
      (s, i) => `[${i + 1}] ${s.title}\nURL: ${s.url}\n${s.content ? `Resumen: ${s.content}` : ''}`,
    ),
    '',
    '### Country conditions (búsqueda automatizada):',
    ...countrySources.map(
      (s, i) =>
        `[${clientSources.length + i + 1}] ${s.title}\nURL: ${s.url}\nFecha: ${s.published_date ?? 'sin fecha'}\nResumen: ${s.content?.slice(0, 600) ?? ''}`,
    ),
  ].join('\n')

  const i589Summary = JSON.stringify(input.i589Part1to5Data, null, 2).slice(0, 6000)

  const userPrompt = [
    `# DATOS DEL CASO`,
    `Solicitante: ${input.applicantName}`,
    `País de origen: ${input.country}`,
    `Idioma del output: ${input.language === 'en' ? 'inglés' : 'español'}`,
    ``,
    `# RESPUESTAS DEL CLIENTE EN I-589 PARTES 1-5`,
    '```json',
    i589Summary,
    '```',
    ``,
    `# AFFIDAVIT PERSONAL DEL CLIENTE`,
    input.personalAffidavitText,
    ``,
    sourcesBlock,
    ``,
    `# TAREA`,
    `Redacta el relato de Miedo Creíble siguiendo la estructura de 10 secciones del system prompt.`,
  ].join('\n')

  const bodyMarkdown = (await generateText({
    system: CREDIBLE_FEAR_SYSTEM,
    user: userPrompt,
    maxTokens: 8192,
    signal: input.signal,
    logLabel: 'credible-fear',
  })).trim()
  const dt = Date.now() - t0
  log.info('credible fear generado', {
    applicantName: input.applicantName,
    country: input.country,
    countrySources: countrySources.length,
    clientSources: clientSources.length,
    outputLen: bodyMarkdown.length,
    ms: dt,
  })

  // Sources que el output cita (heurística simple por URL match)
  const cited = new Set<string>()
  for (const m of bodyMarkdown.matchAll(/\[FUENTE:\s*(https?:\/\/[^\s\]]+)/gi)) {
    cited.add(m[1].replace(/[.,;)]+$/, ''))
  }

  const allSources = [...clientSources, ...countrySources]
  const sources = allSources
    .filter((s) => cited.has(s.url))
    .map((s) => ({
      url: s.url,
      title: s.title,
      snippet: s.content?.slice(0, 280) ?? '',
      usedInSection: 'unknown',
    }))

  return {
    bodyMarkdown,
    sources,
    modelUsed: CLAUDE_MODEL,
    promptVersion: CREDIBLE_FEAR_PROMPT_VERSION,
  }
}
