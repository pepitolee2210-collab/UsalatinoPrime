import { NextRequest } from 'next/server'
import { getGeminiClient } from '@/lib/ai/gemini'
import { CHATBOT_VOICE_SYSTEM_PROMPT, CHATBOT_TOOLS } from '@/lib/ai/prompts/chatbot-system'

export const VOICE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025'

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

    const client = getGeminiClient()

    const expireTime = new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 min
    const newSessionExpireTime = new Date(Date.now() + 2 * 60 * 1000).toISOString() // 2 min to start

    const token = await (client as unknown as {
      authTokens: {
        create: (config: Record<string, unknown>) => Promise<{ name: string }>
      }
    }).authTokens.create({
      config: {
        uses: 1,
        expireTime,
        newSessionExpireTime,
        httpOptions: { apiVersion: 'v1alpha' },
      },
    })

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
          functionDeclarations: CHATBOT_TOOLS.map(t => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
        }],
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error generating token'
    return Response.json({ error: message }, { status: 500 })
  }
}
