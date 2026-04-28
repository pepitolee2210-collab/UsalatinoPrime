import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { transcribeAudioToText } from '@/lib/ai/voice-transcription'
import { createLogger } from '@/lib/logger'

const log = createLogger('cita/transcribe')

const MAX_AUDIO_BYTES = 25 * 1024 * 1024 // 25 MB → ~5 min en webm/opus
const ALLOWED_MIME_PREFIX = 'audio/'
const RATE_LIMIT_PER_TOKEN_PER_HOUR = 30

/**
 * POST /api/cita/[token]/transcribe
 *
 * Recibe un audio del cliente (multipart form-data, campo `audio`) y devuelve
 * la transcripción en español lista para ser pegada al textarea del formulario.
 *
 * Auth: el token de la cita (mismo que valida /api/client/preview-doc, etc).
 *
 * Privacidad: el audio se procesa en RAM y se descarta. NUNCA se guarda en BD
 * ni en Storage. Solo el texto transcrito termina en case_form_submissions
 * cuando el cliente guarda el formulario.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'token requerido' }, { status: 400 })

  const supabase = createServiceClient()

  // 1. Validar token de cita
  const { data: tokenData } = await supabase
    .from('appointment_tokens')
    .select('client_id, is_active')
    .eq('token', token)
    .single()

  if (!tokenData?.is_active) {
    return NextResponse.json({ error: 'Token inválido o inactivo' }, { status: 403 })
  }

  // 2. Rate limiting suave por token (30/hora)
  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString()
  const { count } = await supabase
    .from('voice_transcriptions_log')
    .select('id', { count: 'exact', head: true })
    .eq('token', token)
    .gte('created_at', oneHourAgo)

  if ((count ?? 0) >= RATE_LIMIT_PER_TOKEN_PER_HOUR) {
    return NextResponse.json(
      { error: 'Demasiadas transcripciones en la última hora. Intenta en unos minutos.' },
      { status: 429 },
    )
  }

  // 3. Leer y validar el audio
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el archivo de audio' }, { status: 400 })
  }

  const audioBlob = formData.get('audio')
  if (!(audioBlob instanceof Blob)) {
    return NextResponse.json({ error: 'Falta el archivo de audio (campo `audio`)' }, { status: 400 })
  }

  const mimeType = audioBlob.type || 'audio/webm'
  if (!mimeType.startsWith(ALLOWED_MIME_PREFIX)) {
    return NextResponse.json({ error: `Tipo de archivo no permitido: ${mimeType}` }, { status: 400 })
  }

  if (audioBlob.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: `El audio supera el límite de ${Math.round(MAX_AUDIO_BYTES / 1024 / 1024)} MB. Graba en segmentos más cortos.` },
      { status: 413 },
    )
  }
  if (audioBlob.size < 1024) {
    return NextResponse.json({ error: 'El audio es demasiado corto' }, { status: 400 })
  }

  // 4. Transcribir
  let transcription: string
  let durationMs: number
  try {
    const buffer = await audioBlob.arrayBuffer()
    const result = await transcribeAudioToText(buffer, mimeType)
    transcription = result.text
    durationMs = result.durationMs
  } catch (err) {
    log.error('transcription failed', { token, err: err instanceof Error ? err.message : err })
    return NextResponse.json(
      { error: 'No se pudo transcribir el audio. Intenta grabar de nuevo en un lugar más silencioso.' },
      { status: 502 },
    )
  }

  // 5. Log para auditoría + rate limit (sin guardar el audio ni el texto)
  try {
    await supabase.from('voice_transcriptions_log').insert({
      token,
      client_id: tokenData.client_id,
      audio_size_bytes: audioBlob.size,
      audio_mime: mimeType,
      char_count: transcription.length,
      duration_ms: durationMs,
    })
  } catch (err) {
    // No-fatal: si el log falla, igual devolvemos la transcripción
    log.warn('transcription log insert failed (no-fatal)', { err })
  }

  return NextResponse.json({
    text: transcription,
    chars: transcription.length,
  })
}
