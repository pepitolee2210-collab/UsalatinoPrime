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
  return { service: createServiceClient(), userId: user.id, role: profile.role as 'admin' | 'employee' }
}

export async function GET(_request: NextRequest) {
  const ctx = await ensureAdminOrEmployee()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { service } = ctx

  const { data: appointments, count } = await service
    .from('appointments')
    .select(
      `id, scheduled_at, duration_minutes, status, notes,
       guest_name, guest_phone, source, created_at, updated_at,
       captured_data, probability, consultant_id, consultant_notes,
       client_decision, call_status,
       voice_call:voice_calls!appointment_id(id, duration_seconds, end_reason, tools_invoked, started_at)`,
      { count: 'exact' },
    )
    .eq('source', 'voice-agent')
    .order('scheduled_at', { ascending: false })
    .limit(MAX_ROWS)

  const items = (appointments || []).map(a => {
    const vcRaw = (a as Record<string, unknown>).voice_call
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
      captured_data: (a as Record<string, unknown>).captured_data as Record<string, unknown> | null,
      probability: (a as Record<string, unknown>).probability as 'alta' | 'media' | 'baja' | null,
      consultant_id: (a as Record<string, unknown>).consultant_id as string | null,
      consultant_notes: (a as Record<string, unknown>).consultant_notes as string | null,
      client_decision: (a as Record<string, unknown>).client_decision as string | null,
      call_status: (a as Record<string, unknown>).call_status as string | null,
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

const VALID_STATUS = ['scheduled', 'completed', 'cancelled', 'no_show'] as const
const VALID_CALL_STATUS = ['llamada_ahora', 'programada', 'en_curso', 'completada', 'no_procede', 'no_contesta'] as const
const VALID_PROBABILITY = ['alta', 'media', 'baja'] as const
const VALID_DECISION = ['acepta', 'rechaza', 'lo_pensara', 'no_procede'] as const

export async function PATCH(request: NextRequest) {
  const ctx = await ensureAdminOrEmployee()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { service, userId } = ctx

  const body = await request.json()
  const { id } = body
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  // Whitelist de campos actualizables
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.status !== undefined) {
    if (!VALID_STATUS.includes(body.status)) {
      return NextResponse.json({ error: 'status inválido' }, { status: 400 })
    }
    patch.status = body.status
  }
  if (body.call_status !== undefined) {
    if (body.call_status !== null && !VALID_CALL_STATUS.includes(body.call_status)) {
      return NextResponse.json({ error: 'call_status inválido' }, { status: 400 })
    }
    patch.call_status = body.call_status
    // Auto-asignar consultant_id la primera vez que pasa a 'en_curso'
    if (body.call_status === 'en_curso') patch.consultant_id = userId
  }
  if (body.probability !== undefined) {
    if (body.probability !== null && !VALID_PROBABILITY.includes(body.probability)) {
      return NextResponse.json({ error: 'probability inválido' }, { status: 400 })
    }
    patch.probability = body.probability
  }
  if (body.client_decision !== undefined) {
    if (body.client_decision !== null && !VALID_DECISION.includes(body.client_decision)) {
      return NextResponse.json({ error: 'client_decision inválido' }, { status: 400 })
    }
    patch.client_decision = body.client_decision
  }
  if (body.consultant_notes !== undefined) {
    patch.consultant_notes = body.consultant_notes
  }
  if (body.captured_data !== undefined) {
    patch.captured_data = body.captured_data
  }

  const { error } = await service
    .from('appointments')
    .update(patch)
    .eq('id', id)
    .eq('source', 'voice-agent')

  if (error) {
    return NextResponse.json({ error: 'Error al actualizar', details: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
