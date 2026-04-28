import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getAvailableSlots, getNextAvailableSlot, formatToMT, formatDateMT } from '@/lib/appointments/slots'
import { checkVoiceRateLimit } from '@/lib/voice-agent/rate-limit'

// Edge runtime para latencia baja (30ms vs 200ms Node)
export const runtime = 'edge'

/**
 * Endpoint público usado por la IA de voz (Gemini Live tool call).
 *
 * FUENTE DE HORARIO (prioridad):
 *   1. Si existe al menos una consultora senior con agenda configurada
 *      (employee_type='senior_consultant' con rows en consultant_availability),
 *      la agenda se arma a partir de la UNIÓN de sus disponibilidades.
 *      Los bloqueos puntuales (consultant_blocks) se respetan como citas
 *      ocupadas.
 *   2. Fallback — si no hay consultoras configuradas, cae al calendario
 *      legacy prospect_scheduling_config/settings/blocked_dates. Mantiene
 *      el flow actual operativo mientras Vanessa termina de entrar.
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

  // 1. Intentar leer agenda de consultoras senior
  const { data: consultants } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'employee')
    .eq('employee_type', 'senior_consultant')

  const consultantIds = (consultants || []).map(c => c.id as string)
  let config: Array<{ day_of_week: number; start_hour: number; end_hour: number; is_available: boolean; time_blocks?: Array<{ start_hour: number; end_hour: number }> }> = []
  let slotDuration = 30
  let advanceNoticeHours = 2
  let blockedDates: string[] = []
  let consultantBlocks: Array<{ blocked_at_start: string; blocked_at_end: string }> = []
  let usedSource: 'consultants' | 'legacy' = 'legacy'

  if (consultantIds.length > 0) {
    const { data: availability } = await supabase
      .from('consultant_availability')
      .select('day_of_week, start_hour, end_hour, is_available, time_blocks')
      .in('consultant_id', consultantIds)
      .eq('is_available', true)

    if (availability && availability.length > 0) {
      // Unión de bloques por día. Cada consultora puede tener N bloques
      // (ej. 9-12 + 15-18) — los unimos todos por día y luego, por simplicidad
      // del slot generator, calculamos el envelope total. El generator hará
      // el split fino con time_blocks dentro del config.
      type Block = { start: number; end: number }
      const blocksByDay = new Map<number, Block[]>()

      for (const row of availability) {
        const day = row.day_of_week as number
        const tbRaw = (row as { time_blocks?: Array<{ start_hour: number; end_hour: number }> }).time_blocks
        const blocks: Block[] = (tbRaw && tbRaw.length > 0)
          ? tbRaw.map(b => ({ start: b.start_hour, end: b.end_hour }))
          : [{ start: row.start_hour as number, end: row.end_hour as number }]
        const list = blocksByDay.get(day) ?? []
        list.push(...blocks)
        blocksByDay.set(day, list)
      }

      config = Array.from(blocksByDay.entries()).map(([day_of_week, blocks]) => {
        const sorted = [...blocks].sort((a, b) => a.start - b.start)
        // Merge bloques solapados (la unión entre consultoras puede solaparse)
        const merged: Block[] = []
        for (const b of sorted) {
          const last = merged[merged.length - 1]
          if (last && b.start <= last.end) last.end = Math.max(last.end, b.end)
          else merged.push({ ...b })
        }
        return {
          day_of_week,
          start_hour: merged[0].start,
          end_hour: merged[merged.length - 1].end,
          is_available: true,
          time_blocks: merged.map(b => ({ start_hour: b.start, end_hour: b.end })),
        }
      })

      // Bloqueos puntuales
      const { data: blocksData } = await supabase
        .from('consultant_blocks')
        .select('blocked_at_start, blocked_at_end')
        .in('consultant_id', consultantIds)
        .gte('blocked_at_end', new Date().toISOString())

      consultantBlocks = (blocksData || []) as typeof consultantBlocks
      usedSource = 'consultants'
    }
  }

  // 2. Fallback legacy si no hay agenda de consultoras
  if (usedSource === 'legacy') {
    const [configRes, settingsRes, blockedRes] = await Promise.all([
      supabase.from('prospect_scheduling_config').select('*'),
      supabase.from('prospect_scheduling_settings').select('*').maybeSingle(),
      supabase.from('prospect_blocked_dates').select('blocked_date'),
    ])
    config = (configRes.data || []) as typeof config
    slotDuration = settingsRes.data?.slot_duration_minutes || 30
    advanceNoticeHours = settingsRes.data?.advance_notice_hours ?? 2
    blockedDates = (blockedRes.data || []).map(b => b.blocked_date as string)
  }

  // Rango de búsqueda
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

  // Convertir consultant_blocks en "appointments" ficticios para que
  // getAvailableSlots los trate como slots ocupados.
  const blocksAsAppointments = consultantBlocks.map((b, i) => ({
    id: `block-${i}`,
    scheduled_at: b.blocked_at_start,
    duration_minutes: Math.max(
      30,
      Math.round((new Date(b.blocked_at_end).getTime() - new Date(b.blocked_at_start).getTime()) / 60_000)
    ),
    status: 'scheduled' as const,
  }))

  const allBusy = [...(existingAppointments || []), ...blocksAsAppointments]

  // Case A: fecha específica
  if (date) {
    if (blockedDates.includes(date)) {
      return NextResponse.json({ slots: [], blocked: true, human_readable: [], date, source: usedSource })
    }

    const slots = getAvailableSlots(
      date,
      config as never,
      allBusy as never,
      slotDuration,
    )

    const human_readable = slots.map(iso => ({ iso, human: formatToMT(iso) }))
    return NextResponse.json({ slots, human_readable, date, source: usedSource })
  }

  // Case B: siguiente disponible
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const next = getNextAvailableSlot(
    today,
    config as never,
    allBusy as never,
    slotDuration,
    blockedDates,
    advanceNoticeHours,
    14,
  )

  if (!next) {
    return NextResponse.json({
      suggested: null,
      message: 'No hay horarios disponibles en las próximas 2 semanas.',
      source: usedSource,
    })
  }

  return NextResponse.json({
    suggested: {
      iso: next.iso,
      date: next.date,
      human_date: formatDateMT(next.iso),
      human_time: formatToMT(next.iso),
    },
    source: usedSource,
  })
}
