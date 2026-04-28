// Tokeniza el .docx de DFPS Section 13 "Motion for Findings Regarding SIJ Status"
// reemplazando placeholders narrativos ([NAME], [DATE], [COUNTRY], _____, etc.)
// por tokens {{semanticKey}} que el runtime fillDocxTemplate sustituye con
// datos del cliente.
//
// Re-correr cuando DFPS publique una nueva versión del template.
//
// Input :  public/forms/motion-sij-findings.original.docx (no modificado)
// Output:  public/forms/motion-sij-findings.docx (tokenizado)
//          + SHA-256 a stdout (se hardcodea en el schema)

import JSZip from 'jszip'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const INPUT  = path.join(repoRoot, 'public', 'forms', 'motion-sij-findings.original.docx')
const OUTPUT = path.join(repoRoot, 'public', 'forms', 'motion-sij-findings.docx')

// Reemplazos sobre el contenido textual de los <w:t> nodes.
// Cada par [find, replace] se aplica en orden. Find es string literal
// (no regex). Si find no aparece, lanzamos error para detectar template drift.
const REPLACEMENTS = [
  // Header / caption del juicio
  ['CAUSE NO. ',                       'CAUSE NO. {{cause_number}}'],
  // El nombre del menor va en la celda izquierda de la 2da fila ("                   , A CHILD")
  ['                   , ',            '{{child_caption_name}}, '],
  // El nombre del condado va en la celda derecha de la 2da fila ("                    COUNTY, TEXAS")
  ['                    ',             '{{county_name}} '],
  // El número del distrito judicial va antes de "JUDICIAL DISTRICT"
  ['   ___ ',                          '{{judicial_district}} '],

  // Fact section: Child in State Foster Care
  // Reemplaza "________, 201__" (fecha de orden previa de DFPS conservatorship)
  ['By order of this Court on ________, 201__, DFPS was named managing conservator of this child',
   'By order of this Court on {{prior_order_date}}, {{prior_order_year}}, {{petitioner_org_name}} was named managing conservator of this child'],

  // Datos del menor (los labels mantienen su orden, los valores se inyectan)
  ['<w:t>Name:</w:t>',                 '<w:t xml:space="preserve">Name: {{child_full_name}}</w:t>'],
  ['Sex:',                             'Sex: {{child_sex}}'],
  ['Birth place:',                     'Birth place: {{child_birth_place}}'],
  ['Birth date:',                      'Birth date: {{child_birth_date}}'],

  // Reunification mother / father
  ['this child with [NAME], mother,',  'this child with {{mother_name}}, mother,'],
  ['this child with [NAME], father,',  'this child with {{father_name}}, father,'],

  // Final order
  ['On [DATE] this Court ',            'On {{final_order_date}} this Court '],

  // Best interest
  ['to return to [COUNTRY], the child', 'to return to {{child_country}}, the child'],

  // Attorney/Petitioner block
  ['Bar No. ',                         'Bar No. {{attorney_bar_no}}'],

  // Hearing notice (el bloque entero está en un solo <w:t>)
  ['set for the _____ day of _____________________, 201__',
   'set for the {{hearing_day}} day of {{hearing_month}}, {{hearing_year}}'],
  [' at ____o’clock __.m., in the  ____Court, _______________,Texas.',
   ' at {{hearing_hour}} o’clock {{hearing_ampm}}.m., in the {{hearing_court_number}} Court, {{hearing_court_location}}, Texas.'],

  // Certificate of service (default "April 2016" hardcoded — lo cambiamos)
  ['accordance with the Texas Rules of Civil Procedure on this ____ day of April 2016.',
   'accordance with the Texas Rules of Civil Procedure on this {{service_day}} day of {{service_month_year}}.'],
]

async function main() {
  const buf = fs.readFileSync(INPUT)
  const zip = await JSZip.loadAsync(buf)

  const documentXml = await zip.file('word/document.xml').async('string')
  let xml = documentXml

  const notFound = []
  for (const [find, replace] of REPLACEMENTS) {
    if (!xml.includes(find)) {
      notFound.push(find)
      continue
    }
    xml = xml.split(find).join(replace)
  }

  if (notFound.length > 0) {
    console.error('Placeholders no encontrados (template drift):')
    for (const f of notFound) console.error('  ' + JSON.stringify(f))
    process.exit(1)
  }

  zip.file('word/document.xml', xml)

  // Escribir docx tokenizado
  const out = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  })

  fs.writeFileSync(OUTPUT, out)

  const sha = crypto.createHash('sha256').update(out).digest('hex')
  console.log('SHA-256:', sha)
  console.log('Tamaño :', out.length, 'bytes')
  console.log('Tokens :', REPLACEMENTS.length)
  console.log('Escrito:', OUTPUT)
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
