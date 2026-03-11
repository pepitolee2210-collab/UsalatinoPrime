import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'employee')) {
    return Response.json({ error: 'No autorizado' }, { status: 403 })
  }

  const caseId = request.nextUrl.searchParams.get('case_id')
  if (!caseId) {
    return Response.json({ error: 'case_id requerido' }, { status: 400 })
  }

  const { data: messages, error } = await service
    .from('case_chat_messages')
    .select('id, role, content, metadata, created_at')
    .eq('case_id', caseId)
    .order('created_at', { ascending: true })

  if (error) {
    return Response.json({ error: 'Error al cargar historial' }, { status: 500 })
  }

  return Response.json({ messages: messages || [] })
}
