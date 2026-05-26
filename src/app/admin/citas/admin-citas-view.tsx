'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  CalendarClock, Settings, ChevronDown, ChevronUp,
  CheckCircle, XCircle, AlertTriangle, Trash2, Plus, RefreshCw, UserPlus, Loader2, Clock,
  Search, X, UserRound, Globe,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatTime, formatDate, OFFICE_TIMEZONE, tzShortLabel } from '@/lib/timezones/format'
import {
  ClientBookForm,
  type ActiveCase as ReusableActiveCase,
} from '@/components/appointments/client-book-form'
import { GuestBookForm } from '@/components/appointments/guest-book-form'
import { TimezoneSelector } from '@/components/appointments/timezone-selector'
import { usePersistedTimezone } from '@/components/appointments/use-persisted-tz'
import type { SchedulingConfig, SchedulingSettings, BlockedDate } from '@/types/database'

const TZ_STORAGE_KEY = 'ulp:admin-citas:viewTz'

const statusLabels: Record<string, string> = {
  scheduled: 'Agendada',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No se presentó',
}

type StatusKind = 'active' | 'success' | 'warning' | 'danger' | 'neutral'
const STATUS_KIND: Record<string, StatusKind> = {
  scheduled: 'active',
  completed: 'success',
  cancelled: 'neutral',
  no_show: 'danger',
}

const STATUS_STYLES: Record<StatusKind, { bg: string; border: string; dot: string; text: string }> = {
  active:    { bg: 'rgba(96,165,250,0.10)',  border: 'rgba(96,165,250,0.3)',  dot: '#60A5FA', text: '#93C5FD' },
  success:   { bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.3)',   dot: '#4ADE80', text: '#86EFAC' },
  warning:   { bg: 'rgba(250,204,21,0.10)',  border: 'rgba(250,204,21,0.3)',  dot: '#FACC15', text: '#FDE68A' },
  danger:    { bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.3)', dot: '#F87171', text: '#FCA5A5' },
  neutral:   { bg: 'var(--admin-accent-soft)', border: 'var(--admin-border-strong)', dot: 'var(--admin-fg-muted)', text: 'var(--admin-fg-muted)' },
}

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

type ActiveCase = ReusableActiveCase

interface AdminCitasViewProps {
  appointments: Array<{
    id: string
    client_id?: string | null
    scheduled_at: string
    status: string
    duration_minutes: number
    notes?: string
    cancelled_at?: string
    cancellation_reason?: string
    penalty_waived?: boolean
    client?: { first_name: string; last_name: string; email: string; phone?: string } | null
    case?: { case_number: string; service?: { name: string } | null } | null
  }>
  config: SchedulingConfig[]
  settings: SchedulingSettings | null
  blockedDates: BlockedDate[]
  activeCases: ActiveCase[]
}

function buildVisitCounts(appointments: AdminCitasViewProps['appointments']): Map<string, number> {
  const counts = new Map<string, number>()
  const sorted = [...appointments]
    .filter(a => a.status === 'completed' && a.client_id)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
  for (const apt of sorted) {
    const cid = apt.client_id!
    counts.set(cid, (counts.get(cid) || 0) + 1)
  }
  return counts
}

function visitLabel(count: number): string {
  if (count === 0) return 'Primera cita'
  if (count === 1) return '2da visita'
  if (count === 2) return '3ra visita'
  return `${count + 1}ta visita`
}

// ════════════════════════════════════════════════════════════════════
// Style constants — dark techno
// ════════════════════════════════════════════════════════════════════

const BTN_GHOST =
  'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full transition-all duration-200 ' +
  'hover:bg-white/10 active:scale-95 text-[12px] font-semibold tracking-tight ' +
  'bg-white/[0.04] border border-white/10 text-white disabled:opacity-50'

const BTN_PRIMARY =
  'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full transition-all duration-200 ' +
  'hover:opacity-90 active:scale-95 text-[12px] font-semibold tracking-tight ' +
  'bg-white text-black shadow-[0_4px_18px_rgba(255,255,255,0.18),0_0_0_0.5px_rgba(255,255,255,0.4)_inset] disabled:opacity-50'

const BTN_SUCCESS =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200 ' +
  'hover:bg-emerald-500/15 active:scale-95 text-[11px] font-semibold tracking-tight ' +
  'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 disabled:opacity-50'

const BTN_DANGER =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200 ' +
  'hover:bg-red-500/15 active:scale-95 text-[11px] font-semibold tracking-tight ' +
  'bg-red-500/10 border border-red-500/30 text-red-300 disabled:opacity-50'

