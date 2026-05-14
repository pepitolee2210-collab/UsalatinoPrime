import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * GET /api/cita/[token]/credible-fear-current
 *
 * Devuelve el draft del Miedo Creíble marcado como `is_current` para el caso
 * del token. El cliente lo usa para previsualizar lo que la firma generó por
 * él en Fase 2. No expone versiones anteriores.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const supabase = createServiceClient()

  const { data: tokenData } = await supabase
    .from('appointment_tokens')
    .select('case_id, is_active')
    .eq('token', token)
    .single()
  if (!tokenData?.is_active) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 403 })
  }

  const { data: draft } = await supabase
    .from('case_credible_fear_drafts')
    .select('id, version, body_md, sources, generated_at, edited_by_diana')
    .eq('case_id', tokenData.case_id)
    .eq('is_current', true)
    .maybeSingle()

  if (!draft) {
    return NextResponse.json({ draft: null })
  }

  return NextResponse.json({
    draft: {
      id: draft.id,
      version: draft.version,
      body_md: draft.body_md,
      sources: draft.sources ?? [],
      generated_at: draft.generated_at,
      edited_by_diana: draft.edited_by_diana,
    },
  })
}
