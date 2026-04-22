import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { formatToMT, formatDateMT } from '@/lib/appointments/slots'
import { checkVoiceRateLimit } from '@/lib/voice-agent/rate-limit'
import { createLogger } from '@/lib/logger'

const log = createLogger('voice-agent/book')

/**
 * PUBLIC endpoint consumed by the voice agent to book an appointment for a
 * prospect (no account yet). Stores the booking as a guest_phone + guest_name
 * entry in the appointments table with source='voice-agent'.
 *
 * The endpoint enforces the same slot-uniqueness guarantees as the regular
 * booking endpoint (DB unique index on status='scheduled' scheduled_at).
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rl = await checkVoiceRateLimit(ip, 10, 'book')
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Demasiados intentos de agendamiento, intenta más tarde.', retry_at: rl.resetsAt.toISOString() },
        { status: 429 },
      )
    }

    const { name, phone, scheduled_at, notes, call_id } = await request.json()

    if (!name?.trim() || !phone?.trim() || !scheduled_at) {
      return NextResponse.json(
        { error: 'name, phone and scheduled_at are required' },
        { status: 400 },
      )
    }

    const cleanName = String(name).trim().replace(/\s+/g, ' ').slice(0, 120)
    const cleanPhone = String(phone).trim().slice(0, 30)
    const cleanDate = new Date(scheduled_at)

    if (isNaN(cleanDate.getTime())) {
      return NextResponse.json({ error: 'scheduled_at is not a valid ISO date' }, { status: 400 })
    }
    if (cleanDate.getTime() < Date.now() - 60_000) {
      return NextResponse.json({ error: 'Cannot book in the past' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Guard against double-booking the same slot (the DB unique index is the
    // ultimate authority — this check just gives a friendlier error).
    const { data: slotTaken } = await supabase
      .from('appointments')
      .select('id')
      .eq('scheduled_at', cleanDate.toISOString())
      .eq('status', 'scheduled')
      .maybeSingle()

    if (slotTaken) {
      return NextResponse.json(
        { error: 'Ese horario ya fue tomado. Por favor elige otro.', slot_taken: true },
        { status: 409 },
      )
    }

    // Limit same-phone bookings: max 1 scheduled at a time.
    const { data: existingForPhone } = await supabase
      .from('appointments')
      .select('id, scheduled_at')
      .eq('guest_phone', cleanPhone)
      .eq('status', 'scheduled')
      .limit(1)

    if (existingForPhone && existingForPhone.length > 0) {
      return NextResponse.json(
        {
          error: 'Ya tienes una cita agendada. Una consultora senior te contactará en el horario programado.',
          existing: true,
        },
        { status: 400 },
      )
    }

    // Clasificación automática del tipo de llamada para el dashboard de
    // la consultora senior. "llamada_ahora" = el prospecto quiere ser
    // contactado en las próximas 2 horas (el caso típico cuando dice
    // "llámenme lo antes posible"). "programada" = agendado a futuro.
    const nowMs = Date.now()
    const diffMinutes = (cleanDate.getTime() - nowMs) / 60_000
    const callStatus = diffMinutes <= 120 ? 'llamada_ahora' : 'programada'

    // Asignar al primer senior_consultant activo. Cuando haya más de una
    // consultora haremos round-robin o balance por carga. Por ahora el
    // modelo asume una sola (Vanessa).
    const { data: consultant } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'employee')
      .eq('employee_type', 'senior_consultant')
      .limit(1)
      .maybeSingle()
    const consultantId = consultant?.id || null

    const { data: appointment, error } = await supabase
      .from('appointments')
      .insert({
        scheduled_at: cleanDate.toISOString(),
        guest_name: cleanName,
        guest_phone: cleanPhone,
        source: 'voice-agent',
        notes: notes ? String(notes).slice(0, 500) : null,
        reminder_1h_requested: true,
        reminder_24h_requested: true,
        call_status: callStatus,
        consultant_id: consultantId,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Ese horario ya fue tomado.', slot_taken: true },
          { status: 409 },
        )
      }
      log.error('insert error', error)
      return NextResponse.json({ error: 'Error al agendar la cita' }, { status: 500 })
    }

    // Link the appointment to the voice call record if we have one.
    if (call_id && typeof call_id === 'string') {
      await supabase
        .from('voice_calls')
        .update({ appointment_id: appointment.id })
        .eq('id', call_id)
    }

    return NextResponse.json({
      success: true,
      appointment,
      confirmation: {
        date: formatDateMT(appointment.scheduled_at),
        time: formatToMT(appointment.scheduled_at),
      },
    })
  } catch (err) {
    log.error('unexpected error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