const BTN_INFO =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200 ' +
  'hover:bg-blue-500/15 active:scale-95 text-[11px] font-semibold tracking-tight ' +
  'bg-blue-500/10 border border-blue-500/30 text-blue-300 disabled:opacity-50'

const BTN_WARNING =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200 ' +
  'hover:bg-yellow-500/15 active:scale-95 text-[11px] font-semibold tracking-tight ' +
  'bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 disabled:opacity-50'

const DARK_DIALOG_CLS =
  'bg-[#0A0A0A] border border-white/10 text-white shadow-2xl backdrop-blur-xl ' +
  '[&>button]:text-white/60 [&>button]:hover:text-white'

const DARK_INPUT_CLS =
  'w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-colors focus:border-white/30 ' +
  'bg-white/[0.04] border border-white/10 text-white placeholder:text-white/30'

// ════════════════════════════════════════════════════════════════════
// Main view
// ════════════════════════════════════════════════════════════════════

export function AdminCitasView({ appointments, config, settings, blockedDates, activeCases }: AdminCitasViewProps) {
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const completedCounts = buildVisitCounts(appointments)
  const [showConfig, setShowConfig] = useState(false)
  const [bookDialogOpen, setBookDialogOpen] = useState(false)
  const [guestDialogOpen, setGuestDialogOpen] = useState(false)
  const [viewTz, changeViewTz] = usePersistedTimezone(TZ_STORAGE_KEY, OFFICE_TIMEZONE)

  const filtered = appointments.filter(a => {
    const matchesFilter = filter === 'all' || a.status === filter
    if (!matchesFilter) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    const clientName = `${a.client?.first_name || ''} ${a.client?.last_name || ''}`.toLowerCase()
    const caseNumber = ((a.case as Record<string, unknown> | null)?.case_number as string || '').toLowerCase()
    const guestName = ((a as Record<string, unknown>).guest_name as string || '').toLowerCase()
    const notes = (a.notes || '').toLowerCase()
    return clientName.includes(q) || caseNumber.includes(q) || guestName.includes(q) || notes.includes(q)
  })

  return (
    <div className="space-y-6">
      {/* Search + TZ selector */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--admin-fg-subtle)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, caso o notas…"
            className="w-full pl-10 pr-9 py-2.5 rounded-xl text-sm outline-none transition-colors focus:border-white/25"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '0.5px solid var(--admin-border-strong)',
              color: 'var(--admin-fg)',
              fontSize: 13,
              letterSpacing: '-0.005em',
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70" style={{ color: 'var(--admin-fg-muted)' }}>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '0.5px solid var(--admin-border-strong)',
          }}
        >
          <Globe className="w-3.5 h-3.5" style={{ color: 'var(--admin-fg-subtle)' }} />
          <span className="hidden md:inline" style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 9, fontWeight: 500, letterSpacing: '0.18em', color: 'var(--admin-fg-subtle)' }}>
            VER EN
          </span>
          <div className="w-56">
            <TimezoneSelector value={viewTz} onChange={changeViewTz} size="sm" hideAuto />
          </div>
        </div>
      </div>

      {/* Filtros + Botones */}
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="inline-flex items-center gap-1 p-1 rounded-full"
          style={{
            background: 'var(--admin-accent-soft)',
            border: '0.5px solid var(--admin-border)',
          }}
        >
          {['all', 'scheduled', 'completed', 'cancelled', 'no_show'].map(s => {
            const isActive = filter === s
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className="px-3.5 py-1.5 rounded-full transition-all duration-300"
                style={{
                  background: isActive ? '#FFFFFF' : 'transparent',
                  color: isActive ? 'var(--admin-bg-deep)' : 'var(--admin-fg-muted)',
                  fontSize: 12,
                  fontWeight: isActive ? 700 : 500,
                  letterSpacing: '-0.005em',
                  boxShadow: isActive ? '0 0 16px rgba(255,255,255,0.18)' : 'none',
                }}
              >
                {s === 'all' ? 'Todas' : statusLabels[s]}
              </button>
            )
          })}
        </div>
        <div className="ml-auto flex gap-2">
          <Dialog open={guestDialogOpen} onOpenChange={setGuestDialogOpen}>
            <DialogTrigger asChild>
              <button className={BTN_GHOST}>
                <UserRound className="w-3.5 h-3.5" />
                Agendar No-Cliente
              </button>
            </DialogTrigger>
            <DialogContent className={`sm:max-w-md ${DARK_DIALOG_CLS}`}>
              <DialogHeader>
                <DialogTitle className="text-white" style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.022em' }}>
                  Agendar Visita · No Cliente
                </DialogTitle>
              </DialogHeader>
              <GuestBookForm
                viewTimezone={viewTz}
                onSuccess={() => { setGuestDialogOpen(false); window.location.reload() }}
              />
            </DialogContent>
          </Dialog>
          <Dialog open={bookDialogOpen} onOpenChange={setBookDialogOpen}>
            <DialogTrigger asChild>
              <button className={BTN_PRIMARY}>
                <UserPlus className="w-3.5 h-3.5" />
                Agendar para Cliente
              </button>
            </DialogTrigger>
            <DialogContent className={`sm:max-w-md ${DARK_DIALOG_CLS}`}>
              <DialogHeader>
                <DialogTitle className="text-white" style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.022em' }}>
                  Agendar Cita para Cliente
                </DialogTitle>
              </DialogHeader>
              <ClientBookForm
                activeCases={activeCases}
                viewTimezone={viewTz}
                onSuccess={() => { setBookDialogOpen(false); window.location.reload() }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabla de citas */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(20,20,20,0.92), rgba(8,8,8,0.92))',
          border: '0.5px solid var(--admin-border-strong)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="px-5 py-4 flex items-center gap-2.5" style={{ borderBottom: '0.5px solid var(--admin-border)' }}>
          <CalendarClock className="w-4 h-4" style={{ color: '#FFFFFF' }} />
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#FFFFFF', letterSpacing: '-0.012em' }}>
            Citas
          </h2>
          <span
            className="inline-flex items-center justify-center px-2 py-0.5 rounded-full"
            style={{
              background: 'var(--admin-accent-soft)',
              border: '0.5px solid rgba(255,255,255,0.12)',
              fontFamily: 'var(--font-mono-tech)',
              fontSize: 10,
              fontWeight: 700,
              color: '#FFFFFF',
              letterSpacing: '0.05em',
            }}
          >
            {filtered.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '0.5px solid var(--admin-border)', background: 'rgba(255,255,255,0.02)' }}>
                <Th>Fecha / Hora</Th>
                <Th>Cliente</Th>
                <Th>Caso / Servicio</Th>
                <Th>Estado</Th>
                <Th>Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12">
                    <p style={{ fontSize: 13, color: 'var(--admin-fg-subtle)', fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.15em' }}>
                      SIN CITAS PARA ESTE FILTRO
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((apt, idx) => (
                  <AppointmentRow
                    key={apt.id}
                    appointment={apt}
                    completedCount={apt.client_id ? (completedCounts.get(apt.client_id) || 0) : 0}
                    viewTz={viewTz}
                    isLast={idx === filtered.length - 1}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Toggle config */}
      <button
        onClick={() => setShowConfig(!showConfig)}
        className="w-full inline-flex items-center justify-between px-5 py-3 rounded-2xl transition-colors hover:bg-white/[0.04]"
        style={{
          background: 'rgba(255,255,255,0.025)',
          border: '0.5px solid var(--admin-border-strong)',
          color: '#FFFFFF',
        }}
      >
        <span className="inline-flex items-center gap-2.5">
          <span
            className="inline-flex items-center justify-center w-8 h-8 rounded-xl"
            style={{
              background: 'var(--admin-accent-soft)',
              border: '0.5px solid rgba(255,255,255,0.12)',
            }}
          >
            <Settings className="w-4 h-4" />
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.005em' }}>
            Configuración de horarios
          </span>
        </span>
        {showConfig ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {showConfig && (
        <div className="space-y-5">
          <ScheduleConfigPanel config={config} settings={settings} />
          <BlockedDatesPanel blockedDates={blockedDates} />
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// Table helpers
// ════════════════════════════════════════════════════════════════════

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th
      className="px-4 py-3 text-left"
      style={{
        fontFamily: 'var(--font-mono-tech)',
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: '0.18em',
        color: 'var(--admin-fg-subtle)',
      }}
    >
      {typeof children === 'string' ? children.toUpperCase() : children}
    </th>
  )
}

function Td({ children, colSpan, className }: { children?: React.ReactNode; colSpan?: number; className?: string }) {
  return (
    <td className={`px-4 py-3 ${className || ''}`} colSpan={colSpan} style={{ verticalAlign: 'middle' }}>
      {children}
    </td>
  )
}

function StatusBadge({ status }: { status: string }) {
  const kind = STATUS_KIND[status] ?? 'neutral'
  const s = STATUS_STYLES[kind]
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
      <span className="rounded-full" style={{ width: 5, height: 5, background: s.dot }} />
      {(statusLabels[status] || status).toUpperCase()}
    </span>
  )
}

// ════════════════════════════════════════════════════════════════════
// AppointmentRow
// ════════════════════════════════════════════════════════════════════

function AppointmentRow({
  appointment, completedCount, viewTz, isLast,
}: {
  appointment: AdminCitasViewProps['appointments'][0]
  completedCount: number
  viewTz: string
  isLast: boolean
}) {
  const tzIsOffice = viewTz === OFFICE_TIMEZONE
  const [updating, setUpdating] = useState(false)
  const [waiving, setWaiving] = useState(false)
  const [showReschedule, setShowReschedule] = useState(false)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleSlot, setRescheduleSlot] = useState('')
  const [rescheduleSlots, setRescheduleSlots] = useState<string[]>([])
  const [loadingRescheduleSlots, setLoadingRescheduleSlots] = useState(false)
  const [rescheduling, setRescheduling] = useState(false)
  const [rescheduleBlocked, setRescheduleBlocked] = useState(false)

  const clientRaw = appointment.client as unknown
  const client = Array.isArray(clientRaw)
    ? (clientRaw[0] as { first_name: string; last_name: string } | undefined)
    : (clientRaw as { first_name: string; last_name: string } | null)

  const caseRaw = appointment.case as unknown
  const caseInfo = Array.isArray(caseRaw)
    ? (caseRaw[0] as { case_number: string; service?: { name: string } | null } | undefined)
    : (caseRaw as { case_number: string; service?: { name: string } | null } | null)

  const serviceRaw = caseInfo?.service as unknown
  const service = Array.isArray(serviceRaw)
    ? (serviceRaw[0] as { name: string } | undefined)
    : (serviceRaw as { name: string } | null)

  async function updateStatus(status: string) {
    setUpdating(true)
    try {
      const res = await fetch('/api/admin/appointments/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_id: appointment.id, status }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Error')
        return
      }
      toast.success(`Cita marcada como ${statusLabels[status]}`)
      window.location.reload()
    } catch {
      toast.error('Error de conexión')
    } finally {
      setUpdating(false)
    }
  }

  async function handleWaivePenalty() {
    setWaiving(true)
    try {
      const res = await fetch('/api/admin/appointments/waive-penalty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_id: appointment.id }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Error')
        return
      }
      toast.success('Penalización levantada')
      window.location.reload()
    } catch {
      toast.error('Error de conexión')
    } finally {
      setWaiving(false)
    }
  }

  async function loadRescheduleSlots(date: string) {
    setRescheduleSlot('')
    setRescheduleBlocked(false)
    setLoadingRescheduleSlots(true)
    try {
      const res = await fetch(`/api/admin/appointments/available-slots?date=${date}`)
      const data = await res.json()
      if (data.blocked) {
        setRescheduleBlocked(true)
        setRescheduleSlots([])
      } else {
        setRescheduleSlots(data.slots || [])
      }
    } catch {
      toast.error('Error al cargar horarios')
      setRescheduleSlots([])
    } finally {
      setLoadingRescheduleSlots(false)
    }
  }

  async function handleReschedule() {
    if (!rescheduleSlot) return
    setRescheduling(true)
    try {
      const res = await fetch('/api/admin/appointments/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_id: appointment.id, scheduled_at: rescheduleSlot }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      toast.success('Cita reprogramada')
      window.location.reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al reprogramar')
    } finally {
      setRescheduling(false)
    }
  }

  const today = new Date().toISOString().split('T')[0]
  const guestName = (appointment as Record<string, unknown>).guest_name as string | undefined

  return (
    <>
      <tr
        style={{
          borderBottom: !isLast ? '0.5px solid var(--admin-accent-soft)' : 'none',
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <Td>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#FFFFFF', letterSpacing: '-0.005em' }}>
              {formatDate(appointment.scheduled_at, viewTz)}
            </p>
            <p style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 11, color: 'var(--admin-fg-muted)', marginTop: 2, letterSpacing: '0.02em' }}>
              {formatTime(appointment.scheduled_at, viewTz)} {tzShortLabel(viewTz)}
              {!tzIsOffice && (
                <span style={{ color: 'var(--admin-fg-subtle)' }}> · {formatTime(appointment.scheduled_at, OFFICE_TIMEZONE)} MT</span>
              )}
            </p>
          </div>
        </Td>
        <Td>
          {client ? (
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#FFFFFF', letterSpacing: '-0.005em' }}>
                {client.first_name} {client.last_name}
              </p>
              <span
                className="inline-block mt-1"
                style={{
                  fontFamily: 'var(--font-mono-tech)',
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.15em',
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: completedCount === 0 ? 'rgba(96,165,250,0.10)' : 'var(--admin-accent-soft)',
                  color: completedCount === 0 ? '#93C5FD' : 'var(--admin-fg-muted)',
                  border: completedCount === 0 ? '0.5px solid rgba(96,165,250,0.3)' : '0.5px solid var(--admin-border-strong)',
                }}
              >
                {visitLabel(completedCount).toUpperCase()}
              </span>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#FDE68A', letterSpacing: '-0.005em' }}>
                {guestName || 'Sin nombre'}
              </p>
              <p style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#FACC15', marginTop: 2 }}>
                NO CLIENTE
              </p>
            </div>
          )}
        </Td>
        <Td>
          {caseInfo ? (
            <div>
              <p style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 12, fontWeight: 700, color: '#FFFFFF', letterSpacing: '0.02em' }}>
                #{caseInfo.case_number}
              </p>
              <p style={{ fontSize: 11, color: 'var(--admin-fg-muted)', marginTop: 2 }}>{service?.name || '—'}</p>
            </div>
          ) : (
            <p style={{ fontSize: 11, color: 'var(--admin-fg-subtle)', fontStyle: 'italic' }}>Visita presencial</p>
          )}
        </Td>
        <Td>
          <StatusBadge status={appointment.status} />
        </Td>
        <Td>
          {appointment.status === 'scheduled' && (
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setShowReschedule(!showReschedule)} className={BTN_INFO}>
                <CalendarClock className="w-3 h-3" />
                Reprogramar
              </button>
              <button onClick={() => updateStatus('completed')} disabled={updating} className={BTN_SUCCESS}>
                <CheckCircle className="w-3 h-3" />
                Completada
              </button>
              <button onClick={() => updateStatus('no_show')} disabled={updating} className={BTN_DANGER}>
                <XCircle className="w-3 h-3" />
                No Show
              </button>
            </div>
          )}
          {(appointment.status === 'cancelled' || appointment.status === 'no_show') && (
            <div className="space-y-1.5">
              {appointment.cancellation_reason && (
                <p style={{ fontSize: 11, color: 'var(--admin-fg-subtle)', fontStyle: 'italic' }}>{appointment.cancellation_reason}</p>
              )}
              {appointment.penalty_waived ? (
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full"
                  style={{
                    background: 'rgba(34,197,94,0.10)',
                    border: '0.5px solid rgba(34,197,94,0.3)',
                    fontFamily: 'var(--font-mono-tech)',
                    fontSize: 9,
                    fontWeight: 700,
                    color: '#86EFAC',
                    letterSpacing: '0.1em',
                  }}
                >
                  REAGENDAMIENTO HABILITADO
                </span>
              ) : (
                <button onClick={handleWaivePenalty} disabled={waiving} className={BTN_WARNING}>
                  <RefreshCw className={`w-3 h-3 ${waiving ? 'animate-spin' : ''}`} />
                  Permitir Reagendar
                </button>
              )}
            </div>
          )}
        </Td>
      </tr>
      {showReschedule && appointment.status === 'scheduled' && (
        <tr>
          <Td colSpan={5} className="!p-0">
            <div
              className="px-5 py-4 space-y-4"
              style={{
                background: 'rgba(96,165,250,0.04)',
                borderLeft: '2px solid #60A5FA',
              }}
            >
              <p style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: '#93C5FD' }}>
                REPROGRAMAR · {(client?.first_name || guestName || '').toUpperCase()} {(client?.last_name || '').toUpperCase()}
              </p>
              <div className="flex items-end gap-3 flex-wrap">
                <div className="space-y-1.5">
                  <label style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 9, fontWeight: 500, letterSpacing: '0.18em', color: 'var(--admin-fg-muted)' }}>
                    NUEVA FECHA
                  </label>
                  <input
                    type="date"
                    min={today}
                    value={rescheduleDate}
                    onChange={e => {
                      setRescheduleDate(e.target.value)
                      if (e.target.value) loadRescheduleSlots(e.target.value)
                    }}
                    className="w-44 h-9 px-3 rounded-lg outline-none transition-colors focus:border-white/30"
                    style={{
                      background: 'var(--admin-accent-soft)',
                      border: '0.5px solid var(--admin-border-strong)',
                      color: 'var(--admin-fg)',
                      fontSize: 12,
                      colorScheme: 'dark',
                    }}
                  />
                </div>
                {rescheduleDate && (
                  loadingRescheduleSlots ? (
                    <div className="inline-flex items-center gap-2 pb-1.5" style={{ fontSize: 12, color: 'var(--admin-fg-muted)' }}>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando…
                    </div>
                  ) : rescheduleBlocked ? (
                    <p style={{ fontSize: 12, color: '#FCA5A5' }}>Fecha bloqueada</p>
                  ) : rescheduleSlots.length === 0 ? (
                    <p style={{ fontSize: 12, color: 'var(--admin-fg-subtle)' }}>Sin horarios disponibles</p>
                  ) : (
                    <div className="flex gap-1.5 flex-wrap">
                      {rescheduleSlots.map(slot => {
                        const isActive = rescheduleSlot === slot
                        return (
                          <button
                            key={slot}
                            onClick={() => setRescheduleSlot(slot)}
                            className="flex flex-col items-center px-3 py-1.5 rounded-xl transition-all duration-200"
                            style={{
                              background: isActive ? '#FFFFFF' : 'var(--admin-accent-soft)',
                              border: isActive ? '0.5px solid #FFFFFF' : '0.5px solid var(--admin-border-strong)',
                              color: isActive ? 'var(--admin-bg-deep)' : 'var(--admin-fg)',
                              boxShadow: isActive ? '0 0 12px rgba(255,255,255,0.18)' : 'none',
                            }}
                          >
                            <span className="inline-flex items-center gap-1" style={{ fontSize: 12, fontWeight: 700 }}>
                              <Clock className="w-3 h-3" />
                              {formatTime(slot, viewTz)}
                            </span>
                            {!tzIsOffice && (
                              <span style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 9, marginTop: 1, color: isActive ? 'rgba(0,0,0,0.6)' : 'var(--admin-fg-subtle)' }}>
                                {formatTime(slot, OFFICE_TIMEZONE)} MT
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )
                )}
              </div>
              {rescheduleSlot && (
                <div className="flex gap-2">
                  <button disabled={rescheduling} onClick={handleReschedule} className={BTN_PRIMARY}>
                    {rescheduling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    Confirmar nueva fecha
                  </button>
                  <button
                    onClick={() => { setShowReschedule(false); setRescheduleDate(''); setRescheduleSlot('') }}
                    className={BTN_GHOST}
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </Td>
        </tr>
      )}
    </>
  )
}

// ════════════════════════════════════════════════════════════════════
// ScheduleConfigPanel
// ════════════════════════════════════════════════════════════════════

function formatHour(h: number): string {
  if (h === 0) return '12 AM'
  if (h < 12) return `${h} AM`
  if (h === 12) return '12 PM'
  return `${h - 12} PM`
}

function ScheduleConfigPanel({
  config: initialConfig,
  settings: initialSettings,
}: {
  config: SchedulingConfig[]
  settings: SchedulingSettings | null
}) {
  const [config, setConfig] = useState(() =>
    initialConfig.map(c => ({
      ...c,
      time_blocks: c.time_blocks && c.time_blocks.length > 0
        ? c.time_blocks
        : c.is_available ? [{ start_hour: c.start_hour, end_hour: c.end_hour }] : [],
    }))
  )
  const [zoomLink, setZoomLink] = useState(initialSettings?.zoom_link || '')
  const [slotDuration, setSlotDuration] = useState(initialSettings?.slot_duration_minutes || 60)
  const [saving, setSaving] = useState(false)

  function toggleDay(dayOfWeek: number, enabled: boolean) {
    setConfig(prev =>
      prev.map(c =>
        c.day_of_week === dayOfWeek
          ? {
              ...c,
              is_available: enabled,
              time_blocks: enabled && c.time_blocks.length === 0
                ? [{ start_hour: 9, end_hour: 17 }]
                : c.time_blocks,
            }
          : c
      )
    )
  }

  function updateBlock(dayOfWeek: number, blockIndex: number, field: 'start_hour' | 'end_hour', value: number) {
    setConfig(prev =>
      prev.map(c => {
        if (c.day_of_week !== dayOfWeek) return c
        const blocks = [...c.time_blocks]
        blocks[blockIndex] = { ...blocks[blockIndex], [field]: value }
        return { ...c, time_blocks: blocks }
      })
    )
  }

  function addBlock(dayOfWeek: number) {
    setConfig(prev =>
      prev.map(c => {
        if (c.day_of_week !== dayOfWeek) return c
        const lastBlock = c.time_blocks[c.time_blocks.length - 1]
        const newStart = lastBlock ? lastBlock.end_hour + 1 : 9
        return {
          ...c,
          time_blocks: [...c.time_blocks, { start_hour: Math.min(newStart, 22), end_hour: Math.min(newStart + 3, 23) }],
        }
      })
    )
  }

  function removeBlock(dayOfWeek: number, blockIndex: number) {
    setConfig(prev =>
      prev.map(c => {
        if (c.day_of_week !== dayOfWeek) return c
        const blocks = c.time_blocks.filter((_, i) => i !== blockIndex)
        return { ...c, time_blocks: blocks, is_available: blocks.length > 0 }
      })
    )
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/appointments/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: config.map(c => ({
            day_of_week: c.day_of_week,
            start_hour: c.start_hour,
            end_hour: c.end_hour,
            is_available: c.is_available,
            time_blocks: c.time_blocks,
          })),
          settings: {
            id: initialSettings?.id,
            zoom_link: zoomLink,
            slot_duration_minutes: slotDuration,
          },
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Configuración guardada')
    } catch {
      toast.error('Error al guardar configuración')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel icon={<CalendarClock className="w-4 h-4" />} title="Horarios por día" description="Puede agregar múltiples bloques horarios por día (mañana y tarde)">
      <div className="space-y-2">
        {config.map(day => (
          <div
            key={day.day_of_week}
            className="rounded-xl p-4"
            style={{
              background: day.is_available ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.015)',
              border: '0.5px solid var(--admin-border)',
            }}
          >
            <div className="flex items-center gap-3">
              <DarkSwitch checked={day.is_available} onChange={v => toggleDay(day.day_of_week, v)} />
              <span style={{ fontSize: 13, fontWeight: 600, color: day.is_available ? '#FFFFFF' : 'var(--admin-fg-subtle)', letterSpacing: '-0.005em' }}>
                {DAY_NAMES[day.day_of_week]}
              </span>
              {day.is_available && (
                <span style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 10, color: 'var(--admin-fg-subtle)', letterSpacing: '0.1em', marginLeft: 4 }}>
                  {day.time_blocks.map(b => `${formatHour(b.start_hour)}–${formatHour(b.end_hour)}`).join(' · ')}
                </span>
              )}
            </div>
            {day.is_available && (
              <div className="mt-3 ml-12 space-y-2">
                {day.time_blocks.map((block, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 10, fontWeight: 500, letterSpacing: '0.15em', color: 'var(--admin-fg-muted)', width: 70 }}>
                      BLOQUE {idx + 1}
                    </span>
                    <HourInput
                      value={block.start_hour}
                      onChange={v => updateBlock(day.day_of_week, idx, 'start_hour', v)}
                    />
                    <span style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 10, color: 'var(--admin-fg-subtle)', letterSpacing: '0.2em' }}>A</span>
                    <HourInput
                      value={block.end_hour}
                      onChange={v => updateBlock(day.day_of_week, idx, 'end_hour', v)}
                    />
                    <span style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 10, color: 'var(--admin-fg-subtle)', letterSpacing: '0.05em' }}>HRS</span>
                    {day.time_blocks.length > 1 && (
                      <button
                        onClick={() => removeBlock(day.day_of_week, idx)}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:bg-red-500/10"
                        style={{ color: '#FCA5A5' }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={() => addBlock(day.day_of_week)} className={BTN_GHOST + ' !px-3 !py-1.5'} style={{ fontSize: 11 }}>
                  <Plus className="w-3 h-3" /> Agregar bloque
                </button>
              </div>
            )}
          </div>
        ))}

        <div className="space-y-3 pt-4" style={{ borderTop: '0.5px solid var(--admin-border)' }}>
          <div className="space-y-1.5">
            <label style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 9, fontWeight: 500, letterSpacing: '0.18em', color: 'var(--admin-fg-muted)' }}>
              ZOOM LINK
            </label>
            <input
              value={zoomLink}
              onChange={e => setZoomLink(e.target.value)}
              placeholder="https://zoom.us/j/…"
              className={DARK_INPUT_CLS}
            />
          </div>
          <div className="space-y-1.5">
            <label style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 9, fontWeight: 500, letterSpacing: '0.18em', color: 'var(--admin-fg-muted)' }}>
              DURACIÓN DE SLOT (MIN)
            </label>
            <input
              type="number"
              min={15}
              max={180}
              value={slotDuration}
              onChange={e => setSlotDuration(Number(e.target.value))}
              className={DARK_INPUT_CLS}
              style={{ width: 120 }}
            />
          </div>
        </div>

        <button onClick={handleSave} disabled={saving} className={BTN_PRIMARY + ' mt-3'}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          {saving ? 'Guardando…' : 'Guardar configuración'}
        </button>
      </div>
    </Panel>
  )
}

