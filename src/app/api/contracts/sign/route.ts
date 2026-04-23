import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

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
      .select('id, status')
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

    // Update contract with signature
    const { error: updateError } = await supabase
      .from('contracts')
      .update({
        client_signature_image: signature_image,
        status: 'firmado',
        signed_at: new Date().toISOString(),
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

    return NextResponse.json({ success: true }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
