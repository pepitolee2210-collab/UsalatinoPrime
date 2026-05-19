// Genera la "Carta de Apelación" (brief ante la BIA) que refuta la decisión
// adversa del Juez de Inmigración en un caso de asilo denegado.
//
// Estrategia: envía 4 PDFs nativos a Claude API (no Gemini OCR previo):
//   1. Pasaporte del cliente              (apelacion_pasaporte)
//   2. Expediente completo de Asilo       (apelacion_asilo_completo)
//   3. Auto de Denegación del Juez        (apelacion_denegacion_juez)
//   4. Template — caso ganador (Lina Vanegas) en /public/templates/...
//
// El template se marca `cacheable: true` → se cachea con `cache_control:ephemeral`
// y reduce ~70% el costo en regeneraciones.

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  CLAUDE_MODEL,
  generateTextWithDocuments,
  type DocumentInput,
  type UsageStats,
} from './anthropic-client'
import { createLogger } from '@/lib/logger'

const log = createLogger('appeal-letter')

// ──────────────────────────────────────────────────────────────────
// Constantes
// ──────────────────────────────────────────────────────────────────

/**
 * Versión del prompt. Incrementar cuando cambie el system prompt para
 * correlacionar calidad del output con cambios en la versión.
 */
export const APPEAL_LETTER_PROMPT_VERSION = '2026-05-19-v1'

/** Path en disco del template PDF (caso ganador de referencia). */
const APPEAL_TEMPLATE_DISK_PATH = 'public/templates/apelacion-letter-example.pdf'

/**
 * SHA256 hardcoded del template. Si el archivo en disco cambia, el endpoint
 * devuelve 500 con mensaje claro pidiendo re-hashear. Patrón idéntico al de
 * los formularios AcroForm (`eoir-26-form-schema.ts:PDF_SHA256`).
 */
export const APPEAL_TEMPLATE_SHA256 =
  'cd56b0bba9ea690f36312f363843b03a2ddc55e1fb9cc92034e5dd1c13699ada'

/**
 * Codes de document_types que el cliente carga en la fase de Apelación.
 * Estos están seedeados en `20260518b_apelacion_seed.sql`.
 */
const APPEAL_DOC_CODES = {
  passport: 'apelacion_pasaporte',
  fullAsylum: 'apelacion_asilo_completo',
  judgeDenial: 'apelacion_denegacion_juez',
} as const

// ──────────────────────────────────────────────────────────────────
// System prompt
// ──────────────────────────────────────────────────────────────────

