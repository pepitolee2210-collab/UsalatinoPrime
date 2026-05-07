import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * GET /api/cases/[id]/jurisdiction-status
 *
 * Devuelve el estado de la jurisdicción del case para que el admin/employee
 * pueda verificarlo ANTES de disparar la generación de cartas legales. Esto
 * evita que el endpoint de generación intente auto-investigar sincrónicamente
 * (ese flujo puede tardar más que el maxDuration y dejar al frontend colgado).
 *
 * Respuesta:
 *   {
 *     ready: boolean,                        // true si la carta se puede generar
 *     status: 'completed'|'incomplete'|'pending'|'failed'|'missing',
 *     court_name: string | null,
 *     state_code: string | null,
 *     research_error: string | null
 *   }
 *
 * `ready` es true cuando hay un tribunal identificado (status `completed` o
 * `incomplete`), aunque el research todavía esté afinándose. La condición
 * mínima del prompt es saber a qué corte se va a presentar.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: caseId } = await params

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const service = createServiceClient()

  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.role !== 'employee') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { data: jurisdiction } = await service
    .from('case_jurisdictions')
    .select('research_status, court_name, state_code, research_error')
    .eq('case_id', caseId)
    .maybeSingle()

  if (!jurisdiction) {
    return NextResponse.json({
      ready: false,
      status: 'missing',
      court_name: null,
      state_code: null,
      research_error: null,
    })
  }

  const status = jurisdiction.research_status ?? 'missing'
  const ready = status === 'completed' || status === 'incomplete'

  return NextResponse.json({
    ready,
    status,
    court_name: jurisdiction.court_name ?? null,
    state_code: jurisdiction.state_code ?? null,
    research_error: jurisdiction.research_error ?? null,
  })
}
