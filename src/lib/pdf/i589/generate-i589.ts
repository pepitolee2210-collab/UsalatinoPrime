import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { i589FieldMap } from './field-map'

// FPDF uses mm from top-left. pdf-lib uses points from bottom-left.
// Template PDF is A4 size: 297mm height (not US Letter 279.4mm)
const PAGE_HEIGHT_MM = 297
const MM_TO_PT = 2.83465

// Global offsets for fine-tuning (adjust if text appears shifted)
const X_OFFSET = 0
const Y_OFFSET = 0

function fpdfToPdfLib(fpdfX: number, fpdfY: number): { x: number; y: number } {
  return {
    x: (fpdfX + X_OFFSET) * MM_TO_PT,
    y: (PAGE_HEIGHT_MM - fpdfY + Y_OFFSET) * MM_TO_PT,
  }
}

/**
 * Resolve a dot-notation key with array support from form_data.
 * Examples:
 *   'legal_last_name' -> formData.legal_last_name
 *   'spouse_info.spouse_last_name' -> formData.spouse_info?.spouse_last_name
 *   'children[0].child_last_name' -> formData.children?.[0]?.child_last_name
 */
function resolveValue(formData: Record<string, any>, key: string): any {
  if (key.startsWith('_static')) return undefined

  const parts = key.split('.')
  let current: any = formData

  for (const part of parts) {
    if (current == null) return undefined

    // Handle array index: children[0]
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/)
    if (arrayMatch) {
      const arrayKey = arrayMatch[1]
      const index = parseInt(arrayMatch[2], 10)
      current = current[arrayKey]
      if (!Array.isArray(current) || index >= current.length) return undefined
      current = current[index]
    } else {
      current = current[part]
    }
  }

  return current
}

function safeString(val: any): string {
  if (val == null || val === 'N/A') return ''
  if (typeof val === 'boolean') return ''
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

export async function generateI589PDF(formData: Record<string, any>): Promise<Uint8Array> {
  // Load the template PDF
  const templateUrl = '/forms/i-589.pdf'
  const response = await fetch(templateUrl)
  if (!response.ok) {
    throw new Error(`No se pudo cargar la plantilla I-589: ${response.statusText}`)
  }
  const templateBytes = await response.arrayBuffer()

  const pdfDoc = await PDFDocument.load(templateBytes)
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const pages = pdfDoc.getPages()

  const DEFAULT_FONT_SIZE = 10

  for (const field of i589FieldMap) {
    const pageIndex = field.page
    if (pageIndex >= pages.length) continue

    const page = pages[pageIndex]

    // Resolve value
    const rawValue = resolveValue(formData, field.formDataKey)

    // Apply transform
    let text: string
    if (field.transform) {
      text = field.transform(rawValue, formData)
    } else {
      text = safeString(rawValue)
    }

    // Skip empty values
    if (!text) continue

    // Convert coordinates
    const { x, y } = fpdfToPdfLib(field.x, field.y)
    let fontSize = field.fontSize || (field.type === 'checkbox' ? 10 : DEFAULT_FONT_SIZE)

    // Auto-shrink font if text exceeds maxWidth
    if (field.maxWidth) {
      const maxWidthPt = field.maxWidth * MM_TO_PT
      let textWidth = font.widthOfTextAtSize(text, fontSize)
      while (textWidth > maxWidthPt && fontSize > 5) {
        fontSize -= 0.5
        textWidth = font.widthOfTextAtSize(text, fontSize)
      }
    }

    // FPDF internally offsets text by 0.3 * FontSize (in user units/mm).
    // This translates to 0.3 * fontSize_pt in points. We must apply this
    // correction so our text lands at the same position as FPDF's output.
    const fpdfYCorrection = 0.3 * fontSize

    page.drawText(text, {
      x,
      y: y - fpdfYCorrection,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    })
  }

  return pdfDoc.save()
}
