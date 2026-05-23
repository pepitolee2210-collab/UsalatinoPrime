import { createClient } from '@/lib/supabase/server'
import { AdminPaymentsDashboard } from './admin-payments-dashboard'
import { PageHeader, AdminKeyframes } from '@/components/admin-ui'

export default async function AdminPaymentsPage() {
  const supabase = await createClient()

  const { data: payments } = await supabase
    .from('payments')
    .select('*, case:cases(case_number, service_id, service:service_catalog(name, slug)), client:profiles(first_name, last_name, email)')
    .order('created_at', { ascending: false })

  const { data: cases } = await supabase
    .from('cases')
    .select('id, case_number, client_id, service_id, total_cost, service:service_catalog(name, slug), client:profiles(first_name, last_name)')
    .order('created_at', { ascending: false })
    .limit(50)

  // Telemetría
  const total = payments?.length ?? 0
  const completedCount = (payments || []).filter((p: Record<string, unknown>) => p.status === 'completed').length
  const pendingCount = (payments || []).filter((p: Record<string, unknown>) => p.status === 'pending').length
  const totalCollected = (payments || [])
    .filter((p: Record<string, unknown>) => p.status === 'completed')
    .reduce((acc: number, p: Record<string, unknown>) => acc + Number(p.amount || 0), 0)

  return (
    <div className="space-y-6">
      <AdminKeyframes />
      <PageHeader
        eyebrow="Operación · Pagos"
        title="Pagos"
        accentDot
        description="Centro de cobranza. Registra pagos, crea planes y monitorea el flujo de caja."
        telemetry={[
          { label: 'Total', value: total.toLocaleString() },
          { label: 'Cobrados', value: completedCount.toString() },
          { label: 'Pendientes', value: pendingCount.toString() },
          { label: 'Recaudado', value: `$${Math.round(totalCollected).toLocaleString()}` },
        ]}
      />
      <AdminPaymentsDashboard
        initialPayments={payments || []}
        cases={cases || []}
        hideHeader
      />
    </div>
  )
}
