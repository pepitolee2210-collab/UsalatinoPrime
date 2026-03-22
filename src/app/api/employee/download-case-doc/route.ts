import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const docId = request.nextUrl.searchParams.get('id')
  if (!docId) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const service = createServiceClient()

  // Get document
  const { data: doc } = await service
    .from('documents')
    .select('file_path, name, case_id')
    .eq('id', docId)
    .single()

  if (!doc?.file_path) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  // Generate signed URL
  const { data: signedData } = await service.storage
    .from('case-documents')
    .createSignedUrl(doc.file_path, 300)

  if (signedData?.signedUrl) {
    return NextResponse.redirect(signedData.signedUrl)
  }

  return NextResponse.json({ error: 'Error al generar descarga' }, { status: 500 })
}
