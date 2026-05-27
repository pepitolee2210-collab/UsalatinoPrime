import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  buildContractsWorkbook,
  type ContractExportRow,
} from '@/lib/exports/contracts-to-xlsx'

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
