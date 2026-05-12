import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import { createLogger } from '@/lib/logger'

const log = createLogger('infer-procedural-route')

/**
 * Ruta procedimental que se sigue en Fase 1 (custodia) de SIJS. Determina qué
 * formularios pide el clerk en la radicación de la presentación: una corte
 * Family Court de NY exige Form 6-1 + OCFS-3909 para guardianship pero solo
 * GF-17 cuando es custody, y el set cambia análogamente en CA/TX/FL. La
 * elección depende casi siempre de la relación del peticionario con el menor.
 */
export type ProceduralRoute =
  | 'custody'              // padre/madre biológica con padre ausente
  | 'guardianship'         // no-padre (familiar/cuidador) solicita tutela
  | 'surrogate_17a'        // NY only — Surrogate Court Article 17-A (raro)
  | 'juvenile_dependency'  // hay involucramiento de CPS/ACS

/**
 * Categoría de la relación peticionario↔menor. Se infiere a partir del campo
 * libre `relationship_to_minor` que llena el cliente en el tutor_guardian form.
 */
export type PetitionerRelation =
  | 'biological_parent'
  | 'step_parent'
  | 'adoptive_parent'
  | 'relative_non_parent'
  | 'non_relative_caregiver'
  | 'self_petitioner'      // 14+ años, raro
  | 'unknown'

export interface ProceduralContext {
  route: ProceduralRoute
  petitionerRelation: PetitionerRelation
  /** Frase corta en español que explica por qué se eligió la ruta. Audit log. */
  reasonForChoice: string
  confidence: 'high' | 'medium' | 'low'
  /** Texto literal capturado del form para que el admin pueda corregir/override. */
  rawRelationshipText: string | null
}

/**
 * Normaliza un string para comparación case/accent-insensitive: quita acentos,
 * lower-case, colapsa espacios. Necesario porque los clientes escriben
 * "Madre biológica", "MADRE BIOLOGICA", "madre  biologica ", etc.
 */
function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

interface RelationRule {
  patterns: RegExp[]
  relation: PetitionerRelation
  route: ProceduralRoute
  label: string
}

/**
 * Reglas evaluadas en orden — primer match gana. El orden importa: las reglas
 * más específicas (step_parent, adoptive_parent) van antes de las genéricas
 * (biological_parent) para que "madrastra" no caiga en "madre".
 */
const RULES: RelationRule[] = [
  {
    patterns: [/\bmadrastra\b/, /\bpadrastro\b/, /\bstep\s*(mother|father|parent|mom|dad)\b/],
    relation: 'step_parent',
    route: 'custody',
    label: 'padre/madre político',
  },
  {
    patterns: [/\b(madre|padre|mama|papa)\s+adoptiv[oa]\b/, /\badoptive\s+(mother|father|parent)\b/],
    relation: 'adoptive_parent',
    route: 'custody',
    label: 'padre/madre adoptivo',
  },
  {
    patterns: [
      /\b(madre|padre|mama|papa)\s+biologic[oa]\b/,
      /\bbiologic[oa]\s+(madre|padre)\b/,
      /\bbiological\s+(mother|father|parent)\b/,
      /^(madre|padre|mama|papa|mom|mother|dad|father)$/,
    ],
    relation: 'biological_parent',
    route: 'custody',
    label: 'padre/madre biológico',
  },
  {
    patterns: [
      /\b(tio|tia|abuelo|abuela|hermano|hermana|primo|prima|sobrino|sobrina)\b/,
      /\baunt\b/, /\buncle\b/, /\bgrandparent\b/, /\bgrandmother\b/, /\bgrandfather\b/,
      /\bsibling\b/, /\bcousin\b/,
    ],
    relation: 'relative_non_parent',
    route: 'guardianship',
    label: 'familiar no-padre',
  },
  {
    patterns: [
      /\btutor\b/, /\bcustodio\b/, /\bguardian\b/, /\bcaregiver\b/,
      /\bamig[oa]\s+de\s+(la\s+)?familia\b/, /\bvecin[oa]\b/, /\bfamily\s+friend\b/,
      /\bneighbor\b/, /\bfoster\s+parent\b/,
    ],
    relation: 'non_relative_caregiver',
    route: 'guardianship',
    label: 'cuidador no familiar',
  },
  {
    patterns: [/\bself[-\s]?petitioner\b/, /\bel\s+propio\s+menor\b/, /\bla\s+propia\s+menor\b/],
    relation: 'self_petitioner',
    route: 'guardianship',
    label: 'menor peticiona por sí mismo',
  },
]

