'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  ArrowLeft, FileText, Download, Send, Loader2,
  CheckCircle, AlertTriangle, Clock, Upload, Trash2,
  User, Briefcase, MessageSquare, BookOpen,
} from 'lucide-react'
import Link from 'next/link'

interface CaseData {
  id: string
  case_number: string
  client: { first_name: string; last_name: string; email: string; phone: string }
  service: { name: string }
}

interface Assignment {
  id: string
  task_description: string | null
  status: string
  assigned_at: string
}

interface Doc {
  id: string
  document_key: string
  name: string
  file_size: number | null
  status: string
  created_at: string
}

interface FormSubmission {
  form_type: string
  form_data: Record<string, unknown>
  status: string
  updated_at: string
}

interface Submission {
  id: string
  title: string | null
  content: string | null
  file_url: string | null
  file_name: string | null
  status: string
  admin_notes: string | null
  created_at: string
  updated_at: string
}

const SUB_STATUS: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  draft:            { label: 'Borrador',     color: 'bg-gray-100 text-gray-600',   icon: Clock },
  submitted:        { label: 'Enviado',      color: 'bg-purple-100 text-purple-700', icon: Send },
  needs_correction: { label: 'Correcciones', color: 'bg-red-100 text-red-700',     icon: AlertTriangle },
  approved:         { label: 'Aprobado',     color: 'bg-green-100 text-green-700', icon: CheckCircle },
}

