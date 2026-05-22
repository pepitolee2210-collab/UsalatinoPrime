import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * GET /api/admin/cases/[id]/eoir26a-letter-drafts
 *
 * Lista todas las versiones de la Carta de Exoneración del caso (ordenadas
 * por versión DESC). Incluye stats de tokens y latencia por draft para que
 * Diana pueda auditar costos.
 *
 * Solo admin o paralegal.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role, employee_type')
    .eq('id', user.id)
    .single()
  const isAdmin = profile?.role === 'admin'
  const isParalegal = profile?.role === 'employee' && profile?.employee_type === 'paralegal'
  if (!isAdmin && !isParalegal) {
    return NextResponse.json({ error: 'Solo admin o paralegal' }, { status: 403 })
  }

  const { data, error } = await service
    .from('case_eoir26a_letter_drafts')
    .select(
      'id, version, body_md, model_used, prompt_version, generated_at, is_current, edited_by_diana, input_tokens, output_tokens, cache_read_tokens, generation_seconds, status, error_message, job_started_at, job_finished_at',
    )
    .eq('case_id', id)
    .order('version', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Error al listar drafts' }, { status: 500 })
  }

  return NextResponse.json({ drafts: data ?? [] })
}
