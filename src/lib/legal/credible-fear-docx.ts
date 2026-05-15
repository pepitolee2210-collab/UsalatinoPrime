import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  AlignmentType,
  TextRun,
  ExternalHyperlink,
} from 'docx'

/**
 * Genera un archivo .docx (Word) a partir del markdown del Miedo Creíble
 * persistido en `case_credible_fear_drafts.body_md`.
 *
 * Estrategia: parseo línea-a-línea (no full markdown parser) porque el output
 * de Claude sigue una estructura predecible definida en
 * `CREDIBLE_FEAR_SYSTEM`: `# título`, `## sección`, `### subsección`,
 * bullets con `- ` o `1• `, párrafos planos. Las URLs entre `[FUENTE: ...]`
 * se transforman en hipervínculos.
 *
 * El output es un Uint8Array directamente streameable como respuesta HTTP.
 */

interface BuildOpts {
  applicantName: string
  caseNumber: string
  bodyMarkdown: string
  /** Fuentes citadas por la IA (opcional, no usadas en el render actual). */
  sources?: Array<{ url: string; title: string }>
}

export async function buildCredibleFearDocx(opts: BuildOpts): Promise<Uint8Array> {
  const children: Paragraph[] = []

  const lines = opts.bodyMarkdown.split('\n')
  // Estado: si estamos dentro de un bloque HTML comment (<!-- ... -->)
  // skipear líneas. El prompt v3 embebe un JSON estructurado para la
  // Parte B/C del I-589 dentro de un comment; no debe aparecer en Word.
  let insideComment = false
  for (const raw of lines) {
    const line = raw.replace(/\r$/, '')
    if (insideComment) {
      if (line.includes('-->')) insideComment = false
      continue
    }
    if (line.includes('<!--')) {
      // Si el comment cierra en la misma línea, no cambia el estado;
      // si no, queda abierto hasta encontrar `-->`.
      if (!line.includes('-->')) insideComment = true
      continue
    }
    if (!line.trim()) {
      // Línea vacía → párrafo en blanco para separar bloques visualmente
      children.push(new Paragraph({ children: [new TextRun('')] }))
      continue
    }

    if (line.trim() === '---') {
      // Separador horizontal (antes del DECLARO...)
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
            size: 32, // half-points → 16pt
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

    // Bullets: '- ' o '• '
    if (/^[\-•]\s+/.test(line.trim())) {
      const txt = line.trim().replace(/^[\-•]\s+/, '')
      children.push(new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 60 },
        children: parseInlineRuns(txt),
      }))
      continue
    }

    // Numerados '1•' '2•' '1.' (formato de sección VI)
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

    // Párrafo plano
    children.push(new Paragraph({
      spacing: { after: 120 },
      children: parseInlineRuns(line),
    }))
  }

  const doc = new Document({
    creator: 'UsaLatino Prime',
    title: `Declaración de Miedo Creíble — ${opts.applicantName}`,
    description: `Caso ${opts.caseNumber}`,
    sections: [
      {
        properties: {},
        children,
      },
    ],
  })

  const buffer = await Packer.toBuffer(doc)
  return new Uint8Array(buffer)
}

/**
 * Convierte texto plano con tokens `[FUENTE: <url>]` (y URLs sueltas
 * `https://...`) a TextRuns alternados con ExternalHyperlinks. También
 * detecta `**bold**` y `*italic*` simples.
 */
function parseInlineRuns(text: string): (TextRun | ExternalHyperlink)[] {
  const out: (TextRun | ExternalHyperlink)[] = []

  // Patrones simultáneos: [FUENTE: url] | http(s)://... | **bold** | *italic*
  const combined = /\[FUENTE:\s*(https?:\/\/[^\s\]]+)\s*\]|(https?:\/\/\S+)|\*\*([^*]+)\*\*|\*([^*]+)\*/g
  let lastIdx = 0
  let m: RegExpExecArray | null

  while ((m = combined.exec(text)) !== null) {
    if (m.index > lastIdx) {
      out.push(new TextRun(text.slice(lastIdx, m.index)))
    }
    if (m[1]) {
      // [FUENTE: url] → hipervínculo limpio
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
