import {
  Document,
  Packer,
  Paragraph,
  AlignmentType,
  TextRun,
  Footer,
  PageNumber,
} from 'docx'
import { markdownToDocxParagraphs } from './markdown-to-docx'

/**
 * Genera un .docx (Word) de la Carta de Exoneración (fee waiver letter) a
 * partir del markdown almacenado en `case_eoir26a_letter_drafts.body_md`.
 *
 * El parseo markdown → Paragraph[] vive en `markdown-to-docx.ts` (compartido
 * con appeal-letter-docx). Este archivo solo añade la metadata y footer
 * específicos de la Carta de Exoneración.
 */

interface BuildOpts {
  applicantName: string
  caseNumber: string
  bodyMarkdown: string
}

export async function buildEoir26aLetterDocx(opts: BuildOpts): Promise<Uint8Array> {
  const children = markdownToDocxParagraphs(opts.bodyMarkdown)

  const doc = new Document({
    creator: 'UsaLatino Prime',
    title: `Carta de Exoneración — ${opts.applicantName}`,
    description: `Fee Waiver Letter EOIR-26A — Caso ${opts.caseNumber}`,
    sections: [
      {
        properties: {},
        children,
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `Carta de Exoneración · Caso ${opts.caseNumber} · Página `,
                    size: 16,
                    color: '888888',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: '888888',
                  }),
                  new TextRun({
                    text: ' de ',
                    size: 16,
                    color: '888888',
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    color: '888888',
                  }),
                ],
              }),
            ],
          }),
        },
      },
    ],
  })

  const buffer = await Packer.toBuffer(doc)
  return new Uint8Array(buffer)
}
