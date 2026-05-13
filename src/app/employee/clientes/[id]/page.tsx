import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect, notFound } from 'next/navigation'
import { EmployeeClientDetail } from './employee-client-detail'

export default async function EmployeeClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/employee')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'employee') redirect('/employee')

  const currentUserId = user.id
  const isAdmin = false // role==='employee' siempre aquí (admin usa /admin)

  const { data: client } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, phone')
    .eq('id', id)
    .eq('role', 'client')
    .single()

  if (!client) notFound()

  const service = createServiceClient()

  // Get cases with slug y campos de fase para que Diana pueda gestionar.
  const { data: cases } = await service
    .from('cases')
    .select('id, case_number, henry_notes, pipeline_status, current_phase, process_start, state_us, parent_deceased, in_orr_custody, has_criminal_history, minor_close_to_21, service:service_catalog(name, slug)')
    .eq('client_id', id)
    .order('created_at', { ascending: false })

  const caseIds = (cases || []).map((c: { id: string }) => c.id)

  const [docsRes, henryDocsRes, formsRes, appointmentsRes] = await Promise.all([
    caseIds.length > 0
      ? service.from('documents').select('id, case_id, document_key, name, file_size, file_path, created_at, direction')
          .in('case_id', caseIds).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    caseIds.length > 0
      ? service.from('documents').select('id, case_id, document_key, name, file_size, file_path, created_at')
          .in('case_id', caseIds).eq('direction', 'admin_to_client').order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    caseIds.length > 0
      ? service.from('case_form_submissions').select('form_type, form_data, status, updated_at, case_id, minor_index')
          .in('case_id', caseIds).order('minor_index', { ascending: true })
      : Promise.resolve({ data: [] }),
    caseIds.length > 0
      ? service.from('appointments').select('id, case_id, status')
          .in('case_id', caseIds)
      : Promise.resolve({ data: [] }),
  ])

  const normalizedCases = ((cases || []) as unknown as Array<Record<string, unknown>>).map((c) => {
    const svc = c.service
    return {
      ...c,
      service: Array.isArray(svc) ? svc[0] : svc,
    }
  }) as unknown as Parameters<typeof EmployeeClientDetail>[0]['cases']

  return (
    <EmployeeClientDetail
      client={client}
      cases={normalizedCases}
      documents={(docsRes.data || []).filter((d: { direction?: string | null }) => !d.direction || d.direction === 'client_to_admin')}
      henryDocuments={henryDocsRes.data || []}
      formSubmissions={formsRes.data || []}
      appointments={appointmentsRes.data || []}
      currentUserId={currentUserId}
      isAdmin={isAdmin}
    />
  )
}
