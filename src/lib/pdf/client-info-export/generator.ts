// Generador PDF para "Información del cliente".
//
// Construye el documento con pdf-lib usando StandardFonts.Helvetica + Bold.
// El layout es:
//   - Página 1: portada con branding + datos del cliente + lista de formularios.
//   - Páginas 2+: una sección por formulario, agrupadas por fase del servicio.
//   - Página final (opcional): banner con errores parciales si los hubo.
//
// El coordinate system de pdf-lib es origin bottom-left. Mantenemos un cursor
// `y` que es la Y absoluta de pdf-lib (en pt) y vamos decrementando al
// renderizar. `checkPageBreak(needed)` salta a nueva página si no cabe.
//
// IMPORTANTE: TODO texto pasa por `safeWinAnsi` antes de drawText. Helvetica
// es WinAnsi (CP1252) — soporta español completo pero falla con emojis o
// caracteres exóticos. El sanitizador defensivo evita excepciones.

import { PDFDocument, PDFPage, StandardFonts, PDFFont, rgb } from 'pdf-lib'
import { sanitizeFilledPdf } from '@/lib/pdf/sanitize-pdf'
import { getServicePhases } from '@/lib/services/registry'

import type {
  CaseSnapshot,
  ClientInfoPdfInput,
  ClientInfoSection,
  ClientProfileSnapshot,
  RenderRow,
  RenderSubsection,
  StatusBadge,
} from './types'
import {
  EMPTY_PLACEHOLDER,
  fmtDateLong,
  safeWinAnsi,
} from './formatters'

// ── Page metrics (Letter) ──────────────────────────────────────────────
const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const MARGIN_LEFT = 51        // 18mm
const MARGIN_RIGHT = 51
const MARGIN_TOP_COVER = 71   // 25mm
const MARGIN_TOP_BODY = 51    // 18mm
const MARGIN_BOTTOM = 62      // 22mm
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT

// ── Colors ────────────────────────────────────────────────────────────
const NAVY = rgb(0, 0.157, 0.333)
const GOLD = rgb(0.847, 0.608, 0.114)
const BLACK = rgb(0.16, 0.16, 0.16)
const GRAY_LABEL = rgb(0.45, 0.45, 0.45)
const GRAY_SUBTLE = rgb(0.7, 0.7, 0.7)
const GRAY_FOOTER = rgb(0.63, 0.63, 0.63)
const GRAY_LINE = rgb(0.85, 0.85, 0.85)
const GREEN = rgb(0.13, 0.55, 0.21)
const TONE_WARNING = rgb(0.97, 0.85, 0.45)
const TONE_WARNING_BG = rgb(0.99, 0.96, 0.88)
const HEADER_BG = rgb(0.96, 0.96, 0.97)

// ── Sizes ────────────────────────────────────────────────────────────
const FS_COVER_TITLE = 22
const FS_COVER_SUB = 14
const FS_COVER_META_LABEL = 9
const FS_COVER_META_VALUE = 11
const FS_PHASE_BAR = 12
const FS_SECTION_TITLE = 13
const FS_SECTION_META = 9
const FS_BADGE = 9
const FS_SUBSECTION = 10
const FS_LABEL = 8
const FS_VALUE = 9.5
const FS_TABLE_HEADER = 8
const FS_TABLE_CELL = 8.5
const FS_FOOTER = 7

const LINE_HEIGHT_FACTOR = 1.3

interface RenderCtx {
  doc: PDFDocument
  helv: PDFFont
  helvBold: PDFFont
  page: PDFPage
  /** Y actual desde el BOTTOM (coord pdf-lib). */
  y: number
  /** Top Y donde empezar a dibujar en una nueva página. */
  topY: number
  /** Page number (1-indexed). */
  pageNumber: number
  /** Para el footer. */
  caseNumber: string
}

