import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { ConditionalLogic, DocumentType, CasePhase, DocumentSlotKind } from '@/types/database'
import { getPhaseCategory } from '@/lib/document-types/phase-category-overrides'

/**
 * GET /api/cita/[token]/required-documents
 *
 * Resuelve la lista de documentos que el cliente debe subir según:
 *   - cases.current_phase (custodia | i360 | i485)
 *   - flags clínicos (parent_deceased, in_orr_custody, has_criminal_history)
 *   - conditional_logic JSONB de cada document_type
 *
 * Para cada doc requerido, agrupa los uploads existentes por slot_label:
 *   - slot_kind=single:         { default: [file]? }
 *   - slot_kind=dual_es_en:     { es: [file]?, en: [file]? }
 *   - slot_kind=multiple_named: { '<custom>': [file], '<otro>': [file], ... }
 *
 * También detecta:
 *   - status global del documento (pending/uploaded/in_review/approved/rejected/needs_translation)
 *   - from_previous_phase: doc subido en fase anterior pero que sigue aplicando
 *
 * Estructura optimizada para que el cliente renderice acordeones por categoría
 * sin lógica adicional.
 */

type DocStatus = 'pending' | 'uploaded' | 'in_review' | 'approved' | 'rejected' | 'needs_translation'

interface UploadFile {
  id: string
  name: string
  file_type: string | null
  file_size: number | null
  status: string
  rejection_reason: string | null
  uploaded_at: string
  phase_when_uploaded: CasePhase | null
}

interface DocItem {
  type_id: number
  code: string
  name_es: string
  description_es: string | null
  legal_reference: string | null
  requires_translation: boolean
  requires_certified_copy: boolean
  slot_kind: DocumentSlotKind
  max_slots: number | null
  visible_because: 'phase_default' | 'conditional_match'
  status: DocStatus
  uploads: Record<string, UploadFile[]>  // indexado por slot label ('default' | 'es' | 'en' | nombre custom)
  from_previous_phase: boolean
}

interface CategoryGroup {
  code: string
  name_es: string
  icon: string | null
  total_required: number
  total_completed: number
  docs: DocItem[]
}

interface ResponseShape {
  case_id: string
  current_phase: CasePhase | null
  total_required: number
  total_completed: number
  progress_pct: number
  categories: CategoryGroup[]
}

const PHASE_FLAG: Record<CasePhase, keyof DocumentType> = {
  custodia:   'shown_in_custodia',
  i360:       'shown_in_i360',
  i485:       'shown_in_i485',
  completado: 'shown_in_i485',
}

function evaluateConditional(logic: ConditionalLogic | null | undefined, flags: Record<string, boolean>): boolean {
  if (!logic) return true
  if (logic.type === 'flag_eq') {
    return flags[logic.flag] === logic.value
  }
  return true
}

function deriveDocStatus(
  doc: { slot_kind: DocumentSlotKind; requires_translation: boolean },
  uploads: Record<string, UploadFile[]>,
): DocStatus {
  const allFiles = Object.values(uploads).flat()
  if (allFiles.length === 0) return 'pending'

  // Si algún file fue rechazado y no hay reemplazo aprobado, todo el doc está rejected
  const hasRejected = allFiles.some((f) => f.status === 'rejected')
  if (hasRejected && !allFiles.some((f) => f.status === 'approved' || f.status === 'uploaded')) {
    return 'rejected'
  }

  if (doc.slot_kind === 'dual_es_en' && doc.requires_translation) {
    const hasEs = (uploads.es?.length ?? 0) > 0
    const hasEn = (uploads.en?.length ?? 0) > 0
    if (hasEs && !hasEn) return 'needs_translation'
    if (!hasEs && hasEn) return 'needs_translation'
  }

  // Todos aprobados → approved
  if (allFiles.every((f) => f.status === 'approved')) return 'approved'
  // Alguno aprobado, otros uploaded → in_review (Diana revisando algunos)
  if (allFiles.some((f) => f.status === 'approved')) return 'in_review'
  // Solo uploaded sin rechazos → uploaded (esperando review)
  return 'uploaded'
}

