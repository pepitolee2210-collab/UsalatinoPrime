import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * GET /api/employee/download-case-doc?id=...[&raw=1]
 *
 * Sirve un documento del caso para staff (Henry, Diana, Vanessa, Andrium).
 *
 * - Sin `raw`: redirect a signed URL de Supabase Storage (300s). Útil para
 *   `target=_blank` y descargas directas — el navegador sigue el redirect
 *   y abre/descarga desde el CDN.
 * - Con `raw=1`: proxyea el binario con headers same-origin. Es el modo
 *   que usa el iframe/img del PreviewModal. Sin esto el browser bloquea
 *   el embed con "Content blocked" porque el CDN de Supabase responde con
 *   X-Frame-Options: DENY y nuestro CSP global tiene frame-ancestors 'none'.
 *   Mismo patrón que `/api/client/preview-doc?raw=1`.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const docId = request.nextUrl.searchParams.get('id')
  const raw = request.nextUrl.searchParams.get('raw') === '1'
  if (!docId) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const service = createServiceClient()

  const { data: doc } = await service
    .from('documents')
    .select('file_path, name, file_type, case_id')
    .eq('id', docId)
    .single()

  if (!doc?.file_path) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  if (raw) {
    // Descarga el archivo del bucket y lo sirve como stream binario con
    // Content-Disposition inline. El browser lo renderiza en el iframe/img
    // sin problemas de CORS/CSP porque la respuesta viene de nuestro mismo
    // origen (la entrada en next.config.ts headers() le aplica embedHeaders
    // permisivos en lugar del securityHeaders global con DENY).
    const { data: fileData, error: dlErr } = await service.storage
      .from('case-documents')
      .download(doc.file_path)

    if (dlErr || !fileData) {
      return NextResponse.json({ error: 'Archivo no accesible' }, { status: 500 })
    }

    const arrayBuffer = await fileData.arrayBuffer()
    const contentType = doc.file_type || inferContentType(doc.name || '')
    const safeName = String(doc.name || 'documento').replace(/[^a-zA-Z0-9._-]/g, '_')

    return new NextResponse(arrayBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${safeName}"`,
        'Cache-Control': 'private, max-age=60',
        'X-Frame-Options': 'SAMEORIGIN',
        'Content-Security-Policy': "frame-ancestors 'self'",
      },
    })
  }

  const { data: signedData } = await service.storage
    .from('case-documents')
    .createSignedUrl(doc.file_path, 300)

  if (signedData?.signedUrl) {
    return NextResponse.redirect(signedData.signedUrl)
  }

  return NextResponse.json({ error: 'Error al generar descarga' }, { status: 500 })
}

/**
 * Fallback cuando documents.file_type viene null (docs viejos pre-migración
 * que poblaba la columna). Cubre los formatos que Diana realmente sube.
 */
function inferContentType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop() || ''
  switch (ext) {
    case 'pdf': return 'application/pdf'
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    case 'png': return 'image/png'
    case 'gif': return 'image/gif'
    case 'webp': return 'image/webp'
    case 'doc': return 'application/msword'
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    case 'xls': return 'application/vnd.ms-excel'
    case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    case 'txt': return 'text/plain; charset=utf-8'
    default: return 'application/octet-stream'
  }
}
