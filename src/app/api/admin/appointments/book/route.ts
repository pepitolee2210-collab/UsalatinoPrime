import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

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

  if (!profile || (profile.role !== 'admin' && profile.role !== 'employee')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { case_id, client_id, scheduled_at, guest_name } = await request.json()

  // Guest booking (non-client)
  const isGuest = !case_id && !client_id && guest_name

  if (!isGuest && (!case_id || !client_id || !scheduled_at)) {
    return NextResponse.json({ error: 'case_id, client_id y scheduled_at requeridos (o guest_name para no-clientes)' }, { status: 400 })
  }

  if (!scheduled_at) {
    return NextResponse.json({ error: 'scheduled_at requerido' }, { status: 400 })
  }

  const service = createServiceClient()

  if (!isGuest) {
    // Verify case belongs to client
    const { data: caseRow } = await service
      .from('cases')
      .select('id, client_id')
      .eq('id', case_id)
      .single()

    if (!caseRow || caseRow.client_id !== client_id) {
      return NextResponse.json({ error: 'Caso no encontrado o no pertenece al cliente' }, { status: 404 })
    }

    // Check client doesn't already have a scheduled appointment
    const { data: existing } = await service
      .from('appointments')
      .select('id')
      .eq('client_id', client_id)
      .eq('status', 'scheduled')
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'Este cliente ya tiene una cita agendada' }, { status: 400 })
    }
  }

  // Verify slot is not taken
  const { data: slotTaken } = await service
    .from('appointments')
    .select('id')
    .eq('scheduled_at', scheduled_at)
    .eq('status', 'scheduled')
    .limit(1)

  if (slotTaken && slotTaken.length > 0) {
    return NextResponse.json({ error: 'Este horario ya fue tomado' }, { status: 409 })
  }

  // Create the appointment
  const insertData: Record<string, unknown> = {
    scheduled_at,
    notes: isGuest
      ? `Visita presencial — ${guest_name}`
      : 'Agendada por el equipo de Henry',
  }

  if (isGuest) {
    insertData.guest_name = guest_name
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
      return NextResponse.json({ error: 'Este horario ya fue tomado' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Error al agendar la cita' }, { status: 500 })
  }

  return NextResponse.json({ appointment })
}
