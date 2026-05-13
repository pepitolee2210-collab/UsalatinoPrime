import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Búsqueda global para el panel del empleado.
 * Acepta ?q=... y devuelve hasta 8 clientes y 8 contratos que matcheen
 * por nombre / email / case_number / servicio. Solo accesible por
 * usuarios con role='employee' (cualquier employee_type).
 */
export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'employee') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') || '').trim()
  if (q.length < 2) {
    return NextResponse.json({ clients: [], contracts: [], cases: [] })
  }

  const service = createServiceClient()
  const pattern = `%${q.replace(/[%_]/g, '')}%`

  // Búsqueda paralela en 3 dominios
  const [clientsRes, contractsRes, casesRes] = await Promise.all([
    service
      .from('profiles')
      .select('id, first_name, last_name, email, phone')
      .eq('role', 'client')
      .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`)
      .limit(8),
    service
      .from('contracts')
      .select('id, client_full_name, service_name, status, total_price, signed_at, client_id')
      .or(`client_full_name.ilike.${pattern},service_name.ilike.${pattern}`)
      .limit(8),
    service
      .from('cases')
      .select('id, case_number, client_id, service:service_catalog(name)')
      .ilike('case_number', pattern)
      .limit(5),
  ])

  return NextResponse.json({
    clients: clientsRes.data || [],
    contracts: contractsRes.data || [],
    cases: (casesRes.data || []).map((c) => ({
      ...c,
      service: Array.isArray(c.service) ? c.service[0] : c.service,
    })),
  })
}
