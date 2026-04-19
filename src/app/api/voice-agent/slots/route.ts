import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getAvailableSlots } from '@/lib/appointments/slots'
import { formatToMT } from '@/lib/appointments/slots'
import { checkVoiceRateLimit } from '@/lib/voice-agent/rate-limit'

/**
 * PUBLIC endpoint consumed by the voice agent (Gemini Live tool call).
 * Returns available appointment slots for a given date in Mountain Time,
 * formatted for the AI to read out loud.
 *
 * No authentication required — the voice agent runs with an ephemeral token,
 * not a user session. Abuse is controlled by rate-limiting the parent token
 * endpoint, not this one.
 */
export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rl = await checkVoiceRateLimit(ip, 60, 'slots')
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Demasiadas consultas, intenta en un momento.', retry_at: rl.resetsAt.toISOString() },
      { status: 429 },
    )
  }

  const date = request.nextUrl.searchParams.get('date')

  if (!date) {
    return NextResponse.json({ error: 'date required (YYYY-MM-DD)' }, { status: 400 })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: blocked } = await supabase
    .from('blocked_dates')
    .select('id')
    .eq('blocked_date', date)
    .maybeSingle()

  if (blocked) {
    return NextResponse.json({ slots: [], blocked: true, human_readable: [] })
  }

  const { data: config } = await supabase.from('scheduling_config').select('*')
  const { data: settings } = await supabase.from('scheduling_settings').select('*').single()

  const dayStart = `${date}T00:00:00Z`
  const dayEnd = `${date}T23:59:59Z`

  const { data: existingAppointments } = await supabase
    .from('appointments')
    .select('id, scheduled_at, duration_minutes, status')
    .eq('status', 'scheduled')
    .gte('scheduled_at', dayStart)
    .lte('scheduled_at', dayEnd)

  const slots = getAvailableSlots(
    date,
    config || [],
    (existingAppointments || []).map(a => a as never),
    settings?.slot_duration_minutes || 60,
  )

  // Present in a way the voice model can speak naturally:
  // { iso: "2026-04-18T15:00:00.000Z", human: "3:00 PM" }
  const human_readable = slots.map(iso => ({
    iso,
    human: formatToMT(iso),
  }))

  return NextResponse.json({ slots, human_readable, date })
}
