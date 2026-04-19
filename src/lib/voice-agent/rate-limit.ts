import { createServiceClient } from '@/lib/supabase/service'

const WINDOW_MS = 60 * 60 * 1000 // 1 hour

/**
 * Persistent per-IP rate limit (works across serverless instances).
 * Uses a Postgres RPC that performs the check + increment atomically to
 * avoid race conditions when two requests arrive simultaneously.
 *
 * scope differentiates endpoints so one noisy endpoint doesn't exhaust
 * the budget for others (e.g. 'token', 'slots', 'book').
 */
export async function checkVoiceRateLimit(
  ip: string,
  maxPerWindow: number = 5,
  scope: string = 'token',
): Promise<{ allowed: boolean; remaining: number; resetsAt: Date }> {
  const supabase = createServiceClient()
  const now = new Date()
  const windowStart = new Date(Math.floor(now.getTime() / WINDOW_MS) * WINDOW_MS)
  const windowEnd = new Date(windowStart.getTime() + WINDOW_MS)

  const { data, error } = await supabase.rpc('voice_rate_limit_hit_scoped', {
    p_ip: ip,
    p_scope: scope,
    p_window_start: windowStart.toISOString(),
    p_window_end: windowEnd.toISOString(),
  })

  // If the RPC is missing or errors, fail open (allow the request) so a
  // misconfiguration never takes down the voice agent. We log so ops notice.
  if (error || data == null) {
    return { allowed: true, remaining: maxPerWindow, resetsAt: windowEnd }
  }

  const count = typeof data === 'number' ? data : (data as { count?: number })?.count ?? 1
  if (count > maxPerWindow) {
    return { allowed: false, remaining: 0, resetsAt: windowEnd }
  }
  return {
    allowed: true,
    remaining: Math.max(0, maxPerWindow - count),
    resetsAt: windowEnd,
  }
}
