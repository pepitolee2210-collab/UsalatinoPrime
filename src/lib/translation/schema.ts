/**
 * Estructura JSON que Gemini devuelve. Replica el formato del template de
 * Henry: header oficial, certificación, datos de la persona, padres,
 * registro, validación + códigos, firma textual, fechas. SIN QR, sellos
 * ni barcodes visuales — solo el texto del documento.
 */

export interface TranslatedDoc {
  /** Líneas del header oficial centradas (ej. "REPUBLIC OF PANAMA", "ELECTORAL TRIBUNAL"). */
  jurisdiction_header: string[]
  /** Tipo de documento — palabra única en mayúsculas (ej. "CERTIFICATE", "BIRTH RECORD CERTIFICATION"). */
  document_type: string
  /** Número de registro principal del documento (ej. "8-1120-1165"). Vacío si no aparece. */
  registration_number: string
  /** Institución que certifica (ej. "The National Directorate of the Civil Registry"). */
  issuing_authority: string
  /** Verbo de certificación, normalmente "CERTIFIES" en mayúsculas. */
  certification_verb: string
  /** Párrafo intro que dice "That in Volume X, Entry Y of the Birth Records...". */
  certification_paragraph: string
  /** Nombre completo de la persona registrada — destacado. */
  registered_person_name: string
  /** Datos primarios de la persona (sex, date of birth, place of birth, etc.). */
  primary_fields: Array<{ label: string; value: string }>
  /** Padres / madres con datos (cédula, nacionalidad). Cada string es la línea completa. */
  parents: Array<{ label: string; line: string }>
  /** Datos de registro (place / date of registration, etc.). */
  registration_fields: Array<{ label: string; value: string }>
  /** Párrafo legal sobre validación / verificación. Vacío si no aparece. */
  validation_paragraph: string
  /** Códigos / referencias técnicas (Validation Code, Barcode Number, QR code value, etc. — como TEXTO, no como imagen). */
  reference_codes: Array<{ label: string; value: string }>
  /** Bloque de firma textual: nombre del firmante + cargo. */
  signatory_name: string
  signatory_title: string
  /** Fechas finales y nota de validez. */
  closing_fields: Array<{ label: string; value: string }>
  closing_note: string
  /** Título original del documento en español (ej. "Certificado de Nacimiento") — para citarlo en la cert. de exactitud. */
  original_document_title: string
}
