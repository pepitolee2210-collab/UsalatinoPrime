'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Phone, CalendarClock, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

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

interface Appointment {
  id: string
  scheduled_at: string
  status: string
  guest_name?: string
  notes?: string
  client?: { first_name: string; last_name: string; phone?: string } | null
  case?: { case_number: string; service?: { name: string } | null } | null
}

export function EmployeeCitasView({ appointments }: { appointments: Appointment[] }) {
  const [filter, setFilter] = useState<string>('all')

  const filtered = filter === 'all' ? appointments : appointments.filter(a => a.status === filter)

  const scheduled = appointments.filter(a => a.status === 'scheduled').length
  const completed = appointments.filter(a => a.status === 'completed').length

  return (
    <div className="space-y-4">
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

      {/* Filter */}
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

          return (
            <div key={apt.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900 text-sm">{clientName}</span>
                    <Badge className={statusColors[apt.status] || ''}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {statusLabels[apt.status] || apt.status}
                    </Badge>
                  </div>
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
                  {apt.notes && (
                    <p className="text-xs text-gray-500 mt-1 bg-gray-50 rounded-lg p-2">{apt.notes}</p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
