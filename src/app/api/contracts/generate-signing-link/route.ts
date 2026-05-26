import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logActivity, SUBCATEGORIES } from '@/lib/activity/log-activity'

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

    // Admin siempre, y contracts_manager (Andrium) o senior_consultant (Vanessa,
    // asistida por Lex) — ambos roles tienen permitido generar link de firma.
    const isAdmin = profile?.role === 'admin'
    const isContractsManager = profile?.role === 'employee' && profile?.employee_type === 'contracts_manager'
    const isSeniorConsultant = profile?.role === 'employee' && profile?.employee_type === 'senior_consultant'
    if (!isAdmin && !isContractsManager && !isSeniorConsultant) {
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

    // Bitácora: link de firma creado. Buscamos el case vinculado (puede no existir aún).
    const { data: contract } = await service
      .from('contracts')
      .select('case_id, client_full_name')
      .eq('id', contract_id)
      .single()
    if (contract?.case_id) {
      await logActivity({
        caseId: contract.case_id,
        category: 'contract',
        subcategory: SUBCATEGORIES.CONTRACT_LINK_CREATED,
        description: `Se generó el link de firma del contrato para ${contract.client_full_name ?? 'el cliente'}`,
        metadata: { contract_id },
        visibleToClient: false,
        actor: { kind: 'session', supabase },
        client: service,
      })
    }

    return NextResponse.json({ token, url }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
