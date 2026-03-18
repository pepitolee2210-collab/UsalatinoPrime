import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { EmployeeDashboard } from './employee-dashboard'

export default async function EmployeeDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/employee')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'employee') redirect('/employee')

  const { data: assignments } = await supabase
    .from('employee_case_assignments')
    .select(`
      id, task_description, status, assigned_at, updated_at, service_type, client_name,
      case:cases(
        id, case_number,
        client:profiles(first_name, last_name),
        service:service_catalog(name)
      )
    `)
    .eq('employee_id', user.id)
    .order('assigned_at', { ascending: false })

  // Normalize nested relations
  const normalized = (assignments || []).map((a: any) => ({
    ...a,
    case: {
      ...(Array.isArray(a.case) ? a.case[0] : a.case),
      client: Array.isArray(a.case?.client) ? a.case.client[0] : (a.case?.client || {}),
      service: Array.isArray(a.case?.service) ? a.case.service[0] : (a.case?.service || {}),
    },
  }))

  return <EmployeeDashboard assignments={normalized} />
}
