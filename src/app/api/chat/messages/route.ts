import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

interface MentionItem {
  type: 'client' | 'case'
  id: string
  label: string
}

interface SendMessagePayload {
  conversation_id: string
  body?: string
  attachment_url?: string
  attachment_type?: 'image' | 'document'
  attachment_name?: string
  attachment_size?: number
  mentions?: MentionItem[]
}

/**
 * POST /api/chat/messages
 * Envía un mensaje. Verifica que el sender sea participante.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const payload = (await req.json()) as SendMessagePayload
  if (!payload.conversation_id) {
    return NextResponse.json({ error: 'conversation_id es requerido' }, { status: 400 })
  }

  const hasText = (payload.body || '').trim().length > 0
  const hasAttachment = !!payload.attachment_url
  if (!hasText && !hasAttachment) {
    return NextResponse.json({ error: 'El mensaje no puede estar vacío' }, { status: 400 })
  }

  const service = createServiceClient()

  // Verifico membresía con service para evitar problemas de RLS recursivo
  const { data: membership } = await service
    .from('conversation_participants')
    .select('conversation_id')
    .eq('conversation_id', payload.conversation_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // Sanity check de mentions: máximo 10, types válidos
  const cleanMentions: MentionItem[] = (payload.mentions || [])
    .slice(0, 10)
    .filter(
      (m) =>
        (m.type === 'client' || m.type === 'case') &&
        typeof m.id === 'string' &&
        typeof m.label === 'string'
    )

  const { data, error } = await service
    .from('messages')
    .insert({
      conversation_id: payload.conversation_id,
      sender_id: user.id,
      body: payload.body || null,
      attachment_url: payload.attachment_url || null,
      attachment_type: payload.attachment_type || null,
      attachment_name: payload.attachment_name || null,
      attachment_size: payload.attachment_size || null,
      mentions: cleanMentions,
    })
    .select('id, conversation_id, sender_id, body, attachment_url, attachment_type, attachment_name, attachment_size, mentions, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: data })
}
