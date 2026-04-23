import crypto from 'node:crypto'

/**
 * Verifies the `X-Twilio-Signature` header on an incoming webhook.
 *
 * Twilio signs the full URL the webhook was configured with (including
 * protocol and query string) concatenated with an alphabetically sorted
 * key=value pair of every POST parameter, HMAC-SHA1'd with the account's
 * auth token, and base64-encoded.
 *
 * Docs: https://www.twilio.com/docs/usage/webhooks/webhooks-security
 *
 * We compare with `timingSafeEqual` to avoid leaking information via timing.
 */
export function verifyTwilioSignature(args: {
  authToken: string
  signatureHeader: string | null
  url: string
  params: Record<string, string>
}): boolean {
  if (!args.signatureHeader) return false

  const sortedKeys = Object.keys(args.params).sort()
  const concatenated = sortedKeys.reduce(
    (acc, key) => acc + key + args.params[key],
    args.url,
  )

  const expected = crypto
    .createHmac('sha1', args.authToken)
    .update(Buffer.from(concatenated, 'utf-8'))
    .digest('base64')

  try {
    const a = Buffer.from(expected)
    const b = Buffer.from(args.signatureHeader)
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}