export async function generateClientInfoPdf(input: ClientInfoPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(`Información del cliente — Caso ${safeWinAnsi(input.caseSnapshot.caseNumber)}`)
  doc.setAuthor('UsaLatino Prime')
  doc.setProducer('UsaLatino Prime')
  doc.setCreator('UsaLatino Prime — Client Info Export')
  doc.setCreationDate(new Date(input.generatedAt))

  const helv = await doc.embedFont(StandardFonts.Helvetica)
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const ctx: RenderCtx = {
    doc,
    helv,
    helvBold,
    page: doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    y: PAGE_HEIGHT - MARGIN_TOP_COVER,
    topY: PAGE_HEIGHT - MARGIN_TOP_BODY,
    pageNumber: 1,
    caseNumber: input.caseSnapshot.caseNumber,
  }

  drawCoverPage(ctx, input)
  drawFooter(ctx)

  const orderedSections = sortSectionsByPhase(input.sections, input.caseSnapshot.serviceSlug)

  // Una página por bloque de fase para tener separación visual clara.
  let currentPhase: string | null | undefined = undefined
  for (const section of orderedSections) {
    if (section.phase !== currentPhase) {
      currentPhase = section.phase ?? null
      newPage(ctx)
      drawPhaseBar(ctx, formatPhaseLabel(currentPhase, input.caseSnapshot.serviceSlug))
    }
    drawSection(ctx, section)
  }

  if (orderedSections.length === 0) {
    newPage(ctx)
    drawEmptyState(ctx)
  }

  if (input.partialErrors.length > 0) {
    newPage(ctx)
    drawPartialErrors(ctx, input.partialErrors)
  }

  // Defense-in-depth: aunque el doc se construyó from-scratch, mantenemos la
  // disciplina del resto del proyecto (los I-589/I-360 hacen lo mismo).
  sanitizeFilledPdf(doc)

  return doc.save()
}

// ───────────────────────────────────────────────────────────────────────
// Portada
// ───────────────────────────────────────────────────────────────────────

function drawCoverPage(ctx: RenderCtx, input: ClientInfoPdfInput): void {
  const { caseSnapshot, clientProfile, sections } = input

  // Línea dorada superior
  ctx.page.drawRectangle({
    x: MARGIN_LEFT,
    y: PAGE_HEIGHT - 38,
    width: CONTENT_WIDTH,
    height: 3,
    color: GOLD,
  })

  ctx.y = PAGE_HEIGHT - 110

  // Título
  drawText(ctx, 'USALATINO PRIME', { font: ctx.helvBold, size: FS_COVER_TITLE, color: NAVY })
  ctx.y -= 28
  drawText(ctx, 'Información del Cliente', { font: ctx.helv, size: FS_COVER_SUB, color: GOLD })
  ctx.y -= 28

  // Caja con datos
  const fullName = formatFullName(clientProfile)
  const meta: { label: string; value: string }[] = [
    { label: 'Cliente', value: fullName },
    { label: 'Teléfono', value: clientProfile.phone ?? EMPTY_PLACEHOLDER },
    { label: 'Caso #', value: caseSnapshot.caseNumber },
    { label: 'Servicio', value: caseSnapshot.serviceName },
    {
      label: 'Fase actual',
      value: caseSnapshot.currentPhaseLabel ?? caseSnapshot.currentPhase ?? EMPTY_PLACEHOLDER,
    },
    { label: 'Generado', value: fmtDateLong(input.generatedAt) },
  ]
  for (const m of meta) {
    drawText(ctx, m.label, { font: ctx.helv, size: FS_COVER_META_LABEL, color: GRAY_LABEL })
    ctx.y -= 12
    drawText(ctx, m.value, { font: ctx.helvBold, size: FS_COVER_META_VALUE, color: BLACK })
    ctx.y -= 18
  }

  // Línea separadora
  ctx.y -= 6
  ctx.page.drawLine({
    start: { x: MARGIN_LEFT, y: ctx.y },
    end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: ctx.y },
    color: GRAY_LINE,
    thickness: 0.5,
  })
  ctx.y -= 18

  drawText(ctx, 'Formularios incluidos en este expediente', {
    font: ctx.helvBold,
    size: FS_SECTION_META,
    color: NAVY,
  })
  ctx.y -= 16

  if (sections.length === 0) {
    drawText(ctx, '— El cliente aún no ha llenado ningún formulario —', {
      font: ctx.helv,
      size: FS_COVER_META_VALUE,
      color: GRAY_SUBTLE,
    })
    ctx.y -= 14
  } else {
    const totalFilled = sections.reduce((acc, s) => acc + s.filledCount, 0)
    for (const section of sortSectionsByPhase(sections, caseSnapshot.serviceSlug)) {
      const left = `${truncate(section.title, 60)}`
      const right = `${section.statusBadge.label}`
      drawText(ctx, left, { font: ctx.helv, size: FS_COVER_META_VALUE, color: BLACK })
      // Alinear el badge a la derecha
      const rightWidth = ctx.helv.widthOfTextAtSize(safeWinAnsi(right), FS_COVER_META_VALUE)
      ctx.page.drawText(safeWinAnsi(right), {
        x: PAGE_WIDTH - MARGIN_RIGHT - rightWidth,
        y: ctx.y,
        size: FS_COVER_META_VALUE,
        font: ctx.helv,
        color: section.statusBadge.tone === 'submitted' ? GREEN : section.statusBadge.tone === 'draft' ? GOLD : GRAY_LABEL,
      })
      ctx.y -= 14
      if (ctx.y < MARGIN_BOTTOM + 60) break
    }
    ctx.y -= 8
    drawText(ctx, `Total: ${sections.length} formularios · ${totalFilled} campos llenados`, {
      font: ctx.helvBold,
      size: FS_SECTION_META,
      color: NAVY,
    })
  }
}

