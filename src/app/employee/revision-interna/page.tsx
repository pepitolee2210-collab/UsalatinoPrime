import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RevisionInternaClient } from './revision-cliente'

export const dynamic = 'force-dynamic'

export default async function EmployeeRevisionInternaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, employee_type')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'employee') redirect('/login')

  return <RevisionInternaClient currentUserId={user.id} />
}
