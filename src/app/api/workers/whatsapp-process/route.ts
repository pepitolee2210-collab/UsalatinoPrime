import { NextRequest, NextResponse } from 'next/server'
import { verifyQStashSignature } from '@/lib/qstash/client'
import { sendWhatsapp } from '@/lib/twilio/client'
import {
  getOrCreateConversation,
  persistInboundMessage,
  persistOutboundMessage,
  updateConversation,
  markTwilioEventProcessed,
  loadChatHistory,
} from '@/lib/chatbot/sijs-session'
import { SIJS_WA_SYSTEM_PROMPT, CANONICAL_MESSAGES } from '@/lib/ai/prompts/sijs-whatsapp-system'
import {
  SIJS_WA_TOOLS,
  dispatchSijsTool,
  type ToolContext,
} from '@/lib/ai/tools/sijs-whatsapp-tools'
import { getGeminiClient, GEMINI_MODEL } from '@/lib/ai/gemini'
import { createLogger } from '@/lib/logger'

const log = createLogger('whatsapp-worker')

interface TwilioParams {
  MessageSid: string
  SmsMessageSid?: string
  From: string
  To: string
  Body?: string
  ProfileName?: string
  WaId?: string
  NumMedia?: string
  MediaUrl0?: string
  MediaContentType0?: string
}

interface WorkerPayload {
  messageSid: string
  params: TwilioParams
}

function phoneFromTwilio(params: TwilioParams): string {
  const waId = params.WaId
  if (waId) return waId.startsWith('+') ? waId : `+${waId}`
  return params.From.replace(/^whatsapp:/, '')
}

function mediaUrlsFromParams(params: TwilioParams): Array<{ url: string; contentType: string }> {
  const n = parseInt(params.NumMedia ?? '0', 10) || 0
  const out: Array<{ url: string; contentType: string }> = []
  for (let i = 0; i < n; i++) {
    const url = (params as unknown as Record<string, string>)[`MediaUrl${i}`]
    const ct = (params as unknown as Record<string, string>)[`MediaContentType${i}`] ?? ''
    if (url) out.push({ url, contentType: ct })
  }
  return out
}

const OPT_OUT_RE = /^\s*(stop|baja|cancelar|unsubscribe|parar|salir)\b/i

export async function POST(request: NextRequest) {
  const raw = await request.text()
  const signature = request.headers.get('upstash-signature')
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const selfUrl = `${proto}://${host}${request.nextUrl.pathname}`

  const valid = await verifyQStashSignature({ signature, body: raw, url: selfUrl })
  if (!valid && process.env.NODE_ENV === 'production') {
    log.warn('invalid qstash signature')
    return new NextResponse('Forbidden', { status: 403 })
  }

  let payload: WorkerPayload
  try {
    payload = JSON.parse(raw) as WorkerPayload
  } catch {
    return new NextResponse('Bad Request', { status: 400 })
  }

  const { messageSid, params } = payload
  if (!messageSid || !params || !params.From) {
    return new NextResponse('Bad Request', { status: 400 })
  }

  try {
    await processInboundMessage({ messageSid, params })
    await markTwilioEventProcessed(messageSid)
    return NextResponse.json({ ok: true })
  } catch (err) {
    log.error('worker error', err)
    await markTwilioEventProcessed(messageSid, String(err)).catch(() => {})
    return new NextResponse('Server Error', { status: 500 })
  }
}

/**
 * Async turn: load state, let Gemini drive the conversation via function
 * calling, send the final text reply via Twilio. The tool dispatcher
 * handles side effects (save intake, book appointment, push admins).
 */
