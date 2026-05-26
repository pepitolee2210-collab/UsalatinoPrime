'use client'

// BitacoraTab v2 — UX profesional:
//   - Header sticky con búsqueda + chips de filtros activos
//   - Timeline agrupado por día con header sticky por grupo
//   - Avatares por actor + strip de color por categoría
//   - Metadata como key-value table (no JSON crudo)
//   - Empty state ilustrado
//   - Iconos icónicos por tipo de evento

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Loader2,
  Clock,
  Briefcase,
  FileSignature,
  Calendar,
  CalendarCheck,
  CalendarX,
  Upload,
  FileCheck2,
  FileX2,
  FileText,
  FileBadge,
  DollarSign,
  Settings,
  ArrowRightLeft,
  UserPlus,
  PenTool,
  Link as LinkIcon,
  Filter,
  ChevronDown,
  ChevronRight,
  StickyNote,
  Edit3,
  Trash2,
  Pin,
  X,
  Search,
  AlertCircle,
} from 'lucide-react'
import type {
  CaseActivityCategory,
  CaseActivityActorRole,
} from '@/types/database'
import { Avatar, groupByDate } from './_ui-helpers'

interface ActivityItem {
  id: string
  case_id: string
  event_category: CaseActivityCategory | null
  event_subcategory: string | null
  action: string
  description: string
  metadata: Record<string, unknown>
  actor_id: string | null
  actor_role: CaseActivityActorRole | null
  actor_label: string | null
  visible_to_client: boolean
  created_at: string
}

interface ApiResponse {
  items: ActivityItem[]
  nextCursor: string | null
}

interface BitacoraTabProps {
  caseId: string
}

// ────────────── Mapas visuales ──────────────

const CATEGORY_LABELS: Record<CaseActivityCategory | 'unknown', string> = {
  case: 'Caso',
  contract: 'Contrato',
  appointment: 'Cita',
  document: 'Documento',
  form: 'Formulario',
  payment: 'Pago',
  system: 'Sistema',
  communication: 'Comunicación',
  unknown: 'Sin categoría',
}

// strip color por categoría
const CATEGORY_STRIP: Record<CaseActivityCategory | 'unknown', string> = {
  case: 'bg-purple-500',
  contract: 'bg-blue-500',
  appointment: 'bg-emerald-500',
  document: 'bg-amber-500',
  form: 'bg-indigo-500',
  payment: 'bg-green-600',
  system: 'bg-slate-500',
  communication: 'bg-cyan-500',
  unknown: 'bg-gray-400',
}

// soft chip
const CATEGORY_PILL: Record<CaseActivityCategory | 'unknown', string> = {
  case: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
  contract: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  appointment: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  document: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
  form: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
  payment: 'bg-green-50 text-green-700 ring-1 ring-green-200',
  system: 'bg-slate-50 text-slate-700 ring-1 ring-slate-200',
  communication: 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200',
  unknown: 'bg-gray-50 text-gray-500 ring-1 ring-gray-200',
}

const SUBCATEGORY_LABELS_ES: Record<string, string> = {
  'case.created': 'Caso creado',
  'case.phase_changed': 'Cambio de fase',
  'case.status_changed': 'Cambio de estado',
  'case.employee_assigned': 'Empleado asignado',
  'case.note_updated': 'Nota actualizada',
  'contract.generated': 'Contrato generado',
  'contract.signing_link_created': 'Link de firma creado',
  'contract.signed': 'Contrato firmado',
  'appointment.scheduled': 'Cita agendada',
  'appointment.rescheduled': 'Cita reagendada',
  'appointment.cancelled': 'Cita cancelada',
  'appointment.completed': 'Cita completada',
  'appointment.no_show': 'Cliente no se presentó',
  'appointment.objective_not_completed': 'Cita sin lograr objetivo',
  'communication.note_created': 'Nota agregada',
  'communication.note_updated': 'Nota editada',
  'communication.note_deleted': 'Nota eliminada',
  'communication.note_pinned': 'Nota fijada',
  'communication.note_unpinned': 'Nota desfijada',
  'document.uploaded_by_client': 'Documento subido por el cliente',
  'document.uploaded_by_staff': 'Documento subido por staff',
  'document.approved': 'Documento aprobado',
  'document.rejected': 'Documento rechazado',
  'document.delivered_to_client': 'Documento entregado al cliente',
  'document.archived': 'Documento archivado',
  'form.submitted_by_client': 'Formulario enviado por cliente',
  'form.locked_for_print': 'Formulario bloqueado para impresión',
  'form.pdf_generated': 'PDF generado',
  'payment.marked_paid': 'Pago marcado como recibido',
  'payment.plan_created': 'Plan de pagos creado',
  'system.access_toggled': 'Acceso modificado',
  'system.intake_status_changed': 'Estado de intake cambiado',
}

