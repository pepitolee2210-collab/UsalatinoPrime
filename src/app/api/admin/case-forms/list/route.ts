import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

async function ensureAdminOrEmployee() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin' && profile?.role !== 'employee') return null
  return createServiceClient()
}

/**
 * GET /api/admin/case-forms/list?caseId=X
 * Devuelve todos los form instances del caso, agrupados por packet_type.
 * Lo usa el frontend para pollear mientras schema_source=pending.
 */
export async function GET(req: NextRequest) {
  const service = await ensureAdminOrEmployee()
  if (!service) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const caseId = req.nextUrl.searchParams.get('caseId')
  if (!caseId) return NextResponse.json({ error: 'caseId requerido' }, { status: 400 })

  const { data, error } = await service
    .from('case_form_instances')
    .select(`
      id, case_id, packet_type, form_name, form_url_official, form_description_es,
      is_mandatory, acroform_schema, schema_source, schema_error,
      filled_values, filled_at, filled_pdf_path, filled_pdf_generated_at,
      status, created_at, updated_at
    `)
    .eq('case_id', caseId)
    .order('packet_type', { ascending: true })
    .order('form_name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const intake = (data || []).filter(r => r.packet_type === 'intake')
  const merits = (data || []).filter(r => r.packet_type === 'merits')

  return NextResponse.json({
    intake,
    merits,
    total: (data || []).length,
    pending: (data || []).filter(r => r.schema_source === 'pending' || r.status === 'detecting').length,
  })
}