const APPEAL_LETTER_SYSTEM = `Eres un abogado de inmigración senior, especialista en apelaciones ante la Junta de Apelaciones de Inmigración (BIA, Board of Immigration Appeals) y los Circuit Courts federales. Tu tarea es redactar una Carta de Apelación (brief) en ESPAÑOL para refutar la decisión adversa del Juez de Inmigración (IJ) que negó el asilo del cliente.

# ENTRADA QUE RECIBIRÁS

Adjuntos en el mensaje del usuario habrá hasta 4 PDFs:

1. **Pasaporte del cliente** — para verificar identidad, fechas, nacionalidad.
2. **Expediente completo del Asilo Político** — la solicitud I-589 original, declaraciones, evidencias, todo lo que se presentó al IJ.
3. **Auto de Denegación del Juez** — la decisión escrita del IJ con sus argumentos para negar el asilo. ESTE ES EL DOCUMENTO MÁS IMPORTANTE: refutar SUS ARGUMENTOS es tu objetivo principal.
4. **TEMPLATE — Carta de Apelación ganadora** (caso de Lina Vanegas). Es un EJEMPLO DE FORMATO Y TONO. Replica su ESTRUCTURA (encabezado, secciones numeradas, párrafos jurídicos, conclusión, firma) pero **NO COPIES** nombres, A-Numbers, fechas, hechos ni precedentes específicos del caso de Lina. Cada apelación se redacta sobre los hechos del cliente actual.

# ESTRUCTURA OBLIGATORIA DEL OUTPUT

Devuelve **markdown** con esta estructura (8 secciones romanas + encabezado + cierre):

\`\`\`
# CARTA DE APELACIÓN ANTE LA JUNTA DE APELACIONES DE INMIGRACIÓN

**Apelante:** {nombre completo}
**Número de Extranjero (A-Number):** {A-Number}
**País de origen:** {país}
**Fecha de la decisión del IJ:** {fecha}
**Corte de Inmigración:** {ubicación}

---

## I. RESUMEN PROCESAL DEL CASO

[1–2 párrafos: historia procesal, fechas clave, qué solicitó el cliente, qué decidió el IJ.]

## II. ERRORES LEGALES Y DE HECHO EN LA DECISIÓN DEL JUEZ

[Identifica con precisión los puntos débiles de la decisión judicial. Cita TEXTUALMENTE las frases del auto del IJ que vas a refutar y explica por qué son legalmente erróneas o fácticamente incorrectas. Numéralos: 1., 2., 3., …]

## III. ANÁLISIS DE CREDIBILIDAD — REFUTACIÓN PUNTO POR PUNTO

[Si el IJ negó por credibilidad: cada inconsistencia que mencionó el IJ se aborda por separado, explicando con el expediente por qué NO es una inconsistencia o por qué no afecta el corazón de la solicitud. Cita REAL ID Act §101(a)(3) y precedentes BIA relevantes.]

## IV. CONVENCIÓN CONTRA LA TORTURA (CAT)

[Análisis específico bajo 8 C.F.R. §§ 1208.16–1208.18. Identifica falencias del veredicto en CAT: ¿el IJ aplicó correctamente el estándar "more likely than not"? ¿analizó tortura por aquiescencia gubernamental? ¿consideró country conditions actualizadas? Cita Matter of J-R-G-P-, Matter of M-A-M-Z- u otros precedentes BIA aplicables.]

## V. DOCTRINA DEL TERCER PAÍS — VIABILIDAD

[Analiza, según el expediente, si el "Safe Third Country / firm resettlement" aplica o NO debería ser impedimento. Cita 8 U.S.C. §1158(b)(2)(A)(vi) y Matter of A-G-G-. Si el cliente nunca obtuvo residencia firme en un tercer país, explícalo claramente.]

## VI. PRECEDENTES BIA Y CIRCUIT COURT FAVORABLES

[Lista 3–6 precedentes específicos donde la BIA o un Circuit revirtió decisiones de IJ por razones análogas. Formato Bluebook: *Matter of X-Y-Z-*, 28 I&N Dec. 123 (BIA 2023); *Doe v. Garland*, 99 F.4th 100 (9th Cir. 2024). Solo cita precedentes REALES que conozcas con certeza — si no estás 100% seguro, omite la cita y argumenta en lenguaje propio.]

## VII. ARGUMENTOS GANADORES (PUNTOS ESTRATÉGICOS)

[Resume los 3–5 argumentos más fuertes para esta apelación específica. Esto guía al equipo legal sobre dónde poner el énfasis en el brief oral si la BIA concede argumento.]

## VIII. CONCLUSIÓN Y PETICIÓN

[Pide explícitamente: (a) reverse de la decisión del IJ y otorgamiento de asilo, O (b) remand al IJ con instrucciones específicas para considerar pruebas/argumentos no atendidos. Cierra con la fórmula legal estándar.]

---

**Respetuosamente,**

_______________________________
{nombre del representante / firma}

Fecha: {fecha}
\`\`\`

# REGLAS CRÍTICAS

1. **Tono:** formal jurídico, en español de Estados Unidos legal style. NUNCA coloquial.
2. **Citas:** solo precedentes REALES que conozcas con certeza. Si dudas, argumenta en lenguaje propio sin inventar citas.
3. **NO inventes hechos:** todo dato de identidad, fechas, lugares debe extraerse de los PDFs adjuntos. Si un dato no aparece en los PDFs, escribe "[A confirmar]".
4. **NO copies del template:** el template de Lina Vanegas es solo FORMATO. Cada apelación se redacta de cero sobre los hechos reales del cliente actual.
5. **Longitud:** mínimo 2000 palabras, máximo ~6000. Calidad sobre cantidad.
6. **Markdown estricto:** usa los encabezados \`#\`, \`##\` y separadores \`---\` exactamente como en la plantilla del output arriba. El sistema convertirá esto a DOCX automáticamente; markdown malformado rompe el formato.
`.trim()

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

interface ClientDocumentRef {
  id: string
  document_key: string | null
  file_path: string | null
  name: string
  document_types: { code: string | null } | { code: string | null }[] | null
}

/** Resuelve el código de tipo desde la fila joineada (Supabase devuelve array u objeto). */
function getDocCode(d: ClientDocumentRef): string | null {
  const dt = Array.isArray(d.document_types) ? d.document_types[0] : d.document_types
  return dt?.code ?? null
}

