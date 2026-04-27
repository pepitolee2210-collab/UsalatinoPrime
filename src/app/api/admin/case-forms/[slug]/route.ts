// API genérica para cualquier formulario en el registry de automatización.
//
// GET  /api/admin/case-forms/[slug]?caseId=…
//   Crea fila en case_form_instances si no existe. Devuelve schema +
//   prefilledValues + savedValues.
//
// PUT  /api/admin/case-forms/[slug]
//   Body: { caseId, values, expectedUpdatedAt? }. Guarda con optimistic
//   concurrency. Valida con el Zod schema del slug.
//
// El slug se resuelve via AUTOMATED_FORMS registry. Slugs no registrados → 404.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { AUTOMATED_FORMS } from '@/lib/legal/automated-forms-registry'

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

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const auth = await ensureAdminOrEmployee()
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { slug } = await ctx.params
  const def = AUTOMATED_FORMS[slug]
  if (!def) return NextResponse.json({ error: `Form '${slug}' no registrado` }, { status: 404 })

  const caseId = (req.nextUrl.searchParams.get('caseId') || '').trim()
  if (!caseId) return NextResponse.json({ error: 'caseId requerido' }, { status: 400 })

  const { data: caseRow, error: caseErr } = await auth.service
    .from('cases')
    .select('id, client_id, case_number')
    .eq('id', caseId)
    .single()
  if (caseErr || !caseRow) {
    return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
  }

  const { data: existing } = await auth.service
    .from('case_form_instances')
    .select('id, filled_values, status, updated_at, filled_at, filled_pdf_path, filled_pdf_generated_at, acroform_schema')
    .eq('case_id', caseId)
    .eq('packet_type', def.packetType)
    .eq('form_name', def.formName)
    .maybeSingle()

  let instance = existing

  if (!instance) {
    const { data: created, error: insertErr } = await auth.service
      .from('case_form_instances')
      .insert({
        case_id: caseId,
        packet_type: def.packetType,
        form_name: def.formName,
        form_url_official: def.pdfPublicPath,
        form_description_es: def.formDescriptionEs,
        is_mandatory: true,
        schema_source: 'acroform',
        acroform_schema: { source: 'curated', version: def.schemaVersion, pdf_sha256: def.pdfSha256, slug: def.slug },
        filled_values: {},
        status: 'ready',
      })
      .select('id, filled_values, status, updated_at, filled_at, filled_pdf_path, filled_pdf_generated_at, acroform_schema')
      .single()
    if (insertErr || !created) {
      return NextResponse.json({ error: 'No se pudo crear la instancia', detail: insertErr?.message }, { status: 500 })
    }
    instance = created
  }

  const [prefilledValues, legalWarnings] = await Promise.all([
    def.buildPrefilledValues(caseId, auth.service),
    def.computeLegalWarnings ? def.computeLegalWarnings(caseId, auth.service) : Promise.resolve<string[]>([]),
  ])

  return NextResponse.json({
    slug: def.slug,
    formName: def.formName,
    formDescriptionEs: def.formDescriptionEs,
    instanceId: instance.id,
    status: instance.status,
    updatedAt: instance.updated_at,
    filledAt: instance.filled_at,
    filledPdfPath: instance.filled_pdf_path,
    filledPdfGeneratedAt: instance.filled_pdf_generated_at,
    schemaVersion: def.schemaVersion,
    pdfSha256: def.pdfSha256,
    schemaSections: def.sections,
    prefilledValues,
    savedValues: instance.filled_values ?? {},
    legalWarnings,
    case: {
      id: caseRow.id,
      caseNumber: caseRow.case_number,
      clientId: caseRow.client_id,
    },
  })
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const auth = await ensureAdminOrEmployee()
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { slug } = await ctx.params
  const def = AUTOMATED_FORMS[slug]
  if (!def) return NextResponse.json({ error: `Form '${slug}' no registrado` }, { status: 404 })

  let body: { caseId?: string; values?: unknown; expectedUpdatedAt?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const caseId = (body.caseId || '').trim()
  if (!caseId) return NextResponse.json({ error: 'caseId requerido' }, { status: 400 })

  const parsed = def.zodSchema.safeParse(body.values)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Valores inválidos', issues: parsed.error.issues.slice(0, 20) },
      { status: 400 }
    )
  }

  if (body.expectedUpdatedAt) {
    const { data: current } = await auth.service
      .from('case_form_instances')
      .select('updated_at')
      .eq('case_id', caseId)
      .eq('packet_type', def.packetType)
      .eq('form_name', def.formName)
      .maybeSingle()
    if (current && current.updated_at !== body.expectedUpdatedAt) {
      return NextResponse.json(
        { error: 'conflict', message: 'Otra persona modificó este formulario. Recarga.', actualUpdatedAt: current.updated_at },
        { status: 409 }
      )
    }
  }

  const { data: updated, error: upsertErr } = await auth.service
    .from('case_form_instances')
    .upsert(
      {
        case_id: caseId,
        packet_type: def.packetType,
        form_name: def.formName,
        form_url_official: def.pdfPublicPath,
        form_description_es: def.formDescriptionEs,
        is_mandatory: true,
        schema_source: 'acroform',
        acroform_schema: { source: 'curated', version: def.schemaVersion, pdf_sha256: def.pdfSha256, slug: def.slug },
        filled_values: parsed.data,
        filled_at: new Date().toISOString(),
        status: 'ready',
      },
      { onConflict: 'case_id,packet_type,form_name' }
    )
    .select('id, updated_at, filled_at')
    .single()

  if (upsertErr) {
    return NextResponse.json({ error: 'No se pudo guardar', detail: upsertErr.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    instanceId: updated.id,
    updatedAt: updated.updated_at,
    filledAt: updated.filled_at,
  })
}
