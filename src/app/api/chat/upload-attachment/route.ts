import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

const ALLOWED_IMAGE_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif',
])
const ALLOWED_DOC_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
])

/**
 * POST /api/chat/upload-attachment
 * Body: multipart/form-data con file + conversation_id
 * Sube el archivo al bucket privado chat-attachments. Devuelve path para
 * usarlo como attachment_url en POST /api/chat/messages.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin' && profile?.role !== 'employee') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const conversationId = formData.get('conversation_id') as string | null
  if (!file || !conversationId) {
    return NextResponse.json({ error: 'file y conversation_id son requeridos' }, { status: 400 })
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: `El archivo excede el límite de 10 MB (es ${(file.size / 1024 / 1024).toFixed(1)} MB)` },
      { status: 400 }
    )
  }

  const isImage = ALLOWED_IMAGE_TYPES.has(file.type)
  const isDoc = ALLOWED_DOC_TYPES.has(file.type)
  if (!isImage && !isDoc) {
    return NextResponse.json(
      { error: `Tipo de archivo no permitido: ${file.type}` },
      { status: 400 }
    )
  }

  const service = createServiceClient()

  // Verifico membresía
  const { data: membership } = await service
    .from('conversation_participants')
    .select('conversation_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // Path: <conversation_id>/<timestamp>-<sanitized-name>
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
  const ts = Date.now()
  const path = `${conversationId}/${ts}-${safeName}`

  const buf = await file.arrayBuffer()
  const { error: uploadErr } = await service.storage
    .from('chat-attachments')
    .upload(path, buf, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 })
  }

  return NextResponse.json({
    path,
    attachment_type: isImage ? 'image' : 'document',
    attachment_name: file.name,
    attachment_size: file.size,
  })
}

/**
 * GET /api/chat/upload-attachment?path=<storage path>
 * Devuelve signed URL temporal (60 min) para descargar/ver el archivo.
 * Solo el participante de la conversación puede hacerlo.
 */
export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const url = new URL(req.url)
  const path = url.searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'path requerido' }, { status: 400 })

  // El conversation_id es el primer segmento del path
  const conversationId = path.split('/')[0]
  if (!conversationId) {
    return NextResponse.json({ error: 'path inválido' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data: membership } = await service
    .from('conversation_participants')
    .select('conversation_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { data, error } = await service.storage
    .from('chat-attachments')
    .createSignedUrl(path, 60 * 60) // 1 hora

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Error generando URL' }, { status: 500 })
  }

  return NextResponse.json({ url: data.signedUrl })
}
