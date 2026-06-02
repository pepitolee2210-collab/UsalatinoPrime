// POST /api/admin/cases/[id]/client-info-pdf
//
// Genera y descarga un PDF "Información del cliente" con TODOS los datos que
// el cliente ha llenado en el caso (todas las fases). NO es el formulario
// oficial — es un reporte interno ordenado para revisión legal offline.
//
// Decisiones:
//  - Método POST para evitar caching del service worker PWA en respuestas con
//    datos sensibles del cliente (mismo patrón que /api/contracts/export).
//  - Auth: admin OR employee. Paralegal tiene acceso global; otros employees
//    deben tener assignment al caso.
//  - "Mejor versión disponible": el loader prioriza submitted > draft. El PDF
//    indica el estado real por sección.
//  - Resiliencia: si un adapter falla, el PDF se entrega con banner de "datos
//    parciales" en vez de 500.

import { NextResponse, type NextRequest } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { buildClientInfoExport } from '@/lib/pdf/client-info-export'
import { logActivity } from '@/lib/activity/log-activity'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: caseId } = await ctx.params
  if (!caseId) {
    return NextResponse.json({ error: 'caseId requerido' }, { status: 400 })
  }

  // 1. Auth
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const service = createServiceClient()
  const { data: profile, error: profileErr } = await service
    .from('profiles')
    .select('role, employee_type')
    .eq('id', user.id)
    .single()

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const isAdmin = profile.role === 'admin'
  const isEmployee = profile.role === 'employee'
  if (!isAdmin && !isEmployee) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // 2. Acceso al caso específico
  // Paralegal tiene acceso global (mismo gate que /employee/cases/[id]).
  // Otros employee_type requieren assignment explícito.
  if (isEmployee && profile.employee_type !== 'paralegal') {
    const { data: assignment } = await service
      .from('employee_case_assignments')
      .select('id')
      .eq('employee_id', user.id)
      .eq('case_id', caseId)
      .maybeSingle()
    if (!assignment) {
      return NextResponse.json(
        { error: 'No tienes acceso a este caso' },
        { status: 403 },
      )
    }
  }

  // 3. Construir el PDF
  let result
  try {
    result = await buildClientInfoExport(caseId, service)
  } catch (err) {
    console.error('[client-info-pdf] generation error:', err)
    return NextResponse.json(
      { error: 'Error al generar el PDF' },
      { status: 500 },
    )
  }

  if (!result) {
    return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
  }

  // 4. Auditoría no bloqueante (logActivity nunca tira)
  void logActivity({
    caseId,
    category: 'document',
    subcategory: 'document.client_info_exported',
    description: `Descarga del PDF de información del cliente (${result.sectionsCount} formularios incluidos)`,
    metadata: {
      sections_count: result.sectionsCount,
      partial_errors_count: result.partialErrors.length,
      filename: result.filename,
    },
    actor: { kind: 'session', supabase },
    client: service,
  })

  return new NextResponse(new Uint8Array(result.pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${result.filename}"`,
      'Cache-Control': 'private, no-store',
      'Content-Length': String(result.pdfBytes.byteLength),
    },
  })
}
