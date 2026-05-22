// Genera la "Carta de Exoneración" — fee waiver letter corta (≤1 página, en
// inglés, primera persona, bajo perjury) que acompaña al Form EOIR-26A
// (Fee Waiver Request) presentado junto al EOIR-26 ante la BIA.
//
// La carta NO es un brief legal como la Carta de Apelación. Es una declaración
// jurada breve de incapacidad económica con referencia a la evidencia adjunta.
//
// Estrategia de PDFs nativos a Claude:
//   1. Pasaporte del cliente              (apelacion_pasaporte)
//   2. N evidencias financieras           (apelacion_eoir26a_evidencia_financiera, multi-slot)
//   3. Fallback: hasta 3 docs recientes   client_to_admin no pickeados arriba
//   4. Template PDF cacheable             (public/templates/eoir26a-letter-example.pdf)
//
// Plus en el user text: valores del EOIR-26A llenado (case_form_instances)
// para que Claude use números reales certificados por el cliente.

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

const log = createLogger('eoir26a-letter')

// ──────────────────────────────────────────────────────────────────
// Constantes
// ──────────────────────────────────────────────────────────────────

export const EOIR26A_LETTER_PROMPT_VERSION = '2026-05-21-v1'

const EOIR26A_TEMPLATE_DISK_PATH = 'public/templates/eoir26a-letter-example.pdf'

/**
 * SHA256 hardcoded del template. Si el archivo cambia el endpoint devuelve
 * 500 hasta re-hashear y actualizar esta constante. Patrón idéntico al
 * Appeal Letter (`APPEAL_TEMPLATE_SHA256`).
 */
export const EOIR26A_TEMPLATE_SHA256 =
  '2c3ddffdcded9081877c2534a1079ae8f0cd0581bafa907ba2f445fa064aa1b8'

/**
 * Codes de document_types que el agente prioriza al cargar los PDFs:
 *  - passport: identidad (single match)
 *  - financialEvidence: evidencia (multi_named — todos los matches)
 */
const EOIR26A_DOC_CODES = {
  passport: 'apelacion_pasaporte',
  financialEvidence: 'apelacion_eoir26a_evidencia_financiera',
} as const

/** Nombre exacto del form en case_form_instances. Coincide con el FORM_NAME
 *  del schema en `src/lib/legal/eoir-26a-form-schema.ts`. */
const EOIR26A_FORM_NAME = 'EOIR-26A — Fee Waiver Request'

// ──────────────────────────────────────────────────────────────────
// System prompt
// ──────────────────────────────────────────────────────────────────

