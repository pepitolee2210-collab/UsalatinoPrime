import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * GET  /api/admin/cases/[id]/i360-form
 *   Devuelve form_data, status, updated_at del registro I-360 SIJS del caso.
 *   Si no existe, devuelve { form_data: {}, status: null }.
 *
 * PUT  /api/admin/cases/[id]/i360-form
 *   Body: { form_data, action?: 'draft'|'submit' }
 *   Upsert sobre case_form_submissions con form_type='i360_sijs', minor_index=0.
 *   Diana (paralegal) y Henry (admin) pueden ambos. Bypass RLS via service client.
 */

async function ensureAdminOrEmployee() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin' && profile?.role !== 'employee') return null
  return { userId: user.id, service }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await ensureAdminOrEmployee()
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id: caseId } = await ctx.params
  if (!caseId) return NextResponse.json({ error: 'caseId requerido' }, { status: 400 })

  const { data: caseRow, error: caseErr } = await auth.service
    .from('cases')
    .select('id, client_id, case_number')
    .eq('id', caseId)
    .single()
  if (caseErr || !caseRow) {
    return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
  }

  const { data: submission } = await auth.service
    .from('case_form_submissions')
    .select('form_data, status, updated_at, submitted_at, admin_notes')
    .eq('case_id', caseId)
    .eq('form_type', 'i360_sijs')
    .eq('minor_index', 0)
    .maybeSingle()

  return NextResponse.json({
    case_id: caseId,
    case_number: caseRow.case_number,
    client_id: caseRow.client_id,
    form_data: (submission?.form_data as Record<string, unknown> | null) ?? {},
    status: submission?.status ?? null,
    updated_at: submission?.updated_at ?? null,
    submitted_at: submission?.submitted_at ?? null,
    admin_notes: submission?.admin_notes ?? null,
  })
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await ensureAdminOrEmployee()
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id: caseId } = await ctx.params
  if (!caseId) return NextResponse.json({ error: 'caseId requerido' }, { status: 400 })

  let body: { form_data?: Record<string, unknown>; action?: 'draft' | 'submit' }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  if (!body.form_data || typeof body.form_data !== 'object') {
    return NextResponse.json({ error: 'form_data requerido' }, { status: 400 })
  }

  const { data: caseRow, error: caseErr } = await auth.service
    .from('cases')
    .select('id, client_id')
    .eq('id', caseId)
    .single()
  if (caseErr || !caseRow) {
    return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
  }

  const status = body.action === 'submit' ? 'submitted' : 'draft'
  const nowIso = new Date().toISOString()

  const { error } = await auth.service
    .from('case_form_submissions')
    .upsert(
      {
        case_id: caseId,
        client_id: caseRow.client_id,
        form_type: 'i360_sijs',
        form_data: body.form_data,
        status,
        minor_index: 0,
        submitted_at: body.action === 'submit' ? nowIso : null,
        updated_at: nowIso,
      },
      { onConflict: 'case_id,form_type,minor_index' },
    )

  if (error) {
    console.error('Error saving I-360 from admin:', error)
    return NextResponse.json({ error: 'Error al guardar', detail: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, status, saved_at: nowIso })
}
