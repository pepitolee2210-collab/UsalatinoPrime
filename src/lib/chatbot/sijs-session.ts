import { createServiceClient } from '@/lib/supabase/service'
import { createLogger } from '@/lib/logger'
import type { CollectedData, SijsStep } from './sijs-state-machine'

const log = createLogger('sijs-session')

export interface ConversationRow {
  id: string
  contact_id: string
  status: string
  current_step: SijsStep
  collected_data: CollectedData
  retry_count: number
  video_sent: boolean
  appointment_id: string | null
  last_message_at: string
  total_messages: number
}

export interface ContactRow {
  id: string
  phone_e164: string
  display_name: string | null
  wa_profile_name: string | null
  opted_out: boolean
  state_us: string | null
  inferred_timezone: string | null
  language: string
}

/**
 * Gets or creates the contact + active conversation for a phone number.
 * Idempotent; safe to call on every inbound message.
 */
export async function getOrCreateConversation(args: {
  phoneE164: string
  profileName?: string | null
}): Promise<{ contact: ContactRow; conversation: ConversationRow }> {
  const supabase = createServiceClient()

  // 1) Upsert contact by phone_e164.
  const { data: existingContact } = await supabase
    .from('whatsapp_contacts')
    .select('*')
    .eq('phone_e164', args.phoneE164)
    .maybeSingle()

  let contact: ContactRow
  if (existingContact) {
    contact = existingContact as ContactRow
    const updates: Record<string, unknown> = { last_interaction_at: new Date().toISOString() }
    if (args.profileName && args.profileName !== contact.wa_profile_name) {
      updates.wa_profile_name = args.profileName
    }
    await supabase.from('whatsapp_contacts').update(updates).eq('id', contact.id)
  } else {
    const { data: created, error } = await supabase
      .from('whatsapp_contacts')
      .insert({
        phone_e164: args.phoneE164,
        wa_profile_name: args.profileName ?? null,
        display_name: args.profileName ?? null,
      })
      .select('*')
      .single()
    if (error || !created) {
      log.error('create contact failed', error)
      throw error ?? new Error('Could not create contact')
    }
    contact = created as ContactRow
  }

  // 2) Find active conversation, else open a new one.
  const { data: activeConv } = await supabase
    .from('whatsapp_conversations')
    .select('*')
    .eq('contact_id', contact.id)
    .in('status', ['active', 'filtered_in', 'filtered_out'])
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (activeConv) {
    return { contact, conversation: activeConv as ConversationRow }
  }

  const { data: newConv, error: convErr } = await supabase
    .from('whatsapp_conversations')
    .insert({ contact_id: contact.id })
    .select('*')
    .single()
  if (convErr || !newConv) {
    log.error('create conversation failed', convErr)
    throw convErr ?? new Error('Could not create conversation')
  }
  return { contact, conversation: newConv as ConversationRow }
}

export async function persistInboundMessage(args: {
  conversationId: string
  body: string
  mediaUrls?: Array<{ url: string; contentType: string }>
  twilioSid: string
}): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase.from('whatsapp_messages').insert({
    conversation_id: args.conversationId,
    role: 'user',
    direction: 'inbound',
    body: args.body,
    media_urls: args.mediaUrls ?? [],
    twilio_sid: args.twilioSid,
  })
  // 23505 = unique violation on twilio_sid: message already stored. Safe to ignore.
  if (error && error.code !== '23505') {
    log.error('persistInbound failed', error)
    throw error
  }
}

export async function persistOutboundMessage(args: {
  conversationId: string
  role: 'bot' | 'admin' | 'system'
  body: string
  twilioSid?: string
  geminiInputTokens?: number
  geminiOutputTokens?: number
  costUsd?: number
  mediaUrls?: string[]
}): Promise<void> {
  const supabase = createServiceClient()
  await supabase.from('whatsapp_messages').insert({
    conversation_id: args.conversationId,
    role: args.role,
    direction: 'outbound',
    body: args.body,
    twilio_sid: args.twilioSid ?? null,
    gemini_input_tokens: args.geminiInputTokens ?? null,
    gemini_output_tokens: args.geminiOutputTokens ?? null,
    cost_usd: args.costUsd ?? null,
    media_urls: args.mediaUrls ? args.mediaUrls.map(url => ({ url })) : [],
  })
}

