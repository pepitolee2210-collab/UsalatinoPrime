'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  Phone, Plus, Loader2, Clock, PhoneOff, UserX, UserCheck, CalendarClock, Trash2, Save, XCircle, Bot,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { PageHeader, AdminKeyframes } from '@/components/admin-ui'

const SERVICE_OPTIONS = [
  { slug: 'asilo-politico', label: 'Asilo Político' },
  { slug: 'ajuste-de-estatus', label: 'Ajuste de Estatus' },
  { slug: 'visa-juvenil', label: 'Visa Juvenil (SIJS)' },
  { slug: 'cambio-de-estatus', label: 'Cambio de Estatus' },
  { slug: 'cambio-de-corte', label: 'Cambio de Corte' },
  { slug: 'mociones', label: 'Mociones' },
  { slug: 'itin-number', label: 'ITIN Number' },
  { slug: 'adelantos', label: 'Adelantos (Advance Parole)' },
  { slug: 'licencia-de-conducir', label: 'Licencia de Conducir' },
  { slug: 'taxes', label: 'Declaración de Impuestos' },
  { slug: 'otro', label: 'Otro' },
]

interface StatusStyle {
  bg: string
  border: string
  dot: string
  text: string
  label: string
  icon: typeof Clock
}

const STATUS_STYLES: Record<string, StatusStyle> = {
  pending:        { bg: 'rgba(250,204,21,0.10)',  border: 'rgba(250,204,21,0.3)',  dot: '#FACC15', text: '#FDE68A', label: 'Pendiente',     icon: Clock },
  called:         { bg: 'rgba(96,165,250,0.10)',  border: 'rgba(96,165,250,0.3)',  dot: '#60A5FA', text: '#93C5FD', label: 'Llamado',       icon: Phone },
  follow_up:      { bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.3)', dot: '#A78BFA', text: '#C4B5FD', label: 'Seguimiento',   icon: CalendarClock },
  converted:      { bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.3)',   dot: '#4ADE80', text: '#86EFAC', label: 'Convertido',    icon: UserCheck },
  no_answer:      { bg: 'rgba(251,146,60,0.10)',  border: 'rgba(251,146,60,0.3)',  dot: '#FB923C', text: '#FDBA74', label: 'Sin Respuesta', icon: PhoneOff },
  not_interested: { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)', dot: '#A1A1A1', text: '#A1A1A1', label: 'No Interesado', icon: UserX },
  closed:         { bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.3)', dot: '#94A3B8', text: '#CBD5E1', label: 'Cerrado',       icon: XCircle },
}

type CallbackStatus = keyof typeof STATUS_STYLES

interface CallbackRequest {
  id: string
  prospect_name: string
  phone: string
  service_interest: string | null
  notes: string | null
  henry_notes: { text: string; date: string }[] | null
  message_date: string | null
  status: CallbackStatus
  follow_up_date: string | null
  scheduled_call: string | null
  created_at: string
  called_at: string | null
  source?: string
}

function getPriority(messageDate: string | null, createdAt: string): { label: string; kind: 'danger' | 'warning' | 'success'; sort: number } {
  const refDate = messageDate ? new Date(messageDate + 'T12:00:00') : new Date(createdAt)
  const days = Math.floor((Date.now() - refDate.getTime()) / (1000 * 60 * 60 * 24))
  if (days >= 7) return { label: 'Alta', kind: 'danger', sort: 0 }
  if (days >= 3) return { label: 'Media', kind: 'warning', sort: 1 }
  return { label: 'Baja', kind: 'success', sort: 2 }
}

type FilterTab = 'pending' | 'follow_up' | 'all' | 'closed'

// ════════════════════════════════════════════════════════════════════
// Style constants
// ════════════════════════════════════════════════════════════════════

const BTN_PRIMARY =
  'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full transition-all duration-200 hover:opacity-90 active:scale-95 disabled:opacity-50 ' +
  'bg-white text-black text-[12px] font-semibold tracking-tight ' +
  'shadow-[0_4px_18px_rgba(255,255,255,0.18),0_0_0_0.5px_rgba(255,255,255,0.4)_inset]'

const BTN_GHOST =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200 hover:bg-white/10 active:scale-95 disabled:opacity-50 ' +
  'bg-white/[0.04] border border-white/10 text-white text-[11px] font-semibold tracking-tight'

