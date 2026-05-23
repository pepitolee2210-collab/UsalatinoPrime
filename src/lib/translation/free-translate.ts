import { geminiFetch, extractGeminiText } from '@/lib/ai/gemini-fetch'

const GEMINI_KEY = process.env.GEMINI_API_KEY

export type TranslationDirection = 'es-to-en' | 'en-to-es'

export interface FreeTranslationPart {
  base64: string
  mimeType: string
}

export interface FreeTranslationPagePair {
  /** Texto original (en el idioma fuente) extraído de la página */
  original: string
  /** Traducción de esa página al idioma destino */
  translated: string
}

export interface FreeTranslationResult {
  /** Una entrada por cada página del documento, en orden */
  pages: FreeTranslationPagePair[]
  /** Título descriptivo corto del documento (ej. "Affidavit of Witness — María Pérez"). Se usa
   *  para nombrar el archivo descargado y el preview en pantalla — NO se renderiza en el PDF. */
  document_title: string
  /** Líneas del título original del documento traducido, tal como aparecen en el documento
   *  fuente (ej. ["VOLUNTARY RELINQUISHMENT OF PARENTAL AUTHORITY AND CUSTODY",
   *  "VOLUNTARY RELINQUISHMENT OF PARENTAL CUSTODY"]). Se renderizan en mayúsculas, bold
   *  y centradas en la página 1 del PDF. */
  document_title_lines: string[]
  /** Línea parentética o descriptiva debajo del título (ej. "(For guardianship proceedings in
   *  the United States of America)"). null si el documento no la tiene. */
  document_subtitle: string | null
  /** Idioma fuente detectado (debe coincidir con el seleccionado) */
  source_language: 'es' | 'en'
  /** Idioma destino */
  target_language: 'es' | 'en'
}

/**
 * Genera el system prompt de traducción libre.
 *
 * NO toca el sistema de actas civiles — esto es un motor independiente
 * pensado para que Diana traduzca cualquier documento (declaraciones,
 * cartas, anexos, court orders, etc.) del cliente.
 *
 * Reglas:
 *  - Preservar nombres propios, números, fechas, IDs.
 *  - Mantener formato de párrafos (no consolidar todo en un bloque).
 *  - Sellos / firmas / códigos QR / barcodes se MENCIONAN descriptivamente
 *    entre corchetes en el texto traducido (ej. "[Seal of the Notary]"),
 *    NO se intentan reproducir visualmente. El original se entrega como
 *    archivo separado junto con la traducción certificada.
 *  - Una entrada por cada página del documento, manteniendo el orden.
 */
function buildSystemPrompt(direction: TranslationDirection): string {
  const [src, srcName, tgt, tgtName] = direction === 'es-to-en'
    ? (['es', 'Spanish', 'en', 'English'] as const)
    : (['en', 'English', 'es', 'Spanish'] as const)

  return `You are a professional translator specialized in legal and administrative documents. Translate the attached document FROM ${srcName} TO ${tgtName}.

GENERAL RULES
- Translate the ENTIRE textual content of every page. Do not summarize, paraphrase, or omit anything legible.
- Preserve personal names, place names, institution names exactly as in the original. Do not translate or transliterate them.
- Preserve all numbers, IDs, dates, registration codes, case numbers, money amounts.
- For dates, use the natural format of the target language ("4 de enero de 2012" → "January 4, 2012", or "January 4, 2012" → "4 de enero de 2012").
- Keep paragraph breaks. If the original has 5 paragraphs on a page, the translation must have 5 paragraphs on that page.
- Use formal legal/administrative register.
- If a section is illegible or cut off, write "[illegible]" or "[partially illegible]" in the translation. Never invent content.

DOCUMENT TITLE EXTRACTION
- Identify the title of the original document (the prominent heading at the top of page 1, often
  in ALL CAPS — e.g. "VOLUNTARY RELINQUISHMENT OF PARENTAL AUTHORITY AND CUSTODY",
  "BIRTH CERTIFICATE", "POWER OF ATTORNEY", "AFFIDAVIT OF SUPPORT").
- Translate that title to ${tgtName} and put each title line in "document_title_lines" as a
  separate array entry. If the document has 2 stacked title lines (a main title and an alternate
  wording right below), include both. Keep the title in MAYÚSCULAS (UPPERCASE).
- If immediately below the title there is a parenthetical or descriptive subtitle
  (e.g. "(For guardianship proceedings in the United States of America)"), translate it and
  put it in "document_subtitle". Otherwise set "document_subtitle" to null.
- The translated body in "pages[].translated" MUST NOT repeat the title lines or the subtitle —
  start the body directly with the first sentence after the title block.

EDITORIAL HEADERS / FOOTERS — DO NOT GENERATE
- Do NOT add editorial headers like "English translation prepared from the scanned Spanish
  document provided." — the PDF renderer adds those automatically.
- Do NOT add a "CERTIFIED ENGLISH TRANSLATION" heading at the top — the renderer adds it.
- Do NOT add any "Page X of Y" markers — that is rendering, not content.

SEALS, SIGNATURES, AND VISUAL ELEMENTS
- Seals, signatures, QR codes, barcodes, watermarks, embossed marks: do NOT try to reproduce them. Mention them descriptively between brackets in the translation, in the target language.
  Examples (target = English): "[Seal of the Civil Registry]", "[Signature of John Doe]", "[QR code]", "[Notary stamp]", "[Autograph signature]", "[Signature and seal]", "[Seal: Republic of Colombia – <Notary Name> – <Notary Office>]".
  Examples (target = Spanish): "[Sello del Registro Civil]", "[Firma de John Doe]", "[Código QR]", "[Sello notarial]".
- If text accompanies a seal/stamp (validation code, barcode number, notary registration number, signature line label), DO extract that text into the translation as plain text — that is content, not just a visual.
- The translated document is meant to be filed alongside the original, NOT to replace it. The reader will see both. Do not attempt to "redact" or hide the seal.

OUTPUT — STRICT JSON, NOTHING ELSE (no markdown fences, no commentary):

{
  "document_title": "<short descriptive title in ${tgtName}, e.g. 'Voluntary Relinquishment of Parental Authority and Custody' or 'Affidavit of Witness — María Pérez'>",
  "document_title_lines": ["<line 1 of the document's own title in ${tgtName}, UPPERCASE>", "<line 2 if present, UPPERCASE>"],
  "document_subtitle": "<translated parenthetical subtitle if the document has one, else null>",
  "source_language": "${src}",
  "target_language": "${tgt}",
  "pages": [
    {
      "original": "<full ${srcName} text of page 1, with paragraph breaks preserved as actual newlines, EXCLUDING the title lines and subtitle (since those go above)>",
      "translated": "<full ${tgtName} translation of page 1, paragraph-by-paragraph aligned with the original, EXCLUDING the title lines and subtitle>"
    },
    { "original": "...", "translated": "..." }
  ]
}

Rules for the JSON itself:
- "pages" must have one entry per page in the source PDF/image, in order.
- Both "original" and "translated" must be plain text (newlines as \\n). No HTML, no markdown.
- Paragraphs separated by single newline. A blank line (two newlines) separates clearly different sections.
- "document_title_lines" must always be an array — use [] (empty array) only if the document genuinely has no visible title at all.
- "document_subtitle" must be null when there is no parenthetical subtitle — never an empty string.
- If a page is genuinely empty (blank back of a sheet, or only graphical elements with no text), set "original" to "[blank page]" and "translated" to the same in the target language.

Do NOT output anything except the JSON.`
}

