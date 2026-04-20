import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { streamLegalChat, type ChatAttachment, type ChatHistoryMessage } from '@/lib/ai/legal-chat-client'
import { createLogger } from '@/lib/logger'

const log = createLogger('legal-chat-api')

const MAX_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024 // 20MB per file (Gemini inline limit)
const MAX_ATTACHMENTS_PER_MESSAGE = 5

async function ensureAdminOrEmployee() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { service: null as ReturnType<typeof createServiceClient> | null, userId: null }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin' && profile?.role !== 'employee') {
    return { service: null, userId: null }
  }
  return { service: createServiceClient(), userId: user.id }
}

/**
 * GET /api/admin/legal-chat → list user's sessions (newest first)
 */
export async function GET(_request: NextRequest) {
  const { service, userId } = await ensureAdminOrEmployee()
  if (!service || !userId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { data: sessions, error } = await service
    .from('legal_chat_sessions')
    .select('id, title, created_at, updated_at')
    .eq('created_by', userId)
    .eq('archived', false)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) {
    log.error('list sessions failed', error)
    return NextResponse.json({ error: 'Error al cargar sesiones' }, { status: 500 })
  }

  return NextResponse.json({ sessions: sessions || [] })
}

/**
 * POST /api/admin/legal-chat → send a message, stream the response.
 * Body: { session_id?, message, attachments?: [{filename, mime_type, data (base64), size_bytes}] }
 * If session_id is null/missing, creates a new session.
 */
export async function POST(request: NextRequest) {
  const { service, userId } = await ensureAdminOrEmployee()
  if (!service || !userId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await request.json()
  const message = String(body.message || '').trim()
  const attachments = (Array.isArray(body.attachments) ? body.attachments : []) as ChatAttachment[]
  let sessionId = typeof body.session_id === 'string' ? body.session_id : null

  if (!message && attachments.length === 0) {
    return NextResponse.json({ error: 'Mensaje o archivo requerido' }, { status: 400 })
  }
  if (attachments.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    return NextResponse.json({ error: `Máximo ${MAX_ATTACHMENTS_PER_MESSAGE} archivos por mensaje` }, { status: 400 })
  }
  for (const a of attachments) {
    if (!a.data || !a.mime_type || !a.filename) {
      return NextResponse.json({ error: 'Archivo inválido' }, { status: 400 })
    }
    if (a.size_bytes > MAX_ATTACHMENT_SIZE_BYTES) {
      return NextResponse.json({ error: `Archivo "${a.filename}" excede 20MB` }, { status: 400 })
    }
  }

  // Create or reuse session
  if (!sessionId) {
    const initialTitle = message.slice(0, 80) || attachments[0]?.filename.slice(0, 80) || 'Nueva conversación'
    const { data: newSession, error: createErr } = await service
      .from('legal_chat_sessions')
      .insert({ title: initialTitle, created_by: userId })
      .select('id')
      .single()
    if (createErr || !newSession) {
      log.error('create session failed', createErr)
      return NextResponse.json({ error: 'No se pudo crear la sesión' }, { status: 500 })
    }
    sessionId = newSession.id
  }

  // Fetch history for context (max 30 previous messages)
  const { data: historyRows } = await service
    .from('legal_chat_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(30)

  const history: ChatHistoryMessage[] = (historyRows || []).map(r => ({
    role: r.role as 'user' | 'assistant',
    content: r.content as string,
  }))

  // Persist user message BEFORE streaming (so it's visible even if stream fails)
  const attachmentMetadata = attachments.map(a => ({
    filename: a.filename,
    mime_type: a.mime_type,
    size_bytes: a.size_bytes,
  }))
  await service.from('legal_chat_messages').insert({
    session_id: sessionId,
    role: 'user',
    content: message || '[archivo adjunto]',
    attachments: attachmentMetadata,
  })

  // Bump session updated_at
  await service
    .from('legal_chat_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', sessionId)

  // Start Gemini stream
  let upstream: ReadableStream<Uint8Array>
  try {
    upstream = await streamLegalChat({
      userMessage: message,
      attachments,
      history,
      signal: request.signal,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error de IA'
    log.error('start stream failed', err)
    return NextResponse.json({ error: msg, session_id: sessionId }, { status: 500 })
  }

  // Tee the stream: one side goes to the client, the other accumulates to persist
  // We do this by wrapping the upstream with a transformer that captures text.
  let assistantText = ''
  let inputTokens = 0
  let outputTokens = 0

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const clientStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Send session_id up front so the client can pin subsequent messages
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ session_id: sessionId })}\n\n`))

      const reader = upstream.getReader()
      let buffer = ''
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          controller.enqueue(value)

          // Parse chunks to capture text for DB persistence
          buffer += decoder.decode(value, { stream: true })
          const frames = buffer.split('\n\n')
          buffer = frames.pop() || ''
          for (const frame of frames) {
            const line = frame.trim()
            if (!line.startsWith('data:')) continue
            const json = line.slice(5).trim()
            if (!json) continue
            try {
              const parsed = JSON.parse(json)
              if (parsed.text) assistantText += parsed.text
              if (parsed.input_tokens) inputTokens = parsed.input_tokens
              if (parsed.output_tokens) outputTokens = parsed.output_tokens
            } catch {
              // ignore
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'stream error'
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
      } finally {
        // Persist assistant message (even partial on error)
        if (assistantText.trim().length > 0) {
          try {
            await service.from('legal_chat_messages').insert({
              session_id: sessionId,
              role: 'assistant',
              content: assistantText,
              input_tokens: inputTokens || null,
              output_tokens: outputTokens || null,
            })
            await service
              .from('legal_chat_sessions')
              .update({ updated_at: new Date().toISOString() })
              .eq('id', sessionId)
          } catch (persistErr) {
            log.error('persist assistant failed', persistErr)
          }
        }
        controller.close()
      }
    },
  })

  return new Response(clientStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
