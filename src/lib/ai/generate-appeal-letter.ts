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
import { resolveCaseDocuments } from './case-documents'
import { createLogger } from '@/lib/logger'

const log = createLogger('appeal-letter')

// ──────────────────────────────────────────────────────────────────
// Constantes
// ──────────────────────────────────────────────────────────────────

/**
 * Versión del prompt. Incrementar cuando cambie el system prompt para
 * correlacionar calidad del output con cambios en la versión.
 */
export const APPEAL_LETTER_PROMPT_VERSION = '2026-05-20-v3-fallback-en'

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

const APPEAL_LETTER_SYSTEM = `You are a senior U.S. immigration attorney specialized in appeals before the Board of Immigration Appeals (BIA) and the federal Circuit Courts of Appeals. Your task is to draft a Brief / Appeal Letter in ENGLISH (U.S. legal style) that refutes the adverse decision of the Immigration Judge (IJ) who denied the client's asylum.

CRITICAL LANGUAGE REQUIREMENT: The entire output MUST be written in ENGLISH. The BIA only accepts filings in English. Do NOT write in Spanish even if the client's name or country is in Spanish — only translate proper names if they have an established English form; otherwise keep them as-is.

# INPUT YOU WILL RECEIVE

Attached to the user message there will be up to 4 PDFs:

1. **Client's passport** — to verify identity, dates, nationality.
2. **Complete Political Asylum file** — the original I-589 application, declarations, evidence, everything filed before the IJ.
3. **Judge's denial decision (Auto de Denegación)** — the IJ's written decision with the reasoning for denying asylum. THIS IS THE MOST IMPORTANT DOCUMENT: refuting ITS ARGUMENTS is your primary goal.
4. **TEMPLATE — Winning appeal letter** (Lina Vanegas case). It is a FORMAT and TONE EXAMPLE. Replicate its STRUCTURE (header, numbered sections, legal paragraphs, conclusion, signature) but **DO NOT COPY** names, A-Numbers, dates, facts, or case-specific precedents from Lina's case. Each appeal is drafted from scratch on the actual facts of the current client.

# MANDATORY OUTPUT STRUCTURE

Return **markdown** with this structure (8 roman-numeral sections + header + closing):

\`\`\`
# APPEAL BRIEF TO THE BOARD OF IMMIGRATION APPEALS

**Appellant:** {full name}
**Alien Number (A-Number):** {A-Number}
**Country of Origin:** {country}
**Date of IJ's Decision:** {date}
**Immigration Court:** {location}

---

## I. PROCEDURAL SUMMARY OF THE CASE

[1–2 paragraphs: procedural history, key dates, what the client requested, what the IJ decided.]

## II. LEGAL AND FACTUAL ERRORS IN THE JUDGE'S DECISION

[Pinpoint the weak points of the judicial decision. Quote VERBATIM the phrases from the IJ's decision you will refute and explain why they are legally erroneous or factually incorrect. Number them: 1., 2., 3., …]

## III. CREDIBILITY ANALYSIS — POINT-BY-POINT REFUTATION

[If the IJ denied on credibility grounds: address each alleged inconsistency separately, explaining from the record why it is NOT an inconsistency or why it does not go to the heart of the claim. Cite the REAL ID Act, INA §208(b)(1)(B)(iii), and relevant BIA precedents.]

## IV. CONVENTION AGAINST TORTURE (CAT)

[Specific analysis under 8 C.F.R. §§ 1208.16–1208.18. Identify flaws in the IJ's CAT analysis: did the IJ correctly apply the "more likely than not" standard? Did the IJ analyze torture by government acquiescence? Did the IJ consider current country conditions? Cite Matter of J-R-G-P-, Matter of S-V-, or other applicable BIA precedents.]

## V. SAFE THIRD COUNTRY / FIRM RESETTLEMENT DOCTRINE

[Analyze, based on the record, whether the "firm resettlement" or safe-third-country bar applies or should NOT be an impediment. Cite 8 U.S.C. §1158(b)(2)(A)(vi) and Matter of A-G-G-, 25 I&N Dec. 486 (BIA 2011). If the client never obtained firm resettlement in a third country, explain clearly.]

## VI. FAVORABLE BIA AND CIRCUIT COURT PRECEDENTS

[List 3–6 specific precedents where the BIA or a Circuit Court reversed IJ decisions for analogous reasons. Bluebook format: *Matter of X-Y-Z-*, 28 I&N Dec. 123 (BIA 2023); *Doe v. Garland*, 99 F.4th 100 (9th Cir. 2024). Only cite REAL precedents you know with certainty — if uncertain, omit the cite and argue in your own words.]

## VII. WINNING ARGUMENTS (STRATEGIC POINTS)

[Summarize the 3–5 strongest arguments for this specific appeal. This guides the legal team on where to emphasize at oral argument if the BIA grants it.]

## VIII. CONCLUSION AND PRAYER FOR RELIEF

[Explicitly request: (a) reversal of the IJ's decision and grant of asylum, OR (b) remand to the IJ with specific instructions to consider unaddressed evidence/arguments. Close with the standard legal closing.]

---

**Respectfully submitted,**

_______________________________
{representative name / signature line}

Date: {date}
\`\`\`

# CRITICAL RULES

1. **Language:** ENGLISH ONLY. Formal U.S. legal style. Never colloquial. Never code-switch to Spanish.
2. **Citations:** only REAL precedents you know with certainty. If unsure, argue in plain prose without inventing cites.
3. **Do NOT invent facts:** every identity datum, date, and place must be extracted from the attached PDFs. If a datum is missing from the PDFs, write "[To be confirmed]".
4. **Do NOT copy from the template:** Lina Vanegas's template is FORMAT only. Each appeal is drafted from scratch on the actual facts of the current client.
5. **Length:** minimum 2,000 words, maximum ~6,000. Quality over quantity.
6. **Strict markdown:** use \`#\`, \`##\` headers and \`---\` separators exactly as in the output template above. The system converts this to DOCX automatically; malformed markdown breaks the formatting.
`.trim()

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

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

  // 2. Resolver los PDFs del cliente (match por tipo o fallback por recencia).
  //    Cap=3 preserva la semántica original: máximo 3 PDFs del cliente +
  //    el template = 4 PDFs nativos a Claude por request.
  const clientDocs = await resolveCaseDocuments(input.service, input.caseId, {
    preferredCodes: [
      APPEAL_DOC_CODES.passport,
      APPEAL_DOC_CODES.fullAsylum,
      APPEAL_DOC_CODES.judgeDenial,
    ],
    fallbackCount: 3,
    cap: 3,
  })
  if (clientDocs.length === 0) {
    throw new MissingClientDocumentError([
      APPEAL_DOC_CODES.passport,
      APPEAL_DOC_CODES.fullAsylum,
      APPEAL_DOC_CODES.judgeDenial,
    ])
  }

  // 3. Cargar template desde disco con verificación de SHA
  const templateBytes = readTemplateWithSha()

  // Labels semánticos para docs que vienen con matchedCode (referenciados
  // en el userText abajo — declarar antes del template literal para evitar TDZ).
  const codeToLabel: Record<string, string> = {
    [APPEAL_DOC_CODES.passport]: 'Pasaporte',
    [APPEAL_DOC_CODES.fullAsylum]: 'Expediente Asilo',
    [APPEAL_DOC_CODES.judgeDenial]: 'Decisión del Juez',
  }

  // 4. Build enriched user prompt (English — matches the English-only system prompt).
  //    Spanish-named fields (country, state) are passed verbatim; Claude will
  //    handle them naturally in the English brief.
  const userText = [
    '# CASE DATA (this client)',
    `- Full name: ${fullName}`,
    `- A-Number: ${aNumber}`,
    `- Country of origin: ${country}`,
    `- Date of the IJ's decision (under appeal): ${decisionDate}`,
    `- U.S. state of the case: ${stateUs}`,
    `- Internal case number: ${caseNumber}`,
    '',
    '# INSTRUCTIONS (from the firm legal team)',
    "Analyze this client's information, specifically the case file and the judge's decision attached. Generate a document that refutes the arguments the judge used to deny asylum. Specifically:",
    '',
    "1. Identify the weak points of the judicial decision.",
    "2. Research precedents and winning appeals in asylum cases denied for similar reasons.",
    '3. Propose strategic arguments ("winning points") to strengthen this appeal, including citations to successful cases.',
    '4. Focus on the Convention Against Torture (CAT), analyzing potential flaws in the verdict on this specific point.',
    '5. Analyze the viability of the "third country" doctrine based on the shared file, determining why it applies or why it should not be a bar in this case.',
    '6. Help me win this appeal.',
    '',
    '# ATTACHMENTS IN THIS MESSAGE',
    ...clientDocs.map((d, i) => `- Document ${i + 1}: ${d.matchedCode ? codeToLabel[d.matchedCode] + ' — ' : ''}${d.name}`),
    `- Document ${clientDocs.length + 1}: TEMPLATE — Winning appeal letter (Lina Vanegas case). Replicate its FORMAT and TONE, NOT its facts/data.`,
    '',
    clientDocs.some((d) => !d.matchedCode)
      ? 'NOTE: Some attachments arrived without explicit type tagging. Identify each one yourself by file name and content (you should see at least: the client passport, the full asylum file with the I-589 and supporting evidence, and the IJ\'s denial decision). Use them all to build the brief.'
      : '',
    '',
    'Draft the complete Appeal Brief in ENGLISH following the 8-section structure defined in the system prompt. Return ONLY markdown — no meta-explanations, no preamble. Start directly with the heading `# APPEAL BRIEF TO THE BOARD OF IMMIGRATION APPEALS`.',
  ].join('\n')

  // 5. Llamar a Claude con los PDFs del cliente + template (cacheable).
  // Si los docs tienen un `matchedCode` (subidos via portal cliente con tipo),
  // usamos el label semántico ("Pasaporte"/"Expediente Asilo"/"Decisión del Juez").
  // Si vienen del fallback (subidos por admin sin tipo), pasamos el nombre del
  // archivo verbatim — Claude identifica qué es por contenido.
  const documents: DocumentInput[] = [
    ...clientDocs.map((d) => ({
      pdfBytes: d.bytes,
      title: d.matchedCode
        ? `${codeToLabel[d.matchedCode]} — ${d.name}`
        : `Documento del cliente — ${d.name}`,
    })),
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
    documentsUsed: clientDocs.map((d) => ({
      code: d.matchedCode ?? '(fallback — sin tipo)',
      name: d.name,
      bytes: d.bytes.byteLength,
    })),
  }
}
