import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Sidebar counts for the employee panel.
 * Devuelve:
 *  - whatsappActive: solo para senior_consultant (Vanessa)
 *  - chatUnread:     mensajes no leídos en el chat interno, para todos los staff
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, employee_type')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.role !== 'employee') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const service = createServiceClient()

  // WhatsApp activos (solo Vanessa)
  let whatsappActive = 0
  if (profile.employee_type === 'senior_consultant') {
    const { count } = await service
      .from('whatsapp_conversations')
      .select('*', { count: 'exact', head: true })
      .in('status', ['active', 'filtered_in'])
    whatsappActive = count || 0
  }

  // Chat interno unread: contar mensajes de mis conversaciones posteriores
  // a mi last_read_at y no enviados por mí.
  let chatUnread = 0
  const { data: myParts } = await service
    .from('conversation_participants')
    .select('conversation_id, last_read_at')
    .eq('user_id', user.id)

  if (myParts && myParts.length > 0) {
    // Para cada conversación, contar mensajes no leídos
    const promises = myParts.map(async (p) => {
      const q = service
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', p.conversation_id)
        .neq('sender_id', user.id)
      if (p.last_read_at) q.gt('created_at', p.last_read_at)
      const { count } = await q
      return count || 0
    })
    const counts = await Promise.all(promises)
    chatUnread = counts.reduce((s, c) => s + c, 0)
  }

  return NextResponse.json({ whatsappActive, chatUnread })
}
