'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  ArrowLeft, FileText, Download, Send, Loader2,
  CheckCircle, AlertTriangle, Clock, Upload, Trash2,
  Briefcase, MessageSquare,
} from 'lucide-react'
import Link from 'next/link'
import { AdminKeyframes } from '@/components/admin-ui'

interface Assignment {
  id: string
  task_description: string | null
  status: string
  assigned_at: string
  service_type: string | null
  client_name: string | null
}

interface Doc {
  id: string
  name: string
  file_url: string
  file_size: number
  uploaded_at: string
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
}

type SubStatusKey = 'draft' | 'submitted' | 'needs_correction' | 'approved'

const SUB_STATUS: Record<SubStatusKey, { label: string; icon: typeof Clock; bg: string; text: string; border: string }> = {
  draft:            { label: 'Borrador',     icon: Clock,         bg: 'var(--admin-bg-elev-2)',     text: 'var(--admin-fg-muted)', border: 'var(--admin-border-strong)' },
  submitted:        { label: 'Enviado',      icon: Send,          bg: 'var(--admin-accent-soft)',   text: 'var(--admin-accent)',   border: 'var(--admin-border-strong)' },
  needs_correction: { label: 'Correcciones', icon: AlertTriangle, bg: 'var(--admin-red-soft)',      text: 'var(--admin-red)',      border: 'var(--admin-red)' },
  approved:         { label: 'Aprobado',     icon: CheckCircle,   bg: 'var(--admin-green-soft)',    text: 'var(--admin-green)',    border: 'var(--admin-green)' },
}

