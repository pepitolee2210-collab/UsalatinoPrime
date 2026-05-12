/**
 * Test de la verificación AcroForm en PDFs reales.
 *
 * Uso: npx tsx scripts/test-verify-pdf-acroform.ts
 *
 * Cubre los PDFs que la IA marcó como acroform en el caso de Bielka:
 * GF-17, GF-42, Form 6-1 (control de guardianship). Confirma si la
 * inspección coincide con la realidad — el badge "Rellenable" se debe
 * mostrar SOLO cuando hay AcroForm real con >=3 campos editables.
 */

import { verifyPdfAcroForm } from '../src/lib/legal/verify-pdf-acroform'

interface TestCase {
  name: string
  url: string
  iaMarkedAs: 'acroform' | 'static' | 'docx' | 'doc' | 'unknown'
  expectedRealFormat?: 'acroform' | 'static' | 'docx' | 'doc' | 'unknown'
}

const CASES: TestCase[] = [
  {
    name: 'NY GF-17 — Petition for Custody/Visitation (lo que IA dijo acroform)',
    url: 'https://www.nycourts.gov/LegacyPDFS/forms/familycourt/pdfs/GF-17.pdf',
    iaMarkedAs: 'acroform',
  },
  {
    name: 'NY GF-42 — Special Findings Order',
    url: 'https://www.nycourts.gov/LegacyPDFS/FORMS/familycourt/pdfs/gf-42.pdf',
    iaMarkedAs: 'acroform',
  },
  {
    name: 'NY GF-21 — Address Confidentiality',
    url: 'https://www.nycourts.gov/LegacyPDFS/FORMS/familycourt/pdfs/gf-21.pdf',
    iaMarkedAs: 'acroform',
  },
  {
    name: 'NY Form 6-1 — Guardianship Petition (control — no aplica a Bielka pero verificamos)',
    url: 'https://www.nycourts.gov/LegacyPDFS/FORMS/familycourt/pdfs/6-1.pdf',
    iaMarkedAs: 'acroform',
  },
  {
    name: 'TX PR-GEN-116 — Civil Case Information Sheet (sabemos que es AcroForm)',
    url: 'https://texaslawhelp.org/sites/default/files/pr-gen-116_civil_case_information_sheet.pdf',
    iaMarkedAs: 'acroform',
    expectedRealFormat: 'acroform',
  },
  {
    name: 'IA marcó docx — no se verifica',
    url: 'https://example.gov/something.docx',
    iaMarkedAs: 'docx',
    expectedRealFormat: 'docx',
  },
]

async function run() {
  console.log('\n=== Test de verificación AcroForm real ===\n')

  for (const tc of CASES) {
    console.log(`📄 ${tc.name}`)
    console.log(`   URL: ${tc.url}`)
    console.log(`   IA dijo: ${tc.iaMarkedAs}`)
    const start = Date.now()
    const result = await verifyPdfAcroForm(tc.url, tc.iaMarkedAs)
    const ms = Date.now() - start
    console.log(`   Realidad: pdf_format=${result.pdf_format}, is_fillable=${result.is_fillable} (${ms}ms)`)
    console.log(`   Razón: ${result.reason}`)
    if (tc.expectedRealFormat && tc.expectedRealFormat !== result.pdf_format) {
      console.log(`   ⚠️  Esperado: ${tc.expectedRealFormat}`)
    }
    console.log('')
  }
}

void run().catch(err => {
  console.error(err)
  process.exit(1)
})
