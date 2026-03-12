import { NextRequest } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { CHATBOT_VOICE_SYSTEM_PROMPT } from '@/lib/ai/prompts/chatbot-system'

const VOICE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025'

// Rate limit: max 5 voice sessions per IP per hour
const voiceRateLimits = new Map<string, { count: number; resetAt: number }>()
const VOICE_RATE_MAX = 5
const VOICE_RATE_WINDOW = 60 * 60 * 1000

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const now = Date.now()
    const entry = voiceRateLimits.get(ip)
    if (entry && now <= entry.resetAt && entry.count >= VOICE_RATE_MAX) {
      return Response.json({ error: 'Demasiadas llamadas. Intenta de nuevo más tarde.' }, { status: 429 })
    }
    if (!entry || now > entry.resetAt) {
      voiceRateLimits.set(ip, { count: 1, resetAt: now + VOICE_RATE_WINDOW })
    } else {
      entry.count++
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return Response.json({ error: 'API key not configured' }, { status: 500 })
    }

    // Ephemeral tokens require v1alpha API version
    const client = new GoogleGenAI({
      apiKey,
      httpOptions: { apiVersion: 'v1alpha' },
    })

    const expireTime = new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 min

    const token = await client.authTokens.create({
      config: {
        uses: 1,
        expireTime,
      },
    })

    // Return token + config. Tools use plain string types (not SDK enums)
    // because this config will be JSON-serialized to the client.
    return Response.json({
      token: token.name,
      model: VOICE_MODEL,
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Kore',
            },
          },
        },
        systemInstruction: CHATBOT_VOICE_SYSTEM_PROMPT,
        tools: [{
          functionDeclarations: [{
            name: 'create_lead',
            description: 'Registra un prospecto interesado para que Henry lo contacte.',
            parameters: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING', description: 'Nombre completo del prospecto' },
                phone: { type: 'STRING', description: 'Número de teléfono' },
                service_interest: { type: 'STRING', description: 'Servicio: visa-juvenil, asilo, tps, permiso-trabajo, consulta-general' },
                situation_summary: { type: 'STRING', description: 'Resumen breve de la situación' },
              },
              required: ['name', 'phone', 'service_interest'],
            },
          }],
        }],
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error generating token'
    return Response.json({ error: message }, { status: 500 })
  }
}
