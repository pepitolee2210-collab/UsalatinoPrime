import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * POST /api/chat/conversations/dm
 * Body: { other_user_id }
 * Si ya existe una DM entre mí y other_user_id devuelve esa. Si no, la crea.
 * Idempotente — múltiples calls devuelven la misma conversación.
 */
export async function POST(req: Request) {
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

  const body = (await req.json()) as { other_user_id?: string }
  if (!body.other_user_id || body.other_user_id === user.id) {
    return NextResponse.json({ error: 'other_user_id inválido' }, { status: 400 })
  }

  const service = createServiceClient()

  // Verifico que el otro usuario sea staff (no permitir DM con clientes)
  const { data: otherProfile } = await service
    .from('profiles')
    .select('id, role, first_name, last_name')
    .eq('id', body.other_user_id)
    .single()

  if (!otherProfile || (otherProfile.role !== 'admin' && otherProfile.role !== 'employee')) {
    return NextResponse.json({ error: 'Usuario destino inválido' }, { status: 400 })
  }

  // ¿Ya existe una DM entre ambos? La encontramos buscando convs tipo 'dm'
  // donde ambos sean participantes.
  const { data: mine } = await service
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', user.id)

  const { data: theirs } = await service
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', body.other_user_id)

  const mineSet = new Set((mine || []).map((r) => r.conversation_id))
  const sharedConvIds = (theirs || [])
    .map((r) => r.conversation_id)
    .filter((id) => mineSet.has(id))

  if (sharedConvIds.length > 0) {
    const { data: existingDm } = await service
      .from('conversations')
      .select('id, type, name')
      .in('id', sharedConvIds)
      .eq('type', 'dm')
      .maybeSingle()

    if (existingDm) {
      return NextResponse.json({ conversation: existingDm, created: false })
    }
  }

  // No existe: crear nueva DM
  const { data: newConv, error: convErr } = await service
    .from('conversations')
    .insert({ type: 'dm', name: null, created_by: user.id })
    .select('id, type, name')
    .single()

  if (convErr || !newConv) {
    return NextResponse.json({ error: convErr?.message || 'Error creando conversación' }, { status: 500 })
  }

  const { error: partErr } = await service
    .from('conversation_participants')
    .insert([
      { conversation_id: newConv.id, user_id: user.id },
      { conversation_id: newConv.id, user_id: body.other_user_id },
    ])

  if (partErr) {
    // Rollback
    await service.from('conversations').delete().eq('id', newConv.id)
    return NextResponse.json({ error: partErr.message }, { status: 500 })
  }

  return NextResponse.json({ conversation: newConv, created: true })
}
