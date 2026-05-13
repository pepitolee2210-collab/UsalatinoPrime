'use client'

// NotesTab v2 — UX profesional:
//   - Header sticky con acción primaria prominente
//   - Avatares con iniciales por autor
//   - Agrupación cronológica (Hoy / Ayer / Esta semana / Mes pasado…)
//   - Tarjetas con strip de color por categoría
//   - Empty state ilustrado con CTA
//   - Filtros como chips removibles
//   - Modal de editor con preview de carácter

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Loader2,
  StickyNote,
  Plus,
  X,
  Filter,
  Edit3,
  Trash2,
  Save,
  Calendar,
  AlertCircle,
  Sparkles,
  Search,
} from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type {
  CaseNoteCategory,
  CaseNoteAuthorRole,
} from '@/types/database'
import { Avatar, groupByDate } from './_ui-helpers'

interface NoteItem {
  id: string
  case_id: string
  appointment_id: string | null
  author_id: string | null
  author_role: CaseNoteAuthorRole
  author_label: string
  category: CaseNoteCategory
  body: string
  visible_to_client: boolean
  created_at: string
  updated_at: string
}

interface AppointmentLite {
  id: string
  scheduled_at: string
  session_number: number | null
  status: string
}

interface ApiResponse {
  items: NoteItem[]
  nextCursor: string | null
}

interface NotesTabProps {
  caseId: string
  currentUserId: string
  isAdmin: boolean
}

const CATEGORY_LABELS: Record<CaseNoteCategory, string> = {
  general: 'General',
  session: 'Sesión',
  followup: 'Seguimiento',
  internal: 'Interna',
  legacy: 'Histórica',
}

// Strip color (left edge) por categoría
const CATEGORY_STRIP: Record<CaseNoteCategory, string> = {
  general: 'bg-slate-400',
  session: 'bg-emerald-500',
  followup: 'bg-amber-500',
  internal: 'bg-violet-500',
  legacy: 'bg-gray-300',
}

const CATEGORY_PILL: Record<CaseNoteCategory, string> = {
  general: 'bg-slate-50 text-slate-700 ring-1 ring-slate-200',
  session: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  followup: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
  internal: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  legacy: 'bg-gray-50 text-gray-500 ring-1 ring-gray-200',
}

const ALL_CATEGORIES: CaseNoteCategory[] = ['general', 'session', 'followup', 'internal', 'legacy']

const DATE_PRESETS: { id: string; label: string; days: number | null }[] = [
  { id: 'all', label: 'Todo el tiempo', days: null },
  { id: '7d', label: 'Últimos 7 días', days: 7 },
  { id: '30d', label: 'Últimos 30 días', days: 30 },
  { id: '90d', label: 'Últimos 90 días', days: 90 },
]

