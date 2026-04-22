import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MetricsClient } from './metrics-client'

export const dynamic = 'force-dynamic'

export default async function MetricsPage() {
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

  const [paymentsRes, contractsRes] = await Promise.all([
    supabase
      .from('payments')
      .select('id, amount, status, due_date, paid_at, client_id, client:profiles!payments_client_id_fkey(first_name, last_name, phone)')
      .order('due_date', { ascending: true }),
    supabase
      .from('contracts')
      .select('id, client_full_name, service_name, total_price, status, created_at, signed_at')
      .order('created_at', { ascending: false }),
  ])

  return (
    <MetricsClient
      payments={((paymentsRes.data || []) as any[]).map(p => ({
        ...p,
        client: Array.isArray(p.client) ? p.client[0] : p.client,
      }))}
      contracts={(contractsRes.data || []) as any[]}
    />
  )
}
