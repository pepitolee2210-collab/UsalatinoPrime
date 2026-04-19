import { NextRequest } from 'next/server'
import { getGeminiClient, GEMINI_MODEL } from '@/lib/ai/gemini'
import { CHATBOT_SYSTEM_PROMPT, CHATBOT_TOOLS } from '@/lib/ai/prompts/chatbot-system'
import { createServiceClient } from '@/lib/supabase/service'
import {
  getAvailableSlots,
  getNextAvailableSlot,
  formatToMT,
  formatDateMT,
} from '@/lib/appointments/slots'

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

/**
 * Loads the prospect calendar config once per tool call. Used by both
 * slot-lookup helpers to read the INDEPENDENT prospect calendar (distinct
 * from scheduling_config which is for real clients).
 */
async function loadProspectCalendar() {
  const supabase = createServiceClient()
  const [configRes, settingsRes, blockedRes] = await Promise.all([
    supabase.from('prospect_scheduling_config').select('*'),
    supabase.from('prospect_scheduling_settings').select('*').maybeSingle(),
    supabase.from('prospect_blocked_dates').select('blocked_date'),
  ])
  return {
    supabase,
    config: configRes.data || [],
    slotDuration: settingsRes.data?.slot_duration_minutes || 30,
    advanceNoticeHours: settingsRes.data?.advance_notice_hours ?? 2,
    blockedDates: (blockedRes.data || []).map((b: { blocked_date: string }) => b.blocked_date),
  }
}

async function handleGetNextSlot() {
  const { supabase, config, slotDuration, advanceNoticeHours, blockedDates } = await loadProspectCalendar()
  const rangeEnd = new Date(Date.now() + 14 * 86400_000).toISOString()
  const { data: existing } = await supabase
    .from('appointments')
    .select('id, scheduled_at, duration_minutes, status')
    .eq('status', 'scheduled')
    .gte('scheduled_at', new Date().toISOString())
    .lte('scheduled_at', rangeEnd)

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const next = getNextAvailableSlot(
    today,
    config,
    (existing || []).map(a => a as never),
    slotDuration,
    blockedDates,
    advanceNoticeHours,
    14,
  )
  if (!next) {
    return { suggested: null, message: 'No hay horarios disponibles en las próximas 2 semanas.' }
  }
  return {
    suggested: {
      iso: next.iso,
      date: next.date,
      human_date: formatDateMT(next.iso),
      human_time: formatToMT(next.iso),
    },
  }
}

async function handleGetSlots(args: { date: string }) {
  if (!args.date || !/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
    return { error: 'Fecha inválida. Usa YYYY-MM-DD.' }
  }
  const { supabase, config, slotDuration, blockedDates } = await loadProspectCalendar()
  if (blockedDates.includes(args.date)) {
    return { slots: [], blocked: true, human_readable: [], date: args.date }
  }
  const dayStart = `${args.date}T00:00:00Z`
  const dayEnd = `${args.date}T23:59:59Z`
  const { data: existing } = await supabase
    .from('appointments')
    .select('id, scheduled_at, duration_minutes, status')
    .eq('status', 'scheduled')
    .gte('scheduled_at', dayStart)
    .lte('scheduled_at', dayEnd)
  const slots = getAvailableSlots(
    args.date,
    config,
    (existing || []).map(a => a as never),
    slotDuration,
  )
  return {
    slots,
    human_readable: slots.map(iso => ({ iso, human: formatToMT(iso) })),
    date: args.date,
  }
}

