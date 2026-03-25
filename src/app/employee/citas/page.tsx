import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { EmployeeCitasView } from './employee-citas-view'

export default async function EmployeeCitasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/employee')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'employee') redirect('/employee')

  const { data: appointments } = await supabase
    .from('appointments')
    .select('*, guest_name, client:profiles(first_name, last_name, email, phone), case:cases(case_number, service:service_catalog(name))')
    .order('scheduled_at', { ascending: false })
    .limit(100)

  // Normalize
  const normalized = (appointments || []).map((a: any) => ({
    ...a,
    client: Array.isArray(a.client) ? a.client[0] : a.client,
    case: a.case ? {
      ...(Array.isArray(a.case) ? a.case[0] : a.case),
      service: a.case?.service ? (Array.isArray(a.case.service) ? a.case.service[0] : a.case.service) : null,
    } : null,
  }))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Citas</h1>
      <p className="text-sm text-gray-500">Vista de solo lectura — contacte a Henry para cambios.</p>
      <EmployeeCitasView appointments={normalized} />
    </div>
  )
}