function categoryProgressCount(docs: DocItem[]): { req: number; done: number } {
  let req = 0
  let done = 0
  for (const d of docs) {
    req++
    // Cuenta como progreso cualquier documento que ya tiene al menos un archivo
    // subido (incluye needs_translation — está en progreso aunque incompleto).
    if (
      d.status === 'approved' ||
      d.status === 'in_review' ||
      d.status === 'uploaded' ||
      d.status === 'needs_translation'
    ) done++
  }
  return { req, done }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const supabase = createServiceClient()

  // 1. Resolver token → caso
  const { data: tokenData } = await supabase
    .from('appointment_tokens')
    .select('case_id, client_id, is_active')
    .eq('token', token)
    .single()

  if (!tokenData?.is_active) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 403 })
  }

  // 2. Cargar caso + flags
  const { data: caseRow } = await supabase
    .from('cases')
    .select('id, current_phase, parent_deceased, in_orr_custody, has_criminal_history, minor_close_to_21, living_parent_consents, requires_foreign_service')
    .eq('id', tokenData.case_id)
    .single()

  const currentPhase = (caseRow?.current_phase as CasePhase | null) ?? null

  // Si el caso no participa del sistema de fases (ej. asilo), devolver vacío con mensaje
  if (!currentPhase || !caseRow) {
    const empty: ResponseShape = {
      case_id: tokenData.case_id,
      current_phase: null,
      total_required: 0,
      total_completed: 0,
      progress_pct: 0,
      categories: [],
    }
    return NextResponse.json(empty)
  }

  const flags: Record<string, boolean> = {
    parent_deceased:          caseRow.parent_deceased ?? false,
    in_orr_custody:           caseRow.in_orr_custody ?? false,
    has_criminal_history:     caseRow.has_criminal_history ?? false,
    minor_close_to_21:        caseRow.minor_close_to_21 ?? false,
    living_parent_consents:   caseRow.living_parent_consents ?? false,
    requires_foreign_service: caseRow.requires_foreign_service ?? false,
  }

  // 3. Cargar catálogo activo
  const phaseColumn = PHASE_FLAG[currentPhase]
  const { data: docTypes } = await supabase
    .from('document_types')
    .select('*')
    .eq('is_active', true)
    .eq(phaseColumn, true)
    .order('sort_order', { ascending: true })

  if (!docTypes || docTypes.length === 0) {
    const empty: ResponseShape = {
      case_id: tokenData.case_id,
      current_phase: currentPhase,
      total_required: 0,
      total_completed: 0,
      progress_pct: 0,
      categories: [],
    }
    return NextResponse.json(empty)
  }

  // 4. Filtrar por conditional_logic. Para docs opcionales (is_required=false)
  // diferimos el filtrado al final — solo aparecen si tienen archivos.
  const visibleTypes = (docTypes as (DocumentType & { is_required?: boolean })[]).filter((dt) =>
    evaluateConditional(dt.conditional_logic, flags),
  )

  // 5. Cargar uploads del caso (incluye todos los direction=client_to_admin con document_type_id)
  const { data: uploads } = await supabase
    .from('documents')
    .select('id, document_type_id, slot_label, name, file_type, file_size, status, rejection_reason, phase_when_uploaded, created_at')
    .eq('case_id', tokenData.case_id)
    .or('direction.eq.client_to_admin,direction.is.null')
    .not('document_type_id', 'is', null)
    .order('created_at', { ascending: false })

  // Indexar por document_type_id
  const uploadsByType = new Map<number, UploadFile[]>()
  for (const u of uploads ?? []) {
    if (u.document_type_id == null) continue
    const list = uploadsByType.get(u.document_type_id) ?? []
    list.push({
      id: u.id,
      name: u.name,
      file_type: u.file_type,
      file_size: u.file_size,
      status: u.status,
      rejection_reason: u.rejection_reason,
      uploaded_at: u.created_at,
      phase_when_uploaded: u.phase_when_uploaded as CasePhase | null,
    })
    uploadsByType.set(u.document_type_id, list)
  }

  // 6. Construir DocItems agrupados por categoría
  //
  // Resolver categoría y sort_order específicos por fase. Algunos docs
  // (acta, pasaporte, I-94, ORR consent, etc.) pertenecen a categorías
  // distintas en Custodia / I-360 / I-485. El override en
  // lib/document-types/phase-category-overrides.ts define el mapping;
  // si no hay override, se usa lo del catálogo `document_types`.
  const typesWithCategory = visibleTypes.map((dt) => ({
    dt,
    phaseCategory: getPhaseCategory(dt, currentPhase),
  }))
  typesWithCategory.sort((a, b) => a.phaseCategory.sort_order - b.phaseCategory.sort_order)

  const categoryMap = new Map<string, CategoryGroup>()
  const categoryMinSort = new Map<string, number>()

  for (const { dt, phaseCategory } of typesWithCategory) {
    const filesForType = uploadsByType.get(dt.id) ?? []

    // Docs opcionales: solo aparecen si tienen archivos. No molestamos al
    // cliente con un slot vacío de un doc que no es requerido.
    if (dt.is_required === false && filesForType.length === 0) continue

    // Agrupar files por slot_label según slot_kind
    const slots: Record<string, UploadFile[]> = {}
    if (dt.slot_kind === 'single') {
      slots.default = filesForType.filter((f) => !f.status || f.status !== 'rejected' || true)
    } else if (dt.slot_kind === 'dual_es_en') {
      slots.es = filesForType.filter((f) => {
        // Sin slot_label legacy → asumir 'es' (idioma original)
        const sl = (f as unknown as { slot_label?: string }).slot_label
        return sl == null || sl === 'es' || sl === ''
      })
      slots.en = filesForType.filter((f) => {
        const sl = (f as unknown as { slot_label?: string }).slot_label
        return sl === 'en'
      })
    } else if (dt.slot_kind === 'multiple_named') {
      for (const f of filesForType) {
        const sl = (f as unknown as { slot_label?: string }).slot_label || f.name
        if (!slots[sl]) slots[sl] = []
        slots[sl].push(f)
      }
    }

    // Reasignar uploads por slot_label correctamente desde la BD original
    // (el bloque de arriba es heurístico; preferir el slot_label real cuando exista)
    if (dt.slot_kind !== 'single') {
      const realSlots: Record<string, UploadFile[]> = {}
      const rawFiles = (uploads ?? []).filter((u) => u.document_type_id === dt.id)
      if (dt.slot_kind === 'dual_es_en') {
        realSlots.es = []
        realSlots.en = []
        for (const u of rawFiles) {
          const sl = (u as { slot_label: string | null }).slot_label
          const f: UploadFile = {
            id: u.id,
            name: u.name,
            file_type: u.file_type,
            file_size: u.file_size,
            status: u.status,
            rejection_reason: u.rejection_reason,
            uploaded_at: u.created_at,
            phase_when_uploaded: u.phase_when_uploaded as CasePhase | null,
          }
          if (sl === 'en') realSlots.en.push(f)
          else realSlots.es.push(f) // null/'es'/cualquier otra cosa cae en es
        }
      } else if (dt.slot_kind === 'multiple_named') {
        for (const u of rawFiles) {
          const sl = (u as { slot_label: string | null }).slot_label || u.name
          if (!realSlots[sl]) realSlots[sl] = []
          realSlots[sl].push({
            id: u.id,
            name: u.name,
            file_type: u.file_type,
            file_size: u.file_size,
            status: u.status,
            rejection_reason: u.rejection_reason,
            uploaded_at: u.created_at,
            phase_when_uploaded: u.phase_when_uploaded as CasePhase | null,
          })
        }
      }
      Object.assign(slots, realSlots)
    }

    const status = deriveDocStatus(
      { slot_kind: dt.slot_kind, requires_translation: dt.requires_translation },
      slots,
    )

    const allFiles = Object.values(slots).flat()
    const fromPreviousPhase = allFiles.length > 0 &&
      allFiles.every((f) => f.phase_when_uploaded != null && f.phase_when_uploaded !== currentPhase)

    const docItem: DocItem = {
      type_id: dt.id,
      code: dt.code,
      name_es: dt.name_es,
      description_es: dt.description_es ?? null,
      legal_reference: dt.legal_reference ?? null,
      requires_translation: dt.requires_translation,
      requires_certified_copy: dt.requires_certified_copy,
      slot_kind: dt.slot_kind,
      max_slots: dt.max_slots ?? null,
      visible_because: dt.conditional_logic ? 'conditional_match' : 'phase_default',
      status,
      uploads: slots,
      from_previous_phase: fromPreviousPhase,
    }

    let group = categoryMap.get(phaseCategory.category_code)
    if (!group) {
      group = {
        code: phaseCategory.category_code,
        name_es: phaseCategory.category_name_es,
        icon: phaseCategory.category_icon,
        total_required: 0,
        total_completed: 0,
        docs: [],
      }
      categoryMap.set(phaseCategory.category_code, group)
      categoryMinSort.set(phaseCategory.category_code, phaseCategory.sort_order)
    }
    group.docs.push(docItem)
  }

  // 7. Computar progresos por categoría y global. Las categorías se
  // emiten ordenadas por el sort_order mínimo de sus docs (calculado
  // arriba con override por fase), no por orden de inserción.
  let totalRequired = 0
  let totalCompleted = 0
  const categories: CategoryGroup[] = Array.from(categoryMap.entries())
    .sort(([a], [b]) =>
      (categoryMinSort.get(a) ?? 0) - (categoryMinSort.get(b) ?? 0),
    )
    .map(([, g]) => g)
  for (const group of categories) {
    const { req, done } = categoryProgressCount(group.docs)
    group.total_required = req
    group.total_completed = done
    totalRequired += req
    totalCompleted += done
  }

  const response: ResponseShape = {
    case_id: tokenData.case_id,
    current_phase: currentPhase,
    total_required: totalRequired,
    total_completed: totalCompleted,
    progress_pct: totalRequired === 0 ? 0 : Math.round((totalCompleted / totalRequired) * 100),
    categories,
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'private, max-age=10' },
  })
}
