import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generateContractPDF } from '@/lib/pdf/generate-contract-pdf'

/**
 * Después de firmar un contrato, persiste el PDF completo en Supabase
 * Storage y crea una entrada en `documents` asociada al cliente para
 * que pueda verlo en su portal (/cita/[token]). Falla silenciosamente
 * para no bloquear la firma si Storage tiene un problema transitorio —
 * el admin puede regenerar después.
 */
async function saveSignedContractPDF(opts: {
  contract: Record<string, any>
  signatureImage: string
  supabase: ReturnType<typeof createServiceClient>
}) {
  const { contract, signatureImage, supabase } = opts

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
      clientSignatureImage: signatureImage,
    })

    const pdfBuffer = Buffer.from(pdf.output('arraybuffer'))

    // Buscar el caso activo del cliente (si existe) para asociar el doc.
    let caseId: string | null = null
    if (contract.client_id) {
      const { data: activeCase } = await supabase
        .from('cases')
        .select('id')
        .eq('client_id', contract.client_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      caseId = activeCase?.id || null
    }

    // Path del storage — bajo el cliente + contract_id para ser idempotente.
    const safeName = contract.client_full_name.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40)
    const storagePath = contract.client_id
      ? `${contract.client_id}/contracts/${contract.id}_${safeName}.pdf`
      : `no-client/${contract.id}_${safeName}.pdf`

    const { error: uploadErr } = await supabase.storage
      .from('case-documents')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadErr) {
      console.error('Error uploading signed contract PDF:', uploadErr)
      return
    }

    // Si no hay caso ni client_id, no podemos crear entrada en `documents`
    // (tiene NOT NULL en al menos una de esas referencias). El PDF queda
    // igual en Storage — el admin puede rescatarlo por path.
    if (!caseId && !contract.client_id) return

    // Idempotencia: si ya había una entrada para este contrato, la
    // actualizamos en lugar de duplicar.
    const existing = await supabase
      .from('documents')
      .select('id')
      .eq('file_path', storagePath)
      .maybeSingle()

    if (existing.data?.id) {
      await supabase
        .from('documents')
        .update({
          name: `Contrato firmado — ${contract.service_name}`,
          file_size: pdfBuffer.length,
          status: 'approved',
        })
        .eq('id', existing.data.id)
    } else {
      await supabase.from('documents').insert({
        case_id: caseId,
        client_id: contract.client_id,
        document_key: 'signed_contract',
        name: `Contrato firmado — ${contract.service_name}`,
        file_path: storagePath,
        file_type: 'application/pdf',
        file_size: pdfBuffer.length,
        status: 'approved',
        direction: 'admin_to_client',
      })
    }
  } catch (err) {
    console.error('saveSignedContractPDF failed:', err)
    // no-throw — la firma ya se registró, el PDF puede regenerarse después
  }
}

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

    // Cargar contrato completo (no solo id+status) para poder regenerar el PDF.
    const { data: contract, error: findError } = await supabase
      .from('contracts')
      .select('*')
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

    // Persistir el PDF firmado en Storage + tabla documents. Esto es
    // idempotente y non-blocking — si falla, la firma quedó registrada.
    await saveSignedContractPDF({
      contract: { ...contract, client_signature_image: signature_image },
      signatureImage: signature_image,
      supabase,
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
