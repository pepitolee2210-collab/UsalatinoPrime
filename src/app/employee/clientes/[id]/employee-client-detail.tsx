'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  ArrowLeft, FileText, BookOpen, Download, Phone, Mail, User,
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

  const tutorSub = formSubmissions.find(s => s.form_type === 'tutor_guardian')
  const storySubs = formSubmissions.filter(s => ['client_story', 'client_witnesses', 'client_absent_parent'].includes(s.form_type))
  const i589Subs = formSubmissions.filter(s => s.form_type.startsWith('i589_'))

  return (
    <div className="space-y-5">
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
          <BookOpen className="w-4 h-4" /> Historia ({formSubmissions.length})
        </button>
      </div>

      {/* Documents tab */}
      {tab === 'docs' && (
        <div className="space-y-2">
          {documents.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">Este cliente no tiene documentos subidos.</p>
          ) : (
            documents.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-200">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                  <p className="text-[10px] text-gray-400">
                    {doc.document_key.replace(/_/g, ' ')}
                    {doc.file_size ? ` · ${(doc.file_size / 1024).toFixed(0)} KB` : ''}
                  </p>
                </div>
                <a href={`/api/employee/download-case-doc?id=${doc.id}`} target="_blank" rel="noopener noreferrer"
                  className="p-2 rounded-lg hover:bg-gray-100">
                  <Download className="w-4 h-4 text-gray-500" />
                </a>
              </div>
            ))
          )}
        </div>
      )}

      {/* Historia tab */}
      {tab === 'historia' && (
        <div className="space-y-3">
          {/* Tutor declaration */}
          {tutorSub && (
            <div className="rounded-2xl border border-blue-200 overflow-hidden">
              <div className="px-4 py-3 bg-blue-50 flex items-center justify-between">
                <span className="text-sm font-bold text-blue-900">Declaración del Tutor</span>
                <Badge className={tutorSub.status === 'submitted' ? 'bg-purple-100 text-purple-700' : tutorSub.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
                  {tutorSub.status === 'submitted' ? 'Enviado' : tutorSub.status === 'approved' ? 'Aprobado' : tutorSub.status}
                </Badge>
              </div>
              <div className="p-4 space-y-2">
                {renderFormFields(tutorSub.form_data)}
              </div>
            </div>
          )}

          {/* Minor stories */}
          {storySubs.length > 0 && (
            <div className="rounded-2xl border border-amber-200 overflow-hidden">
              <div className="px-4 py-3 bg-amber-50">
                <span className="text-sm font-bold text-amber-900">Historia del Menor</span>
              </div>
              <div className="divide-y divide-amber-100">
                {storySubs.map((sub, i) => {
                  const label = sub.form_type === 'client_story' ? 'Declaración' : sub.form_type === 'client_witnesses' ? 'Testigos' : 'Padre Ausente'
                  return (
                    <div key={sub.form_type + i} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-amber-700">{label}</span>
                        <Badge className={sub.status === 'submitted' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}>
                          {sub.status === 'submitted' ? 'Enviado' : sub.status}
                        </Badge>
                      </div>
                      {renderFormFields(sub.form_data)}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* I-589 */}
          {i589Subs.length > 0 && (
            <div className="rounded-2xl border border-indigo-200 overflow-hidden">
              <div className="px-4 py-3 bg-indigo-50">
                <span className="text-sm font-bold text-indigo-900">Formulario I-589</span>
              </div>
              <div className="divide-y divide-indigo-100">
                {i589Subs.map(sub => {
                  const label = sub.form_type.replace('i589_', '').replace('_', ' ').toUpperCase()
                  return (
                    <div key={sub.form_type} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-indigo-700">{label}</span>
                        <Badge className={sub.status === 'submitted' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}>
                          {sub.status === 'submitted' ? 'Enviado' : sub.status}
                        </Badge>
                      </div>
                      {renderFormFields(sub.form_data)}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {!tutorSub && storySubs.length === 0 && i589Subs.length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">Este cliente no ha llenado formularios aún.</p>
          )}
        </div>
      )}
    </div>
  )
}

function renderFormFields(data: Record<string, unknown>) {
  // Render nested objects (minorBasic, minorAbuse, etc.) and flat fields
  const entries = Object.entries(data).filter(([, v]) => {
    if (!v) return false
    if (typeof v === 'string') return v.trim().length > 0
    if (typeof v === 'object' && !Array.isArray(v)) return true
    if (Array.isArray(v) && v.length > 0) return true
    return false
  })

  return (
    <div className="grid gap-1.5">
      {entries.slice(0, 15).map(([key, value]) => {
        if (typeof value === 'object' && !Array.isArray(value)) {
          // Nested object (e.g., minorBasic, minorAbuse)
          const nested = value as Record<string, string>
          const filledFields = Object.entries(nested).filter(([, v]) => v && typeof v === 'string' && v.trim())
          if (filledFields.length === 0) return null
          return (
            <div key={key} className="p-2 bg-gray-50 rounded-lg">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}</p>
              {filledFields.slice(0, 6).map(([k, v]) => (
                <div key={k}>
                  <span className="text-[10px] text-gray-400">{k.replace(/_/g, ' ')}</span>
                  <p className="text-xs text-gray-700 line-clamp-2">{v}</p>
                </div>
              ))}
              {filledFields.length > 6 && <p className="text-[10px] text-gray-400">+{filledFields.length - 6} campos más</p>}
            </div>
          )
        }
        if (Array.isArray(value)) {
          // Array (e.g., witnesses, children)
          return (
            <div key={key} className="p-2 bg-gray-50 rounded-lg">
              <p className="text-[10px] font-bold text-gray-400 uppercase">{key.replace(/_/g, ' ')} ({value.length})</p>
              {value.filter(v => typeof v === 'object' && v.name).slice(0, 3).map((item: any, i: number) => (
                <p key={i} className="text-xs text-gray-700">{item.name} {item.relationship ? `— ${item.relationship}` : ''}</p>
              ))}
            </div>
          )
        }
        return (
          <div key={key}>
            <span className="text-[10px] text-gray-400">{key.replace(/_/g, ' ')}</span>
            <p className="text-xs text-gray-700 line-clamp-3">{value as string}</p>
          </div>
        )
      })}
      {entries.length > 15 && <p className="text-[10px] text-gray-400">+{entries.length - 15} campos más</p>}
    </div>
  )
}
