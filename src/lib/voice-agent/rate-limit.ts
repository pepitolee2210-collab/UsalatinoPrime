import { createServiceClient } from '@/lib/supabase/service'

const MAX_CALLS_PER_WINDOW = 5
const WINDOW_MS = 60 * 60 * 1000 // 1 hour

/**
 * Persistent per-IP rate limit for the voice agent token endpoint.
 * Uses a Supabase table so the limit works across serverless instances
 * (the previous in-memory Map was reset on every cold start).
 *
 * Returns { allowed: boolean, remaining: number, resetsAt: Date }.
 */
export async function checkVoiceRateLimit(ip: string): Promise<{
  allowed: boolean
  remaining: number
  resetsAt: Date
}> {
  const supabase = createServiceClient()
  const now = new Date()

  // Opportunistic cleanup: remove expired windows (best-effort).
  await supabase
    .from('voice_call_rate_limits')
    .delete()
    .lt('window_resets_at', now.toISOString())

  const { data: current } = await supabase
    .from('voice_call_rate_limits')
    .select('id, count, window_started_at, window_resets_at')
    .eq('ip_address', ip)
    .gte('window_resets_at', now.toISOString())
    .order('window_started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!current) {
    const resetsAt = new Date(now.getTime() + WINDOW_MS)
    await supabase.from('voice_call_rate_limits').insert({
      ip_address: ip,
      count: 1,
      window_started_at: now.toISOString(),
      window_resets_at: resetsAt.toISOString(),
    })
    return { allowed: true, remaining: MAX_CALLS_PER_WINDOW - 1, resetsAt }
  }

  if (current.count >= MAX_CALLS_PER_WINDOW) {
    return {
      allowed: false,
      remaining: 0,
      resetsAt: new Date(current.window_resets_at),
    }
  }

  const nextCount = current.count + 1
  await supabase
    .from('voice_call_rate_limits')
    .update({ count: nextCount, updated_at: now.toISOString() })
    .eq('id', current.id)

  return {
    allowed: true,
    remaining: MAX_CALLS_PER_WINDOW - nextCount,
    resetsAt: new Date(current.window_resets_at),
  }
}
