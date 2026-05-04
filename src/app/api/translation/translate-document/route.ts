import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import { createClient } from '@/lib/supabase/server'
import { translateWithGemini } from '@/lib/translation/gemini-translate'

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

const MAX_BYTES = 8 * 1024 * 1024 // 8MB — entra en el límite de Vercel y a Gemini le sobra
const MAX_PDF_PAGES = 1 // Henry pidió: PDFs de 1 sola página para ahorrar costos en Gemini

/**
 * POST /api/translation/translate-document
 *
 * Diana / Henry suben un PDF o imagen del documento original (acta de
 * nacimiento, cédula, etc.). Gemini 3.1 Pro hace OCR + traducción
 * estructurada y devolvemos un JSON `TranslatedDoc` que el cliente
 * renderiza a PDF con jsPDF (página 1 traducción + página 2 Translation
 * Certification).
 *
 * Body: FormData con `file`.
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

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `El archivo supera el límite de ${MAX_BYTES / 1024 / 1024}MB` }, { status: 413 })
  }

  const mime = file.type || 'application/octet-stream'
  if (!ACCEPTED_MIMES.includes(mime)) {
    return NextResponse.json({ error: `Tipo de archivo no soportado: ${mime}` }, { status: 415 })
  }

  const arrayBuffer = await file.arrayBuffer()

  // Si es PDF, validar que tenga 1 sola página antes de gastar tokens en Gemini
  if (mime === 'application/pdf') {
    try {
      const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
      const pages = pdf.getPageCount()
      if (pages > MAX_PDF_PAGES) {
        return NextResponse.json({
          error: `El PDF tiene ${pages} páginas. Solo se permite traducir PDFs de 1 página. Recorta el documento o sube solo la página que quieres traducir.`,
        }, { status: 422 })
      }
    } catch (err) {
      return NextResponse.json({
        error: 'No se pudo leer el PDF. Asegúrate de que el archivo no esté dañado o protegido con contraseña.',
        detail: err instanceof Error ? err.message : 'unknown',
      }, { status: 400 })
    }
  }

  const base64 = Buffer.from(arrayBuffer).toString('base64')

  const { doc, error, raw } = await translateWithGemini(base64, mime)

  if (!doc) {
    return NextResponse.json({
      error: error || 'No se pudo traducir el documento',
      raw: raw?.slice(0, 2000),
    }, { status: 502 })
  }

  return NextResponse.json({ doc })
}
