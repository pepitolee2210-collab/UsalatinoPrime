'use client'

import { useState } from 'react'
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
  docs: { id: string; name: string; file_url: string; file_size: number }[]
}

interface StatusStyle {
  label: string
  bg: string
  border: string
  text: string
  dot: string
  icon: typeof Clock
}

const STATUS_STYLES: Record<string, StatusStyle> = {
  assigned:         { label: 'Asignado',           bg: 'rgba(96,165,250,0.10)',  border: 'rgba(96,165,250,0.3)',  text: '#93C5FD', dot: '#60A5FA', icon: Clock },
  in_progress:      { label: 'En progreso',         bg: 'rgba(250,204,21,0.10)',  border: 'rgba(250,204,21,0.3)',  text: '#FDE68A', dot: '#FACC15', icon: FileText },
  submitted:        { label: 'Enviado a revisión',  bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.3)', text: '#C4B5FD', dot: '#A78BFA', icon: Send },
  needs_correction: { label: 'Correcciones',        bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.3)', text: '#FCA5A5', dot: '#F87171', icon: AlertTriangle },
  approved:         { label: 'Aprobado',            bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.3)',   text: '#86EFAC', dot: '#4ADE80', icon: CheckCircle },
  completed:        { label: 'Completado',          bg: 'var(--admin-accent-soft)', border: 'var(--admin-border-strong)', text: 'var(--admin-fg-muted)', dot: 'var(--admin-fg-muted)', icon: CheckCircle },
}

interface Service { id: string; name: string }
interface ActiveCase {
  id: string; case_number: string
  client: { first_name: string; last_name: string } | null
  service: { name: string } | null
}

const BTN_PRIMARY =
  'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full transition-all duration-200 hover:opacity-90 active:scale-95 disabled:opacity-50 ' +
  'bg-white text-black text-[12px] font-semibold tracking-tight ' +
  'shadow-[0_4px_18px_rgba(255,255,255,0.18),0_0_0_0.5px_rgba(255,255,255,0.4)_inset]'

const BTN_GHOST =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200 hover:bg-white/10 active:scale-95 disabled:opacity-50 ' +
  'bg-white/[0.04] border border-white/10 text-white text-[11px] font-semibold tracking-tight'

