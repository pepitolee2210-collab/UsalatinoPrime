import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const MAX_BYTES = 40 * 1024 * 1024 // 40 MB

const VALID_CATEGORIES = [
  'declaracion_tutor',
  'declaracion_menor',
  'declaracion_testigo',
  'peticion_i360',
  'carta_corte',
  'consentimiento_parental',
  'evidencia',
  'i485',
  'otro',
]

/**
 * POST /api/internal-documents/upload
 *
 * Step 1 del upload — devuelve un signed URL para que el cliente suba el
 * archivo DIRECTO a Supabase Storage (bypass del límite de 4.5 MB de
 * Vercel Server Functions). El cliente recibe `signed_url` + `file_path`,
 * sube el binario con PUT y luego llama a /finalize con la metadata.
 *
 * Body JSON: { case_id, client_id, category, file_name, file_size,
 *              file_mime, upload_notes?, parent_document_id? }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin' && profile?.role !== 'employee') {
    return NextResponse.json({ error: 'Solo admin o employee' }, { status: 403 })
  }

  const body = await req.json() as {
    case_id?: string
    client_id?: string
    category?: string
    file_name?: string
    file_size?: number
    file_mime?: string
    upload_notes?: string
    parent_document_id?: string
  }

  const {
    case_id, client_id, category, file_name, file_size, file_mime,
    upload_notes, parent_document_id,
  } = body

  if (!case_id || !client_id || !category || !file_name) {
    return NextResponse.json({ error: 'case_id, client_id, category y file_name requeridos' }, { status: 400 })
  }
  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'category inválida' }, { status: 400 })
  }
  if (file_size && file_size > MAX_BYTES) {
    return NextResponse.json({ error: 'Archivo supera el límite de 40MB' }, { status: 413 })
  }

  const service = createServiceClient()

  // Versión si es resubida tras rechazo
  let version = 1
  if (parent_document_id) {
    const { data: parent } = await service
      .from('internal_documents')
      .select('version')
      .eq('id', parent_document_id)
      .maybeSingle()
    if (parent) version = (parent.version || 1) + 1
  }

  const safeName = file_name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)
  const ts = Date.now()
  const filePath = `internal/${case_id}/${ts}-v${version}-${safeName}`

  // Generar signed URL para subida directa (válido por 5 min)
  const { data: signed, error: signErr } = await service.storage
    .from('case-documents')
    .createSignedUploadUrl(filePath)

  if (signErr || !signed) {
    return NextResponse.json({ error: 'No se pudo generar URL de subida: ' + (signErr?.message || 'unknown') }, { status: 500 })
  }

  // Crear row en estado 'uploading' — el cliente la marcará 'pending_review'
  // cuando termine la subida vía /finalize
  const { data: row, error: insertErr } = await service
    .from('internal_documents')
    .insert({
      case_id,
      client_id,
      uploaded_by: user.id,
      category,
      file_name,
      file_path: filePath,
      file_size: file_size ?? null,
      file_mime: file_mime ?? null,
      status: 'uploading',
      upload_notes: upload_notes || null,
      version,
      parent_document_id: parent_document_id || null,
    })
    .select('id')
    .single()

  if (insertErr) {
    return NextResponse.json({ error: 'Error al crear registro: ' + insertErr.message }, { status: 500 })
  }

  return NextResponse.json({
    document_id: row.id,
    signed_url: signed.signedUrl,
    token: signed.token,
    file_path: filePath,
  })
}
