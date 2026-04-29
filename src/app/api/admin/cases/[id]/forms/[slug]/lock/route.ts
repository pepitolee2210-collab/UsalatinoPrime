import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { AUTOMATED_FORMS } from '@/lib/legal/automated-forms-registry'

/**
 * POST /api/admin/cases/[id]/forms/[slug]/lock
 *
 * Toggle locked_for_client en case_form_instances. Cuando true, el cliente
 * recibe 423 al intentar PUT en /api/cita/[token]/forms/[slug].
 *
 * Body: { locked: boolean }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; slug: string }> },
) {
  const { id, slug } = await params

  const def = AUTOMATED_FORMS[slug]
  if (!def) return NextResponse.json({ error: 'Slug no válido' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Solo admin' }, { status: 403 })
  }

  let body: { locked?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }
  const locked = body.locked === true

  const { error } = await service
    .from('case_form_instances')
    .update({ locked_for_client: locked })
    .eq('case_id', id)
    .eq('form_name', def.formName)

  if (error) return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  return NextResponse.json({ ok: true, locked })
}
