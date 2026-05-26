'use client'

// NotesTab v3 — 2 categorías (general/session derivadas) + flag is_pinned:
//   - El usuario NO elige categoría manualmente — se deriva del appointment_id
//   - Botón Pin/Desfijar en cada tarjeta (visible en hover)
//   - Sección "Fijadas" sticky arriba del feed (ignora filtros)
//   - Resto agrupado por fecha (Hoy/Ayer/Esta semana/mes anterior)

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
  Pin,
  PinOff,
} from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
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
  is_pinned: boolean
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
  pinned: NoteItem[]
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
  legacy: 'Histórica',
}

const CATEGORY_STRIP: Record<CaseNoteCategory, string> = {
  general: 'bg-slate-400',
  session: 'bg-emerald-500',
  legacy: 'bg-gray-300',
}

const CATEGORY_PILL: Record<CaseNoteCategory, string> = {
  general: 'bg-slate-50 text-slate-700 ring-1 ring-slate-200',
  session: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  legacy: 'bg-gray-50 text-gray-500 ring-1 ring-gray-200',
}

const ALL_CATEGORIES: CaseNoteCategory[] = ['general', 'session', 'legacy']

const DATE_PRESETS: { id: string; label: string; days: number | null }[] = [
  { id: 'all', label: 'Todo el tiempo', days: null },
  { id: '7d', label: 'Últimos 7 días', days: 7 },
  { id: '30d', label: 'Últimos 30 días', days: 30 },
  { id: '90d', label: 'Últimos 90 días', days: 90 },
]

