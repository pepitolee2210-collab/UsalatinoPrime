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
  const assignmentId = formData.get('assignment_id') as string
  const file = formData.get('file') as File

  if (!assignmentId || !file || !file.size) {
    return NextResponse.json({ error: 'assignment_id y file requeridos' }, { status: 400 })
  }

  // Upload file to storage
  const ext = file.name.split('.').pop() || 'pdf'
  const path = `employee-tasks/${assignmentId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('case-documents')
    .upload(path, file, { contentType: file.type })

  if (uploadError) {
    return NextResponse.json({ error: 'Error al subir archivo' }, { status: 500 })
  }

  const { data: urlData } = supabase.storage
    .from('case-documents')
    .getPublicUrl(path)

  // Save document record
  const { data: doc, error } = await supabase
    .from('employee_assignment_documents')
    .insert({
      assignment_id: assignmentId,
      name: file.name,
      file_url: urlData.publicUrl,
      file_size: file.size,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Error al guardar registro' }, { status: 500 })
  }

  return NextResponse.json({ document: doc })
}
