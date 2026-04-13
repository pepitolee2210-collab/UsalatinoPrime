import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  const caseId = req.nextUrl.searchParams.get('case_id')
  if (!caseId) return NextResponse.json({ error: 'case_id requerido' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const service = createServiceClient()
  const { data } = await service
    .from('case_form_submissions')
    .select('form_data')
    .eq('case_id', caseId)
    .eq('form_type', 'admin_supplementary')
    .single()

  return NextResponse.json({ data: data?.form_data || null })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.role !== 'employee') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { case_id, data } = await req.json()
  if (!case_id || !data) {
    return NextResponse.json({ error: 'case_id y data requeridos' }, { status: 400 })
  }

  const service = createServiceClient()

  // Upsert: update if exists, insert if not
  const { data: existing } = await service
    .from('case_form_submissions')
    .select('id')
    .eq('case_id', case_id)
    .eq('form_type', 'admin_supplementary')
    .single()

  if (existing) {
    const { error } = await service
      .from('case_form_submissions')
      .update({ form_data: data, submitted_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { data: caseData } = await service
      .from('cases')
      .select('client_id')
      .eq('id', case_id)
      .single()

    if (!caseData?.client_id) {
      return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
    }

    const { error } = await service
      .from('case_form_submissions')
      .insert({
        case_id,
        client_id: caseData.client_id,
        form_type: 'admin_supplementary',
        form_data: data,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