function iconForSubcategory(sub: string | null) {
  switch (sub) {
    case 'case.created': return Briefcase
    case 'case.phase_changed': return ArrowRightLeft
    case 'case.employee_assigned': return UserPlus
    case 'contract.generated': return FileSignature
    case 'contract.signing_link_created': return LinkIcon
    case 'contract.signed': return PenTool
    case 'appointment.scheduled': return Calendar
    case 'appointment.rescheduled': return ArrowRightLeft
    case 'appointment.cancelled':
    case 'appointment.no_show': return CalendarX
    case 'appointment.completed': return CalendarCheck
    case 'appointment.objective_not_completed': return CalendarX
    case 'communication.note_created': return StickyNote
    case 'communication.note_updated': return Edit3
    case 'communication.note_deleted': return Trash2
    case 'communication.note_pinned':
    case 'communication.note_unpinned': return Pin
    case 'document.uploaded_by_client':
    case 'document.uploaded_by_staff': return Upload
    case 'document.approved': return FileCheck2
    case 'document.rejected': return FileX2
    case 'document.delivered_to_client': return FileBadge
    case 'document.archived': return FileText
    case 'form.pdf_generated':
    case 'form.submitted_by_client':
    case 'form.locked_for_print': return FileText
    case 'payment.marked_paid':
    case 'payment.plan_created': return DollarSign
    case 'system.access_toggled':
    case 'system.intake_status_changed':
    case 'case.status_changed':
    case 'case.note_updated': return Settings
    default: return Clock
  }
}

function categoryKey(c: CaseActivityCategory | null): CaseActivityCategory | 'unknown' {
  return c ?? 'unknown'
}

const ALL_CATEGORIES: CaseActivityCategory[] = [
  'case', 'contract', 'appointment', 'document', 'form', 'payment', 'system', 'communication',
]

const DATE_PRESETS: { id: string; label: string; days: number | null }[] = [
  { id: 'all', label: 'Todo el tiempo', days: null },
  { id: '7d', label: 'Últimos 7 días', days: 7 },
  { id: '30d', label: 'Últimos 30 días', days: 30 },
  { id: '90d', label: 'Últimos 90 días', days: 90 },
]

// ────────────── Componente principal ──────────────

