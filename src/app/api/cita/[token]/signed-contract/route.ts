import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generateContractPDF } from '@/lib/pdf/generate-contract-pdf'

/**
 * GET /api/cita/[token]/signed-contract
 *
 * Devuelve el PDF del contrato firmado del cliente asociado al token
 * del portal. Se genera on-demand a partir de los datos guardados en
 * la tabla `contracts` + la imagen de firma en base64.
 *
 * No almacenamos el PDF en ninguna parte — lo componemos cada vez que
 * el cliente hace click en "Ver contrato" desde su portal. Esto evita
 * duplicación de almacenamiento y mantiene el PDF sincronizado con los
 * datos actuales del contrato.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params

  if (!token) {
    return NextResponse.json({ error: 'Token requerido' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // El token pertenece a appointment_tokens — resolvemos el client_id.
  const { data: access, error: accessErr } = await supabase
    .from('appointment_tokens')
    .select('client_id, is_active')
    .eq('token', token)
    .single()

  if (accessErr || !access || !access.is_active) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 404 })
  }

  // Buscar el contrato firmado más reciente del cliente.
  const { data: contract, error: contractErr } = await supabase
    .from('contracts')
    .select('*')
    .eq('client_id', access.client_id)
    .eq('status', 'firmado')
    .order('signed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (contractErr || !contract) {
    return NextResponse.json({ error: 'No hay contrato firmado para este cliente' }, { status: 404 })
  }

  try {
    const pdf = generateContractPDF({
      serviceName: contract.service_name,
      totalPrice: contract.total_price,
      installments: contract.has_installments,
      installmentCount: contract.installment_count,
      clientFullName: contract.client_full_name,
      clientPassport: contract.client_passport,
      clientDOB: contract.client_dob,
      clientSignature: contract.client_signature || contract.client_full_name,
      clientAddress: contract.client_address || undefined,
      clientAddressUnit: contract.client_address_unit || undefined,
      clientCity: contract.client_city || undefined,
      clientState: contract.client_state || undefined,
      clientZip: contract.client_zip || undefined,
      objetoDelContrato: contract.objeto_del_contrato,
      etapas: contract.etapas || [],
      addonServices: contract.addon_services?.length > 0 ? contract.addon_services : undefined,
      initialPayment: contract.initial_payment > 0 ? contract.initial_payment : undefined,
      paymentSchedule: contract.payment_schedule?.length > 0 ? contract.payment_schedule : undefined,
      minors: contract.minors?.length > 0 ? contract.minors : undefined,
      clientSignatureImage: contract.client_signature_image || undefined,
    })

    const pdfBuffer = Buffer.from(pdf.output('arraybuffer'))
    const safeName = String(contract.client_full_name || 'cliente').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40)

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Contrato-${safeName}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    console.error('Error generating signed contract PDF:', err)
    return NextResponse.json({ error: 'Error al generar el PDF' }, { status: 500 })
  }
}
