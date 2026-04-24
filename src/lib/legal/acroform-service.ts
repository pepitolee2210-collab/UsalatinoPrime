import { PDFDocument, PDFForm, PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown } from 'pdf-lib'
import { createLogger } from '@/lib/logger'

const log = createLogger('acroform-service')

/**
 * Schema de un campo detectado en el PDF (sea via AcroForm nativo o OCR).
 * Este shape viaja idéntico al cliente y se renderiza como UI de formulario.
 */
export interface DetectedField {
  /** Nombre EXACTO del campo en el PDF (para fillPdf). */
  name: string
  /** Tipo de control de UI a renderizar. */
  type: 'text' | 'checkbox' | 'radio' | 'dropdown' | 'date' | 'number' | 'signature' | 'unknown'
  /** Label legible en español para mostrar al usuario. */
  label: string
  /** Tooltip o texto de ayuda con lo que el campo espera. */
  help_text?: string
  /** Opciones para radio/dropdown. */
  options?: string[]
  /** Si está marcado como obligatorio por el PDF. */
  required: boolean
  /** Valor default leído del PDF (si lo tiene). */
  default_value?: string
  /**
   * True si la IA considera que este campo es relevante para un caso SIJS
   * (ej. "nombre del peticionario" SÍ es relevante, "fecha del divorcio" NO lo
   * es aunque exista en el form porque el form es multi-uso).
   * Si null/undefined, se considera relevante por default hasta que corra el
   * paso de AI-suggestion.
   */
  sijs_relevant?: boolean
  /** Sugerencia de valor para este campo específico (llenada por Claude). */
  ai_suggestion?: string
  /** Razonamiento de por qué la IA sugirió ese valor (auditable). */
  ai_reasoning?: string
}

export interface DetectResult {
  source: 'acroform' | 'ocr_gemini' | 'failed'
  fields: DetectedField[]
  error?: string
}

/**
 * Descarga un PDF desde URL y retorna el buffer. Reusa el binary para
 * evitar doble fetch en el pipeline.
 */
async function fetchPdfBuffer(url: string): Promise<Uint8Array> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(30_000),
    headers: { 'User-Agent': 'UsaLatinoPrime-AcroFormService/1.0' },
  })
  if (!res.ok) {
    throw new Error(`No se pudo descargar el PDF oficial: HTTP ${res.status}`)
  }
  const buf = await res.arrayBuffer()
  return new Uint8Array(buf)
}

/**
 * Mapea el tipo nativo de pdf-lib a nuestro enum de UI.
 */
function mapFieldType(field: unknown): DetectedField['type'] {
  if (field instanceof PDFTextField) {
    const isMultiline = field.isMultiline()
    return isMultiline ? 'text' : 'text'
  }
  if (field instanceof PDFCheckBox) return 'checkbox'
  if (field instanceof PDFRadioGroup) return 'radio'
  if (field instanceof PDFDropdown) return 'dropdown'
  return 'unknown'
}

/**
 * Deriva un label legible en español a partir del nombre técnico del campo.
 * AcroForms muchas veces tienen nombres "Text1", "Petitioner_Name[0]" —
 * este helper los limpia para mostrar algo razonable en UI.
 *
 * Claude después puede sobrescribir con ai_suggestion + label mejor.
 */