export function BitacoraTab({ caseId }: BitacoraTabProps) {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const [selectedCategories, setSelectedCategories] = useState<CaseActivityCategory[]>([])
  const [selectedActor, setSelectedActor] = useState<string>('all')
  const [datePreset, setDatePreset] = useState<string>('all')
  const [searchText, setSearchText] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const fromIso = useMemo(() => {
    if (datePreset === 'all') return null
    const preset = DATE_PRESETS.find((p) => p.id === datePreset)
    if (!preset?.days) return null
    const d = new Date()
    d.setDate(d.getDate() - preset.days)
    return d.toISOString()
  }, [datePreset])

  const fetchPage = useCallback(
    async (opts: { reset: boolean; cursor: string | null }) => {
      const params = new URLSearchParams()
      if (selectedCategories.length > 0) {
        params.set('category', selectedCategories.join(','))
      }
      if (selectedActor !== 'all') params.set('actor', selectedActor)
      if (fromIso) params.set('from', fromIso)
      if (opts.cursor) params.set('cursor', opts.cursor)

      const res = await fetch(
        `/api/admin/cases/${caseId}/activity?${params.toString()}`,
        { cache: 'no-store' },
      )
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Error al cargar la bitácora')
      }
      const data = (await res.json()) as ApiResponse
      setItems((prev) => (opts.reset ? data.items : [...prev, ...data.items]))
      setCursor(data.nextCursor)
      setHasMore(!!data.nextCursor)
    },
    [caseId, selectedCategories, selectedActor, fromIso],
  )

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoadingInitial(true)
      setError(null)
      try {
        await fetchPage({ reset: true, cursor: null })
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error')
      } finally {
        if (!cancelled) setLoadingInitial(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [fetchPage])

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !hasMore || loadingInitial) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingMore && cursor) {
          setLoadingMore(true)
          fetchPage({ reset: false, cursor })
            .catch((err) => setError(err instanceof Error ? err.message : 'Error'))
            .finally(() => setLoadingMore(false))
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [cursor, hasMore, loadingInitial, loadingMore, fetchPage])

  const visibleItems = useMemo(() => {
    if (!searchText.trim()) return items
    const q = searchText.toLowerCase()
    return items.filter(
      (it) =>
        it.description.toLowerCase().includes(q) ||
        (it.actor_label?.toLowerCase().includes(q) ?? false),
    )
  }, [items, searchText])

  const grouped = useMemo(
    () => groupByDate(visibleItems, (n) => new Date(n.created_at)),
    [visibleItems],
  )

  const actorOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const it of items) {
      if (it.actor_id && it.actor_label) {
        map.set(it.actor_id, it.actor_label)
      }
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }))
  }, [items])

  const activeFilterCount =
    selectedCategories.length +
    (selectedActor !== 'all' ? 1 : 0) +
    (datePreset !== 'all' ? 1 : 0)

  const toggleCategory = (c: CaseActivityCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    )
  }

  function clearFilters() {
    setSelectedCategories([])
    setSelectedActor('all')
    setDatePreset('all')
    setSearchText('')
  }

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ────────────── Render ──────────────

  if (loadingInitial) {
    return (
      <div
        className="flex items-center justify-center py-16"
        style={{ color: 'var(--admin-fg-muted)', fontSize: 13 }}
      >
        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
        Cargando bitácora del caso...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* HEADER sticky */}
      <div
        className="sticky top-0 z-10 -mx-1 px-1 py-2"
        style={{
          background: 'color-mix(in srgb, var(--admin-bg) 90%, transparent)',
          backdropFilter: 'blur(8px)',
          borderBottom: '0.5px solid var(--admin-border)',
        }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
              style={{ color: 'var(--admin-fg-subtle)' }}
            />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Buscar evento o autor..."
              className="w-full pl-9 pr-3 py-2 rounded-lg focus:outline-none transition-colors"
              style={{
                background: 'var(--admin-bg-elev)',
                border: '0.5px solid var(--admin-border-strong)',
                color: 'var(--admin-fg)',
                fontSize: 12,
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--admin-accent)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--admin-border-strong)' }}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors"
            style={{
              background: activeFilterCount > 0 ? 'var(--admin-gold-soft)' : 'var(--admin-bg-elev)',
              color: activeFilterCount > 0 ? 'var(--admin-gold)' : 'var(--admin-fg-muted)',
              border: `0.5px solid ${activeFilterCount > 0 ? 'var(--admin-gold-border, var(--admin-gold))' : 'var(--admin-border-strong)'}`,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <Filter className="w-3.5 h-3.5" /> Filtros
            {activeFilterCount > 0 && (
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded-full"
                style={{
                  background: 'var(--admin-gold)',
                  color: '#FFFFFF',
                  fontFamily: 'var(--font-mono-tech)',
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>
          <span
            className="whitespace-nowrap"
            style={{
              fontSize: 10,
              color: 'var(--admin-fg-subtle)',
              fontFamily: 'var(--font-mono-tech)',
              letterSpacing: '0.08em',
            }}
          >
            {visibleItems.length} EVENTO{visibleItems.length !== 1 ? 'S' : ''}
          </span>
        </div>

        {activeFilterCount > 0 && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {selectedCategories.map((c) => (
              <FilterChip key={c} label={CATEGORY_LABELS[c]} onClick={() => toggleCategory(c)} />
            ))}
            {selectedActor !== 'all' && (
              <FilterChip
                onClick={() => setSelectedActor('all')}
                label={actorOptions.find((a) => a.id === selectedActor)?.label || 'Autor'}
              />
            )}
            {datePreset !== 'all' && (
              <FilterChip
                onClick={() => setDatePreset('all')}
                label={DATE_PRESETS.find((p) => p.id === datePreset)?.label || ''}
              />
            )}
            <button
              type="button"
              onClick={clearFilters}
              className="ml-1 underline underline-offset-2 transition-colors"
              style={{ fontSize: 10, color: 'var(--admin-fg-subtle)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--admin-red)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--admin-fg-subtle)' }}
            >
              Limpiar
            </button>
          </div>
        )}

        {showFilters && (
          <div
            className="mt-3 rounded-xl p-3 space-y-3"
            style={{
              background: 'var(--admin-bg-deep)',
              border: '0.5px solid var(--admin-border)',
            }}
          >
            <div>
              <p
                style={{
                  fontFamily: 'var(--font-mono-tech)',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  color: 'var(--admin-fg-subtle)',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Categoría
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ALL_CATEGORIES.map((c) => {
                  const active = selectedCategories.includes(c)
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCategory(c)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-colors"
                      style={{
                        background: active ? 'var(--admin-gold-soft)' : 'var(--admin-bg-elev)',
                        color: active ? 'var(--admin-gold)' : 'var(--admin-fg-muted)',
                        border: `0.5px solid ${active ? 'var(--admin-gold-border, var(--admin-gold))' : 'var(--admin-border-strong)'}`,
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${CATEGORY_STRIP[c]}`} />
                      {CATEGORY_LABELS[c]}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p
                  style={{
                    fontFamily: 'var(--font-mono-tech)',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    color: 'var(--admin-fg-subtle)',
                    textTransform: 'uppercase',
                    marginBottom: 6,
                  }}
                >
                  Rango
                </p>
                <select
                  value={datePreset}
                  onChange={(e) => setDatePreset(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg"
                  style={{
                    background: 'var(--admin-bg-elev)',
                    border: '0.5px solid var(--admin-border-strong)',
                    color: 'var(--admin-fg)',
                    fontSize: 12,
                  }}
                >
                  {DATE_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p
                  style={{
                    fontFamily: 'var(--font-mono-tech)',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    color: 'var(--admin-fg-subtle)',
                    textTransform: 'uppercase',
                    marginBottom: 6,
                  }}
                >
                  Autor
                </p>
                <select
                  value={selectedActor}
                  onChange={(e) => setSelectedActor(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg"
                  style={{
                    background: 'var(--admin-bg-elev)',
                    border: '0.5px solid var(--admin-border-strong)',
                    color: 'var(--admin-fg)',
                    fontSize: 12,
                  }}
                >
                  <option value="all">Todos</option>
                  {actorOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div
          className="rounded-xl px-4 py-3 flex items-start gap-2"
          style={{
            background: 'var(--admin-red-soft)',
            border: '0.5px solid var(--admin-red)',
            color: 'var(--admin-red)',
            fontSize: 12,
          }}
        >
          <AlertCircle className="w-4 h-4 mt-0.5" /> {error}
        </div>
      )}

      {/* CONTENIDO */}
      {visibleItems.length === 0 ? (
        items.length === 0 ? (
          <EmptyState />
        ) : (
          <div
            className="rounded-2xl p-8 text-center"
            style={{
              background: 'var(--admin-panel-grad)',
              border: '0.5px dashed var(--admin-border-strong)',
            }}
          >
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--admin-fg)' }}>Sin coincidencias</p>
            <p style={{ fontSize: 12, color: 'var(--admin-fg-muted)', marginTop: 4 }}>
              Prueba quitar algún filtro o búsqueda.
            </p>
            <button
              onClick={clearFilters}
              className="mt-3 hover:underline"
              style={{ fontSize: 12, color: 'var(--admin-accent)', fontWeight: 600 }}
            >
              Limpiar filtros
            </button>
          </div>
        )
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <section key={group.key} className="space-y-2">
              <div
                className="flex items-center gap-2 sticky top-[88px] z-[5] py-1"
                style={{
                  background: 'color-mix(in srgb, var(--admin-bg) 92%, transparent)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono-tech)',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.18em',
                    color: 'var(--admin-fg-subtle)',
                    textTransform: 'uppercase',
                  }}
                >
                  {group.label}
                </span>
                <span style={{ fontSize: 10, color: 'var(--admin-fg-subtle)' }}>
                  · {group.items.length} {group.items.length === 1 ? 'evento' : 'eventos'}
                </span>
                <div className="flex-1" style={{ height: 1, background: 'var(--admin-border)' }} />
              </div>
              <ul className="space-y-2">
                {group.items.map((it) => (
                  <EventCard
                    key={it.id}
                    item={it}
                    expanded={expanded.has(it.id)}
                    onToggle={() => toggleExpanded(it.id)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {hasMore && (
        <div
          ref={sentinelRef}
          className="flex items-center justify-center py-4"
          style={{ color: 'var(--admin-fg-subtle)', fontSize: 12 }}
        >
          {loadingMore ? (
            <>
              <Loader2 className="w-3 h-3 mr-2 animate-spin" /> Cargando más eventos…
            </>
          ) : (
            <span>—</span>
          )}
        </div>
      )}
    </div>
  )
}

// ────────────── Subcomponentes ──────────────

function FilterChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full transition-opacity hover:opacity-80"
      style={{
        background: 'var(--admin-gold-soft)',
        color: 'var(--admin-gold)',
        border: '0.5px solid var(--admin-gold-border, var(--admin-gold))',
        fontFamily: 'var(--font-mono-tech)',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.05em',
      }}
    >
      {label} <X className="w-2.5 h-2.5" />
    </button>
  )
}

function EventCard({
  item,
  expanded,
  onToggle,
}: {
  item: ActivityItem
  expanded: boolean
  onToggle: () => void
}) {
  const cat = categoryKey(item.event_category)
  const title =
    (item.event_subcategory && SUBCATEGORY_LABELS_ES[item.event_subcategory]) ||
    item.event_subcategory ||
    item.action
  const created = new Date(item.created_at)
  const hasMetadata = item.metadata && Object.keys(item.metadata).length > 0

  return (
    <li
      className="group flex gap-3 rounded-2xl overflow-hidden transition-all"
      style={{
        background: 'var(--admin-panel-grad)',
        border: '0.5px solid var(--admin-border-strong)',
        boxShadow: 'var(--admin-shadow)',
      }}
    >
      <div className={`flex-shrink-0 w-1 ${CATEGORY_STRIP[cat]}`} />
      <div className="flex-1 min-w-0 py-3 pr-3">
        <div className="flex items-start gap-3">
          <div
            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
            style={{
              background: 'var(--admin-bg-elev-2)',
              border: '0.5px solid var(--admin-border-strong)',
            }}
          >
            <EventIcon subcategory={item.event_subcategory} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-fg)' }}>
                  {title}
                </p>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${CATEGORY_PILL[cat]}`}>
                  {CATEGORY_LABELS[cat]}
                </span>
                {item.visible_to_client && (
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 rounded-full"
                    style={{
                      background: 'var(--admin-green-soft)',
                      color: 'var(--admin-green)',
                      border: '0.5px solid var(--admin-green)',
                      fontFamily: 'var(--font-mono-tech)',
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.05em',
                    }}
                  >
                    VISIBLE AL CLIENTE
                  </span>
                )}
              </div>
              <span
                className="whitespace-nowrap"
                style={{
                  fontSize: 10,
                  color: 'var(--admin-fg-subtle)',
                  fontFamily: 'var(--font-mono-tech)',
                  letterSpacing: '0.05em',
                }}
                title={format(created, "d 'de' MMMM yyyy 'a las' HH:mm", { locale: es })}
              >
                {format(created, 'HH:mm')} · hace {formatDistanceToNow(created, { locale: es })}
              </span>
            </div>
            <p
              className="mt-1"
              style={{ fontSize: 12, color: 'var(--admin-fg-muted)', lineHeight: 1.6 }}
            >
              {item.description}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Avatar name={item.actor_label} role={item.actor_role} size="sm" />
              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--admin-fg-muted)' }}>
                {item.actor_label || 'Sistema'}
              </span>
              {hasMetadata && (
                <button
                  type="button"
                  onClick={onToggle}
                  className="ml-auto inline-flex items-center gap-1 transition-colors"
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'var(--admin-fg-muted)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--admin-fg)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--admin-fg-muted)' }}
                >
                  {expanded ? 'Ocultar detalles' : 'Ver detalles'}
                  {expanded ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                </button>
              )}
            </div>
            {expanded && hasMetadata && (
              <MetadataTable metadata={item.metadata} />
            )}
          </div>
        </div>
      </div>
    </li>
  )
}

function EventIcon({ subcategory }: { subcategory: string | null }) {
  const Lookup = iconForSubcategory
  const Component = Lookup(subcategory)
  // eslint-disable-next-line react-hooks/static-components
  return <Component className="w-4 h-4" style={{ color: 'var(--admin-fg-muted)' }} />
}

function MetadataTable({ metadata }: { metadata: Record<string, unknown> }) {
  const entries = Object.entries(metadata)
  return (
    <div
      className="mt-2 rounded-lg overflow-hidden"
      style={{
        background: 'var(--admin-bg-deep)',
        border: '0.5px solid var(--admin-border)',
      }}
    >
      <table className="w-full" style={{ fontSize: 10 }}>
        <tbody>
          {entries.map(([k, v]) => (
            <tr key={k} style={{ borderBottom: '0.5px solid var(--admin-border)' }}>
              <td
                className="px-3 py-1.5 whitespace-nowrap align-top w-1/3"
                style={{
                  fontFamily: 'var(--font-mono-tech)',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  color: 'var(--admin-fg-subtle)',
                  textTransform: 'uppercase',
                }}
              >
                {k.replace(/_/g, ' ')}
              </td>
              <td
                className="px-3 py-1.5 break-all"
                style={{
                  fontFamily: 'var(--font-mono-tech)',
                  fontSize: 10,
                  color: 'var(--admin-fg)',
                }}
              >
                {formatValue(v)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'sí' : 'no'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function EmptyState() {
  return (
    <div
      className="rounded-2xl p-10 text-center"
      style={{
        background: 'var(--admin-panel-grad)',
        border: '0.5px dashed var(--admin-border-strong)',
        boxShadow: 'var(--admin-shadow)',
      }}
    >
      <div
        className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4"
        style={{
          background: 'var(--admin-blue-soft)',
          border: '0.5px solid var(--admin-blue)',
        }}
      >
        <Clock className="w-7 h-7" style={{ color: 'var(--admin-blue)' }} />
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--admin-fg)' }}>
        Sin eventos registrados
      </h3>
      <p
        className="mt-1 mx-auto"
        style={{ fontSize: 13, color: 'var(--admin-fg-muted)', maxWidth: '44ch', lineHeight: 1.5 }}
      >
        Cuando ocurran acciones en este caso (firma de contrato, citas,
        documentos, cambios de fase, notas), aparecerán aquí ordenadas cronológicamente.
      </p>
    </div>
  )
}