const BTN_SUCCESS =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200 hover:bg-emerald-500/15 active:scale-95 disabled:opacity-50 ' +
  'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold tracking-tight'

const BTN_WARNING =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200 hover:bg-orange-500/15 active:scale-95 disabled:opacity-50 ' +
  'bg-orange-500/10 border border-orange-500/30 text-orange-300 text-[11px] font-semibold tracking-tight'

const BTN_NEUTRAL =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200 hover:bg-white/10 active:scale-95 disabled:opacity-50 ' +
  'bg-white/[0.04] border border-white/10 text-white/60 text-[11px] font-semibold tracking-tight'

const ICON_BTN =
  'inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-red-500/10 disabled:opacity-50'

const DARK_DIALOG_CLS =
  'bg-[#0A0A0A] border border-white/10 text-white shadow-2xl backdrop-blur-xl ' +
  '[&>button]:text-white/60 [&>button]:hover:text-white'

const DARK_INPUT_CLS =
  'w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-colors focus:border-white/30 ' +
  'bg-white/[0.04] border border-white/10 text-white placeholder:text-white/30'

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-mono-tech)',
  fontSize: 9,
  fontWeight: 500,
  letterSpacing: '0.18em',
  color: '#A1A1A1',
}

// ════════════════════════════════════════════════════════════════════
// Main page
// ════════════════════════════════════════════════════════════════════

