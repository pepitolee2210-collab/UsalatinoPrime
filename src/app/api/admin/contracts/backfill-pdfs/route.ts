import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generateContractPDF } from '@/lib/pdf/generate-contract-pdf'
import { createLogger } from '@/lib/logger'

const log = createLogger('contracts-backfill')

/**
 * Backfill de PDFs para contratos ya firmados pre-feature. Para cada
 * contrato firmado que aún no tiene su PDF guardado en Storage, lo
 * genera + sube + crea entrada en `documents`. Idempotente.
 *
 * Solo admin puede disparar esto. Procesa en lotes de 20 para no
 * exceder el timeout del serverless.
 */
export async function POST(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Solo admin' }, { status: 403 })
  }

  const service = createServiceClient()

  // Buscar contratos firmados que aún no tengan un documento 'signed_contract' asociado.
  const { data: contracts, error } = await service
    .from('contracts')
    .select('*')
    .eq('status', 'firmado')
    .not('client_signature_image', 'is', null)
    .not('client_id', 'is', null)
    .order('signed_at', { ascending: false })
    .limit(20)

  if (error || !contracts) {
    return NextResponse.json({ error: 'No se pudieron cargar los contratos' }, { status: 500 })
  }

  const results: Array<{ id: string; status: 'done' | 'skipped' | 'error'; reason?: string }> = []

  for (const contract of contracts) {
    try {
      const safeName = String(contract.client_full_name || 'cliente').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40)
      const storagePath = `${contract.client_id}/contracts/${contract.id}_${safeName}.pdf`

      // Skip if already in documents table
      const { data: existing } = await service
        .from('documents')
        .select('id')
        .eq('file_path', storagePath)
        .maybeSingle()

      if (existing?.id) {
        results.push({ id: contract.id, status: 'skipped', reason: 'already exists' })
        continue
      }

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

      const { error: uploadErr } = await service.storage
        .from('case-documents')
        .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

      if (uploadErr) {
        results.push({ id: contract.id, status: 'error', reason: uploadErr.message })
        continue
      }

      const { data: activeCase } = await service
        .from('cases')
        .select('id')
        .eq('client_id', contract.client_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      await service.from('documents').insert({
        case_id: activeCase?.id || null,
        client_id: contract.client_id,
        document_key: 'signed_contract',
        name: `Contrato firmado — ${contract.service_name}`,
        file_path: storagePath,
        file_type: 'application/pdf',
        file_size: pdfBuffer.length,
        status: 'approved',
        direction: 'admin_to_client',
      })

      results.push({ id: contract.id, status: 'done' })
    } catch (err) {
      log.error('backfill error', { id: contract.id, err })
      results.push({ id: contract.id, status: 'error', reason: err instanceof Error ? err.message : 'unknown' })
    }
  }

  const summary = {
    total: results.length,
    done: results.filter(r => r.status === 'done').length,
    skipped: results.filter(r => r.status === 'skipped').length,
    errors: results.filter(r => r.status === 'error').length,
  }

  return NextResponse.json({ summary, results })
}
