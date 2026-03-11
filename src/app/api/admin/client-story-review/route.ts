import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'employee')) {
    return Response.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { submission_id, status, admin_notes } = await request.json()

  if (!submission_id || !status) {
    return Response.json({ error: 'submission_id y status requeridos' }, { status: 400 })
  }

  const validStatuses = ['approved', 'needs_correction', 'submitted']
  if (!validStatuses.includes(status)) {
    return Response.json({ error: 'Status inválido' }, { status: 400 })
  }

  const updateData: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (admin_notes !== undefined) {
    updateData.admin_notes = admin_notes
  }

  const { error } = await service
    .from('case_form_submissions')
    .update(updateData)
    .eq('id', submission_id)

  if (error) {
    return Response.json({ error: 'Error al actualizar' }, { status: 500 })
  }

  return Response.json({ success: true })
}
