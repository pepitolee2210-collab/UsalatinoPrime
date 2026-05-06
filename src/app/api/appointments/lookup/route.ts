import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { normalizePhone, isValidPhoneLength } from '@/lib/phone'

interface MinorDescriptor {
  fullName: string
  dob?: string
  passport?: string
  birthplace?: string
}

interface ServiceJoin {
  name: string
}

interface CaseJoin {
  id: string
  case_number: string
  intake_status: string | null
  current_phase: string | null
  service: ServiceJoin | ServiceJoin[] | null
}

interface ContractRow {
  id: string
  service_slug: string
  service_name: string
  subservice_slug: string | null
  status: string
  signed_at: string | null
  minors: MinorDescriptor[] | null
  case: CaseJoin | CaseJoin[] | null
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const phone = body?.phone?.trim()

  if (!phone) {
    return NextResponse.json({ error: 'Número de teléfono requerido' }, { status: 400 })
  }

  const normalized = normalizePhone(phone)
  if (!isValidPhoneLength(normalized)) {
    return NextResponse.json({ error: 'Número de teléfono inválido' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: matched, error: rpcError } = await supabase.rpc('find_client_by_phone', {
    p_phone: phone,
  })

  if (rpcError) {
    console.error('[lookup] find_client_by_phone error:', rpcError)
    return NextResponse.json({ error: 'Error en la búsqueda' }, { status: 500 })
  }

  const profileMatch = Array.isArray(matched) && matched.length > 0 ? matched[0] : null
  if (!profileMatch) {
    return NextResponse.json({ found: false, reason: 'not_found' })
  }

  // Traer contratos firmados ya vinculados a un case (1:1).
  const { data: contracts, error: contractsErr } = await supabase
    .from('contracts')
    .select(`
      id, service_slug, service_name, subservice_slug, status, signed_at, minors,
      case:cases!contracts_case_id_fkey(
        id, case_number, intake_status, current_phase,
        service:service_catalog(name)
      )
    `)
    .eq('client_id', profileMatch.id)
    .in('status', ['firmado', 'activo', 'completado'])
    .not('case_id', 'is', null)
    .order('signed_at', { ascending: false })

  if (contractsErr) {
    console.error('[lookup] contracts query error:', contractsErr)
    return NextResponse.json({ error: 'Error en la búsqueda' }, { status: 500 })
  }

  const validContracts = (contracts ?? []) as unknown as ContractRow[]

  if (validContracts.length === 0) {
    return NextResponse.json({ found: false, reason: 'no_cases' })
  }

  // Para cada contrato: garantizar appointment_token activo.
  const cards = await Promise.all(
    validContracts.map(async (c) => {
      const caseRow = Array.isArray(c.case) ? c.case[0] : c.case
      if (!caseRow) return null

      const serviceJoin = Array.isArray(caseRow.service) ? caseRow.service[0] : caseRow.service
      const serviceName = serviceJoin?.name ?? c.service_name ?? 'Servicio'

      // Reusar token activo o crear uno nuevo.
      const { data: existingToken } = await supabase
        .from('appointment_tokens')
        .select('token')
        .eq('client_id', profileMatch.id)
        .eq('case_id', caseRow.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

      let token: string | null = existingToken?.token ?? null
      if (!token) {
        const { data: newToken } = await supabase
          .from('appointment_tokens')
          .insert({ client_id: profileMatch.id, case_id: caseRow.id })
          .select('token')
          .single()
        token = newToken?.token ?? null
      }

      if (!token) return null

      const minors = (c.minors ?? []).map((m) => ({
        fullName: m.fullName,
        dob: m.dob ?? null,
        passport: m.passport ?? null,
      }))

      return {
        contract_id: c.id,
        case_id: caseRow.id,
        case_number: caseRow.case_number,
        service_slug: c.service_slug,
        service_name: serviceName,
        subservice_slug: c.subservice_slug,
        intake_status: caseRow.intake_status,
        current_phase: caseRow.current_phase,
        signed_at: c.signed_at,
        minors,
        token,
      }
    }),
  )

  const filtered = cards.filter(Boolean)

  if (filtered.length === 0) {
    return NextResponse.json({ found: false, reason: 'no_cases' })
  }

  return NextResponse.json({
    found: true,
    clientName: `${profileMatch.first_name ?? ''} ${profileMatch.last_name ?? ''}`.trim(),
    contracts: filtered,
  })
}
