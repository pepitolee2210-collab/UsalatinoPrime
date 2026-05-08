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
  /** Título descriptivo del documento (el modelo lo infiere — ej. "Affidavit of Witness") */
  document_title: string
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

SEALS, SIGNATURES, AND VISUAL ELEMENTS
- Seals, signatures, QR codes, barcodes, watermarks, embossed marks: do NOT try to reproduce them. Mention them descriptively between brackets in the translation, in the target language.
  Examples (target = English): "[Seal of the Civil Registry]", "[Signature of John Doe]", "[QR code]", "[Notary stamp]".
  Examples (target = Spanish): "[Sello del Registro Civil]", "[Firma de John Doe]", "[Código QR]", "[Sello notarial]".
- If text accompanies a seal/stamp (validation code, barcode number, notary registration number, signature line label), DO extract that text into the translation as plain text — that is content, not just a visual.
- The translated document is meant to be filed alongside the original, NOT to replace it. The reader will see both. Do not attempt to "redact" or hide the seal.

OUTPUT — STRICT JSON, NOTHING ELSE (no markdown fences, no commentary):

{
  "document_title": "<short descriptive title of the document in ${tgtName}, e.g. 'Affidavit of Witness — María Pérez' or 'Court Order, Family Court of New York'>",
  "source_language": "${src}",
  "target_language": "${tgt}",
  "pages": [
    {
      "original": "<full ${srcName} text of page 1, with paragraph breaks preserved as actual newlines>",
      "translated": "<full ${tgtName} translation of page 1, paragraph-by-paragraph aligned with the original>"
    },
    { "original": "...", "translated": "..." }
  ]
}

Rules for the JSON itself:
- "pages" must have one entry per page in the source PDF/image, in order.
- Both "original" and "translated" must be plain text (newlines as \\n). No HTML, no markdown.
- Paragraphs separated by single newline. A blank line (two newlines) separates clearly different sections.
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
    const result: FreeTranslationResult = {
      document_title: parsed.document_title?.trim() || 'Translated Document',
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