export function EmployeeTaskView({ assignment: initialAssignment, documents, submissions }: {
  assignment: Assignment
  documents: Doc[]
  submissions: Submission[]
}) {
  const [assignment, setAssignment] = useState(initialAssignment)
  const [subs, setSubs] = useState(submissions)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [tab, setTab] = useState<'docs' | 'workspace'>('docs')
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function updateMyStatus(newStatus: string) {
    setStatusLoading(true)
    try {
      const res = await fetch('/api/employee/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: assignment.id, status: newStatus }),
      })
      if (!res.ok) throw new Error()
      setAssignment(prev => ({ ...prev, status: newStatus }))
      toast.success('Estado actualizado')
    } catch {
      toast.error('Error al actualizar estado')
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
      if (!res.ok) throw new Error()
      const { submission } = await res.json()
      setSubs(prev => [submission, ...prev])
      setTitle('')
      setContent('')
      setFile(null)
      toast.success('Trabajo enviado al abogado para revisión')
      router.refresh()
    } catch {
      toast.error('Error al enviar')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <AdminKeyframes />
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link
          href="/employee/dashboard"
          className="inline-flex items-center justify-center w-9 h-9 rounded-full mt-1 transition-colors flex-shrink-0"
          style={{
            background: 'var(--admin-bg-elev)',
            border: '0.5px solid var(--admin-border-strong)',
            color: 'var(--admin-fg-muted)',
          }}
          aria-label="Volver"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <p
            style={{
              fontFamily: 'var(--font-mono-tech)',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.2em',
              color: 'var(--admin-accent)',
              marginBottom: 4,
            }}
          >
            TAREA ASIGNADA
          </p>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: '-0.025em',
              color: 'var(--admin-fg)',
            }}
          >
            {assignment.client_name || 'Trabajo Asignado'}
          </h1>
          {assignment.service_type && (
            <div className="mt-2">
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full"
                style={{
                  background: 'var(--admin-accent-soft)',
                  color: 'var(--admin-accent)',
                  border: '0.5px solid var(--admin-border-strong)',
                  fontFamily: 'var(--font-mono-tech)',
                  fontSize: 10,
                  letterSpacing: '0.05em',
                }}
              >
                {assignment.service_type}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Status selector */}
      <div
        className="p-4 rounded-2xl"
        style={{
          background: 'var(--admin-panel-grad)',
          border: '0.5px solid var(--admin-border-strong)',
          boxShadow: 'var(--admin-shadow)',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-mono-tech)',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.18em',
            color: 'var(--admin-fg-subtle)',
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          Estado de la tarea
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { value: 'in_progress', label: 'En progreso', bg: 'var(--admin-gold-soft)',     text: 'var(--admin-gold)',    border: 'var(--admin-gold-border, var(--admin-gold))' },
            { value: 'submitted',   label: 'Enviado a revisión', bg: 'var(--admin-accent-soft)', text: 'var(--admin-accent)', border: 'var(--admin-border-strong)' },
          ].map(s => {
            const active = assignment.status === s.value
            return (
              <button
                key={s.value}
                onClick={() => updateMyStatus(s.value)}
                disabled={statusLoading || active}
                className="px-3 py-2 rounded-full transition-all disabled:cursor-default"
                style={{
                  background: active ? s.bg : 'var(--admin-bg-elev)',
                  color: active ? s.text : 'var(--admin-fg-muted)',
                  border: `0.5px solid ${active ? s.border : 'var(--admin-border-strong)'}`,
                  fontSize: 12,
                  fontWeight: 600,
                  boxShadow: active ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                  opacity: statusLoading && !active ? 0.6 : 1,
                }}
              >
                {s.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Instructions from Henry */}
      {assignment.task_description && (
        <div
          className="p-5 rounded-2xl"
          style={{
            background: 'var(--admin-gold-soft)',
            border: '0.5px solid var(--admin-gold-border, var(--admin-gold))',
            boxShadow: 'var(--admin-shadow-gold, 0 12px 28px rgba(216,155,29,0.18))',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4" style={{ color: 'var(--admin-gold)' }} />
            <span
              style={{
                fontFamily: 'var(--font-mono-tech)',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.16em',
                color: 'var(--admin-gold)',
                textTransform: 'uppercase',
              }}
            >
              Instrucciones del Abogado
            </span>
          </div>
          <p style={{ fontSize: 14, color: 'var(--admin-fg)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
            {assignment.task_description}
          </p>
          <p
            style={{
              fontSize: 11,
              color: 'var(--admin-fg-muted)',
              marginTop: 10,
              fontFamily: 'var(--font-mono-tech)',
              letterSpacing: '0.05em',
            }}
          >
            Asignado {new Date(assignment.assigned_at).toLocaleDateString('es-US', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div
        className="flex gap-1 p-1 rounded-xl"
        style={{
          background: 'var(--admin-bg-deep)',
          border: '0.5px solid var(--admin-border)',
        }}
      >
        {[
          { id: 'docs' as const, label: 'Documentos', count: documents.length, icon: FileText },
          { id: 'workspace' as const, label: 'Mi Trabajo', count: subs.length, icon: Briefcase },
        ].map((t) => {
          const active = tab === t.id
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all"
              style={{
                background: active ? 'var(--admin-bg-elev)' : 'transparent',
                color: active ? 'var(--admin-fg)' : 'var(--admin-fg-muted)',
                border: active ? '0.5px solid var(--admin-border-strong)' : '0.5px solid transparent',
                boxShadow: active ? 'var(--admin-shadow)' : 'none',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <Icon className="w-4 h-4" />
              {t.label} ({t.count})
            </button>
          )
        })}
      </div>

      {/* Documents tab */}
      {tab === 'docs' && (
        <div className="space-y-2">
          {documents.length === 0 ? (
            <div
              className="rounded-2xl p-10 text-center"
              style={{
                background: 'var(--admin-panel-grad)',
                border: '0.5px dashed var(--admin-border-strong)',
              }}
            >
              <p style={{ color: 'var(--admin-fg-muted)', fontSize: 14 }}>No hay documentos adjuntos.</p>
            </div>
          ) : (
            documents.map(doc => (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-4 rounded-xl"
                style={{
                  background: 'var(--admin-panel-grad)',
                  border: '0.5px solid var(--admin-border-strong)',
                  boxShadow: 'var(--admin-shadow)',
                }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: 'var(--admin-blue-soft)',
                    border: '0.5px solid var(--admin-border-strong)',
                  }}
                >
                  <FileText className="w-5 h-5" style={{ color: 'var(--admin-blue)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="truncate"
                    style={{ fontSize: 13, fontWeight: 500, color: 'var(--admin-fg)' }}
                  >
                    {doc.name}
                  </p>
                  <p
                    style={{
                      fontSize: 11,
                      color: 'var(--admin-fg-subtle)',
                      fontFamily: 'var(--font-mono-tech)',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {(doc.file_size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
                <a
                  href={`/api/employee/download-doc?id=${doc.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-9 h-9 rounded-full transition-colors"
                  style={{
                    background: 'var(--admin-bg-elev-2)',
                    color: 'var(--admin-fg-muted)',
                    border: '0.5px solid var(--admin-border-strong)',
                  }}
                  aria-label="Descargar"
                >
                  <Download className="w-4 h-4" />
                </a>
              </div>
            ))
          )}
        </div>
      )}

      {/* Workspace tab */}
      {tab === 'workspace' && (
        <div className="space-y-4">
          <div
            className="p-5 rounded-2xl space-y-3"
            style={{
              background: 'var(--admin-panel-grad)',
              border: '0.5px dashed var(--admin-border-strong)',
            }}
          >
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--admin-fg)' }}>Nuevo envío</h3>
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
            <div className="flex items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f) }}
              />
              {file ? (
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1"
                  style={{
                    background: 'var(--admin-blue-soft)',
                    border: '0.5px solid var(--admin-blue)',
                    color: 'var(--admin-blue)',
                    fontSize: 13,
                  }}
                >
                  <FileText className="w-4 h-4 shrink-0" />
                  <span className="truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = '' }}
                    aria-label="Quitar archivo"
                  >
                    <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--admin-red)' }} />
                  </button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-1" /> Adjuntar PDF
                </Button>
              )}
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={sending || (!content.trim() && !file)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, var(--admin-accent), var(--admin-blue))',
                color: '#FFFFFF',
                border: '0.5px solid rgba(255,255,255,0.2)',
                boxShadow: '0 12px 28px rgba(30,78,154,0.25)',
              }}
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span style={{ fontSize: 13, fontWeight: 600 }}>Enviar al Abogado</span>
            </button>
          </div>

          {subs.map(sub => {
            const sc = SUB_STATUS[(sub.status as SubStatusKey)] || SUB_STATUS.draft
            const Icon = sc.icon
            return (
              <div
                key={sub.id}
                className="p-4 rounded-2xl"
                style={{
                  background: 'var(--admin-panel-grad)',
                  border: '0.5px solid var(--admin-border-strong)',
                  boxShadow: 'var(--admin-shadow)',
                }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-fg)' }}>
                    {sub.title || 'Sin título'}
                  </p>
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                    style={{
                      background: sc.bg,
                      color: sc.text,
                      border: `0.5px solid ${sc.border}`,
                      fontFamily: 'var(--font-mono-tech)',
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.1em',
                    }}
                  >
                    <Icon className="w-3 h-3" />
                    {sc.label.toUpperCase()}
                  </span>
                </div>
                {sub.content && (
                  <p
                    className="line-clamp-4 whitespace-pre-wrap"
                    style={{ fontSize: 13, color: 'var(--admin-fg-muted)', lineHeight: 1.5, marginBottom: 8 }}
                  >
                    {sub.content}
                  </p>
                )}
                {sub.file_name && (
                  <div
                    className="flex items-center gap-2 mb-2"
                    style={{ fontSize: 12, color: 'var(--admin-blue)' }}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {sub.file_name}
                  </div>
                )}
                {sub.admin_notes && (
                  <div
                    className="mt-2 p-3 rounded-xl"
                    style={{
                      background: 'var(--admin-gold-soft)',
                      border: '0.5px solid var(--admin-gold-border, var(--admin-gold))',
                    }}
                  >
                    <p
                      style={{
                        fontFamily: 'var(--font-mono-tech)',
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.14em',
                        color: 'var(--admin-gold)',
                        marginBottom: 4,
                      }}
                    >
                      NOTAS DEL ABOGADO
                    </p>
                    <p style={{ fontSize: 13, color: 'var(--admin-gold)' }}>{sub.admin_notes}</p>
                  </div>
                )}
                <p
                  style={{
                    fontSize: 11,
                    color: 'var(--admin-fg-subtle)',
                    marginTop: 10,
                    fontFamily: 'var(--font-mono-tech)',
                    letterSpacing: '0.05em',
                  }}
                >
                  {new Date(sub.created_at).toLocaleDateString('es-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
