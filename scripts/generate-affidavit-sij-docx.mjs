// Genera el .docx tokenizado del "Affidavit to Support SIJ Motion" (DFPS Section 13).
//
// Reproduce fielmente el FORMATO del template oficial DFPS 2019:
//  - Caption table 3 cols × 6 rows con § en columna central
//  - "CAUSE NO." centrado en columna derecha de la primera fila
//  - SIN título intermedio "AFFIDAVIT TO SUPPORT..."
//  - SIN "STATE OF TEXAS / COUNTY OF" arriba (sólo va al final como notarización)
//  - Section headers "1. Child's Information:" y "2. Child's Circumstances:" SUBRAYADOS
//  - Bullets cuadrados ■ (no redondos)
//  - Cuerpo justified con indent del primer párrafo
//
// Uso: node scripts/generate-affidavit-sij-docx.mjs
// Output: public/forms/affidavit-sij.docx + SHA-256 a stdout

import {
  Document, Packer, Paragraph, TextRun, AlignmentType, UnderlineType,
  Table, TableRow, TableCell, WidthType, BorderStyle, LevelFormat, convertInchesToTwip,
} from 'docx'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const OUTPUT = path.join(repoRoot, 'public', 'forms', 'affidavit-sij.docx')

// ── helpers ────────────────────────────────────────────────────────────────
const t = (text, opts = {}) => new TextRun({ text, ...opts })
const b = (text) => t(text, { bold: true })
const u = (text) => t(text, { bold: true, underline: { type: UnderlineType.SINGLE } })

const NO_BORDER = {
  top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
}

