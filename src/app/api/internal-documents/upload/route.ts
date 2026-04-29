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
 * FormData: case_id, client_id, category, upload_notes, file
 *
 * Suba un documento al bucket case-documents/internal/{case_id}/ y crea
 * row en internal_documents con status='pending_review'.
 *
 * Auth: admin o employee.
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

  const formData = await req.formData()
  const caseId = formData.get('case_id') as string | null
  const clientId = formData.get('client_id') as string | null
  const category = formData.get('category') as string | null
  const uploadNotes = (formData.get('upload_notes') as string | null) ?? ''
  const file = formData.get('file') as File | null
  const parentDocumentId = formData.get('parent_document_id') as string | null

  if (!caseId || !clientId || !category || !file) {
    return NextResponse.json({ error: 'case_id, client_id, category y file requeridos' }, { status: 400 })
  }
  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'category inválida' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Archivo supera el límite de 40MB' }, { status: 413 })
  }

  const service = createServiceClient()

  // Determinar versión si es resubida tras rechazo
  let version = 1
  if (parentDocumentId) {
    const { data: parent } = await service
      .from('internal_documents')
      .select('version')
      .eq('id', parentDocumentId)
      .maybeSingle()
    if (parent) version = (parent.version || 1) + 1
  }

  // Subir al bucket
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)
  const ts = Date.now()
  const filePath = `internal/${caseId}/${ts}-v${version}-${safeName}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadErr } = await service.storage
    .from('case-documents')
    .upload(filePath, arrayBuffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (uploadErr) {
    return NextResponse.json({ error: 'Error al subir archivo: ' + uploadErr.message }, { status: 500 })
  }

  // Crear row
  const { data: row, error: insertErr } = await service
    .from('internal_documents')
    .insert({
      case_id: caseId,
      client_id: clientId,
      uploaded_by: user.id,
      category,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      file_mime: file.type || null,
      status: 'pending_review',
      upload_notes: uploadNotes || null,
      version,
      parent_document_id: parentDocumentId || null,
    })
    .select('*')
    .single()

  if (insertErr) {
    // Cleanup el archivo si la BD falla
    await service.storage.from('case-documents').remove([filePath])
    return NextResponse.json({ error: 'Error al guardar registro: ' + insertErr.message }, { status: 500 })
  }

  return NextResponse.json({ document: row })
}
