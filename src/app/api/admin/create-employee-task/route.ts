import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const formData = await request.formData()
  const employeeId = formData.get('employee_id') as string
  const serviceType = formData.get('service_type') as string
  const clientName = formData.get('client_name') as string
  const taskDescription = formData.get('task_description') as string
  const files = formData.getAll('files') as File[]

  if (!employeeId || !serviceType) {
    return NextResponse.json({ error: 'employee_id y service_type requeridos' }, { status: 400 })
  }

  // Create standalone assignment (no case_id)
  const { data: assignment, error: assignError } = await supabase
    .from('employee_case_assignments')
    .insert({
      employee_id: employeeId,
      service_type: serviceType,
      client_name: clientName || null,
      task_description: taskDescription || null,
      status: 'assigned',
    })
    .select()
    .single()

  if (assignError || !assignment) {
    return NextResponse.json({ error: 'Error al crear asignación' }, { status: 500 })
  }

  // Upload files
  const uploadedDocs = []
  for (const file of files) {
    if (!file.size) continue

    const ext = file.name.split('.').pop() || 'pdf'
    const path = `employee-tasks/${assignment.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('case-documents')
      .upload(path, file, { contentType: file.type })

    if (!uploadError) {
      const { data: urlData } = supabase.storage
        .from('case-documents')
        .getPublicUrl(path)

      const { data: doc } = await supabase
        .from('employee_assignment_documents')
        .insert({
          assignment_id: assignment.id,
          name: file.name,
          file_url: urlData.publicUrl,
          file_size: file.size,
        })
        .select()
        .single()

      if (doc) uploadedDocs.push(doc)
    }
  }

  return NextResponse.json({ assignment, documents: uploadedDocs })
}
