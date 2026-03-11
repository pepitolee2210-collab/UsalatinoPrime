import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: NextRequest) {
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

  const { case_id } = await request.json()

  if (!case_id) {
    return Response.json({ error: 'case_id requerido' }, { status: 400 })
  }

  const { error } = await service
    .from('case_chat_messages')
    .delete()
    .eq('case_id', case_id)

  if (error) {
    return Response.json({ error: 'Error al limpiar chat' }, { status: 500 })
  }

  return Response.json({ success: true })
}
