import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ContratosClient } from './contratos-client'

export const dynamic = 'force-dynamic'

export default async function EmployeeContratosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('employee_type')
    .eq('id', user.id)
    .single()

  if (profile?.employee_type !== 'contracts_manager') {
    redirect('/employee/dashboard')
  }

  return <ContratosClient />
}
