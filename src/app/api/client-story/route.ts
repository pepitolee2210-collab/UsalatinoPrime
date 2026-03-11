import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// GET: Load saved story data
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) return Response.json({ error: 'Token requerido' }, { status: 400 })

  const supabase = createServiceClient()

  const { data: tokenData } = await supabase
    .from('appointment_tokens')
    .select('case_id, is_active')
    .eq('token', token)
    .single()

  if (!tokenData?.is_active) {
    return Response.json({ error: 'Token inválido' }, { status: 403 })
  }

  const { data: submissions } = await supabase
    .from('case_form_submissions')
    .select('form_type, form_data, status, admin_notes, updated_at')
    .eq('case_id', tokenData.case_id)
    .in('form_type', ['client_story', 'client_witnesses', 'client_absent_parent'])

  const result: Record<string, unknown> = {}
  for (const sub of submissions || []) {
    result[sub.form_type] = {
      data: sub.form_data,
      status: sub.status,
      admin_notes: sub.admin_notes,
    }
  }

  return Response.json(result)
}

// POST: Save/submit story data
export async function POST(request: NextRequest) {
  const { token, form_type, form_data, action } = await request.json()

  if (!token || !form_type || !form_data) {
    return Response.json({ error: 'token, form_type y form_data requeridos' }, { status: 400 })
  }

  const validTypes = ['client_story', 'client_witnesses', 'client_absent_parent']
  if (!validTypes.includes(form_type)) {
    return Response.json({ error: 'form_type inválido' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: tokenData } = await supabase
    .from('appointment_tokens')
    .select('case_id, client_id, is_active')
    .eq('token', token)
    .single()

  if (!tokenData?.is_active) {
    return Response.json({ error: 'Token inválido' }, { status: 403 })
  }

  const status = action === 'submit' ? 'submitted' : 'draft'

  const { error } = await supabase
    .from('case_form_submissions')
    .upsert({
      case_id: tokenData.case_id,
      client_id: tokenData.client_id,
      form_type,
      form_data,
      status,
      submitted_at: action === 'submit' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'case_id,form_type',
    })

  if (error) {
    return Response.json({ error: 'Error al guardar' }, { status: 500 })
  }

  return Response.json({ success: true, status })
}