async function processInboundMessage(args: { messageSid: string; params: TwilioParams }) {
  const { messageSid, params } = args
  const phone = phoneFromTwilio(params)
  const profileName = params.ProfileName ?? null
  const body = (params.Body ?? '').trim()
  const media = mediaUrlsFromParams(params)

  const { contact, conversation } = await getOrCreateConversation({
    phoneE164: phone,
    profileName,
  })

  if (contact.opted_out) {
    log.info('ignoring opted-out contact', { phone })
    return
  }

  // Always persist the inbound message first — we never want to lose a user
  // reply even if the AI or Twilio fails downstream.
  await persistInboundMessage({
    conversationId: conversation.id,
    body,
    mediaUrls: media,
    twilioSid: messageSid,
  })

  // Hard safety net: if the user shouts "stop" the AI should also pick it
  // up, but we short-circuit to guarantee a fast, deterministic ack.
  if (OPT_OUT_RE.test(body)) {
    await sendBotMessage({
      conversationId: conversation.id,
      contactPhone: phone,
      text: CANONICAL_MESSAGES.OPTED_OUT,
    })
    await dispatchSijsTool(
      'opt_out',
      {},
      {
        conversation,
        contact,
        phoneE164: phone,
        waProfileName: profileName,
        collected: (conversation.collected_data ?? {}) as Record<string, unknown>,
      },
    )
    return
  }

  // Build the collected context the AI will see. It includes intake answers
  // plus waProfileName so the AI can greet by first name naturally.
  const collected: Record<string, unknown> = {
    ...(conversation.collected_data ?? {}),
  }

  const toolCtx: ToolContext = {
    conversation,
    contact,
    phoneE164: phone,
    waProfileName: profileName,
    collected,
  }

  // Load chat history (last 20 turns) for Gemini context.
  const history = await loadChatHistory(conversation.id, 20)
  // history now ends with the just-persisted user message — drop it so we
  // can `sendMessage(body)` separately (Gemini SDK treats history + latest
  // message as distinct inputs).
  const historyWithoutLatest = history.slice(0, -1)

  const gemini = getGeminiClient()

  // System prompt with a tiny context block so the AI knows what's been
  // collected so far across prior turns (it helps avoid re-asking).
  const contextLine = buildContextBlock(collected, profileName)
  const systemInstruction = `${SIJS_WA_SYSTEM_PROMPT}\n\n## Contexto de la conversación actual\n${contextLine}`

  const chat = gemini.chats.create({
    model: GEMINI_MODEL,
    config: {
      systemInstruction,
      temperature: 0.7,
      maxOutputTokens: 600,
      tools: [
        {
          functionDeclarations: SIJS_WA_TOOLS.map(t => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters as unknown as Record<string, unknown>,
          })) as unknown as Parameters<
            typeof gemini.chats.create
          >[0]['config'] extends infer C
            ? C extends { tools?: Array<{ functionDeclarations?: infer FD }> }
              ? FD
              : never
            : never,
        },
      ],
    },
    history: historyWithoutLatest,
  })

  // Send the user message and loop until the AI emits a turn with no
  // further tool calls. Guard the loop so a misbehaving model cannot spam.
  //
  // IMPORTANT: accumulate text from EVERY turn, not just the last one.
  // Gemini often sends text + function call together (e.g. greets the user
  // in the same turn it calls send_explainer_video). If we only read text
  // from turns with zero function calls, the greeting gets silently dropped
  // and the user sees no reply to their first message.
  let aiTextAccumulator = ''
  let pendingVideoUrl: string | null = null
  let totalInputTokens = 0
  let totalOutputTokens = 0

  let response = await chat.sendMessage({ message: body || '(mensaje vacío)' })
  for (let iter = 0; iter < 6; iter++) {
    totalInputTokens += response.usageMetadata?.promptTokenCount ?? 0
    totalOutputTokens += response.usageMetadata?.candidatesTokenCount ?? 0

    const turnText = extractText(response)
    if (turnText) {
      aiTextAccumulator += (aiTextAccumulator ? '\n\n' : '') + turnText
    }

    const calls = response.functionCalls ?? []
    if (calls.length === 0) break

    // Dispatch every call in this round and send back all responses at once.
    const functionResponses: Array<{ functionResponse: { name: string; response: Record<string, unknown> } }> = []
    for (const call of calls) {
      const name = call.name ?? 'unknown'
      const callArgs = (call.args ?? {}) as Record<string, unknown>
      const dispatched = await dispatchSijsTool(name, callArgs, toolCtx)

      // Keep the shared ctx in sync so later tools see the patch.
      if (dispatched.patch) {
        Object.assign(toolCtx.collected, dispatched.patch)
        if ('__send_video' in dispatched.patch) {
          pendingVideoUrl = dispatched.patch.__send_video as string
          delete (toolCtx.collected as Record<string, unknown>)['__send_video']
        }
      }
      functionResponses.push({
        functionResponse: { name, response: dispatched.result },
      })
    }

    // Persist the running collected_data so if we fail mid-turn the state
    // survives the next QStash retry.
    await updateConversation({
      conversationId: conversation.id,
      collectedData: toolCtx.collected as Parameters<typeof updateConversation>[0]['collectedData'],
    }).catch(() => {})

    response = await chat.sendMessage({
      message: functionResponses as unknown as string,
    })
  }

  const aiText = aiTextAccumulator || CANONICAL_MESSAGES.GEMINI_ERROR

  // Mark video_sent if we just sent it, so future turns don't resend.
  const videoMarkingPromise = pendingVideoUrl
    ? updateConversation({
        conversationId: conversation.id,
        videoSent: true,
      }).catch(() => {})
    : Promise.resolve()

  await sendBotMessage({
    conversationId: conversation.id,
    contactPhone: phone,
    text: aiText,
    mediaUrls: pendingVideoUrl ? [pendingVideoUrl] : undefined,
    tokens: { input: totalInputTokens, output: totalOutputTokens },
  })

  await videoMarkingPromise
}