const EOIR26A_LETTER_SYSTEM = `You are a U.S. immigration attorney's drafting assistant. Your sole task is to generate a SHORT supporting letter (a "fee waiver letter" / "carta de exoneración") that accompanies Form EOIR-26A (Fee Waiver Request) filed with Form EOIR-26 (Notice of Appeal) before the Board of Immigration Appeals (BIA).

CRITICAL LANGUAGE: ENGLISH ONLY. The BIA accepts filings in English. Never code-switch to Spanish even if the client's name or country is in Spanish.

# WHAT MAKES A STRONG EOIR-26A LETTER

The letter MUST be clear, complete and coherent. A vague "I cannot pay" without numbers is presumptively weak (per EOIR Policy Memo 25-36, the BIA scrutinizes fee waivers aggressively since July 2025, and as of February 2026 the appeal fee is $1,030).

Strong letters:
1. State unambiguously the specific reason for inability to pay (detention, unemployment, public benefits, large dependents-to-income ratio, etc.).
2. Reference SPECIFIC numbers when available (income $X/month, expenses $Y/month, dependents N, benefits received).
3. Cross-reference attached evidence ("see attached Pay Stub dated…", "see attached SNAP benefits letter dated…").
4. Include a declaration under penalty of perjury (28 U.S.C. § 1746).
5. Keep it short — typically 200-500 words, fitting on 1 page.

# INPUT YOU WILL RECEIVE

Up to 5 PDFs attached to the user message:
1. **Client's passport** — identity verification (name, A-Number, nationality).
2. **Financial evidence documents** (0-N) — pay stubs, unemployment letters, public benefits statements (SNAP/Medicaid/SSI/TANF), bank statements showing low balance, expense receipts (rent, utilities, food, transportation, medical, child expenses).
3. **Recent client documents** (fallback, may include the asylum file or judge's denial — useful for detention/work-authorization context).
4. **TEMPLATE — Example fee waiver letter** — format and tone reference only. DO NOT COPY names, A-numbers, facts, or facility addresses from it.

You will also receive in the user text:
- Client profile data (name, A-Number, country, address if known).
- Case metadata (detained? state? appeal context?).
- EOIR-26A form values if the client has already filled the form (monthly income breakdown, monthly expenses, dependents, public benefits). USE THESE NUMBERS VERBATIM — they were certified by the client under perjury.

# OUTPUT STRUCTURE (markdown, converted to DOCX downstream)

# {Date in "Month DD, YYYY" format}

**Re:** {Client full name}
**A-Number:** A {A-Number}
**Request for Fee Waiver / Form EOIR-26A**

To the Honorable Board of Immigration Appeals:

I, **{full name}**, respectfully request a waiver of the filing fee for my appeal.

[2-4 short paragraphs that explain WHY the applicant cannot pay. Lean on SPECIFIC facts: detention facility name + date detained; or unemployment + job lost date + last paycheck; or public benefits received + monthly amounts; or income vs. expense breakdown showing deficit. Reference the EOIR-26A form numbers verbatim if they were provided. Cross-reference attached documents by their name when relevant.]

[1 short paragraph stating the REASON for the appeal itself (e.g., fear of return to {country}, opportunity to present protection applications).]

For these reasons, I respectfully ask the Board of Immigration Appeals to grant my request for a fee waiver and accept my appeal without payment of the filing fee.

I declare under penalty of perjury that the information provided in this request is true and correct to the best of my knowledge.

Respectfully submitted,

---

**{Full name}**
A {A-Number}
{Best known address: facility if detained, otherwise mailing address, otherwise "[Address to be confirmed]"}

# CRITICAL RULES

1. ENGLISH ONLY.
2. Length: 200-500 words. NEVER exceed ~1 page when rendered.
3. DO NOT invent facts. If a datum is missing, write "[To be confirmed]" — Diana will fill it manually.
4. Use EOIR-26A form values verbatim when provided; do not round or alter numbers.
5. Strict markdown (\`#\`, \`**bold**\`, \`---\`) — the system converts to DOCX, malformed markdown breaks formatting.
6. NO legal precedents, NO statutory citations, NO multi-section structure like the appeal brief. This is a short, factual, sworn declaration.
7. Cross-reference attached documents by file name when relevant (e.g., "see attached Bank Statement Marzo 2026").
`.trim()

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function readTemplateWithSha(): Uint8Array {
  const disk = path.join(process.cwd(), EOIR26A_TEMPLATE_DISK_PATH)
  const bytes = readFileSync(disk)
  const actual = createHash('sha256').update(bytes).digest('hex')
  if (actual !== EOIR26A_TEMPLATE_SHA256) {
    throw new Error(
      `Template SHA256 mismatch. Esperado ${EOIR26A_TEMPLATE_SHA256}, encontrado ${actual}. ` +
        `Si actualizaste el template, re-hashea y actualiza EOIR26A_TEMPLATE_SHA256 en generate-eoir26a-letter.ts.`,
    )
  }
  return new Uint8Array(bytes)
}

function formatDateLong(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })
}

interface Eoir26aFormSnapshot {
  income_employment?: string | null
  income_property?: string | null
  income_interest?: string | null
  income_other?: string | null
  expense_rent?: string | null
  expense_utilities?: string | null
  expense_installments?: string | null
  expense_living?: string | null
  expense_other?: string | null
  total_assets?: string | null
  total_monthly_income?: string | null
  total_monthly_expense?: string | null
  additional_info?: string | null
  [k: string]: string | boolean | null | undefined
}

/** Renderiza los valores del form EOIR-26A como bloque legible para Claude.
 *  Solo incluye campos que tienen valor — claves vacías se omiten para que
 *  Claude no las cite como "0" cuando en realidad faltan. */
