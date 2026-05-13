// POST /api/employee/appointments/update-status
//
// Permite a Vanessa (senior_consultant) y Diana (paralegal) marcar una cita
// como completed (con objective_completed), cancelled o no_show. Antes solo
// admin podía hacerlo via /api/admin/appointments/update-status.
//
// Si status='completed' && objective_completed=true: chequea si existe una
// cita futura del mismo case con el mismo session_number → incrementa
// (mantiene coherencia del counter).
//
// Opcionalmente acepta `session_note_body` para crear una case_notes row
// linkeada a la cita.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logActivity, SUBCATEGORIES } from '@/lib/activity/log-activity'
import type { AppointmentStatus } from '@/types/database'

const VALID_STATUSES: AppointmentStatus[] = ['completed', 'cancelled', 'no_show']
const ALLOWED_EMPLOYEE_TYPES = new Set(['senior_consultant', 'paralegal'])

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role, employee_type, first_name, last_name')
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

  type Body = {
    appointment_id?: string
    status?: string
    objective_completed?: boolean
    session_note_body?: string
    cancellation_reason?: string
  }
  let payload: Body
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { appointment_id, status } = payload
  if (!appointment_id || !status) {
    return NextResponse.json({ error: 'appointment_id y status requeridos' }, { status: 400 })
  }
  if (!VALID_STATUSES.includes(status as AppointmentStatus)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
  }

  // Cargar appointment
  const { data: appointment } = await service
    .from('appointments')
    .select('id, case_id, scheduled_at, session_number, status, client_id')
    .eq('id', appointment_id)
    .single()
  if (!appointment) {
    return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 })
  }
  if (appointment.status !== 'scheduled') {
    return NextResponse.json(
      { error: `La cita ya está en estado ${appointment.status}` },
      { status: 409 },
    )
  }

  const now = new Date().toISOString()
  const update: Record<string, unknown> = {
    status,
    updated_at: now,
  }

  if (status === 'completed') {
    if (typeof payload.objective_completed !== 'boolean') {
      return NextResponse.json(
        { error: 'objective_completed (boolean) requerido al completar' },
        { status: 400 },
      )
    }
    update.objective_completed = payload.objective_completed
  } else if (status === 'cancelled') {
    update.cancelled_at = now
    update.cancellation_reason = payload.cancellation_reason || 'Cancelada por staff'
  } else {
    // no_show
    update.objective_completed = false
  }

  const { error: upErr } = await service
    .from('appointments')
    .update(update)
    .eq('id', appointment_id)
  if (upErr) {
    return NextResponse.json({ error: 'Error al actualizar', details: upErr.message }, { status: 500 })
  }

  // Si objective_completed=true, ajustar la sesión de la cita futura para
  // mantener coherencia del counter (heredó session_number del trigger
  // basado en el estado anterior). Solo aplica si la nueva cita ya existía
  // antes de que se completara esta.
  if (status === 'completed' && payload.objective_completed === true && appointment.case_id) {
    const { data: futureAppts } = await service
      .from('appointments')
      .select('id, scheduled_at, session_number')
      .eq('case_id', appointment.case_id)
      .eq('status', 'scheduled')
      .eq('session_number', appointment.session_number)
      .gt('scheduled_at', appointment.scheduled_at)
    for (const fa of futureAppts ?? []) {
      await service
        .from('appointments')
        .update({ session_number: appointment.session_number + 1 })
        .eq('id', fa.id)
    }
  }

  // Crear nota de sesión si vino con body
  if (payload.session_note_body && payload.session_note_body.trim() && appointment.case_id) {
    const authorLabel = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || user.email || 'Staff'
    await service.from('case_notes').insert({
      case_id: appointment.case_id,
      appointment_id,
      author_id: user.id,
      author_role: profile.role,
      author_label: authorLabel,
      category: 'session',
      body: payload.session_note_body.trim(),
      visible_to_client: false,
    })
  }

  // Bitácora — subcategoría según resultado
  if (appointment.case_id) {
    const subcategory =
      status === 'completed' && payload.objective_completed === true
        ? SUBCATEGORIES.APPT_COMPLETED
        : status === 'completed' && payload.objective_completed === false
        ? SUBCATEGORIES.APPT_OBJECTIVE_NOT_COMPLETED
        : status === 'no_show'
        ? SUBCATEGORIES.APPT_NO_SHOW
        : SUBCATEGORIES.APPT_CANCELLED

    const description =
      status === 'completed' && payload.objective_completed === true
        ? `Cita #${appointment.session_number} completada (objetivo logrado)`
        : status === 'completed' && payload.objective_completed === false
        ? `Cita #${appointment.session_number} realizada pero el objetivo quedó pendiente`
        : status === 'no_show'
        ? `Cliente no se presentó a la cita #${appointment.session_number}`
        : `Cita #${appointment.session_number} cancelada${payload.cancellation_reason ? `: ${payload.cancellation_reason}` : ''}`

    await logActivity({
      caseId: appointment.case_id,
      category: 'appointment',
      subcategory,
      description,
      metadata: {
        appointment_id,
        session_number: appointment.session_number,
        scheduled_at: appointment.scheduled_at,
        objective_completed: payload.objective_completed ?? null,
      },
      visibleToClient: status !== 'no_show',
      actor: { kind: 'session', supabase },
      client: service,
    })
  }

  return NextResponse.json({ ok: true })
}
