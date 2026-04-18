import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  // Auth: admin or employee only
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.role !== 'employee') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const days = Math.min(
    Math.max(parseInt(request.nextUrl.searchParams.get('days') || '14', 10), 1),
    90,
  )
  const since = new Date(Date.now() - days * 86400_000).toISOString()

  const service = createServiceClient()

  const { data: calls } = await service
    .from('voice_calls')
    .select(`
      id, started_at, ended_at, duration_seconds, ip_address, user_agent,
      end_reason, error_message, tools_invoked,
      lead_id, appointment_id
    `)
    .gte('started_at', since)
    .order('started_at', { ascending: false })
    .limit(200)

  const leadIds = Array.from(new Set((calls || []).map(c => c.lead_id).filter(Boolean))) as string[]
  const aptIds = Array.from(new Set((calls || []).map(c => c.appointment_id).filter(Boolean))) as string[]

  const [{ data: leads }, { data: appointments }] = await Promise.all([
    leadIds.length
      ? service.from('callback_requests').select('id, prospect_name, phone, status').in('id', leadIds)
      : Promise.resolve({ data: [] }),
    aptIds.length
      ? service.from('appointments').select('id, scheduled_at, guest_name, guest_phone, status').in('id', aptIds)
      : Promise.resolve({ data: [] }),
  ])

  const leadMap = new Map((leads || []).map(l => [l.id, l]))
  const aptMap = new Map((appointments || []).map(a => [a.id, a]))

  const enriched = (calls || []).map(c => ({
    ...c,
    lead: c.lead_id ? leadMap.get(c.lead_id) ?? null : null,
    appointment: c.appointment_id ? aptMap.get(c.appointment_id) ?? null : null,
  }))

  // Stats over the window
  const total = enriched.length
  const withLead = enriched.filter(c => c.lead_id).length
  const withAppointment = enriched.filter(c => c.appointment_id).length
  const withError = enriched.filter(c => c.end_reason === 'error' || c.end_reason === 'server-close').length
  const completed = enriched.filter(c => c.duration_seconds && c.duration_seconds > 0)
  const avgDuration = completed.length
    ? Math.round(completed.reduce((s, c) => s + (c.duration_seconds || 0), 0) / completed.length)
    : 0
  const conversionRate = total > 0 ? Math.round((withAppointment / total) * 100) : 0
  const leadRate = total > 0 ? Math.round((withLead / total) * 100) : 0

  return NextResponse.json({
    stats: {
      total,
      withLead,
      withAppointment,
      withError,
      avgDurationSeconds: avgDuration,
      conversionRate,
      leadRate,
      windowDays: days,
    },
    calls: enriched,
  })
}
