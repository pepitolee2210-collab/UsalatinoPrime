import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { CasePhase } from '@/types/database'
import { getServicePhases } from '@/lib/services/registry'
import { AUTOMATED_FORMS } from '@/lib/legal/automated-forms-registry'
import { formApplies } from '@/lib/legal/phase-form-mapping'

/**
 * Orden de fases SIJS — fallback usado solo cuando no se puede resolver el
 * service_slug del caso (ej. service_id NULL). Para casos normales el
 * endpoint deriva el orden dinámicamente desde el registry según el servicio.
 */
const PHASE_ORDER: CasePhase[] = ['custodia', 'i360', 'i485', 'completado']

type PhaseMeta = { label: string; color: string; icon: string; description: string }

const PHASE_META: Record<CasePhase, PhaseMeta> = {
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
  // Entries de Asilo Político — no se usan en este endpoint (SIJS-only) pero
  // requeridos para que el Record satisfaga el tipo CasePhase completo.
  asilo_sustentos: {
    label: 'Fase 1 — Sustentos',
    color: 'purple',
    icon: 'folder_managed',
    description: 'Recopilación de identidad y estatus de ingreso.',
  },
  asilo_reforzar: {
    label: 'Fase 2 — Reforzar Asilo',
    color: 'blue',
    icon: 'shield_person',
    description: 'Declaración jurada, evidencias y Miedo Creíble.',
  },
  asilo_completado: {
    label: 'Completado',
    color: 'amber',
    icon: 'flag',
    description: 'Expediente presentado ante USCIS.',
  },
  // Apelación — servicio de 1 sola fase (BIA). Entry requerido por tipo
  // pero este endpoint es SIJS-only en práctica.
  apelacion: {
    label: 'Apelación',
    color: 'rose',
    icon: 'gavel',
    description: 'Apelación ante la BIA contra la decisión adversa del Juez de Inmigración.',
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
  /** Identificador semántico (ej. `eoir-26_filled`). NULL para uploads genéricos. */
  document_key: string | null
  /** Path en el bucket `case-documents` de Storage. */
  file_path: string | null
}

/**
 * Devuelve true si el documento fue generado automáticamente por el endpoint
 * /api/admin/case-forms/[slug]/print. Esos documentos se guardan con
 * `document_key='<slug>_filled'` y NO deben mezclarse con archivos subidos
 * manualmente por la firma en la pestaña "Para el Cliente".
 */
function isSystemGenerated(documentKey: string | null | undefined): boolean {
  return !!documentKey && /_filled$/.test(documentKey)
}

interface FormInstance {
  id: string
  /** Slug del AUTOMATED_FORMS registry, derivado de form_name. NULL si no es automatizado. */
  slug: string | null
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

/**
 * Resuelve el slug del AUTOMATED_FORMS registry por nombre del formulario.
 * El nombre es UNIQUE en case_form_instances (constraint case_id+packet_type+form_name),
 * y cada def del registry expone su formName.
 */
const FORM_NAME_TO_SLUG: Map<string, string> = new Map(
  Object.values(AUTOMATED_FORMS).map((def) => [def.formName, def.slug]),
)

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
    /** PDFs/DOCX auto-generados por el endpoint /print (EOIR-26 rellenado, etc.). */
    system_generated: number
    forms_total: number
    forms_submitted: number
  }
  documents: {
    client_uploads: UploadFile[]
    firm_documents: UploadFile[]
    /** Bucket separado para formularios oficiales rellenados por el sistema. */
    system_generated_documents: UploadFile[]
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
      document_key, file_path,
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

  // 6. Agrupar por fase. El orden y conjunto de fases viene del registry
  // según el servicio (visa-juvenil → custodia/i360/i485, asilo-politico →
  // asilo_sustentos/asilo_reforzar). Excluimos las fases marcadas isCompletion
  // para mantener paridad con el comportamiento previo SIJS (mostraba 3 fases
  // activas, no 4).
  const currentPhase = (caseRow.current_phase as CasePhase | null) ?? null
  const serviceSlug = serviceRow?.slug ?? null

  // I-360 (SIJS) vive en case_form_submissions, NO en case_form_instances —
  // es un wizard especial separado del registry. Para que la pestaña
  // Formularios refleje su existencia en el contador, lo detectamos aparte.
  let i360HardcodedExists = false
  let i360HardcodedSubmitted = false
  if (serviceSlug === 'visa-juvenil') {
    const { data: i360Sub } = await service
      .from('case_form_submissions')
      .select('status')
      .eq('case_id', id)
      .eq('form_type', 'i360_sijs')
      .maybeSingle()
    if (i360Sub) {
      i360HardcodedExists = true
      i360HardcodedSubmitted = i360Sub.status === 'submitted' || i360Sub.status === 'approved'
    }
  }

  const orderedPhases: CasePhase[] = (() => {
    const fromRegistry = getServicePhases(serviceSlug)
    if (fromRegistry.length === 0) return PHASE_ORDER
    return fromRegistry.map((p) => p.code)
  })()
  const nonCompletionPhases = orderedPhases.filter((p) => {
    const def = getServicePhases(serviceSlug).find((d) => d.code === p)
    return !def?.isCompletion
  })
  // Para servicios de UNA sola fase marcada como isCompletion (ej. Apelación),
  // nonCompletionPhases queda vacío — pero la fase única SÍ debe renderizarse
  // (es la fase activa, no un "completado" archivable). Si no hay fases no-
  // completion, mostramos las del registry tal cual.
  // Fallback final: si el registry no tiene el servicio en absoluto, asumimos
  // las 3 fases SIJS activas (mantiene comportamiento legacy).
  const phasesToRender: CasePhase[] =
    nonCompletionPhases.length > 0
      ? nonCompletionPhases
      : orderedPhases.length > 0
        ? orderedPhases
        : ((['custodia', 'i360', 'i485'] as const) as unknown as CasePhase[])

  const currentPhaseIdx = currentPhase ? orderedPhases.indexOf(currentPhase) : -1

  // Deriva la fase semántica de un form basándose en el registry cuando
  // phase_when_submitted está NULL (forms creados/descargados antes de que
  // el cliente los envíe, como un I-485 generado por Diana pre-submit).
  // Esto evita el bloque "Sin fase asignada" en casos comunes.
  const caseStateUs: string | null = caseRow.state_us ?? null
  function effectivePhase(formName: string): CasePhase | null {
    const def = Object.values(AUTOMATED_FORMS).find(d => d.formName === formName)
    if (!def) return null
    for (const ph of phasesToRender) {
      if (formApplies(def, ph, caseStateUs)) return ph
    }
    return null
  }

  const phases: PhaseGroup[] = phasesToRender.map((p) => {
    const meta = PHASE_META[p]
    const idx = orderedPhases.indexOf(p)

    // Status calculation
    let status: PhaseGroup['status'] = 'blocked'
    if (currentPhase === null) status = 'blocked'
    else if (idx < currentPhaseIdx) status = 'completed'
    else if (idx === currentPhaseIdx) status = 'active'
    else status = 'blocked'
    // Si el caso ya está en la fase de cierre del servicio, todas las fases
    // activas anteriores se marcan como archivadas. Para SIJS la completion
    // es 'completado'; para Asilo es 'asilo_completado'.
    // Excepción: si el servicio tiene UNA sola fase y ESA fase es isCompletion
    // (ej. Apelación), no archivar — la fase es la fase activa del proceso.
    const completionDef = getServicePhases(serviceSlug).find((d) => d.isCompletion)
    const onlyHasCompletionPhase = orderedPhases.length === 1 && completionDef != null
    if (completionDef && currentPhase === completionDef.code && !onlyHasCompletionPhase) {
      status = 'archived'
    }

    const completed = completedByPhase.get(p)

    // Filtrar uploads + forms.
    // Los PDFs/DOCX rellenados por el endpoint /print se guardan con
    // document_key='{slug}_filled' y direction='admin_to_client'. Los aislamos
    // en un bucket propio (system_generated_documents) para no contaminar la
    // pestaña "Para el Cliente" (que debería listar solo entregables manuales).
    const phaseUploads = (documents ?? []).filter(d => d.phase_when_uploaded === p)
    const clientUploads = phaseUploads
      .filter(d => !d.direction || d.direction === 'client_to_admin')
      .map(d => mapUpload(d))
    const firmAllUploads = phaseUploads.filter(d => d.direction === 'admin_to_client')
    const systemGeneratedDocuments = firmAllUploads
      .filter(d => isSystemGenerated(d.document_key))
      .map(d => mapUpload(d))
    const firmDocuments = firmAllUploads
      .filter(d => !isSystemGenerated(d.document_key))
      .map(d => mapUpload(d))

    const phaseForms = (forms ?? [])
      .filter(f => (f.phase_when_submitted ?? effectivePhase(f.form_name)) === p)
      .map(mapForm)

    // Forms aplicables a esta fase que aún NO tienen instance en BD — placeholder
    // "virtual" para que la pestaña Formularios los muestre antes de que alguien
    // abra el modal. Al abrir el modal, GET /api/admin/case-forms/[slug] crea la
    // instance real on-demand y la próxima carga reemplaza al virtual.
    // Dedup por formName (UNIQUE en case_form_instances(case_id, packet_type, form_name)).
    const realFormNames = new Set(phaseForms.map(f => f.form_name))
    const virtualForms: FormInstance[] = Object.values(AUTOMATED_FORMS)
      .filter(def => formApplies(def, p, caseStateUs))
      .filter(def => !realFormNames.has(def.formName))
      .map(def => ({
        id: `virtual:${def.slug}`,
        slug: def.slug,
        form_name: def.formName,
        packet_type: def.packetType,
        status: 'pending',
        filled_pdf_path: null,
        filled_pdf_generated_at: null,
        client_last_edit_at: null,
        client_submitted_at: null,
        phase_when_submitted: null,
        total_filled_keys: 0,
      }))
    const allPhaseForms: FormInstance[] = [...phaseForms, ...virtualForms]

    // Sumar el wizard I-360 (case_form_submissions) al contador de Fase 2.
    // No lo agregamos al array `forms` porque se renderiza vía I360FormSection
    // como bloque dedicado — sólo afecta el badge visual.
    const isI360Phase = p === 'i360'
    const i360CountBoost = isI360Phase && i360HardcodedExists ? 1 : 0
    const i360SubmittedBoost = isI360Phase && i360HardcodedSubmitted ? 1 : 0

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
        system_generated: systemGeneratedDocuments.length,
        forms_total: allPhaseForms.length + i360CountBoost,
        forms_submitted: allPhaseForms.filter(f => f.client_submitted_at != null).length + i360SubmittedBoost,
      },
      documents: {
        client_uploads: clientUploads,
        firm_documents: firmDocuments,
        system_generated_documents: systemGeneratedDocuments,
      },
      forms: allPhaseForms,
    }
  })

  // 7. Bloque "sin fase" para uploads/forms legacy (phase_when_uploaded IS NULL)
  const legacyUploads = (documents ?? []).filter(d => d.phase_when_uploaded == null)
  const legacyClientUploads = legacyUploads
    .filter(d => !d.direction || d.direction === 'client_to_admin')
    .map(mapUpload)
  const legacyFirmAll = legacyUploads.filter(d => d.direction === 'admin_to_client')
  const legacySystemGenerated = legacyFirmAll
    .filter(d => isSystemGenerated(d.document_key))
    .map(mapUpload)
  const legacyFirmDocuments = legacyFirmAll
    .filter(d => !isSystemGenerated(d.document_key))
    .map(mapUpload)
  // Sólo forms genuinamente huérfanos — sin phase_when_submitted Y sin fase
  // derivable desde el registry. Antes caían acá forms como un I-485 generado
  // pre-submit, ensuciando el panel.
  const legacyForms = (forms ?? [])
    .filter(f => f.phase_when_submitted == null && effectivePhase(f.form_name) == null)
    .map(mapForm)

  if (
    legacyClientUploads.length > 0 ||
    legacyFirmDocuments.length > 0 ||
    legacySystemGenerated.length > 0 ||
    legacyForms.length > 0
  ) {
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
        system_generated: legacySystemGenerated.length,
        forms_total: legacyForms.length,
        forms_submitted: legacyForms.filter(f => f.client_submitted_at != null).length,
      },
      documents: {
        client_uploads: legacyClientUploads,
        firm_documents: legacyFirmDocuments,
        system_generated_documents: legacySystemGenerated,
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
  document_key: string | null
  file_path: string | null
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
    document_key: d.document_key ?? null,
    file_path: d.file_path ?? null,
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
    slug: FORM_NAME_TO_SLUG.get(f.form_name) ?? null,
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
