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

  const { case_id, client_id, scheduled_at } = await request.json()

  if (!case_id || !client_id || !scheduled_at) {
    return NextResponse.json({ error: 'case_id, client_id y scheduled_at requeridos' }, { status: 400 })
  }

  const service = createServiceClient()

  // Verificar que el caso existe y pertenece al cliente
  const { data: caseRow } = await service
    .from('cases')
    .select('id, client_id')
    .eq('id', case_id)
    .single()

  if (!caseRow || caseRow.client_id !== client_id) {
    return NextResponse.json({ error: 'Caso no encontrado o no pertenece al cliente' }, { status: 404 })
  }

  // Verificar que no tenga ya una cita scheduled
  const { data: existing } = await service
    .from('appointments')
    .select('id')
    .eq('client_id', client_id)
    .eq('status', 'scheduled')
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'Este cliente ya tiene una cita agendada' }, { status: 400 })
  }

  // Verificar que el slot no esté tomado
  const { data: slotTaken } = await service
    .from('appointments')
    .select('id')
    .eq('scheduled_at', scheduled_at)
    .eq('status', 'scheduled')
    .limit(1)

  if (slotTaken && slotTaken.length > 0) {
    return NextResponse.json({ error: 'Este horario ya fue tomado' }, { status: 409 })
  }

  // Crear la cita (admin no tiene penalización, la crea directamente)
  const { data: appointment, error } = await service
    .from('appointments')
    .insert({
      case_id,
      client_id,
      scheduled_at,
      notes: 'Agendada por el equipo de Henry',
    })
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
