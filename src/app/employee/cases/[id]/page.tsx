import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect, notFound } from 'next/navigation'
import { EmployeeCaseView } from './employee-case-view'

export default async function EmployeeCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/employee')

  // Verificar tipo de empleado. Paralegals tienen acceso de lectura a TODOS
  // los casos sin necesidad de asignación explícita — Henry no debería ser
  // cuello de botella para que Diana avance con la radicación. Si hay
  // asignación específica, la mostramos como contexto adicional.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, employee_type')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'employee') redirect('/employee')

  const isParalegal = profile.employee_type === 'paralegal'

  const { data: assignment } = await supabase
    .from('employee_case_assignments')
    .select('id, task_description, status, assigned_at')
    .eq('employee_id', user.id)
    .eq('case_id', id)
    .maybeSingle()

  // Sin asignación + no-paralegal → 404 (consultoras y contracts_managers
  // siguen necesitando asignación explícita).
  if (!assignment && !isParalegal) notFound()

  // Use service client to bypass RLS for case data (assignment already verified above)
  const service = createServiceClient()

  // Fetch case info, documents, form submissions, henry notes, and employee submissions
  const [caseRes, docsRes, henryDocsRes, formSubsRes, subsRes] = await Promise.all([
    service
      .from('cases')
      .select('id, case_number, henry_notes, client:profiles(first_name, last_name, email, phone), service:service_catalog(name, slug)')
      .eq('id', id)
      .single(),
    service
      .from('documents')
      .select('id, document_key, name, file_size, status, created_at, direction')
      .eq('case_id', id)
      .order('created_at', { ascending: false }),
    service
      .from('documents')
      .select('id, document_key, name, file_size, status, created_at')
      .eq('case_id', id)
      .eq('direction', 'admin_to_client')
      .order('created_at', { ascending: false }),
    service
      .from('case_form_submissions')
      .select('form_type, form_data, status, updated_at, minor_index')
      .eq('case_id', id)
      .order('minor_index', { ascending: true }),
    assignment
      ? supabase
          .from('employee_submissions')
          .select('*')
          .eq('assignment_id', assignment.id)
          .eq('employee_id', user.id)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as never[] }),
  ])

  if (!caseRes.data) notFound()

  // Normalize Supabase joined relations (arrays → objects)
  type RawCase = {
    id: string
    case_number: string
    henry_notes: string | null
    client: { first_name: string; last_name: string; email: string; phone: string }
      | { first_name: string; last_name: string; email: string; phone: string }[]
    service: { name: string; slug: string } | { name: string; slug: string }[]
  }
  const raw = caseRes.data as RawCase
  const caseData = {
    id: raw.id,
    case_number: raw.case_number,
    client: Array.isArray(raw.client) ? raw.client[0] : raw.client,
    service: Array.isArray(raw.service) ? raw.service[0] : raw.service,
  }

  type RawDoc = { id: string; document_key: string; name: string; file_size: number | null; status: string; created_at: string; direction: string | null }
  const docs: RawDoc[] = (docsRes.data ?? []) as RawDoc[]

  return (
    <EmployeeCaseView
      caseData={caseData}
      assignment={assignment ?? null}
      documents={docs.filter(d => !d.direction || d.direction === 'client_to_admin')}
      henryDocuments={henryDocsRes.data || []}
      formSubmissions={formSubsRes.data || []}
      submissions={(subsRes.data as unknown[] as Parameters<typeof EmployeeCaseView>[0]['submissions']) ?? []}
      henryNotes={raw.henry_notes || ''}
    />
  )
}
