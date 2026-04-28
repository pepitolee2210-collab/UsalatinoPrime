// Servicio para rellenar templates DOCX (Microsoft Word 2007+) reemplazando
// tokens {{semanticKey}} por valores específicos del caso. Paralelo a
// acroform-service.ts pero para .docx en vez de PDF AcroForm.
//
// Diseño:
// - El template debe ser pre-tokenizado offline con un script tipo
//   `scripts/tokenize-<slug>.mjs` que reemplaza placeholders narrativos
//   ([NAME], [DATE], _____) por {{key}} dentro de un solo <w:t> node.
//   Eso simplifica el find-replace runtime a un puro string replace.
// - El runtime sólo abre el ZIP, busca/reemplaza en word/document.xml +
//   word/headers/footers (si los tokens viven ahí), y re-empaqueta.
// - Sin dependencia de docxtemplater (más liviano + sin riesgo de
//   conflictos con la UI). Sólo jszip.

import JSZip from 'jszip'
import { createLogger } from '@/lib/logger'

const log = createLogger('docx-template-service')

const TEMPLATE_PARTS = [
  'word/document.xml',
  'word/header1.xml',
  'word/header2.xml',
  'word/header3.xml',
  'word/footer1.xml',
  'word/footer2.xml',
  'word/footer3.xml',
] as const

/**
 * Escapa caracteres XML reservados en el valor antes de inyectarlo en el doc.
 * Sin esto, un valor como "A & B" rompería el XML.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Rellena un template DOCX con los `values` provistos (mapeados por semanticKey
 * que coincide con los tokens {{key}} en el template). Devuelve el .docx
 * resultante como Uint8Array listo para subir a Storage / descargar.
 *
 * Tokens no encontrados se loguean con warning pero no abortan. Tokens cuyo
 * valor sea null/undefined/'' se reemplazan por cadena vacía (deja el campo
 * "en blanco" en el documento final).
 */
export async function fillDocxTemplate(
  templateBytes: Uint8Array,
  values: Record<string, string | boolean | null | undefined>
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(templateBytes)

  let replacedCount = 0
  let totalTokensInTemplate = 0

  for (const partPath of TEMPLATE_PARTS) {
    const file = zip.file(partPath)
    if (!file) continue
    let xml = await file.async('string')
    const before = xml

    // Contar tokens que existen para reportar coverage.
    const tokensInPart = (xml.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) ?? [])
    totalTokensInTemplate += tokensInPart.length

    // Reemplazar todos los pares {{key}} con su valor.
    for (const [key, raw] of Object.entries(values)) {
      const token = `{{${key}}}`
      if (!xml.includes(token)) continue
      const stringValue =
        raw === null || raw === undefined ? '' :
        typeof raw === 'boolean' ? (raw ? 'X' : '') :
        String(raw)
      xml = xml.split(token).join(escapeXml(stringValue))
      replacedCount++
    }

    if (xml !== before) zip.file(partPath, xml)
  }

  // Reportar tokens que quedaron sin reemplazar (los pasamos a vacío para
  // no exponerlos al juez).
  let leftoverTokens: string[] = []
  for (const partPath of TEMPLATE_PARTS) {
    const file = zip.file(partPath)
    if (!file) continue
    let xml = await file.async('string')
    const remaining = xml.match(/\{\{([a-zA-Z0-9_]+)\}\}/g)
    if (remaining && remaining.length > 0) {
      leftoverTokens.push(...remaining)
      xml = xml.replace(/\{\{[a-zA-Z0-9_]+\}\}/g, '')
      zip.file(partPath, xml)
    }
  }

  if (leftoverTokens.length > 0) {
    log.warn('docx tokens sin valor (reemplazados por vacío)', {
      tokens: [...new Set(leftoverTokens)].slice(0, 20),
    })
  }

  log.info('fillDocxTemplate', {
    replaced: replacedCount,
    tokensInTemplate: totalTokensInTemplate,
    leftover: leftoverTokens.length,
  })

  const out = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  })
  return new Uint8Array(out)
}

export const DOCX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
