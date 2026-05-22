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
 * Estrategia: parseo línea-a-línea (no full markdown parser) porque el
 * output de Claude sigue una estructura predecible: `# título`, `## sección`,
 * `### subsección`, bullets con `- ` o `1• `, párrafos planos. URLs entre
 * `[FUENTE: ...]` y `https://...` sueltas se transforman en hipervínculos.
 *
 * **Estilo v6.1 (2026-05-23)**: tipografía **Aptos** en todo el documento,
 * **color negro** en TODOS los elementos (incluidos headings y URLs).
 * Diana puede cambiar manualmente si quiere, pero el default es
 * monocromático y formal — como lo pidió Henry.
 *
 * El output es un Uint8Array directamente streameable como respuesta HTTP.
 */

const APTOS = 'Aptos'
const BLACK = '000000'

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
  // skipear líneas. El prompt v3 embebía un JSON estructurado para la
  // Parte B/C del I-589 dentro de un comment; no debe aparecer en Word.
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
      children.push(new Paragraph({ children: [run('')] }))
      continue
    }

    if (line.trim() === '---') {
      children.push(new Paragraph({
        border: { bottom: { style: 'single', size: 6, color: '999999', space: 1 } },
        children: [run('')],
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
            font: APTOS,
            color: BLACK,
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
            font: APTOS,
            color: BLACK,
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
            font: APTOS,
            color: BLACK,
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
            run(`${m[1]} `, { bold: true }),
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
    title: `Credible Fear Declaration — ${opts.applicantName}`,
    description: `Case ${opts.caseNumber}`,
    // Estilos default: Aptos + negro en todo el documento.
    // Las TextRun ya tienen `font` y `color` explícitos como defensa, pero
    // estos defaults aplican a cualquier run que no los especifique.
    styles: {
      default: {
        document: { run: { font: APTOS, color: BLACK, size: 22 } },
        title: { run: { font: APTOS, color: BLACK, bold: true, size: 32 } },
        heading1: { run: { font: APTOS, color: BLACK, bold: true, size: 26 } },
        heading2: { run: { font: APTOS, color: BLACK, bold: true, italics: true, size: 22 } },
        hyperlink: { run: { font: APTOS, color: BLACK, underline: { type: 'single' } } },
      },
    },
    sections: [{ properties: {}, children }],
  })

  const buffer = await Packer.toBuffer(doc)
  return new Uint8Array(buffer)
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

/** TextRun shorthand con Aptos+negro aplicado por default. */
function run(text: string, opts: { bold?: boolean; italics?: boolean } = {}): TextRun {
  return new TextRun({ text, font: APTOS, color: BLACK, ...opts })
}

/** Hyperlink negro subrayado (NO usa style: 'Hyperlink' built-in que es azul). */
function hyperlinkRun(text: string, url: string): ExternalHyperlink {
  return new ExternalHyperlink({
    link: url,
    children: [
      new TextRun({
        text,
        font: APTOS,
        color: BLACK,
        underline: {},
      }),
    ],
  })
}

/**
 * Convierte texto plano con tokens `[FUENTE: <url>]` (y URLs sueltas
 * `https://...`) a TextRuns alternados con ExternalHyperlinks. También
 * detecta `**bold**` y `*italic*` simples.
 *
 * Todos los runs salen en Aptos + negro (los hyperlinks subrayados pero
 * también negros).
 */
function parseInlineRuns(text: string): (TextRun | ExternalHyperlink)[] {
  const out: (TextRun | ExternalHyperlink)[] = []
  const combined = /\[FUENTE:\s*(https?:\/\/[^\s\]]+)\s*\]|(https?:\/\/\S+)|\*\*([^*]+)\*\*|\*([^*]+)\*/g
  let lastIdx = 0
  let m: RegExpExecArray | null

  while ((m = combined.exec(text)) !== null) {
    if (m.index > lastIdx) {
      out.push(run(text.slice(lastIdx, m.index)))
    }
    if (m[1]) {
      out.push(hyperlinkRun(m[1], m[1]))
    } else if (m[2]) {
      const url = m[2].replace(/[.,;)]+$/, '')
      out.push(hyperlinkRun(url, url))
    } else if (m[3]) {
      out.push(run(m[3], { bold: true }))
    } else if (m[4]) {
      out.push(run(m[4], { italics: true }))
    }
    lastIdx = m.index + m[0].length
  }
  if (lastIdx < text.length) {
    out.push(run(text.slice(lastIdx)))
  }
  if (out.length === 0) {
    out.push(run(text))
  }
  return out
}
