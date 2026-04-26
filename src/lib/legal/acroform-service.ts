// Servicio mínimo para inspeccionar y rellenar AcroForms PDF con pdf-lib.
//
// Diseño deliberado:
// - SIN fetch remoto (los PDFs viven en repo/public/forms/, leídos via fs).
// - SIN AI / OCR / Gemini. El schema de campos es curado a mano.
// - SIN dependencia de tabla de schemas en BD. La fuente de verdad es el
//   sapcr100-form-schema.ts (o equivalente por form en el futuro).
//
// Reemplaza el src/lib/legal/acroform-service.ts retirado en commit 9ba46a1
// con una versión mucho más acotada.

import { PDFDocument, PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown, PDFName } from 'pdf-lib'
import { createLogger } from '@/lib/logger'

const log = createLogger('acroform-service')

export type AcroFieldType = 'text' | 'textarea' | 'checkbox' | 'radio' | 'dropdown' | 'unknown'

export interface InspectedField {
  name: string
  type: AcroFieldType
  options?: string[]
  isReadOnly: boolean
  defaultValue?: string
  checkboxOnValue?: string
}

/** Inspeccionar AcroForm — útil para scripts dev y para validar al runtime que los nombres no cambiaron. */
export async function inspectAcroForm(pdfBytes: Uint8Array): Promise<InspectedField[]> {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
  const form = doc.getForm()
  return form.getFields().map((f) => {
    const name = f.getName()
    let type: AcroFieldType = 'unknown'
    let defaultValue: string | undefined
    let options: string[] | undefined
    let checkboxOnValue: string | undefined

    if (f instanceof PDFTextField) {
      type = f.isMultiline() ? 'textarea' : 'text'
      try { defaultValue = f.getText() ?? '' } catch { /* ignore */ }
    } else if (f instanceof PDFCheckBox) {
      type = 'checkbox'
      checkboxOnValue = readCheckboxOnValue(f)
    } else if (f instanceof PDFRadioGroup) {
      type = 'radio'
      try { options = f.getOptions() } catch { /* ignore */ }
    } else if (f instanceof PDFDropdown) {
      type = 'dropdown'
      try { options = f.getOptions() } catch { /* ignore */ }
    }

    return {
      name,
      type,
      options,
      isReadOnly: f.isReadOnly(),
      defaultValue,
      checkboxOnValue,
    }
  })
}

function readCheckboxOnValue(field: PDFCheckBox): string | undefined {
  try {
    const widgets = field.acroField.getWidgets()
    if (widgets.length === 0) return undefined
    const ap = widgets[0].dict.lookup(PDFName.of('AP'))
    if (!ap) return undefined
    // @ts-expect-error pdf-lib types are loose
    const normalAp = ap.lookup(PDFName.of('N'))
    if (!normalAp || !normalAp.entries) return undefined
    for (const [key] of normalAp.entries()) {
      const k = (key as { toString(): string }).toString()
      if (k !== '/Off') return k.replace('/', '')
    }
  } catch {
    // ignore
  }
  return undefined
}

function isTruthyValue(v: string | boolean | null | undefined): boolean {
  if (v === true) return true
  if (v === false || v === null || v === undefined) return false
  const s = String(v).trim().toLowerCase()
  return s === 'yes' || s === 'true' || s === '1' || s === 'on' || s === 'sí' || s === 'si'
}

/**
 * Rellena un AcroForm PDF con `values` (mapeado por nombre real de field).
 * Devuelve el PDF resultante. Si `flatten` es true (default), flattens los
 * campos a contenido fijo (no editable post-descarga) — comportamiento esperado
 * para una petición legal lista para imprimir.
 *
 * Campos desconocidos se ignoran con warning. Errores por campo se loguean
 * pero no abortan el llenado del resto.
 */
export async function fillAcroForm(
  pdfBytes: Uint8Array,
  values: Record<string, string | boolean | null | undefined>,
  opts: { flatten?: boolean } = {}
): Promise<Uint8Array> {
  const flatten = opts.flatten !== false
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
  const form = doc.getForm()

  let filledCount = 0
  let skippedCount = 0
  const warnings: string[] = []

  for (const [name, rawValue] of Object.entries(values)) {
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      skippedCount++
      continue
    }
    try {
      const field = form.getField(name)

      if (field instanceof PDFTextField) {
        field.setText(String(rawValue))
        filledCount++
      } else if (field instanceof PDFCheckBox) {
        if (isTruthyValue(rawValue)) {
          // Algunas checkboxes tienen on-values distintos a "Yes" — usar API que
          // respeta el AP entry ya configurado en el widget.
          const onValue = readCheckboxOnValue(field)
          if (onValue) {
            field.acroField.dict.set(PDFName.of('V'), PDFName.of(onValue))
            const widgets = field.acroField.getWidgets()
            for (const w of widgets) {
              w.dict.set(PDFName.of('AS'), PDFName.of(onValue))
            }
          } else {
            field.check()
          }
          filledCount++
        } else {
          field.uncheck()
          filledCount++
        }
      } else if (field instanceof PDFRadioGroup) {
        field.select(String(rawValue))
        filledCount++
      } else if (field instanceof PDFDropdown) {
        field.select(String(rawValue))
        filledCount++
      } else {
        skippedCount++
        warnings.push(`tipo desconocido: ${name}`)
      }
    } catch (err) {
      skippedCount++
      const msg = err instanceof Error ? err.message : String(err)
      warnings.push(`${name}: ${msg}`)
    }
  }

  log.info('fillAcroForm', { filledCount, skippedCount, warningCount: warnings.length })
  if (warnings.length > 0 && warnings.length <= 10) {
    log.warn('fillAcroForm warnings', { warnings })
  }

  if (flatten) {
    try {
      form.flatten()
    } catch (err) {
      log.warn('flatten falló — devolvemos PDF con campos editables', { err: err instanceof Error ? err.message : err })
    }
  }

  return await doc.save()
}
