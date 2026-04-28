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

interface TimeBlockInput {
  start_hour: number
  end_hour: number
}

interface AvailabilityRowInput {
  day_of_week: number
  is_available: boolean
  // Múltiples bloques (ej. 9-12 + 15-18). Si está vacío y is_available=true,
  // se usa el rango legacy start_hour/end_hour como un solo bloque.
  time_blocks?: TimeBlockInput[]
  start_hour?: number
  end_hour?: number
}

function validateBlock(b: TimeBlockInput): string | null {
  if (b.start_hour < 0 || b.start_hour > 23) return 'start_hour fuera de rango'
  if (b.end_hour < 1 || b.end_hour > 24) return 'end_hour fuera de rango'
  if (b.end_hour <= b.start_hour) return 'end_hour debe ser mayor a start_hour'
  return null
}

function blocksOverlap(blocks: TimeBlockInput[]): boolean {
  const sorted = [...blocks].sort((a, b) => a.start_hour - b.start_hour)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start_hour < sorted[i - 1].end_hour) return true
  }
  return false
}

export async function PUT(request: NextRequest) {
  const ctx = await ensureSeniorConsultantOrAdmin()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { availability } = await request.json() as { availability: AvailabilityRowInput[] }

  if (!Array.isArray(availability)) {
    return NextResponse.json({ error: 'availability debe ser array' }, { status: 400 })
  }

  // Validación + normalización a time_blocks
  for (const row of availability) {
    if (row.day_of_week < 0 || row.day_of_week > 6) {
      return NextResponse.json({ error: `day_of_week inválido: ${row.day_of_week}` }, { status: 400 })
    }
    if (!row.is_available) continue

    // Si vienen time_blocks, validamos cada uno y que no se solapen
    const blocks: TimeBlockInput[] = (row.time_blocks && row.time_blocks.length > 0)
      ? row.time_blocks
      : (row.start_hour != null && row.end_hour != null
          ? [{ start_hour: row.start_hour, end_hour: row.end_hour }]
          : [])

    if (blocks.length === 0) {
      return NextResponse.json({ error: `día ${row.day_of_week}: agrega al menos un bloque o desmárcalo` }, { status: 400 })
    }

    for (const b of blocks) {
      const err = validateBlock(b)
      if (err) return NextResponse.json({ error: `día ${row.day_of_week}: ${err}` }, { status: 400 })
    }

    if (blocksOverlap(blocks)) {
      return NextResponse.json({ error: `día ${row.day_of_week}: los bloques no pueden solaparse` }, { status: 400 })
    }
  }

  // Borrar y reinsertar (simplicidad; max 7 filas)
  await ctx.service.from('consultant_availability').delete().eq('consultant_id', ctx.userId)

  const rows = availability
    .filter(r => r.is_available)
    .map(r => {
      const blocks: TimeBlockInput[] = (r.time_blocks && r.time_blocks.length > 0)
        ? r.time_blocks.slice().sort((a, b) => a.start_hour - b.start_hour)
        : [{ start_hour: r.start_hour ?? 9, end_hour: r.end_hour ?? 18 }]
      const first = blocks[0]
      const last = blocks[blocks.length - 1]
      return {
        consultant_id: ctx.userId,
        day_of_week: r.day_of_week,
        // Mantenemos start_hour/end_hour como envoltura del rango total
        // (legacy + para queries simples). La fuente de verdad es time_blocks.
        start_hour: first.start_hour,
        end_hour: last.end_hour,
        time_blocks: blocks,
        is_available: true,
      }
    })

  if (rows.length > 0) {
    const { error } = await ctx.service.from('consultant_availability').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
