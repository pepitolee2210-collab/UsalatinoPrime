import { NextRequest } from 'next/server'
import { getGeminiClient, GEMINI_MODEL } from '@/lib/ai/gemini'
import { CHATBOT_SYSTEM_PROMPT, CHATBOT_TOOLS } from '@/lib/ai/prompts/chatbot-system'
import { createServiceClient } from '@/lib/supabase/service'

// In-memory session store (expires after 1 hour)
const sessions = new Map<string, { messages: Array<{ role: string; parts: Array<{ text: string }> }>; createdAt: number }>()
const SESSION_TTL = 60 * 60 * 1000 // 1 hour
const MAX_MESSAGES = 30

// Rate limiting: max 30 messages per IP per hour
const rateLimits = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 30
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimits.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

function cleanExpiredSessions() {
  const now = Date.now()
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL) {
      sessions.delete(id)
    }
  }
}

function getOrCreateSession(sessionId: string) {
  cleanExpiredSessions()
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { messages: [], createdAt: Date.now() })
  }
  return sessions.get(sessionId)!
}

async function handleCreateLead(args: { name: string; phone: string; service_interest: string; situation_summary?: string }) {
  const supabase = createServiceClient()

  // Check for duplicate
  const cleanPhone = args.phone.replace(/\D/g, '')
  const { data: existing } = await supabase
    .from('callback_requests')
    .select('id')
    .or(`phone.eq.${args.phone},phone.ilike.%${cleanPhone.slice(-10)}%`)
    .not('status', 'in', '("not_interested","closed")')
    .limit(1)

  if (existing && existing.length > 0) {
    return { success: true, message: 'Ya teníamos tu información registrada. Henry te contactará pronto.' }
  }

  const { data, error } = await supabase
    .from('callback_requests')
    .insert({
      prospect_name: args.name.trim(),
      phone: args.phone.trim(),
      service_interest: args.service_interest.trim(),
      notes: args.situation_summary ? `[Chatbot] ${args.situation_summary}` : '[Chatbot] Prospecto del chatbot',
      source: 'chatbot',
      message_date: new Date().toISOString().split('T')[0],
    })
    .select('id')
    .single()

  if (error) {
    return { success: false, message: 'Error al registrar. Por favor llama al 801-941-3479.' }
  }

  return { success: true, message: `¡Registrado! Henry te contactará pronto.`, id: data.id }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text, audio, session_id } = body

    if (!session_id) {
      return Response.json({ error: 'session_id requerido' }, { status: 400 })
    }

    if (!text && !audio) {
      return Response.json({ error: 'text o audio requerido' }, { status: 400 })
    }

    // Rate limit by IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkRateLimit(ip)) {
      return Response.json({ error: 'Demasiados mensajes. Intenta de nuevo más tarde.' }, { status: 429 })
    }

    const session = getOrCreateSession(session_id)

    if (session.messages.length >= MAX_MESSAGES * 2) {
      return Response.json({ error: 'Sesión expirada. Recarga la página para iniciar una nueva conversación.' }, { status: 429 })
    }

    const gemini = getGeminiClient()

    // Build user message parts
    const userParts: Array<Record<string, unknown>> = []

    if (audio) {
      // Audio message — send as inline data to Gemini
      userParts.push({
        inlineData: {
          data: audio,
          mimeType: 'audio/webm',
        },
      })
      userParts.push({ text: 'El usuario envió un mensaje de voz. Responde en texto basándote en lo que dijo.' })
    } else {
      userParts.push({ text })
    }

    // Add user message to history
    session.messages.push({ role: 'user', parts: userParts as Array<{ text: string }> })

    // Create chat with history
    const chat = gemini.chats.create({
      model: GEMINI_MODEL,
      config: {
        systemInstruction: CHATBOT_SYSTEM_PROMPT,
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 1024,
        tools: [{
          functionDeclarations: CHATBOT_TOOLS.map(t => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
        }],
      },
      history: session.messages.slice(0, -1),
    })

    // Stream response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const lastUserMsg = userParts.length === 1 && userParts[0].text
            ? (userParts[0] as { text: string }).text
            : 'audio_message'

          const response = await chat.sendMessageStream({
            message: lastUserMsg === 'audio_message' ? userParts : lastUserMsg,
          })

          let fullResponse = ''

          for await (const chunk of response) {
            // Check for function calls
            if (chunk.functionCalls && chunk.functionCalls.length > 0) {
              for (const fc of chunk.functionCalls) {
                if (fc.name === 'create_lead') {
                  const result = await handleCreateLead(fc.args as {
                    name: string; phone: string; service_interest: string; situation_summary?: string
                  })

                  // Send the result back to the model
                  const followUp = await chat.sendMessageStream({
                    message: [{
                      functionResponse: {
                        name: 'create_lead',
                        response: result,
                      },
                    }] as unknown as string,
                  })

                  for await (const followChunk of followUp) {
                    const t = followChunk.text || ''
                    if (t) {
                      fullResponse += t
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: t })}\n\n`))
                    }
                  }
                }
              }
            }

            const t = chunk.text || ''
            if (t) {
              fullResponse += t
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: t })}\n\n`))
            }
          }

          // Save assistant response to session
          if (fullResponse) {
            session.messages.push({ role: 'model', parts: [{ text: fullResponse }] })
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Error desconocido'
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch {
    return Response.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
