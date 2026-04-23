import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { EmployeeCitasView } from './employee-citas-view'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function EmployeeCitasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'employee') redirect('/login')

  const { data: appointments, error: aptErr } = await supabase
    .from('appointments')
    .select('*, guest_name, employee_notes, client_id, client:profiles!appointments_client_id_fkey(first_name, last_name, email, phone), case:cases(case_number, service:service_catalog(name))')
    .order('scheduled_at', { ascending: false })
    .limit(100)

  if (aptErr) console.error('[employee/citas] fetch error', aptErr)

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
