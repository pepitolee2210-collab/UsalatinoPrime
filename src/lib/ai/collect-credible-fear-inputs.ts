// Recolección de las fuentes de datos del Miedo Creíble, extraída del route
// handler para que los workers async (v7) la reutilicen sin duplicar lógica.
//
// Reúne las fuentes "del cliente" (metadata + cuestionario M1-M11 + I-589 Part A
// + documentos OCRed + sworn declaration + evidence links del cliente/M9). NO
// hace la búsqueda Tavily de noticias: en v7 eso vive en build-news-appendix
// (Fase 3), con verificación de links y carátulas.

import type { SupabaseClient } from '@supabase/supabase-js'
import { extractDocumentsForCase } from '@/lib/ai/extract-documents'
import type { AsylumPersecutionType } from '@/lib/ai/web-search-tavily'
import {
  CREDIBLE_FEAR_QUESTIONNAIRE_SLUG,
  type CFAnswers,
  type CFUrlValue,
} from '@/lib/legal/asilo-miedo-creible-form-schema'
import { validateCaseBeforeGeneration } from '@/lib/asylum/validate-case-before-generation'
import { resolveApplicantCountry } from '@/lib/asylum/resolve-applicant-country'
import { isAsylumService, CLIENT_SWORN_DECLARATION_CODE } from '@/lib/services/asylum'
import type { BuildAnalysisUserPromptInput } from '@/lib/ai/credible-fear-prompt-v6'
import { createLogger } from '@/lib/logger'

const log = createLogger('collect-credible-fear-inputs')

export interface CollectedCredibleFearInputs {
  baseInputs: BuildAnalysisUserPromptInput
  country: string
  persecutionType: AsylumPersecutionType
  protectedGrounds: string[]
  /** Links de evidencia del cliente (case_evidence_urls + M9), para `sources`. */
  evidenceLinks: Array<{ url: string; title?: string | null }>
  answers: CFAnswers
  clientId: string
}

export type CollectResult =
  | { ok: true; data: CollectedCredibleFearInputs }
  | { ok: false; status: number; error: string; validation?: unknown }