// ───────────────────────────────────────────────────────────────────────
// Sección
// ───────────────────────────────────────────────────────────────────────

function drawSection(ctx: RenderCtx, section: ClientInfoSection): void {
  checkPageBreak(ctx, 70)

  // Título del formulario
  drawText(ctx, section.title, { font: ctx.helvBold, size: FS_SECTION_TITLE, color: NAVY })
  ctx.y -= 16

  // Badge + cantidad de campos
  drawBadge(ctx, section.statusBadge)
  // Reserva espacio al lado derecho del badge para "N campos"
  const meta = `${section.filledCount} campo${section.filledCount === 1 ? '' : 's'} llenado${section.filledCount === 1 ? '' : 's'}`
  const metaWidth = ctx.helv.widthOfTextAtSize(safeWinAnsi(meta), FS_SECTION_META)
  ctx.page.drawText(safeWinAnsi(meta), {
    x: PAGE_WIDTH - MARGIN_RIGHT - metaWidth,
    y: ctx.y + 12,
    size: FS_SECTION_META,
    font: ctx.helv,
    color: GRAY_LABEL,
  })
  ctx.y -= 12

  if (section.warning) {
    drawWarning(ctx, section.warning)
  }

  // Filas planas
  if (section.rows.length > 0) {
    for (const row of section.rows) {
      drawRow(ctx, row)
    }
    ctx.y -= 6
  }

  // Sub-secciones
  if (section.subsections && section.subsections.length > 0) {
    for (const sub of section.subsections) {
      drawSubsection(ctx, sub)
    }
  }

  // Margen al final
  ctx.y -= 12
}

function drawSubsection(ctx: RenderCtx, sub: RenderSubsection): void {
  checkPageBreak(ctx, 40)
  drawText(ctx, sub.title.toUpperCase(), { font: ctx.helvBold, size: FS_SUBSECTION, color: NAVY })
  ctx.y -= 4
  ctx.page.drawLine({
    start: { x: MARGIN_LEFT, y: ctx.y },
    end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: ctx.y },
    color: GRAY_LINE,
    thickness: 0.4,
  })
  ctx.y -= 10

  if (sub.table) {
    drawTable(ctx, sub.table)
    return
  }

  for (const row of sub.rows) {
    drawRow(ctx, row)
  }
  ctx.y -= 6
}

function drawRow(ctx: RenderCtx, row: RenderRow): void {
  const isLong = row.kind === 'longText'

  const label = safeWinAnsi(row.label)
  const value = safeWinAnsi(row.value)

  if (isLong) {
    checkPageBreak(ctx, 30)
    drawText(ctx, label, { font: ctx.helv, size: FS_LABEL, color: GRAY_LABEL })
    ctx.y -= 10
    drawWrappedText(ctx, value, {
      x: MARGIN_LEFT,
      maxWidth: CONTENT_WIDTH,
      size: FS_VALUE,
      font: ctx.helv,
      color: BLACK,
    })
    ctx.y -= 6
    return
  }

  // Inline: label arriba, value debajo. Caso compacto.
  checkPageBreak(ctx, 22)
  drawText(ctx, label, { font: ctx.helv, size: FS_LABEL, color: GRAY_LABEL })
  ctx.y -= 9
  drawWrappedText(ctx, value, {
    x: MARGIN_LEFT,
    maxWidth: CONTENT_WIDTH,
    size: FS_VALUE,
    font: ctx.helv,
    color: row.value === EMPTY_PLACEHOLDER ? GRAY_SUBTLE : BLACK,
  })
  ctx.y -= 4
}

