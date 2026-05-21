// GET /api/employee/appointments/available-slots?date=YYYY-MM-DD
//
// Mirror del endpoint admin, pero gate-abierto a senior_consultant y
// contracts_manager para que el formulario reusable de booking pueda
// listar slots desde el panel de empleado.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getAvailableSlots } from '@/lib/appointments/slots'

const ALLOWED_EMPLOYEE_TYPES = new Set(['senior_consultant', 'contracts_manager'])

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role, employee_type')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'
  const isAllowedEmployee =
    profile?.role === 'employee' &&
    profile.employee_type !== null &&
    ALLOWED_EMPLOYEE_TYPES.has(profile.employee_type as string)

  if (!isAdmin && !isAllowedEmployee) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const date = request.nextUrl.searchParams.get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Fecha requerida (YYYY-MM-DD)' }, { status: 400 })
  }

  const { data: blocked } = await service
    .from('blocked_dates')
    .select('id')
    .eq('blocked_date', date)
    .maybeSingle()

  if (blocked) {
    return NextResponse.json({ slots: [], blocked: true })
  }

  const [{ data: config }, { data: settings }, { data: existing }] = await Promise.all([
    service.from('scheduling_config').select('*'),
    service.from('scheduling_settings').select('*').single(),
    service
      .from('appointments')
      .select('id, scheduled_at, duration_minutes, status')
      .eq('status', 'scheduled')
      .gte('scheduled_at', `${date}T00:00:00Z`)
      .lte('scheduled_at', `${date}T23:59:59Z`),
  ])

  const slots = getAvailableSlots(
    date,
    config || [],
    (existing || []) as never[],
    settings?.slot_duration_minutes || 60,
  )

  return NextResponse.json({ slots })
}