async function handleBookAppointment(args: { name: string; phone: string; scheduled_at: string; notes?: string }) {
  if (!args.name?.trim() || !args.phone?.trim() || !args.scheduled_at) {
    return { success: false, error: 'Faltan datos para agendar.' }
  }
  const cleanDate = new Date(args.scheduled_at)
  if (isNaN(cleanDate.getTime()) || cleanDate.getTime() < Date.now() - 60_000) {
    return { success: false, error: 'Fecha inválida o en el pasado.' }
  }
  const supabase = createServiceClient()

  const { data: slotTaken } = await supabase
    .from('appointments')
    .select('id')
    .eq('scheduled_at', cleanDate.toISOString())
    .eq('status', 'scheduled')
    .maybeSingle()
  if (slotTaken) {
    return { success: false, slot_taken: true, error: 'Ese horario ya fue tomado. Por favor elige otro.' }
  }

  const cleanPhone = String(args.phone).trim().slice(0, 30)
  const { data: existingForPhone } = await supabase
    .from('appointments')
    .select('id')
    .eq('guest_phone', cleanPhone)
    .eq('status', 'scheduled')
    .limit(1)
  if (existingForPhone && existingForPhone.length > 0) {
    return {
      success: false,
      existing: true,
      error: 'Ya tienes una cita agendada. Si deseas cambiarla, llama al 801-941-3479.',
    }
  }

  const { data: appointment, error } = await supabase
    .from('appointments')
    .insert({
      scheduled_at: cleanDate.toISOString(),
      guest_name: String(args.name).trim().slice(0, 120),
      guest_phone: cleanPhone,
      source: 'chatbot',
      notes: args.notes ? String(args.notes).slice(0, 500) : null,
      reminder_1h_requested: true,
      reminder_24h_requested: true,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return { success: false, slot_taken: true, error: 'Ese horario ya fue tomado.' }
    return { success: false, error: 'Error al agendar.' }
  }
  return {
    success: true,
    appointment,
    confirmation: {
      date: formatDateMT(appointment.scheduled_at),
      time: formatToMT(appointment.scheduled_at),
    },
  }
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
          // Cast: CHATBOT_TOOLS has heterogeneous `parameters` shapes (one per
          // tool). TypeScript narrows the union to "every prop is maybe
          // undefined" which conflicts with FunctionDeclaration's Schema type.
          // Shape is correct at runtime — cast to the SDK's type to proceed.
          functionDeclarations: CHATBOT_TOOLS.map(t => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters as unknown as Record<string, unknown>,
          })) as unknown as Parameters<typeof gemini.chats.create>[0]['config'] extends infer C
            ? C extends { tools?: Array<{ functionDeclarations?: infer FD }> } ? FD : never
            : never,
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

          // Dispatch table for tools the chat can invoke. Mirrors the voice
          // agent's toolset so the two channels have feature parity: the chat
          // can now propose slots, book appointments, and fall back to lead
          // capture if the prospect isn't ready to schedule.
          async function dispatchTool(name: string, args: unknown): Promise<unknown> {
            switch (name) {
              case 'create_lead':
                return handleCreateLead(args as { name: string; phone: string; service_interest: string; situation_summary?: string })
              case 'get_next_available_slot':
                return handleGetNextSlot()
              case 'get_available_slots':
                return handleGetSlots(args as { date: string })
              case 'book_appointment':
                return handleBookAppointment(args as { name: string; phone: string; scheduled_at: string; notes?: string })
              default:
                return { error: `Unknown tool: ${name}` }
            }
          }

          for await (const chunk of response) {
            if (chunk.functionCalls && chunk.functionCalls.length > 0) {
              for (const fc of chunk.functionCalls) {
                const toolName = fc.name || 'unknown'
                const result = await dispatchTool(toolName, fc.args)

                // Loop tool→model follow-ups until the model stops emitting
                // function calls. Important because the model often chains
                // get_next_available_slot → book_appointment in one turn.
                let followResponse = await chat.sendMessageStream({
                  message: [{
                    functionResponse: { name: toolName, response: result as Record<string, unknown> },
                  }] as unknown as string,
                })

                let guard = 0
                // eslint-disable-next-line no-constant-condition
                while (true) {
                  if (guard++ > 4) break // safety: never loop forever
                  let sawCall = false
                  for await (const followChunk of followResponse) {
                    if (followChunk.functionCalls && followChunk.functionCalls.length > 0) {
                      for (const fc2 of followChunk.functionCalls) {
                        const toolName2 = fc2.name || 'unknown'
                        const result2 = await dispatchTool(toolName2, fc2.args)
                        followResponse = await chat.sendMessageStream({
                          message: [{
                            functionResponse: { name: toolName2, response: result2 as Record<string, unknown> },
                          }] as unknown as string,
                        })
                        sawCall = true
                        break
                      }
                      if (sawCall) break
                    }
                    const t = followChunk.text || ''
                    if (t) {
                      fullResponse += t
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: t })}\n\n`))
                    }
                  }
                  if (!sawCall) break
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
