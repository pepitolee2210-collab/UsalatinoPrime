/**
 * Script de verificación del validador SIJS core.
 *
 * Corre fixtures contra `validateSIJCorePackage` para confirmar que detecta
 * correctamente las familias faltantes en el caso real de Bielka (Kings
 * County, NY) y que no genera falsos positivos en los condados de NY que
 * sí tienen el set completo (Bronx, Queens, Nassau, Rockland).
 *
 * Uso: tsx scripts/verify-sij-validator.ts
 *
 * (Si tsx no está instalado: npx tsx scripts/verify-sij-validator.ts)
 *
 * No requiere conexión a Supabase ni a Anthropic — son fixtures inline.
 */

import { validateSIJCorePackage, buildTargetedQueries } from '../src/lib/legal/sij-core-validator'
import type { JurisdictionResearchResult, RequiredForm } from '../src/lib/legal/research-jurisdiction'
import type { UsStateCode } from '../src/lib/timezones/us-states'

interface TestCase {
  name: string
  stateCode: UsStateCode
  forms: { name: string; description?: string; mandatory?: boolean }[]
  intakeForms: { name: string; description?: string; mandatory?: boolean }[]
  intakeNotes?: string
  expectedOk: boolean
  expectedMissing?: string[]
}

const TESTS: TestCase[] = [
  // 1. Caso REAL de Bielka — Kings County NY (lo que está en BD hoy).
  // Esperado: ok=false, missing incluye motion, affirmation, proposed order.
  {
    name: 'Bielka — Kings County NY (estado actual en BD, incompleto)',
    stateCode: 'NY',
    forms: [
      { name: 'Form 6-1 — Petition for Appointment as Guardian of a Person or Permanent Guardian' },
      { name: 'Form 6-3 — Consent of Person Over 18 / Preference of Minor Over 14 Regarding Appointment of Guardian' },
      { name: 'Form 6-4 — Waiver of Process, Renunciation or Consent to Guardianship' },
    ],
    intakeForms: [],
    intakeNotes: 'En NY Family Court no existe coversheet civil separado: la propia Form 6-1 funciona como commencement document.',
    expectedOk: false,
    expectedMissing: ['sij_motion_or_request', 'sij_affirmation_or_affidavit', 'sij_proposed_order_with_findings'],
  },

  // 2. Bronx County NY (BD actual — pasa validación).
  {
    name: 'Bronx County NY — set completo SIJS',
    stateCode: 'NY',
    forms: [
      { name: 'Form 6-1 — Petition for Appointment as Guardian of a Person or Permanent Guardian' },
      { name: 'Form 6-2 — Affirmation and Designation for Service of Process (Guardianship Oath)' },
      { name: 'Form 6-4 — Waiver and Consent (Guardianship of a Minor)' },
      { name: 'Form GF-42 — Order — Special Findings (Special Immigrant Juvenile Status)' },
      { name: 'Notice of Motion for Special Findings (SIJS) — sample template' },
      { name: 'Affirmation/Affidavit in Support of Motion for Order of Special Findings' },
    ],
    intakeForms: [
      {
        name: 'Form 6-1 — Petition for Appointment as Guardian (radicada en ventanilla para abrir caso)',
        description: 'En NY Family Court no existe un coversheet separado: la radicación inicial se hace presentando directamente la Form 6-1 (la propia petición de tutela) en el Petition Room — funciona como commencement document.',
      },
    ],
    intakeNotes: 'En NY Family Court no existe coversheet civil separado: la propia petición Form 6-1 funciona como commencement document.',
    expectedOk: true,
  },

  // 3. NY sin GF-42 pero con Affidavit — debe fallar por regla estricta NY.
  {
    name: 'NY sin GF-42 (regla estricta debe fallar)',
    stateCode: 'NY',
    forms: [
      { name: 'Form 6-1 — Petition for Guardianship' },
      { name: 'Notice of Motion for Special Findings' },
      { name: 'Affirmation in Support of Motion for SIJ Findings' },
      // OJO: aquí NO hay GF-42 ni "Special Findings Order" en el nombre.
    ],
    intakeForms: [],
    intakeNotes: 'Form 6-1 funciona como commencement.',
    expectedOk: false,
    expectedMissing: ['sij_proposed_order_with_findings'],
  },

  // 4. TX sin DFPS Motion — debe fallar por regla estricta TX.
  {
    name: 'TX sin DFPS Motion (regla estricta debe fallar)',
    stateCode: 'TX',
    forms: [
      { name: 'FM-SAPCR-100 — Original Petition in SAPCR' },
      { name: 'FM-SAPCR-AFF-100 — Affidavit for Standing of Nonparent' },
      { name: 'Civil Case Information Sheet — PR-GEN-116' },
      // Falta el Motion + Order + Affidavit de DFPS Section 13.
    ],
    intakeForms: [
      { name: 'Civil Case Information Sheet (PR-GEN-116)' },
    ],
    expectedOk: false,
  },

  // 5. TX completo — debe pasar.
  {
    name: 'TX completo con DFPS Section 13 Tools',
    stateCode: 'TX',
    forms: [
      { name: 'Original Petition in SAPCR (FM-SAPCR-100)' },
      { name: 'Affidavit for Standing of Nonparent (FM-SAPCR-AFF-100)' },
      { name: 'DFPS Motion for Findings Regarding SIJ Status' },
      { name: 'DFPS Order Regarding SIJS Findings (2019_Order_SIJ_Findings)' },
      { name: 'DFPS Affidavit to Support SIJ Motion' },
      { name: 'Order in SAPCR Nonparent Custody (FM-SAPCR-205)' },
    ],
    intakeForms: [
      { name: 'Civil Case Information Sheet (PR-GEN-116)' },
    ],
    expectedOk: true,
  },

  // 6. CA sin Findings Order — debe fallar.
  {
    name: 'CA sin Findings and Order Regarding SIJ',
    stateCode: 'CA',
    forms: [
      { name: 'Petition for Appointment of Guardian of Minor (GC-210)' },
      { name: 'Confidential Guardian Screening Form (GC-212)' },
      { name: 'Order Appointing Guardian of Minor (GC-240)' },
    ],
    intakeForms: [
      { name: 'Civil Case Cover Sheet' },
    ],
    expectedOk: false,
  },
]

