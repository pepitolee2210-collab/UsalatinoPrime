/**
 * Servicio dedicado de transcripción de voz para el portal del cliente
 * (/cita/[token]). NO comparte modelo ni cliente con `lib/ai/gemini.ts`
 * — es totalmente independiente para que Henry pueda mover/optimizar
 * la transcripción sin tocar el resto de integraciones de Gemini.
 *
 * Modelo: Gemini 2.5 Flash Lite (el más barato y rápido para STT simple
 * con limpieza ligera). Si después se quiere mayor calidad, basta con
 * cambiar TRANSCRIPTION_MODEL a `gemini-2.5-flash` o `gemini-2.5-pro`.
 */

import { GoogleGenAI } from '@google/genai'
import { createLogger } from '@/lib/logger'

const log = createLogger('voice-transcription')

export const TRANSCRIPTION_MODEL = 'gemini-2.5-flash-lite'

let _client: GoogleGenAI | null = null
function getClient(): GoogleGenAI {
  if (_client) return _client
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada')
  _client = new GoogleGenAI({ apiKey })
  return _client
}

const SYSTEM_PROMPT = `Eres una transcriptora profesional bilingüe especializada en relatos de casos legales de inmigración. Tu tarea: transcribir el audio del cliente a texto en español, listo para incluirse en una declaración formal.

REGLAS:

1. **Idioma**: español latinoamericano. Si el cliente mezcla con inglés, transcribe el inglés tal cual entre comillas.
2. **Precisión**: NO inventes ni añadas información. Solo lo que la persona dijo.
3. **Limpieza ligera**:
   - Elimina muletillas: "este", "eh", "o sea", "pues", "como que", "tipo".
   - Si la persona se corrige a sí misma ("dije X… digo Y"), queda solo la corrección final.
   - Aplica puntuación correcta: comas, puntos, signos de pregunta y exclamación.
   - Capitaliza nombres propios y comienzos de oración.
4. **Naturalidad**: respeta la voz del cliente. NO conviertas a lenguaje legal — el sistema lo formaliza después.
5. **Estructura**: si el relato tiene varios momentos, sepáralos en párrafos cortos (uno por idea).
6. **Sin meta-comentarios**: NO digas "el cliente dice…" ni añadas títulos. SOLO el texto transcrito.
7. **Si el audio está vacío o es ruido**: devuelve EXACTAMENTE el string "[AUDIO VACÍO]" sin nada más.

OUTPUT: solo el texto transcrito, sin markdown, sin comillas envolventes, sin nada antes ni después.`

export interface TranscriptionResult {
  text: string
  durationMs: number
  modelUsed: string
}

/**
 * Transcribe un buffer de audio (webm/opus, mp4/aac, wav, mp3) a texto en
 * español, con limpieza ligera de muletillas y puntuación correcta.
 *
 * Tamaño máximo recomendado: 25 MB (~5 minutos de audio webm/opus).
 */
export async function transcribeAudioToText(
  audioBuffer: ArrayBuffer | Uint8Array | Buffer,
  mimeType: string,
): Promise<TranscriptionResult> {
  const startMs = Date.now()
  const client = getClient()

  // Normalizar a base64 para inlineData de Gemini
  let bytes: Uint8Array
  if (audioBuffer instanceof ArrayBuffer) {
    bytes = new Uint8Array(audioBuffer)
  } else if (audioBuffer instanceof Uint8Array) {
    bytes = audioBuffer
  } else {
    // Buffer (Node) — duck-typed con buffer/byteOffset/byteLength
    const b = audioBuffer as { buffer: ArrayBufferLike; byteOffset: number; byteLength: number }
    bytes = new Uint8Array(b.buffer, b.byteOffset, b.byteLength)
  }
  const base64 = Buffer.from(bytes).toString('base64')

  log.info('transcribing audio', { mimeType, sizeKb: Math.round(bytes.byteLength / 1024) })

  const response = await client.models.generateContent({
    model: TRANSCRIPTION_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: base64 } },
          { text: 'Transcribe este audio siguiendo las reglas del system prompt.' },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.1,
      maxOutputTokens: 4096,
    },
  })

  const text = (response.text ?? '').trim()

  log.info('transcription complete', {
    elapsedMs: Date.now() - startMs,
    chars: text.length,
  })

  return {
    text: text === '[AUDIO VACÍO]' ? '' : text,
    durationMs: Date.now() - startMs,
    modelUsed: TRANSCRIPTION_MODEL,
  }
}
