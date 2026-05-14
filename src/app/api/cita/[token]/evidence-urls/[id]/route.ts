import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * DELETE /api/cita/[token]/evidence-urls/[id]
 *
 * Borra una URL de evidencia. El cliente solo puede borrar URLs de su propio
 * caso (validado vía token).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string; id: string }> },
) {
  const { token, id } = await params
  const supabase = createServiceClient()

  const { data: tokenData } = await supabase
    .from('appointment_tokens')
    .select('case_id, is_active')
    .eq('token', token)
    .single()
  if (!tokenData?.is_active) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 403 })
  }

  const { error } = await supabase
    .from('case_evidence_urls')
    .delete()
    .eq('id', id)
    .eq('case_id', tokenData.case_id)

  if (error) {
    return NextResponse.json({ error: 'Error al borrar URL' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