function drawTable(ctx: RenderCtx, table: { headers: string[]; rows: string[][] }): void {
  if (table.headers.length === 0 || table.rows.length === 0) {
    drawText(ctx, '— Sin registros —', { font: ctx.helv, size: FS_VALUE, color: GRAY_SUBTLE })
    ctx.y -= 12
    return
  }

  const colCount = table.headers.length
  const colWidth = CONTENT_WIDTH / colCount
  const rowPaddingX = 4
  const rowPaddingY = 4

  // Header
  const headerHeight = FS_TABLE_HEADER * LINE_HEIGHT_FACTOR + rowPaddingY * 2
  checkPageBreak(ctx, headerHeight + 20)
  ctx.page.drawRectangle({
    x: MARGIN_LEFT,
    y: ctx.y - headerHeight + 2,
    width: CONTENT_WIDTH,
    height: headerHeight,
    color: HEADER_BG,
  })
  for (let c = 0; c < colCount; c++) {
    ctx.page.drawText(safeWinAnsi(table.headers[c]), {
      x: MARGIN_LEFT + c * colWidth + rowPaddingX,
      y: ctx.y - rowPaddingY - FS_TABLE_HEADER,
      size: FS_TABLE_HEADER,
      font: ctx.helvBold,
      color: GRAY_LABEL,
    })
  }
  ctx.y -= headerHeight + 2

  // Filas
  for (const row of table.rows) {
    const cellHeights: number[] = []
    for (let c = 0; c < colCount; c++) {
      const lines = wrapLines(
        safeWinAnsi(row[c] ?? ''),
        colWidth - rowPaddingX * 2,
        FS_TABLE_CELL,
        ctx.helv,
      )
      cellHeights.push(lines.length * FS_TABLE_CELL * LINE_HEIGHT_FACTOR + rowPaddingY * 2)
    }
    const rowHeight = Math.max(...cellHeights, FS_TABLE_CELL + rowPaddingY * 2)

    checkPageBreak(ctx, rowHeight)

    // Línea horizontal sutil
    ctx.page.drawLine({
      start: { x: MARGIN_LEFT, y: ctx.y },
      end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: ctx.y },
      color: GRAY_LINE,
      thickness: 0.4,
    })

    for (let c = 0; c < colCount; c++) {
      drawWrappedText(ctx, row[c] ?? '', {
        x: MARGIN_LEFT + c * colWidth + rowPaddingX,
        maxWidth: colWidth - rowPaddingX * 2,
        size: FS_TABLE_CELL,
        font: ctx.helv,
        color: BLACK,
        startY: ctx.y - rowPaddingY,
        dontMoveCursor: true,
      })
    }
    ctx.y -= rowHeight
  }

  // Línea final
  ctx.page.drawLine({
    start: { x: MARGIN_LEFT, y: ctx.y },
    end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: ctx.y },
    color: GRAY_LINE,
    thickness: 0.4,
  })
  ctx.y -= 8
}

// ───────────────────────────────────────────────────────────────────────
// Footer / Page break
// ───────────────────────────────────────────────────────────────────────

function drawFooter(ctx: RenderCtx): void {
  const text = `UsaLatino Prime  ·  Caso #${ctx.caseNumber}  ·  Pág. ${ctx.pageNumber}`
  const safe = safeWinAnsi(text)
  const width = ctx.helv.widthOfTextAtSize(safe, FS_FOOTER)
  ctx.page.drawText(safe, {
    x: (PAGE_WIDTH - width) / 2,
    y: MARGIN_BOTTOM - 30,
    size: FS_FOOTER,
    font: ctx.helv,
    color: GRAY_FOOTER,
  })
  // Línea fina sobre el footer
  ctx.page.drawLine({
    start: { x: MARGIN_LEFT, y: MARGIN_BOTTOM - 14 },
    end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: MARGIN_BOTTOM - 14 },
    color: GRAY_LINE,
    thickness: 0.4,
  })
}

