import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getGeminiClient, GEMINI_MODEL } from '@/lib/ai/gemini'
import { buildCaseContext, buildSystemPrompt } from '@/lib/ai/prompts/chat-system'
import { extractDocumentsForCase } from '@/lib/ai/extract-documents'
import type { Content } from '@google/genai'

const MAX_HISTORY_MESSAGES = 30

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'employee')) {
    return Response.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { case_id, message } = await request.json()

  if (!case_id || !message?.trim()) {
    return Response.json({ error: 'case_id y message son requeridos' }, { status: 400 })
  }

  // Verify case exists
  const { data: caseRow } = await service
    .from('cases')
    .select('id')
    .eq('id', case_id)
    .single()

  if (!caseRow) {
    return Response.json({ error: 'Caso no encontrado' }, { status: 404 })
  }

  // Extract text from documents if not yet processed (runs once per document)
  await extractDocumentsForCase(case_id)

  // Build case context and system prompt (now includes extracted text)
  const caseContext = await buildCaseContext(case_id)
  const systemPrompt = buildSystemPrompt(caseContext)

  // Load chat history
  const { data: historyRows } = await service
    .from('case_chat_messages')
    .select('role, content')
    .eq('case_id', case_id)
    .order('created_at', { ascending: true })
    .limit(MAX_HISTORY_MESSAGES)

  // Build Gemini history (alternating user/model)
  const history: Content[] = (historyRows || [])
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

  // Save user message to DB
  await service.from('case_chat_messages').insert({
    case_id,
    role: 'user',
    content: message.trim(),
  })

  // Create Gemini chat with history and stream response
  const gemini = getGeminiClient()
  const chat = gemini.chats.create({
    model: GEMINI_MODEL,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.7,
      topP: 0.9,
      maxOutputTokens: 8192,
    },
    history,
  })

  const stream = await chat.sendMessageStream({ message: message.trim() })

  // Stream response via ReadableStream
  let fullResponse = ''

  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      try {
        for await (const chunk of stream) {
          const text = chunk.text || ''
          if (text) {
            fullResponse += text
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
          }
        }

        // Send done signal
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
        controller.close()

        // Save assistant response to DB
        if (fullResponse.trim()) {
          await service.from('case_chat_messages').insert({
            case_id,
            role: 'assistant',
            content: fullResponse.trim(),
            metadata: { model: GEMINI_MODEL },
          })
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Error de IA'
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMsg })}\n\n`))
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
