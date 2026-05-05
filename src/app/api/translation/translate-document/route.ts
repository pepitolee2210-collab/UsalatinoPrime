import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import { createClient } from '@/lib/supabase/server'
import { translateWithGemini, type GeminiInputPart } from '@/lib/translation/gemini-translate'

export const dynamic = 'force-dynamic'
export const maxDuration = 90

const ACCEPTED_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]

const MAX_BYTES = 8 * 1024 * 1024 // por archivo
const MAX_PDF_PAGES = 2 // Henry: hasta 2 páginas
const MAX_FILES = 2     // Henry: hasta 2 archivos (imágenes) o 1 PDF de 2 páginas

/**
 * POST /api/translation/translate-document
 *
 * Diana / Henry suben hasta 2 imágenes (frente/reverso, o 2 hojas) o
 * un PDF de hasta 2 páginas del documento original. Gemini 3.1 Pro
 * procesa todo en una sola llamada y devuelve un JSON `TranslatedDoc`
 * consolidado que el cliente renderiza a PDF con jsPDF.
 *
 * Body: FormData. Acepta tanto el campo `file` (legacy, 1 archivo) como
 * `files` repetido (1-2 archivos). Para PDF solo se permite 1 archivo
 * pero puede tener hasta 2 páginas.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.role !== 'employee') {
    return NextResponse.json({ error: 'Solo admin o employee' }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'FormData inválido' }, { status: 400 })
  }

  // Aceptar campo `files` (múltiple) o `file` (legacy)
  const filesMulti = formData.getAll('files').filter((v): v is File => v instanceof File)
  const fileSingle = formData.get('file')
  const files: File[] = filesMulti.length > 0
    ? filesMulti
    : (fileSingle instanceof File ? [fileSingle] : [])

  if (files.length === 0) {
    return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })
  }

  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Máximo ${MAX_FILES} archivos por traducción.` }, { status: 400 })
  }

  // Si hay un PDF, debe ser el único archivo (no se mezclan PDF + imágenes)
  const hasPdf = files.some(f => (f.type || '') === 'application/pdf')
  const hasImage = files.some(f => (f.type || '').startsWith('image/'))
  if (hasPdf && files.length > 1) {
    return NextResponse.json({
      error: 'Si subes un PDF debe ser el único archivo. Para varias páginas, súbelas dentro del mismo PDF (máx. 2 páginas).',
    }, { status: 400 })
  }
  if (hasPdf && hasImage) {
    return NextResponse.json({
      error: 'No se permite mezclar PDF con imágenes. Sube todo como PDF o todo como imagen.',
    }, { status: 400 })
  }

  // Validaciones por archivo
  const parts: GeminiInputPart[] = []
  for (const file of files) {
    if (file.size > MAX_BYTES) {
      return NextResponse.json({
        error: `Cada archivo debe pesar menos de ${MAX_BYTES / 1024 / 1024} MB. "${file.name}" pesa ${(file.size / 1024 / 1024).toFixed(1)} MB.`,
      }, { status: 413 })
    }
    const mime = file.type || 'application/octet-stream'
    if (!ACCEPTED_MIMES.includes(mime)) {
      return NextResponse.json({ error: `Tipo de archivo no soportado: ${mime}` }, { status: 415 })
    }

    const arrayBuffer = await file.arrayBuffer()

    if (mime === 'application/pdf') {
      try {
        const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
        const pages = pdf.getPageCount()
        if (pages > MAX_PDF_PAGES) {
          return NextResponse.json({
            error: `El PDF tiene ${pages} páginas. Solo se permite traducir PDFs de hasta ${MAX_PDF_PAGES} páginas. Recorta el documento o sube solo las páginas que quieres traducir.`,
          }, { status: 422 })
        }
      } catch (err) {
        return NextResponse.json({
          error: 'No se pudo leer el PDF. Asegúrate de que el archivo no esté dañado o protegido con contraseña.',
          detail: err instanceof Error ? err.message : 'unknown',
        }, { status: 400 })
      }
    }

    parts.push({
      base64: Buffer.from(arrayBuffer).toString('base64'),
      mimeType: mime,
    })
  }

  const { doc, error, raw } = await translateWithGemini(parts)

  if (!doc) {
    return NextResponse.json({
      error: error || 'No se pudo traducir el documento',
      raw: raw?.slice(0, 2000),
    }, { status: 502 })
  }

  return NextResponse.json({ doc })
}
