import { NextRequest, NextResponse } from 'next/server'
import { verifyTwilioSignature } from '@/lib/twilio/verify'
import { enqueueJob } from '@/lib/qstash/client'
import { recordTwilioEvent } from '@/lib/chatbot/sijs-session'
import { createLogger } from '@/lib/logger'

const log = createLogger('twilio-whatsapp-webhook')

/**
 * Twilio WhatsApp inbound webhook.
 *
 * Responsibilities (all synchronous, < ~1s total):
 *   1. Verify the HMAC-SHA1 signature — otherwise anyone can spoof.
 *   2. Write the raw event to `twilio_webhook_events` for idempotency + audit.
 *      If the MessageSid is a duplicate, drop with 200 silently.
 *   3. Enqueue the heavy processing (Gemini call, Twilio send) to QStash.
 *   4. Return an empty TwiML `<Response/>` so Twilio doesn't auto-reply.
 *
 * Twilio times out around 15s; we hand off to the worker quickly.
 */

function emptyTwiml() {
  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response/>', {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  })
}

export async function POST(request: NextRequest) {
  const form = await request.formData()
  const params: Record<string, string> = {}
  for (const [k, v] of form.entries()) {
    if (typeof v === 'string') params[k] = v
  }

  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!authToken) {
    log.error('TWILIO_AUTH_TOKEN not set')
    return emptyTwiml()
  }

  // Twilio signs the URL they POSTed to. Behind a reverse proxy the original
  // URL is in `x-forwarded-*` headers — rebuild it carefully.
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const url = `${proto}://${host}${request.nextUrl.pathname}${request.nextUrl.search}`

  const signature = request.headers.get('x-twilio-signature')
  const ok = verifyTwilioSignature({ authToken, signatureHeader: signature, url, params })
  if (!ok) {
    log.warn('invalid twilio signature', { url })
    return new NextResponse('Forbidden', { status: 403 })
  }

  const messageSid = params['MessageSid'] ?? params['SmsMessageSid']
  if (!messageSid) {
    log.warn('no MessageSid in payload')
    return emptyTwiml()
  }

  // Idempotency: only process each MessageSid once.
  let isNew: boolean
  try {
    isNew = await recordTwilioEvent({
      messageSid,
      eventType: 'inbound_message',
      rawPayload: params,
    })
  } catch (err) {
    log.error('recordTwilioEvent error', err)
    // If we cannot record, safer to respond 200 and rely on Twilio retry than
    // to 5xx and cause a retry storm. The next attempt will be idempotent.
    return emptyTwiml()
  }

  if (!isNew) {
    log.info('duplicate MessageSid, skipping enqueue', { messageSid })
    return emptyTwiml()
  }

  // Enqueue for async processing. The worker URL is fully qualified because
  // QStash calls it from its own infrastructure.
  const workerUrl = buildWorkerUrl(proto, host)
  if (!workerUrl) {
    log.error('Cannot derive worker URL')
    return emptyTwiml()
  }

  try {
    await enqueueJob({
      endpoint: workerUrl,
      body: { messageSid, params },
      deduplicationId: messageSid,
    })
  } catch (err) {
    log.error('enqueueJob failed', err)
    // Don't 5xx — Twilio will retry and hit the idempotency ledger; we just
    // need to fix the queue. We could fall back to sync processing here, but
    // that risks timing out Twilio.
  }

  return emptyTwiml()
}

function buildWorkerUrl(proto: string, host: string | null): string | null {
  if (process.env.WHATSAPP_WORKER_URL) return process.env.WHATSAPP_WORKER_URL
  if (!host) return null
  return `${proto}://${host}/api/workers/whatsapp-process`
}
