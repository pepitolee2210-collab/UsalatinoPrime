import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'employee') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const formData = await request.formData()
  const assignmentId = formData.get('assignment_id') as string
  const title = formData.get('title') as string
  const content = formData.get('content') as string
  const file = formData.get('file') as File | null

  if (!assignmentId) {
    return NextResponse.json({ error: 'assignment_id requerido' }, { status: 400 })
  }

  // Verify assignment belongs to this employee
  const { data: assignment } = await supabase
    .from('employee_case_assignments')
    .select('id, case_id')
    .eq('id', assignmentId)
    .eq('employee_id', user.id)
    .single()

  if (!assignment) {
    return NextResponse.json({ error: 'Asignación no encontrada' }, { status: 404 })
  }

  let fileUrl: string | null = null
  let fileName: string | null = null

  // Upload file if provided
  if (file && file.size > 0) {
    const ext = file.name.split('.').pop() || 'pdf'
    const path = `employee-submissions/${assignment.case_id}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('case-documents')
      .upload(path, file, { contentType: file.type })

    if (uploadError) {
      return NextResponse.json({ error: 'Error al subir archivo' }, { status: 500 })
    }

    const { data: urlData } = supabase.storage
      .from('case-documents')
      .getPublicUrl(path)

    fileUrl = urlData.publicUrl
    fileName = file.name
  }

  // Create submission
  const { data: submission, error } = await supabase
    .from('employee_submissions')
    .insert({
      assignment_id: assignmentId,
      employee_id: user.id,
      title: title || null,
      content: content || null,
      file_url: fileUrl,
      file_name: fileName,
      status: 'submitted',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Error al crear envío' }, { status: 500 })
  }

  // Update assignment status
  await supabase
    .from('employee_case_assignments')
    .update({ status: 'submitted', updated_at: new Date().toISOString() })
    .eq('id', assignmentId)

  return NextResponse.json({ submission })
}