export default function AgendaPage() {
  const [items, setItems] = useState<CallbackRequest[]>([])
  const [truncated, setTruncated] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<FilterTab>('pending')
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState<CallbackRequest | null>(null)
  const [form, setForm] = useState({
    prospect_name: '',
    phone: '',
    service_interest: '',
    notes: '',
    message_date: '',
  })

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/agenda')
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          setItems(data)
          setTotalCount(data.length)
          setTruncated(false)
        } else {
          setItems(data.items || [])
          setTotalCount(data.total ?? (data.items?.length ?? 0))
          setTruncated(!!data.truncated)
        }
      }
    } catch {
      toast.error('Error al cargar agenda')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function resetForm() {
    setForm({ prospect_name: '', phone: '', service_interest: '', notes: '', message_date: '' })
    setShowForm(false)
  }

  async function handleSubmit(force = false) {
    if (!form.prospect_name.trim() || !form.phone.trim()) {
      toast.error('Nombre y teléfono son requeridos')
      return
    }
    setSaving(true)
    try {
      const body = force ? { ...form, force_duplicate: true } : form
      const res = await fetch('/api/admin/agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.duplicate) {
          const createAnyway = confirm(`${data.error}\n\n¿Desea crear el registro de todas formas?`)
          if (createAnyway) {
            setSaving(false)
            return handleSubmit(true)
          }
          setSaving(false)
          return
        }
        throw new Error(data.error)
      }
      toast.success('Prospecto registrado')
      resetForm()
      loadData()
    } catch (err) {
      toast.error((err as Error).message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(id: string, status: CallbackStatus, follow_up_date?: string) {
    try {
      const body: Record<string, unknown> = { id, status }
      if (follow_up_date) body.follow_up_date = follow_up_date
      const res = await fetch('/api/admin/agenda', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      toast.success('Estado actualizado')
      setEditingItem(null)
      loadData()
    } catch {
      toast.error('Error al actualizar')
    }
  }

  async function updateHenryNotes(id: string, henry_notes: string) {
    try {
      const res = await fetch('/api/admin/agenda', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, henry_notes }),
      })
      if (!res.ok) throw new Error()
      toast.success('Notas actualizadas')
      setEditingItem(null)
      loadData()
    } catch {
      toast.error('Error al actualizar')
    }
  }

  async function deleteItem(id: string) {
    if (!confirm('¿Eliminar este registro?')) return
    try {
      const res = await fetch('/api/admin/agenda', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error()
      toast.success('Registro eliminado')
      loadData()
    } catch {
      toast.error('Error al eliminar')
    }
  }

  const filtered = items.filter(item => {
    if (activeTab === 'pending') return item.status === 'pending'
    if (activeTab === 'follow_up') return item.status === 'follow_up'
    if (activeTab === 'closed') return ['converted', 'no_answer', 'not_interested', 'closed'].includes(item.status)
    return true
  }).sort((a, b) => {
    const hasSchedA = !!a.scheduled_call
    const hasSchedB = !!b.scheduled_call
    if (hasSchedA && !hasSchedB) return -1
    if (!hasSchedA && hasSchedB) return 1
    if (hasSchedA && hasSchedB) {
      return new Date(a.scheduled_call!).getTime() - new Date(b.scheduled_call!).getTime()
    }
    const dateA = a.message_date ? new Date(a.message_date + 'T12:00:00') : new Date(a.created_at)
    const dateB = b.message_date ? new Date(b.message_date + 'T12:00:00') : new Date(b.created_at)
    return dateA.getTime() - dateB.getTime()
  })

  const pendingCount = items.filter(i => i.status === 'pending').length
  const followUpCount = items.filter(i => i.status === 'follow_up').length
  const closedCount = items.filter(i => ['converted', 'no_answer', 'not_interested', 'closed'].includes(i.status)).length
  const chatbotCount = items.filter(i => i.source === 'chatbot' && i.status === 'pending').length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#A1A1A1' }} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AdminKeyframes />
      <PageHeader
        eyebrow="Comunicación · Agenda"
        title="Agenda de Llamadas"
        accentDot
        description="Registro de prospectos y seguimiento de llamadas. Filtra por estado, registra nuevos contactos y agenda llamadas programadas."
        action={
          <button onClick={() => setShowForm(true)} className={BTN_PRIMARY}>
            <Plus className="w-3.5 h-3.5" /> Nueva Llamada
          </button>
        }
        telemetry={[
          { label: 'Total', value: totalCount.toLocaleString() },
          { label: 'Pendientes', value: pendingCount.toString() },
          { label: 'Seguimiento', value: followUpCount.toString() },
          ...(chatbotCount > 0 ? [{ label: 'Chatbot', value: chatbotCount.toString() }] : []),
        ]}
      />

      {truncated && (
        <div
          className="rounded-xl px-4 py-3 text-sm flex items-center gap-3"
          style={{
            background: 'rgba(250,204,21,0.06)',
            border: '0.5px solid rgba(250,204,21,0.2)',
            color: '#FDE68A',
          }}
        >
          <span style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 10, letterSpacing: '0.18em', fontWeight: 700 }}>⚠ TRUNCATED</span>
          <span>Mostrando {items.length.toLocaleString()} de {totalCount.toLocaleString()}. Usa los filtros para acotar.</span>
        </div>
      )}

      {/* Stats clickeables */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatClickCard label="Pendientes" value={pendingCount} tone="warning" active={activeTab === 'pending'} onClick={() => setActiveTab('pending')} />
        <StatClickCard label="Seguimiento" value={followUpCount} tone="purple" active={activeTab === 'follow_up'} onClick={() => setActiveTab('follow_up')} />
        <StatClickCard label="Cerrados" value={closedCount} tone="neutral" active={activeTab === 'closed'} onClick={() => setActiveTab('closed')} />
        <StatClickCard label="Total" value={items.length} tone="info" active={activeTab === 'all'} onClick={() => setActiveTab('all')} />
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div
            className="rounded-2xl py-16 text-center"
            style={{
              background: 'linear-gradient(180deg, rgba(20,20,20,0.7), rgba(8,8,8,0.7))',
              border: '0.5px solid rgba(255,255,255,0.08)',
            }}
          >
            <p style={{ fontSize: 13, color: '#525252', fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.15em' }}>
              SIN REGISTROS EN ESTA CATEGORÍA
            </p>
          </div>
        ) : filtered.map(item => (
          <AgendaCard
            key={item.id}
            item={item}
            onUpdateStatus={updateStatus}
            onUpdateHenryNotes={updateHenryNotes}
            onDelete={deleteItem}
            onEdit={setEditingItem}
          />
        ))}
      </div>

      {/* New callback form dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm() }}>
        <DialogContent className={DARK_DIALOG_CLS}>
          <DialogHeader>
            <DialogTitle className="text-white" style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.018em' }}>
              Registrar Nueva Llamada
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label style={LABEL_STYLE}>NOMBRE DEL PROSPECTO *</label>
                <input
                  value={form.prospect_name}
                  onChange={e => setForm({ ...form, prospect_name: e.target.value })}
                  placeholder="Nombre completo"
                  className={DARK_INPUT_CLS}
                />
              </div>
              <div className="space-y-1.5">
                <label style={LABEL_STYLE}>TELÉFONO *</label>
                <input
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="(000) 000-0000"
                  className={DARK_INPUT_CLS}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label style={LABEL_STYLE}>SERVICIO DE INTERÉS</label>
              <div className="relative">
                <select
                  value={form.service_interest}
                  onChange={(e) => setForm({ ...form, service_interest: e.target.value })}
                  className={DARK_INPUT_CLS + ' appearance-none pr-9 cursor-pointer'}
                  style={{ colorScheme: 'dark' }}
                >
                  <option value="" style={{ background: '#0A0A0A', color: '#A1A1A1' }}>Seleccionar servicio</option>
                  {SERVICE_OPTIONS.map(s => (
                    <option key={s.slug} value={s.slug} style={{ background: '#0A0A0A', color: '#FAFAFA' }}>{s.label}</option>
                  ))}
                </select>
                <span aria-hidden className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#525252', fontSize: 10 }}>▾</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <label style={LABEL_STYLE}>FECHA DEL MENSAJE (WHATSAPP)</label>
              <input
                type="date"
                value={form.message_date}
                onChange={e => setForm({ ...form, message_date: e.target.value })}
                className={DARK_INPUT_CLS}
                style={{ colorScheme: 'dark' }}
              />
            </div>
            <div className="space-y-1.5">
              <label style={LABEL_STYLE}>NOTAS / CONTEXTO</label>
              <textarea
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Contexto de la llamada…"
                rows={3}
                className={DARK_INPUT_CLS + ' resize-y'}
                style={{ minHeight: 80 }}
              />
            </div>
            <button
              onClick={() => handleSubmit()}
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              style={{
                background: '#FFFFFF',
                color: '#000000',
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '-0.005em',
                boxShadow: '0 4px 24px rgba(255,255,255,0.2), 0 0 0 0.5px rgba(255,255,255,0.5) inset',
                marginTop: 8,
              }}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Registrar Prospecto
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit / Follow-up dialog */}
      <Dialog open={editingItem !== null} onOpenChange={(open) => { if (!open) setEditingItem(null) }}>
        <DialogContent className={DARK_DIALOG_CLS}>
          <DialogHeader>
            <DialogTitle className="text-white" style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.018em' }}>
              {editingItem?.prospect_name}
              <span style={{ color: '#A1A1A1', fontWeight: 400, marginLeft: 8, fontFamily: 'var(--font-mono-tech)', fontSize: 12 }}>
                {editingItem?.phone}
              </span>
            </DialogTitle>
          </DialogHeader>
          {editingItem && (
            <EditForm
              item={editingItem}
              onUpdateStatus={updateStatus}
              onUpdateHenryNotes={updateHenryNotes}
              onClose={() => setEditingItem(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// StatClickCard
// ════════════════════════════════════════════════════════════════════

const STAT_TONE: Record<string, { bg: string; border: string; activeBorder: string; iconColor: string; valueColor: string }> = {
  warning: { bg: 'rgba(250,204,21,0.10)',  border: 'rgba(250,204,21,0.3)',  activeBorder: '#FACC15', iconColor: '#FACC15', valueColor: '#FDE68A' },
  purple:  { bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.3)', activeBorder: '#A78BFA', iconColor: '#A78BFA', valueColor: '#C4B5FD' },
  neutral: { bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.3)', activeBorder: '#94A3B8', iconColor: '#94A3B8', valueColor: '#CBD5E1' },
  info:    { bg: 'rgba(96,165,250,0.10)',  border: 'rgba(96,165,250,0.3)',  activeBorder: '#60A5FA', iconColor: '#60A5FA', valueColor: '#93C5FD' },
}

function StatClickCard({
  label, value, tone, active, onClick,
}: { label: string; value: number; tone: keyof typeof STAT_TONE; active: boolean; onClick: () => void }) {
  const t = STAT_TONE[tone]
  return (
    <button
      onClick={onClick}
      className="rounded-2xl p-4 transition-all duration-300 hover:-translate-y-0.5 text-center"
      style={{
        background: active
          ? `linear-gradient(180deg, ${t.bg}, rgba(20,20,20,0.92))`
          : 'linear-gradient(180deg, rgba(20,20,20,0.92), rgba(8,8,8,0.92))',
        border: active ? `0.5px solid ${t.activeBorder}` : '0.5px solid rgba(255,255,255,0.1)',
        boxShadow: active ? `0 0 24px ${t.bg}` : 'none',
        backdropFilter: 'blur(20px)',
      }}
    >
      <p style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 9, fontWeight: 500, letterSpacing: '0.18em', color: '#525252' }}>
        {label.toUpperCase()}
      </p>
      <p style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.025em', color: active ? t.valueColor : '#FFFFFF', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
    </button>
  )
}

// ════════════════════════════════════════════════════════════════════
// AgendaBadge / PriorityBadge
// ════════════════════════════════════════════════════════════════════

function StatusBadge({ status }: { status: CallbackStatus }) {
  const s = STATUS_STYLES[status]
  const Icon = s.icon
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full"
      style={{
        background: s.bg,
        border: `0.5px solid ${s.border}`,
        fontFamily: 'var(--font-mono-tech)',
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.1em',
        color: s.text,
      }}
    >
      <Icon className="w-2.5 h-2.5" />
      {s.label.toUpperCase()}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: { label: string; kind: 'danger' | 'warning' | 'success' } }) {
  const styles = {
    danger:  { bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.3)', text: '#FCA5A5', dot: '#F87171' },
    warning: { bg: 'rgba(250,204,21,0.10)',  border: 'rgba(250,204,21,0.3)',  text: '#FDE68A', dot: '#FACC15' },
    success: { bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.3)',   text: '#86EFAC', dot: '#4ADE80' },
  }[priority.kind]
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full"
      style={{
        background: styles.bg,
        border: `0.5px solid ${styles.border}`,
        fontFamily: 'var(--font-mono-tech)',
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.1em',
        color: styles.text,
      }}
    >
      <span className="rounded-full" style={{ width: 5, height: 5, background: styles.dot }} />
      PRIORIDAD {priority.label.toUpperCase()}
    </span>
  )
}

// ════════════════════════════════════════════════════════════════════
// AgendaCard
// ════════════════════════════════════════════════════════════════════

function AgendaCard({
  item, onUpdateStatus, onUpdateHenryNotes, onDelete, onEdit,
}: {
  item: CallbackRequest
  onUpdateStatus: (id: string, status: CallbackStatus, followUpDate?: string) => Promise<void>
  onUpdateHenryNotes: (id: string, henryNotes: string) => Promise<void>
  onDelete: (id: string) => void
  onEdit: (item: CallbackRequest) => void
}) {
  const serviceLabel = SERVICE_OPTIONS.find(s => s.slug === item.service_interest)?.label || item.service_interest
  const priority = getPriority(item.message_date, item.created_at)
  const henryLog = Array.isArray(item.henry_notes) ? item.henry_notes : []
  const [newNote, setNewNote] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [schedDate, setSchedDate] = useState(item.scheduled_call ? item.scheduled_call.slice(0, 16) : '')
  const [savingSched, setSavingSched] = useState(false)

  async function handleSaveSchedule() {
    if (!schedDate) return
    setSavingSched(true)
    try {
      const res = await fetch('/api/admin/agenda', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, scheduled_call: new Date(schedDate).toISOString() }),
      })
      if (!res.ok) throw new Error()
      toast.success('Llamada programada')
    } catch { toast.error('Error al programar') }
    finally { setSavingSched(false) }
  }

  async function handleSaveNotes() {
    if (!newNote.trim()) return
    setSavingNotes(true)
    await onUpdateHenryNotes(item.id, newNote.trim())
    setNewNote('')
    setSavingNotes(false)
  }

  return (
    <div
      className="relative rounded-2xl p-5 overflow-hidden transition-all duration-300 group"
      style={{
        background: 'linear-gradient(180deg, rgba(20,20,20,0.92), rgba(8,8,8,0.92))',
        border: '0.5px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <span
        aria-hidden
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at top, rgba(255,255,255,0.03), transparent 60%)' }}
      />

      <div className="relative space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Name + badges */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#FFFFFF', letterSpacing: '-0.012em' }}>
                {item.prospect_name}
              </h3>
              <StatusBadge status={item.status} />
              <PriorityBadge priority={priority} />
              {item.source === 'chatbot' && (
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full"
                  style={{
                    background: 'rgba(167,139,250,0.10)',
                    border: '0.5px solid rgba(167,139,250,0.3)',
                    fontFamily: 'var(--font-mono-tech)',
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    color: '#C4B5FD',
                  }}
                >
                  <Bot className="w-2.5 h-2.5" />
                  CHATBOT
                </span>
              )}
            </div>

            {/* Info row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <a
                href={`tel:${item.phone}`}
                className="inline-flex items-center gap-1.5 transition-opacity hover:opacity-80"
                style={{ color: '#FFFFFF', fontSize: 13, fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.02em' }}
              >
                <Phone className="w-3 h-3" />
                {item.phone}
              </a>
              {serviceLabel && (
                <span style={{ fontSize: 12, color: '#A1A1A1' }}>{serviceLabel}</span>
              )}
              {item.message_date && (
                <span
                  style={{
                    fontFamily: 'var(--font-mono-tech)',
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#FDE68A',
                    letterSpacing: '0.05em',
                  }}
                >
                  MENSAJE {format(new Date(item.message_date + 'T12:00:00'), 'd MMM yyyy', { locale: es }).toUpperCase()}
                </span>
              )}
              <span
                style={{
                  fontFamily: 'var(--font-mono-tech)',
                  fontSize: 10,
                  color: '#525252',
                  letterSpacing: '0.05em',
                }}
              >
                REG. {format(new Date(item.created_at), "d MMM yyyy, h:mma", { locale: es }).toUpperCase()}
              </span>
              {item.called_at && (
                <span
                  style={{
                    fontFamily: 'var(--font-mono-tech)',
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#93C5FD',
                    letterSpacing: '0.05em',
                  }}
                >
                  LLAMADO {format(new Date(item.called_at), "d MMM yyyy, h:mma", { locale: es }).toUpperCase()}
                </span>
              )}
            </div>

            {/* Notes display */}
            {item.notes && (
              <div
                className="mt-3 rounded-xl px-3.5 py-2.5"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '0.5px solid rgba(255,255,255,0.06)',
                }}
              >
                <p style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 9, fontWeight: 500, letterSpacing: '0.2em', color: '#525252', marginBottom: 4 }}>
                  CONTEXTO DEL PROSPECTO
                </p>
                <p style={{ fontSize: 12.5, color: '#A1A1A1', lineHeight: 1.5 }}>{item.notes}</p>
              </div>
            )}

            {/* Follow-up date */}
            {item.follow_up_date && (
              <p
                className="inline-flex items-center gap-1.5 mt-2"
                style={{
                  fontFamily: 'var(--font-mono-tech)',
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#C4B5FD',
                  letterSpacing: '0.05em',
                }}
              >
                <CalendarClock className="w-3 h-3" />
                SEGUIMIENTO {format(new Date(item.follow_up_date + 'T12:00:00'), "d MMM yyyy", { locale: es }).toUpperCase()}
              </p>
            )}

            {/* Scheduled call box */}
            <div
              className="mt-3 rounded-xl p-3"
              style={{
                background: 'rgba(250,204,21,0.06)',
                border: '0.5px solid rgba(250,204,21,0.25)',
              }}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <CalendarClock className="w-3.5 h-3.5 shrink-0" style={{ color: '#FACC15' }} />
                <span style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: '#FACC15' }}>
                  PROGRAMAR
                </span>
                <input
                  type="datetime-local"
                  value={schedDate}
                  onChange={e => setSchedDate(e.target.value)}
                  className="flex-1 min-w-[140px] px-2.5 py-1.5 rounded-lg outline-none transition-colors focus:border-white/30"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '0.5px solid rgba(255,255,255,0.1)',
                    color: '#FAFAFA',
                    fontSize: 11,
                    fontFamily: 'var(--font-mono-tech)',
                    colorScheme: 'dark',
                  }}
                />
                <button
                  onClick={handleSaveSchedule}
                  disabled={savingSched || !schedDate}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 hover:opacity-90 active:scale-95 disabled:opacity-40"
                  style={{
                    background: '#FACC15',
                    color: '#000000',
                  }}
                >
                  {savingSched ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                </button>
              </div>
              {item.scheduled_call && (
                <p
                  className="mt-2 ml-6"
                  style={{
                    fontFamily: 'var(--font-mono-tech)',
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#FDE68A',
                    letterSpacing: '0.05em',
                  }}
                >
                  📅 {format(new Date(item.scheduled_call), "EEEE d MMM, h:mma", { locale: es }).toUpperCase()}
                </p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            {item.status === 'pending' && (
              <>
                <button onClick={() => onUpdateStatus(item.id, 'called')} className={BTN_GHOST}>
                  <Phone className="w-3 h-3" /> Llamado
                </button>
                <button onClick={() => onEdit(item)} className={BTN_GHOST}>
                  Seguimiento
                </button>
              </>
            )}
            {item.status === 'called' && (
              <>
                <button onClick={() => onUpdateStatus(item.id, 'converted')} className={BTN_SUCCESS}>
                  <UserCheck className="w-3 h-3" /> Convertido
                </button>
                <button onClick={() => onEdit(item)} className={BTN_GHOST}>
                  Seguimiento
                </button>
                <button onClick={() => onUpdateStatus(item.id, 'not_interested')} className={BTN_NEUTRAL}>
                  No Interesado
                </button>
              </>
            )}
            {item.status === 'follow_up' && (
              <>
                <button onClick={() => onUpdateStatus(item.id, 'called')} className={BTN_GHOST}>
                  <Phone className="w-3 h-3" /> Llamado
                </button>
                <button onClick={() => onUpdateStatus(item.id, 'converted')} className={BTN_SUCCESS}>
                  <UserCheck className="w-3 h-3" /> Convertido
                </button>
                <button onClick={() => onUpdateStatus(item.id, 'no_answer')} className={BTN_WARNING}>
                  Sin Respuesta
                </button>
              </>
            )}
            {item.status === 'no_answer' && (
              <button onClick={() => onEdit(item)} className={BTN_GHOST}>
                Reintentar
              </button>
            )}
            {!['converted', 'not_interested', 'closed'].includes(item.status) && (
              <button onClick={() => onUpdateStatus(item.id, 'closed')} className={BTN_NEUTRAL}>
                <XCircle className="w-3 h-3" /> Cerrar
              </button>
            )}
            {item.status === 'closed' && (
              <button onClick={() => onUpdateStatus(item.id, 'pending')} className={BTN_GHOST}>
                Reabrir
              </button>
            )}
            <button
              onClick={() => onDelete(item.id)}
              className={ICON_BTN}
              style={{ color: '#FCA5A5' }}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Henry's notes — history log */}
        <div className="pt-4 space-y-2" style={{ borderTop: '0.5px solid rgba(255,255,255,0.08)' }}>
          <label style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: '#FACC15' }}>
            NOTAS HENRY
          </label>
          {henryLog.length > 0 && (
            <div className="max-h-40 overflow-y-auto admin-scroll space-y-1.5 pr-1">
              {henryLog.map((entry, i) => (
                <div
                  key={i}
                  className="rounded-lg px-3 py-2"
                  style={{
                    background: 'rgba(250,204,21,0.06)',
                    border: '0.5px solid rgba(250,204,21,0.2)',
                  }}
                >
                  <p style={{ fontSize: 12.5, color: '#FDE68A', lineHeight: 1.5 }}>{entry.text}</p>
                  <p style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 9, color: '#525252', marginTop: 4, letterSpacing: '0.05em' }}>
                    {format(new Date(entry.date), "d MMM yyyy, h:mma", { locale: es }).toUpperCase()}
                  </p>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              placeholder="Agregar nota…"
              className={DARK_INPUT_CLS + ' flex-1'}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveNotes() } }}
            />
            <button
              disabled={savingNotes || !newNote.trim()}
              onClick={handleSaveNotes}
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 hover:opacity-90 active:scale-95 disabled:opacity-50"
              style={{
                background: '#FACC15',
                color: '#000000',
              }}
            >
              {savingNotes ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// EditForm (dentro del modal)
// ════════════════════════════════════════════════════════════════════

function EditForm({
  item, onUpdateStatus, onUpdateHenryNotes, onClose,
}: {
  item: CallbackRequest
  onUpdateStatus: (id: string, status: CallbackStatus, followUpDate?: string) => Promise<void>
  onUpdateHenryNotes: (id: string, henryNotes: string) => Promise<void>
  onClose: () => void
}) {
  const henryLog = Array.isArray(item.henry_notes) ? item.henry_notes : []
  const [newHenryNote, setNewHenryNote] = useState('')
  const [followUpDate, setFollowUpDate] = useState(item.follow_up_date || '')
  const [saving, setSaving] = useState(false)

  return (
    <div className="space-y-4 pt-2">
      {item.notes && (
        <div className="space-y-1.5">
          <label style={LABEL_STYLE}>NOTAS DEL PROSPECTO</label>
          <div
            className="rounded-xl px-3.5 py-3"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '0.5px solid rgba(255,255,255,0.06)',
            }}
          >
            <p style={{ fontSize: 13, color: '#A1A1A1', lineHeight: 1.55 }}>{item.notes}</p>
          </div>
        </div>
      )}
      <div className="space-y-1.5">
        <label style={LABEL_STYLE}>NOTAS DE HENRY</label>
        {henryLog.length > 0 && (
          <div className="max-h-48 overflow-y-auto admin-scroll space-y-1.5 pr-1">
            {henryLog.map((entry, i) => (
              <div
                key={i}
                className="rounded-lg px-3 py-2"
                style={{
                  background: 'rgba(250,204,21,0.06)',
                  border: '0.5px solid rgba(250,204,21,0.2)',
                }}
              >
                <p style={{ fontSize: 12.5, color: '#FDE68A', lineHeight: 1.5 }}>{entry.text}</p>
                <p style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 9, color: '#525252', marginTop: 4, letterSpacing: '0.05em' }}>
                  {format(new Date(entry.date), "d MMM yyyy, h:mma", { locale: es }).toUpperCase()}
                </p>
              </div>
            ))}
          </div>
        )}
        <textarea
          value={newHenryNote}
          onChange={e => setNewHenryNote(e.target.value)}
          rows={2}
          placeholder="Agregar nueva nota…"
          className={DARK_INPUT_CLS + ' resize-y'}
          style={{ minHeight: 64 }}
        />
      </div>
      <div className="space-y-1.5">
        <label style={LABEL_STYLE}>FECHA DE SEGUIMIENTO</label>
        <input
          type="date"
          value={followUpDate}
          onChange={e => setFollowUpDate(e.target.value)}
          className={DARK_INPUT_CLS}
          style={{ colorScheme: 'dark' }}
        />
      </div>
      <div className="flex gap-2 pt-2">
        <button
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full transition-all duration-200 hover:opacity-90 active:scale-95 disabled:opacity-50"
          style={{
            background: '#FFFFFF',
            color: '#000000',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '-0.005em',
            boxShadow: '0 4px 18px rgba(255,255,255,0.18), 0 0 0 0.5px rgba(255,255,255,0.4) inset',
          }}
          disabled={saving}
          onClick={async () => {
            setSaving(true)
            if (followUpDate) {
              await onUpdateStatus(item.id, 'follow_up', followUpDate)
            }
            if (newHenryNote.trim()) {
              await onUpdateHenryNotes(item.id, newHenryNote.trim())
              setNewHenryNote('')
            }
            if (!followUpDate && !newHenryNote.trim()) {
              onClose()
            }
            setSaving(false)
          }}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          Guardar
        </button>
        <button onClick={onClose} className={BTN_GHOST + ' !px-4 !py-2.5'}>
          Cancelar
        </button>
        {!['converted', 'not_interested', 'closed'].includes(item.status) && (
          <button
            disabled={saving}
            onClick={async () => {
              setSaving(true)
              if (newHenryNote.trim()) {
                await onUpdateHenryNotes(item.id, newHenryNote.trim())
              }
              await onUpdateStatus(item.id, 'closed')
              setSaving(false)
            }}
            className={BTN_NEUTRAL + ' !px-4 !py-2.5'}
          >
            <XCircle className="w-3.5 h-3.5" />
            Cerrar
          </button>
        )}
      </div>
    </div>
  )
}
