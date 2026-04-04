import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import { EmployeeClientesView } from './employee-clientes-view'

export default async function EmployeeClientesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/employee')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'employee') redirect('/employee')

  const service = createServiceClient()

  const { data: clients } = await service
    .from('profiles')
    .select('id, first_name, last_name, email, phone, created_at')
    .eq('role', 'client')
    .order('created_at', { ascending: false })

  // Get case count per client
  const { data: cases } = await service
    .from('cases')
    .select('client_id, service:service_catalog(name)')

  const caseMap = new Map<string, { count: number; services: string[] }>()
  for (const c of cases || []) {
    const cur = caseMap.get(c.client_id) || { count: 0, services: [] }
    cur.count++
    const svc = Array.isArray(c.service) ? c.service[0] : c.service
    if (svc?.name && !cur.services.includes(svc.name)) cur.services.push(svc.name)
    caseMap.set(c.client_id, cur)
  }

  const enriched = (clients || []).map(c => ({
    ...c,
    case_count: caseMap.get(c.id)?.count || 0,
    services: caseMap.get(c.id)?.services || [],
  }))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
      <p className="text-sm text-gray-500">Vista de solo lectura — {enriched.length} clientes registrados.</p>
      <EmployeeClientesView clients={enriched} />
    </div>
  )
}
