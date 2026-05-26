'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Phone, CalendarClock, Clock, CheckCircle, XCircle, AlertTriangle,
  MessageSquare, X, Search, ChevronRight, Globe, UserPlus, UserRound,
} from 'lucide-react'
import { CompleteAppointmentDialog, type DialogMode } from './_components/complete-appointment-dialog'
import {
  formatDateTimeShort,
  OFFICE_TIMEZONE,
  formatTime,
  tzShortLabel,
  getBrowserTimezone,
} from '@/lib/timezones/format'
import { TimezoneSelector } from '@/components/appointments/timezone-selector'
import { usePersistedTimezone } from '@/components/appointments/use-persisted-tz'
import {
  ClientBookForm,
  type ActiveCase,
} from '@/components/appointments/client-book-form'
import { GuestBookForm } from '@/components/appointments/guest-book-form'

const TZ_STORAGE_KEY = 'ulp:employee-citas:viewTz'

interface StatusToken {
  bg: string
  color: string
}

const statusTokens: Record<string, StatusToken> = {
  scheduled: { bg: 'var(--admin-blue-soft)', color: 'var(--admin-blue)' },
  completed: { bg: 'var(--admin-green-soft)', color: 'var(--admin-green)' },
  cancelled: { bg: 'var(--admin-bg-elev-2)', color: 'var(--admin-fg-muted)' },
  no_show: { bg: 'var(--admin-red-soft)', color: 'var(--admin-red)' },
}

function statusChipStyle(status: string): React.CSSProperties {
  const t = statusTokens[status] ?? statusTokens.cancelled
  return {
    background: t.bg,
    color: t.color,
    border: `0.5px solid ${t.color}`,
    fontFamily: 'var(--font-mono-tech)',
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    padding: '2px 8px',
    borderRadius: 9999,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  }
}

const statusLabels: Record<string, string> = {
  scheduled: 'Agendada',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No se presentó',
}

const statusIcons: Record<string, typeof Clock> = {
  scheduled: CalendarClock,
  completed: CheckCircle,
  cancelled: XCircle,
  no_show: AlertTriangle,
}

function visitLabel(n: number): string {
  if (n <= 0) return 'Sesión'
  if (n === 1) return '1ra cita'
  if (n === 2) return '2da cita'
  if (n === 3) return '3ra cita'
  return `Sesión #${n}`
}

interface Appointment {
  id: string
  client_id?: string | null
  scheduled_at: string
  status: string
  guest_name?: string
  notes?: string
  employee_notes?: string | null
  session_number?: number | null
  objective_completed?: boolean | null
  case_id?: string | null
  client?: { first_name: string; last_name: string; phone?: string } | null
  case?: { case_number: string; service?: { name: string } | null } | null
}

interface EmployeeCitasViewProps {
  appointments: Appointment[]
  canManageStatus: boolean
  canBook: boolean
  activeCases: ActiveCase[]
}

