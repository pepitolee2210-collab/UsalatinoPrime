import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: NextRequest) {
  const { token, post_id, emoji } = await request.json()

  if (!token || !post_id || !emoji) {
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: tokenData } = await supabase
    .from('appointment_tokens')
    .select('client_id, is_active')
    .eq('token', token)
    .single()

  if (!tokenData || !tokenData.is_active) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  }

  const { data: existing } = await supabase
    .from('community_reactions')
    .select('id')
    .eq('post_id', post_id)
    .eq('user_id', tokenData.client_id)
    .eq('emoji', emoji)
    .single()

  if (existing) {
    const { error } = await supabase
      .from('community_reactions')
      .delete()
      .eq('id', existing.id)

    if (error) return NextResponse.json({ error: 'Error al eliminar reacción' }, { status: 500 })
    return NextResponse.json({ action: 'removed' })
  } else {
    const { error } = await supabase
      .from('community_reactions')
      .insert({ post_id, user_id: tokenData.client_id, emoji })

    if (error) return NextResponse.json({ error: 'Error al agregar reacción' }, { status: 500 })
    return NextResponse.json({ action: 'added' })
  }
}
