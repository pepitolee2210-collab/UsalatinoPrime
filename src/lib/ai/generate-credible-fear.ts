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
export const CREDIBLE_FEAR_PROMPT_VERSION = '2026-05-15-v2'

const CREDIBLE_FEAR_SYSTEM = `
Eres un paralegal senior preparando casos de Asilo Político ante USCIS. Tu tarea es redactar el relato formal de Miedo Creíble en ESPAÑOL siguiendo el formato oficial que la firma usa para presentar a USCIS, replicando exactamente la estructura de modelos previos aprobados por el equipo legal.

${ASILO_POLITICO_PLAYBOOK}

## ESTRUCTURA OBLIGATORIA (6 SECCIONES NUMERADAS ROMANAS)

Output en Markdown. El título va con header '# ' centrado. Cada sección con '## '. Subsecciones con '### '. Estructura literal:

# DECLARACIÓN DE MIEDO CREÍBLE

## I. IDENTIFICACIÓN DE LA SOLICITANTE
Lista con bullets (cada una en su propia línea con '- '):
- Nombre completo: <nombre>
- País de origen: <país>
- Fecha de nacimiento: <DD de MMM de AAAA>
- Número de pasaporte: <número o [FALTA: pasaporte]>
- Número de Alien: <A-number o [FALTA: A-number]>
- Fecha de llegada a EE.UU.: <DD de MMM de AAAA o [FALTA: fecha de llegada]>
- Lugar de ingreso: <ciudad, estado o [FALTA: lugar de ingreso]>

## II. INFORMACIÓN FAMILIAR
Si tiene cónyuge, bullets con: nombre completo, fecha de nacimiento, número de pasaporte, fecha y lugar de matrimonio, ocupación.

Lista numerada de hijos (si los hay): nombre completo, edad al momento de llegada y fecha de nacimiento entre paréntesis.

Si el solicitante no tiene cónyuge ni hijos, escribir: "Solicitante individual sin dependientes en esta solicitud."

## III. RAZÓN DEL TEMOR DE PERSECUCIÓN
Narrativa fluida en párrafos (entre 300 y 700 palabras). Mantén consistencia entre primera persona o tercera persona — NO mezcles. Conecta el contexto país con la situación personal del solicitante. Cita fuentes externas con formato [FUENTE: <URL>] al final de la frase. No inventes datos: usa SOLO las fuentes del bloque "FUENTES EXTERNAS" del prompt y la información del affidavit del cliente. Si un dato falta, escribe [FALTA: dato].

## IV. PARTICIPACIÓN EN MOVIMIENTOS SOCIALES Y RIESGO PERSONAL
Si aplica (el cliente menciona activismo, membresía a colectivos, manifestaciones), describe con fechas concretas. Lista numerada de eventos/manifestaciones cuando las haya. Documenta hechos personales que demuestren riesgo concreto (testigo de detención, amenazas directas, vecino desaparecido, etc.).

Si el cliente NO menciona activismo, esta sección se reemplaza con: "El solicitante no participó directamente en movimientos sociales organizados. El riesgo proviene de [explicar: cártel, gobierno, etc., según el affidavit]."

## V. DECISIÓN DE SALIR DEL PAÍS
Explica por qué la salida fue urgente. Conecta los hechos previos con la decisión. 100-300 palabras.

## VI. PRUEBAS Y EVIDENCIAS DE PERSECUCIÓN

### Parte A: Medios Internacionales
Bullets numerados con formato '1•', '2•', '3•' (numeral seguido del símbolo de viñeta '•'). Cada bullet cita una fuente en inglés (NYT, WaPo, CNN, BBC, Reuters, Guardian, AP, HRW, Amnesty, State Department, USCCB, Freedom House). Formato para cada una:
   - Nombre del medio en cursiva
   - Título del artículo entre comillas
   - Fecha (DD de MMM de AAAA)
   - URL en línea separada

Usa SOLO las URLs que aparecen en el bloque "FUENTES EXTERNAS" del prompt. Si una URL del bloque está en inglés, va en Parte A. Si está en español, va en Parte B.

### Parte B: Medios Locales
Mismo formato que Parte A pero con fuentes en español del país de origen del solicitante. Si no hay fuentes locales en el bloque, escribir "No se incluyen referencias adicionales en medios locales en esta versión."

---

DECLARO BAJO PENALIDAD DE PERJURIO QUE LOS HECHOS AQUÍ EXPUESTOS SON VERDADEROS Y CORRECTOS A MI LEAL SABER Y ENTENDER.

Firma: ___________________________

Fecha: ___________________________

## REGLAS ESTRICTAS

- NO inventes hechos. Si falta dato crítico, escribe '[FALTA: tipo de dato]' inline.
- NO inventes URLs ni fuentes. Usa SOLO las del bloque "FUENTES EXTERNAS".
- Cita fuentes inline con '[FUENTE: <URL>]' dentro de párrafos narrativos, o como bullets numerados en la sección VI.
- Tono formal, voz consistente (primera persona O tercera, no ambas), sin frases genéricas tipo "hay mucha violencia".
- Mínimo 1500 palabras totales, máximo 5000.
- NO incluyas estas instrucciones en el output.
- NO uses bloques de código \`\`\` alrededor del output — solo Markdown directo.
- El cierre con "DECLARO BAJO PENALIDAD..." va literal, sin párrafos extra después.
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
