import { createClient } from '@/lib/supabase/server'
import { AdminCitasView } from './admin-citas-view'

export default async function AdminCitasPage() {
  const supabase = await createClient()

  const [appointmentsRes, configRes, settingsRes, blockedDatesRes, casesRes] = await Promise.all([
    supabase
      .from('appointments')
      .select('*, guest_name, client:profiles(first_name, last_name, email, phone), case:cases(case_number, service:service_catalog(name))')
      // Exclude leads booked by the voice agent — those live in
      // /admin/prospectos-citas so Henry can process them separately.
      .or('source.is.null,source.neq.voice-agent')
      .order('scheduled_at', { ascending: false }),
    supabase
      .from('scheduling_config')
      .select('*')
      .order('day_of_week'),
    supabase
      .from('scheduling_settings')
      .select('*')
      .single(),
    supabase
      .from('blocked_dates')
      .select('*')
      .order('blocked_date', { ascending: true }),
    supabase
      .from('cases')
      .select('id, case_number, client_id, client:profiles(first_name, last_name, phone), service:service_catalog(name)')
      .not('intake_status', 'eq', 'archived')
      .order('created_at', { ascending: false }),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Citas</h1>
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
