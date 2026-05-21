import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { PDFDocument } from 'pdf-lib'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createLogger } from '@/lib/logger'
import { isAsylumService } from '@/lib/services/asylum'

const log = createLogger('asilo-expediente')

/**
 * GET /api/admin/cases/[id]/asilo-politico/expediente?format=zip|pdf|i589
 *
 * Tres formatos:
 *   - `zip` (default): expediente completo en ZIP — I-589 + Miedo Creíble +
 *     documentos del cliente aprobados + evidencias.md con las URLs.
 *   - `pdf`: PDF unificado — concatena (I-589 si existe) + Miedo Creíble como
 *     PDF generado del markdown + cada documento PDF del cliente.
 *   - `i589`: solo el PDF del I-589 (las 14 páginas si están disponibles).
 *
 * Autorización: admin o paralegal del repo.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const url = new URL(request.url)
  const format = (url.searchParams.get('format') ?? 'zip').toLowerCase()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role, employee_type')
    .eq('id', user.id)
    .single()
  const isAdmin = profile?.role === 'admin'
  const isParalegal = profile?.role === 'employee' && profile?.employee_type === 'paralegal'
  if (!isAdmin && !isParalegal) {
    return NextResponse.json({ error: 'Solo admin o paralegal' }, { status: 403 })
  }

  // Cargar caso + servicio
  const { data: caseRow } = await service
    .from('cases')
    .select('id, case_number, client_id, service:service_catalog(slug)')
    .eq('id', id)
    .single<{
      id: string
      case_number: string
      client_id: string
      service: { slug: string } | { slug: string }[] | null
    }>()
  if (!caseRow) {
    return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
  }
  const serviceSlug = Array.isArray(caseRow.service) ? caseRow.service[0]?.slug : caseRow.service?.slug
  if (!isAsylumService(serviceSlug)) {
    return NextResponse.json({ error: 'Solo aplica a servicios de Asilo Político (asilo-politico, reforzar-asilo)' }, { status: 400 })
  }

  // Cargar artefactos
  const [{ data: draft }, { data: docs }, { data: urls }] = await Promise.all([
    service
      .from('case_credible_fear_drafts')
      .select('version, body_md, sources, generated_at')
      .eq('case_id', id)
      .eq('is_current', true)
      .maybeSingle(),
    service
      .from('documents')
      .select('id, name, file_path, file_type, status, document_type:document_types(code, name_es)')
      .eq('case_id', id)
      .or('direction.eq.client_to_admin,direction.eq.admin_to_client')
      .order('created_at', { ascending: true }),
    service
      .from('case_evidence_urls')
      .select('url, title, description, source_domain')
      .eq('case_id', id)
      .order('added_at', { ascending: true }),
  ])

  // Helper para bajar binary de Storage
  async function downloadDoc(filePath: string): Promise<Uint8Array | null> {
    const { data, error } = await service.storage.from('case-documents').download(filePath)
    if (error || !data) {
      log.warn('download falló', { filePath, error })
      return null
    }
    const ab = await data.arrayBuffer()
    return new Uint8Array(ab)
  }

  function findDocByCode(code: string) {
    return (docs ?? []).find((d) => {
      const dt = Array.isArray(d.document_type) ? d.document_type[0] : d.document_type
      return dt?.code === code
    })
  }

  // ── Branch: i589 ────────────────────────────────────────────────────
  if (format === 'i589') {
    const i589Doc = findDocByCode('i589_filled_complete') ?? findDocByCode('i589_filled_partial')
    if (!i589Doc) {
      return NextResponse.json({ error: 'No hay I-589 aún cargado en el expediente' }, { status: 404 })
    }
    const bytes = await downloadDoc(i589Doc.file_path)
    if (!bytes) {
      return NextResponse.json({ error: 'No se pudo descargar el I-589' }, { status: 500 })
    }
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="I-589-${caseRow.case_number}.pdf"`,
      },
    })
  }

  // ── Branch: pdf unificado ───────────────────────────────────────────
  if (format === 'pdf') {
    const out = await PDFDocument.create()

    // 1. I-589 (si existe)
    const i589Doc = findDocByCode('i589_filled_complete') ?? findDocByCode('i589_filled_partial')
    if (i589Doc) {
      const bytes = await downloadDoc(i589Doc.file_path)
      if (bytes) {
        try {
          const src = await PDFDocument.load(bytes, { ignoreEncryption: true })
          const copied = await out.copyPages(src, src.getPageIndices())
          copied.forEach((p) => out.addPage(p))
        } catch (err) {
          log.warn('no se pudo mergear I-589', { err: String(err) })
        }
      }
    }

    // 2. Miedo Creíble — renderizado simple en una/varias páginas
    if (draft?.body_md) {
      const page = out.addPage([612, 792])
      const { width, height } = page.getSize()
      const margin = 50
      const lines = draft.body_md.split('\n')
      let y = height - margin
      const lineHeight = 12
      const fontSize = 9
      const helv = await out.embedFont('Helvetica')
      for (const ln of lines) {
        // Wrap simple por ~85 chars
        const chunks: string[] = []
        let cursor = 0
        while (cursor < ln.length) {
          chunks.push(ln.slice(cursor, cursor + 85))
          cursor += 85
        }
        if (chunks.length === 0) chunks.push('')
        for (const c of chunks) {
          if (y < margin) {
            // nueva página
            const np = out.addPage([612, 792])
            y = np.getSize().height - margin
            np.drawText(c, { x: margin, y, size: fontSize, font: helv })
            y -= lineHeight
          } else {
            page.drawText(c, { x: margin, y, size: fontSize, font: helv })
            y -= lineHeight
          }
        }
      }
      void width
    }

    // 3. Otros PDFs del cliente
    for (const d of docs ?? []) {
      if (d.file_type !== 'application/pdf') continue
      const dt = Array.isArray(d.document_type) ? d.document_type[0] : d.document_type
      if (dt?.code === 'i589_filled_complete' || dt?.code === 'i589_filled_partial') continue
      const bytes = await downloadDoc(d.file_path)
      if (!bytes) continue
      try {
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true })
        const copied = await out.copyPages(src, src.getPageIndices())
        copied.forEach((p) => out.addPage(p))
      } catch (err) {
        log.warn('no se pudo mergear doc', { id: d.id, err: String(err) })
      }
    }

    const finalBytes = await out.save()
    return new NextResponse(new Uint8Array(finalBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="expediente-asilo-${caseRow.case_number}.pdf"`,
      },
    })
  }

  // ── Branch: zip (default) ───────────────────────────────────────────
  const zip = new JSZip()

  // Miedo Creíble como markdown
  if (draft?.body_md) {
    zip.file('miedo-creible.md', draft.body_md)
    if (draft.sources && Array.isArray(draft.sources)) {
      const sourcesMd = [
        '# Fuentes citadas en el Miedo Creíble',
        '',
        ...(draft.sources as Array<{ url: string; title?: string; snippet?: string }>).map(
          (s, i) => `[${i + 1}] ${s.title ?? s.url}\n- URL: ${s.url}${s.snippet ? `\n- Snippet: ${s.snippet}` : ''}`,
        ),
      ].join('\n\n')
      zip.file('miedo-creible-fuentes.md', sourcesMd)
    }
  }

  // URLs de evidencia
  if (urls && urls.length > 0) {
    const evidenciasMd = [
      '# URLs de evidencia agregadas por el cliente',
      '',
      ...urls.map(
        (u, i) =>
          `${i + 1}. **${u.title ?? u.source_domain ?? u.url}**\n   - URL: ${u.url}${u.description ? `\n   - Descripción: ${u.description}` : ''}`,
      ),
    ].join('\n\n')
    zip.file('evidencias.md', evidenciasMd)
  }

  // Docs del cliente
  const docsFolder = zip.folder('documentos')
  for (const d of docs ?? []) {
    const bytes = await downloadDoc(d.file_path)
    if (!bytes) continue
    const dt = Array.isArray(d.document_type) ? d.document_type[0] : d.document_type
    const subfolder = dt?.code === 'i589_filled_complete' || dt?.code === 'i589_filled_partial' ? 'i589' : 'cliente'
    docsFolder?.folder(subfolder)?.file(d.name, bytes)
  }

  const zipBytes = await zip.generateAsync({ type: 'uint8array' })
  return new NextResponse(new Uint8Array(zipBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="expediente-asilo-${caseRow.case_number}.zip"`,
    },
  })
}
