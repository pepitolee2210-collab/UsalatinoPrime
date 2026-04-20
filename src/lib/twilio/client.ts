import twilio from 'twilio'
import { createLogger } from '@/lib/logger'

const log = createLogger('twilio')

let cached: ReturnType<typeof twilio> | null = null

function getClient() {
  if (cached) return cached
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) {
    throw new Error('TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN are not set')
  }
  cached = twilio(sid, token)
  return cached
}

export function twilioWhatsappFrom(): string {
  const from = process.env.TWILIO_WA_FROM
  if (!from) throw new Error('TWILIO_WA_FROM is not set (expected "whatsapp:+14155238886")')
  return from.startsWith('whatsapp:') ? from : `whatsapp:${from}`
}

export function toWhatsappAddress(phoneE164: string): string {
  if (phoneE164.startsWith('whatsapp:')) return phoneE164
  return `whatsapp:${phoneE164}`
}

export interface SendWhatsappArgs {
  to: string               // "+15551234567" or "whatsapp:+15551234567"
  body: string
  mediaUrls?: string[]     // up to 5 publicly reachable URLs
}

export interface SendWhatsappResult {
  sid: string
  status: string
}

/**
 * Sends a WhatsApp message via the Twilio REST API.
 *
 * Twilio WhatsApp session rules: free-form text can only be sent inside the
 * 24-hour rolling window after the user's last message. Outside of that we
 * must use a pre-approved template — not handled here.
 */
export async function sendWhatsapp(args: SendWhatsappArgs): Promise<SendWhatsappResult> {
  const client = getClient()
  const to = toWhatsappAddress(args.to)

  try {
    const message = await client.messages.create({
      from: twilioWhatsappFrom(),
      to,
      body: args.body,
      ...(args.mediaUrls && args.mediaUrls.length > 0 ? { mediaUrl: args.mediaUrls } : {}),
    })
    return { sid: message.sid, status: message.status }
  } catch (err) {
    log.error('sendWhatsapp failed', { to, err })
    throw err
  }
}
