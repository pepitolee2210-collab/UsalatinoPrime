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

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { appointment_id } = await request.json()

  if (!appointment_id) {
    return NextResponse.json({ error: 'appointment_id requerido' }, { status: 400 })
  }

  const { data: appointment, error: fetchError } = await supabase
    .from('appointments')
    .select('id, status, client_id')
    .eq('id', appointment_id)
    .single()

  if (fetchError || !appointment) {
    return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 })
  }

  if (appointment.status !== 'cancelled' && appointment.status !== 'no_show') {
    return NextResponse.json({ error: 'Solo se puede levantar la penalizacion de citas canceladas o no_show' }, { status: 400 })
  }

  const { error } = await supabase
    .from('appointments')
    .update({
      penalty_waived: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointment_id)

  if (error) {
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
