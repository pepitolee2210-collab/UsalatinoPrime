import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'employee' && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { appointment_id, employee_notes } = await request.json()

  if (!appointment_id) {
    return NextResponse.json({ error: 'appointment_id requerido' }, { status: 400 })
  }

  // Use service client — employee only has SELECT on appointments
  const service = createServiceClient()
  const { error } = await service
    .from('appointments')
    .update({ employee_notes })
    .eq('id', appointment_id)

  if (error) {
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
