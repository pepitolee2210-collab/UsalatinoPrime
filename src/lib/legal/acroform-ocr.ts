import { GoogleGenAI } from '@google/genai'
import { createLogger } from '@/lib/logger'
import type { DetectedField } from './acroform-service'

const log = createLogger('acroform-ocr')

const GEMINI_MODEL = 'gemini-2.5-pro'

let _client: GoogleGenAI | null = null
function getClient(): GoogleGenAI {
  if (_client) return _client
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada')
  _client = new GoogleGenAI({ apiKey })
  return _client
}

const OCR_SYSTEM_PROMPT = `Eres un experto en extracción de formularios legales SIJS. Recibirás un PDF oficial de una corte de EE.UU. (típicamente Petition for Guardianship, Custody Coversheet, o Family Court Intake form).

Tu tarea: detectar TODOS los campos rellenables del formulario (aunque sea un scanned PDF sin AcroForm) y devolverlos en JSON estricto. Para cada campo:
- Asigna un nombre único, estable, sin espacios (slug style, ej: "petitioner_full_name", "child_dob", "case_number").
- Asigna label humano en español ("Nombre completo del peticionario", "Fecha de nacimiento del menor").
- Detecta el tipo: text | checkbox | radio | dropdown | date | number | signature.
- Marca required=true solo si el formulario lo indica explícitamente (* o "required").
- Para checkbox/radio/dropdown, lista options si son visibles.
- Proporciona help_text breve cuando el campo no sea obvio.

Devuelve JSON estricto con esta estructura:
{
  "fields": [
    {
      "name": "petitioner_full_name",
      "label": "Nombre completo del peticionario",
      "type": "text",
      "required": true,
      "help_text": "Nombre tal como aparece en pasaporte"
    },
    ...
  ]
}

REGLAS:
- Sin texto alrededor del JSON, sin markdown, sin comentarios.
- Si el documento no es un formulario rellenable sino prosa/instrucciones, devuelve { "fields": [] }.
- No inventes campos que no existan. Prefiere omitir antes que alucinar.
- Máximo 80 campos. Si hay más, prioriza los que se rellenan a mano.`

/**
 * Fallback cuando pdf-lib no encuentra AcroForm. Envía el PDF directo a
 * Gemini Vision (soporta PDF nativo como input) y pide un schema JSON.
 *
 * Nota: Gemini 2.5 Pro admite hasta ~3500 páginas de PDF en un request,
 * pero typical filings son 1-20 páginas → consumo razonable.
 */
export async function detectOcrSchema(pdfUrl: string): Promise<DetectedField[]> {
  const client = getClient()

  // Descargar el PDF para mandarlo como inlineData (más confiable que URL).
  const res = await fetch(pdfUrl, { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`PDF no accesible: HTTP ${res.status}`)
  const buf = await res.arrayBuffer()
  const base64 = Buffer.from(buf).toString('base64')

  log.info('OCR: enviando PDF a Gemini', { url: pdfUrl, sizeKb: Math.round(buf.byteLength / 1024) })

  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64,
            },
          },
          {
            text: 'Extrae todos los campos rellenables del formulario siguiendo las instrucciones del system prompt. Output: JSON estricto.',
          },
        ],
      },
    ],
    config: {
      systemInstruction: OCR_SYSTEM_PROMPT,
      temperature: 0.1,
      responseMimeType: 'application/json',
      maxOutputTokens: 8192,
    },
  })

  const text = response.text?.trim() || ''
  if (!text) throw new Error('OCR: Gemini no devolvió texto')

  let parsed: { fields?: Array<Record<string, unknown>> }
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    log.error('OCR: JSON inválido', { preview: text.slice(0, 400) })
    throw new Error(`OCR devolvió JSON inválido: ${err instanceof Error ? err.message : 'parse error'}`)
  }

  const rawFields = Array.isArray(parsed.fields) ? parsed.fields : []
  const fields: DetectedField[] = rawFields.map((f) => ({
    name: String(f.name ?? '').trim() || `field_${Math.random().toString(36).slice(2, 8)}`,
    label: String(f.label ?? f.name ?? 'Campo'),
    type: validType(f.type),
    required: Boolean(f.required),
    help_text: typeof f.help_text === 'string' ? f.help_text : undefined,
    options: Array.isArray(f.options) ? f.options.map(String) : undefined,
  }))

  log.info('OCR completado', { fieldCount: fields.length })
  return fields
}

function validType(raw: unknown): DetectedField['type'] {
  const allowed: DetectedField['type'][] = [
    'text', 'checkbox', 'radio', 'dropdown', 'date', 'number', 'signature', 'unknown',
  ]
  const v = String(raw ?? '').toLowerCase() as DetectedField['type']
  return allowed.includes(v) ? v : 'text'
}
