import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { ConditionalLogic, DocumentType, CasePhase, DocumentSlotKind } from '@/types/database'
import { getPhaseCategory } from '@/lib/document-types/phase-category-overrides'
import { resolvePhaseCategory, type DocumentTypePhaseRow } from '@/lib/document-types/phase-overrides-registry'
import { isPhasedService } from '@/lib/services/registry'
import { getFamilyMembers, memberSuffix, type FamilyMember, type MemberRole } from '@/lib/contracts/family-members'

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
  /** Rol del miembro al que pertenece este item ('applicant' | 'spouse' | 'minor'). NULL para items globales. */
  member_role: MemberRole | null
  /** Índice 0-based en `contracts.minors[]` solo cuando member_role='minor'. NULL en otro caso. */
  member_index: number | null
  /** Nombre completo del miembro al que pertenece (snapshot). NULL si es global. */
  member_label: string | null
  /**
   * @deprecated — usar `member_index` con member_role='minor'. Shim por una release
   * para que la UI cliente vieja siga funcionando.
   */
  minor_index: number | null
  /** @deprecated — usar `member_label`. */
  minor_label: string | null
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

// Mapeo fase → columna boolean en `document_types`.
// Solo cubre SIJS. Servicios Asilo Político leen documentos vía la tabla M2M
// `document_type_phases` (introducida en migración 20260515), no por columnas
// `shown_in_*`. El endpoint detecta el caso y enruta por servicio.
const PHASE_FLAG: Partial<Record<CasePhase, keyof DocumentType>> = {
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

  // 2. Cargar caso + flags + servicio
  const { data: caseRow } = await supabase
    .from('cases')
    .select('id, current_phase, parent_deceased, in_orr_custody, has_criminal_history, minor_close_to_21, living_parent_consents, requires_foreign_service, service:service_catalog(slug)')
    .eq('id', tokenData.case_id)
    .single<{
      id: string
      current_phase: CasePhase | null
      parent_deceased: boolean | null
      in_orr_custody: boolean | null
      has_criminal_history: boolean | null
      minor_close_to_21: boolean | null
      living_parent_consents: boolean | null
      requires_foreign_service: boolean | null
      service: { slug: string } | { slug: string }[] | null
    }>()

  const serviceSlug = Array.isArray(caseRow?.service)
    ? caseRow.service[0]?.slug ?? null
    : caseRow?.service?.slug ?? null

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

  // 3. Cargar catálogo activo:
  //    - Para servicios fasados con M2M poblada (asilo-politico siempre, SIJS
  //      desde 20260515): JOIN entre document_type_phases y document_types.
  //    - Fallback SIJS si la M2M está vacía: usar columnas legacy shown_in_*.
  let docTypes: DocumentType[] | null = null
  let phaseRowsById: Map<number, DocumentTypePhaseRow> = new Map()

  if (serviceSlug && isPhasedService(serviceSlug)) {
    const { data: phaseRows } = await supabase
      .from('document_type_phases')
      .select('document_type_id, service_slug, phase_code, sort_order, category_code_override, category_name_es_override, category_icon_override, is_required_override, conditional_logic_override')
      .eq('service_slug', serviceSlug)
      .eq('phase_code', currentPhase)

    if (phaseRows && phaseRows.length > 0) {
      phaseRowsById = new Map(phaseRows.map((r) => [r.document_type_id, r as DocumentTypePhaseRow]))
      const { data } = await supabase
        .from('document_types')
        .select('*')
        .in('id', phaseRows.map((r) => r.document_type_id))
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
      docTypes = data
    }
  }

  // Fallback SIJS legacy (sin M2M): columnas booleanas. Mantiene compat.
  if (!docTypes) {
    const phaseColumn = PHASE_FLAG[currentPhase]
    if (!phaseColumn) {
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
    const { data } = await supabase
      .from('document_types')
      .select('*')
      .eq('is_active', true)
      .eq(phaseColumn, true)
      .order('sort_order', { ascending: true })
    docTypes = data
  }

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
    .select('id, document_type_id, slot_label, minor_index, minor_label, member_role, name, file_type, file_size, status, rejection_reason, phase_when_uploaded, created_at')
    .eq('case_id', tokenData.case_id)
    .or('direction.eq.client_to_admin,direction.is.null')
    .not('document_type_id', 'is', null)
    .order('created_at', { ascending: false })

  // 5.b Cargar contrato del case para reconstruir los miembros de familia.
  // SIJS: solo `minors[]` cuenta (helper retorna SOLO minors).
  // Asilo Político: `client_full_name` + `spouse` + `minors[]` + `asylum_family_type`.
  const { data: contractRow } = await supabase
    .from('contracts')
    .select('minors, spouse, asylum_family_type, client_full_name')
    .eq('case_id', tokenData.case_id)
    .maybeSingle()

  const familyMembers: FamilyMember[] = getFamilyMembers(
    {
      client_full_name: contractRow?.client_full_name ?? '',
      spouse: contractRow?.spouse as { fullName?: string | null } | null | undefined,
      minors: contractRow?.minors as Array<{ fullName?: string | null }> | null | undefined,
      asylum_family_type: contractRow?.asylum_family_type as string | null | undefined,
    },
    { serviceSlug },
  )

  type RawUpload = {
    id: string
    document_type_id: number | null
    slot_label: string | null
    minor_index: number | null
    minor_label: string | null
    member_role: MemberRole | null
    name: string
    file_type: string | null
    file_size: number | null
    status: string
    rejection_reason: string | null
    phase_when_uploaded: CasePhase | null
    created_at: string
  }
  const rawUploads = (uploads ?? []) as unknown as RawUpload[]

  // Indexar uploads por (document_type_id, member_role, member_index).
  // Convención de la key:
  //   - member_role=null → "general" (docs no per-member, ej. acta de matrimonio)
  //   - member_role='applicant'|'spouse' → index siempre -1
  //   - member_role='minor' → minor_index del documento (0-based)
  // Para uploads SIJS legacy con member_role=NULL pero minor_index NOT NULL,
  // los enrutamos como member_role='minor' (la migración M1 hace ese backfill
  // pero algún upload posterior podría llegar antes de propagarse PR-4).
  const uploadsKey = (typeId: number, role: MemberRole | null, idx: number | null) =>
    `${typeId}:${role ?? 'general'}:${idx ?? -1}`

  const uploadsByKey = new Map<string, RawUpload[]>()
  for (const u of rawUploads) {
    if (u.document_type_id == null) continue
    const effectiveRole: MemberRole | null =
      u.member_role ?? (u.minor_index != null ? 'minor' : null)
    const effectiveIndex = effectiveRole === 'minor' ? u.minor_index : null
    const k = uploadsKey(u.document_type_id, effectiveRole, effectiveIndex)
    const list = uploadsByKey.get(k) ?? []
    list.push(u)
    uploadsByKey.set(k, list)
  }

  function fileFromRaw(u: RawUpload): UploadFile {
    return {
      id: u.id,
      name: u.name,
      file_type: u.file_type,
      file_size: u.file_size,
      status: u.status,
      rejection_reason: u.rejection_reason,
      uploaded_at: u.created_at,
      phase_when_uploaded: u.phase_when_uploaded,
    }
  }

  // 6. Construir DocItems agrupados por categoría.
  //
  // La resolución de categoría visible viene de DOS fuentes (en orden):
  //   1. Fila M2M `document_type_phases` (migración 20260515) — si existe
  //      override `category_*_override`, gana. Esta es la fuente nueva,
  //      compartida por SIJS y Asilo Político.
  //   2. Helper TS legacy `phase-category-overrides.ts` — fallback SIJS para
  //      casos cacheados antes de la M2M. Será eliminado en una PR posterior
  //      cuando todos los consumidores migren.
  const typesWithCategory = visibleTypes.map((dt) => {
    const m2mRow = phaseRowsById.get(dt.id) ?? null
    const phaseCategory = m2mRow
      ? resolvePhaseCategory(dt, m2mRow)
      : getPhaseCategory(dt, currentPhase)
    return { dt, phaseCategory }
  })
  typesWithCategory.sort((a, b) => a.phaseCategory.sort_order - b.phaseCategory.sort_order)

  const categoryMap = new Map<string, CategoryGroup>()
  const categoryMinSort = new Map<string, number>()

  function buildDocItem(
    dt: DocumentType,
    fm: FamilyMember | null,
  ): DocItem | null {
    const role = fm?.role ?? null
    const memberIdx = fm?.role === 'minor' ? fm.index : null
    const rawFiles = uploadsByKey.get(uploadsKey(dt.id, role, memberIdx)) ?? []

    // Docs opcionales: en SIJS se ocultan cuando no hay archivos para no
    // saturar al cliente con cards vacías. En Asilo Político (y futuros
    // servicios fasados ≠ SIJS) los mostramos SIEMPRE — el cliente debe ver
    // todos los slots disponibles para entender qué puede subir (ej. cédula,
    // I-94, parole/NTA, etc. son opcionales pero el cliente necesita saberlo).
    const hideOptionalEmpty = serviceSlug === 'visa-juvenil'
    if (dt.is_required === false && rawFiles.length === 0 && hideOptionalEmpty) return null

    const slots: Record<string, UploadFile[]> = {}
    if (dt.slot_kind === 'single') {
      slots.default = rawFiles.map(fileFromRaw)
    } else if (dt.slot_kind === 'dual_es_en') {
      slots.es = []
      slots.en = []
      for (const u of rawFiles) {
        const f = fileFromRaw(u)
        if (u.slot_label === 'en') slots.en.push(f)
        else slots.es.push(f)
      }
    } else if (dt.slot_kind === 'multiple_named') {
      for (const u of rawFiles) {
        const sl = u.slot_label || u.name
        if (!slots[sl]) slots[sl] = []
        slots[sl].push(fileFromRaw(u))
      }
    }

    const status = deriveDocStatus(
      { slot_kind: dt.slot_kind, requires_translation: dt.requires_translation },
      slots,
    )

    const allFiles = Object.values(slots).flat()
    const fromPreviousPhase =
      allFiles.length > 0 &&
      allFiles.every(
        (f) => f.phase_when_uploaded != null && f.phase_when_uploaded !== currentPhase,
      )

    const suffix = fm ? memberSuffix(fm) : ''

    return {
      type_id: dt.id,
      code: dt.code,
      name_es: `${dt.name_es}${suffix}`,
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
      member_role: role,
      member_index: memberIdx,
      member_label: fm?.fullName ?? null,
      // Shims legacy (deprecated)
      minor_index: role === 'minor' ? memberIdx : null,
      minor_label: role === 'minor' ? fm?.fullName ?? null : null,
    }
  }

  /**
   * Tipo dinámico de la columna que viene del catálogo. Hasta que la migración
   * 20260517 propague todo el código consumidor, leemos `is_per_member` con
   * fallback a `is_per_minor` (alias generated en BD).
   */
  function isPerMember(dt: DocumentType & { is_per_member?: boolean }): boolean {
    return Boolean(dt.is_per_member ?? dt.is_per_minor)
  }

  for (const { dt, phaseCategory } of typesWithCategory) {
    // Para tipos per-member, expandir 1 item por cada miembro de la familia
    // (applicant + spouse + minors según el servicio). Si el contrato no
    // tiene miembros (caso legacy o servicio no-Asilo sin minors), caemos al
    // item general sin member_role para no esconder docs ya subidos.
    const items: DocItem[] = []
    if (isPerMember(dt) && familyMembers.length > 0) {
      familyMembers.forEach((fm) => {
        const item = buildDocItem(dt, fm)
        if (item) items.push(item)
      })
      // Bucket "Sin asignar" para uploads legacy sin member_role.
      const legacyItem = buildDocItem(dt, null)
      if (legacyItem) {
        legacyItem.name_es = `${dt.name_es} — Sin asignar`
        items.push(legacyItem)
      }
    } else {
      const item = buildDocItem(dt, null)
      if (item) items.push(item)
    }

    if (items.length === 0) continue

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
    for (const it of items) group.docs.push(it)
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