export function EmployeeCitasView({
  appointments: initial,
  canManageStatus,
  canBook,
  activeCases,
}: EmployeeCitasViewProps) {
  const router = useRouter()
  const [appointments, setAppointments] = useState(initial)
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [letterFilter, setLetterFilter] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState('')
  const [viewingNote, setViewingNote] = useState<{ name: string; note: string } | null>(null)
  const [dialogApt, setDialogApt] = useState<Appointment | null>(null)
  const [dialogMode, setDialogMode] = useState<DialogMode>('complete')
  const [bookDialogOpen, setBookDialogOpen] = useState(false)
  const [guestDialogOpen, setGuestDialogOpen] = useState(false)

  // Default = TZ del navegador del empleado. Vanessa en Bogotá → America/Bogota,
  // Andrium en CDMX → America/Mexico_City. Persistimos para que su elección
  // sobreviva refrescos. `useMemo` para no recomputar el getBrowserTimezone
  // en cada render (depende solo del runtime del cliente).
  const browserTz = useMemo(() => getBrowserTimezone(), [])
  const [viewTz, changeViewTz] = usePersistedTimezone(TZ_STORAGE_KEY, browserTz)

  const tzIsOffice = viewTz === OFFICE_TIMEZONE

  const filtered = appointments.filter(a => {
    if (filter !== 'all' && a.status !== filter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      const name = a.client ? `${a.client.first_name} ${a.client.last_name}`.toLowerCase() : (a.guest_name || '').toLowerCase()
      const phone = a.client?.phone || ''
      if (!name.includes(q) && !phone.includes(q)) return false
    }
    if (letterFilter) {
      const firstName = a.client?.first_name || a.guest_name || ''
      if (!firstName.toUpperCase().startsWith(letterFilter)) return false
    }
    if (dateFilter) {
      const aptDate = a.scheduled_at.slice(0, 10)
      if (aptDate !== dateFilter) return false
    }
    return true
  })

  const scheduled = appointments.filter(a => a.status === 'scheduled').length
  const completed = appointments.filter(a => a.status === 'completed').length

  function openDialog(apt: Appointment, mode: DialogMode) {
    setDialogApt(apt)
    setDialogMode(mode)
  }

  function closeDialog() {
    setDialogApt(null)
  }

  function onDialogDone() {
    closeDialog()
    router.refresh()
    setAppointments(prev =>
      prev.map(a =>
        a.id === dialogApt?.id
          ? { ...a, status: dialogMode === 'complete' ? 'completed' : dialogMode === 'no_show' ? 'no_show' : 'cancelled' }
          : a
      )
    )
  }

  return (
    <div className="space-y-4">
      {/* Note viewing modal (legacy: visualizar nota previa de appointment) */}
      {viewingNote && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setViewingNote(null)}
        >
          <div
            className="rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
            style={{
              background: 'var(--admin-bg-elev)',
              border: '0.5px solid var(--admin-border-strong)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.30)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between p-4"
              style={{ borderBottom: '0.5px solid var(--admin-border)' }}
            >
              <div>
                <p className="font-bold text-sm" style={{ color: 'var(--admin-fg)' }}>
                  {viewingNote.name}
                </p>
                <p
                  className="text-xs flex items-center gap-1 mt-0.5"
                  style={{ color: 'var(--admin-gold)' }}
                >
                  <MessageSquare className="w-3 h-3" /> Notas de seguimiento (historica)
                </p>
              </div>
              <button
                onClick={() => setViewingNote(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
                style={{
                  background: 'var(--admin-bg-elev-2)',
                  color: 'var(--admin-fg-muted)',
                }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">
              <p
                className="text-sm whitespace-pre-wrap leading-relaxed"
                style={{ color: 'var(--admin-fg)' }}
              >
                {viewingNote.note}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TZ selector + acciones de booking */}
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="flex items-center gap-2 rounded-lg px-2 py-1"
          style={{
            background: 'var(--admin-bg-elev)',
            border: '0.5px solid var(--admin-border)',
          }}
        >
          <Globe className="w-3.5 h-3.5" style={{ color: 'var(--admin-fg-subtle)' }} />
          <span className="text-xs" style={{ color: 'var(--admin-fg-muted)' }}>Ver en</span>
          <div className="w-56">
            <TimezoneSelector value={viewTz} onChange={changeViewTz} size="sm" />
          </div>
        </div>
        {!tzIsOffice && (
          <span className="text-[11px]" style={{ color: 'var(--admin-fg-subtle)' }}>
            Mountain Time (oficina) se muestra debajo de cada hora.
          </span>
        )}
        {canBook && (
          <div className="ml-auto flex gap-2">
            <Dialog open={guestDialogOpen} onOpenChange={setGuestDialogOpen}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-opacity hover:opacity-90"
                  style={{
                    background: 'var(--admin-bg-elev)',
                    color: 'var(--admin-gold)',
                    border: '0.5px solid var(--admin-gold)',
                  }}
                >
                  <UserRound className="w-4 h-4" />
                  Agendar No-Cliente
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Agendar Visita — No Cliente</DialogTitle>
                </DialogHeader>
                <GuestBookForm
                  bookEndpoint="/api/employee/appointments/book"
                  slotsEndpoint="/api/employee/appointments/available-slots"
                  viewTimezone={viewTz}
                  onSuccess={() => { setGuestDialogOpen(false); router.refresh() }}
                />
              </DialogContent>
            </Dialog>
            <Dialog open={bookDialogOpen} onOpenChange={setBookDialogOpen}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:opacity-90 active:scale-95"
                  style={{
                    background: 'linear-gradient(135deg, var(--admin-accent), var(--admin-blue))',
                    color: '#FFFFFF',
                    boxShadow: '0 12px 28px rgba(30,78,154,0.25)',
                    border: '0.5px solid rgba(255,255,255,0.2)',
                  }}
                >
                  <UserPlus className="w-4 h-4" />
                  Agendar para Cliente
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Agendar Cita para Cliente</DialogTitle>
                </DialogHeader>
                <ClientBookForm
                  activeCases={activeCases}
                  bookEndpoint="/api/employee/appointments/book"
                  slotsEndpoint="/api/employee/appointments/available-slots"
                  viewTimezone={viewTz}
                  onSuccess={() => { setBookDialogOpen(false); router.refresh() }}
                />
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatBox value={scheduled} label="Agendadas" color="var(--admin-blue)" />
        <StatBox value={completed} label="Completadas" color="var(--admin-green)" />
        <StatBox value={appointments.length} label="Total" color="var(--admin-fg)" />
      </div>

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: 'var(--admin-fg-subtle)' }}
            />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre o telefono..."
              className="pl-10 h-10"
            />
          </div>
          <input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="h-10 px-3 rounded-lg text-sm focus:outline-none focus:ring-2"
            style={{
              background: 'var(--admin-bg-elev)',
              color: 'var(--admin-fg)',
              border: '0.5px solid var(--admin-border-strong)',
            }}
          />
          {dateFilter && (
            <button
              onClick={() => setDateFilter('')}
              className="h-10 px-2 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
              style={{
                background: 'var(--admin-red-soft)',
                color: 'var(--admin-red)',
                border: '0.5px solid var(--admin-red)',
              }}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1">
          <FilterChip
            active={!letterFilter}
            onClick={() => setLetterFilter(null)}
            variant="primary"
          >
            All
          </FilterChip>
          {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l => (
            <FilterChip
              key={l}
              active={letterFilter === l}
              onClick={() => setLetterFilter(letterFilter === l ? null : l)}
              variant="gold"
            >
              {l}
            </FilterChip>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          {[
            { value: 'all', label: 'Todas' },
            { value: 'scheduled', label: 'Agendadas' },
            { value: 'completed', label: 'Completadas' },
          ].map(f => (
            <FilterChip
              key={f.value}
              active={filter === f.value}
              onClick={() => setFilter(f.value)}
              variant="primary"
              wide
            >
              {f.label}
            </FilterChip>
          ))}
          {(search || letterFilter || dateFilter) && (
            <button
              onClick={() => { setSearch(''); setLetterFilter(null); setDateFilter('') }}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-opacity hover:opacity-80"
              style={{
                background: 'var(--admin-red-soft)',
                color: 'var(--admin-red)',
                border: '0.5px solid var(--admin-red)',
              }}
            >
              Limpiar filtros
            </button>
          )}
          <span
            className="ml-auto text-xs self-center"
            style={{
              color: 'var(--admin-fg-subtle)',
              fontFamily: 'var(--font-mono-tech)',
              letterSpacing: '0.1em',
            }}
          >
            {filtered.length} RESULTADO{filtered.length !== 1 ? 'S' : ''}
          </span>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p
            className="text-center py-8"
            style={{ color: 'var(--admin-fg-subtle)' }}
          >
            No hay citas en esta categoria.
          </p>
        )}
        {filtered.map(apt => {
          const StatusIcon = statusIcons[apt.status] || Clock
          const clientName = apt.client
            ? `${apt.client.first_name} ${apt.client.last_name}`
            : apt.guest_name || 'Sin nombre'
          const sessionN = apt.session_number ?? 1
          const isScheduled = apt.status === 'scheduled'
          const isUrgent = apt.status === 'no_show'

          return (
            <div
              key={apt.id}
              className="rounded-2xl p-4 transition-shadow hover:shadow-md"
              style={{
                background: isUrgent ? 'var(--admin-red-soft)' : 'var(--admin-panel-grad)',
                border: `0.5px solid ${isUrgent ? 'var(--admin-red)' : 'var(--admin-border)'}`,
                boxShadow: 'var(--admin-shadow, 0 6px 18px rgba(11,31,58,0.05))',
              }}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  {/* Client name + visit badge + status */}
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span
                      className="font-semibold text-sm"
                      style={{ color: 'var(--admin-fg)' }}
                    >
                      {clientName}
                    </span>
                    {apt.case_id && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 9999,
                          background: 'var(--admin-blue-soft)',
                          color: 'var(--admin-blue)',
                          border: '0.5px solid var(--admin-blue)',
                          fontFamily: 'var(--font-mono-tech)',
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {visitLabel(sessionN)}
                      </span>
                    )}
                    <span style={statusChipStyle(apt.status)}>
                      <StatusIcon className="w-3 h-3" />
                      {statusLabels[apt.status] || apt.status}
                    </span>
                    {apt.status === 'completed' && apt.objective_completed === false && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 9999,
                          background: 'var(--admin-gold-soft)',
                          color: 'var(--admin-gold)',
                          border: '0.5px solid var(--admin-gold)',
                          fontFamily: 'var(--font-mono-tech)',
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                        }}
                      >
                        Objetivo pendiente
                      </span>
                    )}
                  </div>

                  {/* Date, phone, case */}
                  <div
                    className="flex flex-wrap items-center gap-3 text-xs"
                    style={{ color: 'var(--admin-fg-muted)' }}
                  >
                    <span className="flex items-center gap-1">
                      <CalendarClock className="w-3 h-3" />
                      {formatDateTimeShort(apt.scheduled_at, viewTz)} {tzShortLabel(viewTz)}
                      {!tzIsOffice && (
                        <span style={{ color: 'var(--admin-fg-subtle)' }}>
                          {' '}· {formatTime(apt.scheduled_at, OFFICE_TIMEZONE)} MT
                        </span>
                      )}
                    </span>
                    {apt.client?.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {apt.client.phone}
                      </span>
                    )}
                    {apt.case && (
                      <span>#{apt.case.case_number} · {apt.case.service?.name || '—'}</span>
                    )}
                  </div>

                  {/* Henry's notes (legacy) */}
                  {apt.notes && (
                    <p
                      className="text-xs mt-2 rounded-lg p-2"
                      style={{
                        background: 'var(--admin-bg-elev-2)',
                        color: 'var(--admin-fg-muted)',
                        border: '0.5px solid var(--admin-border)',
                      }}
                    >
                      {apt.notes}
                    </p>
                  )}

                  {/* Notas históricas inline (legacy employee_notes) */}
                  {apt.employee_notes && (
                    <button
                      type="button"
                      onClick={() => setViewingNote({ name: clientName, note: apt.employee_notes! })}
                      className="mt-2 w-full text-left p-2.5 rounded-xl transition-opacity hover:opacity-90"
                      style={{
                        background: 'var(--admin-gold-soft)',
                        border: '0.5px solid var(--admin-gold)',
                      }}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <MessageSquare className="w-3 h-3" style={{ color: 'var(--admin-gold)' }} />
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: 'var(--admin-gold)',
                            fontFamily: 'var(--font-mono-tech)',
                            letterSpacing: '0.16em',
                            textTransform: 'uppercase',
                          }}
                        >
                          Notas historicas
                        </span>
                        <span
                          className="ml-auto"
                          style={{ fontSize: 10, color: 'var(--admin-fg-subtle)' }}
                        >
                          Toca para ver
                        </span>
                      </div>
                      <p
                        className="text-xs line-clamp-2"
                        style={{ color: 'var(--admin-fg)' }}
                      >
                        {apt.employee_notes}
                      </p>
                    </button>
                  )}

                  {/* Link a notas del caso */}
                  {apt.client_id && (
                    <div className="mt-2">
                      <Link
                        href={`/employee/clientes/${apt.client_id}`}
                        className="inline-flex items-center gap-1 text-xs hover:underline"
                        style={{ color: 'var(--admin-blue)' }}
                      >
                        Ver notas y bitacora del cliente <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                {canManageStatus && isScheduled && (
                  <div className="flex flex-col gap-1.5 min-w-[140px]">
                    <button
                      type="button"
                      onClick={() => openDialog(apt, 'complete')}
                      className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:opacity-90 active:scale-95"
                      style={{
                        background: 'linear-gradient(135deg, var(--admin-green), #16A34A)',
                        color: '#FFFFFF',
                        boxShadow: '0 8px 20px rgba(21,128,61,0.22)',
                      }}
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Cerrar cita
                    </button>
                    <button
                      type="button"
                      onClick={() => openDialog(apt, 'no_show')}
                      className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-opacity hover:opacity-80"
                      style={{
                        background: 'var(--admin-red-soft)',
                        color: 'var(--admin-red)',
                        border: '0.5px solid var(--admin-red)',
                      }}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" /> No-show
                    </button>
                    <button
                      type="button"
                      onClick={() => openDialog(apt, 'cancel')}
                      className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-opacity hover:opacity-80"
                      style={{
                        background: 'var(--admin-bg-elev-2)',
                        color: 'var(--admin-fg-muted)',
                        border: '0.5px solid var(--admin-border-strong)',
                      }}
                    >
                      <XCircle className="w-3.5 h-3.5" /> Cancelar
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Dialog */}
      {dialogApt && (
        <CompleteAppointmentDialog
          appointmentId={dialogApt.id}
          sessionNumber={dialogApt.session_number ?? 1}
          mode={dialogMode}
          onClose={closeDialog}
          onDone={onDialogDone}
        />
      )}
    </div>
  )
}

function StatBox({ value, label, color }: { value: number | string; label: string; color: string }) {
  return (
    <div
      className="rounded-xl p-3 text-center"
      style={{
        background: 'var(--admin-panel-grad)',
        border: '0.5px solid var(--admin-border)',
        boxShadow: 'var(--admin-shadow, 0 4px 14px rgba(11,31,58,0.04))',
      }}
    >
      <p
        className="text-xl font-bold"
        style={{ color, fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </p>
      <p
        style={{
          fontSize: 10,
          color: 'var(--admin-fg-subtle)',
          fontFamily: 'var(--font-mono-tech)',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          marginTop: 2,
        }}
      >
        {label}
      </p>
    </div>
  )
}

function FilterChip({
  active, onClick, children, variant, wide,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  variant: 'primary' | 'gold'
  wide?: boolean
}) {
  const activeStyle: React.CSSProperties =
    variant === 'gold'
      ? {
          background: 'linear-gradient(135deg, #F2C14E, var(--admin-gold))',
          color: 'var(--admin-accent)',
          boxShadow: 'var(--admin-shadow-gold, 0 6px 14px rgba(216,155,29,0.22))',
          border: '0.5px solid var(--admin-gold-border, rgba(255,255,255,0.2))',
          fontWeight: 700,
        }
      : {
          background: 'linear-gradient(135deg, var(--admin-accent), var(--admin-blue))',
          color: '#FFFFFF',
          boxShadow: '0 6px 14px rgba(30,78,154,0.22)',
          border: '0.5px solid rgba(255,255,255,0.18)',
          fontWeight: 600,
        }
  const inactiveStyle: React.CSSProperties = {
    background: 'var(--admin-bg-elev-2)',
    color: 'var(--admin-fg-muted)',
    border: '0.5px solid var(--admin-border)',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${wide ? 'px-3 py-1.5' : 'w-8 h-8'} rounded-full text-xs font-semibold transition-all hover:opacity-90 ${
        wide ? '' : 'flex items-center justify-center'
      }`}
      style={active ? activeStyle : inactiveStyle}
    >
      {children}
    </button>
  )
}
