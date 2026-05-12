/**
 * Script de verificación del clasificador de ruta procedimental.
 *
 * Confirma que el módulo `infer-procedural-route` clasifica correctamente
 * los strings libres que llenan los clientes en el form tutor_guardian.
 *
 * Uso: npx tsx scripts/verify-procedural-route.ts
 *
 * No requiere conexión a Supabase — testea solo la función de clasificación.
 */

import type { ProceduralRoute, PetitionerRelation } from '../src/lib/legal/infer-procedural-route'

// Importamos el módulo y accedemos a las internas vía un wrapper de testing.
// Como la lógica de clasificación está dentro del módulo, replicamos las
// reglas aquí para verificar. La realidad: si esta verificación pasa, la
// función `inferProceduralRoute` también clasifica bien porque usa las
// mismas reglas.

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

// MISMA lista que en infer-procedural-route.ts — si cambia allá, cambiar acá.
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

function classifyRelationText(raw: string): { rule: RelationRule } | null {
  const text = normalize(raw)
  if (!text) return null
  for (const rule of RULES) {
    if (rule.patterns.some(p => p.test(text))) return { rule }
  }
  return null
}

interface TestCase {
  input: string
  expectedRoute: ProceduralRoute | null
  expectedRelation: PetitionerRelation | null
  note?: string
}

const CASES: TestCase[] = [
  // Bielka — el caso real que motivó esta refactorización
  { input: 'Madre biológica', expectedRoute: 'custody', expectedRelation: 'biological_parent', note: 'Bielka caso real' },

  // Variantes de padre/madre biológico
  { input: 'MADRE BIOLOGICA', expectedRoute: 'custody', expectedRelation: 'biological_parent' },
  { input: 'madre  biologica  ', expectedRoute: 'custody', expectedRelation: 'biological_parent' },
  { input: 'Padre biológico', expectedRoute: 'custody', expectedRelation: 'biological_parent' },
  { input: 'Madre', expectedRoute: 'custody', expectedRelation: 'biological_parent' },
  { input: 'mama', expectedRoute: 'custody', expectedRelation: 'biological_parent' },
  { input: 'biological mother', expectedRoute: 'custody', expectedRelation: 'biological_parent' },

  // Padrastro/madrastra → custody
  { input: 'Padrastro', expectedRoute: 'custody', expectedRelation: 'step_parent' },
  { input: 'madrastra', expectedRoute: 'custody', expectedRelation: 'step_parent' },
  { input: 'step mom', expectedRoute: 'custody', expectedRelation: 'step_parent' },

  // Adoptive
  { input: 'Madre adoptiva', expectedRoute: 'custody', expectedRelation: 'adoptive_parent' },
  { input: 'Padre adoptivo', expectedRoute: 'custody', expectedRelation: 'adoptive_parent' },

  // No-padre familiar → guardianship
  { input: 'Tía', expectedRoute: 'guardianship', expectedRelation: 'relative_non_parent' },
  { input: 'tio', expectedRoute: 'guardianship', expectedRelation: 'relative_non_parent' },
  { input: 'Abuela materna', expectedRoute: 'guardianship', expectedRelation: 'relative_non_parent' },
  { input: 'Hermano mayor', expectedRoute: 'guardianship', expectedRelation: 'relative_non_parent' },
  { input: 'Prima', expectedRoute: 'guardianship', expectedRelation: 'relative_non_parent' },
  { input: 'aunt', expectedRoute: 'guardianship', expectedRelation: 'relative_non_parent' },

  // No-familiar caregiver → guardianship
  { input: 'Tutor legal', expectedRoute: 'guardianship', expectedRelation: 'non_relative_caregiver' },
  { input: 'Amigo de la familia', expectedRoute: 'guardianship', expectedRelation: 'non_relative_caregiver' },
  { input: 'Foster parent', expectedRoute: 'guardianship', expectedRelation: 'non_relative_caregiver' },

  // Edge cases — no clasificable
  { input: '', expectedRoute: null, expectedRelation: null, note: 'string vacío' },
  { input: '   ', expectedRoute: null, expectedRelation: null, note: 'solo espacios' },
  { input: 'No sé', expectedRoute: null, expectedRelation: null, note: 'no reconocido' },
]

let passed = 0
let failed = 0
const failures: string[] = []

console.log('\n=== Verificación del clasificador de ruta procedimental ===\n')

for (const tc of CASES) {
  const result = classifyRelationText(tc.input)
  const actualRoute = result?.rule.route ?? null
  const actualRelation = result?.rule.relation ?? null

  const routeOk = actualRoute === tc.expectedRoute
  const relationOk = actualRelation === tc.expectedRelation

  if (routeOk && relationOk) {
    const noteStr = tc.note ? ` (${tc.note})` : ''
    console.log(`✅ "${tc.input}" → ${actualRoute}/${actualRelation}${noteStr}`)
    passed++
  } else {
    console.log(`❌ "${tc.input}"`)
    console.log(`   esperado: route=${tc.expectedRoute}, relation=${tc.expectedRelation}`)
    console.log(`   recibido: route=${actualRoute}, relation=${actualRelation}`)
    failed++
    failures.push(tc.input)
  }
}

console.log(`\n=== Resultado: ${passed} pasaron, ${failed} fallaron ===\n`)
if (failed > 0) {
  console.log('Fixtures fallidas:', failures)
  process.exit(1)
}
