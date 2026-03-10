import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getAvailableSlots } from '@/lib/appointments/slots'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'employee')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const date = request.nextUrl.searchParams.get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Fecha requerida (YYYY-MM-DD)' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: blocked } = await service
    .from('blocked_dates')
    .select('id')
    .eq('blocked_date', date)
    .single()

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