function humanizeFieldName(name: string): string {
  const cleaned = name
    .replace(/\[[0-9]+\]/g, '')
    .replace(/[_\-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
  if (cleaned.length < 2) return name
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

/**
 * Intenta detectar campos AcroForm nativos con pdf-lib. Si el PDF no tiene
 * form (scanned) o el form está corrupto, retorna `source: 'failed'` y el
 * caller decide caer a OCR.
 */
export async function detectAcroFormFields(pdfUrl: string): Promise<DetectResult> {
  try {
    const buffer = await fetchPdfBuffer(pdfUrl)
    const doc = await PDFDocument.load(buffer, { ignoreEncryption: true })
    let form: PDFForm
    try {
      form = doc.getForm()
    } catch (err) {
      log.info('PDF sin form AcroForm nativo', { url: pdfUrl })
      return { source: 'failed', fields: [], error: 'no_acroform' }
    }

    const pdfFields = form.getFields()
    if (pdfFields.length === 0) {
      return { source: 'failed', fields: [], error: 'no_fields' }
    }

    const fields: DetectedField[] = pdfFields.map((field) => {
      const name = field.getName()
      const type = mapFieldType(field)
      let options: string[] | undefined
      let defaultValue: string | undefined

      try {
        if (field instanceof PDFDropdown) options = field.getOptions()
        if (field instanceof PDFRadioGroup) options = field.getOptions()
        if (field instanceof PDFTextField) defaultValue = field.getText() ?? undefined
      } catch {
        // swallow — algunos PDFs tienen campos malformados
      }

      return {
        name,
        type,
        label: humanizeFieldName(name),
        required: false, // pdf-lib no expone required natively; lo deriva la IA
        options,
        default_value: defaultValue,
      }
    })

    log.info('AcroForm detectado', { url: pdfUrl, fieldCount: fields.length })
    return { source: 'acroform', fields }
  } catch (err) {
    log.warn('detectAcroFormFields failed', { url: pdfUrl, err: err instanceof Error ? err.message : err })
    return {
      source: 'failed',
      fields: [],
      error: err instanceof Error ? err.message : 'detect_failed',
    }
  }
}

/**
 * Rellena un PDF AcroForm con los valores provistos. Campos desconocidos o
 * con valor null/undefined se omiten sin fallar. Retorna el buffer del PDF
 * resultante listo para streaming al cliente o storage.
 */
export async function fillAcroForm(
  pdfUrl: string,
  values: Record<string, string | boolean | number | null | undefined>,
): Promise<Uint8Array> {
  const buffer = await fetchPdfBuffer(pdfUrl)
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true })
  const form = doc.getForm()

  for (const [name, rawValue] of Object.entries(values)) {
    if (rawValue === null || rawValue === undefined || rawValue === '') continue

    try {
      const field = form.getField(name)

      if (field instanceof PDFTextField) {
        field.setText(String(rawValue))
      } else if (field instanceof PDFCheckBox) {
        if (rawValue === true || rawValue === 'true' || rawValue === 'on' || rawValue === 'yes') {
          field.check()
        } else {
          field.uncheck()
        }
      } else if (field instanceof PDFRadioGroup) {
        field.select(String(rawValue))
      } else if (field instanceof PDFDropdown) {
        field.select(String(rawValue))
      }
      // Campos desconocidos se ignoran
    } catch (err) {
      log.warn('no se pudo llenar campo', { name, err: err instanceof Error ? err.message : err })
    }
  }

  // Flatten: convierte los campos en texto fijo para que el PDF sea
  // inmutable (el user descargó su copia, no debería poder editarla).
  // Configurable: si Henry quiere PDFs editables post-descarga, removemos
  // el flatten. Por ahora lo dejamos fijo.
  try {
    form.flatten()
  } catch (err) {
    log.warn('flatten falló, devolvemos PDF con campos editables', { err })
  }

  const out = await doc.save()
  return out
}

/**
 * Cuando un PDF oficial no tiene AcroForm (es scanned), generamos un PDF
 * NUEVO con la información del usuario. Es un PDF que NO se parece al
 * oficial pero contiene la info estructurada — acompaña al original como
 * complemento.
 *
 * Llama este fallback cuando detectAcroFormFields retornó source=failed
 * y ya corrimos OCR para obtener el schema.
 */
export async function generateSupplementPdf(params: {
  formName: string
  officialUrl: string
  schema: DetectedField[]
  values: Record<string, string | boolean | number | null | undefined>
  caseNumber?: string | null
  clientName?: string | null
}): Promise<Uint8Array> {
  const { PDFDocument: Doc, StandardFonts, rgb } = await import('pdf-lib')
  const doc = await Doc.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  let page = doc.addPage([612, 792]) // US Letter

  const margin = 50
  let y = 742

  const writeLine = (text: string, opts: { size?: number; bold?: boolean } = {}) => {
    const size = opts.size ?? 10
    const f = opts.bold ? fontBold : font
    if (y < 60) {
      page = doc.addPage([612, 792])
      y = 742
    }
    page.drawText(text, { x: margin, y, size, font: f, color: rgb(0, 0, 0) })
    y -= size + 6
  }

  writeLine('UsaLatino Prime · Documento complementario', { size: 9, bold: true })
  writeLine(`Formulario: ${params.formName}`, { size: 14, bold: true })
  if (params.caseNumber) writeLine(`Caso: ${params.caseNumber}`, { size: 10 })
  if (params.clientName) writeLine(`Cliente: ${params.clientName}`, { size: 10 })
  writeLine(`Formulario oficial: ${params.officialUrl}`, { size: 8 })
  writeLine('', { size: 4 })
  writeLine('─────────────────────────────────────────────────────────────', { size: 8 })
  writeLine('', { size: 4 })

  for (const field of params.schema) {
    const raw = params.values[field.name]
    if (raw === null || raw === undefined || raw === '') continue

    writeLine(field.label, { size: 10, bold: true })
    const valueStr = typeof raw === 'boolean' ? (raw ? 'Sí' : 'No') : String(raw)
    // Wrap manual para textos largos
    const words = valueStr.split(' ')
    const maxWidth = 500
    let line = ''
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(test, 10) > maxWidth) {
        writeLine(line, { size: 10 })
        line = word
      } else {
        line = test
      }
    }
    if (line) writeLine(line, { size: 10 })
    writeLine('', { size: 3 })
  }

  // Footer de auditabilidad
  y = 40
  page.drawText(
    `Generado por UsaLatino Prime · ${new Date().toISOString().slice(0, 10)} · Adjunto al formulario oficial.`,
    { x: margin, y, size: 7, font, color: rgb(0.4, 0.4, 0.4) },
  )

  return await doc.save()
}
