import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { generateTermsPDF } from '@/lib/pdf/generate-terms-pdf'
import { persistGeneratedCaseDocument } from '@/lib/documents/persist-generated-document'
import { logActivity, SUBCATEGORIES } from '@/lib/activity/log-activity'
import { TERMS_VERSION } from '@/lib/legal/terms-and-conditions'

export const maxDuration = 30

const DOCUMENT_KEY = 'terminos-y-condiciones_filled'

const BodySchema = z.object({
  signature_image: z
    .string()
    .startsWith('data:image/png;base64,', 'La firma debe ser una imagen PNG válida')
    .max(2_000_000, 'La firma es demasiado grande'),
  accepted: z.literal(true),
})

type ServiceClient = ReturnType<typeof createServiceClient>

/** Borra el documento (fila + blob) que ya habíamos creado, ante un fallo posterior. */
async function cleanupDocument(service: ServiceClient, documentId: string | null, storagePath: string) {
  try {
    if (documentId) await service.from('documents').delete().eq('id', documentId)
    if (storagePath) await service.storage.from('case-documents').remove([storagePath])
  } catch {
    // best-effort
  }
}

/**
 * GET /api/cita/[token]/terms-acceptance
 * Devuelve el estado de aceptación de la versión vigente de los T&C para el caso del token.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const service = createServiceClient()

  const { data: tokenData } = await service
    .from('appointment_tokens')
    .select('case_id, is_active')
    .eq('token', token)
    .single()

  if (!tokenData?.is_active) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 403 })
  }

  const { data: acceptance } = await service
    .from('case_terms_acceptances')
    .select('id, accepted_at, document_id, terms_version')
    .eq('case_id', tokenData.case_id)
    .eq('terms_version', TERMS_VERSION)
    .maybeSingle()

  return NextResponse.json({
    currentVersion: TERMS_VERSION,
    accepted: !!acceptance,
    acceptance: acceptance ?? null,
  })
}

/**
 * POST /api/cita/[token]/terms-acceptance
 * Registra la aceptación firmada: genera un PDF inmutable, lo almacena (visible en
 * "Documentos Oficiales") y guarda la pista de auditoría en case_terms_acceptances.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const service = createServiceClient()

  // 1. Resolver token → (client_id, case_id)
  const { data: tokenData } = await service
    .from('appointment_tokens')
    .select('client_id, case_id, is_active')
    .eq('token', token)
    .single()

  if (!tokenData?.is_active) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 403 })
  }
  const clientId = tokenData.client_id as string
  const caseId = tokenData.case_id as string

  // 2. Validar body
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud inválido' }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.issues }, { status: 400 })
  }
  const { signature_image } = parsed.data

  // 3. Idempotencia: ¿ya aceptó esta versión?
  const { data: existing } = await service
    .from('case_terms_acceptances')
    .select('id, accepted_at, document_id, terms_version')
    .eq('case_id', caseId)
    .eq('terms_version', TERMS_VERSION)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ alreadyAccepted: true, acceptance: existing }, { status: 200 })
  }

  // 4. Cargar datos autoritativos del caso y del cliente (no confiamos en input del cliente)
  const { data: caseRow, error: caseErr } = await service
    .from('cases')
    .select('id, case_number, current_phase, contract_id, service:service_catalog(name)')
    .eq('id', caseId)
    .single()
  if (caseErr || !caseRow) {
    return NextResponse.json({ error: 'No se encontró el caso' }, { status: 404 })
  }
  const svc = Array.isArray(caseRow.service) ? caseRow.service[0] : caseRow.service
  const serviceName = (svc as { name?: string } | null)?.name ?? 'Servicio'

  const { data: profile } = await service
    .from('profiles')
    .select('first_name, middle_name, last_name')
    .eq('id', clientId)
    .single()
  const clientFullName =
    [profile?.first_name, profile?.middle_name, profile?.last_name].filter(Boolean).join(' ').trim() || 'Cliente'

  // 5. Generar el PDF inmutable
  const acceptedAtISO = new Date().toISOString()
  let pdfBytes: Buffer
  try {
    const pdf = generateTermsPDF({
      clientFullName,
      serviceName,
      caseNumber: caseRow.case_number ?? '',
      acceptedDateISO: acceptedAtISO,
      termsVersion: TERMS_VERSION,
      clientSignatureImage: signature_image,
    })
    pdfBytes = Buffer.from(pdf.output('arraybuffer'))
  } catch (err) {
    console.error('Error generating T&C PDF:', err)
    return NextResponse.json({ error: 'Error al generar el documento' }, { status: 500 })
  }

  // 6. Persistir el documento (sube al bucket + fila en `documents` → "Documentos Oficiales")
  const persisted = await persistGeneratedCaseDocument({
    service,
    caseId,
    clientId,
    documentKey: DOCUMENT_KEY,
    name: 'Términos y Condiciones (firmados)',
    bytes: pdfBytes,
    contentType: 'application/pdf',
    direction: 'admin_to_client',
    phaseWhenUploaded: (caseRow.current_phase as string | null) ?? null,
    uploadedBy: null,
    storagePrefix: 'terminos-y-condiciones',
  })
  if (!persisted.ok) {
    console.error('Error persisting T&C document:', persisted.error)
    return NextResponse.json({ error: 'Error al almacenar el documento' }, { status: 500 })
  }

  // 7. Registrar la aceptación (auditoría). UNIQUE(case_id, terms_version) protege carreras.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const userAgent = request.headers.get('user-agent') ?? null

  const { data: acceptance, error: insertErr } = await service
    .from('case_terms_acceptances')
    .insert({
      case_id: caseId,
      client_id: clientId,
      contract_id: caseRow.contract_id ?? null,
      terms_version: TERMS_VERSION,
      signature_image,
      accepted_full_name: clientFullName,
      document_id: persisted.documentId,
      pdf_path: persisted.storagePath,
      ip_address: ip,
      user_agent: userAgent,
      accepted_at: acceptedAtISO,
    })
    .select('id, accepted_at, document_id, terms_version')
    .single()

  if (insertErr || !acceptance) {
    // Limpiamos el documento que acabamos de crear (evita duplicado huérfano).
    await cleanupDocument(service, persisted.documentId, persisted.storagePath)
    if (insertErr?.code === '23505') {
      // Carrera: otra solicitud ganó. Devolvemos el ganador.
      const { data: winner } = await service
        .from('case_terms_acceptances')
        .select('id, accepted_at, document_id, terms_version')
        .eq('case_id', caseId)
        .eq('terms_version', TERMS_VERSION)
        .maybeSingle()
      return NextResponse.json({ alreadyAccepted: true, acceptance: winner }, { status: 200 })
    }
    console.error('Error inserting terms acceptance:', insertErr?.message)
    return NextResponse.json({ error: 'Error al registrar la aceptación' }, { status: 500 })
  }

  // 8. Bitácora (fire-and-forget, solo metadata sin PII)
  await logActivity({
    caseId,
    category: 'document',
    subcategory: SUBCATEGORIES.TERMS_ACCEPTED,
    description: 'El cliente leyó, firmó y aceptó los Términos y Condiciones',
    metadata: {
      terms_version: TERMS_VERSION,
      acceptance_id: acceptance.id,
      document_id: persisted.documentId,
      storage_path: persisted.storagePath,
    },
    visibleToClient: true,
    actor: { kind: 'token', tokenType: 'cita', clientId },
    client: service,
  })

  return NextResponse.json(
    { success: true, acceptedAt: acceptance.accepted_at, documentId: persisted.documentId },
    { status: 200 },
  )
}
