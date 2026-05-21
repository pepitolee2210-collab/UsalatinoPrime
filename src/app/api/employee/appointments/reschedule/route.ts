// POST /api/employee/appointments/reschedule
//
// Permite a Vanessa (senior_consultant) y Andrium (contracts_manager)
// reprogramar una cita existente. Admin también puede usarlo, pero ya
// tiene /api/admin/appointments/reschedule disponible.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logActivity, SUBCATEGORIES } from '@/lib/activity/log-activity'
import { validateReschedule } from '@/lib/appointments/book-service'
import { formatToMT } from '@/lib/appointments/slots'

const ALLOWED_EMPLOYEE_TYPES = new Set(['senior_consultant', 'contracts_manager'])

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role, employee_type')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'
  const isAllowedEmployee =
    profile?.role === 'employee' &&
    profile.employee_type !== null &&
    ALLOWED_EMPLOYEE_TYPES.has(profile.employee_type as string)

  if (!isAdmin && !isAllowedEmployee) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  type Body = { appointment_id?: string; scheduled_at?: string }
  let payload: Body
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { appointment_id, scheduled_at } = payload
  if (!appointment_id || !scheduled_at) {
    return NextResponse.json(
      { error: 'appointment_id y scheduled_at requeridos' },
      { status: 400 },
    )
  }

  const validation = await validateReschedule({
    client: service,
    appointmentId: appointment_id,
    scheduledAt: scheduled_at,
  })
  if (!validation.ok) {
    const status = validation.error.code === 'slot_taken' ? 409 : 400
    return NextResponse.json({ error: validation.error.message }, { status })
  }

  const { error } = await service
    .from('appointments')
    .update({ scheduled_at, updated_at: new Date().toISOString() })
    .eq('id', appointment_id)

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Este horario ya fue tomado.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Error al reprogramar' }, { status: 500 })
  }

  if (validation.current.case_id) {
    await logActivity({
      caseId: validation.current.case_id,
      category: 'appointment',
      subcategory: SUBCATEGORIES.APPT_RESCHEDULED,
      description: `Cita reagendada de ${formatToMT(validation.current.scheduled_at)} MT a ${formatToMT(scheduled_at)} MT`,
      metadata: {
        appointment_id,
        old_at: validation.current.scheduled_at,
        new_at: scheduled_at,
      },
      visibleToClient: true,
      actor: { kind: 'session', supabase },
      client: service,
    })
  }

  return NextResponse.json({ success: true })
}