function buildContextBlock(
  collected: Record<string, unknown>,
  profileName: string | null,
): string {
  const pieces: string[] = []
  if (profileName) pieces.push(`WhatsApp ProfileName: ${profileName}`)
  if (collected.contact_full_name) pieces.push(`Nombre completo confirmado: ${collected.contact_full_name}`)
  if (collected.lives_in_usa !== undefined)
    pieces.push(`lives_in_usa: ${collected.lives_in_usa}`)
  if (collected.age !== undefined) pieces.push(`age: ${collected.age}`)
  if (collected.state_us) pieces.push(`state_us: ${collected.state_us}`)
  if (collected.suffered_abuse !== undefined)
    pieces.push(`suffered_abuse: ${collected.suffered_abuse}`)
  if (collected.verdict) pieces.push(`verdict: ${collected.verdict}`)
  return pieces.length > 0 ? pieces.join(' | ') : '(sin datos recopilados aún)'
}

function extractText(response: unknown): string {
  const r = response as {
    text?: string
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  if (r.text) return r.text.trim()
  const parts = r.candidates?.[0]?.content?.parts ?? []
  return parts
    .map(p => p.text ?? '')
    .join('')
    .trim()
}

async function sendBotMessage(args: {
  conversationId: string
  contactPhone: string
  text: string
  mediaUrls?: string[]
  tokens?: { input?: number; output?: number }
}) {
  try {
    const sent = await sendWhatsapp({
      to: args.contactPhone,
      body: args.text,
      mediaUrls: args.mediaUrls,
    })
    await persistOutboundMessage({
      conversationId: args.conversationId,
      role: 'bot',
      body: args.text,
      twilioSid: sent.sid,
      geminiInputTokens: args.tokens?.input,
      geminiOutputTokens: args.tokens?.output,
      mediaUrls: args.mediaUrls,
    })
  } catch (err) {
    log.error('sendBotMessage failed', err)
    await persistOutboundMessage({
      conversationId: args.conversationId,
      role: 'bot',
      body: args.text,
      mediaUrls: args.mediaUrls,
    })
    throw err
  }
}
