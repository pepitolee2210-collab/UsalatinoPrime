import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { WITNESS_FORM_SLUG, readWitnesses } from '@/lib/legal/asilo-testigos-form-schema'

/**
 * Persistencia de las cartas juradas de testigo generadas para casos de asilo.
 * Espejo de /api/cases/saved-declarations, pero con
 * form_type='asylum_witness_letters'. Cada carta:
 *   { witness_index, witness_name, content (EN), contentES? }
 *
 * El GET devuelve también los testigos que el cliente capturó en el formulario
 * (`asilo_testigos_carta`), para que el panel de Diana liste a quién generar.
 */

export async function GET(req: NextRequest) {
  const caseId = req.nextUrl.searchParams.get('case_id')
  if (!caseId) return NextResponse.json({ error: 'case_id requerido' }, { status: 400 })

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

  const service = createServiceClient()
  const [lettersRes, witnessRes] = await Promise.all([
    service
      .from('case_form_submissions')
      .select('form_data')
      .eq('case_id', caseId)
      .eq('form_type', 'asylum_witness_letters')
      .maybeSingle(),
    service
      .from('case_form_instances')
      .select('filled_values')
      .eq('case_id', caseId)
      .eq('form_name', WITNESS_FORM_SLUG)
      .maybeSingle(),
  ])

  return NextResponse.json({
    letters: lettersRes.data?.form_data?.letters || [],
    witnesses: readWitnesses(witnessRes.data?.filled_values),
  })
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

  const { case_id, letters } = await req.json()
  if (!case_id || !letters) return NextResponse.json({ error: 'case_id y letters requeridos' }, { status: 400 })

  const service = createServiceClient()

  const { data: existing } = await service
    .from('case_form_submissions')
    .select('id')
    .eq('case_id', case_id)
    .eq('form_type', 'asylum_witness_letters')
    .single()

  if (existing) {
    await service
      .from('case_form_submissions')
      .update({ form_data: { letters }, submitted_at: new Date().toISOString() })
      .eq('id', existing.id)
  } else {
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
        form_type: 'asylum_witness_letters',
        form_data: { letters },
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      })
  }

  return NextResponse.json({ success: true })
}
