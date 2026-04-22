import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

async function ensureSeniorConsultantOrAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, employee_type')
    .eq('id', user.id)
    .single()

  const ok = profile?.role === 'admin' ||
    (profile?.role === 'employee' && profile?.employee_type === 'senior_consultant')
  if (!ok) return null

  return { service: createServiceClient(), userId: user.id }
}

export async function GET(_request: NextRequest) {
  const ctx = await ensureSeniorConsultantOrAdmin()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const [availabilityRes, blocksRes] = await Promise.all([
    ctx.service
      .from('consultant_availability')
      .select('*')
      .eq('consultant_id', ctx.userId)
      .order('day_of_week'),
    ctx.service
      .from('consultant_blocks')
      .select('*')
      .eq('consultant_id', ctx.userId)
      .gte('blocked_at_end', new Date().toISOString())
      .order('blocked_at_start'),
  ])

  return NextResponse.json({
    availability: availabilityRes.data || [],
    blocks: blocksRes.data || [],
  })
}

export async function PUT(request: NextRequest) {
  const ctx = await ensureSeniorConsultantOrAdmin()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { availability } = await request.json() as {
    availability: Array<{
      day_of_week: number
      start_hour: number
      end_hour: number
      is_available: boolean
    }>
  }

  if (!Array.isArray(availability)) {
    return NextResponse.json({ error: 'availability debe ser array' }, { status: 400 })
  }

  // Validación
  for (const row of availability) {
    if (row.day_of_week < 0 || row.day_of_week > 6) {
      return NextResponse.json({ error: 'day_of_week inválido' }, { status: 400 })
    }
    if (row.start_hour < 0 || row.start_hour > 23 || row.end_hour < 1 || row.end_hour > 24) {
      return NextResponse.json({ error: 'hora fuera de rango' }, { status: 400 })
    }
    if (row.end_hour <= row.start_hour) {
      return NextResponse.json({ error: 'end_hour debe ser mayor a start_hour' }, { status: 400 })
    }
  }

  // Borrar y reinsertar (simplicidad; no hay mucho volumen — 7 filas max)
  await ctx.service.from('consultant_availability').delete().eq('consultant_id', ctx.userId)

  const rows = availability
    .filter(r => r.is_available !== false)
    .map(r => ({
      consultant_id: ctx.userId,
      day_of_week: r.day_of_week,
      start_hour: r.start_hour,
      end_hour: r.end_hour,
      is_available: true,
    }))

  if (rows.length > 0) {
    const { error } = await ctx.service.from('consultant_availability').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