export async function collectCredibleFearInputs(
  caseId: string,
  service: SupabaseClient,
): Promise<CollectResult> {
  // 1. Caso + servicio + cliente
  const { data: caseRow } = await service
    .from('cases')
    .select(`
      id, current_phase, client_id,
      service:service_catalog(slug),
      client:profiles!cases_client_id_fkey(
        first_name, last_name, middle_name, a_number, date_of_birth,
        country_of_birth, nationality, last_entry_date, marital_status,
        preferred_language, address_street, address_city, address_state, address_zip
      )
    `)
    .eq('id', caseId)
    .single<{
      id: string
      current_phase: string | null
      client_id: string
      service: { slug: string } | { slug: string }[] | null
      client: {
        first_name: string | null; last_name: string | null; middle_name: string | null
        a_number: string | null; date_of_birth: string | null; country_of_birth: string | null
        nationality: string | null; last_entry_date: string | null; marital_status: string | null
        preferred_language: string | null; address_street: string | null; address_city: string | null
        address_state: string | null; address_zip: string | null
      } | null
    }>()
  if (!caseRow) return { ok: false, status: 404, error: 'Caso no encontrado' }

  const serviceSlug = Array.isArray(caseRow.service) ? caseRow.service[0]?.slug : caseRow.service?.slug
  if (!isAsylumService(serviceSlug)) {
    return { ok: false, status: 400, error: 'Solo aplica a Asilo Político (asilo-politico, reforzar-asilo)' }
  }

  // 2. Cuestionario M1-M11
  const { data: questionnaire } = await service
    .from('case_form_instances')
    .select('filled_values, client_submitted_at')
    .eq('case_id', caseId)
    .eq('form_name', CREDIBLE_FEAR_QUESTIONNAIRE_SLUG)
    .maybeSingle()
  const answers = (questionnaire?.filled_values as CFAnswers | undefined) ?? {}

  // 3. País canónico
  const resolved = await resolveApplicantCountry({ supabase: service, caseId, profile: caseRow.client })

  // 4. Validación pre-generación
  const validation = await validateCaseBeforeGeneration(service, caseId)
  if (!validation.ready) {
    return { ok: false, status: 400, error: 'El caso aún no está listo para generar el Miedo Creíble.', validation }
  }
  const effectiveCountry = resolved.country!

  // Tipo de persecución desde M3 grounds
  const grounds = Array.isArray(answers['m3_grounds']) ? (answers['m3_grounds'] as string[]) : []
  const answersBlob = JSON.stringify(answers).slice(0, 8000)
  const persecutionType: AsylumPersecutionType = grounds.includes('political_opinion')
    ? 'political'
    : grounds.includes('religion')
    ? 'religious'
    : grounds.includes('particular_social_group') && /\blgbt|gay|lesbi|trans/i.test(answersBlob)
    ? 'lgbtq'
    : grounds.includes('particular_social_group') && /\bgang|pandilla|tren de aragua|mara/i.test(answersBlob)
    ? 'gang'
    : grounds.includes('particular_social_group') && /\bmujer|gender|violenc.*domestic|domestic violence/i.test(answersBlob)
    ? 'gender_violence'
    : 'general'

  // 5. I-589 Parte A
  const { data: i589Subs } = await service
    .from('case_form_submissions')
    .select('form_type, form_data')
    .eq('case_id', caseId)
    .in('form_type', ['i589_part_a1', 'i589_part_a2', 'i589_part_a3', 'i589_part_a4'])
    .eq('minor_index', 0)
    .returns<{ form_type: string; form_data: Record<string, unknown> | null }[]>()
  const i589Merged: Record<string, unknown> = {}
  for (const s of i589Subs ?? []) Object.assign(i589Merged, s.form_data ?? {})

  const fullName = [caseRow.client?.first_name, caseRow.client?.middle_name, caseRow.client?.last_name]
    .filter(Boolean).join(' ').trim()
  const dateEnteredUs =
    (typeof i589Merged.date_entered_us === 'string' ? i589Merged.date_entered_us : null) ??
    caseRow.client?.last_entry_date ?? null
  const daysSinceEntry = dateEnteredUs
    ? Math.floor((Date.now() - new Date(dateEnteredUs).getTime()) / 86_400_000)
    : null

  // 6. Documentos OCRed
  await extractDocumentsForCase(caseId).catch((err) => {
    log.warn('extract docs falló (continuando)', { caseId, err: String(err) })
  })
  const { data: docs } = await service
    .from('documents')
    .select(`id, name, document_key, extracted_text, document_type:document_types(code, name_es, category_code)`)
    .eq('case_id', caseId)
    .order('created_at', { ascending: true })
    .returns<{
      id: string; name: string | null; document_key: string; extracted_text: string | null
      document_type: { code: string; name_es: string; category_code: string } | { code: string; name_es: string; category_code: string }[] | null
    }[]>()

  const docsWithText = (docs ?? []).filter((d) => d.extracted_text && d.extracted_text.length > 50)
  const docCode = (d: (typeof docsWithText)[number]): string => {
    const dt = Array.isArray(d.document_type) ? d.document_type[0] : d.document_type
    return dt?.code ?? dt?.category_code ?? 'unknown'
  }
  const swornDeclarationDocs = docsWithText.filter((d) => d.document_key === CLIENT_SWORN_DECLARATION_CODE)
  const swornDeclarationDoc = swornDeclarationDocs.length > 0 ? swornDeclarationDocs[swornDeclarationDocs.length - 1] : null
  const clientSwornDeclaration = swornDeclarationDoc
    ? { filename: swornDeclarationDoc.name ?? '(sin nombre)', text: swornDeclarationDoc.extracted_text ?? '' }
    : null
  const uploadedDocuments = docsWithText
    .filter((d) => d !== swornDeclarationDoc)
    .map((d) => ({
      document_id: d.id,
      filename: d.name ?? '(sin nombre)',
      declared_category: docCode(d),
      language: 'es',
      extracted_text: d.extracted_text ?? '',
    }))

  // 7. Evidence links del cliente (case_evidence_urls + M9 prefilled + M9 custom)
  const { data: clientUrls } = await service
    .from('case_evidence_urls')
    .select('url, title, description, source_domain')
    .eq('case_id', caseId)
    .order('added_at', { ascending: true })
  const clientEvidenceLinks = (clientUrls ?? []).map((u) => ({
    url: u.url, title: u.title ?? null, source_organization: u.source_domain ?? null,
    description: u.description ?? null, category: 'client_provided',
  }))

  const m9Selected = Array.isArray(answers['m9_prefilled_country_urls']) ? (answers['m9_prefilled_country_urls'] as string[]) : []
  let m9EvidenceLinks: typeof clientEvidenceLinks = []
  if (m9Selected.length > 0) {
    const { data: m9Rows } = await service
      .from('country_evidence_links')
      .select('url, url_title, source_organization, category')
      .in('url', m9Selected)
    m9EvidenceLinks = (m9Rows ?? []).map((r) => ({
      url: r.url, title: r.url_title, source_organization: r.source_organization,
      description: null, category: r.category,
    }))
  }

  const m9Custom = Array.isArray(answers['m9_custom_urls']) ? (answers['m9_custom_urls'] as CFUrlValue[]) : []
  const m9CustomLinks = m9Custom.map((u) => ({
    url: u.url, title: u.title ?? null, source_organization: null,
    description: u.category ?? null, category: u.category ?? 'other',
  }))

  const evidenceLinks = [...clientEvidenceLinks, ...m9EvidenceLinks, ...m9CustomLinks]

  const baseInputs: BuildAnalysisUserPromptInput = {
    applicantMetadata: {
      full_name: fullName || 'Solicitante',
      a_number: caseRow.client?.a_number,
      date_of_birth: caseRow.client?.date_of_birth,
      city_country_of_birth: resolved.country,
      current_nationality: caseRow.client?.nationality,
      date_entered_us: dateEnteredUs,
      port_of_entry: typeof i589Merged.port_of_entry === 'string' ? i589Merged.port_of_entry : null,
      days_since_entry: daysSinceEntry,
      marital_status: caseRow.client?.marital_status,
      current_us_address: [
        caseRow.client?.address_street, caseRow.client?.address_city,
        caseRow.client?.address_state, caseRow.client?.address_zip,
      ].filter(Boolean).join(', ') || null,
      native_language: caseRow.client?.preferred_language ?? 'es',
    },
    questionnaireResponsesJson: answers as Record<string, unknown>,
    uploadedDocuments,
    evidenceLinks,
    clientSwornDeclaration,
  }

  return {
    ok: true,
    data: {
      baseInputs,
      country: effectiveCountry,
      persecutionType,
      protectedGrounds: grounds,
      evidenceLinks: evidenceLinks.map((l) => ({ url: l.url, title: l.title ?? l.url })),
      answers,
      clientId: caseRow.client_id,
    },
  }
}
