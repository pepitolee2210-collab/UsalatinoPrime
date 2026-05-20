// Endpoint custom para la Carta de Cambio de Corte (6 págs, jsPDF).
//
// No usa el motor genérico de case-forms porque no es un AcroForm: es un PDF
// generado programáticamente con jsPDF. Reusa `case_form_instances` con un
// slug interno `cc-carta-6pgs` (schema_source 'custom') como persistencia.
//
// GET  /api/admin/cases/[id]/carta-cambio-corte → carga values + prefill
// PUT  /api/admin/cases/[id]/carta-cambio-corte → upsert values
// POST /api/admin/cases/[id]/carta-cambio-corte → genera PDF + sube + audit
//
// Solo admin/empleado: el cliente NO ve este form en su portal /cita/[token].

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generateCambioCorteLetter, type CartaCambioCorteData } from '@/lib/cambio-corte/letter-generator'
import { createLogger } from '@/lib/logger'
import { logActivity, SUBCATEGORIES } from '@/lib/activity/log-activity'

const log = createLogger('carta-cambio-corte')

export const maxDuration = 30

const FORM_KEY = {
  slug: 'cc-carta-6pgs',
  packet_type: 'merits',
  form_name: 'Carta de Cambio de Corte (6 págs)',
  form_description_es: 'Moción de Change of Venue redactada en inglés legal — 6 páginas para presentar ante la Corte de Inmigración actual.',
  form_url_official: '', // no hay URL oficial: la carta es propia del consultor
}

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

function emptyValues(): CartaCambioCorteData {
  return {
    client_full_name: '',
    client_phone: '',
    client_address_street: '',
    client_address_city: '',
    client_address_state: '',
    client_address_zip: '',
    file_number: '',
    judge_name: '',
    next_hearing_date: '',
    next_hearing_time: '',
    current_court_name: '',
    current_court_street: '',
    current_court_city_state_zip: '',
    new_address_street: '',
    new_address_city: '',
    new_address_state: '',
    new_address_zip: '',
    new_court_name: '',
    new_court_street: '',
    new_court_city_state_zip: '',
    chief_counsel_address: '',
    document_date: new Date().toISOString().slice(0, 10),
    residence_proof_docs: [],
    beneficiaries: [],
  }
}

/**
 * Prefill: lee profile + última submission legacy de cambio_corte_submissions
 * matched por phone (si existe) + filled_values del EOIR-33 del mismo caso.
 */
