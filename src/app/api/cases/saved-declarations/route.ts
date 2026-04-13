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
    .eq('form_type', 'generated_declarations')
    .single()

  return NextResponse.json({ declarations: data?.form_data?.declarations || [] })
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

  const { case_id, declarations } = await req.json()
  if (!case_id || !declarations) return NextResponse.json({ error: 'case_id y declarations requeridos' }, { status: 400 })

  const service = createServiceClient()

  // Upsert
  const { data: existing } = await service
    .from('case_form_submissions')
    .select('id')
    .eq('case_id', case_id)
    .eq('form_type', 'generated_declarations')
    .single()

  if (existing) {
    await service
      .from('case_form_submissions')
      .update({ form_data: { declarations }, submitted_at: new Date().toISOString() })
      .eq('id', existing.id)
  } else {
    // Get client_id
    const { data: caseData } = await service
      .from('cases')
      .select('client_id')
      .eq('id', case_id)
      .single()

    if (!caseData) return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })

    await service
      .from('case_form_submissions')
      .insert({
        case_id,
        client_id: caseData.client_id,
        form_type: 'generated_declarations',
        form_data: { declarations },
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      })
  }

  return NextResponse.json({ success: true })
}