function newPage(ctx: RenderCtx): void {
  drawFooter(ctx)
  ctx.page = ctx.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  ctx.pageNumber += 1
  ctx.y = ctx.topY
}

function checkPageBreak(ctx: RenderCtx, neededSpace: number): void {
  if (ctx.y - neededSpace < MARGIN_BOTTOM) {
    newPage(ctx)
  }
}

// ───────────────────────────────────────────────────────────────────────
// Drawing primitives
// ───────────────────────────────────────────────────────────────────────

interface DrawTextOpts {
  font: PDFFont
  size: number
  color: ReturnType<typeof rgb>
}

function drawText(ctx: RenderCtx, text: string, opts: DrawTextOpts): void {
  ctx.page.drawText(safeWinAnsi(text), {
    x: MARGIN_LEFT,
    y: ctx.y,
    size: opts.size,
    font: opts.font,
    color: opts.color,
  })
}

interface DrawWrappedOpts {
  x: number
  maxWidth: number
  size: number
  font: PDFFont
  color: ReturnType<typeof rgb>
  /** Y inicial. Si no se pasa, usa ctx.y. */
  startY?: number
  /** Si true, NO actualiza ctx.y (útil para celdas de tabla). */
  dontMoveCursor?: boolean
}

function drawWrappedText(ctx: RenderCtx, text: string, opts: DrawWrappedOpts): void {
  const safe = safeWinAnsi(text)
  const lines = wrapLines(safe, opts.maxWidth, opts.size, opts.font)
  const lineHeight = opts.size * LINE_HEIGHT_FACTOR
  let y = opts.startY ?? ctx.y

  for (const line of lines) {
    if (!opts.dontMoveCursor) checkPageBreak(ctx, lineHeight)
    if (!opts.dontMoveCursor) y = ctx.y
    ctx.page.drawText(line, {
      x: opts.x,
      y,
      size: opts.size,
      font: opts.font,
      color: opts.color,
    })
    if (opts.dontMoveCursor) {
      y -= lineHeight
    } else {
      ctx.y -= lineHeight
    }
  }
}

function wrapLines(text: string, maxWidth: number, size: number, font: PDFFont): string[] {
  if (!text) return ['']
  const paragraphs = text.split(/\r?\n/)
  const out: string[] = []
  for (const para of paragraphs) {
    if (para.length === 0) {
      out.push('')
      continue
    }
    const words = para.split(/\s+/).filter(Boolean)
    let line = ''
    for (const word of words) {
      const candidate = line ? line + ' ' + word : word
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate
      } else {
        if (line) out.push(line)
        // Si la palabra sola excede el maxWidth, hace hard-break por chars.
        if (font.widthOfTextAtSize(word, size) > maxWidth) {
          let chunk = ''
          for (const ch of word) {
            const next = chunk + ch
            if (font.widthOfTextAtSize(next, size) > maxWidth && chunk) {
              out.push(chunk)
              chunk = ch
            } else {
              chunk = next
            }
          }
          line = chunk
        } else {
          line = word
        }
      }
    }
    if (line) out.push(line)
  }
  return out
}

function drawBadge(ctx: RenderCtx, badge: StatusBadge): void {
  const safe = safeWinAnsi(badge.label)
  const padX = 6
  const padY = 3
  const w = ctx.helv.widthOfTextAtSize(safe, FS_BADGE) + padX * 2
  const h = FS_BADGE + padY * 2
  const color =
    badge.tone === 'submitted'
      ? GREEN
      : badge.tone === 'draft'
      ? GOLD
      : badge.tone === 'reviewed'
      ? NAVY
      : GRAY_LABEL
  ctx.page.drawRectangle({
    x: MARGIN_LEFT,
    y: ctx.y + 6,
    width: w,
    height: h,
    borderColor: color,
    borderWidth: 0.5,
    color: undefined,
  })
  ctx.page.drawText(safe, {
    x: MARGIN_LEFT + padX,
    y: ctx.y + 6 + padY,
    size: FS_BADGE,
    font: ctx.helvBold,
    color,
  })
}