export async function updateConversation(args: {
  conversationId: string
  currentStep?: SijsStep
  collectedData?: CollectedData
  retryCount?: number
  videoSent?: boolean
  appointmentId?: string | null
  status?: string
  closedReason?: string
}): Promise<void> {
  const supabase = createServiceClient()
  const patch: Record<string, unknown> = { last_message_at: new Date().toISOString() }
  if (args.currentStep !== undefined) patch.current_step = args.currentStep
  if (args.collectedData !== undefined) patch.collected_data = args.collectedData
  if (args.retryCount !== undefined) patch.retry_count = args.retryCount
  if (args.videoSent !== undefined) patch.video_sent = args.videoSent
  if (args.appointmentId !== undefined) patch.appointment_id = args.appointmentId
  if (args.status !== undefined) patch.status = args.status
  if (args.closedReason !== undefined) {
    patch.closed_reason = args.closedReason
    patch.closed_at = new Date().toISOString()
  }
  const { error } = await supabase
    .from('whatsapp_conversations')
    .update(patch)
    .eq('id', args.conversationId)
  if (error) {
    log.error('updateConversation failed', error)
    throw error
  }
}

export async function upsertSijsIntake(args: {
  conversationId: string
  contactId: string
  collectedData: CollectedData
  verdict?: 'eligible' | 'not_eligible' | 'requires_review'
  verdictReasoning?: string
  stateAgeLimit?: number
  aiModel?: string
}): Promise<void> {
  const supabase = createServiceClient()
  const row = {
    conversation_id: args.conversationId,
    contact_id: args.contactId,
    lives_in_usa: args.collectedData.lives_in_usa ?? null,
    age: args.collectedData.age ?? null,
    state_us: args.collectedData.state_us ?? null,
    suffered_abuse: args.collectedData.suffered_abuse ?? null,
    eligibility_verdict: args.verdict ?? null,
    verdict_reasoning: args.verdictReasoning ?? null,
    state_age_limit: args.stateAgeLimit ?? null,
    raw_answers: args.collectedData as Record<string, unknown>,
    ai_model: args.aiModel ?? null,
  }
  await supabase
    .from('sijs_intakes')
    .upsert(row, { onConflict: 'conversation_id' })
}

export async function markContactOptedOut(contactId: string): Promise<void> {
  const supabase = createServiceClient()
  await supabase
    .from('whatsapp_contacts')
    .update({ opted_out: true, opted_out_at: new Date().toISOString() })
    .eq('id', contactId)
}

/**
 * Writes a Twilio webhook event to the idempotency ledger.
 * Returns `true` if the insert succeeded (first time we see this MessageSid)
 * and `false` if it was a duplicate (we should skip re-processing).
 */
export async function recordTwilioEvent(args: {
  messageSid: string
  eventType: string
  rawPayload: unknown
}): Promise<boolean> {
  const supabase = createServiceClient()
  const { error } = await supabase.from('twilio_webhook_events').insert({
    message_sid: args.messageSid,
    event_type: args.eventType,
    raw_payload: args.rawPayload as Record<string, unknown>,
  })
  if (!error) return true
  if (error.code === '23505') return false // duplicate: already processed
  log.error('recordTwilioEvent failed', error)
  throw error
}

export async function markTwilioEventProcessed(messageSid: string, error?: string): Promise<void> {
  const supabase = createServiceClient()
  await supabase
    .from('twilio_webhook_events')
    .update({
      processed: true,
      processed_at: new Date().toISOString(),
      error: error ?? null,
    })
    .eq('message_sid', messageSid)
}

/** A message in Gemini's chat history format (role + text parts). */
export interface GeminiHistoryMessage {
  role: 'user' | 'model'
  parts: Array<{ text: string }>
}

/**
 * Loads the last N messages of a conversation and maps them to Gemini's
 * chat history format. The worker passes this into `chats.create({ history })`
 * so the model has full context on every async turn.
 *
 * - user → 'user'
 * - bot  → 'model'
 * - admin/system messages are skipped (they aren't part of the user↔AI
 *   conversation, and mixing them confuses the model about who said what).
 */
export async function loadChatHistory(
  conversationId: string,
  limit = 20,
): Promise<GeminiHistoryMessage[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('role, body, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error || !data) {
    log.warn('loadChatHistory failed', error)
    return []
  }
  const out: GeminiHistoryMessage[] = []
  // data is desc — reverse to asc for chronological order
  for (const row of data.reverse()) {
    if (!row.body) continue
    if (row.role === 'user') {
      out.push({ role: 'user', parts: [{ text: row.body as string }] })
    } else if (row.role === 'bot') {
      out.push({ role: 'model', parts: [{ text: row.body as string }] })
    }
    // admin/system are intentionally ignored
  }
  return out
}