// ════════════════════════════════════════════════════════════════════
// BlockedDatesPanel
// ════════════════════════════════════════════════════════════════════

function BlockedDatesPanel({ blockedDates: initial }: { blockedDates: BlockedDate[] }) {
  const [dates, setDates] = useState(initial)
  const [newDate, setNewDate] = useState('')
  const [newReason, setNewReason] = useState('')
  const [adding, setAdding] = useState(false)

  async function handleAdd() {
    if (!newDate) return
    setAdding(true)
    try {
      const res = await fetch('/api/admin/appointments/blocked-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked_date: newDate, reason: newReason }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Error')
        return
      }
      setDates(prev => [...prev, data.blocked_date])
      setNewDate('')
      setNewReason('')
      toast.success('Fecha bloqueada')
    } catch {
      toast.error('Error de conexión')
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/admin/appointments/blocked-dates?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        toast.error('Error al eliminar')
        return
      }
      setDates(prev => prev.filter(d => d.id !== id))
      toast.success('Fecha desbloqueada')
    } catch {
      toast.error('Error de conexión')
    }
  }

  return (
    <Panel icon={<AlertTriangle className="w-4 h-4" />} title="Días bloqueados" description="Días que no aceptan citas (vacaciones, eventos, etc.)">
      <div className="space-y-4">
        <div className="flex gap-2 flex-wrap items-end">
          <div className="space-y-1.5">
            <label style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 9, fontWeight: 500, letterSpacing: '0.18em', color: 'var(--admin-fg-muted)' }}>
              FECHA
            </label>
            <input
              type="date"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              className={DARK_INPUT_CLS}
              style={{ width: 170, colorScheme: 'dark' }}
            />
          </div>
          <div className="space-y-1.5 flex-1 min-w-[180px]">
            <label style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 9, fontWeight: 500, letterSpacing: '0.18em', color: 'var(--admin-fg-muted)' }}>
              RAZÓN (OPCIONAL)
            </label>
            <input
              value={newReason}
              onChange={e => setNewReason(e.target.value)}
              placeholder="Ej: Vacaciones"
              className={DARK_INPUT_CLS}
            />
          </div>
          <button onClick={handleAdd} disabled={adding || !newDate} className={BTN_PRIMARY}>
            {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Bloquear
          </button>
        </div>

        {dates.length === 0 ? (
          <p style={{ fontSize: 11, color: 'var(--admin-fg-subtle)', fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.15em', fontStyle: 'italic' }}>
            NO HAY DÍAS BLOQUEADOS
          </p>
        ) : (
          <div className="space-y-2">
            {dates.map(d => (
              <div
                key={d.id}
                className="flex items-center justify-between p-3 rounded-xl"
                style={{
                  background: 'rgba(248,113,113,0.06)',
                  border: '0.5px solid rgba(248,113,113,0.2)',
                }}
              >
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#FCA5A5' }}>
                    {new Date(d.blocked_date + 'T12:00:00').toLocaleDateString('es-US', {
                      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </p>
                  {d.reason && (
                    <p style={{ fontSize: 11, color: 'var(--admin-fg-muted)', marginTop: 2 }}>{d.reason}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(d.id)}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-red-500/15"
                  style={{ color: '#FCA5A5' }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  )
}

// ════════════════════════════════════════════════════════════════════
// Shared widgets
// ════════════════════════════════════════════════════════════════════

function Panel({
  icon, title, description, children,
}: { icon: React.ReactNode; title: string; description?: string; children: React.ReactNode }) {
  return (
    <div
      className="relative rounded-2xl p-5 overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, rgba(20,20,20,0.92), rgba(8,8,8,0.92))',
        border: '0.5px solid var(--admin-border-strong)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <span
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at top, rgba(255,255,255,0.03), transparent 60%)' }}
      />
      <div className="relative">
        <div className="flex items-start gap-3 mb-4">
          <span
            className="inline-flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
            style={{
              background: 'linear-gradient(135deg, var(--admin-border-strong), rgba(255,255,255,0.02))',
              border: '0.5px solid rgba(255,255,255,0.15)',
              color: '#FFFFFF',
            }}
          >
            {icon}
          </span>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.018em', color: '#FFFFFF' }}>{title}</h2>
            {description && (
              <p style={{ fontSize: 12, color: 'var(--admin-fg-muted)', marginTop: 3, letterSpacing: '-0.005em' }}>{description}</p>
            )}
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

function DarkSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative inline-flex items-center transition-all duration-300"
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        background: checked ? '#FFFFFF' : 'var(--admin-border)',
        border: checked ? '0.5px solid #FFFFFF' : '0.5px solid rgba(255,255,255,0.15)',
        boxShadow: checked ? '0 0 12px rgba(255,255,255,0.18)' : 'none',
      }}
    >
      <span
        className="inline-block rounded-full transition-all duration-300"
        style={{
          width: 14,
          height: 14,
          background: checked ? 'var(--admin-bg-deep)' : 'var(--admin-fg-muted)',
          transform: `translateX(${checked ? 18 : 3}px)`,
        }}
      />
    </button>
  )
}

function HourInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      min={0}
      max={23}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="w-16 text-center px-2 py-1.5 rounded-lg outline-none transition-colors focus:border-white/30"
      style={{
        background: 'var(--admin-accent-soft)',
        border: '0.5px solid var(--admin-border-strong)',
        color: 'var(--admin-fg)',
        fontFamily: 'var(--font-mono-tech)',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.02em',
      }}
    />
  )
}
