import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

async function ensureAdminOrEmployee() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin' && profile?.role !== 'employee') return null
  return { userId: user.id, role: profile.role, service: createServiceClient() }
}

/**
 * GET /api/internal-documents/[id] — devuelve detalle + signed URL del PDF
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await ensureAdminOrEmployee()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const { data, error } = await ctx.service
    .from('internal_documents')
    .select(`
      *,
      client:profiles!internal_documents_client_id_fkey(first_name, last_name, email),
      uploader:profiles!internal_documents_uploaded_by_fkey(first_name, last_name),
      reviewer:profiles!internal_documents_reviewed_by_fkey(first_name, last_name),
      case:cases(case_number, service:service_catalog(name))
    `)
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  // Signed URL para preview (5 min)
  const { data: signed } = await ctx.service.storage
    .from('case-documents')
    .createSignedUrl(data.file_path, 300)

  return NextResponse.json({
    document: data,
    signed_url: signed?.signedUrl || null,
  })
}

/**
 * PATCH /api/internal-documents/[id]
 * Body: { action: 'approve' | 'reject' | 'publish', comment?: string }
 *
 * - approve/reject: solo admin (Henry).
 * - publish: solo el uploader o admin. Crea row en documents con
 *   direction='admin_to_client' para que aparezca en el portal del cliente.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await ensureAdminOrEmployee()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const { action, comment } = await req.json() as { action?: string; comment?: string }

  if (!action || !['approve', 'reject', 'publish'].includes(action)) {
    return NextResponse.json({ error: 'action debe ser approve | reject | publish' }, { status: 400 })
  }

  const { data: doc, error: docErr } = await ctx.service
    .from('internal_documents')
    .select('*')
    .eq('id', id)
    .single()

  if (docErr || !doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  // Approve / reject — solo admin
  if (action === 'approve' || action === 'reject') {
    if (ctx.role !== 'admin') {
      return NextResponse.json({ error: 'Solo el admin puede aprobar o rechazar' }, { status: 403 })
    }
    if (doc.status !== 'pending_review') {
      return NextResponse.json({ error: `El documento está en estado ${doc.status}, no se puede revisar de nuevo` }, { status: 409 })
    }
    if (action === 'reject' && (!comment || !comment.trim())) {
      return NextResponse.json({ error: 'El motivo del rechazo es obligatorio' }, { status: 400 })
    }

    const { error } = await ctx.service
      .from('internal_documents')
      .update({
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewed_by: ctx.userId,
        reviewed_at: new Date().toISOString(),
        review_comment: comment || null,
      })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // Publish — el uploader o admin. Solo si está aprobado.
  if (action === 'publish') {
    if (ctx.role !== 'admin' && doc.uploaded_by !== ctx.userId) {
      return NextResponse.json({ error: 'Solo quien subió el documento o el admin puede publicarlo' }, { status: 403 })
    }
    if (doc.status !== 'approved') {
      return NextResponse.json({ error: 'Solo se pueden publicar documentos aprobados' }, { status: 409 })
    }

    // Copia el archivo del path interno a un path "público" (admin_to_client)
    // y crea row en `documents`.
    const newFilePath = doc.file_path.replace(/^internal\//, `${doc.client_id}/`)

    // Move (download + upload + delete original)
    const { data: blob, error: dlErr } = await ctx.service.storage
      .from('case-documents')
      .download(doc.file_path)
    if (dlErr || !blob) {
      return NextResponse.json({ error: 'No se pudo leer el archivo interno' }, { status: 500 })
    }

    const buf = await blob.arrayBuffer()
    const { error: upErr } = await ctx.service.storage
      .from('case-documents')
      .upload(newFilePath, buf, { contentType: doc.file_mime || 'application/pdf', upsert: true })
    if (upErr) {
      return NextResponse.json({ error: 'Error al copiar archivo: ' + upErr.message }, { status: 500 })
    }

    // Crear row en documents (con direction='admin_to_client')
    const { data: pubDoc, error: pubErr } = await ctx.service
      .from('documents')
      .insert({
        case_id: doc.case_id,
        client_id: doc.client_id,
        document_key: doc.category,
        name: doc.file_name,
        file_path: newFilePath,
        file_size: doc.file_size,
        file_type: doc.file_mime,
        direction: 'admin_to_client',
        status: 'submitted',
      })
      .select('id')
      .single()

    if (pubErr) {
      // Cleanup
      await ctx.service.storage.from('case-documents').remove([newFilePath])
      return NextResponse.json({ error: 'Error al publicar: ' + pubErr.message }, { status: 500 })
    }

    await ctx.service
      .from('internal_documents')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        published_document_id: pubDoc.id,
      })
      .eq('id', id)

    return NextResponse.json({ success: true, document_id: pubDoc.id })
  }

  return NextResponse.json({ error: 'Caso no manejado' }, { status: 500 })
}

/**
 * DELETE /api/internal-documents/[id]
 * Solo el uploader o admin pueden borrar. NO se puede borrar si ya fue publicado.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await ensureAdminOrEmployee()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const { data: doc } = await ctx.service
    .from('internal_documents')
    .select('uploaded_by, status, file_path')
    .eq('id', id)
    .single()

  if (!doc) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  if (doc.status === 'published') {
    return NextResponse.json({ error: 'No se puede borrar un documento ya publicado al cliente' }, { status: 409 })
  }
  if (ctx.role !== 'admin' && doc.uploaded_by !== ctx.userId) {
    return NextResponse.json({ error: 'Solo el uploader o admin' }, { status: 403 })
  }

  await ctx.service.storage.from('case-documents').remove([doc.file_path])
  await ctx.service.from('internal_documents').delete().eq('id', id)

  return NextResponse.json({ success: true })
}
