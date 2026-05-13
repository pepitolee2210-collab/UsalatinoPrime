'use client'

// NotesTab: tab "Notas" del caso, compartido entre admin y employee.
// Características:
//   - Lista cronológica (más reciente primero) con scroll infinito.
//   - Filtros: categoría, autor, rango fecha.
//   - Crear nota general (sin cita) o vinculada a una cita.
//   - Editar / eliminar (solo autor o admin).
//   - Cada acción se registra en case_activity (bitácora) vía endpoint.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Loader2,
  StickyNote,
  Plus,
  X,
  Filter,
  ChevronDown,
  ChevronRight,
  Edit3,
  Trash2,
  Save,
  Calendar,
  AlertCircle,
} from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type {
  CaseNoteCategory,
  CaseNoteAuthorRole,
} from '@/types/database'

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

const CATEGORY_BADGE: Record<CaseNoteCategory, string> = {
  general: 'bg-slate-100 text-slate-700',
  session: 'bg-emerald-100 text-emerald-700',
  followup: 'bg-amber-100 text-amber-700',
  internal: 'bg-purple-100 text-purple-700',
  legacy: 'bg-gray-100 text-gray-500',
}

const ROLE_BADGE: Record<CaseNoteAuthorRole, string> = {
  admin: 'bg-indigo-100 text-indigo-700',
  employee: 'bg-[#F2A900]/15 text-[#9a6500]',
  system: 'bg-gray-100 text-gray-500',
}

const ROLE_LABEL: Record<CaseNoteAuthorRole, string> = {
  admin: 'Admin',
  employee: 'Staff',
  system: 'Sistema',
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
      // best effort: no romper UI si esto falla
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

  // Carga inicial
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoadingInitial(true)
      setError(null)
      try {
        await Promise.all([
          fetchPage({ reset: true, cursor: null }),
          fetchAppointments(),
        ])
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

  // Infinite scroll
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

  const authorOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const it of items) {
      if (it.author_id && it.author_label) map.set(it.author_id, it.author_label)
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }))
  }, [items])

  const toggleCategory = (c: CaseNoteCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    )
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
    if (!window.confirm('¿Eliminar esta nota? Esta acción se puede deshacer solo desde Henry.')) return
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

  return (
    <div className="space-y-4">
      {/* Header: botón crear + filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          type="button"
          onClick={() => openNewNote()}
          className="bg-[#002855] hover:bg-[#002855]/90 text-white"
        >
          <Plus className="w-4 h-4 mr-1" /> Nueva nota
        </Button>
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50"
        >
          <Filter className="w-3.5 h-3.5" /> Filtros
          {(selectedCategories.length > 0 || selectedAuthor !== 'all' || datePreset !== 'all') && (
            <span className="text-[10px] bg-[#F2A900]/15 text-[#9a6500] px-1.5 py-0.5 rounded-full">activos</span>
          )}
          {showFilters ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
        <span className="text-xs text-gray-400 ml-auto">{items.length} nota{items.length !== 1 ? 's' : ''}</span>
      </div>

      {showFilters && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <div>
            <p className="text-[10px] font-bold uppercase text-gray-500 mb-1.5">Categoría</p>
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

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5" /> {error}
        </div>
      )}

      {loadingInitial ? (
        <div className="flex items-center justify-center py-10 text-gray-400 text-sm">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Cargando notas...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center">
          <StickyNote className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-gray-700">Sin notas en este caso</p>
          <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
            Crea la primera nota — puede ser general o quedar asociada a una cita.
            Diana, Vanessa, Andrium y Henry verán todas las notas aquí.
          </p>
          <Button type="button" onClick={() => openNewNote()} className="mt-3 bg-[#002855]">
            <Plus className="w-4 h-4 mr-1" /> Primera nota
          </Button>
        </div>
      ) : (
        <ol className="space-y-3">
          {items.map((it) => {
            const role = it.author_role
            const created = new Date(it.created_at)
            const linkedAppt = it.appointment_id
              ? appointments.find((a) => a.id === it.appointment_id)
              : null
            const canEdit = it.author_id === currentUserId || isAdmin
            const updated = new Date(it.updated_at)
            const wasEdited = updated.getTime() - created.getTime() > 5000
            return (
              <li key={it.id} className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${ROLE_BADGE[role]}`}>
                      {it.author_label || ROLE_LABEL[role]}
                    </span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${CATEGORY_BADGE[it.category]}`}>
                      {CATEGORY_LABELS[it.category]}
                    </span>
                    {linkedAppt && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Sesión #{linkedAppt.session_number ?? '?'} · {format(new Date(linkedAppt.scheduled_at), 'd MMM', { locale: es })}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-500 whitespace-nowrap">
                    {format(created, "d MMM yyyy 'a las' HH:mm", { locale: es })}
                    {wasEdited && ' · editada'}
                  </span>
                </div>
                <p className="text-sm text-gray-800 mt-2 whitespace-pre-wrap">{it.body}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] text-gray-400">
                    hace {formatDistanceToNow(created, { locale: es })}
                  </span>
                  {canEdit && it.category !== 'legacy' && (
                    <div className="ml-auto flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(it)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-gray-600 hover:bg-gray-100"
                      >
                        <Edit3 className="w-3 h-3" /> Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(it)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3" /> Eliminar
                      </button>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={closeEditor}
        >
          <div
            className="bg-white rounded-2xl max-w-xl w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <p className="font-bold text-gray-900">{editingNote ? 'Editar nota' : 'Nueva nota'}</p>
              <button onClick={closeEditor} className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1.5">Categoría</label>
                <select
                  value={draftCategory}
                  onChange={(e) => setDraftCategory(e.target.value as CaseNoteCategory)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white"
                  disabled={!!editingNote && editingNote.category === 'legacy'}
                >
                  <option value="general">General — recordatorio del caso</option>
                  <option value="session">Sesión — vinculada a una cita</option>
                  <option value="followup">Seguimiento — algo que hay que retomar</option>
                  <option value="internal">Interna — visible solo a staff</option>
                </select>
              </div>
              {!editingNote && (
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1.5">
                    Asociar a una cita (opcional)
                  </label>
                  <select
                    value={draftAppointmentId}
                    onChange={(e) => setDraftAppointmentId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white"
                  >
                    <option value="">— Sin asociar —</option>
                    {appointments.map((a) => (
                      <option key={a.id} value={a.id}>
                        Sesión #{a.session_number ?? '?'} · {format(new Date(a.scheduled_at), "d MMM yyyy 'a las' HH:mm", { locale: es })} · {a.status}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1.5">
                  Nota ({draftBody.length}/8000)
                </label>
                <Textarea
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  rows={8}
                  placeholder="Escribe la nota — Diana, Vanessa, Andrium y Henry podrán verla en este mismo lugar."
                  className="text-sm"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t bg-gray-50">
              <button
                type="button"
                onClick={closeEditor}
                disabled={saving}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving || !draftBody.trim()}
                className="bg-[#002855] text-white"
              >
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                {editingNote ? 'Guardar cambios' : 'Crear nota'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
