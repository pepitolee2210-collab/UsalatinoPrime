import { createClient } from '@supabase/supabase-js'

interface UploadParams {
  file: File
  documentKey: string
  mode: 'admin' | 'client'
  token?: string
  caseId?: string
  clientId?: string
}

interface UploadResult {
  document: {
    id: string
    document_key: string
    name: string
    file_size: number
    status: string
  }
}

/**
 * Uploads a file directly to Supabase Storage using a signed URL,
 * bypassing the Vercel 4.5MB body limit.
 *
 * Flow:
 * 1. Request signed URL from our API
 * 2. Upload file directly to Supabase Storage
 * 3. Confirm upload and create DB record
 */
export async function uploadDirect(params: UploadParams): Promise<UploadResult> {
  const { file, documentKey, mode, token, caseId, clientId } = params

  // Step 1: Get signed upload URL
  const signBody: Record<string, string | number> = {
    document_key: documentKey,
    file_name: file.name,
    file_size: file.size,
    mode,
  }

  if (mode === 'client' && token) {
    signBody.token = token
  } else if (mode === 'admin' && caseId && clientId) {
    signBody.case_id = caseId
    signBody.client_id = clientId
  }

  const signRes = await fetch('/api/upload-signed-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(signBody),
  })

  if (!signRes.ok) {
    const err = await signRes.json()
    throw new Error(err.error || 'Error al preparar subida')
  }

  const { signedUrl, token: uploadToken, filePath, clientId: resolvedClientId, caseId: resolvedCaseId } = await signRes.json()

  // Step 2: Upload file directly to Supabase Storage
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  const { error: uploadError } = await supabase.storage
    .from('case-documents')
    .uploadToSignedUrl(filePath, uploadToken, file, {
      contentType: 'application/pdf',
    })

  if (uploadError) {
    throw new Error('Error al subir archivo')
  }

  // Step 3: Confirm upload and create DB record
  const confirmBody: Record<string, string | number> = {
    document_key: documentKey,
    file_name: file.name,
    file_size: file.size,
    file_path: filePath,
    client_id: resolvedClientId,
    case_id: resolvedCaseId,
    mode,
  }

  if (mode === 'client' && token) {
    confirmBody.token = token
  }

  const confirmRes = await fetch('/api/upload-confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(confirmBody),
  })

  if (!confirmRes.ok) {
    const err = await confirmRes.json()
    throw new Error(err.error || 'Error al registrar documento')
  }

  return confirmRes.json()
}
