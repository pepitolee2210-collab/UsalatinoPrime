// Genera el .docx tokenizado del "Order Regarding SIJ Findings" (DFPS Section 13).
//
// Reproduce el formato del template oficial DFPS 2019:
//  - Caption table 6 filas con § en columna central
//  - "CAUSE NO." centrado en columna derecha de la primera fila
//  - Título centrado "ORDER REGARDING / SPECIAL IMMIGRANT JUVENILE STATUS FINDINGS"
//  - Sub-headings SUBRAYADOS: "Child in State Foster Care", "Viability of Reunification...",
//    "3. Not in Child's Best Interest to Return"
//  - Cuerpo justified
//  - Línea de firma del juez al final ("Signed ___ JUDGE")
//
// Uso: node scripts/generate-order-sij-findings-docx.mjs

import {
  Document, Packer, Paragraph, TextRun, AlignmentType, UnderlineType,
  Table, TableRow, TableCell, WidthType, BorderStyle, convertInchesToTwip,
} from 'docx'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const OUTPUT = path.join(repoRoot, 'public', 'forms', 'order-sij-findings.docx')

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

function captionTable() {
  const cell = (children, width) => new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    borders: NO_BORDER,
    children,
  })
  const sectionSign = () => new Paragraph({ alignment: AlignmentType.CENTER, children: [b('§')] })

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_BORDER,
    rows: [
      new TableRow({
        children: [
          cell([new Paragraph({ children: [b('IN THE INTEREST OF')] })], 45),
          cell([sectionSign()], 10),
          cell([
            new Paragraph({ alignment: AlignmentType.CENTER, children: [b('CAUSE NO. {{cause_number}}')] }),
            new Paragraph({ children: [b('IN THE DISTRICT COURT OF')] }),
          ], 45),
        ],
      }),
      new TableRow({
        children: [
          cell([new Paragraph({ children: [t('')] })], 45),
          cell([sectionSign()], 10),
          cell([new Paragraph({ children: [t('')] })], 45),
        ],
      }),
      new TableRow({
        children: [
          cell([new Paragraph({ children: [b('{{child_caption_name}}, A CHILD')] })], 45),
          cell([sectionSign()], 10),
          cell([new Paragraph({ children: [b('{{county_name}} COUNTY, TEXAS')] })], 45),
        ],
      }),
      new TableRow({
        children: [
          cell([new Paragraph({ children: [t('')] })], 45),
          cell([sectionSign()], 10),
          cell([new Paragraph({ children: [t('')] })], 45),
        ],
      }),
      new TableRow({
        children: [
          cell([new Paragraph({ children: [t('')] })], 45),
          cell([sectionSign()], 10),
          cell([new Paragraph({ children: [t('')] })], 45),
        ],
      }),
      new TableRow({
        children: [
          cell([new Paragraph({ children: [t('')] })], 45),
          cell([sectionSign()], 10),
          cell([new Paragraph({ children: [b('{{judicial_district}} JUDICIAL DISTRICT')] })], 45),
        ],
      }),
    ],
  })
}

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: 'Times New Roman', size: 22 },
        paragraph: { spacing: { line: 276 } },
      },
    },
  },
  sections: [{
    properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    children: [
      captionTable(),

      new Paragraph({ children: [t('')] }),

      // Título centrado
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 240 },
        children: [b('ORDER REGARDING')],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 360 },
        children: [b('SPECIAL IMMIGRANT JUVENILE STATUS FINDINGS')],
      }),

      // Texto introductorio
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: convertInchesToTwip(0.5) },
        spacing: { after: 240 },
        children: [
          t('This Court has jurisdiction over this case pursuant to Texas Family Code, Title 5, Subtitle E, '),
          b('PROTECTION OF THE CHILD'),
          t('.  On this day the Court reviewed the affidavits, reports, documents, testimony and other evidence presented to this Court, as well as the prior findings and orders entered in the Suit Affecting the Parent Child Relationship regarding this child, heard arguments of counsel and made the following findings:'),
        ],
      }),

      // SECCIÓN 1 — Child in State Foster Care
      new Paragraph({
        spacing: { before: 240, after: 120 },
        children: [u('1.  Child in State Foster Care')],
      }),

      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: convertInchesToTwip(0.5) },
        spacing: { after: 240 },
        children: [
          b('{{conservator_name}}'),
          t(' is the state agency responsible for child protective services in Texas. Texas Human Resources Code §40.002(b)(1).  By order of this Court on '),
          b('{{prior_order_date_full}}'),
          t(', '),
          b('{{conservator_short}}'),
          t(' was named managing conservator of this child, pursuant to Chapter 262 of the Texas Family Code, Procedures In Suit By Governmental Entity to Protect Health and Safety of Child.  Accordingly, this Court finds that this child has been legally committed to, or placed in the custody of '),
          b('{{conservator_short}}'),
          t(':'),
        ],
      }),

      // Datos del menor — bloque sin bullets, indentado
      new Paragraph({
        indent: { left: convertInchesToTwip(0.5) },
        children: [b('Name: '), t('{{child_full_name}}')],
      }),
      new Paragraph({
        indent: { left: convertInchesToTwip(0.5) },
        children: [b('Sex: '), t('{{child_sex}}')],
      }),
      new Paragraph({
        indent: { left: convertInchesToTwip(0.5) },
        children: [b('Birth place: '), t('{{child_birth_place}}')],
      }),
      new Paragraph({
        indent: { left: convertInchesToTwip(0.5) },
        spacing: { after: 240 },
        children: [b('Birth date: '), t('{{child_birth_date}}')],
      }),

      // SECCIÓN 2 — Viability of Reunification
      new Paragraph({
        spacing: { before: 240, after: 120 },
        children: [u('2.  Viability of Reunification with One or Both Parents')],
      }),

      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 240 },
        children: [t('Further, this Court finds:')],
      }),

      // Mother reunification
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: convertInchesToTwip(0.5) },
        spacing: { after: 240 },
        children: [
          t('That reunification of this child with '),
          b('{{mother_name}}'),
          t(', mother, is not viable today or within the period of this Court’s jurisdiction due to '),
          b('{{mother_grounds}}'),
          t(' (Tex. Fam. Code § 261.001 et seq.).  This finding is based on '),
          t('{{mother_facts}}'),
          t('.'),
        ],
      }),

      // Father reunification
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: convertInchesToTwip(0.5) },
        spacing: { after: 240 },
        children: [
          t('That reunification of this child with '),
          b('{{father_name}}'),
          t(', father, is not viable today or within the period of this Court’s jurisdiction due to '),
          b('{{father_grounds}}'),
          t(' (Tex. Fam. Code § 261.001 et seq.).  This finding is based on '),
          t('{{father_facts}}'),
          t('.'),
        ],
      }),

      // Final order
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: convertInchesToTwip(0.5) },
        spacing: { after: 240 },
        children: [
          t('On '),
          b('{{final_order_date}}'),
          t(' this Court entered an order '),
          t('{{final_order_action}}'),
          t(' of this child.'),
        ],
      }),

      // SECCIÓN 3 — Best Interest
      new Paragraph({
        spacing: { before: 240, after: 120 },
        children: [u('3.  Not in Child’s Best Interest to Return')],
      }),

      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: convertInchesToTwip(0.5) },
        spacing: { after: 240 },
        children: [
          t('This Court also finds that it is not in this child’s best interest to return to '),
          b('{{child_country}}'),
          t(', the child’s country of nationality or last habitual residence, consistent with Texas Family Code §263.307(a).  This finding is based on '),
          t('{{best_interest_facts}}'),
          t('.'),
        ],
      }),

      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: convertInchesToTwip(0.5) },
        spacing: { after: 480 },
        children: [t('The primary purpose of this Order is to continue to provide protection and to implement a permanency plan.')],
      }),

      // Línea de firma del juez
      new Paragraph({
        spacing: { before: 720 },
        children: [
          b('Signed '),
          t('___________________________________'),
        ],
      }),
      new Paragraph({
        indent: { left: convertInchesToTwip(0.75) },
        children: [b('JUDGE')],
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

import('jszip').then(async ({ default: JSZip }) => {
  const z = await JSZip.loadAsync(buf)
  const xml = await z.file('word/document.xml').async('string')
  const tokens = [...new Set(xml.match(/\{\{[a-z_]+\}\}/g) ?? [])].sort()
  console.log('Tokens (' + tokens.length + '):')
  for (const tk of tokens) console.log('  ' + tk)
})
