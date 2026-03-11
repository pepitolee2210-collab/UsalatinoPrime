import { createServiceClient } from '@/lib/supabase/service'
import { getGeminiClient, GEMINI_MODEL } from '@/lib/ai/gemini'

interface DocumentRow {
  id: string
  name: string
  file_path: string
  file_type: string
  document_key: string
  extracted_text: string | null
}

const EXTRACTION_PROMPT = `Analiza este documento y extrae TODA la información relevante.
Incluye: nombres completos, fechas de nacimiento, números de pasaporte/ID, direcciones,
nacionalidades, y cualquier otro dato que encuentres.
Responde en formato estructurado con etiquetas claras.
Si es un documento en español, extrae en español. Si es en inglés, en inglés.
Si no puedes leer algo, indica "[ilegible]".`

export async function extractDocumentsForCase(caseId: string): Promise<number> {
  const supabase = createServiceClient()

  // Get documents without extracted text
  const { data: docs } = await supabase
    .from('documents')
    .select('id, name, file_path, file_type, document_key, extracted_text')
    .eq('case_id', caseId)
    .eq('direction', 'client_to_admin')

  if (!docs || docs.length === 0) return 0

  const unprocessed = (docs as DocumentRow[]).filter(d => !d.extracted_text)
  if (unprocessed.length === 0) return 0

  const gemini = getGeminiClient()
  let processed = 0

  for (const doc of unprocessed) {
    try {
      // Download file from Supabase Storage
      const { data: fileData, error: downloadError } = await supabase
        .storage
        .from('case-documents')
        .download(doc.file_path)

      if (downloadError || !fileData) {
        await supabase
          .from('documents')
          .update({ extracted_text: `[Error al descargar: ${downloadError?.message || 'archivo no encontrado'}]` })
          .eq('id', doc.id)
        continue
      }

      // Convert to base64
      const arrayBuffer = await fileData.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')

      // Determine mime type
      const mimeType = doc.file_type || guessMimeType(doc.name)

      // Call Gemini Vision to extract text
      const response = await gemini.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              { text: `${EXTRACTION_PROMPT}\n\nDocumento: ${doc.name} (categoría: ${doc.document_key})` },
              { inlineData: { data: base64, mimeType } },
            ],
          },
        ],
        config: {
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
      })

      const extractedText = response.text || '[No se pudo extraer texto]'

      // Cache the extracted text
      await supabase
        .from('documents')
        .update({ extracted_text: extractedText })
        .eq('id', doc.id)

      processed++
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido'
      await supabase
        .from('documents')
        .update({ extracted_text: `[Error de extracción: ${errorMsg}]` })
        .eq('id', doc.id)
    }
  }

  return processed
}

function guessMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop()
  switch (ext) {
    case 'pdf': return 'application/pdf'
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    case 'png': return 'image/png'
    case 'webp': return 'image/webp'
    case 'heic': return 'image/heic'
    default: return 'application/pdf'
  }
}
