import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logActivity, SUBCATEGORIES } from '@/lib/activity/log-activity'

export async function POST(request: Request) {
  try {
    const { token, signature_image } = await request.json()

    if (!token || !signature_image) {
      return NextResponse.json(
        { error: 'Token y firma son requeridos' },
        { status: 400 }
      )
    }

    if (!signature_image.startsWith('data:image/png;base64,')) {
      return NextResponse.json(
        { error: 'Formato de firma inválido' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Find contract by signing token
    const { data: contract, error: findError } = await supabase
      .from('contracts')
      .select('id, status, case_id, client_id, client_full_name')
      .eq('signing_token', token)
      .single()

    if (findError || !contract) {
      return NextResponse.json(
        { error: 'Contrato no encontrado o enlace inválido' },
        { status: 404 }
      )
    }

    if (contract.status === 'firmado' || contract.status === 'activo' || contract.status === 'completado') {
      return NextResponse.json(
        { error: 'Este contrato ya fue firmado' },
        { status: 400 }
      )
    }

    const signedAt = new Date().toISOString()

    // Update contract with signature
    const { error: updateError } = await supabase
      .from('contracts')
      .update({
        client_signature_image: signature_image,
        status: 'firmado',
        signed_at: signedAt,
        signing_token: null, // Invalidate token after use
      })
      .eq('id', contract.id)

    if (updateError) {
      console.error('Error signing contract:', updateError)
      return NextResponse.json(
        { error: 'Error al firmar el contrato' },
        { status: 500 }
      )
    }

    // Bitácora: registrar firma del cliente. Solo si tenemos case vinculado
    // (contratos legacy puede tener case_id NULL).
    if (contract.case_id) {
      await logActivity({
        caseId: contract.case_id,
        category: 'contract',
        subcategory: SUBCATEGORIES.CONTRACT_SIGNED,
        description: `${contract.client_full_name ?? 'El cliente'} firmó el contrato`,
        metadata: { contract_id: contract.id, signed_at: signedAt },
        visibleToClient: true,
        actor: { kind: 'token', tokenType: 'contract', clientId: contract.client_id ?? undefined },
        client: supabase,
      })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
