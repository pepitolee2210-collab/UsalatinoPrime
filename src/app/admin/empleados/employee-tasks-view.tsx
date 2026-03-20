'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  Briefcase, Clock, CheckCircle, AlertTriangle, Send,
  FileText, User, ChevronRight, Filter,
} from 'lucide-react'

interface Employee {
  id: string
  first_name: string
  last_name: string
  phone: string
}

interface Assignment {
  id: string
  status: string
  task_description: string | null
  assigned_at: string
  updated_at: string
  service_type: string | null
  client_name: string | null
  employee: { id: string; first_name: string; last_name: string } | null
  case: {
    id: string
    case_number: string
    client: { first_name: string; last_name: string } | null
    service: { name: string } | null
  } | null
  submissionStats: { total: number; submitted: number; approved: number }
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  assigned:         { label: 'Asignado',           color: 'bg-blue-100 text-blue-700',     icon: Clock },
  in_progress:      { label: 'En progreso',        color: 'bg-yellow-100 text-yellow-700', icon: FileText },
  submitted:        { label: 'Enviado a revisión',  color: 'bg-purple-100 text-purple-700', icon: Send },
  needs_correction: { label: 'Correcciones',       color: 'bg-red-100 text-red-700',       icon: AlertTriangle },
  approved:         { label: 'Aprobado',            color: 'bg-green-100 text-green-700',   icon: CheckCircle },
  completed:        { label: 'Completado',          color: 'bg-gray-100 text-gray-600',     icon: CheckCircle },
}

export function EmployeeTasksView({ employees, assignments }: {
  employees: Employee[]
  assignments: Assignment[]
}) {
  const [filter, setFilter] = useState<string>('all')

  const filtered = filter === 'all'
    ? assignments
    : assignments.filter(a => a.status === filter)

  const pendingReview = assignments.filter(a => a.status === 'submitted').length
  const inProgress = assignments.filter(a => a.status === 'in_progress' || a.status === 'assigned').length
  const completed = assignments.filter(a => a.status === 'approved' || a.status === 'completed').length

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{assignments.length}</p>
          <p className="text-xs text-gray-500">Total tareas</p>
        </div>
        <div className="bg-white rounded-xl border border-blue-200 p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{inProgress}</p>
          <p className="text-xs text-gray-500">En progreso</p>
        </div>
        <div className="bg-white rounded-xl border border-purple-200 p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">{pendingReview}</p>
          <p className="text-xs text-gray-500">Por revisar</p>
        </div>
        <div className="bg-white rounded-xl border border-green-200 p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{completed}</p>
          <p className="text-xs text-gray-500">Completados</p>
        </div>
      </div>

      {/* Employees */}
      {employees.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Equipo</p>
          <div className="flex flex-wrap gap-3">
            {employees.map(emp => {
              const empTasks = assignments.filter(a => a.employee?.id === emp.id)
              const empPending = empTasks.filter(a => a.status === 'submitted').length
              return (
                <div key={emp.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="w-10 h-10 rounded-xl bg-[#002855] flex items-center justify-center text-white font-bold text-sm">
                    {emp.first_name[0]}{emp.last_name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{emp.first_name} {emp.last_name}</p>
                    <p className="text-xs text-gray-500">{empTasks.length} tarea{empTasks.length !== 1 ? 's' : ''}</p>
                  </div>
                  {empPending > 0 && (
                    <Badge className="bg-purple-100 text-purple-700 ml-auto">{empPending} por revisar</Badge>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-400" />
        {[
          { value: 'all', label: 'Todas' },
          { value: 'submitted', label: 'Por revisar' },
          { value: 'assigned', label: 'Asignadas' },
          { value: 'needs_correction', label: 'Correcciones' },
          { value: 'approved', label: 'Aprobadas' },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f.value
                ? 'bg-[#002855] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Briefcase className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400">No hay tareas {filter !== 'all' ? 'con este filtro' : 'asignadas'}</p>
          </div>
        )}

        {filtered.map(a => {
          const config = STATUS_CONFIG[a.status] || STATUS_CONFIG.assigned
          const StatusIcon = config.icon
          const clientLabel = a.case
            ? `${a.case.client?.first_name || ''} ${a.case.client?.last_name || ''}`
            : a.client_name || 'Sin cliente'
          const serviceLabel = a.case?.service?.name || a.service_type || '—'
          const caseLink = a.case ? `/admin/cases/${a.case.id}` : null

          return (
            <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-bold text-gray-900 text-sm">{clientLabel}</span>
                    {a.case && <span className="text-xs text-gray-400">#{a.case.case_number}</span>}
                    <Badge className={config.color}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {config.label}
                    </Badge>
                  </div>

                  {/* Service + Employee */}
                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                    <span>{serviceLabel}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {a.employee?.first_name} {a.employee?.last_name}
                    </span>
                    <span>·</span>
                    <span>{new Date(a.assigned_at).toLocaleDateString('es-US', { day: 'numeric', month: 'short' })}</span>
                  </div>

                  {/* Task description */}
                  {a.task_description && (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-2">{a.task_description}</p>
                  )}

                  {/* Submission stats */}
                  {a.submissionStats.total > 0 && (
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-gray-400">{a.submissionStats.total} envío{a.submissionStats.total !== 1 ? 's' : ''}</span>
                      {a.submissionStats.submitted > 0 && (
                        <span className="text-purple-600 font-medium">{a.submissionStats.submitted} pendiente{a.submissionStats.submitted !== 1 ? 's' : ''} de revisión</span>
                      )}
                      {a.submissionStats.approved > 0 && (
                        <span className="text-green-600">{a.submissionStats.approved} aprobado{a.submissionStats.approved !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Action */}
                {caseLink ? (
                  <Link href={caseLink}>
                    <Button variant="outline" size="sm" className="flex-shrink-0">
                      Ver caso <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                  </Link>
                ) : (
                  <Badge variant="outline" className="flex-shrink-0 text-xs">Tarea standalone</Badge>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
