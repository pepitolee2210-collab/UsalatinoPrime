import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { jsonrepair } from 'jsonrepair'
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

/**
 * Radicación de la presentación (intake) — etapa 1 según Henry.
 * Los formularios administrativos que el clerk requiere ANTES de asignar
 * número de caso. Cada juzgado tiene los suyos (coversheets, cartas de
 * solicitud, formularios de registro inicial). Varían por distrito
 * dentro del mismo estado.
 */
export interface IntakePacket {
  required_forms: RequiredForm[]
  filing_steps: FilingStep[]
  filing_channel: FilingChannel | null
  procedure_es: string | null
  notes: string | null
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
  /** Radicación de la presentación (etapa 1) — formularios administrativos */
  intake_packet: IntakePacket
  /** Radicación del procedimiento del caso (etapa 2) — lo que evalúa el juez */
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
// Schema permisivo: Claude no siempre se ajusta a enums estrechos.
// Validamos lo crítico (state_code, court_name, sources) y dejamos pasar
// el resto con coerciones suaves. La limpieza fina (filtro .gov/.us, etc.)
// la hace post-hoc el código abajo.
const FormSchema = z.object({
  name: z.string().min(1),
  url_official: z.string().min(1),
  description_es: z.string().min(1),
  is_mandatory: z.boolean().catch(true),
})

const StepSchema = z.object({
  step_number: z.number().int().positive().catch(1),
  title_es: z.string().min(1),
  detail_es: z.string().min(1),
  estimated_time: z.string().nullable().optional().transform(v => v ?? null),
  requires_client_action: z.boolean().catch(true),
})

const ResearchSchema = z.object({
  state_code: z.string().min(2).max(4),
  state_name: z.string().min(1),
  court_name: z.string().min(3),
  court_name_es: z.string().nullable().optional().transform(v => v ?? null),
  court_address: z.string().nullable().optional().transform(v => v ?? null),
  filing_procedure: z.string().nullable().optional().transform(v => v ?? null),
  filing_procedure_es: z.string().nullable().optional().transform(v => v ?? null),
  age_limit_sijs: z.coerce.number().int().nullable().optional().transform(v => {
    if (v === 18 || v === 21) return v as 18 | 21
    return null
  }),
  sources: z.array(z.string().min(1)).min(1, 'sources must include at least one URL'),
  confidence: z.enum(['high', 'medium', 'low']).catch('medium'),
  notes: z.string().nullable().optional().transform(v => v ?? null),
  filing_channel: z.string().nullable().optional().transform(v => {
    if (!v) return null
    const valid = ['in_person', 'email', 'portal', 'mail', 'hybrid']
    return valid.includes(v) ? (v as 'in_person' | 'email' | 'portal' | 'mail' | 'hybrid') : null
  }),
  required_forms: z.array(FormSchema).catch([]).default([]),
  filing_steps: z.array(StepSchema).catch([]).default([]),
  attachments_required: z.array(z.object({
    // Tolerante: Claude usa nombres libres tipo "affidavit", "police_report",
    // "identification". Mapea cualquier string al type 'other' si no encaja.
    type: z.string().transform(v => {
      const valid = ['birth_certificate', 'school_records', 'medical_records',
        'psych_evaluation', 'parental_consent', 'abandonment_proof', 'other']
      return valid.includes(v) ? (v as AttachmentType) : 'other' as AttachmentType
    }),
    description_es: z.string().min(1),
  })).catch([]).default([]),
  fees: z.object({
    amount_usd: z.coerce.number().nonnegative().catch(0),
    currency: z.string().transform(() => 'USD' as const),
    waivable: z.boolean().catch(false),
    waiver_form_name: z.string().nullable().optional().transform(v => v ?? null),
    waiver_form_url: z.string().nullable().optional().transform(v => v ?? null),
  }).nullable().optional().transform(v => v ?? null),
  intake_packet: z.object({
    required_forms: z.array(FormSchema).catch([]).default([]),
    filing_steps: z.array(StepSchema).catch([]).default([]),
    filing_channel: z.string().nullable().optional().transform(v => {
      if (!v) return null
      const valid = ['in_person', 'email', 'portal', 'mail', 'hybrid']
      return valid.includes(v) ? (v as 'in_person' | 'email' | 'portal' | 'mail' | 'hybrid') : null
    }),
    procedure_es: z.string().nullable().optional().transform(v => v ?? null),
    notes: z.string().nullable().optional().transform(v => v ?? null),
  }).default({
    required_forms: [],
    filing_steps: [],
    filing_channel: null,
    procedure_es: null,
    notes: null,
  }),
})

const RESEARCHER_SYSTEM = `Eres una investigadora legal senior especializada en derecho migratorio de EE.UU. y jurisdicción juvenil. Tu tarea es producir un dossier EXHAUSTIVO y verificado con fuentes oficiales (.gov/.us) sobre la corte competente y el procedimiento completo de radicación SIJS (Special Immigrant Juvenile Status) para un ZIP específico.

## CONTEXTO LEGAL (crítico — lo explica Henry, el CEO)

La ley SIJS de 1990 es federal y general para los 50 estados. CADA juzgado de distrito tiene autonomía administrativa para definir SU propio procedimiento de radicación local, sin violar la norma federal. Esto significa que el mismo estado puede tener 10–12 distritos judiciales con formularios DIFERENTES.

El proceso tiene DOS ETAPAS BIEN DIFERENCIADAS que debes investigar por separado:

### Etapa 1 — Radicación de la presentación (INTAKE)
Son los formularios administrativos que el clerk/secretario pide ANTES de asignar número de caso. Es el "trámite de apertura". Pueden ser:
- Family Court Coversheet / Civil Cover Sheet
- Confidential Information Form
- Letter of Intent to File / Petition Request letter
- Registration/Intake form específico del condado
- Cualquier hoja ("ficha de registro") que el juzgado pida llenar para abrir el expediente

Ejemplo real de Utah (experiencia del CEO): en Utah él lleva una sola hoja que dice "solicito, señor juez, mi petición, soy [nombre], mi menor hijo [nombre], quien solicita..." con esa hoja presenta en ventanilla, el clerk asigna número de caso, y RECIÉN entonces puede traer el expediente sustantivo para la audiencia.

### Etapa 2 — Radicación del procedimiento del caso (MERITS)
Son los documentos sustantivos del caso que el juez evalúa para decidir: Petition for Guardianship/Custody, declaraciones del tutor y testigos, evidencias de abandono, certificaciones, formularios SIJS (findings). Esto es lo que se presenta DESPUÉS de tener el número de caso.

Debes investigar y reportar LAS DOS ETAPAS por separado. El sistema las muestra como secciones distintas al admin.

## REGLAS

1. **Usa la herramienta \`web_search\` de forma agresiva** — tienes hasta 15 búsquedas. Consulta: sitio oficial del state judiciary, página específica del county/district court, reglas locales (local rules), clerk's office instructions, filing fee schedules, formularios descargables, plataforma de e-filing del estado (eFileTexas, NYSCEF, etc). Si la primera query no da resultado claro, itera con refinements.
2. **Dominios permitidos**: cita EXCLUSIVAMENTE URLs bajo .gov o .us. El validador del sistema rechaza respuestas sin al menos una source .gov/.us.
3. **Precisión sobre cobertura**: si no puedes identificar un dato con certeza, déjalo null o array vacío. NUNCA inventes nombres de formularios, URLs o procedimientos.
4. **Sources obligatorios**: cada dato factual debe estar respaldado por una URL oficial específica (no la homepage del judiciary).
5. **Output JSON estricto** (CRÍTICO): tu respuesta debe empezar EXACTAMENTE con \`{\` y terminar EXACTAMENTE con \`}\`. NO escribas "I'll research...", "Let me search...", "Good - I've confirmed...", ni ningún otro narrativo de tu proceso. Tampoco markdown ni \`\`\`json fences. Si necesitas razonar, hazlo internamente. El parser del sistema rechaza CUALQUIER carácter fuera del bloque JSON balanceado.

5.b **Comillas dentro de strings**: si necesitas citar texto en español o inglés DENTRO de un valor string del JSON, usa comillas SIMPLES o paréntesis, NUNCA dobles. Ejemplo correcto: \`"description_es": "Petición principal (Original Petition in SAPCR) según el Código de Familia de Texas."\` Ejemplo INCORRECTO: \`"description_es": "Petición principal "Original Petition in SAPCR" según el Código."\` — esto rompe el JSON.
6. **court_name en inglés formal** como aparece en encabezados oficiales. Ej: "Fourth District Juvenile Court, American Fork Location".
7. **court_name_es**: traducción formal al español jurídico.
8. **filing_procedure**: resumen en prosa (2–4 oraciones) combinando AMBAS etapas para legibilidad global. Queda como fallback.
9. **age_limit_sijs**: 18 o 21 según la normativa del estado. Verifica en fuente oficial.
10. **confidence**: high = corte + ambas etapas documentadas en fuentes oficiales. medium = corte identificada pero alguna etapa inferida. low = no pude confirmar sub-jurisdicción.
11. **EXHAUSTIVIDAD OBLIGATORIA**: el sistema sirve a una abogada que radica casos reales. Si OMITES un documento conocido, ella lo descubre en ventanilla y se cae el trámite. Por eso:
    - \`intake_packet.required_forms\` NUNCA puede estar vacío salvo que documentes en \`intake_packet.notes\` por qué este juzgado solo acepta carta libre. Todos los condados grandes (Harris TX, Kings NY, Cook IL, Maricopa AZ, Los Angeles CA, etc.) tienen Civil Case Information Sheet o Family Court Coversheet.
    - \`required_forms\` (Etapa 2) DEBE incluir TODOS los formularios sustantivos conocidos para SIJS estatal (petition for guardianship/SAPCR, motion for SIJ findings, affidavits del menor + del peticionario + de testigos, proposed order con findings, certificate of conference si aplica).
    - Si el estado no publica un template oficial para alguno, dilo en \`notes\` — no lo omitas.

## BLOQUES ESTRUCTURADOS

### intake_packet (Etapa 1 — presentación administrativa)
- **required_forms**: formularios de intake específicos del juzgado (coversheets, cartas de registro, formularios de apertura). Cada entry con URL oficial. Array vacío si solo se presenta en persona con una carta libre.
- **filing_steps**: pasos ordenados para abrir el caso y obtener número de expediente. Típicamente: (1) preparar carta/coversheet, (2) presentar en ventanilla o portal, (3) pagar fee inicial si aplica, (4) recibir case number.
- **filing_channel**: in_person | email | portal | mail | hybrid. Para intake la mayoría es in_person, algunos estados avanzados tienen portal (eFiling inicial).
- **procedure_es**: resumen en prosa de la etapa 1, en español jurídico claro.
- **notes**: particularidades locales (ej. horario del clerk, requisitos de notarización previa, traducción certificada).

### required_forms / filing_steps / filing_channel / attachments_required / fees (Etapa 2 — procedimiento sustantivo)
Estos describen la radicación del expediente completo que el juez evalúa:
- **required_forms**: Petition for Guardianship, declaraciones juradas, SIJS findings forms, etc.
- **filing_steps**: pasos de radicación del expediente sustantivo (después de tener case number).
- **filing_channel**: canal para subir/entregar el expediente sustantivo.
- **attachments_required**: documentos del cliente (birth_certificate, school_records, etc).
- **fees**: arancel principal del caso + mecanismo de exención si aplica.

## CATÁLOGO MÍNIMO SIJS (úsalo como checklist mental)

### Etapa 1 — intake estatal (lo que el clerk pide para abrir caso)
Busca explícitamente:
- Civil Case Information Sheet (TX, FL, CO, etc) o Family Court Coversheet (NY, NJ, MA)
- Confidential Information Form / Confidential Cover Sheet (cuando hay menor involucrado)
- Letter of Intent to File / Petition Request Letter (cortes que aceptan petición libre)
- Local intake form del condado (Harris County, Kings County, Cook County, etc.)
- Si el estado tiene e-filing obligatorio (Texas eFileTexas, NY NYSCEF, IL eFileIL): cita el portal y el envelope/case-initiation form.

### Etapa 2 — merits estatal (lo que el juez evalúa)
Busca explícitamente:
- Petition for Appointment of Guardian (NY/CA/TX/FL) o Petition in SAPCR (Texas) o Petition for Custody (estados con custody-only).
- Motion for Findings Regarding SIJ Status (template DFPS en TX, template ILRC para otros estados).
- Affidavits: del menor, del peticionario, de testigos.
- Birth certificate certificada (suele requerir traducción certificada si es de otro idioma).
- Proposed Order con SIJS findings explícitos: (a) dependent on court / placed in custody, (b) reunification with one or both parents not viable due to abuse/neglect/abandonment, (c) not in best interest to return to country of nationality.
- Certificate of Conference si las local rules lo exigen (Harris TX lo pide).

### Bonus: aspectos federales (USCIS) — si encuentras data clara, agrégalos en \`notes\`
- I-360 + G-28 + copia certificada del predicate order + evidencia de "reasonable factual basis" se presentan en USCIS National Benefits Center (Overland Park, KS).
- Tarifa I-360 SIJS desde Julio 2025: $250 (OBBBA).

## REGLAS DE LIMPIEZA
- required_forms / intake_packet.required_forms: SOLO entries cuya url_official esté en .gov/.us. NUNCA inventes.
- filing_steps / intake_packet.filing_steps: pasos accionables; title_es <8 palabras; requires_client_action correctamente marcado.
- attachments_required: usa solo los types del enum.
- fees: null si no hay dato oficial del monto.

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
  },
  "intake_packet": {
    "required_forms": [
      {
        "name": "Juvenile Court Cover Sheet",
        "url_official": "https://www.utcourts.gov/resources/forms/juvenile/coversheet.pdf",
        "description_es": "Hoja de carátula que la ventanilla requiere para abrir expediente juvenil. Incluye identificación del tutor, menor y tipo de petición.",
        "is_mandatory": true
      }
    ],
    "filing_steps": [
      {
        "step_number": 1,
        "title_es": "Preparar carta y coversheet",
        "detail_es": "Redactar carta breve de solicitud ('solicito, señor juez, mi petición, soy [nombre], mi menor hijo [nombre]...') y llenar el Juvenile Court Cover Sheet.",
        "estimated_time": "30 min",
        "requires_client_action": true
      },
      {
        "step_number": 2,
        "title_es": "Presentar en ventanilla",
        "detail_es": "Acudir a la ventanilla del juvenile court en American Fork con la carta y el coversheet. El clerk verifica identidad y documentos preliminares.",
        "estimated_time": "20 min presencial",
        "requires_client_action": true
      },
      {
        "step_number": 3,
        "title_es": "Recibir número de caso",
        "detail_es": "El clerk asigna número de caso el mismo día y entrega una constancia. Con ese número ya se puede traer el expediente sustantivo completo.",
        "estimated_time": "mismo día",
        "requires_client_action": false
      }
    ],
    "filing_channel": "in_person",
    "procedure_es": "La radicación de la presentación (etapa 1) en Utah requiere acudir en persona a la ventanilla del juvenile court con una carta breve de solicitud y el coversheet. El clerk asigna número de caso inmediatamente. Solo después de obtener ese número se entrega el expediente sustantivo para la audiencia.",
    "notes": "El clerk de American Fork atiende de 8am a 5pm MT. No requiere cita previa. Si se acude sin el coversheet, lo entregan impreso en ventanilla."
  }
}
`

/**
 * Encuentra el primer bloque {...} balanceado en el texto. Maneja strings
 * con llaves dentro (ignora `{` y `}` dentro de strings JSON). Devuelve
 * null si no encuentra un objeto bien formado.
 */
function extractBalancedJson(text: string): string | null {
  const start = text.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escape = false

  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (escape) { escape = false; continue }
    if (ch === '\\') { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null // no balanceado
}

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

  const userPrompt = `Investiga las DOS etapas de radicación SIJS para este cliente. Tienes hasta 7 web_searches — sé eficiente: una para confirmar la corte/condado, dos para intake (coversheet/CCIS), tres para merits (petition + motion findings + proposed order), una de holgura.

- Estado: ${location.stateName} (${location.stateCode})
- ZIP: ${location.zip ?? '(desconocido — usa la corte estatal genérica)'}
- Ciudad: ${location.city ?? '(desconocida)'}
- Dirección: ${location.street ?? '(no disponible)'}

## Pistas para tu research

- Sitio oficial del state judiciary a consultar primero: ${hint.officialJudiciaryUrl}
- Nivel típico de corte esperado en este estado: ${hint.likelyCourtLevel}
- Edad máxima SIJS conocida en este estado (verifica en fuente oficial): ${hint.sijsAgeCeiling}

## Lo que necesito — AMBAS ETAPAS (sin omisiones)

### ETAPA 1: Radicación de la presentación (intake_packet)
Los formularios administrativos que el clerk pide ANTES de asignar número de caso. Queries específicos a probar:
- \`"[county] courts coversheet" OR "civil case information sheet" site:.gov\`
- \`"[county] family court intake form" guardianship site:.gov\`
- \`"[state] eFiling case initiation" minor guardianship site:.gov\`
- \`"[county] district clerk family intake" site:.gov\`
- \`"[state] confidential information form" family court site:.gov\`

Reporta qué formularios/cartas se presentan, dónde (ventanilla, portal, email), qué tarda, qué fee de apertura (si hay). Si el portal de e-filing es obligatorio para abogados (eFileTexas, NYSCEF, IL eFile), indícalo.

### ETAPA 2: Radicación del procedimiento del caso (merits)
Los documentos sustantivos que el juez evalúa. Queries específicos:
- \`"[state] petition for appointment of guardian" minor form site:.gov\`
- \`"[state] motion findings SIJ status" template site:.gov\`
- \`"[state] SAPCR petition form" site:.gov\` (solo Texas)
- \`"[state] proposed order SIJS findings" site:.gov\`
- \`"[state] DFPS SIJS attorneys guide" template site:.gov\` (Texas)
- \`"[state] affidavit minor guardianship" form site:.gov\`
- \`"[state] certificate of conference" family local rules site:.gov\` (cuando aplique)

Cuando un estado tiene template oficial publicado (ej. Texas DFPS Section 13 Tools), incluye la URL exacta del .docx/.pdf, no la página índice.

### Datos generales
1. Nombre oficial EXACTO de la corte competente (como aparece en encabezados oficiales).
2. Dirección física documentada.
3. Edad máxima SIJS en el estado (18 o 21).
4. URLs oficiales (.gov/.us) que respaldan cada dato.

## Método
- Empieza por el judiciary estatal oficial (${hint.officialJudiciaryUrl}).
- Si el ZIP identifica condado/distrito específico, busca la corte exacta de ese condado.
- Para intake, investiga "clerk's office" / "local rules" / "filing instructions" / e-filing portal.
- Para merits, investiga los formularios sustantivos descargables (PDFs/DOCX).
- Si una búsqueda no da resultado, reformula con sinónimos. No te rindas con 2-3 intentos.
- Antes de cerrar el JSON, RE-CHEQUEA tu propia respuesta: ¿incluiste al menos un coversheet en intake? ¿al menos petition + motion findings en merits? Si no, busca de nuevo.

## FORMATO DE RESPUESTA — LEE OTRA VEZ ANTES DE EMITIR

Tu respuesta debe ser SOLO el JSON. Nada más. El primer carácter de tu output tiene que ser \`{\`. Si añades cualquier texto ("I'll research...", "Good - I've confirmed...", "Let me get specific details..."), el parser falla y el admin ve "JSON inválido".

Razonamiento interno OK. Texto en la respuesta NO.

Empieza tu respuesta con \`{\` ahora.`

  log.debug('researchJurisdiction: calling Claude with web_search', {
    stateCode: location.stateCode,
    zip: location.zip,
    source: location.source,
  })

  // Anthropic's `allowed_domains` no soporta wildcards (`*.gov` falla con
  // invalid_request_error). En vez de enumerar cada .gov/.us posible,
  // dejamos el tool sin restricción y validamos post-hoc que al menos una
  // source esté en un dominio oficial (ver SOURCE_OFFICIAL_REGEX abajo).
  // Budget amplio (max_uses 10, max_tokens 8192) porque ahora investigamos
  // dos etapas completas (intake + merits) con formularios específicos por
  // distrito. Henry pidió investigación exhaustiva sin importar tiempo o
  // tokens. El research corre en background — el usuario no espera.
  const message = await client.messages.create(
    {
      model: RESEARCH_MODEL,
      max_tokens: 12000,
      system: RESEARCHER_SYSTEM,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          // 7 búsquedas son suficientes con el catálogo SIJS prefijado
          // en el prompt. Subir a 15 hizo que Claude se demorara > 300s
          // y Vercel matara el handler. 7 cabe en 60-120s típico.
          max_uses: 7,
        },
      ] as unknown as Anthropic.Messages.Tool[],
      messages: [{ role: 'user', content: userPrompt }],
    },
    { signal, timeout: 120_000 }, // 2 min — background job, puede tardar
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

