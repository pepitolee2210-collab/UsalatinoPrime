import { createClient } from '@supabase/supabase-js'

export interface UploadResult {
  document: {
    id: string
    document_type_id: number
    slot_label: string | null
    name: string
    file_type: string | null
    file_size: number | null
    status: string
    rejection_reason: string | null
    phase_when_uploaded: string | null
    created_at: string
  }
}

export interface UploadParams {
  token: string
  file: File
  documentTypeId: number
  slotLabel?: string | null
}

export const ALLOWED_MIME = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const

export const ACCEPT_ATTR = ALLOWED_MIME.join(',')

export const MAX_SIZE_BYTES = 40 * 1024 * 1024

/**
 * Sube un archivo al portal del cliente:
 *   1. Pide signed URL al endpoint propio.
 *   2. Sube directo al Storage de Supabase (bypass del límite Vercel).
 *   3. Confirma con el endpoint que registra en BD.
 */
export async function uploadClientDocument({ token, file, documentTypeId, slotLabel }: UploadParams): Promise<UploadResult> {
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error('El archivo excede el límite de 40MB')
  }
  if (file.type && !ALLOWED_MIME.includes(file.type as typeof ALLOWED_MIME[number])) {
    throw new Error(`Formato no permitido: ${file.type || 'desconocido'}. Acepta PDF, JPG, PNG, WebP, HEIC.`)
  }

  // 1. Signed URL
  const signRes = await fetch(`/api/cita/${encodeURIComponent(token)}/documents/signed-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      document_type_id: documentTypeId,
      file_name: file.name,
      file_size: file.size,
    }),
  })
  if (!signRes.ok) {
    const err = await signRes.json().catch(() => ({}))
    throw new Error(err.error || 'Error al preparar subida')
  }
  const { token: uploadToken, filePath } = await signRes.json()

  // 2. Upload directo a Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Configuración de Supabase faltante')
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  const { error: uploadErr } = await supabase.storage
    .from('case-documents')
    .uploadToSignedUrl(filePath, uploadToken, file, {
      contentType: file.type || 'application/pdf',
    })
  if (uploadErr) {
    throw new Error('Error al subir archivo a Storage')
  }

  // 3. Confirmar en BD
  const confirmRes = await fetch(`/api/cita/${encodeURIComponent(token)}/documents/upload-confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      document_type_id: documentTypeId,
      slot_label: slotLabel ?? null,
      file_path: filePath,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type || 'application/pdf',
    }),
  })
  if (!confirmRes.ok) {
    const err = await confirmRes.json().catch(() => ({}))
    throw new Error(err.error || 'Error al registrar documento')
  }
  return confirmRes.json()
}

/**
 * Elimina un documento. Solo permite si status != 'approved'.
 */
export async function deleteClientDocument(token: string, documentId: string): Promise<void> {
  const res = await fetch(
    `/api/cita/${encodeURIComponent(token)}/documents/${encodeURIComponent(documentId)}`,
    { method: 'DELETE' },
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Error al eliminar')
  }
}