function drawPhaseBar(ctx: RenderCtx, label: string): void {
  const h = FS_PHASE_BAR + 12
  ctx.page.drawRectangle({
    x: MARGIN_LEFT,
    y: ctx.y - h + 4,
    width: CONTENT_WIDTH,
    height: h,
    color: GOLD,
  })
  ctx.page.drawText(safeWinAnsi(label.toUpperCase()), {
    x: MARGIN_LEFT + 10,
    y: ctx.y - h + 4 + 6,
    size: FS_PHASE_BAR,
    font: ctx.helvBold,
    color: rgb(1, 1, 1),
  })
  ctx.y -= h + 16
}

function drawWarning(ctx: RenderCtx, message: string): void {
  const safe = safeWinAnsi(message)
  const lines = wrapLines(safe, CONTENT_WIDTH - 16, FS_LABEL, ctx.helv)
  const lineHeight = FS_LABEL * LINE_HEIGHT_FACTOR
  const boxHeight = lines.length * lineHeight + 10
  checkPageBreak(ctx, boxHeight + 8)
  ctx.page.drawRectangle({
    x: MARGIN_LEFT,
    y: ctx.y - boxHeight + 4,
    width: CONTENT_WIDTH,
    height: boxHeight,
    color: TONE_WARNING_BG,
    borderColor: TONE_WARNING,
    borderWidth: 0.5,
  })
  let y = ctx.y - 6
  for (const line of lines) {
    ctx.page.drawText(line, {
      x: MARGIN_LEFT + 8,
      y,
      size: FS_LABEL,
      font: ctx.helv,
      color: rgb(0.5, 0.35, 0.05),
    })
    y -= lineHeight
  }
  ctx.y -= boxHeight + 8
}

function drawEmptyState(ctx: RenderCtx): void {
  ctx.y -= 60
  drawText(ctx, 'El cliente aún no ha llenado ningún formulario en este caso.', {
    font: ctx.helv,
    size: FS_VALUE,
    color: GRAY_LABEL,
  })
}

function drawPartialErrors(ctx: RenderCtx, errors: string[]): void {
  drawText(ctx, 'Datos parciales', {
    font: ctx.helvBold,
    size: FS_SECTION_TITLE,
    color: NAVY,
  })
  ctx.y -= 14
  drawText(ctx, `Algunas fuentes no pudieron leerse (${errors.length}):`, {
    font: ctx.helv,
    size: FS_VALUE,
    color: GRAY_LABEL,
  })
  ctx.y -= 14
  for (const err of errors) {
    drawWrappedText(ctx, `• ${err}`, {
      x: MARGIN_LEFT,
      maxWidth: CONTENT_WIDTH,
      size: FS_LABEL,
      font: ctx.helv,
      color: GRAY_LABEL,
    })
    ctx.y -= 4
  }
}

// ───────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────

function sortSectionsByPhase(sections: ClientInfoSection[], serviceSlug: string): ClientInfoSection[] {
  const phases = getServicePhases(serviceSlug ?? null)
  const orderOf = (phase: string | null | undefined): number => {
    if (!phase) return phases.length + 1
    const found = phases.findIndex((p) => p.code === phase)
    return found < 0 ? phases.length + 1 : found
  }
  return [...sections].sort((a, b) => {
    const oa = orderOf(a.phase as string | null)
    const ob = orderOf(b.phase as string | null)
    if (oa !== ob) return oa - ob
    return a.title.localeCompare(b.title, 'es')
  })
}

function formatPhaseLabel(phase: string | null | undefined, serviceSlug: string): string {
  if (!phase) return 'Otros formularios'
  const phases = getServicePhases(serviceSlug ?? null)
  const def = phases.find((p) => p.code === phase)
  if (def) return def.label
  // Capitalizar fallback
  return phase.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatFullName(profile: ClientProfileSnapshot): string {
  const parts = [profile.firstName, profile.middleName, profile.lastName].filter(Boolean)
  if (parts.length === 0) return EMPTY_PLACEHOLDER
  return parts.join(' ')
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + '…'
}

// Para uso externo: snapshot del caso a partir de CaseSnapshot.
// Mantenido aquí por simetría aunque no se usa fuera del archivo.
export function snapshotToProfile(_caseSnapshot: CaseSnapshot): null {
  return null
}