/**
 * Clasifica un string libre de relación. Si nada matchea, devuelve null para que
 * el caller decida el default conservador.
 */
function classifyRelationText(raw: string): { rule: RelationRule } | null {
  const text = normalize(raw)
  if (!text) return null
  for (const rule of RULES) {
    if (rule.patterns.some(p => p.test(text))) return { rule }
  }
  return null
}

/**
 * Infiere la ruta procedimental para Fase 1 (custodia) leyendo el form
 * `tutor_guardian` del caso. Detecta override por involucramiento de CPS si
 * existe un form_type='cps_involvement' con `has_cps_case=true`.
 *
 * Default conservador cuando no se detecta nada: guardianship con confidence
 * 'low' — devuelve más formularios y deja al admin re-verificar después de
 * corregir el form del cliente.
 */
export async function inferProceduralRoute(
  caseId: string,
  client?: SupabaseClient,
): Promise<ProceduralContext> {
  const supabase = client ?? createServiceClient()

  const { data: rows } = await supabase
    .from('case_form_submissions')
    .select('form_type, form_data')
    .eq('case_id', caseId)
    .in('form_type', ['tutor_guardian', 'cps_involvement'])

  const tutorForm = rows?.find(r => r.form_type === 'tutor_guardian')?.form_data as Record<string, unknown> | undefined
  const cpsForm = rows?.find(r => r.form_type === 'cps_involvement')?.form_data as Record<string, unknown> | undefined

  // Override: si el menor está en sistema CPS/ACS, la ruta es dependency
  // independientemente de quién peticiona — la corte juvenil/family court
  // tiene jurisdicción a través del DSS.
  if (cpsForm?.has_cps_case === true || cpsForm?.in_acs_care === true) {
    log.info('inferred juvenile_dependency override (CPS involvement)', { caseId })
    return {
      route: 'juvenile_dependency',
      petitionerRelation: 'unknown',
      reasonForChoice: 'Caso con involucramiento de CPS/ACS detectado en cps_involvement form → ruta juvenile_dependency',
      confidence: 'high',
      rawRelationshipText: null,
    }
  }

  const rawRelationship = typeof tutorForm?.relationship_to_minor === 'string'
    ? tutorForm.relationship_to_minor.trim()
    : null

  if (!rawRelationship) {
    log.info('no relationship_to_minor — defaulting to guardianship/low', { caseId })
    return {
      route: 'guardianship',
      petitionerRelation: 'unknown',
      reasonForChoice: 'No hay relationship_to_minor en tutor_guardian form → default conservador guardianship',
      confidence: 'low',
      rawRelationshipText: null,
    }
  }

  const classified = classifyRelationText(rawRelationship)
  if (!classified) {
    log.info('relationship_to_minor not recognized — defaulting', { caseId, raw: rawRelationship })
    return {
      route: 'guardianship',
      petitionerRelation: 'unknown',
      reasonForChoice: `relationship_to_minor='${rawRelationship}' no reconocido → default conservador guardianship (revisar manualmente)`,
      confidence: 'low',
      rawRelationshipText: rawRelationship,
    }
  }

  const { rule } = classified
  log.info('inferred procedural route', {
    caseId,
    route: rule.route,
    relation: rule.relation,
    raw: rawRelationship,
  })

  return {
    route: rule.route,
    petitionerRelation: rule.relation,
    reasonForChoice: `relationship_to_minor='${rawRelationship}' clasificado como ${rule.label} → ruta ${rule.route}`,
    confidence: 'high',
    rawRelationshipText: rawRelationship,
  }
}

/**
 * Etiqueta en español para mostrar al admin en el panel. Mantenida fuera de la
 * UI para que la lógica de presentación esté junto con la lógica de inferencia.
 */
export function prettyRouteLabel(route: ProceduralRoute | null | undefined): string {
  switch (route) {
    case 'custody': return 'Custodia (peticionario es padre/madre)'
    case 'guardianship': return 'Tutela (peticionario es familiar/cuidador)'
    case 'surrogate_17a': return 'Surrogate Court 17-A (NY)'
    case 'juvenile_dependency': return 'Juvenile Dependency (CPS/ACS)'
    default: return 'Sin determinar'
  }
}
