import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const documentId = req.nextUrl.searchParams.get('document_id')

  if (!token || !documentId) {
    return NextResponse.json({ error: 'Token and document_id are required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Validate token
  const { data: tokenData, error: tokenError } = await supabase
    .from('appointment_tokens')
    .select('client_id, case_id, is_active')
    .eq('token', token)
    .single()

  if (tokenError || !tokenData || !tokenData.is_active) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
  }

  // Get document - must belong to this case and be admin_to_client
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id, file_path, name, direction')
    .eq('id', documentId)
    .eq('case_id', tokenData.case_id)
    .eq('direction', 'admin_to_client')
    .single()

  if (docError || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  // Generate signed download URL
  const { data: signedUrl, error: urlError } = await supabase.storage
    .from('case-documents')
    .createSignedUrl(doc.file_path, 300) // 5 min expiry

  if (urlError || !signedUrl) {
    return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 })
  }

  return NextResponse.json({ url: signedUrl.signedUrl })
}
