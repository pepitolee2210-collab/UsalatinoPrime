// Test offline del fillDocxTemplate con datos del caso de Jennifer Velasquez.
// Carga el template tokenizado, sustituye los tokens con valores simulados,
// y guarda el resultado para inspección visual.

import JSZip from 'jszip'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const TEMPLATE = path.join(repoRoot, 'public', 'forms', 'motion-sij-findings.docx')
const OUTPUT = path.join(__dirname, 'motion-sij-test-output.docx')
const EXPECTED_SHA = '1b9928ef4ff7782af9a7f453f409971147de518773855516212b324910af928c'

const SIMULATED_VALUES = {
  cause_number: '',
  child_caption_name: 'B.Y.R.V.',
  county_name: 'Harris',
  judicial_district: '245th',

  petitioner_org_name: 'Petitioner Jennifer Samanta Velasquez Mejia, Pro Se',
  prior_order_date: '04/28',
  prior_order_year: '2026',

  child_full_name: 'Brandon Yair Ramirez Velasquez',
  child_sex: 'M',
  child_birth_place: 'Honduras',
  child_birth_date: '10/03/2011',

  mother_name: 'Jennifer Samanta Velasquez Mejia',
  father_name: 'Padre',

  final_order_date: 'the date of this hearing',

  child_country: 'Honduras',

  attorney_bar_no: '',

  hearing_day: '',
  hearing_month: '',
  hearing_year: '',
  hearing_hour: '',
  hearing_ampm: '',
  hearing_court_number: '',
  hearing_court_location: '',

  service_day: '',
  service_month_year: 'April 2026',
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

async function main() {
  const bytes = fs.readFileSync(TEMPLATE)
  const sha = crypto.createHash('sha256').update(bytes).digest('hex')
  console.log('SHA-256:', sha)
  if (sha !== EXPECTED_SHA) {
    console.error('ERROR: SHA mismatch.')
    process.exit(1)
  }

  const zip = await JSZip.loadAsync(bytes)
  const PARTS = ['word/document.xml', 'word/header1.xml', 'word/header2.xml', 'word/header3.xml',
                 'word/footer1.xml', 'word/footer2.xml', 'word/footer3.xml']
  let total = 0, replaced = 0, leftover = []
  for (const p of PARTS) {
    const f = zip.file(p)
    if (!f) continue
    let xml = await f.async('string')
    const tokens = xml.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) ?? []
    total += tokens.length
    for (const [k, v] of Object.entries(SIMULATED_VALUES)) {
      const tk = `{{${k}}}`
      if (xml.includes(tk)) { xml = xml.split(tk).join(escapeXml(String(v))); replaced++ }
    }
    const remaining = xml.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) ?? []
    leftover.push(...remaining)
    if (remaining.length) xml = xml.replace(/\{\{[a-zA-Z0-9_]+\}\}/g, '')
    zip.file(p, xml)
  }
  console.log('Total tokens:', total, '· Reemplazados:', replaced, '· Leftover:', leftover.length)
  if (leftover.length) console.log('Leftover tokens:', [...new Set(leftover)])

  const out = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } })
  fs.writeFileSync(OUTPUT, out)
  console.log('Escrito:', OUTPUT, '·', out.length, 'bytes')
}

main().catch(e => { console.error(e); process.exit(1) })
