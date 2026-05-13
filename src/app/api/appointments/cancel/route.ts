import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { MIN_CANCEL_HOURS } from '@/lib/appointments/constants'
import { logActivity, SUBCATEGORIES } from '@/lib/activity/log-activity'

export async function POST(request: NextRequest) {
  const { token, appointment_id, reason } = await request.json()

  if (!token || !appointment_id) {
    return NextResponse.json({ error: 'Token y ID de cita requeridos' }, { status: 400 })
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

  // Obtener la cita
  const { data: appointment } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', appointment_id)
    .eq('client_id', tokenData.client_id)
    .eq('status', 'scheduled')
    .single()

  if (!appointment) {
    return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 })
  }

  const now = new Date()
  const scheduledTime = new Date(appointment.scheduled_at)
  const hoursUntilAppointment = (scheduledTime.getTime() - now.getTime()) / (1000 * 60 * 60)

  const isLateCancellation = hoursUntilAppointment < MIN_CANCEL_HOURS

  // Cancelar la cita
  const { error } = await supabase
    .from('appointments')
    .update({
      status: 'cancelled',
      cancelled_at: now.toISOString(),
      cancellation_reason: reason || (isLateCancellation ? 'Cancelación tardía' : 'Cancelado por cliente'),
      updated_at: now.toISOString(),
    })
    .eq('id', appointment_id)

  if (error) {
    return NextResponse.json({ error: 'Error al cancelar la cita' }, { status: 500 })
  }

  if (tokenData.case_id) {
    await logActivity({
      caseId: tokenData.case_id,
      category: 'appointment',
      subcategory: SUBCATEGORIES.APPT_CANCELLED,
      description: isLateCancellation
        ? 'El cliente canceló su cita (cancelación tardía)'
        : 'El cliente canceló su cita',
      metadata: {
        appointment_id,
        cancelled_at: now.toISOString(),
        reason: reason || null,
        is_late_cancellation: isLateCancellation,
      },
      visibleToClient: true,
      actor: { kind: 'token', tokenType: 'cita', clientId: tokenData.client_id },
      client: supabase,
    })
  }

  return NextResponse.json({
    success: true,
    isLateCancellation,
    message: isLateCancellation
      ? `Cita cancelada. Debido a que canceló con menos de ${MIN_CANCEL_HOURS} horas de anticipación, no podrá agendar una nueva cita por 7 días.`
      : 'Cita cancelada exitosamente.',
  })
}
