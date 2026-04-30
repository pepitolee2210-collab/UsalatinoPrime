import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { CasePhase } from '@/types/database'

const PHASE_ORDER: CasePhase[] = ['custodia', 'i360', 'i485', 'completado']

const PHASE_META: Record<CasePhase, { label: string; color: string; icon: string; description: string }> = {
  custodia: {
    label: 'Fase 1 — Custodia',
    color: 'purple',
    icon: 'child_care',
    description: 'Obtener orden de custodia con hallazgos SIJS de la corte estatal.',
  },
  i360: {
    label: 'Fase 2 — I-360',
    color: 'blue',
    icon: 'assignment',
    description: 'Petición SIJS ante USCIS.',
  },
  i485: {
    label: 'Fase 3 — I-485',
    color: 'emerald',
    icon: 'verified',
    description: 'Ajuste de estatus / Green Card.',
  },
  completado: {
    label: 'Completado',
    color: 'amber',
    icon: 'flag',
    description: 'Proceso SIJS completado.',
  },
}

interface UploadFile {
  id: string
  document_type_id: number | null
  document_type_name_es: string | null
  category_name_es: string | null
  slot_label: string | null
  name: string
  file_type: string | null
  file_size: number | null
  status: string
  rejection_reason: string | null
  uploaded_at: string
  phase_when_uploaded: CasePhase | null
}

interface FormInstance {
  id: string
  form_name: string
  packet_type: string | null
  status: string
  filled_pdf_path: string | null
  filled_pdf_generated_at: string | null
  client_last_edit_at: string | null
  client_submitted_at: string | null
  phase_when_submitted: CasePhase | null
  total_filled_keys: number
}

interface PhaseGroup {
  phase: CasePhase | 'sin_fase'
  label: string
  color: string
  icon: string
  description: string
  status: 'completed' | 'active' | 'blocked' | 'archived'
  completed_at: string | null
  completed_by_name: string | null
  counts: {
    client_uploads: number
    client_uploads_approved: number
    firm_documents: number
    forms_total: number
    forms_submitted: number
  }
  documents: {
    client_uploads: UploadFile[]
    firm_documents: UploadFile[]
  }
  forms: FormInstance[]
}

interface ResponseShape {
  case: {
    id: string
    case_number: string
    current_phase: CasePhase | null
    process_start: CasePhase | null
    state_us: string | null
    service_slug: string | null
  }
  phases: PhaseGroup[]
  archived_documents: UploadFile[]
}

