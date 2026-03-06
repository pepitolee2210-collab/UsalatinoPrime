import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
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

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const [configRes, settingsRes] = await Promise.all([
    supabase.from('scheduling_config').select('*').order('day_of_week'),
    supabase.from('scheduling_settings').select('*').single(),
  ])

  return NextResponse.json({
    config: configRes.data || [],
    settings: settingsRes.data || null,
  })
}

export async function PUT(request: NextRequest) {
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

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { config, settings } = await request.json()

  // Actualizar config de horarios por día
  if (config && Array.isArray(config)) {
    for (const day of config) {
      const blocks = day.time_blocks || []
      await supabase
        .from('scheduling_config')
        .update({
          start_hour: blocks.length > 0 ? blocks[0].start_hour : day.start_hour,
          end_hour: blocks.length > 0 ? blocks[blocks.length - 1].end_hour : day.end_hour,
          is_available: day.is_available,
          time_blocks: blocks,
        })
        .eq('day_of_week', day.day_of_week)
    }
  }

  // Actualizar settings globales
  if (settings) {
    await supabase
      .from('scheduling_settings')
      .update({
        zoom_link: settings.zoom_link,
        slot_duration_minutes: settings.slot_duration_minutes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', settings.id)
  }

  return NextResponse.json({ success: true })
}