function renderFormBlock(values: Eoir26aFormSnapshot | null): string {
  if (!values) {
    return 'The client has NOT completed Form EOIR-26A in the system. Generate the letter based on documents and case context; do not invent specific dollar amounts.'
  }
  const lines: string[] = []
  const lbl = (k: keyof Eoir26aFormSnapshot, label: string, money = true) => {
    const v = values[k]
    if (v === undefined || v === null || v === '' || typeof v === 'boolean') return
    const display = money ? `$${String(v).replace(/^\$/, '')}` : String(v)
    lines.push(`- ${label}: ${display}`)
  }
  lbl('income_employment', 'Monthly income — employment')
  lbl('income_property', 'Monthly income — property')
  lbl('income_interest', 'Monthly income — interest')
  lbl('income_other', 'Monthly income — other')
  lbl('total_monthly_income', 'TOTAL monthly income')
  lbl('expense_rent', 'Monthly expense — rent/mortgage')
  lbl('expense_utilities', 'Monthly expense — utilities')
  lbl('expense_installments', 'Monthly expense — installments/debts')
  lbl('expense_living', 'Monthly expense — living (food/transport/clothing)')
  lbl('expense_other', 'Monthly expense — other')
  lbl('total_monthly_expense', 'TOTAL monthly expense')
  lbl('total_assets', 'Total assets / net worth')
  if (typeof values.additional_info === 'string' && values.additional_info.trim()) {
    lines.push(`- Additional info (client's words): ${values.additional_info.trim()}`)
  }
  if (lines.length === 0) {
    return 'Form EOIR-26A exists in the system but contains no monetary values yet. Treat as not-completed for purposes of citing numbers.'
  }
  return ['The client has completed Form EOIR-26A. Use these certified values VERBATIM:', ...lines].join('\n')
}

// ──────────────────────────────────────────────────────────────────
// API pública
// ──────────────────────────────────────────────────────────────────

export interface GenerateEoir26aLetterInput {
  caseId: string
  service: SupabaseClient
  signal?: AbortSignal
}

export interface Eoir26aLetterOutput {
  bodyMarkdown: string
  modelUsed: string
  promptVersion: string
  usage: UsageStats
  generationSeconds: number
  documentsUsed: Array<{ code: string; name: string; bytes: number }>
  formCompleted: boolean
}

/** Faltan documentos del cliente y no hay form data — sin nada que pasarle
 *  a Claude no se puede generar carta útil. El endpoint llamador devuelve 400. */
export class MissingEoir26aInputError extends Error {
  constructor() {
    super(
      'No hay documentos del cliente ni datos del EOIR-26A llenados. ' +
        'Sube al menos el pasaporte y/o llena el Form EOIR-26A antes de generar la carta.',
    )
    this.name = 'MissingEoir26aInputError'
  }
}

