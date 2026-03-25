import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkPenalty } from '@/lib/appointments/penalty'
import type { Appointment } from '@/types/database'

export async function POST(request: NextRequest) {
  const { token, scheduled_at, reminder_1h, reminder_24h } = await request.json()

  if (!token || !scheduled_at) {
    return NextResponse.json({ error: 'Token y horario requeridos' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Validar token
  const { data: tokenData } = await supabase
    .from('appointment_tokens')
    .select('client_id, case_id, is_active')
    .eq('token', token)
    .single()

  if (!tokenData || !tokenData.is_active) {
    return NextResponse.json({ error: 'Token inválido o inactivo' }, { status: 403 })
  }

  // Verificar penalty
  const { data: clientAppointments } = await supabase
    .from('appointments')
    .select('*')
    .eq('client_id', tokenData.client_id)
    .in('status', ['no_show', 'cancelled'])
    .order('scheduled_at', { ascending: false })
    .limit(1)

  const penalty = checkPenalty((clientAppointments || []) as Appointment[])
  if (penalty.isPenalized) {
    return NextResponse.json({
      error: 'Cuenta penalizada',
      reason: penalty.reason,
      canScheduleAfter: penalty.canScheduleAfter?.toISOString(),
    }, { status: 403 })
  }

  // Verificar que no tenga ya una cita scheduled
  const { data: existingAppt } = await supabase
    .from('appointments')
    .select('id')
    .eq('client_id', tokenData.client_id)
    .eq('status', 'scheduled')
    .limit(1)

  if (existingAppt && existingAppt.length > 0) {
    return NextResponse.json({ error: 'Ya tiene una cita agendada. Cancélela primero.' }, { status: 400 })
  }

  // Verificar que no haya tenido cita esta semana (lun-dom)
  const now = new Date(scheduled_at)
  const dayOfWeek = now.getDay() // 0=dom, 1=lun
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() + mondayOffset)
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)

  const { data: weekAppts } = await supabase
    .from('appointments')
    .select('id')
    .eq('client_id', tokenData.client_id)
    .in('status', ['scheduled', 'completed'])
    .gte('scheduled_at', weekStart.toISOString())
    .lt('scheduled_at', weekEnd.toISOString())
    .limit(1)

  if (weekAppts && weekAppts.length > 0) {
    return NextResponse.json({
      error: 'Solo puede agendar 1 cita por semana. Espere a la siguiente semana para programar una nueva cita.',
    }, { status: 400 })
  }

  // Verificar que el slot no esté tomado (el unique index en DB también lo previene)
  const { data: slotTaken } = await supabase
    .from('appointments')
    .select('id')
    .eq('scheduled_at', scheduled_at)
    .eq('status', 'scheduled')
    .limit(1)

  if (slotTaken && slotTaken.length > 0) {
    return NextResponse.json({ error: 'Este horario ya fue tomado. Seleccione otro.' }, { status: 409 })
  }

  // Crear la cita
  const { data: appointment, error } = await supabase
    .from('appointments')
    .insert({
      case_id: tokenData.case_id,
      client_id: tokenData.client_id,
      scheduled_at,
      reminder_1h_requested: reminder_1h || false,
      reminder_24h_requested: reminder_24h || false,
    })
    .select()
    .single()

  if (error) {
    // El unique index captura doble booking a nivel DB
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Este horario ya fue tomado.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Error al agendar la cita' }, { status: 500 })
  }

  return NextResponse.json({ appointment })
}
