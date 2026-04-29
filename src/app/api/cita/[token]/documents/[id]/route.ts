import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * DELETE /api/cita/[token]/documents/[id]
 *
 * Elimina un documento del cliente. Solo se permite si el archivo está
 * en estado 'uploaded' o 'rejected' (no permite borrar approved porque
 * Diana ya lo aceptó como evidencia oficial).
 *
 * Borra del Storage y de la tabla documents.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; id: string }> },
) {
  const { token, id } = await params
  const supabase = createServiceClient()

  const { data: tokenData } = await supabase
    .from('appointment_tokens')
    .select('client_id, case_id, is_active')
    .eq('token', token)
    .single()

  if (!tokenData?.is_active) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 403 })
  }

  const { data: doc } = await supabase
    .from('documents')
    .select('id, file_path, client_id, case_id, status')
    .eq('id', id)
    .single()

  if (!doc || doc.client_id !== tokenData.client_id || doc.case_id !== tokenData.case_id) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
  }

  if (doc.status === 'approved') {
    return NextResponse.json(
      { error: 'No puedes eliminar un documento aprobado. Contacta a tu asesora legal.' },
      { status: 403 },
    )
  }

  if (doc.file_path) {
    await supabase.storage.from('case-documents').remove([doc.file_path])
  }
  await supabase.from('documents').delete().eq('id', id)

  return NextResponse.json({ ok: true })
}
