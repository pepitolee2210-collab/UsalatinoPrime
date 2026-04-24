import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { detectAcroFormFields } from '@/lib/legal/acroform-service'
import { detectOcrSchema } from '@/lib/legal/acroform-ocr'
import { suggestFieldValues } from '@/lib/legal/acroform-suggestions'
import { createLogger } from '@/lib/logger'

const log = createLogger('case-forms/initialize')

interface FormSource {
  name: string
  url_official: string
  description_es: string
  is_mandatory: boolean
}

async function ensureAdminOrEmployee() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin' && profile?.role !== 'employee') return null
  return { userId: user.id, service: createServiceClient() }
}

/**
 * POST /api/admin/case-forms/initialize
 * Body: { caseId: string }
 *
 * Instancia los formularios del caso a partir de case_jurisdictions.
 * Para cada form (intake + merits) que no exista ya en case_form_instances,
 * crea una row con status='detecting' y lanza en background:
 *   1. Detectar AcroForm con pdf-lib
 *   2. Si falla, OCR con Gemini Vision
 *   3. Claude sugiere qué campos son SIJS-relevantes y qué valor poner
 *   4. Update status='ready' con acroform_schema enriquecido
 *
 * Retorna inmediato la lista de instances creadas (sin schema todavía).
 * El frontend pollea /list para ver cuando schema_source != 'pending'.
 */
export async function POST(req: NextRequest) {
  const auth = await ensureAdminOrEmployee()
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { caseId } = await req.json() as { caseId?: string }
  if (!caseId) return NextResponse.json({ error: 'caseId requerido' }, { status: 400 })

  const { service } = auth

  // 1. Leer la jurisdicción del caso (debe tener research_status='completed').
  const { data: jurisdiction } = await service
    .from('case_jurisdictions')
    .select('*')
    .eq('case_id', caseId)
    .maybeSingle()

  if (!jurisdiction || jurisdiction.research_status !== 'completed') {
    return NextResponse.json({
      error: 'La investigación de jurisdicción debe estar completa antes de inicializar los formularios',
      reason: 'jurisdiction_not_ready',
    }, { status: 400 })
  }

  // 2. Construir la lista de formularios de ambas etapas
  const intakeForms = ((jurisdiction.intake_required_forms as FormSource[]) || []).map(f => ({
    ...f,
    packet_type: 'intake' as const,
  }))
  const meritsForms = ((jurisdiction.required_forms as FormSource[]) || []).map(f => ({
    ...f,
    packet_type: 'merits' as const,
  }))

  const allForms = [...intakeForms, ...meritsForms]
  if (allForms.length === 0) {
    return NextResponse.json({
      created: [],
      message: 'La jurisdicción no tiene formularios rellenables conocidos.',
    })
  }

  // 3. Upsert ids (uniq por case_id + packet_type + form_name)
  const rows = allForms.map(f => ({
    case_id: caseId,
    packet_type: f.packet_type,
    form_name: f.name,
    form_url_official: f.url_official,
    form_description_es: f.description_es,
    is_mandatory: f.is_mandatory,
    schema_source: 'pending',
    status: 'detecting',
  }))

  const { data: inserted, error: insertErr } = await service
    .from('case_form_instances')
    .upsert(rows, { onConflict: 'case_id,packet_type,form_name', ignoreDuplicates: false })
    .select('id, case_id, packet_type, form_name, form_url_official, schema_source, status')

  if (insertErr) {
    log.error('upsert failed', insertErr)
    return NextResponse.json({ error: 'No se pudieron crear las instancias' }, { status: 500 })
  }

  const created = inserted || []

  // 4. Para cada instance que está en schema_source='pending', lanzar detección
  //    + AI suggestions en background. No await.
  const toProcess = created.filter(r => r.schema_source === 'pending')

  if (toProcess.length > 0) {
    // Cargar contexto del caso una sola vez
    const caseCtx = await buildCaseContext(service, caseId)

    after(async () => {
      for (const instance of toProcess) {
        try {
          log.info('detecting schema', { id: instance.id, form: instance.form_name })

          // Paso A: intentar AcroForm
          let fields: Awaited<ReturnType<typeof detectAcroFormFields>>['fields'] = []
          let source: 'acroform' | 'ocr_gemini' | 'failed' = 'failed'

          const acro = await detectAcroFormFields(instance.form_url_official)
          if (acro.source === 'acroform' && acro.fields.length > 0) {
            fields = acro.fields
            source = 'acroform'
          } else {
            // Paso B: fallback OCR Gemini
            try {
              fields = await detectOcrSchema(instance.form_url_official)
              source = 'ocr_gemini'
            } catch (ocrErr) {
              log.error('OCR failed', { id: instance.id, err: ocrErr })
              await service
                .from('case_form_instances')
                .update({
                  schema_source: 'failed',
                  schema_error: ocrErr instanceof Error ? ocrErr.message : 'OCR error',
                  status: 'failed',
                })
                .eq('id', instance.id)
              continue
            }
          }

          // Paso C: pedirle a Claude qué campos son SIJS-relevantes + sugerir valores
          let enriched = fields
          try {
            enriched = await suggestFieldValues(fields, caseCtx)
          } catch (suggestErr) {
            log.warn('suggestions failed, keeping raw schema', { err: suggestErr })
          }

          await service
            .from('case_form_instances')
            .update({
              acroform_schema: enriched,
              schema_source: source,
              schema_error: null,
              status: 'ready',
            })
            .eq('id', instance.id)

          log.info('form ready', { id: instance.id, fields: enriched.length, source })
        } catch (err) {
          log.error('instance processing failed', { id: instance.id, err })
          await service
            .from('case_form_instances')
            .update({
              schema_source: 'failed',
              schema_error: err instanceof Error ? err.message : 'Unknown error',
              status: 'failed',
            })
            .eq('id', instance.id)
        }
      }
    })
  }

  return NextResponse.json({
    created: created.length,
    instances: created,
    processing: toProcess.length,
  })
}

