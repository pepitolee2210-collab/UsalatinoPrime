import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProspectosView } from '@/app/admin/prospectos-citas/prospectos-view'

export default async function EmployeeProspectosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('employee_type')
    .eq('id', user.id)
    .single()

  if (profile?.employee_type !== 'senior_consultant') {
    redirect('/employee/dashboard')
  }

  return <ProspectosView mode="senior_consultant" />
}
