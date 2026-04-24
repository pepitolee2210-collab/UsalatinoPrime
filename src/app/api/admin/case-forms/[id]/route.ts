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
 * GET /api/admin/case-forms/[id] — detalle de una instance (schema + valores).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const service = await ensureAdminOrEmployee()
  if (!service) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const { data, error } = await service
    .from('case_form_instances')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json({ instance: data })
}

/**
 * PATCH /api/admin/case-forms/[id] — guardar filled_values.
 * Body: { values: Record<string, any> }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const service = await ensureAdminOrEmployee()
  if (!service) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const { values } = await req.json() as { values?: Record<string, unknown> }

  if (!values || typeof values !== 'object') {
    return NextResponse.json({ error: 'values requeridos' }, { status: 400 })
  }

  // Determinar si completó todos los obligatorios
  const { data: instance } = await service
    .from('case_form_instances')
    .select('acroform_schema')
    .eq('id', id)
    .single()

  const schema = (instance?.acroform_schema as Array<{ name: string; required: boolean; sijs_relevant?: boolean }>) || []
  const requiredFields = schema.filter(f => f.required && (f.sijs_relevant !== false))
  const filledRequired = requiredFields.filter(f => {
    const v = values[f.name]
    return v !== undefined && v !== null && v !== '' && v !== false
  })

  const status = requiredFields.length === 0 || filledRequired.length === requiredFields.length
    ? 'complete'
    : filledRequired.length > 0 ? 'partial' : 'ready'

  const { error } = await service
    .from('case_form_instances')
    .update({
      filled_values: values,
      filled_at: new Date().toISOString(),
      status,
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, status })
}
