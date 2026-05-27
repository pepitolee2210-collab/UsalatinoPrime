import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * GET /api/voice-agent/contracts/list?status=<status>&limit=<n>
 *
 * Listado simplificado de contratos para que Lex resuma a Vanessa.
 * Devuelve los campos mínimos para narrar: id, cliente, servicio, monto,
 * status, fecha. No incluye minors ni payment_schedule.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role, employee_type')
    .eq('id', user.id)
    .single()

  const allowed =
    profile?.role === 'admin' ||
    (profile?.role === 'employee' &&
      (profile?.employee_type === 'contracts_manager' || profile?.employee_type === 'senior_consultant'))
  if (!allowed) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const status = req.nextUrl.searchParams.get('status') || 'all'
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 10, 50)

  let q = service
    .from('contracts')
    .select('id, created_at, status, client_full_name, client_phone, service_slug, service_name, total_price')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status !== 'all') {
    q = q.eq('status', status)
  }

  const { data, error } = await q
  if (error) {
    console.error('[voice-agent/contracts/list]', error)
    return NextResponse.json({ error: 'Error consultando contratos' }, { status: 500 })
  }

  return NextResponse.json({
    count: data?.length ?? 0,
    items: data || [],
  })
}
