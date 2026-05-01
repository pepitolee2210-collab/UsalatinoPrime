import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const service = createServiceClient()

    const { data: profile } = await service
      .from('profiles')
      .select('role, employee_type')
      .eq('id', user.id)
      .single()

    // Admin siempre, y contracts_manager (Andrium) — su trabajo es justamente
    // generar el link de firma cuando arma un contrato. Antes solo admin podía
    // y le salía 'No autorizado' al intentarlo.
    const isAdmin = profile?.role === 'admin'
    const isContractsManager = profile?.role === 'employee' && profile?.employee_type === 'contracts_manager'
    if (!isAdmin && !isContractsManager) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { contract_id } = await request.json()
    if (!contract_id) {
      return NextResponse.json({ error: 'contract_id requerido' }, { status: 400 })
    }

    const token = crypto.randomUUID()

    const { error } = await service
      .from('contracts')
      .update({ signing_token: token, status: 'pendiente_firma' })
      .eq('id', contract_id)

    if (error) {
      console.error('Error generating signing link:', error)
      return NextResponse.json({ error: 'Error al generar enlace' }, { status: 500 })
    }

    const origin = new URL(request.url).origin
    const url = `${origin}/contrato/${token}`

    return NextResponse.json({ token, url }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