export function NotesTab({ caseId, currentUserId, isAdmin }: NotesTabProps) {
  const [items, setItems] = useState<NoteItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [appointments, setAppointments] = useState<AppointmentLite[]>([])

  // Filtros
  const [showFilters, setShowFilters] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<CaseNoteCategory[]>([])
  const [selectedAuthor, setSelectedAuthor] = useState<string>('all')
  const [datePreset, setDatePreset] = useState<string>('all')
  const [searchText, setSearchText] = useState('')

  // Editor
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null)
  const [draftBody, setDraftBody] = useState('')
  const [draftCategory, setDraftCategory] = useState<CaseNoteCategory>('general')
  const [draftAppointmentId, setDraftAppointmentId] = useState<string>('')
  const [saving, setSaving] = useState(false)

  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const fromIso = useMemo(() => {
    const preset = DATE_PRESETS.find((p) => p.id === datePreset)
    if (!preset?.days) return null
    const d = new Date()
    d.setDate(d.getDate() - preset.days)
    return d.toISOString()
  }, [datePreset])

  const fetchAppointments = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/cases/${caseId}/appointments-lite`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setAppointments(data.items ?? [])
      }
    } catch {
      // best effort
    }
  }, [caseId])

  const fetchPage = useCallback(
    async (opts: { reset: boolean; cursor: string | null }) => {
      const params = new URLSearchParams()
      if (selectedCategories.length > 0) params.set('category', selectedCategories.join(','))
      if (selectedAuthor !== 'all') params.set('author', selectedAuthor)
      if (fromIso) params.set('from', fromIso)
      if (opts.cursor) params.set('cursor', opts.cursor)

      const res = await fetch(
        `/api/admin/cases/${caseId}/notes?${params.toString()}`,
        { cache: 'no-store' },
      )
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Error al cargar las notas')
      }
      const data = (await res.json()) as ApiResponse
      setItems((prev) => (opts.reset ? data.items : [...prev, ...data.items]))
      setCursor(data.nextCursor)
      setHasMore(!!data.nextCursor)
    },
    [caseId, selectedCategories, selectedAuthor, fromIso],
  )

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoadingInitial(true)
      setError(null)
      try {
        await Promise.all([fetchPage({ reset: true, cursor: null }), fetchAppointments()])
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
  }, [fetchPage, fetchAppointments])

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

  // Búsqueda en cliente (sobre el set ya cargado)
  const visibleItems = useMemo(() => {
    if (!searchText.trim()) return items
    const q = searchText.toLowerCase()
    return items.filter(
      (it) =>
        it.body.toLowerCase().includes(q) ||
        it.author_label.toLowerCase().includes(q),
    )
  }, [items, searchText])

  const grouped = useMemo(
    () => groupByDate(visibleItems, (n) => new Date(n.created_at)),
    [visibleItems],
  )

  const authorOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const it of items) {
      if (it.author_id && it.author_label) map.set(it.author_id, it.author_label)
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }))
  }, [items])

  const activeFilterCount =
    selectedCategories.length +
    (selectedAuthor !== 'all' ? 1 : 0) +
    (datePreset !== 'all' ? 1 : 0)

  const toggleCategory = (c: CaseNoteCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    )
  }

  function clearFilters() {
    setSelectedCategories([])
    setSelectedAuthor('all')
    setDatePreset('all')
    setSearchText('')
  }

  function openNewNote(prefillApptId?: string) {
    setEditingNote(null)
    setDraftBody('')
    setDraftCategory(prefillApptId ? 'session' : 'general')
    setDraftAppointmentId(prefillApptId ?? '')
    setEditorOpen(true)
  }

  function openEdit(note: NoteItem) {
    setEditingNote(note)
    setDraftBody(note.body)
    setDraftCategory(note.category)
    setDraftAppointmentId(note.appointment_id ?? '')
    setEditorOpen(true)
  }

  function closeEditor() {
    if (draftBody.trim().length > 0 && !saving && !editingNote) {
      if (!window.confirm('Tienes cambios sin guardar. ¿Cerrar?')) return
    }
    setEditorOpen(false)
    setEditingNote(null)
    setDraftBody('')
    setDraftAppointmentId('')
  }

  async function handleSave() {
    const body = draftBody.trim()
    if (!body) {
      toast.error('La nota no puede estar vacía')
      return
    }
    if (body.length > 8000) {
      toast.error('La nota es demasiado larga (máx 8000 caracteres)')
      return
    }
    setSaving(true)
    try {
      if (editingNote) {
        const res = await fetch(
          `/api/admin/cases/${caseId}/notes/${editingNote.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ body, category: draftCategory }),
          },
        )
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error || 'Error al actualizar')
        }
        const j = await res.json()
        setItems((prev) => prev.map((n) => (n.id === editingNote.id ? j.note : n)))
        toast.success('Nota actualizada')
      } else {
        const res = await fetch(`/api/admin/cases/${caseId}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            body,
            category: draftCategory,
            appointment_id: draftAppointmentId || undefined,
          }),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error || 'Error al guardar')
        }
        const j = await res.json()
        setItems((prev) => [j.note, ...prev])
        toast.success('Nota guardada')
      }
      setEditorOpen(false)
      setEditingNote(null)
      setDraftBody('')
      setDraftAppointmentId('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(note: NoteItem) {
    if (!window.confirm('¿Eliminar esta nota? Esta acción solo Henry puede revertirla.')) return
    try {
      const res = await fetch(`/api/admin/cases/${caseId}/notes/${note.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Error al eliminar')
      }
      setItems((prev) => prev.filter((n) => n.id !== note.id))
      toast.success('Nota eliminada')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar')
    }
  }

  // ────────────── Render ──────────────

  if (loadingInitial) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
        Cargando notas del caso...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* HEADER — sticky con acción primaria + búsqueda + filtros */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm -mx-1 px-1 py-2 border-b border-gray-100">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            onClick={() => openNewNote()}
            className="bg-[#002855] hover:bg-[#001f44] text-white shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Nueva nota
          </Button>
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Buscar texto o autor..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#F2A900]/30"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
              activeFilterCount > 0
                ? 'border-[#F2A900] bg-[#F2A900]/10 text-[#9a6500]'
                : 'border-gray-200 hover:bg-gray-50 text-gray-700'
            }`}
          >
            <Filter className="w-3.5 h-3.5" /> Filtros
            {activeFilterCount > 0 && (
              <span className="text-[10px] bg-[#F2A900] text-white px-1.5 py-0.5 rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Chips de filtros activos */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {selectedCategories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => toggleCategory(c)}
                className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#F2A900]/10 text-[#9a6500] hover:bg-[#F2A900]/20"
              >
                {CATEGORY_LABELS[c]} <X className="w-2.5 h-2.5" />
              </button>
            ))}
            {selectedAuthor !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedAuthor('all')}
                className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#F2A900]/10 text-[#9a6500] hover:bg-[#F2A900]/20"
              >
                {authorOptions.find((a) => a.id === selectedAuthor)?.label || 'Autor'}{' '}
                <X className="w-2.5 h-2.5" />
              </button>
            )}
            {datePreset !== 'all' && (
              <button
                type="button"
                onClick={() => setDatePreset('all')}
                className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#F2A900]/10 text-[#9a6500] hover:bg-[#F2A900]/20"
              >
                {DATE_PRESETS.find((p) => p.id === datePreset)?.label} <X className="w-2.5 h-2.5" />
              </button>
            )}
            <button
              type="button"
              onClick={clearFilters}
              className="text-[10px] text-gray-500 hover:text-red-500 underline underline-offset-2 ml-1"
            >
              Limpiar
            </button>
          </div>
        )}

        {showFilters && (
          <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
            <div>
              <p className="text-[10px] font-bold uppercase text-gray-500 mb-1.5 tracking-wider">Categoría</p>
              <div className="flex flex-wrap gap-1.5">
                {ALL_CATEGORIES.map((c) => {
                  const active = selectedCategories.includes(c)
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCategory(c)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                        active
                          ? 'border-[#F2A900] bg-[#F2A900]/10 text-[#9a6500]'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
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
                <p className="text-[10px] font-bold uppercase text-gray-500 mb-1.5 tracking-wider">Rango</p>
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
                <p className="text-[10px] font-bold uppercase text-gray-500 mb-1.5 tracking-wider">Autor</p>
                <select
                  value={selectedAuthor}
                  onChange={(e) => setSelectedAuthor(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-white"
                >
                  <option value="all">Todos</option>
                  {authorOptions.map((a) => (
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
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5" /> {error}
        </div>
      )}

      {/* CONTENIDO */}
      {visibleItems.length === 0 ? (
        items.length === 0 ? (
          <EmptyState onCreate={() => openNewNote()} />
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center">
            <p className="text-sm font-semibold text-gray-700">Sin coincidencias</p>
            <p className="text-xs text-gray-500 mt-1">Prueba quitar algún filtro o búsqueda.</p>
            <button onClick={clearFilters} className="mt-3 text-xs text-[#002855] hover:underline">
              Limpiar filtros
            </button>
          </div>
        )
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <section key={group.key} className="space-y-2">
              <div className="flex items-center gap-2 sticky top-[88px] z-[5] bg-white/95 backdrop-blur py-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  {group.label}
                </span>
                <span className="text-[10px] text-gray-400">
                  · {group.items.length} {group.items.length === 1 ? 'nota' : 'notas'}
                </span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              <ul className="space-y-2">
                {group.items.map((it) => (
                  <NoteCard
                    key={it.id}
                    note={it}
                    appointments={appointments}
                    currentUserId={currentUserId}
                    isAdmin={isAdmin}
                    onEdit={() => openEdit(it)}
                    onDelete={() => handleDelete(it)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {hasMore && (
        <div ref={sentinelRef} className="flex items-center justify-center py-4 text-gray-400 text-xs">
          {loadingMore ? (
            <>
              <Loader2 className="w-3 h-3 mr-2 animate-spin" /> Cargando más notas…
            </>
          ) : (
            <span>—</span>
          )}
        </div>
      )}

      {/* Editor modal */}
      {editorOpen && (
        <EditorModal
          editingNote={editingNote}
          draftBody={draftBody}
          setDraftBody={setDraftBody}
          draftCategory={draftCategory}
          setDraftCategory={setDraftCategory}
          draftAppointmentId={draftAppointmentId}
          setDraftAppointmentId={setDraftAppointmentId}
          appointments={appointments}
          saving={saving}
          onClose={closeEditor}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

// ────────────── Subcomponentes ──────────────

function NoteCard({
  note,
  appointments,
  currentUserId,
  isAdmin,
  onEdit,
  onDelete,
}: {
  note: NoteItem
  appointments: AppointmentLite[]
  currentUserId: string
  isAdmin: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const created = new Date(note.created_at)
  const updated = new Date(note.updated_at)
  const wasEdited = updated.getTime() - created.getTime() > 5000
  const linkedAppt = note.appointment_id
    ? appointments.find((a) => a.id === note.appointment_id)
    : null
  const canEdit = (note.author_id === currentUserId || isAdmin) && note.category !== 'legacy'

  return (
    <li className="group relative flex gap-3 rounded-xl border border-gray-200 bg-white overflow-hidden transition-shadow hover:shadow-sm">
      {/* Strip de color por categoría */}
      <div className={`flex-shrink-0 w-1 ${CATEGORY_STRIP[note.category]}`} />
      <div className="flex-1 min-w-0 py-3 pr-3">
        <div className="flex items-start gap-3">
          <Avatar name={note.author_label} role={note.author_role} size="md" />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-gray-900">{note.author_label}</p>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${CATEGORY_PILL[note.category]}`}>
                  {CATEGORY_LABELS[note.category]}
                </span>
                {linkedAppt && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-200 inline-flex items-center gap-1">
                    <Calendar className="w-2.5 h-2.5" />
                    Sesión #{linkedAppt.session_number ?? '?'}
                  </span>
                )}
              </div>
              <span
                className="text-[10px] text-gray-400 whitespace-nowrap"
                title={format(created, "d 'de' MMMM yyyy 'a las' HH:mm", { locale: es })}
              >
                {format(created, 'd MMM · HH:mm', { locale: es })}
                {wasEdited && (
                  <span className="ml-1 italic">· editada</span>
                )}
              </span>
            </div>
            <p className="text-sm text-gray-800 mt-1.5 whitespace-pre-wrap leading-relaxed">{note.body}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] text-gray-400">
                hace {formatDistanceToNow(created, { locale: es })}
              </span>
              {canEdit && (
                <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={onEdit}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-gray-600 hover:bg-gray-100"
                    aria-label="Editar nota"
                  >
                    <Edit3 className="w-3 h-3" /> Editar
                  </button>
                  <button
                    type="button"
                    onClick={onDelete}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-red-500 hover:bg-red-50"
                    aria-label="Eliminar nota"
                  >
                    <Trash2 className="w-3 h-3" /> Eliminar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </li>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gradient-to-b from-white to-gray-50 p-10 text-center">
      <div className="w-16 h-16 mx-auto rounded-full bg-[#F2A900]/10 flex items-center justify-center mb-4">
        <StickyNote className="w-7 h-7 text-[#F2A900]" />
      </div>
      <h3 className="text-base font-bold text-gray-900">Sin notas todavía</h3>
      <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
        Las notas son visibles para Diana, Vanessa, Andrium y Henry. Crea una general
        del caso o asóciala a una cita específica.
      </p>
      <div className="flex items-center justify-center gap-2 mt-5">
        <Button type="button" onClick={onCreate} className="bg-[#002855] hover:bg-[#001f44] text-white">
          <Plus className="w-4 h-4 mr-1.5" /> Crear primera nota
        </Button>
      </div>
      <p className="text-[10px] text-gray-400 mt-3 inline-flex items-center gap-1">
        <Sparkles className="w-3 h-3" />
        Toda nota queda registrada también en la Bitácora del caso
      </p>
    </div>
  )
}

