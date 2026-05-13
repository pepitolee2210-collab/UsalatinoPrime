'use client'

// Bitácora del caso: timeline cronológico con filtros y paginación
// cursor-based via IntersectionObserver (infinite scroll).
//
// Renderiza eventos registrados en `case_activity` (vía endpoint
// /api/admin/cases/[id]/activity). Compartido entre admin y employee.

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
  ChevronDown,
  ChevronRight,
  Filter,
} from 'lucide-react'
import type {
  CaseActivityCategory,
  CaseActivityActorRole,
} from '@/types/database'

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

// ─────────────────────────── Tablas de presentación ───────────────────────────

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

const CATEGORY_DOT: Record<CaseActivityCategory | 'unknown', string> = {
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

const CATEGORY_RING: Record<CaseActivityCategory | 'unknown', string> = {
  case: 'ring-purple-100',
  contract: 'ring-blue-100',
  appointment: 'ring-emerald-100',
  document: 'ring-amber-100',
  form: 'ring-indigo-100',
  payment: 'ring-green-100',
  system: 'ring-slate-100',
  communication: 'ring-cyan-100',
  unknown: 'ring-gray-100',
}

const ACTOR_BADGE: Record<CaseActivityActorRole, string> = {
  admin: 'bg-indigo-100 text-indigo-700',
  employee: 'bg-[#F2A900]/15 text-[#9a6500]',
  client: 'bg-gray-100 text-gray-700',
  system: 'bg-slate-100 text-slate-600',
}

const ACTOR_ROLE_LABEL: Record<CaseActivityActorRole, string> = {
  admin: 'Admin',
  employee: 'Staff',
  client: 'Cliente',
  system: 'Sistema',
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
    case 'case.created':
      return Briefcase
    case 'case.phase_changed':
      return ArrowRightLeft
    case 'case.employee_assigned':
      return UserPlus
    case 'contract.generated':
      return FileSignature
    case 'contract.signing_link_created':
      return LinkIcon
    case 'contract.signed':
      return PenTool
    case 'appointment.scheduled':
      return Calendar
    case 'appointment.rescheduled':
      return ArrowRightLeft
    case 'appointment.cancelled':
    case 'appointment.no_show':
      return CalendarX
    case 'appointment.completed':
      return CalendarCheck
    case 'document.uploaded_by_client':
    case 'document.uploaded_by_staff':
      return Upload
    case 'document.approved':
      return FileCheck2
    case 'document.rejected':
      return FileX2
    case 'document.delivered_to_client':
      return FileBadge
    case 'document.archived':
      return FileText
    case 'form.pdf_generated':
    case 'form.submitted_by_client':
    case 'form.locked_for_print':
      return FileText
    case 'payment.marked_paid':
    case 'payment.plan_created':
      return DollarSign
    case 'system.access_toggled':
    case 'system.intake_status_changed':
    case 'case.status_changed':
    case 'case.note_updated':
      return Settings
    default:
      return Clock
  }
}

function categoryKey(c: CaseActivityCategory | null): CaseActivityCategory | 'unknown' {
  return c ?? 'unknown'
}

const ALL_CATEGORIES: CaseActivityCategory[] = [
  'case',
  'contract',
  'appointment',
  'document',
  'form',
  'payment',
  'system',
  'communication',
]

const DATE_PRESETS: { id: string; label: string; days: number | null }[] = [
  { id: 'all', label: 'Todo', days: null },
  { id: '7d', label: 'Últimos 7 días', days: 7 },
  { id: '30d', label: 'Últimos 30 días', days: 30 },
  { id: '90d', label: 'Últimos 90 días', days: 90 },
]

// ─────────────────────────── Componente ───────────────────────────

