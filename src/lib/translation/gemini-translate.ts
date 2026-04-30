import { geminiFetch, extractGeminiText } from '@/lib/ai/gemini-fetch'
import type { TranslatedDoc } from './schema'

const GEMINI_KEY = process.env.GEMINI_API_KEY

/**
 * Prompt de Gemini. Pide JSON estructurado siguiendo el formato exacto
 * del template que Henry usa para inmigración (acta de nacimiento, etc.).
 *
 * IMPORTANTE: NO debe incluir descripciones tipo "[QR code]", "[Seal of...]",
 * "[Barcode]". Solo el texto sustantivo del documento. Los códigos visuales
 * (validation code, barcode number) se extraen como TEXTO en reference_codes.
 */
const SYSTEM_PROMPT = `You are a professional document translation assistant specialized in civil registry, immigration, and legal-administrative documents.

Read the attached image or PDF of an official Spanish-language document and produce a certified-style English translation as STRICT JSON (no markdown fences, no commentary).

GENERAL RULES
- Translate from Spanish into English, formal legal/administrative register.
- Preserve personal names exactly as written. Do not translate them.
- Preserve all numbers, ID numbers, registration numbers, folio numbers, dates, validation codes.
- Translate dates into natural English format ("4 de enero de 2012" -> "January 4, 2012").
- DO NOT add descriptive placeholders like "[Seal of the Civil Registry]", "[Signature]", "[QR code]", "[Barcode]". Skip them silently.
- DO extract the textual values that accompany those visuals: Validation Code, Barcode Number, QR-encoded reference, watermarks with text, etc., into reference_codes as label/value pairs.
- If a field is illegible or partially covered, write "[illegible]" as its value.
- Never invent information that is not visible.

OUTPUT — STRICT JSON, NOTHING ELSE:

{
  "jurisdiction_header": ["REPUBLIC OF PANAMA", "ELECTORAL TRIBUNAL"],
  "document_type": "CERTIFICATE",
  "registration_number": "8-1120-1165",
  "issuing_authority": "The National Directorate of the Civil Registry",
  "certification_verb": "CERTIFIES",
  "certification_paragraph": "That in Volume 1120, Entry 1165 of the Birth Records of the Province of PANAMA, the following birth is registered:",
  "registered_person_name": "Chelenny Nicole John Santana",
  "primary_fields": [
    { "label": "SEX", "value": "Female" },
    { "label": "DATE OF BIRTH", "value": "January 4, 2012" },
    { "label": "PLACE OF BIRTH", "value": "Santo Tomas Hospital, Township of Calidonia, District of Panama, Province of Panama, Country of Panama" },
    { "label": "NATIONAL OF", "value": "Panama" }
  ],
  "parents": [
    { "label": "FATHER", "line": "Antonio John Morales, holder of identity card No. 8-789-2431, national of Panama" },
    { "label": "MOTHER", "line": "Bailenny Santana Lappost, holder of identity card No. E-8-100918, national of the Dominican Republic" }
  ],
  "registration_fields": [
    { "label": "PLACE OF REGISTRATION", "value": "Panama" },
    { "label": "DATE OF REGISTRATION", "value": "January 18, 2012" }
  ],
  "validation_paragraph": "The entity or person before whom this certificate is presented must validate and verify its contents at www.tribunal-electoral.gob.pa/verificacion, in accordance with Article 10 of Decree No. 24 of June 2, 2020, of the Electoral Tribunal.",
  "reference_codes": [
    { "label": "Validation Code", "value": "034PMQ1RKS" },
    { "label": "Barcode Number", "value": "3853778" }
  ],
  "signatory_name": "Sharon Sinclaire de Dumanoir",
  "signatory_title": "National Director of the Civil Registry",
  "closing_fields": [
    { "label": "Date of Issue", "value": "December 1, 2022" },
    { "label": "Expiration Date", "value": "January 30, 2023" }
  ],
  "closing_note": "Certificate valid for use within the national territory and for legalization/apostille.",
  "original_document_title": "Certificado de Nacimiento"
}

NOTES
- All keys must be present even if empty (use "" for strings, [] for arrays).
- Adapt to the actual document type: it might be a marriage certificate, an ID card, a court ruling, a school transcript, etc. Use the same shape, fill what applies.
- For non-civil-registry documents that don't have parents/registration fields, leave those arrays empty.
- "original_document_title" is the SPANISH name of the document as it appears in the original (e.g. "Certificado de Nacimiento", "Acta de Matrimonio", "Cédula de Identidad"). Used to cite it in the translator's certification.
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

  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()

  try {
    const parsed = JSON.parse(cleaned) as Partial<TranslatedDoc>
    // Coercer defaults para mantener el shape estable
    const doc: TranslatedDoc = {
      jurisdiction_header: parsed.jurisdiction_header ?? [],
      document_type: parsed.document_type ?? '',
      registration_number: parsed.registration_number ?? '',
      issuing_authority: parsed.issuing_authority ?? '',
      certification_verb: parsed.certification_verb ?? '',
      certification_paragraph: parsed.certification_paragraph ?? '',
      registered_person_name: parsed.registered_person_name ?? '',
      primary_fields: parsed.primary_fields ?? [],
      parents: parsed.parents ?? [],
      registration_fields: parsed.registration_fields ?? [],
      validation_paragraph: parsed.validation_paragraph ?? '',
      reference_codes: parsed.reference_codes ?? [],
      signatory_name: parsed.signatory_name ?? '',
      signatory_title: parsed.signatory_title ?? '',
      closing_fields: parsed.closing_fields ?? [],
      closing_note: parsed.closing_note ?? '',
      original_document_title: parsed.original_document_title ?? '',
    }
    return { doc }
  } catch (e) {
    return { doc: null, error: `JSON inválido: ${e instanceof Error ? e.message : 'parse error'}`, raw: text }
  }
}