// Caption table: 3 columnas (45% / 10% / 45%), 6 filas con § en columna central.
// La fila 1 también lleva "CAUSE NO. {{cause_number}}" centrado en la columna derecha.
function captionTable() {
  const cell = (children, width) => new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    borders: NO_BORDER,
    children,
  })

  const sectionSign = () => new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [b('§')],
  })

  // Row 1: IN THE INTEREST OF | § | (CAUSE NO. centrado encima de IN THE DISTRICT COURT OF)
  const row1 = new TableRow({
    children: [
      cell([new Paragraph({ children: [b('IN THE INTEREST OF')] })], 45),
      cell([sectionSign()], 10),
      cell([
        new Paragraph({ alignment: AlignmentType.CENTER, children: [b('CAUSE NO. {{cause_number}}')] }),
        new Paragraph({ children: [b('IN THE DISTRICT COURT OF')] }),
      ], 45),
    ],
  })
  // Row 2: (vacío) | § | (vacío)
  const row2 = new TableRow({
    children: [
      cell([new Paragraph({ children: [t('')] })], 45),
      cell([sectionSign()], 10),
      cell([new Paragraph({ children: [t('')] })], 45),
    ],
  })
  // Row 3: {{child_caption_name}} | § | {{county_name}} COUNTY, TEXAS
  const row3 = new TableRow({
    children: [
      cell([new Paragraph({ children: [b('{{child_caption_name}}')] })], 45),
      cell([sectionSign()], 10),
      cell([new Paragraph({ children: [b('{{county_name}} COUNTY, TEXAS')] })], 45),
    ],
  })
  // Row 4: (vacío) | § | (vacío)
  const row4 = new TableRow({
    children: [
      cell([new Paragraph({ children: [t('')] })], 45),
      cell([sectionSign()], 10),
      cell([new Paragraph({ children: [t('')] })], 45),
    ],
  })
  // Row 5: (vacío) | § | (vacío)
  const row5 = new TableRow({
    children: [
      cell([new Paragraph({ children: [t('')] })], 45),
      cell([sectionSign()], 10),
      cell([new Paragraph({ children: [t('')] })], 45),
    ],
  })
  // Row 6: A CHILD | § | {{judicial_district}} JUDICIAL DISTRICT
  const row6 = new TableRow({
    children: [
      cell([new Paragraph({ children: [b('A CHILD')] })], 45),
      cell([sectionSign()], 10),
      cell([new Paragraph({ children: [b('{{judicial_district}} JUDICIAL DISTRICT')] })], 45),
    ],
  })

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_BORDER,
    rows: [row1, row2, row3, row4, row5, row6],
  })
}

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: 'Times New Roman', size: 22 },
        paragraph: { spacing: { line: 276 } },  // 1.15 line spacing como el oficial
      },
    },
  },
  numbering: {
    config: [{
      reference: 'square-bullets',
      levels: [{
        level: 0,
        format: LevelFormat.BULLET,
        text: '■',  // ■ square bullet (igual al oficial)
        alignment: AlignmentType.LEFT,
        style: {
          paragraph: { indent: { left: convertInchesToTwip(1), hanging: convertInchesToTwip(0.25) } },
        },
      }],
    }],
  },
  sections: [{
    properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    children: [
      // Caption table (incluye CAUSE NO. en la primera fila columna derecha)
      captionTable(),

      new Paragraph({ children: [t('')] }),

      // Apertura del affidavit — primer párrafo justified, con indent en la primera línea
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: convertInchesToTwip(0.5) },
        spacing: { after: 240 },
        children: [
          t('My name is '), b('{{affiant_name}}'), t('.  '),
          t('{{affiant_role_intro}}'),
          t('  I am over the age of 18, of sound mind and capable of making this affidavit.  The facts stated in this affidavit are within my personal knowledge and are true and correct.'),
        ],
      }),

      // Segundo párrafo
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: convertInchesToTwip(0.5) },
        spacing: { after: 240 },
        children: [t('I am responsible for this case and am familiar with this child’s current circumstances.')],
      }),

      // Section header "1. Child's Information:" SUBRAYADO
      new Paragraph({
        spacing: { before: 240, after: 120 },
        children: [u('1.  Child’s Information:')],
      }),

      // Bullets cuadrados — Child's information
      new Paragraph({
        numbering: { reference: 'square-bullets', level: 0 },
        children: [t('The Child’s name is '), b('{{child_full_name}}'), t('.')],
      }),
      new Paragraph({
        numbering: { reference: 'square-bullets', level: 0 },
        children: [t('The Child’s mother is '), b('{{child_mother_name}}'), t('.')],
      }),
      new Paragraph({
        numbering: { reference: 'square-bullets', level: 0 },
        children: [t('The Child’s father is '), b('{{child_father_name}}'), t('.')],
      }),
      new Paragraph({
        numbering: { reference: 'square-bullets', level: 0 },
        children: [t('The Child is '), b('{{child_sex}}'), t('.')],
      }),
      new Paragraph({
        numbering: { reference: 'square-bullets', level: 0 },
        children: [t('The Child’s date of birth is '), b('{{child_birth_date}}'), t('.')],
      }),
      new Paragraph({
        numbering: { reference: 'square-bullets', level: 0 },
        children: [t('The Child’s place of birth is '), b('{{child_birth_place}}'), t('.')],
      }),

      // Section header "2. Child's Circumstances:" SUBRAYADO
      new Paragraph({
        spacing: { before: 240, after: 120 },
        children: [u('2.  Child’s Circumstances:')],
      }),

      // Cuerpo de circumstances — justified
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
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

      // Reunification mother
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 240 },
        children: [
          t('Reunification is not viable with this child’s mother, '),
          b('{{mother_name}}'),
          t(', as a result of '),
          b('{{mother_grounds}}'),
          t('.  The circumstances that lead to this child’s removal and prevent reunification include: '),
          t('{{mother_facts}}'),
          t('.'),
        ],
      }),

      // Reunification father
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 240 },
        children: [
          t('Reunification is not viable with this child’s father, '),
          b('{{father_name}}'),
          t(', as a result of '),
          b('{{father_grounds}}'),
          t('.  The circumstances that lead to this child’s removal and prevent reunification include: '),
          t('{{father_facts}}'),
          t('.'),
        ],
      }),

      // Best interest
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 240 },
        children: [
          t('It is not in this child’s best interest to be returned to his or her country of nationality or last habitual residence, '),
          b('{{child_country}}'),
          t('.  The reasons include: '),
          t('{{best_interest_facts}}'),
          t('.'),
        ],
      }),

      // Final order
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 240 },
        children: [
          t('On '),
          b('{{final_order_date}}'),
          t(' this Court entered an order '),
          t('{{final_order_action}}'),
          t('.'),
        ],
      }),

      // Signature block — alineado a la derecha
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 480 },
        children: [t('___________________________________')],
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

      // Notary block: STATE OF TEXAS / COUNTY OF (acá sí, es el bloque de notarización)
      new Paragraph({
        spacing: { before: 480, after: 240 },
        children: [
          b('STATE OF TEXAS'),
          t('\t\t\t\t§\n'),
          b('COUNTY OF '),
          t('{{notary_county}}'),
          t('\t\t\t§'),
        ],
      }),

      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: convertInchesToTwip(0.5) },
        spacing: { after: 240 },
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

      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 480 },
        children: [t('___________________________________')],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [b('NOTARY PUBLIC IN AND FOR')],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [b('THE STATE OF TEXAS')],
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
