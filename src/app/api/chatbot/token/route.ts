import { NextRequest } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { CHATBOT_VOICE_SYSTEM_PROMPT } from '@/lib/ai/prompts/chatbot-system'
import { checkVoiceRateLimit } from '@/lib/voice-agent/rate-limit'
import { isWithinBusinessHours } from '@/lib/voice-agent/business-hours'
import { isAdminOrEmployee } from '@/lib/voice-agent/auth-check'
import { createServiceClient } from '@/lib/supabase/service'

// Native audio model — supports Live API + function calling
const VOICE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025'

function formatResetTime(d: Date): string {
  try {
    return d.toLocaleTimeString('es-US', {
      timeZone: 'America/Denver',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return d.toISOString()
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const userAgent = request.headers.get('user-agent') || null

    // Optional body: reconnection carries previous_call_id and/or a session
    // handle so the voice_calls row is reused and the rate limit isn't spent
    // on what is really a single conversation recovering from a network blip.
    let previousCallId: string | null = null
    let previousSessionHandle: string | null = null
    try {
      const body = await request.json().catch(() => ({}))
      if (body && typeof body.previous_call_id === 'string' && body.previous_call_id.length > 0) {
        previousCallId = body.previous_call_id
      }
      if (body && typeof body.previous_session_handle === 'string' && body.previous_session_handle.length > 0) {
        previousSessionHandle = body.previous_session_handle
      }
    } catch {
      // request has no body — treat as a fresh call
    }

    // Two paths skip the rate limit:
    //   1. Reconnection (same conversation continuing after a transient drop).
    //   2. Admin/employee session (Henry/Diana testing and supporting).
    const isReconnect = !!(previousCallId || previousSessionHandle)
    const isStaff = !isReconnect && (await isAdminOrEmployee(request))

    if (!isReconnect && !isStaff) {
      const rl = await checkVoiceRateLimit(ip, 2, 'token')
      if (!rl.allowed) {
        const when = formatResetTime(rl.resetsAt)
        return Response.json(
          {
            error: `Solo puedes iniciar 2 llamadas cada 30 minutos. Podrás volver a intentarlo a las ${when} (hora de Utah). Si es urgente, llama al 801-941-3479.`,
            retry_at: rl.resetsAt.toISOString(),
          },
          { status: 429 },
        )
      }
    }

    // Warn (not block) outside business hours. The client decides if it wants
    // to connect anyway (e.g. to leave a callback request).
    const hours = isWithinBusinessHours()

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return Response.json({ error: 'API key not configured' }, { status: 500 })
    }

    const client = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1alpha' } })
    const expireTime = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    const token = await client.authTokens.create({ config: { uses: 1, expireTime } })

    // Record that a call was initiated. If the client is reconnecting we
    // reuse the existing voice_calls row (so duration reflects the full
    // conversation, not just the final segment).
    let callId: string | null = previousCallId
    if (!callId) {
      try {
        const supabase = createServiceClient()
        const { data: callRecord } = await supabase
          .from('voice_calls')
          .insert({ ip_address: ip, user_agent: userAgent })
          .select('id')
          .single()
        callId = callRecord?.id ?? null
      } catch {
        // ignore — the call will proceed without an id
      }
    }

    return Response.json({
      token: token.name,
      model: VOICE_MODEL,
      call_id: callId,
      business_hours: hours,
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
        systemInstruction: CHATBOT_VOICE_SYSTEM_PROMPT,
        // Transcription of both sides. We keep an in-memory log on the
        // client and inject it back on reconnect so the model retains
        // context ("no vuelvas a preguntar el nombre").
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        // Session resumption lets Gemini hand us a handle we can use to
        // reopen the conversation with the server-side history intact.
        // If the handle expires or is rejected, the client falls back to
        // sendClientContent() with a text summary of the last turns.
        sessionResumption: previousSessionHandle
          ? { handle: previousSessionHandle }
          : {},
        // Turn detection: let Gemini use its defaults. We tried tightening
        // this (START_SENSITIVITY_LOW + silenceDurationMs 900) combined with
        // the client-side noise gate and it caused the model to never
        // detect end-of-turn — the client would speak and the IA never
        // replied. Keeping the defaults works because the worklet now emits
        // digital silence (zeros) when the gate is closed, so Gemini's VAD
        // still sees natural silence between speech.
        //
        // Only keep a modest silence buffer so natural short pauses don't
        // cut the client's turn prematurely.
        realtimeInputConfig: {
          automaticActivityDetection: {
            silenceDurationMs: 600,
          },
        },
        tools: [
          {
            functionDeclarations: [
              {
                name: 'create_lead',
                description:
                  'Registra un prospecto para que Henry lo contacte después. Úsalo solo si el prospecto NO quiere agendar una cita ahora, o fuera del horario de atención.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    name: { type: 'STRING', description: 'Nombre completo del prospecto' },
                    phone: { type: 'STRING', description: 'Número de teléfono' },
                    service_interest: { type: 'STRING', description: 'Siempre "visa-juvenil"' },
                    situation_summary: {
                      type: 'STRING',
                      description: 'Resumen: estado, cantidad de hijos, edades, situación',
                    },
                  },
                  required: ['name', 'phone', 'service_interest'],
                },
              },
              {
                name: 'get_available_slots',
                description:
                  'Consulta los horarios disponibles para una fecha específica (YYYY-MM-DD) en Mountain Time. Devuelve hasta varios slots con formato legible. Úsalo cuando el prospecto esté listo para agendar y tengas una fecha candidata.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    date: {
                      type: 'STRING',
                      description: 'Fecha en formato YYYY-MM-DD (ej: 2026-04-20)',
                    },
                  },
                  required: ['date'],
                },
              },
              {
                name: 'book_appointment',
                description:
                  'Agenda una cita confirmada con Henry para el prospecto. Usa el ISO timestamp exacto devuelto por get_available_slots en el campo scheduled_at. IMPORTANTE: antes de llamar, confirma el número de teléfono repitiéndolo en voz alta dígito por dígito.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    name: { type: 'STRING', description: 'Nombre completo del prospecto' },
                    phone: { type: 'STRING', description: 'Número confirmado' },
                    scheduled_at: {
                      type: 'STRING',
                      description:
                        'ISO timestamp UTC del slot elegido (ej: 2026-04-20T15:00:00.000Z)',
                    },
                    notes: {
                      type: 'STRING',
                      description: 'Resumen breve: estado, edad hijos, situación',
                    },
                  },
                  required: ['name', 'phone', 'scheduled_at'],
                },
              },
            ],
          },
        ],
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error generating token'
    return Response.json({ error: message }, { status: 500 })
  }
}
