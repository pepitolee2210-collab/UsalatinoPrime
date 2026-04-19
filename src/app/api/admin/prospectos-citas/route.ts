import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const MAX_ROWS = 500

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

export async function GET(_request: NextRequest) {
  const service = await ensureAdminOrEmployee()
  if (!service) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  // Pull voice-agent-booked appointments together with their voice_call record
  // (duration, tools invoked, end reason) so the admin has full context.
  const { data: appointments, count } = await service
    .from('appointments')
    .select(
      `id, scheduled_at, duration_minutes, status, notes,
       guest_name, guest_phone, source, created_at, updated_at,
       voice_call:voice_calls!appointment_id(id, duration_seconds, end_reason, tools_invoked, started_at)`,
      { count: 'exact' },
    )
    .eq('source', 'voice-agent')
    .order('scheduled_at', { ascending: false })
    .limit(MAX_ROWS)

  const items = (appointments || []).map(a => {
    const vcRaw = a.voice_call
    const vc = Array.isArray(vcRaw) ? vcRaw[0] : vcRaw
    return {
      id: a.id as string,
      scheduled_at: a.scheduled_at as string,
      duration_minutes: a.duration_minutes as number | null,
      status: a.status as 'scheduled' | 'completed' | 'cancelled' | 'no_show',
      notes: a.notes as string | null,
      guest_name: a.guest_name as string | null,
      guest_phone: a.guest_phone as string | null,
      created_at: a.created_at as string,
      voice_call: vc
        ? {
            id: (vc as Record<string, unknown>).id as string,
            duration_seconds: (vc as Record<string, unknown>).duration_seconds as number | null,
            end_reason: (vc as Record<string, unknown>).end_reason as string | null,
            tools_invoked: (vc as Record<string, unknown>).tools_invoked as unknown[] | null,
            started_at: (vc as Record<string, unknown>).started_at as string,
          }
        : null,
    }
  })

  return NextResponse.json({
    items,
    total: count ?? items.length,
    truncated: (count ?? 0) > items.length,
  })
}

export async function PATCH(request: NextRequest) {
  const service = await ensureAdminOrEmployee()
  if (!service) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id, status } = await request.json()
  if (!id || !status) {
    return NextResponse.json({ error: 'id y status requeridos' }, { status: 400 })
  }
  const VALID = ['scheduled', 'completed', 'cancelled', 'no_show'] as const
  if (!VALID.includes(status)) {
    return NextResponse.json({ error: 'status inválido' }, { status: 400 })
  }

  const { error } = await service
    .from('appointments')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('source', 'voice-agent') // safety: only update voice-agent rows

  if (error) {
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
