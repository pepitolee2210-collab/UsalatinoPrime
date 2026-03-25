import { createClient } from '@/lib/supabase/server'
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

  // Get client info
  const { data: client } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, phone')
    .eq('id', id)
    .eq('role', 'client')
    .single()

  if (!client) notFound()

  // Get cases, documents, and form submissions
  const { data: cases } = await supabase
    .from('cases')
    .select('id, case_number, service:service_catalog(name)')
    .eq('client_id', id)
    .order('created_at', { ascending: false })

  const caseIds = (cases || []).map((c: any) => c.id)

  const [docsRes, formsRes] = await Promise.all([
    caseIds.length > 0
      ? supabase.from('documents').select('id, case_id, document_key, name, file_size, file_path, created_at')
          .in('case_id', caseIds).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    caseIds.length > 0
      ? supabase.from('case_form_submissions').select('form_type, form_data, status, updated_at, case_id, minor_index')
          .in('case_id', caseIds).order('updated_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])

  // Normalize cases
  const normalizedCases = (cases || []).map((c: any) => ({
    ...c,
    service: Array.isArray(c.service) ? c.service[0] : c.service,
  }))

  return (
    <EmployeeClientDetail
      client={client}
      cases={normalizedCases}
      documents={docsRes.data || []}
      formSubmissions={formsRes.data || []}
    />
  )
}
