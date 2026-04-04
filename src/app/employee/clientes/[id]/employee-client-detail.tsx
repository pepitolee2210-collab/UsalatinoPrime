'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  ArrowLeft, FileText, BookOpen, Download, Phone, Mail, Eye, X,
} from 'lucide-react'

interface Client {
  id: string; first_name: string; last_name: string; email: string; phone: string | null
}

interface Case {
  id: string; case_number: string; service: { name: string } | null
}

interface Doc {
  id: string; case_id: string; document_key: string; name: string
  file_size: number | null; file_path: string; created_at: string
}

interface FormSub {
  form_type: string; form_data: Record<string, unknown>
  status: string; updated_at: string; case_id: string; minor_index: number
}

export function EmployeeClientDetail({ client, cases, documents, formSubmissions }: {
  client: Client; cases: Case[]; documents: Doc[]; formSubmissions: FormSub[]
}) {
  const [tab, setTab] = useState<'docs' | 'historia'>('docs')
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null)

  const tutorSub = formSubmissions.find(s => s.form_type === 'tutor_guardian')
  const storySubs = formSubmissions.filter(s => ['client_story', 'client_witnesses', 'client_absent_parent'].includes(s.form_type))
  const i589Subs = formSubmissions.filter(s => s.form_type.startsWith('i589_'))

  // Group documents by case
  const docsByCase = new Map<string, Doc[]>()
  documents.forEach(d => {
    const arr = docsByCase.get(d.case_id) || []
    arr.push(d)
    docsByCase.set(d.case_id, arr)
  })

  const isPDF = (name: string) => name.toLowerCase().endsWith('.pdf')

  return (
    <div className="space-y-5">
      {/* Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setPreviewDoc(null)}>
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 truncate">{previewDoc.name}</p>
                <p className="text-xs text-gray-500">
                  {previewDoc.file_size ? `${(previewDoc.file_size / 1024).toFixed(0)} KB` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-3">
                <a href={`/api/employee/download-case-doc?id=${previewDoc.id}`} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline"><Download className="w-3 h-3 mr-1" /> Descargar</Button>
                </a>
                <button onClick={() => setPreviewDoc(null)}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden bg-gray-100">
              {isPDF(previewDoc.name) ? (
                <iframe
                  src={`/api/employee/download-case-doc?id=${previewDoc.id}#toolbar=1`}
                  className="w-full h-[75vh]"
                  title={previewDoc.name}
                />
              ) : (
                <div className="flex items-center justify-center h-[50vh]">
                  <div className="text-center">
                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">Vista previa no disponible para este tipo de archivo</p>
                    <a href={`/api/employee/download-case-doc?id=${previewDoc.id}`} target="_blank" rel="noopener noreferrer"
                      className="text-sm text-[#F2A900] hover:underline mt-2 inline-block">
                      Descargar archivo
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/employee/clientes">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{client.first_name} {client.last_name}</h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-1">
            <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{client.email}</span>
            {client.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{client.phone}</span>}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {cases.map(c => (
              <Badge key={c.id} variant="secondary" className="text-[10px]">
                #{c.case_number} — {c.service?.name || '—'}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
        <button onClick={() => setTab('docs')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            tab === 'docs' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}>
          <FileText className="w-4 h-4" /> Documentos ({documents.length})
        </button>
        <button onClick={() => setTab('historia')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            tab === 'historia' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}>
          <BookOpen className="w-4 h-4" /> Formularios ({formSubmissions.length})
        </button>
      </div>

      {/* Documents tab */}
      {tab === 'docs' && (
        <div className="space-y-5">
          {documents.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">Este cliente no tiene documentos subidos.</p>
          ) : (
            Array.from(docsByCase.entries()).map(([caseId, caseDocs]) => {
              const caseInfo = cases.find(c => c.id === caseId)
              return (
                <div key={caseId}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-gray-500 uppercase">
                      {caseInfo ? `#${caseInfo.case_number} — ${caseInfo.service?.name || ''}` : 'Documentos'}
                    </span>
                    <span className="text-[10px] text-gray-400">({caseDocs.length})</span>
                  </div>
                  <div className="grid gap-2">
                    {caseDocs.map(doc => (
                      <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-200 hover:border-gray-300 transition-colors">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isPDF(doc.name) ? 'bg-red-50' : 'bg-blue-50'
                        }`}>
                          <FileText className={`w-4 h-4 ${isPDF(doc.name) ? 'text-red-500' : 'text-blue-500'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                          <p className="text-[10px] text-gray-400">
                            {doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB · ` : ''}
                            {new Date(doc.created_at).toLocaleDateString('es-US', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {isPDF(doc.name) && (
                            <button onClick={() => setPreviewDoc(doc)}
                              className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="Vista previa">
                              <Eye className="w-4 h-4 text-gray-500" />
                            </button>
                          )}
                          <a href={`/api/employee/download-case-doc?id=${doc.id}`} target="_blank" rel="noopener noreferrer"
                            className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="Descargar">
                            <Download className="w-4 h-4 text-gray-500" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Historia tab */}
      {tab === 'historia' && (
        <div className="space-y-3">
          {tutorSub && (
            <FormSection title="Declaración del Tutor" color="blue" status={tutorSub.status}>
              {renderFormFields(tutorSub.form_data)}
            </FormSection>
          )}

          {storySubs.length > 0 && storySubs.map((sub, i) => {
            const label = sub.form_type === 'client_story'
              ? `Declaración del Menor ${sub.minor_index + 1}`
              : sub.form_type === 'client_witnesses' ? 'Testigos' : 'Padre Ausente'
            return (
              <FormSection key={sub.form_type + i} title={label} color="amber" status={sub.status}>
                {renderFormFields(sub.form_data)}
              </FormSection>
            )
          })}

          {i589Subs.length > 0 && i589Subs.map(sub => {
            const label = 'I-589 ' + sub.form_type.replace('i589_', '').replace('_', ' ').toUpperCase()
            return (
              <FormSection key={sub.form_type} title={label} color="indigo" status={sub.status}>
                {renderFormFields(sub.form_data)}
              </FormSection>
            )
          })}

          {!tutorSub && storySubs.length === 0 && i589Subs.length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">Este cliente no ha llenado formularios aún.</p>
          )}
        </div>
      )}
    </div>
  )
}

function FormSection({ title, color, status, children }: {
  title: string; color: string; status: string; children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const colors: Record<string, { border: string; bg: string; text: string }> = {
    blue: { border: 'border-blue-200', bg: 'bg-blue-50', text: 'text-blue-900' },
    amber: { border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-900' },
    indigo: { border: 'border-indigo-200', bg: 'bg-indigo-50', text: 'text-indigo-900' },
  }
  const c = colors[color] || colors.blue

  return (
    <div className={`rounded-2xl border ${c.border} overflow-hidden`}>
      <button onClick={() => setOpen(!open)}
        className={`w-full px-4 py-3 ${c.bg} flex items-center justify-between`}>
        <span className={`text-sm font-bold ${c.text}`}>{title}</span>
        <div className="flex items-center gap-2">
          <Badge className={status === 'submitted' ? 'bg-purple-100 text-purple-700' : status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
            {status === 'submitted' ? 'Enviado' : status === 'approved' ? 'Aprobado' : status}
          </Badge>
          <span className="text-xs text-gray-400">{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && <div className="p-4 space-y-2">{children}</div>}
    </div>
  )
}

function renderFormFields(data: Record<string, unknown>) {
  const entries = Object.entries(data).filter(([, v]) => {
    if (!v) return false
    if (typeof v === 'string') return v.trim().length > 0
    if (typeof v === 'object') return true
    return false
  })

  return (
    <div className="grid gap-2">
      {entries.map(([key, value]) => {
        if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
          const nested = value as Record<string, string>
          const filledFields = Object.entries(nested).filter(([, v]) => v && typeof v === 'string' && v.trim())
          if (filledFields.length === 0) return null
          return (
            <div key={key} className="p-3 bg-gray-50 rounded-xl">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">{key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}</p>
              <div className="grid gap-1.5">
                {filledFields.map(([k, v]) => (
                  <div key={k}>
                    <span className="text-[10px] text-gray-400 capitalize">{k.replace(/_/g, ' ')}</span>
                    <p className="text-xs text-gray-700">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          )
        }
        if (Array.isArray(value)) {
          return (
            <div key={key} className="p-3 bg-gray-50 rounded-xl">
              <p className="text-[10px] font-bold text-gray-400 uppercase">{key.replace(/_/g, ' ')} ({value.length})</p>
              {value.filter(v => typeof v === 'object' && v.name).map((item: Record<string, string>, i: number) => (
                <p key={i} className="text-xs text-gray-700">{item.name} {item.relationship ? `— ${item.relationship}` : ''}</p>
              ))}
            </div>
          )
        }
        return (
          <div key={key}>
            <span className="text-[10px] text-gray-400 capitalize">{key.replace(/_/g, ' ')}</span>
            <p className="text-xs text-gray-700">{value as string}</p>
          </div>
        )
      })}
    </div>
  )
}
