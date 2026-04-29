import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * POST /api/cita/[token]/documents/upload-confirm
 *
 * Versión nueva del confirm que acepta document_type_id (FK al catálogo
 * dinámico) y slot_label. Inyecta phase_when_uploaded automáticamente
 * desde cases.current_phase.
 *
 * Acepta múltiples formatos: PDF, JPG, PNG, WebP, HEIC.
 *
 * El upload del binario en sí va por el flujo existente
 * /api/upload-signed-url (signed URL) → Supabase Storage. Este endpoint
 * solo registra el documento en BD una vez subido.
 */

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  let body: {
    document_type_id?: number
    slot_label?: string | null
    file_path?: string
    file_name?: string
    file_size?: number
    file_type?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { document_type_id, file_path, file_name, file_size, file_type } = body
  const slot_label = body.slot_label ?? null

  if (!document_type_id || !file_path || !file_name) {
    return NextResponse.json({ error: 'document_type_id, file_path y file_name requeridos' }, { status: 400 })
  }

  if (file_type && !ALLOWED_MIME.has(file_type)) {
    return NextResponse.json({ error: `Formato no permitido: ${file_type}` }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: tokenData } = await supabase
    .from('appointment_tokens')
    .select('client_id, case_id, is_active')
    .eq('token', token)
    .single()

  if (!tokenData?.is_active) {
    return NextResponse.json({ error: 'Token inválido o inactivo' }, { status: 403 })
  }

  // Resolver fase actual del caso para snapshot
  const { data: caseRow } = await supabase
    .from('cases')
    .select('current_phase')
    .eq('id', tokenData.case_id)
    .single()

  // Validar que document_type_id existe y está activo
  const { data: docType } = await supabase
    .from('document_types')
    .select('id, code, slot_kind, max_slots, requires_translation')
    .eq('id', document_type_id)
    .eq('is_active', true)
    .single()

  if (!docType) {
    return NextResponse.json({ error: 'document_type_id no válido' }, { status: 400 })
  }

  // Si slot_kind=multiple_named, validar max_slots
  if (docType.slot_kind === 'multiple_named' && docType.max_slots) {
    const { count } = await supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('case_id', tokenData.case_id)
      .eq('document_type_id', document_type_id)
    if ((count ?? 0) >= docType.max_slots) {
      return NextResponse.json(
        { error: `Has alcanzado el máximo de ${docType.max_slots} archivos para este documento` },
        { status: 400 },
      )
    }
  }

  // Si slot_kind=dual_es_en, normalizar slot_label a 'es' o 'en'
  let normalizedSlot: string | null = slot_label
  if (docType.slot_kind === 'single') {
    normalizedSlot = null
  } else if (docType.slot_kind === 'dual_es_en') {
    normalizedSlot = slot_label === 'en' ? 'en' : 'es'
  } else if (docType.slot_kind === 'multiple_named') {
    if (!normalizedSlot || !normalizedSlot.trim()) {
      return NextResponse.json({ error: 'slot_label requerido para slot múltiple' }, { status: 400 })
    }
    normalizedSlot = normalizedSlot.trim().slice(0, 120)
  }

  const { data: insertedDoc, error: insertErr } = await supabase
    .from('documents')
    .insert({
      case_id: tokenData.case_id,
      client_id: tokenData.client_id,
      document_key: docType.code,            // mantener el código legible para retro-compat
      document_type_id: document_type_id,
      slot_label: normalizedSlot,
      phase_when_uploaded: caseRow?.current_phase ?? null,
      direction: 'client_to_admin',
      name: file_name,
      file_path,
      file_type: file_type || 'application/pdf',
      file_size: file_size ?? 0,
      status: 'uploaded',
    })
    .select('id, document_type_id, slot_label, name, file_type, file_size, status, rejection_reason, phase_when_uploaded, created_at')
    .single()

  if (insertErr) {
    return NextResponse.json({ error: 'Error al registrar documento' }, { status: 500 })
  }

  return NextResponse.json({ document: insertedDoc })
}
