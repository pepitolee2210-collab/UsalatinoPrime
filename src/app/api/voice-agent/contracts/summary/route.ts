import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * GET /api/voice-agent/contracts/summary
 *
 * Resumen ejecutivo para narrar a Vanessa: cantidades por status,
 * monto pendiente, etc.
 */
export async function GET() {
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

  const { data, error } = await service
    .from('contracts')
    .select('status, total_price')

  if (error) {
    console.error('[voice-agent/contracts/summary]', error)
    return NextResponse.json({ error: 'Error en resumen' }, { status: 500 })
  }

  const byStatus: Record<string, number> = {}
  let pendingRevenue = 0
  let signedRevenue = 0
  for (const c of data || []) {
    const s = c.status || 'borrador'
    byStatus[s] = (byStatus[s] || 0) + 1
    if (s === 'pendiente_firma') pendingRevenue += Number(c.total_price) || 0
    if (s === 'firmado' || s === 'activo') signedRevenue += Number(c.total_price) || 0
  }

  return NextResponse.json({
    byStatus,
    pendingRevenue,
    signedRevenue,
    totalContracts: (data || []).length,
  })
}