async function buildPrefill(caseId: string, service: ReturnType<typeof createServiceClient>): Promise<CartaCambioCorteData> {
  const base = emptyValues()
  const caseRes = await service.from('cases').select('client_id').eq('id', caseId).single()
  const clientId = caseRes.data?.client_id ?? null
  if (!clientId) return base

  const profileRes = await service
    .from('profiles')
    .select('first_name, middle_name, last_name, phone, a_number, address_street, address_city, address_state, address_zip')
    .eq('id', clientId)
    .single()
  const profile = (profileRes.data ?? {}) as Record<string, string | null>

  const fullName = [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(' ').trim()
  base.client_full_name = fullName || base.client_full_name
  base.client_phone = profile.phone ?? ''
  base.client_address_street = profile.address_street ?? ''
  base.client_address_city = profile.address_city ?? ''
  base.client_address_state = profile.address_state ?? ''
  base.client_address_zip = profile.address_zip ?? ''
  base.file_number = profile.a_number ?? ''

  // Legacy: si Henry ya creó un cambio_corte_submissions a mano por phone, reusar
  if (base.client_phone) {
    const legacyRes = await service
      .from('cambio_corte_submissions')
      .select('*')
      .eq('client_phone', base.client_phone)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const legacy = (legacyRes.data ?? {}) as Record<string, unknown>
    if (legacy && Object.keys(legacy).length > 0) {
      base.file_number = (legacy.file_number as string) || base.file_number
      base.judge_name = (legacy.judge_name as string) || ''
      base.next_hearing_date = (legacy.next_hearing_date as string) || ''
      base.next_hearing_time = (legacy.next_hearing_time as string) || ''
      base.current_court_name = (legacy.current_court_name as string) || ''
      base.current_court_street = (legacy.current_court_street as string) || ''
      base.current_court_city_state_zip = (legacy.current_court_city_state_zip as string) || ''
      base.new_address_street = (legacy.new_address_street as string) || base.client_address_street
      base.new_address_city = (legacy.new_address_city as string) || base.client_address_city
      base.new_address_state = (legacy.new_address_state as string) || base.client_address_state
      base.new_address_zip = (legacy.new_address_zip as string) || base.client_address_zip
      base.new_court_name = (legacy.new_court_name as string) || ''
      base.new_court_street = (legacy.new_court_street as string) || ''
      base.new_court_city_state_zip = (legacy.new_court_city_state_zip as string) || ''
      base.chief_counsel_address = (legacy.chief_counsel_address as string) || ''
      const proofs = legacy.residence_proof_docs
      base.residence_proof_docs = Array.isArray(proofs) ? (proofs as string[]) : []
      const bens = legacy.beneficiaries
      base.beneficiaries = Array.isArray(bens)
        ? (bens as Array<{ full_name: string; file_number: string }>)
        : []
    }
  }

  return base
}

async function ensureInstance(caseId: string, service: ReturnType<typeof createServiceClient>) {
  const existing = await service
    .from('case_form_instances')
    .select('id, filled_values, status, locked_for_client, client_last_edit_at, client_submitted_at, filled_pdf_path, filled_pdf_generated_at, updated_at')
    .eq('case_id', caseId)
    .eq('packet_type', FORM_KEY.packet_type)
    .eq('form_name', FORM_KEY.form_name)
    .maybeSingle()
  if (existing.data) return existing.data

  const ins = await service
    .from('case_form_instances')
    .insert({
      case_id: caseId,
      packet_type: FORM_KEY.packet_type,
      form_name: FORM_KEY.form_name,
      form_description_es: FORM_KEY.form_description_es,
      form_url_official: FORM_KEY.form_url_official,
      is_mandatory: false,
      schema_source: 'custom',
      acroform_schema: null,
      filled_values: {},
      status: 'pending',
      locked_for_client: true, // admin-only
    })
    .select('id, filled_values, status, locked_for_client, client_last_edit_at, client_submitted_at, filled_pdf_path, filled_pdf_generated_at, updated_at')
    .single()
  if (ins.error || !ins.data) {
    log.error('failed to create instance', { caseId, err: ins.error?.message })
    throw new Error('No se pudo crear el formulario de carta')
  }
  return ins.data
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await ensureAdminOrEmployee()
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id: caseId } = await ctx.params
  if (!caseId) return NextResponse.json({ error: 'caseId requerido' }, { status: 400 })

  let instance
  try {
    instance = await ensureInstance(caseId, auth.service)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }

  const prefill = await buildPrefill(caseId, auth.service)
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
    await ensureInstance(caseId, auth.service)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }

  const upd = await auth.service
    .from('case_form_instances')
    .update({
      filled_values: body.values,
      status: 'ready',
      updated_at: new Date().toISOString(),
    })
    .eq('case_id', caseId)
    .eq('packet_type', FORM_KEY.packet_type)
    .eq('form_name', FORM_KEY.form_name)
    .select('updated_at')
    .single()
  if (upd.error) {
    log.error('update error', { caseId, err: upd.error.message })
    return NextResponse.json({ error: 'No se pudieron guardar los datos' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, updated_at: upd.data?.updated_at })
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
    instance = await ensureInstance(caseId, auth.service)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }

  const prefill = await buildPrefill(caseId, auth.service)
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
  const storagePath = `${caseRow.client_id}/${caseRow.id}/${FORM_KEY.slug}/${timestamp}.pdf`
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
      document_key: `${FORM_KEY.slug}_filled`,
      name: `${FORM_KEY.form_name} (generada)`,
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
      .eq('packet_type', FORM_KEY.packet_type)
      .eq('form_name', FORM_KEY.form_name)

    await logActivity({
      caseId: caseRow.id,
      category: 'form',
      subcategory: SUBCATEGORIES.FORM_PDF_GENERATED,
      description: `Generó ${FORM_KEY.form_name} (${filename})`,
      metadata: {
        slug: FORM_KEY.slug,
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
