'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Phone, CalendarClock, Clock, CheckCircle, XCircle, AlertTriangle, Save, Loader2, MessageSquare, X, Search } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'

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

function visitLabel(count: number): string {
  if (count === 0) return '1ra cita'
  if (count === 1) return '2da cita'
  if (count === 2) return '3ra cita'
  return `${count + 1}ta cita`
}

interface Appointment {
  id: string
  client_id?: string | null
  scheduled_at: string
  status: string
  guest_name?: string
  notes?: string
  employee_notes?: string | null
  client?: { first_name: string; last_name: string; phone?: string } | null
  case?: { case_number: string; service?: { name: string } | null } | null
}

export function EmployeeCitasView({ appointments: initial }: { appointments: Appointment[] }) {
  const [appointments, setAppointments] = useState(initial)
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [letterFilter, setLetterFilter] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState('')
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [viewingNote, setViewingNote] = useState<{ name: string; note: string } | null>(null)

  // Build visit counts
  const completedCounts = new Map<string, number>()
  const sorted = [...appointments]
    .filter(a => a.status === 'completed' && a.client_id)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
  for (const apt of sorted) {
    const cid = apt.client_id!
    completedCounts.set(cid, (completedCounts.get(cid) || 0) + 1)
  }

  const filtered = appointments.filter(a => {
    // Status filter
    if (filter !== 'all' && a.status !== filter) return false
    // Text search
    if (search.trim()) {
      const q = search.toLowerCase()
      const name = a.client ? `${a.client.first_name} ${a.client.last_name}`.toLowerCase() : (a.guest_name || '').toLowerCase()
      const phone = a.client?.phone || ''
      if (!name.includes(q) && !phone.includes(q)) return false
    }
    // Letter filter
    if (letterFilter) {
      const firstName = a.client?.first_name || a.guest_name || ''
      if (!firstName.toUpperCase().startsWith(letterFilter)) return false
    }
    // Date filter
    if (dateFilter) {
      const aptDate = a.scheduled_at.slice(0, 10)
      if (aptDate !== dateFilter) return false
    }
    return true
  })

  const scheduled = appointments.filter(a => a.status === 'scheduled').length
  const completed = appointments.filter(a => a.status === 'completed').length

  async function saveNotes(aptId: string) {
    setSavingId(aptId)
    const noteText = localNotes[aptId] || ''
    try {
      const res = await fetch('/api/employee/appointment-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_id: aptId, employee_notes: noteText }),
      })
      if (!res.ok) throw new Error()
      // Update local state so the note appears immediately
      setAppointments(prev => prev.map(a =>
        a.id === aptId ? { ...a, employee_notes: noteText } : a
      ))
      toast.success('Notas guardadas')
      setEditingId(null)
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Note viewing modal */}
      {viewingNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setViewingNote(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <p className="font-bold text-gray-900 text-sm">{viewingNote.name}</p>
                <p className="text-xs text-[#9a6500] flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" /> Notas de seguimiento
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
        {/* Text search + date */}
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

        {/* Letter filter */}
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

        {/* Status filter */}
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
          const completedCount = apt.client_id ? (completedCounts.get(apt.client_id) || 0) : 0
          const isEditing = editingId === apt.id
          const currentNotes = localNotes[apt.id] !== undefined ? localNotes[apt.id] : (apt.employee_notes || '')

          return (
            <div key={apt.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Client name + visit badge + status */}
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">{clientName}</span>
                    {apt.client_id && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        completedCount === 0
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {visitLabel(completedCount)}
                      </span>
                    )}
                    <Badge className={statusColors[apt.status] || ''}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {statusLabels[apt.status] || apt.status}
                    </Badge>
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

                  {/* Henry's notes */}
                  {apt.notes && (
                    <p className="text-xs text-gray-500 mt-1.5 bg-gray-50 rounded-lg p-2">{apt.notes}</p>
                  )}

                  {/* Diana's notes */}
                  <div className="mt-2">
                    {isEditing ? (
                      <div className="space-y-2">
                        <Textarea
                          value={currentNotes}
                          onChange={e => setLocalNotes(prev => ({ ...prev, [apt.id]: e.target.value }))}
                          placeholder="Anota en qué quedaste con el/la cliente para la próxima cita..."
                          rows={3}
                          className="text-xs"
                        />
                        <div className="flex gap-2">
                          <button onClick={() => saveNotes(apt.id)}
                            disabled={savingId === apt.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#002855] text-white text-xs font-bold">
                            {savingId === apt.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            Guardar
                          </button>
                          <button onClick={() => setEditingId(null)}
                            className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        {apt.employee_notes ? (
                          <button onClick={() => setViewingNote({ name: clientName, note: apt.employee_notes! })}
                            className="flex-1 text-left p-2.5 rounded-xl bg-[#F2A900]/5 border border-[#F2A900]/20 hover:bg-[#F2A900]/10 transition-colors">
                            <div className="flex items-center gap-1.5 mb-1">
                              <MessageSquare className="w-3 h-3 text-[#F2A900]" />
                              <span className="text-[10px] font-bold text-[#9a6500]">Mis notas</span>
                              <span className="text-[10px] text-gray-400 ml-auto">Toca para ver</span>
                            </div>
                            <p className="text-xs text-gray-700 line-clamp-2">{apt.employee_notes}</p>
                          </button>
                        ) : null}
                        <button
                          onClick={() => {
                            setEditingId(apt.id)
                            setLocalNotes(prev => ({ ...prev, [apt.id]: apt.employee_notes || '' }))
                          }}
                          className={apt.employee_notes
                            ? "flex-shrink-0 px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-500 hover:bg-gray-50"
                            : "w-full p-2.5 rounded-lg border-2 border-dashed border-[#F2A900]/40 text-center bg-[#F2A900]/5 hover:bg-[#F2A900]/10 transition-colors"
                          }
                        >
                          {apt.employee_notes ? 'Editar' : '+ Agregar notas de seguimiento'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