export async function generateEoir26aLetter(
  input: GenerateEoir26aLetterInput,
): Promise<Eoir26aLetterOutput> {
  const t0 = Date.now()

  // 1. Cargar caso + cliente
  const { data: caseRow, error: caseErr } = await input.service
    .from('cases')
    .select(
      `id, case_number, current_phase, state_us, client_id,
       service:service_catalog(slug)`,
    )
    .eq('id', input.caseId)
    .single()
  if (caseErr || !caseRow) {
    throw new Error(`Caso no encontrado: ${input.caseId}`)
  }

  const { data: profile } = await input.service
    .from('profiles')
    .select(
      'first_name, last_name, middle_name, a_number, country_of_birth, nationality, address_line1, address_line2, address_city, address_state, address_zip',
    )
    .eq('id', caseRow.client_id)
    .single()

  const fullName = [profile?.first_name, profile?.middle_name, profile?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim() || '[To be confirmed]'
  const aNumber = profile?.a_number?.trim() || '[To be confirmed]'
  const country = profile?.country_of_birth?.trim()
    || profile?.nationality?.trim()
    || '[To be confirmed]'
  const stateUs = caseRow.state_us || '[To be confirmed]'
  const caseNumber = caseRow.case_number || '(sin asignar)'

  const addressParts = [
    profile?.address_line1,
    profile?.address_line2,
    [profile?.address_city, profile?.address_state, profile?.address_zip].filter(Boolean).join(', '),
  ].filter((p) => typeof p === 'string' && p.trim().length > 0)
  const mailingAddress = addressParts.length > 0
    ? addressParts.join('\n')
    : '[Address to be confirmed]'

  // 2. Cargar datos del EOIR-26A llenado (si existe). Usar el snapshot del
  //    cliente en case_form_instances.filled_values.
  const { data: formInstance } = await input.service
    .from('case_form_instances')
    .select('filled_values, status, filled_at')
    .eq('case_id', input.caseId)
    .eq('form_name', EOIR26A_FORM_NAME)
    .maybeSingle()

  const formValues = (formInstance?.filled_values as Eoir26aFormSnapshot | null) ?? null

  // 3. Resolver los PDFs del cliente: pasaporte (single) + evidencia financiera
  //    (todos los matches del multi-slot) + hasta 3 fallback recientes.
  //    Cap=8 para mantener el costo de tokens bajo control (típicamente
  //    1 passport + 0-5 financial proofs).
  const clientDocs = await resolveCaseDocuments(input.service, input.caseId, {
    preferredCodes: [EOIR26A_DOC_CODES.passport],
    multiCodes: [EOIR26A_DOC_CODES.financialEvidence],
    fallbackCount: 3,
    cap: 8,
  })

  // Sin docs Y sin form data → no hay material. Caso contrario seguimos
  // (la carta puede salir con [To be confirmed] en numéricos).
  if (clientDocs.length === 0 && !formValues) {
    throw new MissingEoir26aInputError()
  }

  // 4. Template PDF (cacheable)
  const templateBytes = readTemplateWithSha()

  // 5. User prompt — pasamos contexto del caso + form data + lista de adjuntos.
  const filingDate = formatDateLong(new Date())
  const formBlock = renderFormBlock(formValues)

  const docLines = clientDocs.map((d, i) => {
    const label =
      d.matchedCode === EOIR26A_DOC_CODES.passport
        ? 'Client passport (identity)'
        : d.matchedCode === EOIR26A_DOC_CODES.financialEvidence
          ? 'Financial evidence'
          : 'Client document (untyped)'
    return `- Document ${i + 1}: ${label} — ${d.name}`
  })
  if (clientDocs.length === 0) {
    docLines.push('- (No client documents attached. Rely on profile data and EOIR-26A form values above.)')
  }

  const userText = [
    '# CLIENT IDENTITY',
    `- Full name: ${fullName}`,
    `- A-Number: ${aNumber}`,
    `- Country of origin: ${country}`,
    `- U.S. state of the case: ${stateUs}`,
    `- Internal case number: ${caseNumber}`,
    `- Mailing address on file:`,
    mailingAddress.split('\n').map((l) => `    ${l}`).join('\n'),
    `- Filing date target: ${filingDate}`,
    '',
    '# EOIR-26A FORM VALUES',
    formBlock,
    '',
    '# ATTACHMENTS IN THIS MESSAGE',
    ...docLines,
    `- Document ${clientDocs.length + 1}: TEMPLATE — Example fee waiver letter. FORMAT and TONE only, DO NOT COPY facts.`,
    '',
    clientDocs.some((d) => !d.matchedCode)
      ? "NOTE: Some attachments arrived without explicit type tagging. Identify each by file name and content — they may be financial proofs, the asylum file, or the judge's denial. Use them as context."
      : '',
    '',
    'Draft the complete fee waiver letter in ENGLISH following the structure in the system prompt. Return ONLY markdown — no preamble, no meta-explanations. Start directly with `# {Date}`.',
  ].join('\n')

  const documents: DocumentInput[] = [
    ...clientDocs.map((d) => ({
      pdfBytes: d.bytes,
      title:
        d.matchedCode === EOIR26A_DOC_CODES.passport
          ? `Pasaporte — ${d.name}`
          : d.matchedCode === EOIR26A_DOC_CODES.financialEvidence
            ? `Evidencia financiera — ${d.name}`
            : `Documento del cliente — ${d.name}`,
    })),
    {
      pdfBytes: templateBytes,
      title: 'TEMPLATE — Example EOIR-26A fee waiver letter',
      cacheable: true,
    },
  ]

  const result = await generateTextWithDocuments({
    system: EOIR26A_LETTER_SYSTEM,
    userText,
    documents,
    maxTokens: 4000,
    signal: input.signal,
    logLabel: 'eoir26a-letter',
  })

  const generationSeconds = (Date.now() - t0) / 1000
  log.info('eoir26a letter generado', {
    caseId: input.caseId,
    caseNumber,
    outputLen: result.text.length,
    generationSeconds,
    formCompleted: !!formValues,
    ...result.usage,
  })

  return {
    bodyMarkdown: result.text,
    modelUsed: CLAUDE_MODEL,
    promptVersion: EOIR26A_LETTER_PROMPT_VERSION,
    usage: result.usage,
    generationSeconds,
    documentsUsed: clientDocs.map((d) => ({
      code: d.matchedCode ?? '(fallback — sin tipo)',
      name: d.name,
      bytes: d.bytes.byteLength,
    })),
    formCompleted: !!formValues,
  }
}
