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

  if (profile?.role !== 'employee') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { assignment_id, status } = await request.json()

  if (!assignment_id || !status) {
    return NextResponse.json({ error: 'assignment_id y status requeridos' }, { status: 400 })
  }

  // Only allow employee to update their own assignments
  const { error } = await supabase
    .from('employee_case_assignments')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', assignment_id)
    .eq('employee_id', user.id)

  if (error) {
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
