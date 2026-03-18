import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { AdminCaseView } from './admin-case-view'

export default async function AdminCaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: caseData } = await supabase
    .from('cases')
    .select('*, service:service_catalog(name, slug), client:profiles(first_name, last_name, email, phone)')
    .eq('id', id)
    .single()

  if (!caseData) notFound()

  const [{ data: documents }, { data: activities }, { data: payments }, { data: aiSubmissions }, { data: empAssignments }, { data: employees }] = await Promise.all([
    supabase.from('documents').select('*').eq('case_id', id),
    supabase
      .from('case_activity')
      .select('*, actor:profiles(first_name, last_name)')
      .eq('case_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('payments')
      .select('*')
      .eq('case_id', id)
      .order('installment_number', { ascending: true }),
    supabase
      .from('case_form_submissions')
      .select('*')
      .eq('case_id', id)
      .order('updated_at', { ascending: false }),
    supabase
      .from('employee_case_assignments')
      .select('id, status, task_description, assigned_at, employee:profiles(first_name, last_name)')
      .eq('case_id', id)
      .limit(1),
    supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .eq('role', 'employee'),
  ])

  // Load submissions for the assignment if exists
  let employeeAssignment = null
  if (empAssignments && empAssignments.length > 0) {
    const ea = empAssignments[0] as any
    const { data: subs } = await supabase
      .from('employee_submissions')
      .select('*')
      .eq('assignment_id', ea.id)
      .order('created_at', { ascending: false })

    employeeAssignment = { ...ea, submissions: subs || [] }
  }

  return (
    <AdminCaseView
      caseData={caseData}
      documents={documents || []}
      activities={activities || []}
      payments={payments || []}
      aiSubmissions={aiSubmissions || []}
      employeeAssignment={employeeAssignment}
      employees={employees || []}
    />
  )
}