export function EmployeeCaseView({ caseData, assignment, documents, formSubmissions = [], submissions }: {
  caseData: CaseData
  assignment: Assignment
  documents: Doc[]
  formSubmissions?: FormSubmission[]
  submissions: Submission[]
}) {
  const [currentAssignment, setCurrentAssignment] = useState(assignment)
  const [subs, setSubs] = useState(submissions)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [tab, setTab] = useState<'docs' | 'forms' | 'workspace'>('docs')
  const i589Subs = formSubmissions.filter(s => s.form_type.startsWith('i589_'))
  const storySubs = formSubmissions.filter(s => ['client_story', 'client_witnesses', 'client_absent_parent', 'tutor_guardian'].includes(s.form_type))
  const hasFormData = i589Subs.length > 0 || storySubs.length > 0
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function updateMyStatus(newStatus: string) {
    setStatusLoading(true)
    try {
      const res = await fetch('/api/employee/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: currentAssignment.id, status: newStatus }),
      })
      if (!res.ok) throw new Error()
      setCurrentAssignment(prev => ({ ...prev, status: newStatus }))
      toast.success('Estado actualizado')
    } catch {
      toast.error('Error al actualizar')
    } finally {
      setStatusLoading(false)
    }
  }

  async function handleSubmit() {
    if (!content.trim() && !file) {
      toast.error('Escribe algo o adjunta un archivo')
      return
    }

    setSending(true)
    try {
      const fd = new FormData()
      fd.append('assignment_id', assignment.id)
      fd.append('title', title.trim() || 'Sin título')
      fd.append('content', content)
      if (file) fd.append('file', file)

      const res = await fetch('/api/employee/submit-work', { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al enviar')
      }
      const { submission } = await res.json()
      setSubs(prev => [submission, ...prev])
      setTitle('')
      setContent('')
      setFile(null)
      toast.success('Trabajo enviado al abogado para revisión')
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al enviar'
      toast.error(message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/employee/dashboard">
          <Button variant="ghost" size="icon" className="mt-0.5">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">
            {caseData.client.first_name} {caseData.client.last_name}
          </h1>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-gray-400">#{caseData.case_number}</span>
            <Badge variant="secondary" className="text-[10px]">{caseData.service.name}</Badge>
          </div>
        </div>
      </div>

      {/* Status selector */}
      <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Estado de la tarea</p>
        <div className="flex flex-wrap gap-2">
          {[
            { value: 'in_progress', label: 'En progreso', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
            { value: 'submitted', label: 'Enviado a revisión', color: 'bg-purple-100 text-purple-700 border-purple-300' },
          ].map(s => (
            <button key={s.value} onClick={() => updateMyStatus(s.value)}
              disabled={statusLoading || currentAssignment.status === s.value}
              className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                currentAssignment.status === s.value
                  ? s.color + ' ring-2 ring-offset-1 ring-gray-300'
                  : 'border-gray-200 text-gray-400 hover:border-gray-300'
              }`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Task from Henry */}
      {assignment.task_description && (
        <div className="p-4 rounded-2xl border-2 border-[#F2A900]/30 bg-[#F2A900]/5">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-[#F2A900]" />
            <span className="text-xs font-bold text-[#9a6500] uppercase tracking-wider">Instrucciones del Abogado</span>
          </div>
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{assignment.task_description}</p>
          <p className="text-[11px] text-gray-400 mt-2">
            Asignado {new Date(assignment.assigned_at).toLocaleDateString('es-US', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
      )}

      {/* Client info card */}
      <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200">
        <div className="flex items-center gap-2 mb-2">
          <User className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Cliente</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-400 text-xs">Nombre</span>
            <p className="font-medium text-gray-800">{caseData.client.first_name} {caseData.client.last_name}</p>
          </div>
          <div>
            <span className="text-gray-400 text-xs">Teléfono</span>
            <p className="font-medium text-gray-800">{caseData.client.phone || '—'}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
        <button onClick={() => setTab('docs')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
            tab === 'docs' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}>
          <FileText className="w-4 h-4" /> Docs ({documents.length})
        </button>
        {hasFormData && (
          <button onClick={() => setTab('forms')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
              tab === 'forms' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}>
            <BookOpen className="w-4 h-4" /> Formularios ({i589Subs.length + storySubs.length})
          </button>
        )}
        <button onClick={() => setTab('workspace')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
            tab === 'workspace' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}>
          <Briefcase className="w-4 h-4" /> Mi Trabajo ({subs.length})
        </button>
      </div>

      {/* Documents tab */}
      {tab === 'docs' && (
        <div className="space-y-2">
          {documents.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">No hay documentos aún.</p>
          ) : (
            documents.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 p-4 rounded-xl bg-white border border-gray-200">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                  <p className="text-[11px] text-gray-400">
                    {doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : ''}
                    {' · '}
                    {new Date(doc.created_at).toLocaleDateString('es-US', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <a
                  href={`/api/employee/download-case-doc?id=${doc.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Download className="w-4 h-4 text-gray-500" />
                </a>
              </div>
            ))
          )}
        </div>
      )}

      {/* Forms tab — I-589, historia, tutor */}
      {tab === 'forms' && (
        <div className="space-y-3">
          {/* I-589 submissions */}
          {i589Subs.length > 0 && (
            <div className="rounded-2xl border border-indigo-200 overflow-hidden">
              <div className="px-4 py-3 bg-indigo-50">
                <p className="text-sm font-bold text-indigo-900">Formulario I-589 — Asilo</p>
                <p className="text-xs text-indigo-600">{i589Subs.length} sección{i589Subs.length !== 1 ? 'es' : ''} completada{i589Subs.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="divide-y divide-indigo-100">
                {i589Subs.map(sub => {
                  const d = sub.form_data as Record<string, string>
                  const label = sub.form_type === 'i589_part_b1' ? 'Parte B1' : sub.form_type === 'i589_part_b2' ? 'Parte B2' : sub.form_type === 'i589_part_c1' ? 'Parte C1' : 'Parte C2'
                  return (
                    <div key={sub.form_type} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-indigo-700">{label}</span>
                        <Badge className={sub.status === 'submitted' ? 'bg-purple-100 text-purple-700' : sub.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
                          {sub.status === 'submitted' ? 'Enviado' : sub.status === 'approved' ? 'Aprobado' : sub.status}
                        </Badge>
                      </div>
                      <div className="grid gap-1.5">
                        {Object.entries(d).filter(([, v]) => v && typeof v === 'string' && v.trim()).slice(0, 8).map(([k, v]) => (
                          <div key={k}>
                            <span className="text-[10px] font-medium text-gray-400">{k.replace(/_/g, ' ')}</span>
                            <p className="text-xs text-gray-700 line-clamp-3">{v as string}</p>
                          </div>
                        ))}
                        {Object.entries(d).filter(([, v]) => v && typeof v === 'string' && (v as string).trim()).length > 8 && (
                          <p className="text-[10px] text-indigo-500">+{Object.entries(d).filter(([, v]) => v && typeof v === 'string' && (v as string).trim()).length - 8} campos más</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Story / tutor submissions */}
          {storySubs.length > 0 && (
            <div className="rounded-2xl border border-blue-200 overflow-hidden">
              <div className="px-4 py-3 bg-blue-50">
                <p className="text-sm font-bold text-blue-900">Historia del Cliente</p>
                <p className="text-xs text-blue-600">{storySubs.length} formulario{storySubs.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="divide-y divide-blue-100">
                {storySubs.map(sub => {
                  const d = sub.form_data as Record<string, unknown>
                  const label = sub.form_type === 'tutor_guardian' ? 'Declaración del Tutor' : sub.form_type === 'client_story' ? 'Historia del Menor' : sub.form_type === 'client_witnesses' ? 'Testigos' : 'Padre Ausente'
                  return (
                    <div key={sub.form_type + sub.updated_at} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-blue-700">{label}</span>
                        <Badge className={sub.status === 'submitted' ? 'bg-purple-100 text-purple-700' : sub.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
                          {sub.status === 'submitted' ? 'Enviado' : sub.status === 'approved' ? 'Aprobado' : sub.status}
                        </Badge>
                      </div>
                      <div className="grid gap-1.5">
                        {Object.entries(d).filter(([, v]) => v && typeof v === 'string' && (v as string).trim()).slice(0, 6).map(([k, v]) => (
                          <div key={k}>
                            <span className="text-[10px] font-medium text-gray-400">{k.replace(/_/g, ' ')}</span>
                            <p className="text-xs text-gray-700 line-clamp-3">{v as string}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {!hasFormData && (
            <p className="text-center text-gray-400 py-8 text-sm">No hay formularios completados para este caso.</p>
          )}
        </div>
      )}

      {/* Workspace tab */}
      {tab === 'workspace' && (
        <div className="space-y-4">
          {/* New submission form */}
          <div className="p-5 rounded-2xl border-2 border-dashed border-gray-300 bg-white space-y-3">
            <h3 className="text-sm font-bold text-gray-900">Nuevo envío</h3>

            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Título del documento (ej: Proyección de Apelación)"
              className="h-11"
            />

            <Textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Escribe aquí tu redacción, notas, o proyección..."
              rows={8}
              className="resize-none"
            />

            {/* File attach */}
            <div className="flex items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f && f.size > 40 * 1024 * 1024) {
                    toast.error('Máximo 40MB')
                    return
                  }
                  setFile(f || null)
                }}
              />
              {file ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700 flex-1">
                  <FileText className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{file.name}</span>
                  <button onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = '' }}>
                    <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-600" />
                  </button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="w-4 h-4 mr-1" />
                  Adjuntar PDF
                </Button>
              )}
            </div>

            <Button
              onClick={handleSubmit}
              disabled={sending || (!content.trim() && !file)}
              className="bg-[#002855] hover:bg-[#001d3d]"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Enviar al Abogado
            </Button>
          </div>

          {/* Previous submissions */}
          {subs.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Envíos anteriores</h3>
              {subs.map(sub => {
                const sc = SUB_STATUS[sub.status] || SUB_STATUS.draft
                const Icon = sc.icon
                return (
                  <div key={sub.id} className="p-4 rounded-2xl bg-white border border-gray-200">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="font-semibold text-gray-900 text-sm">{sub.title || 'Sin título'}</p>
                      <Badge className={sc.color}>
                        <Icon className="w-3 h-3 mr-1" />
                        {sc.label}
                      </Badge>
                    </div>

                    {sub.content && (
                      <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-4 mb-2">{sub.content}</p>
                    )}

                    {sub.file_name && (
                      <div className="flex items-center gap-2 text-xs text-blue-600 mb-2">
                        <FileText className="w-3.5 h-3.5" />
                        {sub.file_name}
                      </div>
                    )}

                    {sub.admin_notes && (
                      <div className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                        <p className="text-xs font-bold text-amber-700 mb-1">Notas del Abogado:</p>
                        <p className="text-sm text-amber-800">{sub.admin_notes}</p>
                      </div>
                    )}

                    <p className="text-[11px] text-gray-400 mt-2">
                      {new Date(sub.created_at).toLocaleDateString('es-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
