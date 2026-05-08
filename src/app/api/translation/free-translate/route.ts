import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import { createClient } from '@/lib/supabase/server'
import {
  freeTranslate,
  type FreeTranslationPart,
  type TranslationDirection,
} from '@/lib/translation/free-translate'

export const dynamic = 'force-dynamic'
export const maxDuration = 180

const ACCEPTED_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]

const MAX_BYTES = 16 * 1024 * 1024 // 16MB por archivo (PDFs largos)
const MAX_PDF_PAGES = 10
const MAX_FILES = 1

/**
 * POST /api/translation/free-translate
 *
 * Endpoint independiente del de actas civiles. Diana sube cualquier
 * PDF (1-10 páginas) y selecciona dirección de traducción (es-to-en
 * o en-to-es). Gemini procesa todas las páginas en una sola llamada
 * y devuelve un array de pares { original, translated } por página.
 *
 * El cliente arma el PDF de 2 columnas (original | traducción) con
 * jsPDF para que Diana lo descargue.
 *
 * Body: FormData con `file` (1 archivo) + `direction` (es-to-en | en-to-es).
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

  const directionRaw = String(formData.get('direction') || '')
  const direction: TranslationDirection | null =
    directionRaw === 'es-to-en' || directionRaw === 'en-to-es' ? directionRaw : null
  if (!direction) {
    return NextResponse.json(
      { error: 'direction debe ser "es-to-en" o "en-to-es"' },
      { status: 400 },
    )
  }

  const fileSingle = formData.get('file')
  const files: File[] = fileSingle instanceof File ? [fileSingle] : []
  if (files.length === 0) {
    return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Máximo ${MAX_FILES} archivo` }, { status: 400 })
  }

  const parts: FreeTranslationPart[] = []
  for (const file of files) {
    if (file.size > MAX_BYTES) {
      return NextResponse.json({
        error: `El archivo "${file.name}" pesa ${(file.size / 1024 / 1024).toFixed(1)} MB. Máximo permitido: ${MAX_BYTES / 1024 / 1024} MB.`,
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
            error: `El PDF tiene ${pages} páginas. Máximo permitido: ${MAX_PDF_PAGES}. Recorta el documento o súbelo en partes.`,
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

  const { result, error, raw } = await freeTranslate(parts, direction)

  if (!result) {
    return NextResponse.json({
      error: error || 'No se pudo traducir el documento',
      raw: raw?.slice(0, 2000),
    }, { status: 502 })
  }

  return NextResponse.json({ result })
}
