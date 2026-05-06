import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { normalizePhone, isValidPhoneLength } from '@/lib/phone'

interface MinorDescriptor {
  fullName: string
  dob?: string
  passport?: string
  birthplace?: string
}

interface CaseRow {
  id: string
  case_number: string
  intake_status: string | null
  current_phase: string | null
  service_id: string | null
  service_name: string | null
}

interface ContractRow {
  id: string
  service_slug: string
  service_name: string
  subservice_slug: string | null
  status: string
  signed_at: string | null
  minors: MinorDescriptor[] | null
  case_id: string | null
}

/**
 * POST /api/appointments/lookup
 *
 * Devuelve los contratos del cliente identificado por teléfono normalizado.
 * Resuelve el case asociado a cada contrato con dos estrategias:
 *   1. Preferir contracts.case_id si existe (datos nuevos / migrados).
 *   2. Fallback (client_id, service_id) → primer case por created_at ASC,
 *      para soportar contratos legacy creados antes del refactor 20260507
 *      cuando el register-client viejo NO poblaba contracts.case_id.
 *
 * Status incluido: firmado, activo, completado y borrador (cuando hay un
 * case asociable). Borradores sin case se descartan — son leads sin
 * actividad real. Esta tolerancia restaura el acceso a 108 clientes
 * legacy reportado el 6-may sin necesidad de esperar al backfill SQL.
 */
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

  // Traer contratos del cliente con cualquier status que pueda ser real.
  // Borradores se incluyen y se filtran después si no tienen case asociable.
  const { data: contracts, error: contractsErr } = await supabase
    .from('contracts')
    .select(
      'id, service_slug, service_name, subservice_slug, status, signed_at, minors, case_id',
    )
    .eq('client_id', profileMatch.id)
    .in('status', ['firmado', 'activo', 'completado', 'borrador'])
    .order('signed_at', { ascending: false, nullsFirst: false })

  if (contractsErr) {
    console.error('[lookup] contracts query error:', contractsErr)
    return NextResponse.json({ error: 'Error en la búsqueda' }, { status: 500 })
  }

  const contractList = (contracts ?? []) as ContractRow[]

  if (contractList.length === 0) {
    return NextResponse.json({ found: false, reason: 'no_cases' })
  }

  // Resolución de case por contrato (con fallback para legacy).
  async function resolveCase(c: ContractRow): Promise<CaseRow | null> {
    // Preferir el link directo si existe.
    if (c.case_id) {
      const { data } = await supabase
        .from('cases')
        .select(
          'id, case_number, intake_status, current_phase, service_id, service:service_catalog(name)',
        )
        .eq('id', c.case_id)
        .maybeSingle()
      if (data) {
        const svc = Array.isArray(data.service) ? data.service[0] : data.service
        return {
          id: data.id,
          case_number: data.case_number,
          intake_status: data.intake_status,
          current_phase: data.current_phase,
          service_id: data.service_id,
          service_name: (svc as { name?: string } | null)?.name ?? c.service_name,
        }
      }
    }
    // Fallback: resolver por (client_id, service_slug). Solo si el
    // service_slug del contrato existe en el catálogo.
    const { data: svcRow } = await supabase
      .from('service_catalog')
      .select('id, name')
      .eq('slug', c.service_slug)
      .maybeSingle()
    if (!svcRow) return null
    const { data: caseRow } = await supabase
      .from('cases')
      .select('id, case_number, intake_status, current_phase, service_id')
      .eq('client_id', profileMatch.id)
      .eq('service_id', svcRow.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (!caseRow) return null
    return {
      id: caseRow.id,
      case_number: caseRow.case_number,
      intake_status: caseRow.intake_status,
      current_phase: caseRow.current_phase,
      service_id: caseRow.service_id,
      service_name: svcRow.name ?? c.service_name,
    }
  }

  // Para cada contrato: resolver case y garantizar appointment_token activo.
  const cards = await Promise.all(
    contractList.map(async (c) => {
      const caseRow = await resolveCase(c)
      if (!caseRow) return null

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
        service_name: caseRow.service_name ?? c.service_name ?? 'Servicio',
        subservice_slug: c.subservice_slug,
        intake_status: caseRow.intake_status,
        current_phase: caseRow.current_phase,
        signed_at: c.signed_at,
        minors,
        token,
      }
    }),
  )

  // Deduplicar por case_id — múltiples contratos legacy del mismo (client,
  // service) resuelven al mismo case. Mantener la card del contrato más
  // reciente (signed_at DESC, nulls al final).
  const seenCaseIds = new Set<string>()
  const filtered = cards
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .filter((c) => {
      if (seenCaseIds.has(c.case_id)) return false
      seenCaseIds.add(c.case_id)
      return true
    })

  if (filtered.length === 0) {
    return NextResponse.json({ found: false, reason: 'no_cases' })
  }

  return NextResponse.json({
    found: true,
    clientName: `${profileMatch.first_name ?? ''} ${profileMatch.last_name ?? ''}`.trim(),
    contracts: filtered,
  })
}
