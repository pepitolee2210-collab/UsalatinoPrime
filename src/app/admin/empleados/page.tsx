import { createClient } from '@/lib/supabase/server'
import { EmployeeTasksView } from './employee-tasks-view'

export default async function AdminEmpleadosPage() {
  const supabase = await createClient()

  // Get all employees
  const { data: employees } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, phone')
    .eq('role', 'employee')

  // Get ALL assignments with their submissions
  const { data: assignments } = await supabase
    .from('employee_case_assignments')
    .select(`
      id, status, task_description, assigned_at, updated_at,
      service_type, client_name,
      employee:profiles!employee_case_assignments_employee_id_fkey(id, first_name, last_name),
      case:cases(id, case_number, client:profiles(first_name, last_name), service:service_catalog(name))
    `)
    .order('assigned_at', { ascending: false })

  // Get services for the assign button
  const { data: services } = await supabase
    .from('service_catalog')
    .select('id, name')
    .order('name')

  // Get submissions for each assignment
  const { data: submissions } = await supabase
    .from('employee_submissions')
    .select('id, assignment_id, title, status, created_at')
    .order('created_at', { ascending: false })

  // Get documents for each assignment
  const { data: taskDocs } = await supabase
    .from('employee_assignment_documents')
    .select('id, assignment_id, name, file_url, file_size')
    .order('uploaded_at', { ascending: false })

  // Build submission count map
  const subMap = new Map<string, { total: number; submitted: number; approved: number }>()
  for (const s of submissions || []) {
    const cur = subMap.get(s.assignment_id) || { total: 0, submitted: 0, approved: 0 }
    cur.total++
    if (s.status === 'submitted') cur.submitted++
    if (s.status === 'approved') cur.approved++
    subMap.set(s.assignment_id, cur)
  }

  // Build docs map
  const docsMap = new Map<string, Array<{ id: string; name: string; file_url: string; file_size: number }>>()
  for (const d of taskDocs || []) {
    const cur = docsMap.get(d.assignment_id) || []
    cur.push(d)
    docsMap.set(d.assignment_id, cur)
  }

  // Normalize nested relations
  const normalized = (assignments || []).map((a: any) => ({
    ...a,
    employee: Array.isArray(a.employee) ? a.employee[0] : a.employee,
    case: a.case ? {
      ...(Array.isArray(a.case) ? a.case[0] : a.case),
      client: a.case?.client ? (Array.isArray(a.case.client) ? a.case.client[0] : a.case.client) : null,
      service: a.case?.service ? (Array.isArray(a.case.service) ? a.case.service[0] : a.case.service) : null,
    } : null,
    submissionStats: subMap.get(a.id) || { total: 0, submitted: 0, approved: 0 },
    docs: docsMap.get(a.id) || [],
  }))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Empleados y Tareas</h1>
      <EmployeeTasksView
        employees={employees || []}
        assignments={normalized}
        services={services || []}
      />
    </div>
  )
}
