'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  Briefcase, Clock, CheckCircle, AlertTriangle, Send,
  FileText, User, ChevronRight, Filter, Pencil, Save, Loader2, MessageSquare, Upload,
} from 'lucide-react'
import { AssignTaskButton } from './assign-task-button'

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

interface Service { id: string; name: string }

export function EmployeeTasksView({ employees, assignments: initial, services }: {
  employees: Employee[]
  assignments: Assignment[]
  services: Service[]
}) {
  const [assignments, setAssignments] = useState(initial)
  const [filter, setFilter] = useState<string>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNotes, setEditNotes] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)

  async function uploadFileToTask(assignmentId: string, file: File) {
    setUploadingId(assignmentId)
    try {
      const fd = new FormData()
      fd.append('assignment_id', assignmentId)
      fd.append('file', file)

      const res = await fetch('/api/admin/upload-task-file', { method: 'POST', body: fd })
      if (!res.ok) throw new Error()
      toast.success(`"${file.name}" subido — Diana lo verá en su portal`)
    } catch {
      toast.error('Error al subir archivo')
    } finally {
      setUploadingId(null)
    }
  }

  const filtered = filter === 'all'
    ? assignments
    : assignments.filter(a => a.status === filter)

  const pendingReview = assignments.filter(a => a.status === 'submitted').length
  const inProgress = assignments.filter(a => a.status === 'in_progress' || a.status === 'assigned').length
  const completed = assignments.filter(a => a.status === 'approved' || a.status === 'completed').length

  async function saveNotes(assignmentId: string) {
    setSavingId(assignmentId)
    try {
      const res = await fetch('/api/admin/update-task-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: assignmentId, task_description: editNotes }),
      })
      if (!res.ok) throw new Error()
      setAssignments(prev => prev.map(a =>
        a.id === assignmentId ? { ...a, task_description: editNotes } : a
      ))
      setEditingId(null)
      toast.success('Notas actualizadas — Diana verá los cambios')
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSavingId(null)
    }
  }

  async function updateTaskStatus(assignmentId: string, newStatus: string) {
    setSavingId(assignmentId)
    try {
      const res = await fetch('/api/admin/update-task-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: assignmentId, status: newStatus }),
      })
      if (!res.ok) throw new Error()
      setAssignments(prev => prev.map(a =>
        a.id === assignmentId ? { ...a, status: newStatus } : a
      ))
      toast.success('Estado actualizado')
    } catch {
      toast.error('Error al actualizar')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* Action bar */}
      {employees.length > 0 && (
        <div className="flex justify-end">
          <AssignTaskButton services={services} employees={employees} />
        </div>
      )}

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
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f.value ? 'bg-[#002855] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
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
          const isEditing = editingId === a.id

          return (
            <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-bold text-gray-900 text-sm">{clientLabel}</span>
                    {a.case && <span className="text-xs text-gray-400">#{a.case.case_number}</span>}
                    <Badge className={config.color}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {config.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{serviceLabel}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {a.employee?.first_name} {a.employee?.last_name}
                    </span>
                    <span>·</span>
                    <span>{new Date(a.assigned_at).toLocaleDateString('es-US', { day: 'numeric', month: 'short' })}</span>
                  </div>
                </div>
                {caseLink && (
                  <Link href={caseLink}>
                    <Button variant="outline" size="sm"><ChevronRight className="w-3 h-3" /> Ver caso</Button>
                  </Link>
                )}
              </div>

              {/* Notes — editable */}
              <div className="p-3 rounded-xl bg-[#F2A900]/5 border border-[#F2A900]/20 mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-[#9a6500] flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> Instrucciones / Notas
                  </span>
                  {!isEditing && (
                    <button onClick={() => { setEditingId(a.id); setEditNotes(a.task_description || '') }}
                      className="text-xs text-[#9a6500] hover:text-[#F2A900] flex items-center gap-1">
                      <Pencil className="w-3 h-3" /> Editar
                    </button>
                  )}
                </div>
                {isEditing ? (
                  <div className="space-y-2">
                    <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)}
                      placeholder="Escribe instrucciones, feedback, correcciones..." rows={4} />
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-[#002855]" disabled={savingId === a.id}
                        onClick={() => saveNotes(a.id)}>
                        {savingId === a.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                        Guardar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {a.task_description || <span className="text-gray-400 italic">Sin notas — toca Editar para agregar</span>}
                  </p>
                )}
              </div>

              {/* Upload documents */}
              <div className="flex items-center gap-2 mb-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-gray-300 cursor-pointer text-xs text-gray-500 hover:border-[#F2A900] hover:text-[#F2A900] transition-colors">
                  {uploadingId === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                  {uploadingId === a.id ? 'Subiendo...' : 'Subir documento para Diana'}
                  <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden"
                    disabled={uploadingId !== null}
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) uploadFileToTask(a.id, file)
                      e.target.value = ''
                    }} />
                </label>
              </div>

              {/* Submission stats */}
              {a.submissionStats.total > 0 && (
                <div className="flex items-center gap-3 text-xs mb-3">
                  <span className="text-gray-400">{a.submissionStats.total} envío{a.submissionStats.total !== 1 ? 's' : ''}</span>
                  {a.submissionStats.submitted > 0 && (
                    <span className="text-purple-600 font-medium">{a.submissionStats.submitted} pendiente{a.submissionStats.submitted !== 1 ? 's' : ''}</span>
                  )}
                  {a.submissionStats.approved > 0 && (
                    <span className="text-green-600">{a.submissionStats.approved} aprobado{a.submissionStats.approved !== 1 ? 's' : ''}</span>
                  )}
                </div>
              )}

              {/* Status controls for Henry */}
              <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-400 mr-1">Cambiar estado:</span>
                {['assigned', 'in_progress', 'needs_correction', 'approved', 'completed'].map(s => {
                  const sc = STATUS_CONFIG[s]
                  const isActive = a.status === s
                  return (
                    <button key={s} onClick={() => !isActive && updateTaskStatus(a.id, s)}
                      disabled={savingId === a.id}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                        isActive ? sc.color + ' ring-1 ring-offset-1 ring-gray-300' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                      }`}>
                      {sc.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
