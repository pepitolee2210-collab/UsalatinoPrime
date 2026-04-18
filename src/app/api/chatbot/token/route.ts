import { NextRequest } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { CHATBOT_VOICE_SYSTEM_PROMPT } from '@/lib/ai/prompts/chatbot-system'
import { checkVoiceRateLimit } from '@/lib/voice-agent/rate-limit'
import { isWithinBusinessHours } from '@/lib/voice-agent/business-hours'
import { createServiceClient } from '@/lib/supabase/service'

// Native audio model — supports Live API + function calling
const VOICE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025'

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const userAgent = request.headers.get('user-agent') || null

    // Persistent rate limit (works across serverless instances).
    const rl = await checkVoiceRateLimit(ip)
    if (!rl.allowed) {
      return Response.json(
        {
          error: 'Demasiadas llamadas. Intenta de nuevo más tarde.',
          retry_at: rl.resetsAt.toISOString(),
        },
        { status: 429 },
      )
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

    // Record that a call was initiated. The front-end will update it on close.
    const supabase = createServiceClient()
    const { data: callRecord } = await supabase
      .from('voice_calls')
      .insert({ ip_address: ip, user_agent: userAgent })
      .select('id')
      .single()

    return Response.json({
      token: token.name,
      model: VOICE_MODEL,
      call_id: callRecord?.id ?? null,
      business_hours: hours,
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
        systemInstruction: CHATBOT_VOICE_SYSTEM_PROMPT,
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
