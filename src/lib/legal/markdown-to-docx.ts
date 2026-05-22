// Parser markdown → docx compartido. Extraído de `appeal-letter-docx.ts` para
// que cada nueva carta IA (apelación, exoneración EOIR-26A, etc.) reuse el
// mismo parseo y solo configure metadata (title/footer/description) propia.
//
// Soporta:
//  - `# Title` → centrado, bold, tamaño grande (Title heading)
//  - `## Heading 1`, `### Heading 2`
//  - `- bullet` / `• bullet` → bullet points
//  - `1. numbered` / `1• numbered` → numerada
//  - `---` → separador horizontal
//  - `**bold**`, `*italic*`
//  - URLs inline → hyperlink clickeable
//  - `[FUENTE: url]` → hyperlink con etiqueta Bluebook
//  - Comentarios HTML `<!-- ... -->` → ignorados

import {
  Paragraph,
  HeadingLevel,
  AlignmentType,
  TextRun,
  ExternalHyperlink,
} from 'docx'

/**
 * Convierte un cuerpo en markdown al árbol de `Paragraph` que `docx` espera.
 * El caller envuelve el resultado en un `Document` con sus propios metadata
 * y footer.
 */
export function markdownToDocxParagraphs(bodyMarkdown: string): Paragraph[] {
  const children: Paragraph[] = []

  const lines = bodyMarkdown.split('\n')
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
      children.push(
        new Paragraph({
          border: { bottom: { style: 'single', size: 6, color: '999999', space: 1 } },
          children: [new TextRun('')],
        }),
      )
      continue
    }

    if (line.startsWith('# ')) {
      children.push(
        new Paragraph({
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
        }),
      )
      continue
    }

    if (line.startsWith('## ')) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 120 },
          children: [
            new TextRun({
              text: line.replace(/^##\s+/, ''),
              bold: true,
              size: 26,
            }),
          ],
        }),
      )
      continue
    }

    if (line.startsWith('### ')) {
      children.push(
        new Paragraph({
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
        }),
      )
      continue
    }

    if (/^[\-•]\s+/.test(line.trim())) {
      const txt = line.trim().replace(/^[\-•]\s+/, '')
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 60 },
          children: parseInlineRuns(txt),
        }),
      )
      continue
    }

    if (/^\d+[•.]\s+/.test(line.trim())) {
      const m = line.trim().match(/^(\d+[•.])\s+(.*)$/)
      if (m) {
        children.push(
          new Paragraph({
            indent: { left: 360 },
            spacing: { after: 80 },
            children: [
              new TextRun({ text: `${m[1]} `, bold: true }),
              ...parseInlineRuns(m[2]),
            ],
          }),
        )
        continue
      }
    }

    children.push(
      new Paragraph({
        spacing: { after: 120 },
        children: parseInlineRuns(line),
      }),
    )
  }

  return children
}

/**
 * Parsea una línea inline a runs de docx: bold (`**x**`), italics (`*x*`),
 * URLs (clickables) y `[FUENTE: url]` (hyperlink con etiqueta Bluebook).
 */
export function parseInlineRuns(text: string): (TextRun | ExternalHyperlink)[] {
  const out: (TextRun | ExternalHyperlink)[] = []

  const combined =
    /\[FUENTE:\s*(https?:\/\/[^\s\]]+)\s*\]|(https?:\/\/\S+)|\*\*([^*]+)\*\*|\*([^*]+)\*/g
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
