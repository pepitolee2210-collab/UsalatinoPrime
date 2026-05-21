// POST /api/employee/appointments/book
//
// Permite a Vanessa (senior_consultant) y Andrium (contracts_manager)
// agendar citas a clientes existentes (con case_id + client_id) o a
// no-clientes/prospectos (con guest_name [+ guest_phone]). Admin también
// puede llamarlo aunque ya tiene /api/admin/appointments/book.
//
// Reusa la misma lógica de validación que admin via book-service.ts —
// si cambia una regla (weekly limit, antelación, doble booking) solo se
// modifica en un sitio.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logActivity, SUBCATEGORIES } from '@/lib/activity/log-activity'
import {
  validateClientBooking,
  isSlotFree,
  sourceForActor,
} from '@/lib/appointments/book-service'

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

  type Body = {
    case_id?: string
    client_id?: string
    scheduled_at?: string
    guest_name?: string
    guest_phone?: string | null
  }
  let payload: Body
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { case_id, client_id, scheduled_at, guest_name, guest_phone } = payload
  if (!scheduled_at) {
    return NextResponse.json({ error: 'scheduled_at requerido' }, { status: 400 })
  }

  const isGuest = !case_id && !client_id && !!guest_name
  if (!isGuest && (!case_id || !client_id)) {
    return NextResponse.json(
      { error: 'case_id + client_id requeridos (o guest_name para no-clientes)' },
      { status: 400 },
    )
  }

  const source = sourceForActor({
    role: profile?.role as 'admin' | 'employee',
    employeeType: profile?.employee_type,
  })

  if (!isGuest) {
    // Sin antelación mínima fuerte: cuando empleado/admin agenda, asumimos
    // que coordinó con el cliente y la regla de 24h es solo para self-
    // service del cliente. Lo dejamos en 0 horas (el campo aún valida
    // que no sea pasado).
    const validation = await validateClientBooking({
      client: service,
      caseId: case_id!,
      clientId: client_id!,
      scheduledAt: scheduled_at,
      minAdvanceHours: 0,
    })
    if (!validation.ok) {
      const status = validation.error.code === 'slot_taken' ? 409 : 400
      return NextResponse.json({ error: validation.error.message }, { status })
    }
  }

  const free = await isSlotFree(service, scheduled_at)
  if (!free) {
    return NextResponse.json({ error: 'Este horario ya fue tomado.' }, { status: 409 })
  }

  const insertData: Record<string, unknown> = {
    scheduled_at,
    source,
    notes: isGuest
      ? `Visita presencial — ${guest_name}`
      : `Agendada por ${profile?.role === 'admin' ? 'admin' : 'empleado'}`,
  }
  if (isGuest) {
    insertData.guest_name = guest_name
    if (guest_phone) insertData.guest_phone = guest_phone
  } else {
    insertData.case_id = case_id
    insertData.client_id = client_id
  }

  const { data: appointment, error } = await service
    .from('appointments')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Este horario ya fue tomado.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Error al agendar la cita' }, { status: 500 })
  }

  if (!isGuest && case_id) {
    await logActivity({
      caseId: case_id,
      category: 'appointment',
      subcategory: SUBCATEGORIES.APPT_SCHEDULED,
      description: `Cita agendada por ${profile?.role === 'admin' ? 'admin' : 'empleado'}`,
      metadata: { appointment_id: appointment?.id, scheduled_at, source },
      visibleToClient: true,
      actor: { kind: 'session', supabase },
      client: service,
    })
  }

  return NextResponse.json({ appointment })
}
