import { geminiFetch, extractGeminiText } from '@/lib/ai/gemini-fetch'
import type { TranslatedDoc } from './schema'

const GEMINI_KEY = process.env.GEMINI_API_KEY

/**
 * Prompt del sistema para Gemini. Adaptado del que Henry ya usaba con
 * ChatGPT — preserva nombres, números, fechas, sellos, firmas, y exige
 * marcar "[illegible]" cuando algo no se ve. Pide JSON estructurado para
 * que el render a PDF sea determinístico.
 */
const SYSTEM_PROMPT = `You are a professional document translation assistant specialized in civil registry, immigration, and legal-administrative documents.

Your task is to read the attached image or PDF of an official document, extract the visible Spanish text accurately, and produce a certified-style English translation.

Rules:
1. Translate from Spanish into English.
2. Preserve all personal names exactly as written. Do not translate names.
3. Preserve all numbers, registration codes, ID numbers, folio numbers, dates, validation codes, barcodes, seals, and institutional references.
4. Translate dates into natural English format (e.g. "4 de enero de 2012" -> "January 4, 2012").
5. Use formal legal/administrative English.
6. If a field is unclear, partially covered, blurry, or illegible, write "[illegible]" or "[partially illegible]" instead of guessing.
7. If a signature, QR code, barcode, seal or watermark appears, mention it descriptively (e.g. "[Seal of the Civil Registry]", "[Signature]", "[QR code]", "[Barcode]").
8. Do not invent information that is not visible in the document.
9. Keep the format clean and usable for immigration/legal paperwork.

OUTPUT FORMAT (STRICT JSON, NOTHING ELSE — NO markdown fences):

{
  "title": "TITLE OF THE DOCUMENT IN UPPERCASE",
  "header": ["Republic of ...", "Institution name", "Office name", "No. <number>"],
  "blocks": [
    { "type": "paragraph", "text": "Intro paragraph...", "bold_terms": ["Director", "certifies"] },
    { "type": "fields", "items": [ { "label": "First Surname", "value": "..." } ] },
    { "type": "section", "number": 1, "heading": "Place, date, and order of birth", "items": [ { "label": "Municipality", "value": "..." } ] },
    { "type": "section", "number": 4, "heading": "Authorized marginal notes", "paragraph": "None." },
    { "type": "note", "text": "[Seal of ...]" }
  ],
  "footer_paragraph": "Issued in ...",
  "signature_label": "Signature and seal of the Director"
}

- "blocks" is an ordered array. Use whatever combination of types fits the document.
- Use "section" for numbered sections (1., 2., 3., 4.). The "items" array is for label/value rows; use "paragraph" inside the section for free text like "None.".
- Use "fields" outside sections for top-level label/value rows (e.g. surnames, given name, sex right under the intro).
- Use "note" to describe seals, signatures, QR codes, barcodes that appear in the document.
- bold_terms is OPTIONAL — only fill it for paragraphs that have specific terms that should render bold (key institution names, "certifies", etc.).
- NEVER include text outside the JSON. NEVER wrap in \`\`\` fences. NEVER add commentary.
`

export async function translateWithGemini(
  base64: string,
  mimeType: string,
): Promise<{ doc: TranslatedDoc | null; error?: string; raw?: string }> {
  if (!GEMINI_KEY) return { doc: null, error: 'Gemini API key no configurada' }

  const result = await geminiFetch({
    model: 'gemini-3.1-pro-preview',
    apiKey: GEMINI_KEY,
    timeoutMs: 90_000,
    maxRetries: 1,
    body: {
      contents: [{
        parts: [
          { text: SYSTEM_PROMPT },
          { inline_data: { mime_type: mimeType, data: base64 } },
        ],
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
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

  if (!result.ok) return { doc: null, error: result.error || `HTTP ${result.status}` }
  if (result.blockReason) return { doc: null, error: `Bloqueado por Gemini: ${result.blockReason}` }

  const text = extractGeminiText(result.data)
  if (!text) return { doc: null, error: 'Respuesta vacía de Gemini' }

  // Tolerar fences accidentales aunque pedimos JSON puro
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()

  try {
    const parsed = JSON.parse(cleaned) as TranslatedDoc
    if (!parsed.title || !Array.isArray(parsed.blocks)) {
      return { doc: null, error: 'JSON no tiene la estructura esperada', raw: text }
    }
    return { doc: parsed }
  } catch (e) {
    return { doc: null, error: `JSON inválido: ${e instanceof Error ? e.message : 'parse error'}`, raw: text }
  }
}
