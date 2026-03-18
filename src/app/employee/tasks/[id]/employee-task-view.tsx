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
  Briefcase, MessageSquare,
} from 'lucide-react'
import Link from 'next/link'

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

const SUB_STATUS: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  draft:            { label: 'Borrador',     color: 'bg-gray-100 text-gray-600',   icon: Clock },
  submitted:        { label: 'Enviado',      color: 'bg-purple-100 text-purple-700', icon: Send },
  needs_correction: { label: 'Correcciones', color: 'bg-red-100 text-red-700',     icon: AlertTriangle },
  approved:         { label: 'Aprobado',     color: 'bg-green-100 text-green-700', icon: CheckCircle },
}

export function EmployeeTaskView({ assignment, documents, submissions }: {
  assignment: Assignment
  documents: Doc[]
  submissions: Submission[]
}) {
  const [subs, setSubs] = useState(submissions)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const [tab, setTab] = useState<'docs' | 'workspace'>('docs')
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

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
            {assignment.client_name || 'Trabajo Asignado'}
          </h1>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {assignment.service_type && (
              <Badge variant="secondary" className="text-[10px]">{assignment.service_type}</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Instructions from Henry */}
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

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
        <button
          onClick={() => setTab('docs')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            tab === 'docs' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          <FileText className="w-4 h-4" />
          Documentos ({documents.length})
        </button>
        <button
          onClick={() => setTab('workspace')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            tab === 'workspace' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Mi Trabajo ({subs.length})
        </button>
      </div>

      {/* Documents tab */}
      {tab === 'docs' && (
        <div className="space-y-2">
          {documents.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">No hay documentos adjuntos.</p>
          ) : (
            documents.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 p-4 rounded-xl bg-white border border-gray-200">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                  <p className="text-[11px] text-gray-400">
                    {(doc.file_size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-gray-100">
                  <Download className="w-4 h-4 text-gray-500" />
                </a>
              </div>
            ))
          )}
        </div>
      )}

      {/* Workspace tab */}
      {tab === 'workspace' && (
        <div className="space-y-4">
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
            <div className="flex items-center gap-3">
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f) }} />
              {file ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700 flex-1">
                  <FileText className="w-4 h-4 shrink-0" />
                  <span className="truncate">{file.name}</span>
                  <button onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = '' }}>
                    <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-600" />
                  </button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-1" /> Adjuntar PDF
                </Button>
              )}
            </div>
            <Button onClick={handleSubmit} disabled={sending || (!content.trim() && !file)} className="bg-[#002855]">
              {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Enviar al Abogado
            </Button>
          </div>

          {subs.map(sub => {
            const sc = SUB_STATUS[sub.status] || SUB_STATUS.draft
            const Icon = sc.icon
            return (
              <div key={sub.id} className="p-4 rounded-2xl bg-white border border-gray-200">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-semibold text-gray-900 text-sm">{sub.title || 'Sin título'}</p>
                  <Badge className={sc.color}><Icon className="w-3 h-3 mr-1" />{sc.label}</Badge>
                </div>
                {sub.content && <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-4 mb-2">{sub.content}</p>}
                {sub.file_name && (
                  <div className="flex items-center gap-2 text-xs text-blue-600 mb-2">
                    <FileText className="w-3.5 h-3.5" />{sub.file_name}
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
  )
}
