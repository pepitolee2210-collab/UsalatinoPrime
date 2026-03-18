import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { EmployeeTaskView } from './employee-task-view'

export default async function EmployeeTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/employee')

  // Get the assignment by ID (standalone — no case_id required)
  const { data: assignment } = await supabase
    .from('employee_case_assignments')
    .select('id, task_description, status, assigned_at, service_type, client_name')
    .eq('id', id)
    .eq('employee_id', user.id)
    .single()

  if (!assignment) notFound()

  // Get attached documents and submissions
  const [docsRes, subsRes] = await Promise.all([
    supabase
      .from('employee_assignment_documents')
      .select('id, name, file_url, file_size, uploaded_at')
      .eq('assignment_id', id)
      .order('uploaded_at', { ascending: false }),
    supabase
      .from('employee_submissions')
      .select('*')
      .eq('assignment_id', id)
      .eq('employee_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  return (
    <EmployeeTaskView
      assignment={assignment}
      documents={docsRes.data || []}
      submissions={subsRes.data || []}
    />
  )
}
