import { createClient } from '@/lib/supabase/server'
import { AdminCitasView } from './admin-citas-view'
import { PageHeader, AdminKeyframes } from '@/components/admin-ui'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminCitasPage() {
  const supabase = await createClient()

  const [appointmentsRes, configRes, settingsRes, blockedDatesRes, casesRes] = await Promise.all([
    supabase
      .from('appointments')
      .select('*, guest_name, client:profiles!appointments_client_id_fkey(first_name, last_name, email, phone), case:cases(case_number, service:service_catalog(name))')
      .or('source.is.null,source.neq.voice-agent')
      .order('scheduled_at', { ascending: false }),
    supabase.from('scheduling_config').select('*').order('day_of_week'),
    supabase.from('scheduling_settings').select('*').single(),
    supabase.from('blocked_dates').select('*').order('blocked_date', { ascending: true }),
    supabase
      .from('cases')
      .select('id, case_number, client_id, client:profiles(first_name, last_name, phone), service:service_catalog(name)')
      .not('intake_status', 'eq', 'archived')
      .order('created_at', { ascending: false }),
  ])

  if (appointmentsRes.error) {
    console.error('[admin/citas] appointments fetch error', appointmentsRes.error)
  }

  const total = appointmentsRes.data?.length ?? 0
  const today = new Date().toISOString().slice(0, 10)
  const todayCount = (appointmentsRes.data || []).filter((a) => (a.scheduled_at as string)?.startsWith(today)).length
  const confirmed = (appointmentsRes.data || []).filter((a) => a.status === 'confirmed').length

  return (
    <div className="space-y-6">
      <AdminKeyframes />
      <PageHeader
        eyebrow="Operación · Citas"
        title="Citas"
        accentDot
        description="Agenda de citas con clientes. Confirmaciones, reprogramaciones y configuración de slots disponibles."
        telemetry={[
          { label: 'Total', value: total.toLocaleString() },
          { label: 'Hoy', value: todayCount.toString() },
          { label: 'Confirmadas', value: confirmed.toString() },
        ]}
      />
      <AdminCitasView
        appointments={appointmentsRes.data || []}
        config={configRes.data || []}
        settings={settingsRes.data}
        blockedDates={blockedDatesRes.data || []}
        activeCases={casesRes.data || []}
      />
    </div>
  )
}
