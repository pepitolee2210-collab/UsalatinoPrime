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

  // Get document
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

  // Download the actual file from storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('case-documents')
    .download(doc.file_path)

  if (downloadError || !fileData) {
    return NextResponse.json({ error: 'Failed to download file' }, { status: 500 })
  }

  // Determine content type
  const ext = doc.name.split('.').pop()?.toLowerCase() || ''
  const contentTypes: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  }
  const contentType = contentTypes[ext] || 'application/octet-stream'

  // Send file directly to browser with download headers
  const buffer = await fileData.arrayBuffer()
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.name)}"`,
      'Content-Length': String(buffer.byteLength),
    },
  })
}
