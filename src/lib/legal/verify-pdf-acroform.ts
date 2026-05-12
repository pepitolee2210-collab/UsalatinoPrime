/**
 * Verificación REAL de si un PDF es AcroForm rellenable.
 *
 * La IA marca `pdf_format: 'acroform'` y `is_fillable: true` basándose en su
 * conocimiento previo (ej. "GF-17 suele ser AcroForm en NY"), pero a veces se
 * equivoca — el PDF puede ser una versión static escaneada o tener AcroForm
 * vacío. Para evitar mostrar el badge "Rellenable" erróneamente, descargamos
 * el PDF y lo inspeccionamos con pdf-lib en server-side.
 *
 * Heurística:
 * - URL no termina en .pdf (es .docx, .doc, .html) → respetar lo que dijo la IA.
 * - URL termina en .pdf y se puede descargar → inspeccionar fields.
 *   - >= 3 campos editables → 'acroform' + is_fillable=true.
 *   - 0 fields o todos read-only → 'static' + is_fillable=false.
 * - Descarga falla (403/404/timeout) → 'unknown' + is_fillable=false.
 *
 * Cacheamos en memoria por URL durante la vida del proceso para no descargar
 * 2× el mismo PDF cuando aparece en intake y merits (caso típico de NY GF-17).
 */

import { inspectAcroForm } from './acroform-service'
import { createLogger } from '@/lib/logger'
import type { PdfFormat, RequiredForm } from './research-jurisdiction'

const log = createLogger('verify-pdf-acroform')

const DOWNLOAD_TIMEOUT_MS = 10_000
/** Umbral mínimo de campos editables para considerar el PDF AcroForm.
 * Bajo a propósito (1): si pdf-lib detecta AUNQUE SEA UN campo no-readonly
 * (incluso de tipo `unknown` por parseo parcial), es un AcroForm real. Si el
 * PDF es 100% scan/image, pdf-lib devuelve 0 fields. */
const MIN_FILLABLE_FIELDS = 1
/** Si el PDF excede esto no lo descargamos (overhead no vale la pena). */
const MAX_PDF_BYTES = 20 * 1024 * 1024

/** Cache en memoria por URL. Vive lo que vive el isolate. */
const memCache = new Map<string, { pdf_format: PdfFormat; is_fillable: boolean }>()

export interface VerificationResult {
  pdf_format: PdfFormat
  is_fillable: boolean
  /** Razón humana para audit log. */
  reason: string
}

/**
 * Descarga un PDF y verifica si tiene campos AcroForm editables. Devuelve la
 * combinación pdf_format/is_fillable acorde a la inspección real.
 *
 * Para URLs que no son .pdf (ej. .docx) o cuando la IA marcó algo distinto a
 * 'acroform', confiamos en la IA — no descargamos.
 */
