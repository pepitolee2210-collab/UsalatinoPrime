import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const docId = request.nextUrl.searchParams.get('id')

  if (!token || !docId) {
    return NextResponse.json({ error: 'token y id requeridos' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Verify token
  const { data: tokenData } = await supabase
    .from('appointment_tokens')
    .select('client_id, is_active')
    .eq('token', token)
    .single()

  if (!tokenData?.is_active) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 403 })
  }

  // Get document and verify it belongs to this client
  const { data: doc } = await supabase
    .from('documents')
    .select('file_path, name, client_id')
    .eq('id', docId)
    .single()

  if (!doc?.file_path || doc.client_id !== tokenData.client_id) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
  }

  // Generate signed URL
  const { data: signedData } = await supabase.storage
    .from('case-documents')
    .createSignedUrl(doc.file_path, 300)

  if (signedData?.signedUrl) {
    return NextResponse.redirect(signedData.signedUrl)
  }

  return NextResponse.json({ error: 'Error al generar preview' }, { status: 500 })
}