export function BitacoraTab({ caseId }: BitacoraTabProps) {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Filtros.
  const [selectedCategories, setSelectedCategories] = useState<CaseActivityCategory[]>([])
  const [selectedActor, setSelectedActor] = useState<string>('all')
  const [datePreset, setDatePreset] = useState<string>('all')
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

  // Carga inicial / al cambiar filtros.
  // Los setState están dentro del callback async para evitar el
  // patrón síncrono que dispara el lint react-hooks/avoid-direct-set-state-in-effect.
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

  // Infinite scroll.
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

  // Lista de actores únicos del fetch actual para el filtro.
  const actorOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const it of items) {
      if (it.actor_id && it.actor_label) {
        map.set(it.actor_id, it.actor_label)
      }
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }))
  }, [items])

  const toggleCategory = (c: CaseActivityCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    )
  }

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-4">
      {/* Header con filtros */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Filter className="w-4 h-4 text-gray-500" />
            Filtros
            {(selectedCategories.length > 0 || selectedActor !== 'all' || datePreset !== 'all') && (
              <span className="text-[10px] bg-[#F2A900]/15 text-[#9a6500] px-2 py-0.5 rounded-full">
                activos
              </span>
            )}
          </span>
          {showFilters ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
        </button>
        {showFilters && (
          <div className="px-4 pb-3 border-t border-gray-100 space-y-3 pt-3">
            <div>
              <p className="text-[10px] font-bold uppercase text-gray-500 mb-1.5">Tipo de evento</p>
              <div className="flex flex-wrap gap-1.5">
                {ALL_CATEGORIES.map((c) => {
                  const active = selectedCategories.includes(c)
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCategory(c)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                        active
                          ? 'border-[#F2A900] bg-[#F2A900]/10 text-[#9a6500]'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle ${CATEGORY_DOT[c]}`} />
                      {CATEGORY_LABELS[c]}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase text-gray-500 mb-1.5">Rango</p>
                <select
                  value={datePreset}
                  onChange={(e) => setDatePreset(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-white"
                >
                  {DATE_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-gray-500 mb-1.5">Autor</p>
                <select
                  value={selectedActor}
                  onChange={(e) => setSelectedActor(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-white"
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
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {loadingInitial ? (
        <div className="flex items-center justify-center py-10 text-gray-400 text-sm">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Cargando bitácora...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center">
          <Clock className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-gray-700">Sin eventos registrados</p>
          <p className="text-xs text-gray-500 mt-1">
            Cuando ocurran acciones en este caso (firma de contrato, citas, documentos, cambios de fase),
            aparecerán aquí.
          </p>
        </div>
      ) : (
        <ol className="relative pl-6 space-y-3 border-l-2 border-gray-200">
          {items.map((it) => {
            const cat = categoryKey(it.event_category)
            const Icon = iconForSubcategory(it.event_subcategory)
            const title =
              (it.event_subcategory && SUBCATEGORY_LABELS_ES[it.event_subcategory]) ||
              it.event_subcategory ||
              it.action
            const role = it.actor_role ?? 'system'
            const isOpen = expanded.has(it.id)
            const created = new Date(it.created_at)
            return (
              <li key={it.id} className="relative">
                <span
                  className={`absolute -left-[31px] top-2 w-4 h-4 rounded-full ring-4 ring-white ${CATEGORY_DOT[cat]} ${CATEGORY_RING[cat]}`}
                />
                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <div className="flex items-start gap-3">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${CATEGORY_DOT[cat]} bg-opacity-15`}>
                      <Icon className="w-4 h-4 text-gray-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{title}</p>
                        <span className="text-[10px] text-gray-500 whitespace-nowrap">
                          {format(created, "d MMM yyyy 'a las' HH:mm", { locale: es })}
                        </span>
                      </div>
                      <p className="text-xs text-gray-700 mt-0.5">{it.description}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${ACTOR_BADGE[role]}`}>
                          {it.actor_label ?? ACTOR_ROLE_LABEL[role]}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          hace {formatDistanceToNow(created, { locale: es })}
                        </span>
                        {it.visible_to_client && (
                          <span className="text-[10px] text-emerald-600">Visible al cliente</span>
                        )}
                        {it.metadata && Object.keys(it.metadata).length > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleExpanded(it.id)}
                            className="ml-auto text-[10px] text-gray-500 hover:text-gray-700 flex items-center gap-1"
                          >
                            {isOpen ? 'Ocultar' : 'Detalles'}
                            {isOpen ? (
                              <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronRight className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                      {isOpen && it.metadata && Object.keys(it.metadata).length > 0 && (
                        <pre className="mt-2 p-2 bg-gray-50 rounded-lg text-[10px] text-gray-700 overflow-auto max-h-60">
                          {JSON.stringify(it.metadata, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {/* Sentinel para infinite scroll */}
      {hasMore && (
        <div ref={sentinelRef} className="flex items-center justify-center py-4 text-gray-400 text-xs">
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
