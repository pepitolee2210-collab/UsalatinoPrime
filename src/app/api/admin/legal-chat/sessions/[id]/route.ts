import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

async function ensureAdminOrEmployee() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { service: null as ReturnType<typeof createServiceClient> | null, userId: null }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin' && profile?.role !== 'employee') {
    return { service: null, userId: null }
  }
  return { service: createServiceClient(), userId: user.id }
}

/**
 * GET /api/admin/legal-chat/sessions/:id → fetch session + all messages
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { service } = await ensureAdminOrEmployee()
  if (!service) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const [sessionRes, messagesRes] = await Promise.all([
    service.from('legal_chat_sessions').select('*').eq('id', id).maybeSingle(),
    service
      .from('legal_chat_messages')
      .select('id, role, content, attachments, created_at')
      .eq('session_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (!sessionRes.data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  return NextResponse.json({
    session: sessionRes.data,
    messages: messagesRes.data || [],
  })
}

/**
 * DELETE /api/admin/legal-chat/sessions/:id → soft-archive a session
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { service, userId } = await ensureAdminOrEmployee()
  if (!service || !userId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  // Only archive — preserves audit trail
  const { error } = await service
    .from('legal_chat_sessions')
    .update({ archived: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('created_by', userId) // user can only archive their own

  if (error) return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  return NextResponse.json({ success: true })
}

/**
 * PATCH /api/admin/legal-chat/sessions/:id → rename
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { service, userId } = await ensureAdminOrEmployee()
  if (!service || !userId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await request.json()
  const title = String(body.title || '').trim().slice(0, 200)
  if (!title) return NextResponse.json({ error: 'Título requerido' }, { status: 400 })

  const { error } = await service
    .from('legal_chat_sessions')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('created_by', userId)

  if (error) return NextResponse.json({ error: 'Error al renombrar' }, { status: 500 })
  return NextResponse.json({ success: true })
}
