/**
 * Validador del paquete core SIJS (Special Immigrant Juvenile Status) Fase 1.
 *
 * Aplica DESPUÉS de que la IA de jurisdicción retorna su mejor esfuerzo.
 * Detecta si faltan familias de documentos legalmente requeridas para que
 * USCIS no rechace el I-360 por orden estatal incompleta.
 *
 * Uso: el flujo de research llama validateSIJCorePackage() y, si retorna
 * gaps, dispara un retry dirigido al modelo con las queries específicas
 * que NO probó. Solo persistimos research_status='completed' cuando el
 * validador pasa. Si tras retry siguen faltando familias, queda
 * research_status='incomplete' con la lista en research_warnings.
 *
 * Las patterns son CONSERVADORAS — preferimos un falso negativo (perder
 * un caso bien investigado) que un falso positivo (dejar pasar uno
 * incompleto). El admin siempre puede re-verificar manualmente.
 */

import type { UsStateCode } from '@/lib/timezones/us-states'
import type { JurisdictionResearchResult, RequiredForm } from './research-jurisdiction'

/** Familias de documentos que un caso SIJS Fase 1 DEBE incluir. */
export type SIJCoreFamily =
  | 'intake_coversheet'
  | 'merits_petition'
  | 'sij_motion_or_request'
  | 'sij_affirmation_or_affidavit'
  | 'sij_proposed_order_with_findings'

export interface SIJCoreCheck {
  ok: boolean
  /** Familias detectadas como ausentes — vacío si todo OK. */
  missing: SIJCoreFamily[]
  /** Mensajes humanos para el admin (uno por gap). */
  warnings: string[]
}

/**
 * Patterns por familia. El matching es contra `name + description_es` (lower-case)
 * de cada entry en required_forms / intake_packet.required_forms.
 */
const FAMILY_PATTERNS: Record<SIJCoreFamily, RegExp> = {
  // Coversheet/intake form (cualquier hoja administrativa que el clerk pide).
  intake_coversheet: /coversheet|cover\s*sheet|civil\s+case\s+information|intake\s+form|identification\s+sheet|information\s+sheet|petition\s+room|case\s+initiation/i,

  // Petición sustantiva que abre el procedimiento (guardianship/custody/SAPCR/appointment).
  // Aceptamos variantes amplias porque cada estado nombra su petición distinto.
  merits_petition: /petition.*(?:guardian|custody|sapcr|appointment|conservatorship)|guardianship\s+petition|sapcr\s+petition/i,

  // Moción para que el juez emita los hallazgos especiales SIJS.
  // En TX se llama "DFPS Motion for Findings Regarding SIJ Status".
  sij_motion_or_request: /motion.*(?:findings|sij|special\s+immigrant)|request.*(?:sij|special\s+findings)/i,

  // Affidavit o Affirmation que sustenta los hechos (abuso/abandono/negligencia).
  sij_affirmation_or_affidavit: /(?:affirmation|affidavit|declaration).*(?:support|sij|findings|abuse|abandon|neglect|special\s+immigrant)/i,

  // Orden con los special findings (lo que USCIS exige adjunto al I-360).
  // En NY es GF-42, en TX es 2019_Order_SIJ_Findings.docx.
  sij_proposed_order_with_findings: /(?:proposed\s+order|order.*(?:special\s+findings|sij|sijs|findings\s+regarding\s+sij))|sijs?\s+order|gf-?\s*42|special\s+findings\s+order/i,
}

const FAMILY_LABELS_ES: Record<SIJCoreFamily, string> = {
  intake_coversheet: 'Coversheet/Intake form',
  merits_petition: 'Petición principal (guardianship/custody/SAPCR)',
  sij_motion_or_request: 'Notice of Motion for SIJ Findings',
  sij_affirmation_or_affidavit: 'Affirmation/Affidavit en apoyo del Motion',
  sij_proposed_order_with_findings: 'Proposed Order con SIJ Special Findings',
}

/**
 * Reglas estrictas adicionales por estado. Si la regla aplica y no se
 * encuentra el form requerido, marcamos missing aunque la familia genérica
 * (sij_proposed_order_with_findings) haya pasado por otra entry.
 */
