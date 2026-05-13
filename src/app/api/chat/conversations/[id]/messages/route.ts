import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * GET /api/chat/conversations/[id]/messages?before=<iso>&limit=50
 * Devuelve los mensajes de una conversación. Ordenados ASC para render.
 * Soporta paginación hacia atrás con ?before=<created_at iso>.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await ctx.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // ¿Soy participante?
  const service = createServiceClient()
  const { data: membership } = await service
    .from('conversation_participants')
    .select('conversation_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const url = new URL(req.url)
  const before = url.searchParams.get('before')
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100)

  let query = service
    .from('messages')
    .select('id, conversation_id, sender_id, body, attachment_url, attachment_type, attachment_name, attachment_size, mentions, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (before) query = query.lt('created_at', before)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Devolver en orden ASC para render directo en UI
  const messages = (data || []).reverse()

  // Cargar perfiles de los senders en este batch
  const senderIds = Array.from(new Set(messages.map((m) => m.sender_id))).filter(Boolean)
  const { data: senders } = senderIds.length > 0
    ? await service
        .from('profiles')
        .select('id, first_name, last_name, email, role, employee_type')
        .in('id', senderIds)
    : { data: [] }

  return NextResponse.json({
    messages,
    senders: senders || [],
    has_more: (data || []).length === limit,
  })
}
