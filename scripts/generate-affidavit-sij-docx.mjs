// Genera el .docx tokenizado del "Affidavit to Support SIJ Motion" partiendo
// del DFPS Section 13 toolkit (versión 2019). El archivo oficial es .doc legacy
// (Word 97-2003 binario) y el pipeline fillDocxTemplate requiere OOXML (.docx),
// así que regeneramos el documento desde cero con la lib `docx` preservando la
// estructura legal original.
//
// Adaptado para soportar dos casos:
//  1. Caseworker DFPS (default original): affiant es CPS Specialist, conservator es DFPS.
//  2. Madre Pro Se (Jennifer-style): affiant es la madre, conservator es ella misma como Petitioner.
//
// El schema del registry tiene un campo `affiant_role` que el admin elige; el
// resto del documento se adapta automáticamente vía prefill.
//
// Uso: node scripts/generate-affidavit-sij-docx.mjs
// Output: public/forms/affidavit-sij.docx + SHA-256 a stdout

import {
  Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle, TabStopType, TabStopPosition,
} from 'docx'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const OUTPUT = path.join(repoRoot, 'public', 'forms', 'affidavit-sij.docx')

// Helper: crea un TextRun con formato inline opcional
const t = (text, opts = {}) => new TextRun({ text, ...opts })
const b = (text) => t(text, { bold: true })

