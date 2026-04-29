import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * POST /api/internal-documents/finalize
 *
 * Step 2 del upload — el cliente avisa al server que ya subió el archivo
 * a Supabase Storage. Cambiamos el status de 'uploading' a 'pending_review'
 * para que aparezca en la bandeja de Henry.
 *
 * Body: { document_id }
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
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { document_id } = await req.json() as { document_id?: string }
  if (!document_id) {
    return NextResponse.json({ error: 'document_id requerido' }, { status: 400 })
  }

  const service = createServiceClient()

  // Verificar que el row existe + es del usuario actual + está en 'uploading'
  const { data: doc } = await service
    .from('internal_documents')
    .select('id, uploaded_by, status, file_path')
    .eq('id', document_id)
    .maybeSingle()

  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
  if (doc.uploaded_by !== user.id && profile.role !== 'admin') {
    return NextResponse.json({ error: 'No tienes permiso sobre este documento' }, { status: 403 })
  }
  if (doc.status !== 'uploading') {
    return NextResponse.json({ error: `El documento está en estado ${doc.status}` }, { status: 409 })
  }

  // Verificar que el archivo realmente existe en Storage (sanity check)
  const { data: fileMeta } = await service.storage
    .from('case-documents')
    .list(doc.file_path.substring(0, doc.file_path.lastIndexOf('/')), {
      limit: 1,
      search: doc.file_path.substring(doc.file_path.lastIndexOf('/') + 1),
    })

  if (!fileMeta || fileMeta.length === 0) {
    // Archivo no llegó — borrar el placeholder
    await service.from('internal_documents').delete().eq('id', document_id)
    return NextResponse.json({ error: 'El archivo no se subió correctamente. Intenta de nuevo.' }, { status: 400 })
  }

  // Marcar como pending_review
  const { error: updateErr } = await service
    .from('internal_documents')
    .update({ status: 'pending_review' })
    .eq('id', document_id)

  if (updateErr) {
    return NextResponse.json({ error: 'Error al finalizar: ' + updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
