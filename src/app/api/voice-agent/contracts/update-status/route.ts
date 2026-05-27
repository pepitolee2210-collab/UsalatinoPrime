import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const VALID_STATUSES = ['borrador', 'pendiente_firma', 'firmado', 'activo', 'completado', 'cancelado']

/**
 * POST /api/voice-agent/contracts/update-status
 * Body: { contract_id: string, status: string }
 *
 * Cambia el status de un contrato. Para uso del agente de voz Lex después
 * de que Vanessa confirme la acción verbalmente.
 */
export async function POST(req: NextRequest) {
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

  const { contract_id, status } = await req.json()
  if (!contract_id || typeof contract_id !== 'string') {
    return NextResponse.json({ error: 'contract_id requerido' }, { status: 400 })
  }
  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'status inválido' }, { status: 400 })
  }

  const { error } = await service
    .from('contracts')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', contract_id)

  if (error) {
    console.error('[voice-agent/contracts/update-status]', error)
    return NextResponse.json({ error: 'Error actualizando' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
