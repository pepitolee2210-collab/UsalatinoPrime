// Validación pre-generación del Miedo Creíble.
//
// Verifica que el cliente haya completado los inputs mínimos antes de
// permitir la llamada IA. Devuelve blockers (que impiden generar) y
// warnings (recomendaciones que no bloquean).

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  CREDIBLE_FEAR_QUESTIONNAIRE_SLUG,
  CREDIBLE_FEAR_QUESTIONNAIRE,
  calculateProgress,
  getApplicableModules,
  getVisibleQuestions,
  hasAnswerValue,
  type CFAnswers,
} from '@/lib/legal/asilo-miedo-creible-form-schema'
import { resolveApplicantCountry } from '@/lib/asylum/resolve-applicant-country'

export type ValidationSeverity = 'blocker' | 'warning'

export interface ValidationIssue {
  severity: ValidationSeverity
  module: string
  message: string
}

export interface ValidationResult {
  ready: boolean
  blockers: ValidationIssue[]
  warnings: ValidationIssue[]
  progress: ReturnType<typeof calculateProgress>
}

export async function validateCaseBeforeGeneration(
  supabase: SupabaseClient,
  caseId: string,
): Promise<ValidationResult> {
  const blockers: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []

  // 0. País de origen — necesario para Tavily, prompt v6 y narrativa I-589.
  //    Consulta M2 → wizard I-589 → ai_extracted_data → profile. Si todo está
  //    vacío, blocker accionable que apunta al campo más obvio para llenarlo.
  const resolvedCountry = await resolveApplicantCountry({ supabase, caseId, profile: null })
  if (!resolvedCountry.country) {
    blockers.push({
      severity: 'blocker',
      module: 'M2',
      message:
        'Aún no sabemos tu país de origen. Completa la pregunta "País donde naciste" en el Módulo 2 del cuestionario.',
    })
  }

  // 1. Identificación: al menos 1 documento de la categoría 'documentos_legales'
  //    (incluye pasaporte, cédula, I-94, NTA, parole).
  const { count: idCount } = await supabase
    .from('documents')
    .select('id, document_type:document_types!inner(category_code)', { count: 'exact', head: true })
    .eq('case_id', caseId)
    .eq('document_type.category_code', 'documentos_legales')

  if (!idCount || idCount === 0) {
    blockers.push({
      severity: 'blocker',
      module: 'documentos',
      message: 'Aún no has subido ningún documento de identificación (pasaporte, cédula, I-94, etc.).',
    })
  }

  // 2. Cuestionario M1-M11
  const { data: instance } = await supabase
    .from('case_form_instances')
    .select('filled_values')
    .eq('case_id', caseId)
    .eq('form_name', CREDIBLE_FEAR_QUESTIONNAIRE_SLUG)
    .maybeSingle()
  const answers = (instance?.filled_values as CFAnswers | undefined) ?? {}
  const progress = calculateProgress(answers)

  const applicable = getApplicableModules(answers)
  for (const mod of applicable) {
    const visible = getVisibleQuestions(mod, answers)
    const required = visible.filter((q) => q.required)
    if (required.length === 0) continue
    const answered = required.filter((q) => hasAnswerValue(answers[q.semanticKey], q.type))
    if (answered.length < required.length) {
      blockers.push({
        severity: 'blocker',
        module: mod.id,
        message: `${mod.numberLabel} (${mod.shortTitleEs}) tiene preguntas obligatorias sin responder (${answered.length}/${required.length}).`,
      })
    }
  }

  // 3. Si M1 indica > 1 año y M11 vacío → blocker explícito
  if (answers['m1_filed_more_than_year_ago'] === 'yes') {
    const m11 = CREDIBLE_FEAR_QUESTIONNAIRE.find((m) => m.id === 'M11')
    if (m11) {
      const m11Required = m11.questions.filter((q) => q.required !== false)
      const m11AnyFilled = m11.questions.some((q) =>
        hasAnswerValue(answers[q.semanticKey], q.type),
      )
      if (m11Required.length > 0 && !m11AnyFilled) {
        blockers.push({
          severity: 'blocker',
          module: 'M11',
          message:
            'Como llevas más de 1 año en EE. UU., el Módulo 11 (excepción al año) es obligatorio antes de generar.',
        })
      }
    }
  }

  // 4. Warnings (no bloquean, pero el cliente debería verlos)
  const { count: urlsCount } = await supabase
    .from('case_evidence_urls')
    .select('id', { count: 'exact', head: true })
    .eq('case_id', caseId)
  const m9Selected = Array.isArray(answers['m9_prefilled_country_urls'])
    ? (answers['m9_prefilled_country_urls'] as string[]).length
    : 0
  const m9Custom = Array.isArray(answers['m9_custom_urls'])
    ? (answers['m9_custom_urls'] as unknown[]).length
    : 0
  const totalEvidenceLinks = (urlsCount ?? 0) + m9Selected + m9Custom
  if (totalEvidenceLinks < 3) {
    warnings.push({
      severity: 'warning',
      module: 'M9',
      message:
        'Recomendamos al menos 3 enlaces de prensa o reportes de DD.HH. — refuerzan mucho el caso ante USCIS.',
    })
  }

  const witnesses = Array.isArray(answers['m5_witnesses'])
    ? (answers['m5_witnesses'] as unknown[]).length
    : 0
  if (witnesses === 0) {
    warnings.push({
      severity: 'warning',
      module: 'M5',
      message:
        'Cartas juradas de testigos fortalecen mucho el caso. Considera obtener 1-3 incluso por escrito básico.',
    })
  }

  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
    progress,
  }
}
