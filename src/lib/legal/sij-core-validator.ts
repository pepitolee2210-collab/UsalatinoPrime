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
 *
 * Las reglas de intake_coversheet y las reglas estrictas por estado están
 * desglosadas POR RUTA PROCEDIMENTAL: en NY+custody se exige GF-17, no
 * Form 6-1; el set de formularios es incompatible entre rutas.
 */

import type { UsStateCode } from '@/lib/timezones/us-states'
import type { JurisdictionResearchResult, RequiredForm } from './research-jurisdiction'
import type { ProceduralContext, ProceduralRoute } from './infer-procedural-route'

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
 * Patterns por familia para etapa 2 (merits). El matching es contra
 * `name + description_es` (lower-case) de cada entry en required_forms.
 */
const FAMILY_PATTERNS: Record<SIJCoreFamily, RegExp> = {
  // Coversheet/intake form (cualquier hoja administrativa que el clerk pide).
  // Solo se usa como fallback cuando no hay pattern específico por ruta.
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

/**
 * Patterns POR RUTA para validar que el commencement document de intake sea
 * el correcto. Cada ruta usa formularios incompatibles para abrir el caso:
 * en NY+custody el clerk pide GF-17, en NY+guardianship pide Form 6-1.
 *
 * El matching es contra `name + description_es` (lower-case) de cada entry
 * en `intake_packet.required_forms`.
 */
const INTAKE_PATTERNS_BY_ROUTE: Record<ProceduralRoute, RegExp> = {
  custody: /petition.*(?:custody|visitation)|gf-?\s*17|general\s+form\s+17|custody\s+petition|fl-?260|fl-?200|fl-?300|sapcr\s+by\s+parent|petition\s+for\s+concurrent\s+custody/i,
  guardianship: /petition.*(?:guardian|appointment)|guardianship\s+petition|form\s+6-?1|ocfs-?3909|gc-?210|gc-?212|fm-?sapcr-?aff-?100|form\s+12\.961|permanent\s+guardianship/i,
  surrogate_17a: /17-?a|article\s+17[-\s]?a|surrogate.*guardian|developmental\s+disabilit/i,
  juvenile_dependency: /article\s+10|dependency\s+petition|cps\s+petition|jv-?356|jv-?357/i,
}

/** Etiqueta humana del documento esperado por ruta (para warnings). */
const INTAKE_LABELS_BY_ROUTE: Record<ProceduralRoute, string> = {
  custody: 'Petition for Custody (commencement document de custody)',
  guardianship: 'Petition for Appointment as Guardian (commencement document de guardianship)',
  surrogate_17a: '17-A Petition (Surrogate Court)',
  juvenile_dependency: 'Dependency Petition / SIJ Findings Sheet',
}

const FAMILY_LABELS_ES: Record<SIJCoreFamily, string> = {
  intake_coversheet: 'Documento de apertura del caso (Etapa 1)',
  merits_petition: 'Petición principal (guardianship/custody/SAPCR)',
  sij_motion_or_request: 'Notice of Motion for SIJ Findings',
  sij_affirmation_or_affidavit: 'Affirmation/Affidavit en apoyo del Motion',
  sij_proposed_order_with_findings: 'Proposed Order con SIJ Special Findings',
}

/**
 * Reglas estrictas adicionales por estado + ruta. Si la regla aplica y no se
 * encuentra el form requerido, marcamos missing aunque la familia genérica
 * haya pasado por otra entry. Esto previene falsos positivos (ej. en NY+custody
 * la IA podría devolver Form 6-1 que matchea merits_petition pero NO es el
 * commencement document correcto — el clerk de NY exige GF-17).
 */
const STATE_ROUTE_STRICT_RULES: Partial<Record<UsStateCode, Partial<Record<ProceduralRoute, {
  family: SIJCoreFamily
  /** Pattern aplicado a TODOS los forms (intake + merits) */
  requireForm: RegExp
  failureReason: string
}>>>> = {
  NY: {
    custody: {
      family: 'intake_coversheet',
      requireForm: /gf-?\s*17|general\s+form\s+17/i,
      failureReason: 'NY (custody) exige GF-17 (Petition for Custody/Visitation) como commencement document. Sin esto el clerk del Petition Room no abre el caso.',
    },
    guardianship: {
      family: 'intake_coversheet',
      requireForm: /form\s+6-?1|petition.*appointment.*guardian/i,
      failureReason: 'NY (guardianship) exige Form 6-1 (Petition for Appointment as Guardian). Es el commencement document en Family Court Article 6 Part 1.',
    },
  },
  TX: {
    custody: {
      family: 'sij_proposed_order_with_findings',
      requireForm: /motion.*sij\s+findings|order.*sij\s+findings|2019_order_sij|dfps.*sij/i,
      failureReason: 'TX exige el Motion + Order del DFPS Section 13 Tools (templates oficiales del Texas DFPS Attorneys Guide).',
    },
    guardianship: {
      family: 'sij_proposed_order_with_findings',
      requireForm: /motion.*sij\s+findings|order.*sij\s+findings|2019_order_sij|dfps.*sij/i,
      failureReason: 'TX exige el Motion + Order del DFPS Section 13 Tools (templates oficiales del Texas DFPS Attorneys Guide).',
    },
  },
}

function joinSearchable(form: RequiredForm): string {
  return `${form.name ?? ''} ${form.description_es ?? ''}`.toLowerCase()
}

function familyPresent(family: SIJCoreFamily, forms: RequiredForm[]): boolean {
  const pattern = FAMILY_PATTERNS[family]
  return forms.some(f => pattern.test(joinSearchable(f)))
}

function intakeRoutePresent(route: ProceduralRoute, forms: RequiredForm[]): boolean {
  const pattern = INTAKE_PATTERNS_BY_ROUTE[route]
  return forms.some(f => pattern.test(joinSearchable(f)))
}

/**
 * Valida que el resultado de la investigación contenga las familias core
 * SIJS Fase 1 para la ruta procedimental inferida.
 *
 * Las familias `merits_petition`, `sij_motion_or_request`,
 * `sij_affirmation_or_affidavit` y `sij_proposed_order_with_findings` se
 * buscan en `required_forms` (etapa 2 — merits, fuera del scope inmediato
 * pero validado por consistencia).
 *
 * `intake_coversheet` se valida con el pattern POR RUTA: en custody busca
 * GF-17/petitions de custody; en guardianship busca Form 6-1/OCFS-3909/etc.
 * Si el estado documenta explícitamente que no exige coversheet
 * (notes lo dice), no lo marcamos missing.
 */
export function validateSIJCorePackage(
  result: JurisdictionResearchResult,
  stateCode: UsStateCode,
  procedural: ProceduralContext,
): SIJCoreCheck {
  const missing: SIJCoreFamily[] = []
  const warnings: string[] = []

  const meritsForms = result.required_forms ?? []
  const intakeForms = result.intake_packet?.required_forms ?? []
  const intakeNotes = (result.intake_packet?.notes ?? '').toLowerCase()

  // Familias de merits (etapa 2 — usadas para validar consistencia general
  // aunque el scope inmediato es intake).
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

  // Familia de intake POR RUTA O por coversheet genérico estatal.
  // Razón: el commencement document puede ser específico de la ruta (NY
  // custody → GF-17; NY guardianship → Form 6-1) O un coversheet civil
  // estatal independiente de la ruta (TX → PR-GEN-116 Civil Case Information
  // Sheet; CA → CM-010 Civil Case Cover Sheet). Aceptamos cualquiera.
  //
  // Si el estado documenta que el commencement es la propia petition (caso
  // típico de NY guardianship donde Form 6-1 abre el caso), las notes lo
  // expresan y aceptamos eso como waiver.
  const intakeWaivedByNotes = /carta\s+libre|sin\s+coversheet|no\s+exige\s+coversheet|propia\s+petici[oó]n\s+(?:funciona|sirve)\s+como\s+(?:coversheet|apertura|commencement)|commencement\s+document/.test(intakeNotes)
  const hasRouteIntake = intakeRoutePresent(procedural.route, intakeForms)
  const hasGenericCoversheet = familyPresent('intake_coversheet', intakeForms)
  if (!intakeWaivedByNotes && !hasRouteIntake && !hasGenericCoversheet) {
    missing.push('intake_coversheet')
    warnings.push(
      `Falta ${INTAKE_LABELS_BY_ROUTE[procedural.route]} en intake_packet.required_forms ` +
      `(etapa 1 — ruta ${procedural.route}).`
    )
  }

  // Reglas estrictas por estado + ruta.
  const strictRule = STATE_ROUTE_STRICT_RULES[stateCode]?.[procedural.route]
  if (strictRule) {
    const allForms = [...meritsForms, ...intakeForms]
    const found = allForms.some(f => strictRule.requireForm.test(joinSearchable(f)))
    if (!found) {
      // Aseguramos que la familia esté en missing aunque la genérica haya pasado.
      if (!missing.includes(strictRule.family)) missing.push(strictRule.family)
      warnings.push(`[Regla estricta ${stateCode}/${procedural.route}] ${strictRule.failureReason}`)
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
 * pasarlas al retry prompt. El estado + ruta se usan para personalizar
 * (NY+custody → GF-17, NY+guardianship → Form 6-1, TX → DFPS, CA → GC-210, etc.).
 */
export function buildTargetedQueries(
  stateCode: UsStateCode,
  missing: SIJCoreFamily[],
  procedural: ProceduralContext,
): string[] {
  const queries: string[] = []
  const stateName = stateCode
  const route = procedural.route

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
        if (stateCode === 'NY' && route === 'custody') {
          queries.push('"GF-17" "Petition" "Custody" site:nycourts.gov')
          queries.push('"General Form 17" custody visitation New York site:nycourts.gov')
        } else if (stateCode === 'NY') {
          queries.push('"Petition for Appointment as Guardian" "Form 6-1" site:nycourts.gov')
        } else if (stateCode === 'TX') {
          queries.push('"FM-SAPCR-100" "Original Petition in SAPCR" site:texaslawhelp.org')
        } else if (stateCode === 'CA' && route === 'custody') {
          queries.push('"FL-260" Petition Custody Support Minor California site:courts.ca.gov')
        } else if (stateCode === 'CA') {
          queries.push('"GC-210" Petition for Guardianship California site:courts.ca.gov')
        } else {
          queries.push(`Petition for ${route === 'custody' ? 'Custody' : 'Appointment of Guardian'} minor ${stateName} site:.gov`)
        }
        break

      case 'intake_coversheet':
        if (stateCode === 'NY' && route === 'custody') {
          // Caso crítico — fallaba para Bielka. Forzar búsqueda de GF-17.
          queries.push('"GF-17" "Petition for Custody" site:nycourts.gov')
          queries.push('"General Form 17" Family Court Petition site:nycourts.gov')
        } else if (stateCode === 'NY' && route === 'guardianship') {
          queries.push('"Form 6-1" "Petition for Appointment as Guardian" site:nycourts.gov')
          queries.push('"OCFS-3909" "Request for Information Guardianship" site:ocfs.ny.gov')
        } else if (stateCode === 'NY') {
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