function buildResult(tc: TestCase): JurisdictionResearchResult {
  const toForm = (f: { name: string; description?: string; mandatory?: boolean }): RequiredForm => ({
    name: f.name,
    url_official: 'https://example.gov/test.pdf', // dummy - el validador no toca URLs
    description_es: f.description ?? '',
    is_mandatory: f.mandatory ?? true,
    slug: null,
  })

  return {
    state_code: tc.stateCode,
    state_name: tc.stateCode,
    court_name: 'Test Court',
    court_name_es: null,
    court_address: null,
    filing_procedure: null,
    filing_procedure_es: null,
    age_limit_sijs: 21,
    sources: ['https://example.gov/test'],
    confidence: 'high',
    notes: null,
    intake_packet: {
      required_forms: tc.intakeForms.map(toForm),
      filing_steps: [],
      filing_channel: null,
      procedure_es: null,
      notes: tc.intakeNotes ?? null,
    },
    filing_channel: null,
    required_forms: tc.forms.map(toForm),
    filing_steps: [],
    attachments_required: [],
    fees: null,
  }
}

function runTests() {
  let passed = 0
  let failed = 0
  const failures: string[] = []

  console.log('\n=== Verificación del validador SIJS core ===\n')

  for (const tc of TESTS) {
    const result = buildResult(tc)
    const validation = validateSIJCorePackage(result, tc.stateCode)
    const ok = validation.ok === tc.expectedOk
    const missingOk = !tc.expectedMissing || tc.expectedMissing.every(m => validation.missing.includes(m as never))

    if (ok && missingOk) {
      console.log(`✅ ${tc.name}`)
      console.log(`   estado: ${validation.ok ? 'OK' : `missing=${validation.missing.join(',')}`}`)
      passed++
    } else {
      console.log(`❌ ${tc.name}`)
      console.log(`   esperado ok=${tc.expectedOk}, recibido ok=${validation.ok}`)
      console.log(`   esperado missing=${tc.expectedMissing?.join(',') ?? '(any)'}`)
      console.log(`   recibido missing=${validation.missing.join(',')}`)
      console.log(`   warnings: ${validation.warnings.join(' | ')}`)
      failed++
      failures.push(tc.name)
    }

    // Bonus: para los casos fallidos, imprimimos las queries que el retry usaría.
    if (!validation.ok) {
      const queries = buildTargetedQueries(tc.stateCode, validation.missing)
      console.log(`   queries de retry sugeridas (primeras 3): ${queries.slice(0, 3).join(' | ')}`)
    }
    console.log('')
  }

  console.log(`\n=== Resultado: ${passed} pasaron, ${failed} fallaron ===\n`)
  if (failed > 0) {
    console.log('Fixtures fallidas:', failures)
    process.exit(1)
  }
}

runTests()
