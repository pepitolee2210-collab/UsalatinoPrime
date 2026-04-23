import { Client, Receiver } from '@upstash/qstash'
import { createLogger } from '@/lib/logger'

const log = createLogger('qstash')

let clientCached: Client | null = null
let receiverCached: Receiver | null = null

function getClient(): Client {
  if (clientCached) return clientCached
  const token = process.env.QSTASH_TOKEN
  if (!token) throw new Error('QSTASH_TOKEN is not set')
  clientCached = new Client({ token })
  return clientCached
}

function getReceiver(): Receiver {
  if (receiverCached) return receiverCached
  const current = process.env.QSTASH_CURRENT_SIGNING_KEY
  const next = process.env.QSTASH_NEXT_SIGNING_KEY
  if (!current || !next) {
    throw new Error('QSTASH_CURRENT_SIGNING_KEY / QSTASH_NEXT_SIGNING_KEY are not set')
  }
  receiverCached = new Receiver({ currentSigningKey: current, nextSigningKey: next })
  return receiverCached
}

/**
 * Enqueues a job for async processing. Returns immediately so the Twilio
 * webhook can respond within its ~15s timeout while the real work (Gemini
 * call + Twilio reply) runs in the background.
 */
export async function enqueueJob(args: {
  endpoint: string           // full https URL of the worker
  body: unknown
  deduplicationId?: string   // Twilio MessageSid — prevents double-processing
}): Promise<{ messageId: string }> {
  const client = getClient()
  try {
    const res = await client.publishJSON({
      url: args.endpoint,
      body: args.body as Record<string, unknown>,
      retries: 3,
      deduplicationId: args.deduplicationId,
    })
    return { messageId: res.messageId }
  } catch (err) {
    log.error('enqueueJob failed', { endpoint: args.endpoint, err })
    throw err
  }
}

/**
 * Verifies the `Upstash-Signature` header on a worker invocation. The worker
 * endpoint is public, so without this check anyone could trigger Gemini
 * calls + Twilio sends at our expense.
 */
export async function verifyQStashSignature(args: {
  signature: string | null
  body: string
  url: string
}): Promise<boolean> {
  if (!args.signature) return false
  try {
    return await getReceiver().verify({
      signature: args.signature,
      body: args.body,
      url: args.url,
    })
  } catch {
    return false
  }
}