export async function freeTranslate(
  parts: FreeTranslationPart[],
  direction: TranslationDirection,
): Promise<{ result: FreeTranslationResult | null; error?: string; raw?: string }> {
  if (!GEMINI_KEY) return { result: null, error: 'Gemini API key no configurada' }
  if (parts.length === 0) return { result: null, error: 'Sin contenido para traducir' }

  const promptParts: Array<
    { text: string } | { inline_data: { mime_type: string; data: string } }
  > = [{ text: buildSystemPrompt(direction) }]
  for (const p of parts) {
    promptParts.push({ inline_data: { mime_type: p.mimeType, data: p.base64 } })
  }

  const apiResult = await geminiFetch({
    model: 'gemini-3.1-pro-preview',
    apiKey: GEMINI_KEY,
    timeoutMs: 180_000,
    maxRetries: 1,
    body: {
      contents: [{ parts: promptParts }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 32_768,
        responseMimeType: 'application/json',
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      ],
    },
  })

  if (!apiResult.ok) return { result: null, error: apiResult.error || `HTTP ${apiResult.status}` }
  if (apiResult.blockReason) return { result: null, error: `Bloqueado por Gemini: ${apiResult.blockReason}` }

  const text = extractGeminiText(apiResult.data)
  if (!text) return { result: null, error: 'Respuesta vacía de Gemini' }

  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()

  try {
    const parsed = JSON.parse(cleaned) as Partial<FreeTranslationResult>
    if (!Array.isArray(parsed.pages) || parsed.pages.length === 0) {
      return { result: null, error: 'Respuesta de Gemini sin páginas', raw: text }
    }
    const targetExpected = direction === 'es-to-en' ? 'en' : 'es'
    const sourceExpected = direction === 'es-to-en' ? 'es' : 'en'
    const docTitle = parsed.document_title?.trim() || 'Translated Document'

    // Backward-compat: si Gemini no devuelve document_title_lines (respuesta de
    // una versión anterior del prompt), derivar una línea única desde el
    // document_title corto para que el renderer tenga algo que mostrar.
    const rawTitleLines = Array.isArray(parsed.document_title_lines)
      ? parsed.document_title_lines
          .map((l) => (typeof l === 'string' ? l.trim() : ''))
          .filter((l) => l.length > 0)
      : []
    const titleLines = rawTitleLines.length > 0
      ? rawTitleLines.map((l) => l.toUpperCase())
      : [docTitle.toUpperCase()]

    const rawSubtitle = typeof parsed.document_subtitle === 'string'
      ? parsed.document_subtitle.trim()
      : null
    const subtitle = rawSubtitle && rawSubtitle.length > 0 ? rawSubtitle : null

    const result: FreeTranslationResult = {
      document_title: docTitle,
      document_title_lines: titleLines,
      document_subtitle: subtitle,
      source_language: parsed.source_language === 'en' || parsed.source_language === 'es'
        ? parsed.source_language
        : sourceExpected,
      target_language: parsed.target_language === 'en' || parsed.target_language === 'es'
        ? parsed.target_language
        : targetExpected,
      pages: parsed.pages.map((p) => ({
        original: typeof p.original === 'string' ? p.original : '',
        translated: typeof p.translated === 'string' ? p.translated : '',
      })),
    }
    return { result }
  } catch (e) {
    return {
      result: null,
      error: `JSON inválido: ${e instanceof Error ? e.message : 'parse error'}`,
      raw: text,
    }
  }
}
