// POST /api/admin/cases/[id]/carta-cambio-corte/suggest-doc-context
//
// Lee los documentos subidos por el cliente y redacta (con Claude) un párrafo en
// inglés legal que los referencie como prueba de la nueva residencia, para
// insertarlo en la moción (campo additional_context). El staff lo edita antes de
// generar el PDF. Solo admin/employee.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { suggestDocContext } from '@/lib/cambio-corte/suggest-doc-context'
import type { NewAddressInput } from '@/lib/cambio-corte/suggest-court'

export const maxDuration = 60

async function ensureAdminOrEmployee() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin' && profile?.role !== 'employee') return null
  return { userId: user.id, service }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await ensureAdminOrEmployee()
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id: caseId } = await ctx.params
  if (!caseId) return NextResponse.json({ error: 'caseId requerido' }, { status: 400 })

  let body: { address?: NewAddressInput; staffNote?: string } = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  try {
    const result = await suggestDocContext({
      caseId,
      newAddress: body.address,
      staffNote: body.staffNote,
    })
    if (!result.text) {
      return NextResponse.json(
        { error: 'No se encontraron documentos con texto legible para este caso. Sube los comprobantes y vuelve a intentar.' },
        { status: 422 },
      )
    }
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al generar el contexto documental' },
      { status: 500 },
    )
  }
}
