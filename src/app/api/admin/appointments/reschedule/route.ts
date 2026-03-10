import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

  const { appointment_id, scheduled_at } = await request.json()

  if (!appointment_id || !scheduled_at) {
    return NextResponse.json({ error: 'appointment_id y scheduled_at requeridos' }, { status: 400 })
  }

  // Verificar que la cita existe y está scheduled
  const { data: appointment } = await supabase
    .from('appointments')
    .select('id, status')
    .eq('id', appointment_id)
    .single()

  if (!appointment) {
    return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 })
  }

  if (appointment.status !== 'scheduled') {
    return NextResponse.json({ error: 'Solo se pueden reprogramar citas agendadas' }, { status: 400 })
  }

  // Verificar que el nuevo slot no esté tomado
  const { data: slotTaken } = await supabase
    .from('appointments')
    .select('id')
    .eq('scheduled_at', scheduled_at)
    .eq('status', 'scheduled')
    .neq('id', appointment_id)
    .limit(1)

  if (slotTaken && slotTaken.length > 0) {
    return NextResponse.json({ error: 'Este horario ya fue tomado' }, { status: 409 })
  }

  const { error } = await supabase
    .from('appointments')
    .update({
      scheduled_at,
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointment_id)

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Este horario ya fue tomado' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Error al reprogramar' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
