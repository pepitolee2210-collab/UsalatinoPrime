// GET /api/admin/cases/[id]/appointments-lite
// Devuelve un listado compacto de citas del caso para selects/UI auxiliar
// (ej. dropdown del modal de notas para asociar una nota a una cita).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: caseId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin' && profile?.role !== 'employee') {
    return NextResponse.json({ error: 'Solo staff' }, { status: 403 })
  }

  const { data: rows } = await service
    .from('appointments')
    .select('id, scheduled_at, session_number, status')
    .eq('case_id', caseId)
    .order('scheduled_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ items: rows ?? [] })
}
