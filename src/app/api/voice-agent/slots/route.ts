import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getAvailableSlots, getNextAvailableSlot, formatToMT, formatDateMT } from '@/lib/appointments/slots'
import { checkVoiceRateLimit } from '@/lib/voice-agent/rate-limit'

// Edge runtime: the voice agent calls this 2-3 times per conversation, and
// edge execution (~30ms) reduces conversational friction vs Node (~200ms).
// All dependencies (supabase-js, Intl, Date) are edge-compatible.
export const runtime = 'edge'

/**
 * Public endpoint consumed by the voice agent (Gemini Live tool call).
 * Reads the INDEPENDENT prospect calendar (prospect_scheduling_config +
 * prospect_blocked_dates + prospect_scheduling_settings). That way Henry
 * can restrict prospect calls to specific days/hours without affecting
 * his real client appointments.
 *
 * If no `date` is passed the endpoint returns the next available slot
 * looking forward up to 14 days — lets the IA proactively suggest a
 * concrete appointment instead of asking "¿qué día te conviene?".
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
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Load prospect-specific calendar config + settings + blocked dates in parallel.
  const [configRes, settingsRes, blockedRes] = await Promise.all([
    supabase.from('prospect_scheduling_config').select('*'),
    supabase.from('prospect_scheduling_settings').select('*').maybeSingle(),
    supabase.from('prospect_blocked_dates').select('blocked_date'),
  ])

  const config = configRes.data || []
  const slotDuration = settingsRes.data?.slot_duration_minutes || 30
  const advanceNoticeHours = settingsRes.data?.advance_notice_hours ?? 2
  const blockedDates = (blockedRes.data || []).map(b => b.blocked_date as string)

  // Pull prospect appointments currently scheduled (across the next 14 days
  // for the suggestion query, or the specific day if date was given).
  const rangeStart = date ? `${date}T00:00:00Z` : new Date().toISOString()
  const rangeEnd = date
    ? `${date}T23:59:59Z`
    : new Date(Date.now() + 14 * 86400_000).toISOString()

  const { data: existingAppointments } = await supabase
    .from('appointments')
    .select('id, scheduled_at, duration_minutes, status')
    .eq('status', 'scheduled')
    .gte('scheduled_at', rangeStart)
    .lte('scheduled_at', rangeEnd)

  // Case A: specific date requested → list slots for that day.
  if (date) {
    if (blockedDates.includes(date)) {
      return NextResponse.json({ slots: [], blocked: true, human_readable: [], date })
    }

    const slots = getAvailableSlots(
      date,
      config,
      (existingAppointments || []).map(a => a as never),
      slotDuration,
    )

    const human_readable = slots.map(iso => ({ iso, human: formatToMT(iso) }))
    return NextResponse.json({ slots, human_readable, date })
  }

  // Case B: no date → proactively suggest the next available slot.
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const next = getNextAvailableSlot(
    today,
    config,
    (existingAppointments || []).map(a => a as never),
    slotDuration,
    blockedDates,
    advanceNoticeHours,
    14,
  )

  if (!next) {
    return NextResponse.json({
      suggested: null,
      message: 'No hay horarios disponibles en las próximas 2 semanas.',
    })
  }

  return NextResponse.json({
    suggested: {
      iso: next.iso,
      date: next.date,
      human_date: formatDateMT(next.iso),
      human_time: formatToMT(next.iso),
    },
  })
}
