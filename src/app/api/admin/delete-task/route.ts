import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { assignment_id } = await request.json()
  if (!assignment_id) {
    return NextResponse.json({ error: 'assignment_id requerido' }, { status: 400 })
  }

  // Delete assignment (CASCADE deletes submissions and documents)
  const { error } = await supabase
    .from('employee_case_assignments')
    .delete()
    .eq('id', assignment_id)

  if (error) {
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
