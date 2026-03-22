import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'employee' && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const docId = request.nextUrl.searchParams.get('id')
  if (!docId) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  // Get document record
  const service = createServiceClient()
  const { data: doc } = await service
    .from('employee_assignment_documents')
    .select('file_url, name, assignment_id')
    .eq('id', docId)
    .single()

  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  // If employee, verify they own this assignment
  if (profile?.role === 'employee') {
    const { data: assignment } = await supabase
      .from('employee_case_assignments')
      .select('id')
      .eq('id', doc.assignment_id)
      .eq('employee_id', user.id)
      .single()

    if (!assignment) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // Extract storage path from the public URL
  const url = new URL(doc.file_url)
  const pathMatch = url.pathname.match(/\/object\/public\/case-documents\/(.+)/)
  const storagePath = pathMatch ? pathMatch[1] : null

  if (!storagePath) {
    // Try direct URL as fallback
    return NextResponse.redirect(doc.file_url)
  }

  // Generate signed URL
  const { data: signedData } = await service.storage
    .from('case-documents')
    .createSignedUrl(storagePath, 300) // 5 min

  if (signedData?.signedUrl) {
    return NextResponse.redirect(signedData.signedUrl)
  }

  return NextResponse.json({ error: 'Error al generar descarga' }, { status: 500 })
}
