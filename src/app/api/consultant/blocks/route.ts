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

export async function POST(request: NextRequest) {
  const ctx = await ensureSeniorConsultantOrAdmin()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { blocked_at_start, blocked_at_end, reason } = await request.json()

  if (!blocked_at_start || !blocked_at_end) {
    return NextResponse.json({ error: 'Fechas requeridas' }, { status: 400 })
  }
  if (new Date(blocked_at_end) <= new Date(blocked_at_start)) {
    return NextResponse.json({ error: 'Rango inválido' }, { status: 400 })
  }

  const { data, error } = await ctx.service
    .from('consultant_blocks')
    .insert({
      consultant_id: ctx.userId,
      blocked_at_start,
      blocked_at_end,
      reason: reason || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ block: data })
}

export async function DELETE(request: NextRequest) {
  const ctx = await ensureSeniorConsultantOrAdmin()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const { error } = await ctx.service
    .from('consultant_blocks')
    .delete()
    .eq('id', id)
    .eq('consultant_id', ctx.userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
