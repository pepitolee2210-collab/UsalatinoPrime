import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getContractTemplate } from '@/lib/contracts'

/**
 * POST /api/voice-agent/contracts/create
 *
 * Crea un contrato completo end-to-end desde la voz de Lex (asistiendo a
 * Vanessa). Acepta el subset mínimo de datos que Vanessa puede dictar por
 * voz; el resto se rellena con defaults sensatos del template del servicio.
 *
 * Body:
 *   client_full_name  string  required — "María Pérez"
 *   client_phone      string  required — "+1 555 0000"
 *   service_slug      string  required — slug de service_catalog
 *   total_price       number  optional — usa precio default del template
 *   installment_count number  optional — default 1 (pago único)
 *   client_passport   string  optional
 *   client_dob        string  optional (YYYY-MM-DD)
 *   minors            array   optional [{fullName, dob, passport, birthplace}]
 *
 * Después de insertar el contrato, llama al endpoint register-client
 * existente para crear el case asociado (mismo flujo que el form admin).
 *
 * Returns: { contract_id, case_number?, status:'borrador' }
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

  const body = await req.json()
  const {
    client_full_name,
    client_phone,
    service_slug,
    total_price,
    installment_count,
    client_passport,
    client_dob,
    minors,
  } = body as {
    client_full_name?: string
    client_phone?: string
    service_slug?: string
    total_price?: number
    installment_count?: number
    client_passport?: string
    client_dob?: string
    minors?: Array<{ fullName: string; dob?: string; passport?: string; birthplace?: string }>
  }

  // Validaciones mínimas
  if (!client_full_name?.trim()) {
    return NextResponse.json({ error: 'client_full_name requerido' }, { status: 400 })
  }
  if (!client_phone?.trim()) {
    return NextResponse.json({ error: 'client_phone requerido' }, { status: 400 })
  }
  if (!service_slug?.trim()) {
    return NextResponse.json({ error: 'service_slug requerido' }, { status: 400 })
  }

  const template = getContractTemplate(service_slug)
  if (!template) {
    return NextResponse.json(
      { error: `service_slug "${service_slug}" no existe en el catálogo` },
      { status: 400 },
    )
  }

  // Defaults del template
  const defaultVariant = template.variants[0]
  const finalPrice = total_price ?? defaultVariant.totalPrice
  const finalInstallments = installment_count ?? defaultVariant.installmentCount ?? 1
  const monthlyAmount =
    finalInstallments > 1 ? Math.round(finalPrice / finalInstallments) : finalPrice
  const hasInstallments = finalInstallments > 1
  const today = new Date().toISOString().slice(0, 10)

  // Filtrar minors válidos (solo cuando el servicio los requiere)
  const requiresMinor = template.requiresMinor
  const validMinors = requiresMinor && minors
    ? minors.filter((m) => m.fullName?.trim()).map((m) => ({
        fullName: m.fullName.trim(),
        dob: m.dob || '',
        passport: m.passport || '',
        birthplace: m.birthplace || '',
      }))
    : []

  // Construir payment_schedule básico (pago único o cuotas mensuales)
  const paymentSchedule = hasInstallments
    ? Array.from({ length: finalInstallments }).map((_, i) => {
        const d = new Date()
        d.setMonth(d.getMonth() + i)
        return {
          due_date: d.toISOString().slice(0, 10),
          amount: monthlyAmount,
          paid: false,
        }
      })
    : []

  const contractData = {
    service_slug,
    service_name: service_slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' '),
    subservice_slug: null,
    variant_index: 0,
    addon_services: [],
    client_full_name: client_full_name.trim(),
    client_passport: client_passport?.trim() || '',
    client_dob: client_dob || '',
    client_signature: '',
    client_phone: client_phone.trim(),
    client_address: '',
    client_address_unit: null,
    client_city: '',
    client_state: '',
    client_zip: '',
    minors: validMinors,
    spouse: null,
    asylum_family_type: null,
    total_price: finalPrice,
    initial_payment: 0,
    installment_count: finalInstallments,
    monthly_amount: monthlyAmount,
    use_custom_monthly: false,
    contract_start_date: today,
    has_installments: hasInstallments,
    use_custom_price: total_price !== undefined,
    use_custom_installments: installment_count !== undefined,
    payment_schedule: paymentSchedule,
    objeto_del_contrato: template.objetoDelContrato,
    etapas: template.etapas,
    status: 'borrador' as const,
  }

  const { data: inserted, error } = await service
    .from('contracts')
    .insert(contractData)
    .select('id')
    .single()

  if (error || !inserted) {
    console.error('[voice-agent/contracts/create] insert error:', error)
    return NextResponse.json(
      { error: `Error guardando contrato: ${error?.message ?? 'unknown'}` },
      { status: 500 },
    )
  }

  // Disparar register-client (case + auto-asignación) en background — no
  // bloquea la respuesta para que Lex confirme rápido a Vanessa.
  const origin = req.nextUrl.origin
  void fetch(`${origin}/api/contracts/register-client`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Reusamos las cookies del request original para que el endpoint
      // valide la sesión correctamente.
      cookie: req.headers.get('cookie') ?? '',
    },
    body: JSON.stringify({
      contract_id: inserted.id,
      client_full_name: client_full_name.trim(),
      client_passport: client_passport?.trim() || '',
      client_phone: client_phone.trim(),
      service_slug,
      subservice_slug: null,
      total_price: finalPrice,
    }),
  }).catch((err) => console.error('[voice-agent/contracts/create] register-client async error:', err))

  return NextResponse.json({
    contract_id: inserted.id,
    status: 'borrador',
    message: 'Contrato creado en estado borrador. Revisa los datos antes de enviar el link de firma.',
  })
}
