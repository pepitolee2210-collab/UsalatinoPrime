import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * GET /api/chat/staff
 * Lista a todos los staff (admin + employees activos) excepto el usuario actual.
 * Usado por la UI para crear DMs.
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
  const { data } = await service
    .from('profiles')
    .select('id, first_name, last_name, email, role, employee_type')
    .or('role.eq.admin,role.eq.employee')
    .neq('id', user.id)
    .order('first_name', { ascending: true })

  return NextResponse.json({ staff: data || [] })
}