export function NotesTab({ caseId, currentUserId, isAdmin }: NotesTabProps) {
  const [items, setItems] = useState<NoteItem[]>([])
  const [pinned, setPinned] = useState<NoteItem[]>([])
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
      if (opts.reset) setPinned(data.pinned ?? [])
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

  // Búsqueda en cliente (aplica a items NO fijadas; las fijadas siempre se muestran)
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
    for (const it of [...items, ...pinned]) {
      if (it.author_id && it.author_label) map.set(it.author_id, it.author_label)
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }))
  }, [items, pinned])

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
    setDraftAppointmentId(prefillApptId ?? '')
    setEditorOpen(true)
  }

  function openEdit(note: NoteItem) {
    setEditingNote(note)
    setDraftBody(note.body)
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
            body: JSON.stringify({ body }),
          },
        )
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error || 'Error al actualizar')
        }
        const j = await res.json()
        // Actualizar en items o pinned según corresponda
        setItems((prev) => prev.map((n) => (n.id === editingNote.id ? j.note : n)))
        setPinned((prev) => prev.map((n) => (n.id === editingNote.id ? j.note : n)))
        toast.success('Nota actualizada')
      } else {
        const res = await fetch(`/api/admin/cases/${caseId}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            body,
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
      setPinned((prev) => prev.filter((n) => n.id !== note.id))
      toast.success('Nota eliminada')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar')
    }
  }

  async function handleTogglePin(note: NoteItem) {
    const newValue = !note.is_pinned
    // Optimistic update: mover entre items y pinned
    if (newValue) {
      setPinned((prev) => [{ ...note, is_pinned: true }, ...prev])
      setItems((prev) => prev.filter((n) => n.id !== note.id))
    } else {
      setItems((prev) => [{ ...note, is_pinned: false }, ...prev].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ))
      setPinned((prev) => prev.filter((n) => n.id !== note.id))
    }
    try {
      const res = await fetch(`/api/admin/cases/${caseId}/notes/${note.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_pinned: newValue }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Error al actualizar el pin')
      }
      toast.success(newValue ? 'Nota fijada' : 'Nota desfijada')
    } catch (err) {
      // Revertir optimistic update
      if (newValue) {
        setItems((prev) => [{ ...note, is_pinned: false }, ...prev])
        setPinned((prev) => prev.filter((n) => n.id !== note.id))
      } else {
        setPinned((prev) => [{ ...note, is_pinned: true }, ...prev])
        setItems((prev) => prev.filter((n) => n.id !== note.id))
      }
      toast.error(err instanceof Error ? err.message : 'Error al actualizar el pin')
    }
  }

  // ────────────── Render ──────────────

  if (loadingInitial) {
    return (
      <div
        className="flex items-center justify-center py-16"
        style={{ color: 'var(--admin-fg-muted)', fontSize: 13 }}
      >
        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
        Cargando notas del caso...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div
        className="sticky top-0 z-10 -mx-1 px-1 py-2"
        style={{
          background: 'color-mix(in srgb, var(--admin-bg) 90%, transparent)',
          backdropFilter: 'blur(8px)',
          borderBottom: '0.5px solid var(--admin-border)',
        }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => openNewNote()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full transition-all hover:opacity-90 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, var(--admin-accent), var(--admin-blue))',
              color: '#FFFFFF',
              border: '0.5px solid rgba(255,255,255,0.2)',
              boxShadow: '0 8px 18px rgba(30,78,154,0.2)',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <Plus className="w-4 h-4" /> Nueva nota
          </button>
          <div className="relative flex-1 min-w-[180px]">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
              style={{ color: 'var(--admin-fg-subtle)' }}
            />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Buscar texto o autor..."
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
        </div>

        {activeFilterCount > 0 && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {selectedCategories.map((c) => (
              <FilterChip key={c} onClick={() => toggleCategory(c)} label={CATEGORY_LABELS[c]} />
            ))}
            {selectedAuthor !== 'all' && (
              <FilterChip
                onClick={() => setSelectedAuthor('all')}
                label={authorOptions.find((a) => a.id === selectedAuthor)?.label || 'Autor'}
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
                  value={selectedAuthor}
                  onChange={(e) => setSelectedAuthor(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg"
                  style={{
                    background: 'var(--admin-bg-elev)',
                    border: '0.5px solid var(--admin-border-strong)',
                    color: 'var(--admin-fg)',
                    fontSize: 12,
                  }}
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

      {/* SECCIÓN FIJADAS — siempre arriba, ignora filtros */}
      {pinned.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <Pin className="w-3.5 h-3.5 fill-current" style={{ color: 'var(--admin-gold)' }} />
            <span
              style={{
                fontFamily: 'var(--font-mono-tech)',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.18em',
                color: 'var(--admin-gold)',
                textTransform: 'uppercase',
              }}
            >
              Fijadas · {pinned.length}
            </span>
            <div
              className="flex-1"
              style={{ height: 1, background: 'linear-gradient(90deg, var(--admin-gold-soft), transparent)' }}
            />
          </div>
          <ul className="space-y-2">
            {pinned.map((it) => (
              <NoteCard
                key={it.id}
                note={it}
                appointments={appointments}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                onEdit={() => openEdit(it)}
                onDelete={() => handleDelete(it)}
                onTogglePin={() => handleTogglePin(it)}
              />
            ))}
          </ul>
        </section>
      )}

      {/* RESTO — agrupado cronológicamente */}
      {visibleItems.length === 0 && pinned.length === 0 ? (
        items.length === 0 ? (
          <EmptyState onCreate={() => openNewNote()} />
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
      ) : visibleItems.length > 0 ? (
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
                  · {group.items.length} {group.items.length === 1 ? 'nota' : 'notas'}
                </span>
                <div className="flex-1" style={{ height: 1, background: 'var(--admin-border)' }} />
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
                    onTogglePin={() => handleTogglePin(it)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}

      {hasMore && (
        <div
          ref={sentinelRef}
          className="flex items-center justify-center py-4"
          style={{ color: 'var(--admin-fg-subtle)', fontSize: 12 }}
        >
          {loadingMore ? (
            <>
              <Loader2 className="w-3 h-3 mr-2 animate-spin" /> Cargando más notas…
            </>
          ) : (
            <span>—</span>
          )}
        </div>
      )}

      {editorOpen && (
        <EditorModal
          editingNote={editingNote}
          draftBody={draftBody}
          setDraftBody={setDraftBody}
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

function NoteCard({
  note,
  appointments,
  currentUserId,
  isAdmin,
  onEdit,
  onDelete,
  onTogglePin,
}: {
  note: NoteItem
  appointments: AppointmentLite[]
  currentUserId: string
  isAdmin: boolean
  onEdit: () => void
  onDelete: () => void
  onTogglePin: () => void
}) {
  const created = new Date(note.created_at)
  const updated = new Date(note.updated_at)
  const wasEdited = updated.getTime() - created.getTime() > 5000
  const linkedAppt = note.appointment_id
    ? appointments.find((a) => a.id === note.appointment_id)
    : null
  const canEdit = (note.author_id === currentUserId || isAdmin) && note.category !== 'legacy'
  const canPin = note.category !== 'legacy'

  return (
    <li
      className="group relative flex gap-3 rounded-2xl overflow-hidden transition-all"
      style={{
        background: 'var(--admin-panel-grad)',
        border: `0.5px solid ${note.is_pinned ? 'var(--admin-gold-border, var(--admin-gold))' : 'var(--admin-border-strong)'}`,
        boxShadow: note.is_pinned
          ? 'var(--admin-shadow-gold, 0 6px 16px rgba(216,155,29,0.18))'
          : 'var(--admin-shadow)',
      }}
    >
      <div className={`flex-shrink-0 w-1 ${CATEGORY_STRIP[note.category]}`} />
      <div className="flex-1 min-w-0 py-3 pr-3">
        <div className="flex items-start gap-3">
          <Avatar name={note.author_label} role={note.author_role} size="md" />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-fg)' }}>
                  {note.author_label}
                </p>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${CATEGORY_PILL[note.category]}`}>
                  {CATEGORY_LABELS[note.category]}
                </span>
                {note.is_pinned && (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full"
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
                    <Pin className="w-2.5 h-2.5 fill-current" /> FIJADA
                  </span>
                )}
                {linkedAppt && (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full"
                    style={{
                      background: 'var(--admin-blue-soft)',
                      color: 'var(--admin-blue)',
                      border: '0.5px solid var(--admin-blue)',
                      fontFamily: 'var(--font-mono-tech)',
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.05em',
                    }}
                  >
                    <Calendar className="w-2.5 h-2.5" />
                    SESIÓN #{linkedAppt.session_number ?? '?'}
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
                {format(created, 'd MMM · HH:mm', { locale: es })}
                {wasEdited && (
                  <span className="ml-1 italic">· editada</span>
                )}
              </span>
            </div>
            <p
              className="whitespace-pre-wrap mt-1.5"
              style={{ fontSize: 13, color: 'var(--admin-fg)', lineHeight: 1.6 }}
            >
              {note.body}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span
                style={{
                  fontSize: 10,
                  color: 'var(--admin-fg-subtle)',
                  fontFamily: 'var(--font-mono-tech)',
                  letterSpacing: '0.05em',
                }}
              >
                hace {formatDistanceToNow(created, { locale: es })}
              </span>
              <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {canPin && (
                  <button
                    type="button"
                    onClick={onTogglePin}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md transition-colors"
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: note.is_pinned ? 'var(--admin-gold)' : 'var(--admin-fg-muted)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = note.is_pinned ? 'var(--admin-gold-soft)' : 'var(--admin-bg-elev-2)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                    }}
                    aria-label={note.is_pinned ? 'Desfijar nota' : 'Fijar nota'}
                  >
                    {note.is_pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                    {note.is_pinned ? 'Desfijar' : 'Fijar'}
                  </button>
                )}
                {canEdit && (
                  <>
                    <button
                      type="button"
                      onClick={onEdit}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md transition-colors"
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: 'var(--admin-fg-muted)',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-bg-elev-2)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                      aria-label="Editar nota"
                    >
                      <Edit3 className="w-3 h-3" /> Editar
                    </button>
                    <button
                      type="button"
                      onClick={onDelete}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md transition-colors"
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: 'var(--admin-red)',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-red-soft)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                      aria-label="Eliminar nota"
                    >
                      <Trash2 className="w-3 h-3" /> Eliminar
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </li>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
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
          background: 'var(--admin-gold-soft)',
          border: '0.5px solid var(--admin-gold-border, var(--admin-gold))',
        }}
      >
        <StickyNote className="w-7 h-7" style={{ color: 'var(--admin-gold)' }} />
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--admin-fg)' }}>Sin notas todavía</h3>
      <p
        className="mt-1 mx-auto"
        style={{ fontSize: 13, color: 'var(--admin-fg-muted)', maxWidth: '44ch', lineHeight: 1.5 }}
      >
        Las notas son visibles para Diana, Vanessa, Andrium y Henry. Crea una general
        del caso o asóciala a una cita específica.
      </p>
      <div className="flex items-center justify-center gap-2 mt-5">
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full transition-all hover:opacity-90 active:scale-95"
          style={{
            background: 'linear-gradient(135deg, var(--admin-accent), var(--admin-blue))',
            color: '#FFFFFF',
            border: '0.5px solid rgba(255,255,255,0.2)',
            boxShadow: '0 8px 18px rgba(30,78,154,0.2)',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <Plus className="w-4 h-4" /> Crear primera nota
        </button>
      </div>
      <p
        className="inline-flex items-center gap-1 mt-3"
        style={{ fontSize: 10, color: 'var(--admin-fg-subtle)' }}
      >
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
  draftAppointmentId: string
  setDraftAppointmentId: (v: string) => void
  appointments: AppointmentLite[]
  saving: boolean
  onClose: () => void
  onSave: () => void
}) {
  const len = draftBody.length
  const counterColor =
    len > 7500 ? 'var(--admin-red)' :
    len > 5000 ? 'var(--admin-gold)' :
    'var(--admin-fg-subtle)'
  const counterWeight = len > 7500 ? 600 : 400

  // Cuando está editando, no se permite cambiar el appointment_id (eso cambia la categoría)
  const isEditMode = !!editingNote
  const willBeSession = !!draftAppointmentId

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-mono-tech)',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.14em',
    color: 'var(--admin-fg-subtle)',
    textTransform: 'uppercase',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl max-w-xl w-full overflow-hidden"
        style={{
          background: 'var(--admin-panel-grad)',
          border: '0.5px solid var(--admin-border-strong)',
          boxShadow: 'var(--admin-shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{
            background: 'var(--admin-bg-elev)',
            borderBottom: '0.5px solid var(--admin-border)',
          }}
        >
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--admin-fg)' }}>
              {editingNote ? 'Editar nota' : 'Nueva nota'}
            </p>
            <p style={{ fontSize: 11, color: 'var(--admin-fg-muted)', marginTop: 2 }}>
              Visible para todo el staff. No se sobrescribe nada.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{
              background: 'var(--admin-bg-elev-2)',
              color: 'var(--admin-fg-muted)',
              border: '0.5px solid var(--admin-border-strong)',
            }}
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {!isEditMode && (
            <div>
              <label className="block mb-1.5" style={labelStyle}>
                Asociar a una cita (opcional)
              </label>
              <select
                value={draftAppointmentId}
                onChange={(e) => setDraftAppointmentId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg"
                style={{
                  background: 'var(--admin-bg-elev)',
                  border: '0.5px solid var(--admin-border-strong)',
                  color: 'var(--admin-fg)',
                  fontSize: 13,
                }}
              >
                <option value="">— Nota general del caso —</option>
                {appointments.map((a) => (
                  <option key={a.id} value={a.id}>
                    Sesión #{a.session_number ?? '?'} · {format(new Date(a.scheduled_at), "d MMM yyyy 'a las' HH:mm", { locale: es })} · {a.status}
                  </option>
                ))}
              </select>
              <p
                className="mt-1.5 inline-flex items-center gap-1"
                style={{
                  fontSize: 11,
                  color: willBeSession ? 'var(--admin-green)' : 'var(--admin-fg-muted)',
                }}
              >
                {willBeSession ? (
                  <>
                    <Calendar className="w-3 h-3" />
                    Se guardará como <strong className="mx-0.5">nota de sesión</strong> vinculada a la cita.
                  </>
                ) : (
                  <>
                    <StickyNote className="w-3 h-3" />
                    Se guardará como <strong className="mx-0.5">nota general</strong> del caso.
                  </>
                )}
              </p>
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label style={labelStyle}>Nota</label>
              <span
                className="tabular-nums"
                style={{
                  fontSize: 10,
                  color: counterColor,
                  fontWeight: counterWeight,
                  fontFamily: 'var(--font-mono-tech)',
                }}
              >
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
        <div
          className="flex items-center justify-end gap-2 px-5 py-3"
          style={{
            background: 'var(--admin-bg-elev)',
            borderTop: '0.5px solid var(--admin-border)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-full transition-colors"
            style={{
              background: 'transparent',
              color: 'var(--admin-fg-muted)',
              fontSize: 12,
              fontWeight: 600,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-bg-elev-2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !draftBody.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, var(--admin-accent), var(--admin-blue))',
              color: '#FFFFFF',
              border: '0.5px solid rgba(255,255,255,0.2)',
              boxShadow: '0 8px 18px rgba(30,78,154,0.2)',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {editingNote ? 'Guardar cambios' : 'Crear nota'}
          </button>
        </div>
      </div>
    </div>
  )
}