async function buildCaseContext(service: ReturnType<typeof createServiceClient>, caseId: string) {
  const { data: caseRow } = await service
    .from('cases')
    .select('case_number, client_id, form_data')
    .eq('id', caseId)
    .single()

  if (!caseRow) return {}

  const { data: profile } = await service
    .from('profiles')
    .select('first_name, last_name, date_of_birth, address_street, address_city, address_state, address_zip, passport_number')
    .eq('id', caseRow.client_id!)
    .single()

  const { data: contract } = await service
    .from('contracts')
    .select('client_full_name, client_passport, client_dob, client_address, client_city, client_state, client_zip, minors')
    .eq('client_id', caseRow.client_id!)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: jurisdiction } = await service
    .from('case_jurisdictions')
    .select('court_name')
    .eq('case_id', caseId)
    .maybeSingle()

  const formData = (caseRow.form_data || {}) as Record<string, string>

  return {
    caseNumber: caseRow.case_number,
    clientName: contract?.client_full_name || `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim(),
    clientPassport: contract?.client_passport || profile?.passport_number,
    clientDOB: contract?.client_dob || profile?.date_of_birth,
    clientAddress: contract?.client_address || profile?.address_street,
    clientCity: contract?.client_city || profile?.address_city,
    clientState: contract?.client_state || profile?.address_state,
    clientZip: contract?.client_zip || profile?.address_zip,
    minors: contract?.minors as Array<{ fullName: string; dob?: string; countryOfBirth?: string }> | undefined,
    courtName: jurisdiction?.court_name,
    motherName: formData.mother_first_name
      ? `${formData.mother_first_name} ${formData.mother_last_name ?? ''}`.trim()
      : null,
    fatherName: formData.father_first_name
      ? `${formData.father_first_name} ${formData.father_last_name ?? ''}`.trim()
      : null,
  }
}
