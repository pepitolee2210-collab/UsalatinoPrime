import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { normalizePhone } from '@/lib/phone'

/**
 * GET /api/voice-agent/contracts/search?q=<query>
 *
 * Busca contratos por nombre del cliente o teléfono. Usa ILIKE en nombre
 * y normalize_phone para coincidir tolerante.
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

  const q = (req.nextUrl.searchParams.get('q') || '').trim()
  if (!q) return NextResponse.json({ matches: [] })

  // Heurística: si parece teléfono, normaliza y busca por phone; si no,
  // busca por nombre (ILIKE).
  const looksLikePhone = /^[\d+\-\s()]+$/.test(q) && q.replace(/\D/g, '').length >= 7

  let query = service
    .from('contracts')
    .select('id, created_at, status, client_full_name, client_phone, service_slug, service_name, total_price')
    .order('created_at', { ascending: false })
    .limit(20)

  if (looksLikePhone) {
    const normalized = normalizePhone(q)
    if (normalized) {
      query = query.ilike('client_phone', `%${normalized.slice(-7)}%`)
    } else {
      query = query.ilike('client_full_name', `%${q}%`)
    }
  } else {
    query = query.ilike('client_full_name', `%${q}%`)
  }

  const { data, error } = await query
  if (error) {
    console.error('[voice-agent/contracts/search]', error)
    return NextResponse.json({ error: 'Error buscando' }, { status: 500 })
  }

  return NextResponse.json({ matches: data || [] })
}