const STATE_STRICT_RULES: Partial<Record<UsStateCode, {
  family: SIJCoreFamily
  requireForm: RegExp
  failureReason: string
}>> = {
  NY: {
    family: 'sij_proposed_order_with_findings',
    requireForm: /gf-?\s*42|special\s+findings\s+order|sijs?\s+order/i,
    failureReason: 'NY exige Special Findings Order (template GF-42 OCA). Sin esta orden, USCIS rechaza el I-360 automáticamente.',
  },
  TX: {
    family: 'sij_proposed_order_with_findings',
    requireForm: /motion.*sij\s+findings|order.*sij\s+findings|2019_order_sij|dfps.*sij/i,
    failureReason: 'TX exige el Motion + Order del DFPS Section 13 Tools (templates oficiales del Texas DFPS Attorneys Guide).',
  },
}

function joinSearchable(form: RequiredForm): string {
  return `${form.name ?? ''} ${form.description_es ?? ''}`.toLowerCase()
}

function familyPresent(family: SIJCoreFamily, forms: RequiredForm[]): boolean {
  const pattern = FAMILY_PATTERNS[family]
  return forms.some(f => pattern.test(joinSearchable(f)))
}

/**
 * Valida que el resultado de la investigación contenga las 5 familias core
 * SIJS Fase 1. Aplica reglas estrictas adicionales por estado.
 *
 * Las familias `merits_petition`, `sij_motion_or_request`,
 * `sij_affirmation_or_affidavit` y `sij_proposed_order_with_findings` se
 * buscan en `required_forms` (etapa 2 — merits).
 *
 * `intake_coversheet` se busca en `intake_packet.required_forms` (etapa 1
 * — intake). Si el estado documenta explícitamente que no exige coversheet
 * (notes lo dice), no lo marcamos missing.
 */
export function validateSIJCorePackage(
  result: JurisdictionResearchResult,
  stateCode: UsStateCode,
): SIJCoreCheck {
  const missing: SIJCoreFamily[] = []
  const warnings: string[] = []

  const meritsForms = result.required_forms ?? []
  const intakeForms = result.intake_packet?.required_forms ?? []
  const intakeNotes = (result.intake_packet?.notes ?? '').toLowerCase()

  // Familias de merits.
  const meritsFamilies: SIJCoreFamily[] = [
    'merits_petition',
    'sij_motion_or_request',
    'sij_affirmation_or_affidavit',
    'sij_proposed_order_with_findings',
  ]
  for (const family of meritsFamilies) {
    if (!familyPresent(family, meritsForms)) {
      missing.push(family)
      warnings.push(`Falta ${FAMILY_LABELS_ES[family]} en required_forms (etapa 2 — merits).`)
    }
  }

  // Familia de intake (más laxa: si las notes documentan que no aplica, OK).
  const intakeWaivedByNotes = /carta\s+libre|sin\s+coversheet|no\s+exige\s+coversheet|propia\s+petici[oó]n\s+(?:funciona|sirve)\s+como\s+(?:coversheet|apertura|commencement)|commencement\s+document/.test(intakeNotes)
  if (!intakeWaivedByNotes && !familyPresent('intake_coversheet', intakeForms)) {
    missing.push('intake_coversheet')
    warnings.push(`Falta ${FAMILY_LABELS_ES.intake_coversheet} en intake_packet.required_forms (etapa 1 — intake).`)
  }

  // Reglas estrictas por estado.
  const strictRule = STATE_STRICT_RULES[stateCode]
  if (strictRule) {
    const allForms = [...meritsForms, ...intakeForms]
    const found = allForms.some(f => strictRule.requireForm.test(joinSearchable(f)))
    if (!found) {
      // Aseguramos que la familia esté en missing aunque la genérica haya pasado.
      if (!missing.includes(strictRule.family)) missing.push(strictRule.family)
      warnings.push(`[Regla estricta ${stateCode}] ${strictRule.failureReason}`)
    }
  }

  return {
    ok: missing.length === 0,
    missing: Array.from(new Set(missing)),
    warnings,
  }
}