export function EmployeeTasksView({ employees, assignments: initial, services, activeCases }: {
  employees: Employee[]
  assignments: Assignment[]
  services: Service[]
  activeCases: ActiveCase[]
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

  const filtered = filter === 'all' ? assignments : assignments.filter(a => a.status === filter)

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
      setAssignments(prev => prev.map(a => a.id === assignmentId ? { ...a, task_description: editNotes } : a))
      setEditingId(null)
      toast.success('Notas actualizadas')
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
      setAssignments(prev => prev.map(a => a.id === assignmentId ? { ...a, status: newStatus } : a))
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
          <AssignTaskButton services={services} employees={employees} activeCases={activeCases} />
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total tareas" value={assignments.length} tone="white" />
        <StatCard label="En progreso" value={inProgress} tone="info" />
        <StatCard label="Por revisar" value={pendingReview} tone="purple" />
        <StatCard label="Completados" value={completed} tone="success" />
      </div>

      {/* Employees */}
      {employees.length > 0 && (
        <div
          className="rounded-2xl p-5"
          style={{
            background: 'linear-gradient(180deg, rgba(20,20,20,0.92), rgba(8,8,8,0.92))',
            border: '0.5px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <p
            className="mb-4"
            style={{
              fontFamily: 'var(--font-mono-tech)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.2em',
              color: 'var(--admin-fg-subtle)',
            }}
          >
            EQUIPO
          </p>
          <div className="flex flex-wrap gap-3">
            {employees.map(emp => {
              const empTasks = assignments.filter(a => a.employee?.id === emp.id)
              const empPending = empTasks.filter(a => a.status === 'submitted').length
              return (
                <div
                  key={emp.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{
                    background: 'rgba(255,255,255,0.025)',
                    border: '0.5px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.04))',
                      border: '0.5px solid rgba(255,255,255,0.18)',
                      color: '#FFFFFF',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {emp.first_name[0]}{emp.last_name[0]}
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#FFFFFF', letterSpacing: '-0.005em' }}>
                      {emp.first_name} {emp.last_name}
                    </p>
                    <p style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 10, color: 'var(--admin-fg-subtle)', letterSpacing: '0.05em' }}>
                      {empTasks.length} TAREA{empTasks.length !== 1 ? 'S' : ''}
                    </p>
                  </div>
                  {empPending > 0 && (
                    <span
                      className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                      style={{
                        background: 'rgba(167,139,250,0.10)',
                        border: '0.5px solid rgba(167,139,250,0.3)',
                        fontFamily: 'var(--font-mono-tech)',
                        fontSize: 9,
                        fontWeight: 700,
                        color: '#C4B5FD',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {empPending} POR REVISAR
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-3.5 h-3.5" style={{ color: 'var(--admin-fg-subtle)' }} />
        <div
          className="inline-flex items-center gap-1 p-1 rounded-full"
          style={{
            background: 'var(--admin-accent-soft)',
            border: '0.5px solid rgba(255,255,255,0.08)',
          }}
        >
          {[
            { value: 'all', label: 'Todas' },
            { value: 'submitted', label: 'Por revisar' },
            { value: 'assigned', label: 'Asignadas' },
            { value: 'needs_correction', label: 'Correcciones' },
            { value: 'approved', label: 'Aprobadas' },
          ].map(f => {
            const isActive = filter === f.value
            return (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className="px-3 py-1.5 rounded-full transition-all duration-300"
                style={{
                  background: isActive ? '#FFFFFF' : 'transparent',
                  color: isActive ? 'var(--admin-bg-deep)' : 'var(--admin-fg-muted)',
                  fontSize: 11.5,
                  fontWeight: isActive ? 700 : 500,
                  letterSpacing: '-0.005em',
                  boxShadow: isActive ? '0 0 12px rgba(255,255,255,0.15)' : 'none',
                }}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Task list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div
            className="rounded-2xl py-16 text-center"
            style={{
              background: 'linear-gradient(180deg, rgba(20,20,20,0.7), rgba(8,8,8,0.7))',
              border: '0.5px solid rgba(255,255,255,0.08)',
            }}
          >
            <Briefcase className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--admin-fg-subtle)' }} />
            <p style={{ fontSize: 13, color: 'var(--admin-fg-subtle)', fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.15em' }}>
              SIN TAREAS {filter !== 'all' ? 'CON ESTE FILTRO' : 'ASIGNADAS'}
            </p>
          </div>
        )}

        {filtered.map(a => {
          const s = STATUS_STYLES[a.status] || STATUS_STYLES.assigned
          const StatusIcon = s.icon
          const clientLabel = a.case
            ? `${a.case.client?.first_name || ''} ${a.case.client?.last_name || ''}`
            : a.client_name || 'Sin cliente'
          const serviceLabel = a.case?.service?.name || a.service_type || '—'
          const caseLink = a.case ? `/admin/cases/${a.case.id}` : null
          const isEditing = editingId === a.id

          return (
            <div
              key={a.id}
              className="rounded-2xl p-5"
              style={{
                background: 'linear-gradient(180deg, rgba(20,20,20,0.92), rgba(8,8,8,0.92))',
                border: '0.5px solid rgba(255,255,255,0.1)',
                backdropFilter: 'blur(20px)',
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#FFFFFF', letterSpacing: '-0.005em' }}>
                      {clientLabel}
                    </span>
                    {a.case && (
                      <span style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 11, fontWeight: 700, color: 'var(--admin-fg-subtle)', letterSpacing: '0.05em' }}>
                        #{a.case.case_number}
                      </span>
                    )}
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full"
                      style={{
                        background: s.bg,
                        border: `0.5px solid ${s.border}`,
                        fontFamily: 'var(--font-mono-tech)',
                        fontSize: 9,
                        fontWeight: 700,
                        color: s.text,
                        letterSpacing: '0.1em',
                      }}
                    >
                      <StatusIcon className="w-2.5 h-2.5" />
                      {s.label.toUpperCase()}
                    </span>
                  </div>
                  <div
                    className="flex items-center gap-3 flex-wrap"
                    style={{
                      fontFamily: 'var(--font-mono-tech)',
                      fontSize: 10,
                      color: 'var(--admin-fg-muted)',
                      letterSpacing: '0.05em',
                    }}
                  >
                    <span>{serviceLabel.toUpperCase()}</span>
                    <span style={{ color: '#3F3F46' }}>·</span>
                    <span className="inline-flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {a.employee ? `${a.employee.first_name} ${a.employee.last_name}`.toUpperCase() : 'SIN ASIGNAR'}
                    </span>
                    <span style={{ color: '#3F3F46' }}>·</span>
                    <span>{new Date(a.assigned_at).toLocaleDateString('es-US', { day: 'numeric', month: 'short' }).toUpperCase()}</span>
                  </div>
                </div>
                {caseLink && (
                  <Link href={caseLink} className={BTN_GHOST}>
                    <ChevronRight className="w-3 h-3" /> Ver caso
                  </Link>
                )}
              </div>

              {/* Notes — editable */}
              <div
                className="p-3.5 rounded-xl mb-3"
                style={{
                  background: 'rgba(250,204,21,0.06)',
                  border: '0.5px solid rgba(250,204,21,0.25)',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="inline-flex items-center gap-1.5"
                    style={{
                      fontFamily: 'var(--font-mono-tech)',
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#FACC15',
                      letterSpacing: '0.18em',
                    }}
                  >
                    <MessageSquare className="w-3 h-3" /> INSTRUCCIONES
                  </span>
                  {!isEditing && (
                    <button
                      onClick={() => { setEditingId(a.id); setEditNotes(a.task_description || '') }}
                      className="inline-flex items-center gap-1 transition-opacity hover:opacity-80"
                      style={{
                        fontFamily: 'var(--font-mono-tech)',
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#FACC15',
                        letterSpacing: '0.1em',
                      }}
                    >
                      <Pencil className="w-3 h-3" /> EDITAR
                    </button>
                  )}
                </div>
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editNotes}
                      onChange={e => setEditNotes(e.target.value)}
                      placeholder="Escribe instrucciones, feedback, correcciones…"
                      rows={4}
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-colors focus:border-white/30 resize-y"
                      style={{
                        background: 'var(--admin-accent-soft)',
                        border: '0.5px solid rgba(255,255,255,0.1)',
                        color: 'var(--admin-fg)',
                        fontSize: 13,
                        minHeight: 90,
                      }}
                    />
                    <div className="flex gap-2">
                      <button
                        disabled={savingId === a.id}
                        onClick={() => saveNotes(a.id)}
                        className={BTN_PRIMARY}
                      >
                        {savingId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Guardar
                      </button>
                      <button onClick={() => setEditingId(null)} className={BTN_GHOST + ' !px-4 !py-2'}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: '#FDE68A', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                    {a.task_description || (
                      <span style={{ color: 'var(--admin-fg-subtle)', fontStyle: 'italic' }}>Sin notas — toca Editar para agregar</span>
                    )}
                  </p>
                )}
              </div>

              {/* Documents section */}
              <div
                className="p-3.5 rounded-xl mb-3"
                style={{
                  background: 'rgba(255,255,255,0.025)',
                  border: '0.5px solid rgba(255,255,255,0.06)',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="inline-flex items-center gap-1.5"
                    style={{
                      fontFamily: 'var(--font-mono-tech)',
                      fontSize: 10,
                      fontWeight: 700,
                      color: 'var(--admin-fg-muted)',
                      letterSpacing: '0.18em',
                    }}
                  >
                    <FileText className="w-3 h-3" />
                    DOCUMENTOS ({a.docs.length})
                  </span>
                  <label
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-opacity hover:opacity-90 cursor-pointer"
                    style={{
                      background: '#FFFFFF',
                      color: 'var(--admin-bg-deep)',
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: '-0.005em',
                      boxShadow: '0 0 12px rgba(255,255,255,0.15)',
                    }}
                  >
                    {uploadingId === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    {uploadingId === a.id ? 'Subiendo…' : 'Subir PDF'}
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      className="hidden"
                      disabled={uploadingId !== null}
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) uploadFileToTask(a.id, file)
                        e.target.value = ''
                      }}
                    />
                  </label>
                </div>
                {a.docs.length > 0 ? (
                  <div className="space-y-1.5">
                    {a.docs.map(doc => (
                      <div
                        key={doc.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg"
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '0.5px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        <FileText className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#60A5FA' }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#FFFFFF', letterSpacing: '-0.005em' }} className="truncate flex-1">
                          {doc.name}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 10, color: 'var(--admin-fg-subtle)', letterSpacing: '0.05em' }}>
                          {(doc.file_size / 1024 / 1024).toFixed(1)} MB
                        </span>
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontFamily: 'var(--font-mono-tech)',
                            fontSize: 10,
                            fontWeight: 700,
                            color: '#60A5FA',
                            letterSpacing: '0.1em',
                          }}
                          className="hover:underline"
                        >
                          VER
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 11, color: 'var(--admin-fg-subtle)', fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.1em', textAlign: 'center', padding: '8px 0' }}>
                    SIN DOCUMENTOS · SUBE UN PDF PARA DIANA
                  </p>
                )}
              </div>

              {/* Submission stats */}
              {a.submissionStats.total > 0 && (
                <div className="flex items-center gap-3 flex-wrap mb-3">
                  <span style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 10, color: 'var(--admin-fg-subtle)', letterSpacing: '0.05em' }}>
                    {a.submissionStats.total} ENVÍO{a.submissionStats.total !== 1 ? 'S' : ''}
                  </span>
                  {a.submissionStats.submitted > 0 && (
                    <span style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 10, fontWeight: 700, color: '#C4B5FD', letterSpacing: '0.05em' }}>
                      {a.submissionStats.submitted} PENDIENTE{a.submissionStats.submitted !== 1 ? 'S' : ''}
                    </span>
                  )}
                  {a.submissionStats.approved > 0 && (
                    <span style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 10, fontWeight: 700, color: '#86EFAC', letterSpacing: '0.05em' }}>
                      {a.submissionStats.approved} APROBADO{a.submissionStats.approved !== 1 ? 'S' : ''}
                    </span>
                  )}
                </div>
              )}

              {/* Status controls */}
              <div className="flex items-center gap-2 flex-wrap pt-3" style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 10, color: 'var(--admin-fg-subtle)', letterSpacing: '0.18em' }}>
                  ESTADO ·
                </span>
                {['assigned', 'in_progress', 'needs_correction', 'approved', 'completed'].map(stKey => {
                  const sc = STATUS_STYLES[stKey]
                  const isActive = a.status === stKey
                  return (
                    <button
                      key={stKey}
                      onClick={() => !isActive && updateTaskStatus(a.id, stKey)}
                      disabled={savingId === a.id}
                      className="px-2.5 py-1 rounded-full transition-all duration-200"
                      style={{
                        background: isActive ? sc.bg : 'rgba(255,255,255,0.025)',
                        border: isActive ? `0.5px solid ${sc.border}` : '0.5px solid rgba(255,255,255,0.06)',
                        color: isActive ? sc.text : 'var(--admin-fg-subtle)',
                        fontFamily: 'var(--font-mono-tech)',
                        fontSize: 9,
                        fontWeight: isActive ? 700 : 500,
                        letterSpacing: '0.1em',
                      }}
                    >
                      {sc.label.toUpperCase()}
                    </button>
                  )
                })}
                <button
                  onClick={async () => {
                    if (!confirm('¿Eliminar esta tarea? Se borrarán los documentos y envíos asociados.')) return
                    setSavingId(a.id)
                    try {
                      const res = await fetch('/api/admin/delete-task', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ assignment_id: a.id }),
                      })
                      if (!res.ok) throw new Error()
                      setAssignments(prev => prev.filter(t => t.id !== a.id))
                      toast.success('Tarea eliminada')
                    } catch { toast.error('Error al eliminar') }
                    finally { setSavingId(null) }
                  }}
                  disabled={savingId === a.id}
                  className="ml-auto inline-flex items-center gap-1 px-3 py-1 rounded-full transition-all duration-200 hover:bg-red-500/15"
                  style={{
                    background: 'rgba(248,113,113,0.10)',
                    border: '0.5px solid rgba(248,113,113,0.25)',
                    color: '#FCA5A5',
                    fontFamily: 'var(--font-mono-tech)',
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                  }}
                >
                  ELIMINAR
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// StatCard
// ════════════════════════════════════════════════════════════════════

const STAT_TONE = {
  white:   { bg: 'var(--admin-accent-soft)', border: 'var(--admin-border-strong)',  valueColor: '#FFFFFF' },
  info:    { bg: 'rgba(96,165,250,0.10)',  border: 'rgba(96,165,250,0.3)',   valueColor: '#93C5FD' },
  purple:  { bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.3)',  valueColor: '#C4B5FD' },
  success: { bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.3)',    valueColor: '#86EFAC' },
} as const

function StatCard({ label, value, tone }: { label: string; value: number; tone: keyof typeof STAT_TONE }) {
  const t = STAT_TONE[tone]
  return (
    <div
      className="rounded-2xl p-4 text-center transition-transform duration-300 hover:-translate-y-0.5"
      style={{
        background: 'linear-gradient(180deg, rgba(20,20,20,0.92), rgba(8,8,8,0.92))',
        border: '0.5px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <p style={{ fontSize: 28, fontWeight: 600, color: t.valueColor, letterSpacing: '-0.025em', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
      <p
        className="mt-1"
        style={{
          fontFamily: 'var(--font-mono-tech)',
          fontSize: 9,
          fontWeight: 500,
          letterSpacing: '0.18em',
          color: 'var(--admin-fg-subtle)',
        }}
      >
        {label.toUpperCase()}
      </p>
    </div>
  )
}
