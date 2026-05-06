import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { normalizePhone, isValidPhoneLength } from '@/lib/phone'

/**
 * POST /api/admin/contracts/lookup-by-phone
 *
 * Busca cliente existente por teléfono (match exacto) y, si no encuentra,
 * busca alternativas por passport o nombre completo. Lo usa
 * QuickContractGenerator para mostrar al admin avisos preventivos:
 *   - Panel azul si phone coincide → cliente existente, contrato adicional.
 *   - Panel amarillo si nombre/passport coinciden con un teléfono distinto →
 *     posible duplicado humano (admin pudo escribir mal el teléfono).
 *
 * No bloquea la creación. Solo informa.
 *
 * Body: { phone?: string, fullName?: string, passport?: string }
 */

interface MinorRecord { fullName?: string }

interface ContractRow {
  id: string
  service_slug: string
  service_name: string
  subservice_slug: string | null
  status: string
  signed_at: string | null
  minors: MinorRecord[] | null
  client_phone: string | null
  client_passport: string | null
  client_id: string | null
  client_full_name: string
}

interface ContractCard {
  id: string
  service_slug: string
  service_name: string
  subservice_slug: string | null
  status: string
  signed_at: string | null
  minors_count: number
  minor_names: string[]
}

function summarizeContract(c: ContractRow): ContractCard {
  return {
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
          .filter((n): n is string => Boolean(n))
          .slice(0, 4)
      : [],
  }
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizePassport(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

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
  const phone: string = body?.phone?.toString() ?? ''
  const fullName: string = body?.fullName?.toString() ?? ''
  const passport: string = body?.passport?.toString() ?? ''

  const normalizedPhone = normalizePhone(phone)
  const normalizedName = normalizeName(fullName)
  const normalizedPassport = normalizePassport(passport)
  const phoneValid = isValidPhoneLength(normalizedPhone)
  const nameValid = normalizedName.length >= 5 && normalizedName.split(' ').length >= 2
  const passportValid = normalizedPassport.length >= 5

  // Match principal: por teléfono.
  let exactMatchClientId: string | null = null
  if (phoneValid) {
    const { data: matched, error: rpcError } = await service.rpc(
      'find_client_by_phone',
      { p_phone: phone },
    )
    if (rpcError) {
      console.error('[admin/contracts/lookup-by-phone] rpc error:', rpcError)
    } else if (Array.isArray(matched) && matched.length > 0) {
      exactMatchClientId = matched[0].id
    }
  }

  // Si hay match por teléfono → traer cliente + contratos.
  if (exactMatchClientId) {
    const { data: clientProfile } = await service
      .from('profiles')
      .select('id, first_name, last_name, phone')
      .eq('id', exactMatchClientId)
      .single()

    const { data: contracts } = await service
      .from('contracts')
      .select(
        'id, service_slug, service_name, subservice_slug, status, signed_at, minors, client_phone, client_passport, client_id, client_full_name',
      )
      .eq('client_id', exactMatchClientId)
      .order('created_at', { ascending: false })

    return NextResponse.json({
      found: true,
      client: clientProfile,
      contracts: (contracts ?? []).map((c) => summarizeContract(c as ContractRow)),
      alternative_matches: [],
    })
  }

  // Sin match por teléfono. Buscar alternativas por passport o nombre.
  // Devolvemos hasta 3 perfiles alternativos para advertir al admin.
  const alternativeMatches: Array<{
    reason: 'passport' | 'name'
    client: { id: string; first_name: string; last_name: string; phone: string | null }
    contracts: ContractCard[]
  }> = []
  const seenClientIds = new Set<string>()

  if (passportValid) {
    // Buscar contratos con passport similar (case-insensitive, sin separadores).
    const { data: rows } = await service
      .from('contracts')
      .select(
        'id, service_slug, service_name, subservice_slug, status, signed_at, minors, client_phone, client_passport, client_id, client_full_name',
      )
      .not('client_id', 'is', null)
      .not('client_passport', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500)

    const matched = (rows ?? []).filter((r) => {
      const np = normalizePassport(r.client_passport ?? '')
      return np === normalizedPassport
    })

    const groupedByClient = new Map<string, ContractRow[]>()
    for (const r of matched) {
      const cid = r.client_id as string
      const list = groupedByClient.get(cid) ?? []
      list.push(r as ContractRow)
      groupedByClient.set(cid, list)
    }

    for (const [cid, list] of groupedByClient) {
      if (seenClientIds.has(cid)) continue
      seenClientIds.add(cid)
      const { data: cp } = await service
        .from('profiles')
        .select('id, first_name, last_name, phone')
        .eq('id', cid)
        .single()
      if (!cp) continue
      // Saltar si su phone normalizado coincide con el del input
      // (sería el match exacto que ya descartamos).
      if (cp.phone && normalizePhone(cp.phone) === normalizedPhone) continue
      alternativeMatches.push({
        reason: 'passport',
        client: cp,
        contracts: list.map(summarizeContract),
      })
      if (alternativeMatches.length >= 3) break
    }
  }

  if (nameValid && alternativeMatches.length < 3) {
    // Buscar profiles con nombre completo similar (ILIKE flexible).
    // Construye el patrón a partir de la primera palabra del input — la más
    // estable. Filtra después en JS para máxima precisión.
    const firstToken = normalizedName.split(' ')[0]
    if (firstToken.length >= 3) {
      const { data: candidates } = await service
        .from('profiles')
        .select('id, first_name, last_name, phone')
        .eq('role', 'client')
        .ilike('first_name', `%${firstToken}%`)
        .limit(50)

      for (const cp of candidates ?? []) {
        if (seenClientIds.has(cp.id)) continue
        const candidateName = normalizeName(`${cp.first_name ?? ''} ${cp.last_name ?? ''}`)
        if (candidateName !== normalizedName) continue
        if (cp.phone && normalizePhone(cp.phone) === normalizedPhone) continue
        seenClientIds.add(cp.id)

        const { data: contracts } = await service
          .from('contracts')
          .select(
            'id, service_slug, service_name, subservice_slug, status, signed_at, minors, client_phone, client_passport, client_id, client_full_name',
          )
          .eq('client_id', cp.id)
          .order('created_at', { ascending: false })

        alternativeMatches.push({
          reason: 'name',
          client: cp,
          contracts: (contracts ?? []).map((c) => summarizeContract(c as ContractRow)),
        })
        if (alternativeMatches.length >= 3) break
      }
    }
  }

  return NextResponse.json({
    found: false,
    client: null,
    contracts: [],
    alternative_matches: alternativeMatches,
  })
}
