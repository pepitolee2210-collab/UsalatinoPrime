import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

/**
 * GET /api/internal-documents/clients
 * Lista plana de clientes con casos activos para el selector del modal.
 * Devuelve { case_id, client_id, case_number, client_name, service_name }
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
  const { data, error } = await service
    .from('cases')
    .select(`
      id, case_number,
      client:profiles!cases_client_id_fkey(id, first_name, last_name),
      service:service_catalog(name)
    `)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const clients = (data || []).map((row: any) => {
    const client = Array.isArray(row.client) ? row.client[0] : row.client
    const svc = Array.isArray(row.service) ? row.service[0] : row.service
    return {
      case_id: row.id as string,
      client_id: client?.id as string,
      case_number: row.case_number as string,
      client_name: client ? `${client.first_name ?? ''} ${client.last_name ?? ''}`.trim() : 'Sin nombre',
      service_name: svc?.name ?? null,
    }
  }).filter(c => c.client_id)

  return NextResponse.json({ clients })
}
