'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Phone, CalendarClock, Clock, CheckCircle, XCircle, AlertTriangle,
  MessageSquare, X, Search, ChevronRight,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { CompleteAppointmentDialog, type DialogMode } from './_components/complete-appointment-dialog'

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
  no_show: 'bg-red-100 text-red-800',
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
}

export function EmployeeCitasView({ appointments: initial, canManageStatus }: EmployeeCitasViewProps) {
  const router = useRouter()
  const [appointments, setAppointments] = useState(initial)
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [letterFilter, setLetterFilter] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState('')
  const [viewingNote, setViewingNote] = useState<{ name: string; note: string } | null>(null)
  const [dialogApt, setDialogApt] = useState<Appointment | null>(null)
  const [dialogMode, setDialogMode] = useState<DialogMode>('complete')

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
    // refrescar el RSC para que la lista refleje el nuevo status y session_number
    router.refresh()
    // optimistic local update para que la UI no espere al refresh
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setViewingNote(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <p className="font-bold text-gray-900 text-sm">{viewingNote.name}</p>
                <p className="text-xs text-[#9a6500] flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" /> Notas de seguimiento (histórica)
                </p>
              </div>
              <button onClick={() => setViewingNote(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200">
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{viewingNote.note}</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border p-3 text-center">
          <p className="text-xl font-bold text-blue-600">{scheduled}</p>
          <p className="text-xs text-gray-500">Agendadas</p>
        </div>
        <div className="bg-white rounded-xl border p-3 text-center">
          <p className="text-xl font-bold text-green-600">{completed}</p>
          <p className="text-xs text-gray-500">Completadas</p>
        </div>
        <div className="bg-white rounded-xl border p-3 text-center">
          <p className="text-xl font-bold text-gray-600">{appointments.length}</p>
          <p className="text-xs text-gray-500">Total</p>
        </div>
      </div>

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre o teléfono..."
              className="pl-10 h-10" />
          </div>
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
            className="h-10 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]/40" />
          {dateFilter && (
            <button onClick={() => setDateFilter('')}
              className="h-10 px-2 rounded-lg bg-red-50 text-red-500 text-xs font-medium hover:bg-red-100">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1">
          <button onClick={() => setLetterFilter(null)}
            className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
              !letterFilter ? 'bg-[#002855] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}>
            All
          </button>
          {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l => (
            <button key={l} onClick={() => setLetterFilter(letterFilter === l ? null : l)}
              className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                letterFilter === l ? 'bg-[#F2A900] text-[#001020]' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}>
              {l}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {[
            { value: 'all', label: 'Todas' },
            { value: 'scheduled', label: 'Agendadas' },
            { value: 'completed', label: 'Completadas' },
          ].map(f => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f.value ? 'bg-[#002855] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {f.label}
            </button>
          ))}
          {(search || letterFilter || dateFilter) && (
            <button onClick={() => { setSearch(''); setLetterFilter(null); setDateFilter('') }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 bg-red-50 hover:bg-red-100">
              Limpiar filtros
            </button>
          )}
          <span className="ml-auto text-xs text-gray-400 self-center">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 py-8">No hay citas en esta categoría.</p>
        )}
        {filtered.map(apt => {
          const StatusIcon = statusIcons[apt.status] || Clock
          const clientName = apt.client
            ? `${apt.client.first_name} ${apt.client.last_name}`
            : apt.guest_name || 'Sin nombre'
          const sessionN = apt.session_number ?? 1
          const isScheduled = apt.status === 'scheduled'

          return (
            <div key={apt.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  {/* Client name + visit badge + status */}
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">{clientName}</span>
                    {apt.case_id && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        {visitLabel(sessionN)}
                      </span>
                    )}
                    <Badge className={statusColors[apt.status] || ''}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {statusLabels[apt.status] || apt.status}
                    </Badge>
                    {apt.status === 'completed' && apt.objective_completed === false && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        Objetivo pendiente
                      </span>
                    )}
                  </div>

                  {/* Date, phone, case */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <CalendarClock className="w-3 h-3" />
                      {format(new Date(apt.scheduled_at), "EEEE d MMM, h:mm a", { locale: es })}
                    </span>
                    {apt.client?.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {apt.client.phone}
                      </span>
                    )}
                    {apt.case && (
                      <span>#{apt.case.case_number} — {apt.case.service?.name || '—'}</span>
                    )}
                  </div>

                  {/* Henry's notes (legacy) */}
                  {apt.notes && (
                    <p className="text-xs text-gray-500 mt-1.5 bg-gray-50 rounded-lg p-2">{apt.notes}</p>
                  )}

                  {/* Notas históricas inline (legacy employee_notes) */}
                  {apt.employee_notes && (
                    <button
                      type="button"
                      onClick={() => setViewingNote({ name: clientName, note: apt.employee_notes! })}
                      className="mt-2 w-full text-left p-2.5 rounded-xl bg-[#F2A900]/5 border border-[#F2A900]/20 hover:bg-[#F2A900]/10 transition-colors"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <MessageSquare className="w-3 h-3 text-[#F2A900]" />
                        <span className="text-[10px] font-bold text-[#9a6500]">Notas históricas</span>
                        <span className="text-[10px] text-gray-400 ml-auto">Toca para ver</span>
                      </div>
                      <p className="text-xs text-gray-700 line-clamp-2">{apt.employee_notes}</p>
                    </button>
                  )}

                  {/* Link a notas del caso */}
                  {apt.client_id && (
                    <div className="mt-2">
                      <Link
                        href={`/employee/clientes/${apt.client_id}`}
                        className="inline-flex items-center gap-1 text-xs text-[#002855] hover:underline"
                      >
                        Ver notas y bitácora del cliente <ChevronRight className="w-3 h-3" />
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
                      className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Cerrar cita
                    </button>
                    <button
                      type="button"
                      onClick={() => openDialog(apt, 'no_show')}
                      className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" /> No-show
                    </button>
                    <button
                      type="button"
                      onClick={() => openDialog(apt, 'cancel')}
                      className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200"
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