// Caption table (6 filas, 3 columnas: izquierda / § / derecha)
function captionTable() {
  const NO_BORDER = { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
                      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }
  const cell = (children, width = 45) => new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    borders: NO_BORDER,
    children,
  })
  const row = (left, right) => new TableRow({
    children: [
      cell([new Paragraph({ children: left })]),
      cell([new Paragraph({ alignment: AlignmentType.CENTER, children: [b('§')] })], 10),
      cell([new Paragraph({ children: right })]),
    ],
  })

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_BORDER,
    rows: [
      row([b('IN THE INTEREST OF')], [b('IN THE DISTRICT COURT OF')]),
      row([b('{{child_caption_name}}')], [b('{{county_name}} COUNTY, TEXAS')]),
      row([b('A CHILD')], [b('{{judicial_district}} JUDICIAL DISTRICT')]),
    ],
  })
}

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: 'Times New Roman', size: 22 },
      },
    },
  },
  sections: [{
    properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    children: [
      // Cause No. arriba
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [b('CAUSE NO. {{cause_number}}')],
      }),
      new Paragraph({ children: [t('')] }),

      // Caption
      captionTable(),

      new Paragraph({ children: [t('')] }),

      // Título centrado en negritas
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 240 },
        children: [b('AFFIDAVIT TO SUPPORT MOTION FOR FINDINGS\nREGARDING SPECIAL IMMIGRANT JUVENILE STATUS')],
      }),

      // STATE OF TEXAS / COUNTY OF
      new Paragraph({
        children: [
          b('STATE OF TEXAS'),
          t('\t\t\t\t§\n'),
          b('COUNTY OF '),
          t('{{notary_county}}'),
          t('\t\t\t§'),
        ],
      }),
      new Paragraph({ children: [t('')] }),

      // Apertura del affidavit
      new Paragraph({
        spacing: { after: 240 },
        children: [
          t('My name is '), b('{{affiant_name}}'), t('. '),
          t('{{affiant_role_intro}}'),
          t(' I am over the age of 18, of sound mind and capable of making this affidavit. The facts stated in this affidavit are within my personal knowledge and are true and correct.'),
        ],
      }),

      new Paragraph({
        spacing: { after: 240 },
        children: [t('I am responsible for this case and am familiar with this child’s current circumstances.')],
      }),

      // 1. Child's Information
      new Paragraph({
        spacing: { before: 240, after: 120 },
        children: [b('1. Child’s Information:')],
      }),
      new Paragraph({ indent: { left: 720 }, children: [t('• The Child’s name is '), b('{{child_full_name}}'), t('.')] }),
      new Paragraph({ indent: { left: 720 }, children: [t('• The Child’s mother is '), b('{{child_mother_name}}'), t('.')] }),
      new Paragraph({ indent: { left: 720 }, children: [t('• The Child’s father is '), b('{{child_father_name}}'), t('.')] }),
      new Paragraph({ indent: { left: 720 }, children: [t('• The Child is '), b('{{child_sex}}'), t('.')] }),
      new Paragraph({ indent: { left: 720 }, children: [t('• The Child’s date of birth is '), b('{{child_birth_date}}'), t('.')] }),
      new Paragraph({ indent: { left: 720 }, children: [t('• The Child’s place of birth is '), b('{{child_birth_place}}'), t('.')] }),

      // 2. Child's Circumstances
      new Paragraph({
        spacing: { before: 240, after: 120 },
        children: [b('2. Child’s Circumstances:')],
      }),
      new Paragraph({
        spacing: { after: 240 },
        children: [
          t('This Court originally placed this child in the custody of '),
          b('{{conservator_name}}'),
          t(' and ordered '),
          t('{{conservator_pronoun}}'),
          t(' to be the managing conservator of this child on '),
          b('{{prior_order_date}}'),
          t('.'),
        ],
      }),

      // Reunification — mother
      new Paragraph({
        spacing: { after: 240 },
        children: [
          t('Reunification is not viable with this child’s mother, '),
          b('{{mother_name}}'),
          t(', as a result of '),
          b('{{mother_grounds}}'),
          t('. The circumstances that lead to this child’s removal and prevent reunification include: '),
          t('{{mother_facts}}'),
          t('.'),
        ],
      }),

      // Reunification — father
      new Paragraph({
        spacing: { after: 240 },
        children: [
          t('Reunification is not viable with this child’s father, '),
          b('{{father_name}}'),
          t(', as a result of '),
          b('{{father_grounds}}'),
          t('. The circumstances that lead to this child’s removal and prevent reunification include: '),
          t('{{father_facts}}'),
          t('.'),
        ],
      }),

      // Best interest
      new Paragraph({
        spacing: { after: 240 },
        children: [
          t('It is not in this child’s best interest to be returned to his or her country of nationality or last habitual residence, '),
          b('{{child_country}}'),
          t('. The reasons include: '),
          t('{{best_interest_facts}}'),
          t('.'),
        ],
      }),

      // Final order
      new Paragraph({
        spacing: { after: 240 },
        children: [
          t('On '),
          b('{{final_order_date}}'),
          t(' this Court entered an order '),
          t('{{final_order_action}}'),
          t('.'),
        ],
      }),

      // Signature block
      new Paragraph({ children: [t('')] }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 480 },
        children: [t('_____________________________________')],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [b('{{affiant_name}}')],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: 240 },
        children: [t('{{affiant_title}}')],
      }),

      // Notary block
      new Paragraph({
        spacing: { before: 480 },
        children: [
          b('SWORN TO AND SUBSCRIBED'),
          t(' before me by '),
          b('{{affiant_name}}'),
          t(' on this '),
          b('{{notary_day}}'),
          t(' day of '),
          b('{{notary_month_year}}'),
          t('.'),
        ],
      }),
      new Paragraph({ children: [t('')] }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 360 },
        children: [t('_____________________________________')],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [b('NOTARY PUBLIC IN AND FOR'), t('\nTHE STATE OF TEXAS')],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 240 },
        children: [t('Printed name of Notary: '), b('{{notary_printed_name}}')],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [t('My Commission expires: '), b('{{notary_commission_expires}}')],
      }),
    ],
  }],
})

const buf = await Packer.toBuffer(doc)
fs.writeFileSync(OUTPUT, buf)

const sha = crypto.createHash('sha256').update(buf).digest('hex')
console.log('SHA-256:', sha)
console.log('Tamaño :', buf.length, 'bytes')
console.log('Escrito:', OUTPUT)

// Listar tokens en el output
import('jszip').then(async ({ default: JSZip }) => {
  const z = await JSZip.loadAsync(buf)
  const xml = await z.file('word/document.xml').async('string')
  const tokens = [...new Set(xml.match(/\{\{[a-z_]+\}\}/g) ?? [])].sort()
  console.log('Tokens (' + tokens.length + '):')
  for (const tk of tokens) console.log('  ' + tk)
})