/**
 * Texto humano para los warnings persistidos en case_jurisdictions.
 * Lee `research_warnings` (JSONB array de SIJCoreFamily) y los traduce al
 * español para mostrar en el panel admin.
 */
export function describeMissingFamilies(missing: SIJCoreFamily[]): string[] {
  return missing.map(f => FAMILY_LABELS_ES[f] ?? f)
}

/**
 * Construye queries de web_search dirigidas a las familias faltantes para
 * pasarlas al retry prompt. El estado se usa para personalizar (NY → GF-42,
 * TX → DFPS, CA → GC-210/220, etc.).
 */
export function buildTargetedQueries(stateCode: UsStateCode, missing: SIJCoreFamily[]): string[] {
  const queries: string[] = []
  const stateName = stateCode

  for (const family of missing) {
    switch (family) {
      case 'sij_proposed_order_with_findings':
        if (stateCode === 'NY') {
          queries.push('"GF-42" "Special Findings" site:nycourts.gov')
          queries.push('"Special Findings Order" SIJS New York site:nycourts.gov')
        } else if (stateCode === 'TX') {
          queries.push('"Order Regarding SIJ Findings" site:dfps.texas.gov')
          queries.push('"2019_Order_SIJ_Findings" filetype:docx site:dfps.texas.gov')
        } else if (stateCode === 'CA') {
          queries.push('"Findings and Order" SIJ guardianship California site:courts.ca.gov')
          queries.push('"GC-220" OR "JV-356" Special Immigrant California site:courts.ca.gov')
        } else if (stateCode === 'FL') {
          queries.push('"Order on Petition for Special Immigrant Juvenile Status" Florida site:flcourts.gov')
        } else if (stateCode === 'IL') {
          queries.push('"SIJ Findings Order" Illinois site:illinoiscourts.gov')
        } else {
          queries.push(`"Special Findings Order" SIJ ${stateName} site:.gov`)
          queries.push(`"Proposed Order" SIJ findings ${stateName} site:.gov`)
        }
        break

      case 'sij_motion_or_request':
        if (stateCode === 'NY') {
          queries.push('"Motion for Special Findings" SIJS New York site:nycourts.gov')
          queries.push('"Notice of Motion" SIJ findings sample New York site:.gov OR site:.us')
        } else if (stateCode === 'TX') {
          queries.push('"Motion for Findings Regarding SIJ Status" site:dfps.texas.gov')
        } else {
          queries.push(`"Motion for SIJ Findings" ${stateName} site:.gov`)
          queries.push(`"Request for Special Findings" SIJ ${stateName} site:.gov`)
        }
        break

      case 'sij_affirmation_or_affidavit':
        if (stateCode === 'TX') {
          queries.push('"Affidavit to Support SIJ Motion" site:dfps.texas.gov')
        } else {
          queries.push(`"Affidavit in Support" SIJ findings ${stateName} site:.gov`)
          queries.push(`"Affirmation in Support of Motion" SIJ ${stateName} site:.gov OR site:.us`)
        }
        break

      case 'merits_petition':
        if (stateCode === 'NY') {
          queries.push('"Petition for Appointment as Guardian" "Form 6-1" site:nycourts.gov')
        } else if (stateCode === 'TX') {
          queries.push('"FM-SAPCR-100" "Original Petition in SAPCR" site:texaslawhelp.org')
        } else if (stateCode === 'CA') {
          queries.push('"GC-210" Petition for Guardianship California site:courts.ca.gov')
        } else {
          queries.push(`Petition for Appointment of Guardian minor ${stateName} site:.gov`)
        }
        break

      case 'intake_coversheet':
        if (stateCode === 'NY') {
          queries.push('"Family Court" intake "identification sheet" New York site:nycourts.gov')
        } else if (stateCode === 'TX') {
          queries.push('"Civil Case Information Sheet" "PR-GEN-116" site:texaslawhelp.org')
        } else {
          queries.push(`"family court coversheet" OR "civil case information" ${stateName} site:.gov`)
        }
        break
    }
  }

  // Dedupe preservando orden.
  return Array.from(new Set(queries))
}
