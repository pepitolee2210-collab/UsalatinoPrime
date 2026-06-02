import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  buildContractsWorkbook,
  type ContractExportRow,
} from '@/lib/exports/contracts-to-xlsx'
import { PHASE_TOKENS, type PhaseKey } from '@/app/employee/_shared/phase-tokens'
import type { CasePhase } from '@/types/database'

/**
 * POST /api/contracts/export
 *
 * Exporta TODOS los contratos a un .xlsx sin estilos para que Andrium / Vanessa /
 * Henry los filtren manualmente en Excel.
 *
 * Method: POST (no GET) para evitar que el service worker PWA de next-pwa
 * cachee el archivo.
 *
 * Auth: admin, contracts_manager, senior_consultant. Se usa createServiceClient
 * (bypass RLS) SOLO después de validar el role del caller — patrón estándar
 * documentado en CLAUDE.md.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const SELECT_COLUMNS = [
  'id',
  'created_at',
  'updated_at',
  'status',
  'signed_at',
  'contract_start_date',
  'signing_token',
  'case_id',
  'client_full_name',
  'client_passport',
  'client_phone',
  'client_dob',
  'client_address',
  'client_address_unit',
  'client_city',
  'client_state',
  'client_zip',
  'client_signature',
  'service_name',
  'service_slug',
  'subservice_slug',
  'variant_index',
  'asylum_family_type',
  'objeto_del_contrato',
  'etapas',
  'total_price',
  'initial_payment',
  'installment_count',
  'monthly_amount',
  'minors',
  'spouse',
  'addon_services',
  'payment_schedule',
].join(', ')

/**
 * Traduce el enum `current_phase` del caso al label en español que ve el staff
 * en el dashboard, reutilizando el MISMO diccionario que la UI (`PHASE_TOKENS`)
 * para que el Excel y la pantalla nunca se desincronicen.
 */
function resolvePhaseLabel(phase: CasePhase | null | undefined): string {
  const key: PhaseKey = phase ?? 'sin_fase'
  return PHASE_TOKENS[key]?.label ?? String(phase)
}

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const service = createServiceClient()

  const { data: profile, error: profileError } = await service
    .from('profiles')
    .select('role, employee_type')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const isAdmin = profile.role === 'admin'
  const isAllowedEmployee =
    profile.role === 'employee' &&
    (profile.employee_type === 'contracts_manager' ||
      profile.employee_type === 'senior_consultant')

  if (!isAdmin && !isAllowedEmployee) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { data, error } = await service
    .from('contracts')
    .select(SELECT_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[contracts/export] query error:', error)
    return NextResponse.json(
      { error: 'Error al cargar contratos' },
      { status: 500 },
    )
  }

  const rows = (data ?? []) as unknown as ContractExportRow[]

  // ── Enriquecer con fase del caso + documentos subidos por el cliente ──
  // Patrón "queries separadas + merge en JS": PostGREST no agrega (COUNT /
  // STRING_AGG) sin RPC, y el volumen es bajo (~1.2k docs), así que traemos
  // los datos planos y los agregamos en memoria por case_id.
  const caseIds = Array.from(
    new Set(rows.map((r) => r.case_id).filter((id): id is string => !!id)),
  )

  if (caseIds.length > 0) {
    const [casesRes, docsRes] = await Promise.all([
      service
        .from('cases')
        .select('id, current_phase, intake_status')
        .in('id', caseIds),
      service
        .from('documents')
        .select('case_id, name')
        .eq('direction', 'client_to_admin')
        .in('case_id', caseIds),
    ])

    if (casesRes.error) {
      console.error('[contracts/export] cases query error:', casesRes.error)
    }
    if (docsRes.error) {
      console.error('[contracts/export] documents query error:', docsRes.error)
    }

    type CaseRow = {
      id: string
      current_phase: CasePhase | null
      intake_status: string | null
    }
    type DocRow = { case_id: string | null; name: string | null }

    const phaseByCase = new Map<string, CasePhase | null>()
    for (const c of (casesRes.data ?? []) as CaseRow[]) {
      phaseByCase.set(c.id, c.current_phase)
    }

    const docsByCase = new Map<string, string[]>()
    for (const d of (docsRes.data ?? []) as DocRow[]) {
      if (!d.case_id) continue
      const name = (d.name ?? '').trim()
      if (!name) continue
      const list = docsByCase.get(d.case_id)
      if (list) list.push(name)
      else docsByCase.set(d.case_id, [name])
    }

    for (const row of rows) {
      if (!row.case_id) {
        row.case_phase_label = 'Sin caso'
        row.client_doc_count = 0
        row.client_doc_names = ''
        continue
      }
      const phase = phaseByCase.get(row.case_id)
      row.case_phase_label = resolvePhaseLabel(phase)
      const names = docsByCase.get(row.case_id) ?? []
      row.client_doc_count = names.length
      row.client_doc_names = names.join(', ')
    }
  } else {
    for (const row of rows) {
      row.case_phase_label = 'Sin caso'
      row.client_doc_count = 0
      row.client_doc_names = ''
    }
  }

  let buffer: Buffer
  try {
    buffer = await buildContractsWorkbook(rows)
  } catch (err) {
    console.error('[contracts/export] xlsx build error:', err)
    return NextResponse.json(
      { error: 'Error al generar el archivo Excel' },
      { status: 500 },
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  const filename = `contratos-${today}.xlsx`

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
      'Content-Length': String(buffer.byteLength),
    },
  })
}
