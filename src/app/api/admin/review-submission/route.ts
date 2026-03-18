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

  const { submission_id, status, admin_notes } = await request.json()

  if (!submission_id || !status) {
    return NextResponse.json({ error: 'submission_id y status requeridos' }, { status: 400 })
  }

  const { error } = await supabase
    .from('employee_submissions')
    .update({
      status,
      admin_notes: admin_notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', submission_id)

  if (error) {
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }

  // If approved, update assignment status too
  if (status === 'approved') {
    const { data: sub } = await supabase
      .from('employee_submissions')
      .select('assignment_id')
      .eq('id', submission_id)
      .single()

    if (sub) {
      await supabase
        .from('employee_case_assignments')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', sub.assignment_id)
    }
  }

  if (status === 'needs_correction') {
    const { data: sub } = await supabase
      .from('employee_submissions')
      .select('assignment_id')
      .eq('id', submission_id)
      .single()

    if (sub) {
      await supabase
        .from('employee_case_assignments')
        .update({ status: 'needs_correction', updated_at: new Date().toISOString() })
        .eq('id', sub.assignment_id)
    }
  }

  return NextResponse.json({ success: true })
}
