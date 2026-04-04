import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect, notFound } from 'next/navigation'
import { EmployeeCaseView } from './employee-case-view'

export default async function EmployeeCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/employee')

  // Verify assignment exists for this employee + case
  const { data: assignment } = await supabase
    .from('employee_case_assignments')
    .select('id, task_description, status, assigned_at')
    .eq('employee_id', user.id)
    .eq('case_id', id)
    .single()

  if (!assignment) notFound()

  // Use service client to bypass RLS for case data (assignment already verified above)
  const service = createServiceClient()

  // Fetch case info, documents, form submissions, and employee submissions
  const [caseRes, docsRes, formSubsRes, subsRes] = await Promise.all([
    service
      .from('cases')
      .select('id, case_number, client:profiles(first_name, last_name, email, phone), service:service_catalog(name, slug)')
      .eq('id', id)
      .single(),
    service
      .from('documents')
      .select('id, document_key, name, file_size, status, created_at')
      .eq('case_id', id)
      .order('created_at', { ascending: false }),
    service
      .from('case_form_submissions')
      .select('form_type, form_data, status, updated_at')
      .eq('case_id', id)
      .order('updated_at', { ascending: false }),
    supabase
      .from('employee_submissions')
      .select('*')
      .eq('assignment_id', assignment.id)
      .eq('employee_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  if (!caseRes.data) notFound()

  // Normalize Supabase joined relations (arrays → objects)
  const raw = caseRes.data as any
  const caseData = {
    id: raw.id,
    case_number: raw.case_number,
    client: Array.isArray(raw.client) ? raw.client[0] : raw.client,
    service: Array.isArray(raw.service) ? raw.service[0] : raw.service,
  }

  return (
    <EmployeeCaseView
      caseData={caseData}
      assignment={assignment}
      documents={docsRes.data || []}
      formSubmissions={formSubsRes.data || []}
      submissions={subsRes.data || []}
    />
  )
}
