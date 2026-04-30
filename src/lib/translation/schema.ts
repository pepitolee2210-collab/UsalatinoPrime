/**
 * Estructura JSON que Gemini debe devolver al traducir un documento civil.
 * El frontend renderiza este shape como PDF de 2 páginas (traducción +
 * página de Translation Certification con firma del traductor).
 *
 * Mantengo el schema flexible — los actos civiles (nacimiento, matrimonio,
 * antecedentes, cédula) tienen estructuras parecidas pero no idénticas.
 */

export interface TranslatedDoc {
  /** Título superior (ej. "CERTIFICATION OF BIRTH RECORD"). En mayúsculas. */
  title: string
  /** Líneas de cabecera institucional (Republic of, registry, número). */
  header: string[]
  /** Bloques en orden de aparición. */
  blocks: TranslationBlock[]
  /** Párrafo final de emisión (ej. "Issued in Tela, ..."). Opcional. */
  footer_paragraph?: string
  /** Línea final tipo "Signature and seal of the Director". Opcional. */
  signature_label?: string
}

export type TranslationBlock =
  | { type: 'paragraph'; text: string; bold_terms?: string[] }
  | { type: 'fields'; items: Array<{ label: string; value: string }> }
  | {
      type: 'section'
      number?: number
      heading: string
      items?: Array<{ label: string; value: string }>
      paragraph?: string
    }
  | { type: 'note'; text: string }
