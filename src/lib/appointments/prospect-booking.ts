import { createServiceClient } from '@/lib/supabase/service'
import {
  getAvailableSlots,
  getNextAvailableSlot,
  formatDateMT,
  formatToMT,
} from './slots'
import { createLogger } from '@/lib/logger'

const log = createLogger('prospect-booking')

/**
 * Shared helpers for the *prospect* calendar (web chatbot, voice agent,
 * WhatsApp bot). This calendar is distinct from the regular client
 * calendar so free evaluation appointments don't collide with paid work.
 *
 * Tables:
 *   - prospect_scheduling_config   (per day-of-week availability)
 *   - prospect_scheduling_settings (singleton: slot duration, advance notice)
 *   - prospect_blocked_dates       (specific dates to exclude)
 *   - appointments                 (shared — source differentiates channel)
 */

export async function loadProspectCalendar() {
  const supabase = createServiceClient()
  const [configRes, settingsRes, blockedRes] = await Promise.all([
    supabase.from('prospect_scheduling_config').select('*'),
    supabase.from('prospect_scheduling_settings').select('*').maybeSingle(),
    supabase.from('prospect_blocked_dates').select('blocked_date'),
  ])
  return {
    supabase,
    config: configRes.data ?? [],
    slotDuration: settingsRes.data?.slot_duration_minutes ?? 30,
    advanceNoticeHours: settingsRes.data?.advance_notice_hours ?? 2,
    blockedDates: (blockedRes.data ?? []).map(
      (b: { blocked_date: string }) => b.blocked_date,
    ),
  }
}

export interface ProspectSlot {
  iso: string
  humanDate: string
  humanTime: string
}

/**
 * Get the next N available slots across the next `lookAheadDays` days.
 * Handy for WhatsApp where we present a numbered list to pick from.
 */
export async function listUpcomingProspectSlots(args: {
  maxSlots?: number
  lookAheadDays?: number
} = {}): Promise<ProspectSlot[]> {
  const max = args.maxSlots ?? 6
  const look = args.lookAheadDays ?? 7
  const { supabase, config, slotDuration, blockedDates, advanceNoticeHours } =
    await loadProspectCalendar()

  const rangeEnd = new Date(Date.now() + look * 86400_000).toISOString()
  const { data: existing } = await supabase
    .from('appointments')
    .select('id, scheduled_at, duration_minutes, status')
    .eq('status', 'scheduled')
    .gte('scheduled_at', new Date().toISOString())
    .lte('scheduled_at', rangeEnd)

  const minStart = new Date(Date.now() + advanceNoticeHours * 3600_000)
  const out: ProspectSlot[] = []
  for (let offset = 0; offset < look && out.length < max; offset++) {
    const day = new Date()
    day.setUTCDate(day.getUTCDate() + offset)
    const dateStr = day.toISOString().slice(0, 10)
    if (blockedDates.includes(dateStr)) continue
    const slots = getAvailableSlots(
      dateStr,
      config,
      (existing ?? []) as never[],
      slotDuration,
    )
    for (const iso of slots) {
      if (new Date(iso).getTime() < minStart.getTime()) continue
      out.push({ iso, humanDate: formatDateMT(iso), humanTime: formatToMT(iso) })
      if (out.length >= max) break
    }
  }
  return out
}

export async function getNextProspectSlot(): Promise<ProspectSlot | null> {
  const { supabase, config, slotDuration, blockedDates, advanceNoticeHours } =
    await loadProspectCalendar()
  const rangeEnd = new Date(Date.now() + 14 * 86400_000).toISOString()
  const { data: existing } = await supabase
    .from('appointments')
    .select('id, scheduled_at, duration_minutes, status')
    .eq('status', 'scheduled')
    .gte('scheduled_at', new Date().toISOString())
    .lte('scheduled_at', rangeEnd)

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const next = getNextAvailableSlot(
    today,
    config,
    (existing ?? []) as never[],
    slotDuration,
    blockedDates,
    advanceNoticeHours,
    14,
  )
  if (!next) return null
  return { iso: next.iso, humanDate: formatDateMT(next.iso), humanTime: formatToMT(next.iso) }
}

export interface BookProspectArgs {
  scheduledAtIso: string
  guestName: string
  guestPhone: string
  source: string          // 'whatsapp-chatbot' | 'chatbot' | 'voice-agent'
  notes?: string
}

export type BookProspectResult =
  | { ok: true; appointmentId: string; humanDate: string; humanTime: string }
  | { ok: false; error: 'slot_taken' | 'invalid' | 'duplicate_phone' | 'server'; message: string }

/**
 * Insert a prospect appointment. The caller must already have validated the
 * slot belongs to `listUpcomingProspectSlots()` / `getNextProspectSlot()`.
 *
 * A DB-level unique index on (scheduled_at) WHERE status='scheduled' is the
 * ultimate guard against double-booking; we pre-check as a UX optimization.
 */
export async function bookProspectAppointment(
  args: BookProspectArgs,
): Promise<BookProspectResult> {
  const supabase = createServiceClient()
  const scheduledAt = new Date(args.scheduledAtIso)
  if (isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now() - 60_000) {
    return { ok: false, error: 'invalid', message: 'Fecha inválida o en el pasado.' }
  }

  const cleanPhone = args.guestPhone.trim().slice(0, 30)
  const cleanName = args.guestName.trim().replace(/\s+/g, ' ').slice(0, 120)

  // Friendly pre-check: same slot already taken?
  const { data: slotTaken } = await supabase
    .from('appointments')
    .select('id')
    .eq('scheduled_at', scheduledAt.toISOString())
    .eq('status', 'scheduled')
    .maybeSingle()
  if (slotTaken) {
    return { ok: false, error: 'slot_taken', message: 'Ese horario ya fue tomado.' }
  }

  // Same phone already has an open appointment?
  const { data: existingForPhone } = await supabase
    .from('appointments')
    .select('id')
    .eq('guest_phone', cleanPhone)
    .eq('status', 'scheduled')
    .limit(1)
  if (existingForPhone && existingForPhone.length > 0) {
    return {
      ok: false,
      error: 'duplicate_phone',
      message: 'Ya tienes una cita agendada con nosotros.',
    }
  }

  const { data: appointment, error } = await supabase
    .from('appointments')
    .insert({
      scheduled_at: scheduledAt.toISOString(),
      guest_name: cleanName,
      guest_phone: cleanPhone,
      source: args.source,
      notes: args.notes ? args.notes.slice(0, 500) : null,
      reminder_1h_requested: true,
      reminder_24h_requested: true,
    })
    .select('id, scheduled_at')
    .single()

  if (error || !appointment) {
    if (error?.code === '23505') {
      return { ok: false, error: 'slot_taken', message: 'Ese horario ya fue tomado.' }
    }
    log.error('insert appointment failed', error)
    return { ok: false, error: 'server', message: 'Error del servidor al agendar.' }
  }
  return {
    ok: true,
    appointmentId: appointment.id as string,
    humanDate: formatDateMT(appointment.scheduled_at as string),
    humanTime: formatToMT(appointment.scheduled_at as string),
  }
}
