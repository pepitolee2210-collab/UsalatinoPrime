// Endpoint admin para la Carta de Cambio de Corte (6 págs, jsPDF).
//
// La lógica de persistence (ensureInstance + prefill + save) vive en
// src/lib/cambio-corte/persistence.ts y se comparte con el endpoint cliente
// /api/cita/[token]/carta-cambio-corte → cliente y admin escriben/leen de
// la misma fila case_form_instances (slug interno cc-carta-6pgs).
//
// GET  /api/admin/cases/[id]/carta-cambio-corte → carga values + prefill
// PUT  /api/admin/cases/[id]/carta-cambio-corte → upsert values
// POST /api/admin/cases/[id]/carta-cambio-corte → genera PDF + sube + audit

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generateCambioCorteLetter, type CartaCambioCorteData } from '@/lib/cambio-corte/letter-generator'
import {
  CARTA_FORM_KEY,
  ensureCartaInstance,
  buildCartaPrefill,
  saveCartaValues,
} from '@/lib/cambio-corte/persistence'
import { createLogger } from '@/lib/logger'
import { logActivity, SUBCATEGORIES } from '@/lib/activity/log-activity'

const log = createLogger('carta-cambio-corte-admin')

export const maxDuration = 30

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

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await ensureAdminOrEmployee()
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id: caseId } = await ctx.params
  if (!caseId) return NextResponse.json({ error: 'caseId requerido' }, { status: 400 })

  let instance
  try {
    instance = await ensureCartaInstance(caseId, auth.service)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }

  const prefill = await buildCartaPrefill(caseId, auth.service)
  const saved = (instance.filled_values ?? {}) as Partial<CartaCambioCorteData>

  return NextResponse.json({
    instance_id: instance.id,
    status: instance.status,
    filled_pdf_path: instance.filled_pdf_path,
    filled_pdf_generated_at: instance.filled_pdf_generated_at,
    updated_at: instance.updated_at,
    prefill,
    saved,
  })
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await ensureAdminOrEmployee()
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id: caseId } = await ctx.params
  if (!caseId) return NextResponse.json({ error: 'caseId requerido' }, { status: 400 })

  let body: { values?: Partial<CartaCambioCorteData> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  if (!body.values || typeof body.values !== 'object') {
    return NextResponse.json({ error: 'values requerido' }, { status: 400 })
  }

  try {
    await ensureCartaInstance(caseId, auth.service)
    const { updated_at } = await saveCartaValues(caseId, body.values, auth.service, 'admin')
    return NextResponse.json({ ok: true, updated_at })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await ensureAdminOrEmployee()
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id: caseId } = await ctx.params
  if (!caseId) return NextResponse.json({ error: 'caseId requerido' }, { status: 400 })

  const { data: caseRow, error: caseErr } = await auth.service
    .from('cases')
    .select('id, client_id, case_number, current_phase')
    .eq('id', caseId)
    .single()
  if (caseErr || !caseRow) {
    return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
  }

  let instance
  try {
    instance = await ensureCartaInstance(caseId, auth.service)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }

  const prefill = await buildCartaPrefill(caseId, auth.service)
  const saved = (instance.filled_values ?? {}) as Partial<CartaCambioCorteData>
  const effective: CartaCambioCorteData = { ...prefill, ...saved }

  // Validación mínima — sin estos campos la carta sale desformada
  const missing: string[] = []
  if (!effective.client_full_name.trim()) missing.push('client_full_name')
  if (!effective.file_number.trim()) missing.push('file_number')
  if (!effective.judge_name.trim()) missing.push('judge_name')
  if (!effective.next_hearing_date.trim()) missing.push('next_hearing_date')
  if (!effective.next_hearing_time.trim()) missing.push('next_hearing_time')
  if (!effective.current_court_street.trim()) missing.push('current_court_street')
  if (!effective.new_court_name.trim()) missing.push('new_court_name')
  if (missing.length > 0) {
    return NextResponse.json(
      { error: 'Faltan campos obligatorios', missingFields: missing },
      { status: 400 },
    )
  }

  let pdfBytes: Uint8Array
  try {
    pdfBytes = generateCambioCorteLetter(effective)
  } catch (err) {
    log.error('PDF gen error', { caseId, err: err instanceof Error ? err.message : err })
    return NextResponse.json({ error: 'Error generando el PDF' }, { status: 500 })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const storagePath = `${caseRow.client_id}/${caseRow.id}/${CARTA_FORM_KEY.slug_internal}/${timestamp}.pdf`
  const { error: uploadErr } = await auth.service.storage
    .from('case-documents')
    .upload(storagePath, pdfBytes, {
      contentType: 'application/pdf',
      upsert: false,
    })
  if (uploadErr) {
    log.error('upload error', { caseId, uploadErr: uploadErr.message })
  }

  const filename = `carta-cambio-corte_${caseRow.case_number ?? caseRow.id.slice(0, 8)}_${timestamp.slice(0, 10)}.pdf`

  if (!uploadErr) {
    await auth.service.from('documents').insert({
      case_id: caseRow.id,
      client_id: caseRow.client_id,
      document_key: `${CARTA_FORM_KEY.slug_internal}_filled`,
      name: `${CARTA_FORM_KEY.form_name} (generada)`,
      file_path: storagePath,
      file_type: 'application/pdf',
      file_size: pdfBytes.length,
      status: 'uploaded',
      uploaded_by: auth.userId,
      direction: 'admin_to_client',
      phase_when_uploaded: caseRow.current_phase ?? null,
    })

    await auth.service
      .from('case_form_instances')
      .update({
        filled_pdf_path: storagePath,
        filled_pdf_generated_at: new Date().toISOString(),
        status: 'downloaded',
      })
      .eq('case_id', caseId)
      .eq('packet_type', CARTA_FORM_KEY.packet_type)
      .eq('form_name', CARTA_FORM_KEY.form_name)

    await logActivity({
      caseId: caseRow.id,
      category: 'form',
      subcategory: SUBCATEGORIES.FORM_PDF_GENERATED,
      description: `Generó ${CARTA_FORM_KEY.form_name} (${filename})`,
      metadata: {
        slug: CARTA_FORM_KEY.slug_internal,
        template_type: 'jspdf-custom',
        instance_id: instance.id,
        storage_path: storagePath,
      },
      visibleToClient: false,
      actor: { kind: 'session', supabase: await createClient() },
      client: auth.service,
    })
  }

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
