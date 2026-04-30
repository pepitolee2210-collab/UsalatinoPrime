import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const ALLOWED_DIRECTIONS = ['client_to_admin', 'admin_to_client', 'firm_internal'] as const
type Direction = (typeof ALLOWED_DIRECTIONS)[number]

function normalizeDirection(value: unknown): Direction {
  return ALLOWED_DIRECTIONS.includes(value as Direction)
    ? (value as Direction)
    : 'admin_to_client'
}

function pathPrefix(dir: Direction): string {
  if (dir === 'firm_internal') return 'firm_internal'
  if (dir === 'client_to_admin') return 'client_uploads'
  return 'henry_docs'
}

// POST: Generate signed upload URL. Used by admin and paralegal to upload
// documents on a case for any of the three directions.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin' && profile?.role !== 'employee') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { case_id, client_id, file_name, file_size, direction } = await req.json()
  if (!case_id || !client_id || !file_name) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (file_size && file_size > 40 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 40MB)' }, { status: 400 })
  }

  const dir = normalizeDirection(direction)
  const service = createServiceClient()
  const timestamp = Date.now()
  const safeName = file_name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const filePath = `${client_id}/${case_id}/${pathPrefix(dir)}/${timestamp}-${safeName}`

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

// PATCH: Confirm upload and create document record. Snapshots the case's
// current_phase so the document appears in the right phase tab. Direction
// is validated against a whitelist; default 'admin_to_client' preserves
// the previous behavior of this endpoint.
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin' && profile?.role !== 'employee') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { case_id, client_id, file_path, file_name, file_size, document_key, direction } = await req.json()
  if (!case_id || !client_id || !file_path || !file_name) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const dir = normalizeDirection(direction)
  const service = createServiceClient()

  const { data: caseRow } = await service
    .from('cases')
    .select('current_phase')
    .eq('id', case_id)
    .single()

  const defaultKey =
    dir === 'firm_internal' ? 'firm_internal' :
    dir === 'client_to_admin' ? 'paralegal_upload' :
    'henry_document'

  const { data: doc, error } = await service
    .from('documents')
    .insert({
      case_id,
      client_id,
      document_key: document_key || defaultKey,
      name: file_name,
      file_path,
      file_size: file_size || 0,
      status: 'uploaded',
      direction: dir,
      phase_when_uploaded: caseRow?.current_phase ?? null,
      uploaded_by: user.id,
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to save document record' }, { status: 500 })
  }

  return NextResponse.json({ id: doc.id })
}
