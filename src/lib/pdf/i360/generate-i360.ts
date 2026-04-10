import { PDFDocument } from 'pdf-lib'

/**
 * Mapeo: nombre del campo AcroForm en el PDF → clave en form_data (I360Data)
 *
 * A medida que se agreguen más campos fillable al PDF template,
 * solo hay que agregar la entrada correspondiente aquí.
 */
const FIELD_MAP: Record<string, string> = {
  'last_name': 'petitioner_last_name',
}

export async function generateI360PDF(
  formData: Record<string, any>,
): Promise<Uint8Array> {
  const response = await fetch('/forms/i-360.pdf')
  if (!response.ok) {
    throw new Error(`No se pudo cargar la plantilla I-360: ${response.statusText}`)
  }
  const templateBytes = await response.arrayBuffer()

  const pdfDoc = await PDFDocument.load(templateBytes)
  const form = pdfDoc.getForm()

  for (const [pdfFieldName, dataKey] of Object.entries(FIELD_MAP)) {
    const value = formData[dataKey]
    if (!value) continue

    try {
      const textField = form.getTextField(pdfFieldName)
      textField.setText(String(value))
    } catch {
      // Campo no encontrado en el PDF — ignorar silenciosamente
      console.warn(`Campo "${pdfFieldName}" no encontrado en el PDF template`)
    }
  }

  form.flatten()
  return pdfDoc.save()
}