/**
 * GET /api/admin/cases/[id]/case-overview
 *
 * Agrega todos los uploads del cliente, expedientes generados por la
 * firma y formularios oficiales del caso, agrupados por la fase en
 * que se entregaron. Pensado para el panel del paralegal — Diana
 * ve cada fase como un acordeón con su propio contenido y estado.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role, employee_type')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'
  const isEmployee = profile?.role === 'employee'
  if (!isAdmin && !isEmployee) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  // 1. Caso
  const { data: caseRow } = await service
    .from('cases')
    .select('id, case_number, current_phase, process_start, state_us, service_id')
    .eq('id', id)
    .single()

  if (!caseRow) {
    return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
  }

  // 2. Servicio para slug
  const { data: serviceRow } = caseRow.service_id
    ? await service.from('service_catalog').select('slug').eq('id', caseRow.service_id).single()
    : { data: null as { slug: string } | null }

  // 3. Historial de fases — para sacar completed_at por fase
  const { data: history } = await service
    .from('case_phase_history')
    .select('to_phase, changed_at, changed_by')
    .eq('case_id', id)
    .order('changed_at', { ascending: true })

  const changedByIds = Array.from(new Set((history ?? []).map(h => h.changed_by).filter(Boolean) as string[]))
  const profilesMap = new Map<string, string>()
  if (changedByIds.length > 0) {
    const { data: profiles } = await service
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', changedByIds)
    for (const p of profiles ?? []) {
      profilesMap.set(p.id, `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim())
    }
  }

  // Mapeo: cuándo se completó CADA fase = el momento en que se SALIÓ de ella.
  // Se calcula a partir del orden cronológico de case_phase_history.
  const completedByPhase = new Map<CasePhase, { at: string; by: string | null }>()
  const ordered = (history ?? []).slice()
  let prevPhase: CasePhase | null = caseRow.process_start as CasePhase | null
  for (const h of ordered) {
    if (prevPhase && h.to_phase !== prevPhase) {
      completedByPhase.set(prevPhase as CasePhase, {
        at: h.changed_at,
        by: h.changed_by ? profilesMap.get(h.changed_by) ?? null : null,
      })
    }
    prevPhase = h.to_phase as CasePhase
  }

  // 4. Documentos del caso (con join a document_types para mostrar categoría)
  const { data: documents } = await service
    .from('documents')
    .select(`
      id, document_type_id, slot_label, name, file_type, file_size, status,
      rejection_reason, direction, phase_when_uploaded, created_at,
      document_types ( name_es, category_name_es )
    `)
    .eq('case_id', id)
    .order('created_at', { ascending: false })

  // 5. Formularios oficiales
  const { data: forms } = await service
    .from('case_form_instances')
    .select('id, form_name, packet_type, status, filled_pdf_path, filled_pdf_generated_at, client_last_edit_at, client_submitted_at, phase_when_submitted, filled_values')
    .eq('case_id', id)
    .order('client_submitted_at', { ascending: false, nullsFirst: false })

  // 6. Agrupar por fase
  const currentPhase = (caseRow.current_phase as CasePhase | null) ?? null
  const currentPhaseIdx = currentPhase ? PHASE_ORDER.indexOf(currentPhase) : -1

  const phases: PhaseGroup[] = (['custodia', 'i360', 'i485'] as const).map((p) => {
    const meta = PHASE_META[p]
    const idx = PHASE_ORDER.indexOf(p)

    // Status calculation
    let status: PhaseGroup['status'] = 'blocked'
    if (currentPhase === null) status = 'blocked'
    else if (idx < currentPhaseIdx) status = 'completed'
    else if (idx === currentPhaseIdx) status = 'active'
    else status = 'blocked'
    if (currentPhase === 'completado') status = 'archived'

    const completed = completedByPhase.get(p)

    // Filtrar uploads + forms
    const phaseUploads = (documents ?? []).filter(d => d.phase_when_uploaded === p)
    const clientUploads = phaseUploads
      .filter(d => !d.direction || d.direction === 'client_to_admin')
      .map(d => mapUpload(d))
    const firmDocuments = phaseUploads
      .filter(d => d.direction === 'admin_to_client')
      .map(d => mapUpload(d))

    const phaseForms = (forms ?? [])
      .filter(f => f.phase_when_submitted === p)
      .map(mapForm)

    return {
      phase: p,
      label: meta.label,
      color: meta.color,
      icon: meta.icon,
      description: meta.description,
      status,
      completed_at: completed?.at ?? null,
      completed_by_name: completed?.by ?? null,
      counts: {
        client_uploads: clientUploads.length,
        client_uploads_approved: clientUploads.filter(u => u.status === 'approved').length,
        firm_documents: firmDocuments.length,
        forms_total: phaseForms.length,
        forms_submitted: phaseForms.filter(f => f.client_submitted_at != null).length,
      },
      documents: {
        client_uploads: clientUploads,
        firm_documents: firmDocuments,
      },
      forms: phaseForms,
    }
  })

  // 7. Bloque "sin fase" para uploads/forms legacy (phase_when_uploaded IS NULL)
  const legacyUploads = (documents ?? []).filter(d => d.phase_when_uploaded == null)
  const legacyClientUploads = legacyUploads
    .filter(d => !d.direction || d.direction === 'client_to_admin')
    .map(mapUpload)
  const legacyFirmDocuments = legacyUploads
    .filter(d => d.direction === 'admin_to_client')
    .map(mapUpload)
  const legacyForms = (forms ?? []).filter(f => f.phase_when_submitted == null).map(mapForm)

  if (legacyClientUploads.length > 0 || legacyFirmDocuments.length > 0 || legacyForms.length > 0) {
    phases.push({
      phase: 'sin_fase',
      label: 'Sin fase asignada',
      color: 'gray',
      icon: 'inventory_2',
      description: 'Documentos y formularios cargados antes del sistema de fases.',
      status: 'archived',
      completed_at: null,
      completed_by_name: null,
      counts: {
        client_uploads: legacyClientUploads.length,
        client_uploads_approved: legacyClientUploads.filter(u => u.status === 'approved').length,
        firm_documents: legacyFirmDocuments.length,
        forms_total: legacyForms.length,
        forms_submitted: legacyForms.filter(f => f.client_submitted_at != null).length,
      },
      documents: {
        client_uploads: legacyClientUploads,
        firm_documents: legacyFirmDocuments,
      },
      forms: legacyForms,
    })
  }

  // Documentos archivados de la firma — lista plana del caso, no filtrada
  // por fase. Invisibles para el cliente (los endpoints /api/cita/[token]/*
  // ya filtran por direction explícito).
  const archivedDocuments = (documents ?? [])
    .filter(d => d.direction === 'firm_internal')
    .map(mapUpload)

  const response: ResponseShape = {
    case: {
      id: caseRow.id,
      case_number: caseRow.case_number,
      current_phase: currentPhase,
      process_start: (caseRow.process_start as CasePhase | null) ?? null,
      state_us: caseRow.state_us ?? null,
      service_slug: serviceRow?.slug ?? null,
    },
    phases,
    archived_documents: archivedDocuments,
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'private, max-age=10' },
  })
}

type RawDocRow = {
  id: string
  document_type_id: number | null
  slot_label: string | null
  name: string
  file_type: string | null
  file_size: number | null
  status: string
  rejection_reason: string | null
  direction: string | null
  phase_when_uploaded: string | null
  created_at: string
  document_types: { name_es: string | null; category_name_es: string | null }
    | { name_es: string | null; category_name_es: string | null }[]
    | null
}

function mapUpload(d: RawDocRow): UploadFile {
  const dt = Array.isArray(d.document_types) ? d.document_types[0] : d.document_types
  return {
    id: d.id,
    document_type_id: d.document_type_id,
    document_type_name_es: dt?.name_es ?? null,
    category_name_es: dt?.category_name_es ?? null,
    slot_label: d.slot_label,
    name: d.name,
    file_type: d.file_type,
    file_size: d.file_size,
    status: d.status,
    rejection_reason: d.rejection_reason,
    uploaded_at: d.created_at,
    phase_when_uploaded: (d.phase_when_uploaded as CasePhase | null) ?? null,
  }
}

type RawFormRow = {
  id: string
  form_name: string
  packet_type: string | null
  status: string
  filled_pdf_path: string | null
  filled_pdf_generated_at: string | null
  client_last_edit_at: string | null
  client_submitted_at: string | null
  phase_when_submitted: string | null
  filled_values: Record<string, unknown> | null
}

function mapForm(f: RawFormRow): FormInstance {
  const filled = f.filled_values ?? {}
  return {
    id: f.id,
    form_name: f.form_name,
    packet_type: f.packet_type,
    status: f.status,
    filled_pdf_path: f.filled_pdf_path,
    filled_pdf_generated_at: f.filled_pdf_generated_at,
    client_last_edit_at: f.client_last_edit_at,
    client_submitted_at: f.client_submitted_at,
    phase_when_submitted: (f.phase_when_submitted as CasePhase | null) ?? null,
    total_filled_keys: Object.keys(filled).length,
  }
}
