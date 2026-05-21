// Extrae datos estructurados del "Auto de Denegación del Juez de Inmigración"
// para auto-rellenar campos del EOIR-26 (Notice of Appeal).
//
// Por ahora solo extrae `decision_date` — la fecha del fallo del IJ, que define
// el plazo legal de 30 días para apelar. Otros campos (last_hearing_location,
// decision_description) pueden añadirse después extendiendo el schema de
// respuesta y el prompt.
//
// El worker async (`/api/workers/extract-eoir-26-decision`) llama esta función
// después de un upload del documento con `document_key='apelacion_denegacion_juez'`.

import type { SupabaseClient } from '@supabase/supabase-js'
import { Type } from '@google/genai'
import { getGeminiClient, GEMINI_MODEL } from '@/lib/ai/gemini'
import { createLogger } from '@/lib/logger'

const log = createLogger('extract-eoir-26-decision')

export interface Eoir26ExtractedFields {
  /** Fecha del fallo del IJ en formato YYYY-MM-DD, o null si no se pudo determinar. */
  decision_date: string | null
}

const EXTRACTION_PROMPT = `Eres un asistente legal experto en documentos del Executive Office for Immigration Review (EOIR).

Analiza este documento — debe ser un "Auto de Denegación del Juez de Inmigración" (Immigration Judge decision) — y extrae ÚNICAMENTE la fecha del fallo en formato YYYY-MM-DD.

REGLAS ESTRICTAS:
- La "fecha del fallo" es la fecha al pie de la decisión, donde el juez firmó o emitió la orden — NO es una fecha de audiencia previa ni la fecha en que se recibió la apelación.
- Si el documento muestra varias fechas, identifica la del fallo/orden final.
- Si la fecha no está claramente legible o no es un Auto de Denegación, responde con null.
- NUNCA inventes ni adivines una fecha. Prefiere null antes que un valor incorrecto.

Devuelve únicamente el JSON con la fecha en formato YYYY-MM-DD o null.`

export async function extractEoir26DecisionFromDoc(
  documentId: string,
  service: SupabaseClient,
): Promise<Eoir26ExtractedFields> {
  const { data: doc, error: docErr } = await service
    .from('documents')
    .select('id, file_path, file_type, name')
    .eq('id', documentId)
    .single()

  if (docErr || !doc) {
    throw new Error(`Document ${documentId} no encontrado: ${docErr?.message ?? 'unknown'}`)
  }

  const { data: fileData, error: dlErr } = await service.storage
    .from('case-documents')
    .download(doc.file_path)
  if (dlErr || !fileData) {
    throw new Error(`No se pudo descargar el archivo ${doc.file_path}: ${dlErr?.message ?? 'unknown'}`)
  }

  const arrayBuffer = await fileData.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  const mimeType = doc.file_type || 'application/pdf'

  const gemini = getGeminiClient()
  const response = await gemini.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { text: EXTRACTION_PROMPT },
          { inlineData: { data: base64, mimeType } },
        ],
      },
    ],
    config: {
      temperature: 0,
      maxOutputTokens: 256,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          decision_date: {
            type: Type.STRING,
            nullable: true,
            description: 'Fecha del fallo del IJ en formato YYYY-MM-DD. null si no se pudo determinar.',
          },
        },
        required: ['decision_date'],
      },
    },
  })

  const rawText = response.text || ''
  let parsed: Eoir26ExtractedFields
  try {
    parsed = JSON.parse(rawText) as Eoir26ExtractedFields
  } catch (err) {
    log.warn('Gemini returned non-JSON', { documentId, rawText: rawText.slice(0, 200) })
    throw new Error(`Gemini devolvió JSON inválido: ${err instanceof Error ? err.message : 'unknown'}`)
  }

  // Validación liviana del formato de fecha — Gemini puede devolver null o YYYY-MM-DD.
  if (parsed.decision_date !== null && parsed.decision_date !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.decision_date)) {
      log.warn('decision_date con formato inesperado, descartado', {
        documentId,
        value: parsed.decision_date,
      })
      parsed.decision_date = null
    }
  }

  log.info('decision_date extracted', { documentId, decision_date: parsed.decision_date })
  return parsed
}
