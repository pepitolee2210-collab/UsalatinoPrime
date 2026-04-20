import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  // The /admin/citas view excludes voice-agent bookings, so the dashboard
  // counter here does the same — leads show up in `prospectosPending` instead.
  const [citasRes, visaRes, asiloRes, ajusteRes, renunciaRes, cambioRes, agendaRes, prospectosRes, whatsappRes] = await Promise.all([
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'scheduled')
      .gte('scheduled_at', todayStart.toISOString())
      .lte('scheduled_at', todayEnd.toISOString())
      .or('source.is.null,source.neq.voice-agent'),
    supabase
      .from('visa_juvenil_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('asilo_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('ajuste_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('renuncia_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'nuevo'),
    supabase
      .from('cambio_corte_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'nuevo'),
    supabase
      .from('callback_requests')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'follow_up']),
    // Upcoming voice-agent prospects — today and forward, still scheduled.
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('source', 'voice-agent')
      .eq('status', 'scheduled')
      .gte('scheduled_at', todayStart.toISOString()),
    // Active WhatsApp SIJS conversations (still in the filter, not yet closed).
    supabase
      .from('whatsapp_conversations')
      .select('*', { count: 'exact', head: true })
      .in('status', ['active', 'filtered_in']),
  ])

  const formsPending = (visaRes.count || 0) + (asiloRes.count || 0) + (ajusteRes.count || 0) + (renunciaRes.count || 0) + (cambioRes.count || 0)

  return NextResponse.json({
    citasToday: citasRes.count || 0,
    formsPending,
    agendaPending: agendaRes.count || 0,
    prospectosPending: prospectosRes.count || 0,
    whatsappActive: whatsappRes.count || 0,
  })
}
