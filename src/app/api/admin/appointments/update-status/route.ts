import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logActivity, SUBCATEGORIES } from '@/lib/activity/log-activity'
import type { AppointmentStatus } from '@/types/database'

const VALID_STATUSES: AppointmentStatus[] = ['completed', 'no_show', 'cancelled']

const STATUS_SUBCATEGORY: Record<string, string> = {
  completed: SUBCATEGORIES.APPT_COMPLETED,
  no_show: SUBCATEGORIES.APPT_NO_SHOW,
  cancelled: SUBCATEGORIES.APPT_CANCELLED,
}

const STATUS_DESCRIPTION: Record<string, string> = {
  completed: 'Cita marcada como completada',
  no_show: 'Cliente no se presentó a la cita',
  cancelled: 'Cita cancelada por staff',
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { appointment_id, status } = await request.json()

  if (!appointment_id || !status) {
    return NextResponse.json({ error: 'appointment_id y status requeridos' }, { status: 400 })
  }

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
  }

  // Leer case_id para la bitácora.
  const { data: appointment } = await supabase
    .from('appointments')
    .select('case_id, scheduled_at')
    .eq('id', appointment_id)
    .single()

  const { error } = await supabase
    .from('appointments')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointment_id)

  if (error) {
    return NextResponse.json({ error: 'Error al actualizar estado' }, { status: 500 })
  }

  if (appointment?.case_id) {
    await logActivity({
      caseId: appointment.case_id,
      category: 'appointment',
      subcategory: STATUS_SUBCATEGORY[status] ?? SUBCATEGORIES.APPT_COMPLETED,
      description: STATUS_DESCRIPTION[status] ?? `Estado de cita: ${status}`,
      metadata: { appointment_id, status, scheduled_at: appointment.scheduled_at },
      visibleToClient: status !== 'no_show',
      actor: { kind: 'session', supabase },
    })
  }

  return NextResponse.json({ success: true })
}
