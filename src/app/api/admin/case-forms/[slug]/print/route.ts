// API genérica de impresión: rellena el PDF del slug, lo sube a Storage,
// registra audit en `documents` y `case_activity`, y devuelve el blob.
//
// POST /api/admin/case-forms/[slug]/print  body: { caseId }

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { fillAcroForm } from '@/lib/legal/acroform-service'
import { AUTOMATED_FORMS } from '@/lib/legal/automated-forms-registry'
import { createLogger } from '@/lib/logger'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const log = createLogger('case-forms-print')

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

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const auth = await ensureAdminOrEmployee()
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { slug } = await ctx.params
  const def = AUTOMATED_FORMS[slug]
  if (!def) return NextResponse.json({ error: `Form '${slug}' no registrado` }, { status: 404 })

  let body: { caseId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const caseId = (body.caseId || '').trim()
  if (!caseId) return NextResponse.json({ error: 'caseId requerido' }, { status: 400 })

  const { data: caseRow, error: caseErr } = await auth.service
    .from('cases')
    .select('id, client_id, case_number')
    .eq('id', caseId)
    .single()
  if (caseErr || !caseRow) {
    return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
  }

  const { data: instance } = await auth.service
    .from('case_form_instances')
    .select('id, filled_values')
    .eq('case_id', caseId)
    .eq('packet_type', def.packetType)
    .eq('form_name', def.formName)
    .maybeSingle()

  // Cargar PDF + verificar SHA.
  const diskPath = path.join(process.cwd(), def.pdfDiskPath)
  let pdfBytes: Buffer
  try {
    pdfBytes = await fs.readFile(diskPath)
  } catch (err) {
    log.error('PDF base no encontrado en disco', { slug, diskPath, err: err instanceof Error ? err.message : err })
    return NextResponse.json({ error: 'PDF base no encontrado en el servidor' }, { status: 500 })
  }
  const actualSha = crypto.createHash('sha256').update(pdfBytes).digest('hex')
  if (actualSha !== def.pdfSha256) {
    log.error('PDF SHA mismatch — fuente actualizada sin re-mapear', {
      slug, expected: def.pdfSha256, actual: actualSha,
    })
    return NextResponse.json(
      {
        error: `PDF de ${slug} cambió desde el último mapeo. Re-ejecuta el script de inspección y actualiza PDF_SHA256.`,
        expected: def.pdfSha256,
        actual: actualSha,
      },
      { status: 500 }
    )
  }

  // Build effective values: hardcoded + prefill + saved (saved gana).
  const prefilled = await def.buildPrefilledValues(caseId, auth.service)
  const saved = (instance?.filled_values ?? {}) as Record<string, unknown>
  const effective: Record<string, string | boolean> = { ...def.hardcodedValues }
  for (const [k, v] of Object.entries(prefilled)) {
    if (typeof v === 'string' || typeof v === 'boolean') effective[k] = v
  }
  for (const [k, v] of Object.entries(saved)) {
    if (typeof v === 'string' || typeof v === 'boolean') effective[k] = v
  }

  // Verificar required.
  const missing = def.requiredForPrint.filter((k) => {
    const v = effective[k]
    return v === undefined || v === null || v === '' || v === false
  })
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: 'Faltan campos obligatorios',
        missingFields: missing,
        message: `Antes de imprimir, completa estos campos: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`,
      },
      { status: 400 }
    )
  }

  // Mapear semanticKey → pdfFieldName.
  const valuesByPdfName: Record<string, string | boolean> = {}
  for (const [semKey, value] of Object.entries(effective)) {
    const spec = def.fieldByKey[semKey]
    if (!spec || !spec.pdfFieldName) continue
    valuesByPdfName[spec.pdfFieldName] = value
  }

  const filledBytes = await fillAcroForm(new Uint8Array(pdfBytes), valuesByPdfName, { flatten: true })

  // Subir a Storage para audit.
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const storagePath = `${caseRow.client_id}/${caseRow.id}/${slug}/${timestamp}.pdf`
  const { error: uploadErr } = await auth.service.storage
    .from('case-documents')
    .upload(storagePath, filledBytes, {
      contentType: 'application/pdf',
      upsert: false,
    })
  if (uploadErr) {
    log.error('upload error', { slug, uploadErr: uploadErr.message })
  }

  const filename = `${slug}_${caseRow.case_number ?? caseRow.id.slice(0, 8)}_${timestamp.slice(0, 10)}.pdf`
  if (!uploadErr) {
    await auth.service.from('documents').insert({
      case_id: caseRow.id,
      client_id: caseRow.client_id,
      document_key: `${slug}_filled`,
      name: `${def.formName} (rellenado)`,
      file_path: storagePath,
      file_type: 'application/pdf',
      file_size: filledBytes.length,
      status: 'uploaded',
      uploaded_by: auth.userId,
      direction: 'admin_to_client',
    })

    await auth.service
      .from('case_form_instances')
      .update({
        filled_pdf_path: storagePath,
        filled_pdf_generated_at: new Date().toISOString(),
        status: 'downloaded',
      })
      .eq('case_id', caseId)
      .eq('packet_type', def.packetType)
      .eq('form_name', def.formName)

    await auth.service.from('case_activity').insert({
      case_id: caseRow.id,
      actor_id: auth.userId,
      action: `${slug}_pdf_generated`,
      description: `Generó PDF ${def.formName} rellenado (${filename})`,
      metadata: {
        slug,
        instance_id: instance?.id,
        storage_path: storagePath,
        schema_version: def.schemaVersion,
        pdf_sha256: def.pdfSha256,
      },
      visible_to_client: false,
    })
  }

  return new NextResponse(Buffer.from(filledBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