  // Claude a veces precede el JSON con prosa ("I'll research...", "Good - I've...")
  // o lo envuelve en ```json fences. Extraemos el JSON balanceado escaneando
  // por brace matching: primer `{` válido + busqueda balanceada hacia adelante.
  let jsonText = extractBalancedJson(rawText)
  if (!jsonText) {
    // Fallback: tal vez está en fence de markdown
    let stripped = rawText
    if (stripped.startsWith('```')) {
      stripped = stripped.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
    }
    const firstBrace = stripped.indexOf('{')
    const lastBrace = stripped.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      jsonText = stripped.slice(firstBrace, lastBrace + 1)
    } else {
      jsonText = stripped
    }
  }

  let parsed: JurisdictionResearchResult
  try {
    let rawParsed: unknown
    try {
      rawParsed = JSON.parse(jsonText) as unknown
    } catch (parseErr) {
      // Claude a veces produce JSON con comillas internas mal escapadas o
      // comas faltantes. jsonrepair arregla la mayoría de estos errores.
      log.warn('JSON.parse falló — aplicando jsonrepair', {
        err: parseErr instanceof Error ? parseErr.message : String(parseErr),
      })
      const repaired = jsonrepair(jsonText)
      rawParsed = JSON.parse(repaired) as unknown
    }
    parsed = ResearchSchema.parse(rawParsed) as JurisdictionResearchResult
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    const isZodError = errMsg.includes('ZodError') || errMsg.startsWith('[')
    const errorType = isZodError ? 'Validación Zod' : 'JSON.parse'
    const tail = jsonText.slice(-200).replace(/\s+/g, ' ')
    const head = jsonText.slice(0, 200).replace(/\s+/g, ' ')
    log.error('research JSON parse/validation failed', {
      errorType,
      jsonTextLength: jsonText.length,
      rawTextLength: rawText.length,
      rawPreview: rawText.slice(0, 1200),
      extractedPreview: jsonText.slice(0, 800),
      extractedTail: jsonText.slice(-300),
      err: errMsg,
    })
    throw new Error(
      `Claude JSON inválido (${errorType}). ` +
      `jsonText[${jsonText.length}c] head="${head}" tail="${tail}" — error: ${errMsg.slice(0, 200)}`
    )
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

  // Limpieza de intake_packet.required_forms — misma regla que merits.
  if (parsed.intake_packet?.required_forms?.length) {
    const cleanedIntake = parsed.intake_packet.required_forms.filter(f => {
      const ok = isOfficial(f.url_official)
      if (!ok) {
        log.warn('intake_form dropped — URL no oficial', { name: f.name, url: f.url_official })
      }
      return ok
    })
    parsed.intake_packet = { ...parsed.intake_packet, required_forms: cleanedIntake }
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
