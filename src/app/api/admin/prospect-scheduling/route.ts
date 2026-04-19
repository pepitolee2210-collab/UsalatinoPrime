import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

async function ensureAdminOrEmployee() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin' && profile?.role !== 'employee') return null
  return createServiceClient()
}

interface TimeBlock { start_hour: number; end_hour: number }

export async function GET() {
  const service = await ensureAdminOrEmployee()
  if (!service) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const [configRes, settingsRes, blockedRes] = await Promise.all([
    service.from('prospect_scheduling_config').select('*').order('day_of_week'),
    service.from('prospect_scheduling_settings').select('*').maybeSingle(),
    service.from('prospect_blocked_dates').select('*').order('blocked_date'),
  ])

  return NextResponse.json({
    config: configRes.data || [],
    settings: settingsRes.data || { slot_duration_minutes: 30, advance_notice_hours: 2 },
    blockedDates: blockedRes.data || [],
  })
}

export async function PUT(request: NextRequest) {
  const service = await ensureAdminOrEmployee()
  if (!service) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await request.json()
  const {
    day_of_week,
    time_blocks,
    is_available,
    slot_duration_minutes,
    advance_notice_hours,
  } = body as {
    day_of_week?: number
    time_blocks?: TimeBlock[]
    is_available?: boolean
    slot_duration_minutes?: number
    advance_notice_hours?: number
  }

  // Updating a single day's config
  if (typeof day_of_week === 'number' && (time_blocks || typeof is_available === 'boolean')) {
    const update: Record<string, unknown> = {}
    if (time_blocks) update.time_blocks = time_blocks
    if (typeof is_available === 'boolean') update.is_available = is_available

    const { error } = await service
      .from('prospect_scheduling_config')
      .update(update)
      .eq('day_of_week', day_of_week)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // Updating global settings
  if (typeof slot_duration_minutes === 'number' || typeof advance_notice_hours === 'number') {
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof slot_duration_minutes === 'number') update.slot_duration_minutes = slot_duration_minutes
    if (typeof advance_notice_hours === 'number') update.advance_notice_hours = advance_notice_hours

    const { data: current } = await service
      .from('prospect_scheduling_settings')
      .select('id')
      .maybeSingle()

    if (current) {
      const { error } = await service
        .from('prospect_scheduling_settings')
        .update(update)
        .eq('id', current.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await service.from('prospect_scheduling_settings').insert(update)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
}

export async function POST(request: NextRequest) {
  // Block/unblock a date
  const service = await ensureAdminOrEmployee()
  if (!service) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { action, date, reason } = await request.json()
  if (!date) return NextResponse.json({ error: 'date requerido' }, { status: 400 })

  if (action === 'block') {
    const { error } = await service
      .from('prospect_blocked_dates')
      .insert({ blocked_date: date, reason: reason || null })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (action === 'unblock') {
    const { error } = await service
      .from('prospect_blocked_dates')
      .delete()
      .eq('blocked_date', date)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'action inválida' }, { status: 400 })
}
