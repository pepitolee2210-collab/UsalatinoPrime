'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import {
  Briefcase, Clock, CheckCircle, AlertTriangle, Send, FileText,
} from 'lucide-react'

interface Assignment {
  id: string
  task_description: string | null
  status: string
  assigned_at: string
  updated_at: string
  service_type: string | null
  client_name: string | null
  case: {
    id: string
    case_number: string
    client: { first_name: string; last_name: string }
    service: { name: string }
  } | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  assigned:         { label: 'Nuevo',              color: 'bg-blue-100 text-blue-700',   icon: Clock },
  in_progress:      { label: 'En progreso',       color: 'bg-yellow-100 text-yellow-700', icon: FileText },
  submitted:        { label: 'Enviado a revisión', color: 'bg-purple-100 text-purple-700', icon: Send },
  needs_correction: { label: 'Correcciones',      color: 'bg-red-100 text-red-700',     icon: AlertTriangle },
  approved:         { label: 'Aprobado',           color: 'bg-green-100 text-green-700', icon: CheckCircle },
  completed:        { label: 'Completado',         color: 'bg-gray-100 text-gray-600',   icon: CheckCircle },
}

export function EmployeeDashboard({ assignments }: { assignments: Assignment[] }) {
  const pending = assignments.filter(a => !['approved', 'completed'].includes(a.status))
  const done = assignments.filter(a => ['approved', 'completed'].includes(a.status))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mis Casos</h1>
        <p className="text-sm text-gray-500 mt-1">
          {pending.length} caso{pending.length !== 1 ? 's' : ''} pendiente{pending.length !== 1 ? 's' : ''}
        </p>
      </div>

      {assignments.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Briefcase className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="font-semibold text-gray-700 mb-1">Sin casos asignados</h3>
          <p className="text-sm text-gray-400">Cuando el abogado te asigne un caso, aparecerá aquí.</p>
        </div>
      )}

      {/* Pending cases */}
      {pending.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Pendientes</h2>
          {pending.map(a => (
            <AssignmentCard key={a.id} assignment={a} />
          ))}
        </div>
      )}

      {/* Completed cases */}
      {done.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Completados</h2>
          {done.map(a => (
            <AssignmentCard key={a.id} assignment={a} />
          ))}
        </div>
      )}
    </div>
  )
}

function AssignmentCard({ assignment: a }: { assignment: Assignment }) {
  const config = STATUS_CONFIG[a.status] || STATUS_CONFIG.assigned
  const StatusIcon = config.icon

  const href = a.case ? `/employee/cases/${a.case.id}` : `/employee/tasks/${a.id}`
  const clientLabel = a.case
    ? `${a.case.client.first_name} ${a.case.client.last_name}`
    : a.client_name || 'Sin cliente'
  const serviceLabel = a.case ? a.case.service.name : a.service_type || 'Sin servicio'
  const caseNum = a.case?.case_number

  return (
    <Link href={href}>
      <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-gray-900 text-sm">{clientLabel}</span>
              {caseNum && <span className="text-xs text-gray-400">#{caseNum}</span>}
            </div>

            <p className="text-xs text-gray-500 mb-2">{serviceLabel}</p>

            {/* Task description */}
            {a.task_description && (
              <p className="text-sm text-gray-600 line-clamp-2">{a.task_description}</p>
            )}

            {/* Date */}
            <p className="text-[11px] text-gray-400 mt-2">
              Asignado {new Date(a.assigned_at).toLocaleDateString('es-US', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>

          <Badge className={`${config.color} flex-shrink-0`}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {config.label}
          </Badge>
        </div>
      </div>
    </Link>
  )
}
