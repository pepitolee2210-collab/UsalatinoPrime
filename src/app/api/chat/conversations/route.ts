import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * GET /api/chat/conversations
 * Lista las conversaciones donde participa el usuario actual.
 * Para cada una incluye: último mensaje, unread count, otros participantes.
 */
export async function GET() {
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

  const service = createServiceClient()

  // 1. Conversaciones donde participo
  const { data: myParts } = await service
    .from('conversation_participants')
    .select('conversation_id, last_read_at')
    .eq('user_id', user.id)

  const convIds = (myParts || []).map((p) => p.conversation_id)
  if (convIds.length === 0) {
    return NextResponse.json({ conversations: [] })
  }

  // 2. Datos de las conversaciones, ordenadas por último mensaje
  const { data: conversations } = await service
    .from('conversations')
    .select('id, type, name, created_at, last_message_at')
    .in('id', convIds)
    .order('last_message_at', { ascending: false })

  // 3. Todos los participantes de esas convs (para nombres en DMs)
  const { data: allParts } = await service
    .from('conversation_participants')
    .select('conversation_id, user_id, profile:profiles!conversation_participants_user_id_fkey(id, first_name, last_name, email, employee_type, role)')
    .in('conversation_id', convIds)

  // 4. Último mensaje de cada conv
  const { data: lastMessages } = await service
    .from('messages')
    .select('id, conversation_id, body, attachment_type, attachment_name, created_at, sender_id')
    .in('conversation_id', convIds)
    .order('created_at', { ascending: false })

  // 5. Unread count por conv (mensajes posteriores a mi last_read_at, no enviados por mí)
  const lastReadMap = new Map<string, string | null>()
  for (const p of myParts || []) {
    lastReadMap.set(p.conversation_id, p.last_read_at)
  }

  const result = (conversations || []).map((c) => {
    const partsOfConv = (allParts || []).filter((p) => p.conversation_id === c.id)
    const others = partsOfConv
      .filter((p) => p.user_id !== user.id)
      .map((p) => {
        const prof = Array.isArray(p.profile) ? p.profile[0] : p.profile
        return prof
      })
      .filter(Boolean)

    const lastMsg = (lastMessages || []).find((m) => m.conversation_id === c.id) || null

    const myLastRead = lastReadMap.get(c.id)
    const unreadCount = (lastMessages || []).filter((m) =>
      m.conversation_id === c.id &&
      m.sender_id !== user.id &&
      (!myLastRead || m.created_at > myLastRead)
    ).length

    return {
      id: c.id,
      type: c.type,
      name: c.name,
      last_message_at: c.last_message_at,
      participants: others,
      last_message: lastMsg
        ? {
            id: lastMsg.id,
            body: lastMsg.body,
            attachment_type: lastMsg.attachment_type,
            attachment_name: lastMsg.attachment_name,
            created_at: lastMsg.created_at,
            sender_id: lastMsg.sender_id,
          }
        : null,
      unread_count: unreadCount,
    }
  })

  return NextResponse.json({ conversations: result })
}
