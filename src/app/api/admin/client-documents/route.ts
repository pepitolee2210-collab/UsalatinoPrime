import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// POST: Generate signed upload URL for admin uploading doc FOR client
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // Check admin role
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { case_id, client_id, file_name, file_size } = await req.json()
  if (!case_id || !client_id || !file_name) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (file_size && file_size > 40 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 40MB)' }, { status: 400 })
  }

  const service = createServiceClient()
  const timestamp = Date.now()
  const safeName = file_name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const filePath = `${client_id}/${case_id}/henry_docs/${timestamp}-${safeName}`

  const { data: signedUrl, error } = await service.storage
    .from('case-documents')
    .createSignedUploadUrl(filePath)

  if (error || !signedUrl) {
    return NextResponse.json({ error: 'Failed to create upload URL' }, { status: 500 })
  }

  return NextResponse.json({
    signedUrl: signedUrl.signedUrl,
    token: signedUrl.token,
    filePath,
  })
}

// PATCH: Confirm upload and create document record
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { case_id, client_id, file_path, file_name, file_size } = await req.json()
  if (!case_id || !client_id || !file_path || !file_name) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data: doc, error } = await service
    .from('documents')
    .insert({
      case_id,
      client_id,
      document_key: 'henry_document',
      name: file_name,
      file_path,
      file_size: file_size || 0,
      status: 'uploaded',
      direction: 'admin_to_client',
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to save document record' }, { status: 500 })
  }

  return NextResponse.json({ id: doc.id })
}