export async function verifyPdfAcroForm(
  url: string,
  iaSaysFormat: PdfFormat | undefined,
): Promise<VerificationResult> {
  // Solo verificamos lo que la IA marcó como acroform. Si dijo 'docx'/'doc'/
  // 'static'/'unknown', respetamos — no perdamos tiempo descargando.
  if (iaSaysFormat !== 'acroform') {
    return {
      pdf_format: iaSaysFormat ?? 'unknown',
      is_fillable: false,
      reason: `IA marcó pdf_format=${iaSaysFormat ?? 'unknown'} — sin verificación`,
    }
  }

  // Solo .pdf vale verificar. Si la URL es .docx/.doc/.html, no es AcroForm.
  const isPdfUrl = /\.pdf(\?|#|$)/i.test(url)
  if (!isPdfUrl) {
    return {
      pdf_format: 'unknown',
      is_fillable: false,
      reason: `URL no termina en .pdf — la IA se equivocó al marcar acroform`,
    }
  }

  if (memCache.has(url)) {
    const cached = memCache.get(url)!
    return { ...cached, reason: 'desde cache de memoria' }
  }

  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), DOWNLOAD_TIMEOUT_MS)
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        // Algunos servidores .gov bloquean fetch sin UA tipo browser.
        'User-Agent': 'Mozilla/5.0 (compatible; UsaLatinoPrime/1.0; +https://usalatinoprime.com)',
        'Accept': 'application/pdf,*/*;q=0.8',
      },
    })
    clearTimeout(timer)

    if (!res.ok) {
      log.warn('PDF download failed — keeping IA assumption with is_fillable=false', { url, status: res.status })
      const result = {
        pdf_format: 'unknown' as PdfFormat,
        is_fillable: false,
      }
      memCache.set(url, result)
      return { ...result, reason: `HTTP ${res.status} al descargar — no se pudo verificar` }
    }

    // Defensa: si el server miente sobre content-length, igual interrumpimos
    // por timeout o por buffer máximo más abajo.
    const contentLength = Number(res.headers.get('content-length') ?? '0')
    if (contentLength > MAX_PDF_BYTES) {
      const result = {
        pdf_format: 'unknown' as PdfFormat,
        is_fillable: false,
      }
      memCache.set(url, result)
      return { ...result, reason: `PDF demasiado grande (${contentLength} bytes) — skipped` }
    }

    const buf = await res.arrayBuffer()
    if (buf.byteLength > MAX_PDF_BYTES) {
      const result = {
        pdf_format: 'unknown' as PdfFormat,
        is_fillable: false,
      }
      memCache.set(url, result)
      return { ...result, reason: `PDF demasiado grande tras descarga — skipped` }
    }

    const bytes = new Uint8Array(buf)
    // Header check rápido — algunos endpoints devuelven HTML de error con
    // status 200 (caso típico de Cloudflare). Si los primeros 4 bytes no son
    // %PDF, no intentes parsear.
    const head = String.fromCharCode(...bytes.slice(0, 4))
    if (head !== '%PDF') {
      log.warn('response is not a PDF (header mismatch)', { url, head })
      const result = {
        pdf_format: 'unknown' as PdfFormat,
        is_fillable: false,
      }
      memCache.set(url, result)
      return { ...result, reason: `Respuesta no es PDF (header=${head})` }
    }

    const fields = await inspectAcroForm(bytes)
    // Aceptar también fields de tipo unknown si NO son read-only — pdf-lib a
    // veces falla a clasificar widgets exóticos pero la presencia del field
    // ya indica AcroForm.
    const editable = fields.filter(f => !f.isReadOnly)
    const totalFields = fields.length

    if (editable.length >= MIN_FILLABLE_FIELDS) {
      const result = { pdf_format: 'acroform' as PdfFormat, is_fillable: true }
      memCache.set(url, result)
      return {
        ...result,
        reason: `Inspección real: ${editable.length}/${totalFields} campos editables AcroForm`,
      }
    } else {
      const result = { pdf_format: 'static' as PdfFormat, is_fillable: false }
      memCache.set(url, result)
      return {
        ...result,
        reason: `Inspección real: ${totalFields} campos total, ${editable.length} editables — clasificado como static`,
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn('verifyPdfAcroForm failed — keeping is_fillable=false', { url, err: msg })
    const result = { pdf_format: 'unknown' as PdfFormat, is_fillable: false }
    memCache.set(url, result)
    return { ...result, reason: `Error al verificar: ${msg.slice(0, 100)}` }
  }
}

/**
 * Aplica `verifyPdfAcroForm` a TODOS los formularios en paralelo y devuelve
 * la lista actualizada con `pdf_format` e `is_fillable` corregidos según la
 * inspección real. Errores individuales no abortan el conjunto.
 */
export async function verifyFormsBatch(forms: RequiredForm[]): Promise<RequiredForm[]> {
  if (!forms || forms.length === 0) return forms

  const results = await Promise.allSettled(
    forms.map(f => verifyPdfAcroForm(f.url_official, f.pdf_format))
  )

  return forms.map((f, i) => {
    const r = results[i]
    if (r.status === 'fulfilled') {
      // Solo override is_fillable y pdf_format — el resto del form queda intacto.
      // Si la IA dijo acroform y la verificación lo confirmó, queda acroform.
      // Si la IA dijo acroform y la verificación dice static, gana la verificación.
      return {
        ...f,
        pdf_format: r.value.pdf_format,
        is_fillable: r.value.is_fillable,
      }
    }
    // Promise rejected (raro porque verifyPdfAcroForm captura todo) — conservar IA.
    log.warn('verification promise rejected — keeping IA value', { url: f.url_official })
    return f
  })
}
