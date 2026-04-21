import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * GET /api/client/preview-doc?token=...&id=...[&raw=1]
 *
 * Sirve un documento del cliente para previsualización dentro del
 * portal (/cita/[token]).
 *
 * - Sin `raw`: devuelve { url } con signed URL de Supabase Storage.
 *   Se mantiene para compatibilidad, pero el embed en iframe falla
 *   porque el CDN de Supabase responde con X-Frame-Options/CSP hostiles.
 *
 * - Con `raw=1`: proxyea el binario del archivo a través de este
 *   endpoint con headers que permiten embed same-origin. Es el modo
 *   que usa el iframe del modal de preview.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const docId = request.nextUrl.searchParams.get('id')
  const raw = request.nextUrl.searchParams.get('raw') === '1'

  if (!token || !docId) {
    return NextResponse.json({ error: 'token y id requeridos' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: tokenData } = await supabase
    .from('appointment_tokens')
    .select('client_id, is_active')
    .eq('token', token)
    .single()

  if (!tokenData?.is_active) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 403 })
  }

  const { data: doc } = await supabase
    .from('documents')
    .select('file_path, name, file_type, client_id')
    .eq('id', docId)
    .single()

  if (!doc?.file_path || doc.client_id !== tokenData.client_id) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
  }

  if (raw) {
    // Descargar el archivo del bucket y servirlo como stream binario
    // con Content-Disposition inline — el browser lo renderiza en el
    // iframe sin problemas de CORS/CSP ya que la respuesta viene de
    // nuestro mismo origen.
    const { data: fileData, error: dlErr } = await supabase.storage
      .from('case-documents')
      .download(doc.file_path)

    if (dlErr || !fileData) {
      return NextResponse.json({ error: 'Archivo no accesible' }, { status: 500 })
    }

    const arrayBuffer = await fileData.arrayBuffer()
    const contentType = doc.file_type || 'application/pdf'
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

  const { data: signedData } = await supabase.storage
    .from('case-documents')
    .createSignedUrl(doc.file_path, 300)

  if (signedData?.signedUrl) {
    return NextResponse.json({ url: signedData.signedUrl })
  }

  return NextResponse.json({ error: 'Error al generar preview' }, { status: 500 })
}
