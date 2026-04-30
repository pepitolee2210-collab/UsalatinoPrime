import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getAvailableSlots } from '@/lib/appointments/slots'

/**
 * GET /api/appointments/available?token=...&date=YYYY-MM-DD
 *
 * Devuelve los slots disponibles para que un cliente agende una cita con
 * Vanessa (la asesora). Usa la tabla `consultant_availability` (donde ella
 * configura sus horarios desde /employee/agenda) y respeta sus bloqueos
 * puntuales (`consultant_blocks`). Filtra appointments YA agendadas con
 * la misma asesora para evitar doble booking. Aplica un mínimo de 24h
 * de antelación.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const date = request.nextUrl.searchParams.get('date')

  if (!token || !date) {
    return NextResponse.json({ error: 'Token y fecha requeridos' }, { status: 400 })
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Formato de fecha inválido. Use YYYY-MM-DD' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Validar token del cliente
  const { data: tokenData } = await supabase
    .from('appointment_tokens')
    .select('client_id, case_id, is_active')
    .eq('token', token)
    .single()

  if (!tokenData || !tokenData.is_active) {
    return NextResponse.json({ error: 'Token inválido o inactivo' }, { status: 403 })
  }

  // Resolver la asesora activa. Hoy solo Vanessa configura sus horarios en
  // consultant_availability; tomamos el primer consultant_id que tenga al
  // menos una fila. Si más adelante hay varias asesoras, la asignación se
  // hará por caso/cliente.
  const { data: anyAvailability } = await supabase
    .from('consultant_availability')
    .select('consultant_id')
    .limit(1)
    .maybeSingle()

  const consultantId = anyAvailability?.consultant_id ?? null

  if (!consultantId) {
    // Sin asesora configurada → cero slots
    return NextResponse.json({ slots: [], reason: 'no_consultant_configured' })
  }

  // ¿Día completamente bloqueado por blocked_dates global (Henry/admin)?
  const { data: blocked } = await supabase
    .from('blocked_dates')
    .select('id')
    .eq('blocked_date', date)
    .maybeSingle()

  if (blocked) {
    return NextResponse.json({ slots: [], blocked: true })
  }

  // Horarios recurrentes de Vanessa
  const { data: availability } = await supabase
    .from('consultant_availability')
    .select('day_of_week, start_hour, end_hour, is_available, time_blocks')
    .eq('consultant_id', consultantId)

  // Bloqueos puntuales de Vanessa que toquen este día
  const dayStart = `${date}T00:00:00Z`
  const dayEnd = `${date}T23:59:59Z`

  const { data: punctualBlocks } = await supabase
    .from('consultant_blocks')
    .select('blocked_at_start, blocked_at_end')
    .eq('consultant_id', consultantId)
    .lte('blocked_at_start', dayEnd)
    .gte('blocked_at_end', dayStart)

  // Citas YA agendadas con Vanessa para esa fecha
  const { data: existingAppointments } = await supabase
    .from('appointments')
    .select('id, scheduled_at, duration_minutes, status')
    .eq('consultant_id', consultantId)
    .eq('status', 'scheduled')
    .gte('scheduled_at', dayStart)
    .lte('scheduled_at', dayEnd)

  // Settings (duración de slot, etc.)
  const { data: settings } = await supabase
    .from('scheduling_settings')
    .select('slot_duration_minutes')
    .single()

  const slots = getAvailableSlots(
    date,
    (availability || []) as never[],
    (existingAppointments || []) as never[],
    settings?.slot_duration_minutes || 60,
    (punctualBlocks || []) as never[],
    24, // mínimo 24h de antelación — no se puede agendar mismo día
  )

  return NextResponse.json({ slots })
}