function EditorModal({
  editingNote,
  draftBody,
  setDraftBody,
  draftCategory,
  setDraftCategory,
  draftAppointmentId,
  setDraftAppointmentId,
  appointments,
  saving,
  onClose,
  onSave,
}: {
  editingNote: NoteItem | null
  draftBody: string
  setDraftBody: (v: string) => void
  draftCategory: CaseNoteCategory
  setDraftCategory: (v: CaseNoteCategory) => void
  draftAppointmentId: string
  setDraftAppointmentId: (v: string) => void
  appointments: AppointmentLite[]
  saving: boolean
  onClose: () => void
  onSave: () => void
}) {
  const len = draftBody.length
  const counterColor =
    len > 7500 ? 'text-red-600 font-semibold' :
    len > 5000 ? 'text-amber-600' :
    'text-gray-400'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-bold text-gray-900 text-base">
              {editingNote ? 'Editar nota' : 'Nueva nota'}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Visible para todo el staff. No se sobrescribe nada.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1.5 tracking-wider">
              Tipo de nota
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['general', 'session', 'followup', 'internal'] as CaseNoteCategory[]).map((c) => {
                const active = draftCategory === c
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setDraftCategory(c)}
                    disabled={!!editingNote && editingNote.category === 'legacy'}
                    className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg border text-[11px] font-medium transition-colors ${
                      active
                        ? 'border-[#002855] bg-[#002855]/5 text-[#002855]'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className={`inline-block w-2 h-2 rounded-full ${CATEGORY_STRIP[c]}`} />
                    {CATEGORY_LABELS[c]}
                  </button>
                )
              })}
            </div>
          </div>
          {!editingNote && (
            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1.5 tracking-wider">
                Asociar a una cita (opcional)
              </label>
              <select
                value={draftAppointmentId}
                onChange={(e) => setDraftAppointmentId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white"
              >
                <option value="">— Nota general del caso —</option>
                {appointments.map((a) => (
                  <option key={a.id} value={a.id}>
                    Sesión #{a.session_number ?? '?'} · {format(new Date(a.scheduled_at), "d MMM yyyy 'a las' HH:mm", { locale: es })} · {a.status}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">
                Nota
              </label>
              <span className={`text-[10px] tabular-nums ${counterColor}`}>
                {len.toLocaleString('es-MX')} / 8,000
              </span>
            </div>
            <Textarea
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              rows={8}
              placeholder="Escribe la nota — Diana, Vanessa, Andrium y Henry podrán verla en este mismo lugar."
              className="text-sm resize-none"
              autoFocus
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancelar
          </button>
          <Button
            type="button"
            onClick={onSave}
            disabled={saving || !draftBody.trim()}
            className="bg-[#002855] hover:bg-[#001f44] text-white"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
            {editingNote ? 'Guardar cambios' : 'Crear nota'}
          </Button>
        </div>
      </div>
    </div>
  )
}
