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

  const { case_id, employee_id, task_description } = await request.json()

  if (!case_id || !employee_id) {
    return NextResponse.json({ error: 'case_id y employee_id requeridos' }, { status: 400 })
  }

  const { data: assignment, error } = await supabase
    .from('employee_case_assignments')
    .insert({ case_id, employee_id, task_description, status: 'assigned' })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Error al asignar' }, { status: 500 })
  }

  return NextResponse.json({ assignment })
}
