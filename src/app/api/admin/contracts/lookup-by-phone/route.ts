import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { normalizePhone, isValidPhoneLength } from '@/lib/phone'

/**
 * POST /api/admin/contracts/lookup-by-phone
 *
 * Devuelve el profile y los contratos previos del cliente cuyo teléfono
 * normalizado coincida. Lo usa QuickContractGenerator para mostrar al admin
 * "este cliente ya tiene N contratos firmados" antes de crear uno nuevo.
 *
 * NO bloquea la creación — solo informa.
 *
 * Body: { phone: string }
 * Response:
 *   { found: false }
 *   |
 *   { found: true, client: {...}, contracts: [{id, service_name, status, signed_at, minors_count}] }
 */

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role, employee_type')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'
  const isContractsManager =
    profile?.role === 'employee' && profile?.employee_type === 'contracts_manager'
  if (!isAdmin && !isContractsManager) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const phone = body?.phone?.toString() ?? ''
  const normalized = normalizePhone(phone)
  if (!isValidPhoneLength(normalized)) {
    return NextResponse.json({ found: false })
  }

  const { data: matched, error: rpcError } = await service.rpc('find_client_by_phone', {
    p_phone: phone,
  })
  if (rpcError) {
    console.error('[admin/contracts/lookup-by-phone] rpc error:', rpcError)
    return NextResponse.json({ found: false })
  }

  const matchedProfile = Array.isArray(matched) && matched.length > 0 ? matched[0] : null
  if (!matchedProfile) return NextResponse.json({ found: false })

  const { data: contracts } = await service
    .from('contracts')
    .select('id, service_slug, service_name, subservice_slug, status, signed_at, minors')
    .eq('client_id', matchedProfile.id)
    .order('created_at', { ascending: false })

  type ContractRow = {
    id: string
    service_slug: string
    service_name: string
    subservice_slug: string | null
    status: string
    signed_at: string | null
    minors: { fullName?: string }[] | null
  }
  const items = (contracts ?? []).map((c: ContractRow) => ({
    id: c.id,
    service_slug: c.service_slug,
    service_name: c.service_name,
    subservice_slug: c.subservice_slug,
    status: c.status,
    signed_at: c.signed_at,
    minors_count: Array.isArray(c.minors) ? c.minors.length : 0,
    minor_names: Array.isArray(c.minors)
      ? c.minors
          .map((m) => m.fullName?.split(/\s+/)[0])
          .filter(Boolean)
          .slice(0, 4)
      : [],
  }))

  return NextResponse.json({
    found: true,
    client: {
      id: matchedProfile.id,
      first_name: matchedProfile.first_name,
      last_name: matchedProfile.last_name,
      phone: matchedProfile.phone,
    },
    contracts: items,
  })
}