async function downloadCaseDocPdf(
  service: SupabaseClient,
  caseId: string,
  code: string,
): Promise<{ bytes: Uint8Array; name: string } | null> {
  const { data: rows, error } = await service
    .from('documents')
    .select(
      `id, document_key, file_path, name,
       document_types ( code )`,
    )
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })
  if (error || !rows) {
    log.warn('error consultando documents', { caseId, error })
    return null
  }
  const match = (rows as ClientDocumentRef[]).find((d) => getDocCode(d) === code)
  if (!match || !match.file_path) {
    return null
  }
  const { data, error: dlErr } = await service.storage
    .from('case-documents')
    .download(match.file_path)
  if (dlErr || !data) {
    log.warn('download falló', { code, filePath: match.file_path, error: dlErr })
    return null
  }
  const ab = await data.arrayBuffer()
  return { bytes: new Uint8Array(ab), name: match.name }
}

function readTemplateWithSha(): Uint8Array {
  const disk = path.join(process.cwd(), APPEAL_TEMPLATE_DISK_PATH)
  const bytes = readFileSync(disk)
  const actual = createHash('sha256').update(bytes).digest('hex')
  if (actual !== APPEAL_TEMPLATE_SHA256) {
    throw new Error(
      `Template SHA256 mismatch. Esperado ${APPEAL_TEMPLATE_SHA256}, encontrado ${actual}. ` +
        `Si actualizaste el template, re-hashea y actualiza APPEAL_TEMPLATE_SHA256 en generate-appeal-letter.ts.`,
    )
  }
  return new Uint8Array(bytes)
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '[A confirmar]'
  try {
    return new Date(iso).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

// ──────────────────────────────────────────────────────────────────
// API pública
// ──────────────────────────────────────────────────────────────────

export interface GenerateAppealLetterInput {
  caseId: string
  service: SupabaseClient
  signal?: AbortSignal
}

export interface AppealLetterOutput {
  bodyMarkdown: string
  modelUsed: string
  promptVersion: string
  usage: UsageStats
  generationSeconds: number
  /** Documentos del cliente que se enviaron a Claude. Útil para audit. */
  documentsUsed: Array<{ code: string; name: string; bytes: number }>
}

/** Faltan documentos requeridos — el endpoint llamador devolverá 400. */
export class MissingClientDocumentError extends Error {
  constructor(public missingCodes: string[]) {
    super(
      `Faltan documentos del cliente: ${missingCodes.join(', ')}. ` +
        `Pídele al cliente que los suba en su portal antes de generar la carta.`,
    )
    this.name = 'MissingClientDocumentError'
  }
}

export async function generateAppealLetter(
  input: GenerateAppealLetterInput,
): Promise<AppealLetterOutput> {
  const t0 = Date.now()

  // 1. Cargar caso + cliente
  const { data: caseRow, error: caseErr } = await input.service
    .from('cases')
    .select(
      `id, case_number, current_phase, decision_date, state_us, client_id,
       service:service_catalog(slug)`,
    )
    .eq('id', input.caseId)
    .single()
  if (caseErr || !caseRow) {
    throw new Error(`Caso no encontrado: ${input.caseId}`)
  }

  const { data: profile } = await input.service
    .from('profiles')
    .select('first_name, last_name, middle_name, a_number, country_of_birth, nationality')
    .eq('id', caseRow.client_id)
    .single()

  const fullName = [profile?.first_name, profile?.middle_name, profile?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim() || '[A confirmar]'
  const aNumber = profile?.a_number?.trim() || '(no registrado)'
  const country = profile?.country_of_birth?.trim()
    || profile?.nationality?.trim()
    || '[A confirmar]'
  const decisionDate = formatDate(caseRow.decision_date as string | null)
  const stateUs = caseRow.state_us || '[A confirmar]'
  const caseNumber = caseRow.case_number || '(sin asignar)'

  // 2. Descargar los 3 PDFs del cliente desde Storage
  const docResults = await Promise.all([
    downloadCaseDocPdf(input.service, input.caseId, APPEAL_DOC_CODES.passport),
    downloadCaseDocPdf(input.service, input.caseId, APPEAL_DOC_CODES.fullAsylum),
    downloadCaseDocPdf(input.service, input.caseId, APPEAL_DOC_CODES.judgeDenial),
  ])
  const [passport, fullAsylum, judgeDenial] = docResults
  const missing: string[] = []
  if (!passport) missing.push(APPEAL_DOC_CODES.passport)
  if (!fullAsylum) missing.push(APPEAL_DOC_CODES.fullAsylum)
  if (!judgeDenial) missing.push(APPEAL_DOC_CODES.judgeDenial)
  if (missing.length > 0) {
    throw new MissingClientDocumentError(missing)
  }

  // 3. Cargar template desde disco con verificación de SHA
  const templateBytes = readTemplateWithSha()

  // 4. Construir prompt enriquecido con metadata del caso
  const userText = [
    '# DATOS DEL CASO (este cliente)',
    `- Nombre completo: ${fullName}`,
    `- A-Number: ${aNumber}`,
    `- País de origen: ${country}`,
    `- Fecha de la decisión del Juez (apelada): ${decisionDate}`,
    `- Estado del caso (US): ${stateUs}`,
    `- Número de caso interno: ${caseNumber}`,
    '',
    '# INSTRUCCIONES (del equipo legal de la firma)',
    'Analiza la información de este cliente, específicamente el expediente y la decisión del juez adjuntos. Genera un documento que refute los argumentos utilizados por el juez para negar el asilo. Realiza específicamente lo siguiente:',
    '',
    '1. Identifica los puntos débiles de la decisión judicial.',
    '2. Investiga precedentes y apelaciones ganadas en casos de asilo denegados por razones similares.',
    '3. Propone argumentos estratégicos ("puntos ganadores") para fortalecer esta apelación, incluyendo citas de casos exitosos.',
    '4. Enfócate en la Convención contra la Tortura (CAT), analizando posibles falencias del veredicto en este punto.',
    '5. Analiza la viabilidad del "tercer país" según el expediente compartido, determinando por qué aplica o por qué no debería ser impedimento en este caso.',
    '6. Ayúdame a ganar esta apelación.',
    '',
    '# ANEXOS EN ESTE MENSAJE',
    '- Documento 1: Pasaporte del cliente (verificación de identidad).',
    '- Documento 2: Expediente completo del Asilo Político presentado originalmente al IJ.',
    '- Documento 3: Decisión escrita del Juez de Inmigración denegando el asilo (objeto de la apelación).',
    '- Documento 4: TEMPLATE — Carta de Apelación ganadora (caso de Lina Vanegas). Replica su FORMATO y TONO, NO sus datos.',
    '',
    'Redacta la Carta de Apelación completa siguiendo la estructura de 8 secciones definida en el system prompt. Devuelve SOLO markdown — sin explicaciones meta, sin preámbulo. Empieza directamente con el encabezado `# CARTA DE APELACIÓN ANTE LA JUNTA DE APELACIONES DE INMIGRACIÓN`.',
  ].join('\n')

  // 5. Llamar a Claude con los 4 PDFs (template cacheable, clientes no)
  const documents: DocumentInput[] = [
    { pdfBytes: passport!.bytes, title: `Pasaporte — ${passport!.name}` },
    { pdfBytes: fullAsylum!.bytes, title: `Expediente Asilo — ${fullAsylum!.name}` },
    { pdfBytes: judgeDenial!.bytes, title: `Decisión del Juez — ${judgeDenial!.name}` },
    { pdfBytes: templateBytes, title: 'TEMPLATE — Carta de Apelación ganadora (Lina Vanegas)', cacheable: true },
  ]

  const result = await generateTextWithDocuments({
    system: APPEAL_LETTER_SYSTEM,
    userText,
    documents,
    maxTokens: 16000,
    signal: input.signal,
    logLabel: 'appeal-letter',
  })

  const generationSeconds = (Date.now() - t0) / 1000
  log.info('appeal letter generado', {
    caseId: input.caseId,
    caseNumber,
    outputLen: result.text.length,
    generationSeconds,
    ...result.usage,
  })

  return {
    bodyMarkdown: result.text,
    modelUsed: CLAUDE_MODEL,
    promptVersion: APPEAL_LETTER_PROMPT_VERSION,
    usage: result.usage,
    generationSeconds,
    documentsUsed: [
      { code: APPEAL_DOC_CODES.passport, name: passport!.name, bytes: passport!.bytes.byteLength },
      { code: APPEAL_DOC_CODES.fullAsylum, name: fullAsylum!.name, bytes: fullAsylum!.bytes.byteLength },
      { code: APPEAL_DOC_CODES.judgeDenial, name: judgeDenial!.name, bytes: judgeDenial!.bytes.byteLength },
    ],
  }
}
