import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  AlignmentType,
  TextRun,
  ExternalHyperlink,
  Footer,
  PageNumber,
} from 'docx'

/**
 * Genera un archivo .docx (Word) a partir del markdown de la Carta de
 * Apelación generada por Claude (`case_appeal_letter_drafts.body_md`).
 *
 * Estrategia: parseo línea-a-línea (igual que `credible-fear-docx.ts`)
 * porque el output de Claude sigue una estructura predecible definida en
 * `APPEAL_LETTER_SYSTEM`:
 *  - `# CARTA DE APELACIÓN...`            → Title
 *  - `## I. RESUMEN PROCESAL...`          → Heading 1
 *  - `### Subsección`                      → Heading 2
 *  - bullets con `- ` o `• `
 *  - numerados `1. ` o `1• `
 *  - `---` como separador
 *  - URLs inline → hipervínculo
 *  - `**bold**` y `*italic*`
 *
 * Salida: `Uint8Array` directamente streameable como respuesta HTTP.
 */

interface BuildOpts {
  applicantName: string
  caseNumber: string
  bodyMarkdown: string
}

export async function buildAppealLetterDocx(opts: BuildOpts): Promise<Uint8Array> {
  const children: Paragraph[] = []

  const lines = opts.bodyMarkdown.split('\n')
  // Skipear bloques HTML comment <!-- ... --> por si el modelo agrega
  // metadata estructurada (consistente con credible-fear).
  let insideComment = false

  for (const raw of lines) {
    const line = raw.replace(/\r$/, '')

    if (insideComment) {
      if (line.includes('-->')) insideComment = false
      continue
    }
    if (line.includes('<!--')) {
      if (!line.includes('-->')) insideComment = true
      continue
    }

    if (!line.trim()) {
      children.push(new Paragraph({ children: [new TextRun('')] }))
      continue
    }

    if (line.trim() === '---') {
      children.push(new Paragraph({
        border: { bottom: { style: 'single', size: 6, color: '999999', space: 1 } },
        children: [new TextRun('')],
      }))
      continue
    }

    if (line.startsWith('# ')) {
      children.push(new Paragraph({
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [
          new TextRun({
            text: line.replace(/^#\s+/, ''),
            bold: true,
            size: 32,
          }),
        ],
      }))
      continue
    }

    if (line.startsWith('## ')) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 120 },
        children: [
          new TextRun({
            text: line.replace(/^##\s+/, ''),
            bold: true,
            size: 26,
          }),
        ],
      }))
      continue
    }

    if (line.startsWith('### ')) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 160, after: 80 },
        children: [
          new TextRun({
            text: line.replace(/^###\s+/, ''),
            bold: true,
            italics: true,
            size: 22,
          }),
        ],
      }))
      continue
    }

    if (/^[\-•]\s+/.test(line.trim())) {
      const txt = line.trim().replace(/^[\-•]\s+/, '')
      children.push(new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 60 },
        children: parseInlineRuns(txt),
      }))
      continue
    }

    if (/^\d+[•.]\s+/.test(line.trim())) {
      const m = line.trim().match(/^(\d+[•.])\s+(.*)$/)
      if (m) {
        children.push(new Paragraph({
          indent: { left: 360 },
          spacing: { after: 80 },
          children: [
            new TextRun({ text: `${m[1]} `, bold: true }),
            ...parseInlineRuns(m[2]),
          ],
        }))
        continue
      }
    }

    children.push(new Paragraph({
      spacing: { after: 120 },
      children: parseInlineRuns(line),
    }))
  }

  const doc = new Document({
    creator: 'UsaLatino Prime',
    title: `Carta de Apelación — ${opts.applicantName}`,
    description: `Brief / Carta de Apelación BIA — Caso ${opts.caseNumber}`,
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
                    text: `Carta de Apelación · Caso ${opts.caseNumber} · Página `,
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

function parseInlineRuns(text: string): (TextRun | ExternalHyperlink)[] {
  const out: (TextRun | ExternalHyperlink)[] = []

  // Citas legales `*Matter of X-Y-Z-*` se renderizan como italics — patrón
  // estándar Bluebook que Claude usará. URLs y bold también soportados.
  const combined = /\[FUENTE:\s*(https?:\/\/[^\s\]]+)\s*\]|(https?:\/\/\S+)|\*\*([^*]+)\*\*|\*([^*]+)\*/g
  let lastIdx = 0
  let m: RegExpExecArray | null

  while ((m = combined.exec(text)) !== null) {
    if (m.index > lastIdx) {
      out.push(new TextRun(text.slice(lastIdx, m.index)))
    }
    if (m[1]) {
      out.push(
        new ExternalHyperlink({
          link: m[1],
          children: [new TextRun({ text: m[1], style: 'Hyperlink' })],
        }),
      )
    } else if (m[2]) {
      const url = m[2].replace(/[.,;)]+$/, '')
      out.push(
        new ExternalHyperlink({
          link: url,
          children: [new TextRun({ text: url, style: 'Hyperlink' })],
        }),
      )
    } else if (m[3]) {
      out.push(new TextRun({ text: m[3], bold: true }))
    } else if (m[4]) {
      out.push(new TextRun({ text: m[4], italics: true }))
    }
    lastIdx = m.index + m[0].length
  }
  if (lastIdx < text.length) {
    out.push(new TextRun(text.slice(lastIdx)))
  }
  if (out.length === 0) {
    out.push(new TextRun(text))
  }
  return out
}
