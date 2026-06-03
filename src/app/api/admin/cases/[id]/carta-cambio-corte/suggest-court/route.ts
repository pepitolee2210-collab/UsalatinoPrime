// POST /api/admin/cases/[id]/carta-cambio-corte/suggest-court
//
// Sugiere la Nueva Corte (Change of Venue) + su Chief Counsel a partir de la
// nueva dirección del cliente, usando Claude anclado al catálogo EOIR curado.
// NO persiste: el staff revisa la sugerencia y decide aplicarla en el formulario.
// Solo admin/employee (el cliente no conoce la corte — es trabajo del staff).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { suggestCourtFromAddress, type NewAddressInput } from '@/lib/cambio-corte/suggest-court'
import { ensureCartaInstance } from '@/lib/cambio-corte/persistence'
import { createLogger } from '@/lib/logger'

const log = createLogger('suggest-court-endpoint')

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

  // La dirección puede venir en el body (valores actuales del form). Si no, se
  // lee de la instancia guardada como fallback.
  let body: { address?: NewAddressInput } = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  let addr: NewAddressInput = body.address ?? {}
  const hasAddr = [addr.street, addr.city, addr.state, addr.zip].some((s) => (s ?? '').trim())
  if (!hasAddr) {
    try {
      const instance = await ensureCartaInstance(caseId, auth.service)
      const v = (instance.filled_values ?? {}) as Record<string, string>
      addr = {
        street: v.new_address_street,
        city: v.new_address_city,
        state: v.new_address_state,
        zip: v.new_address_zip,
      }
    } catch (err) {
      log.warn('could not load instance for fallback address', { caseId, err: err instanceof Error ? err.message : err })
    }
  }

  try {
    const suggestion = await suggestCourtFromAddress(addr)
    return NextResponse.json(suggestion)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al sugerir la corte' },
      { status: 500 },
    )
  }
}
