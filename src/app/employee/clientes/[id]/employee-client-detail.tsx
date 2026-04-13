'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  ArrowLeft, FileText, BookOpen, Download, Phone, Mail, Eye, X, MessageSquare, Upload, CheckCircle,
} from 'lucide-react'
import { DeclarationGenerator } from '@/app/admin/cases/[id]/declaration-generator'
import { ParentalConsentGenerator } from '@/app/admin/cases/[id]/parental-consent-generator'
import { SupplementaryDataForm } from '@/app/admin/cases/[id]/supplementary-data-form'
import { CasePipeline } from '@/components/case-pipeline'

interface Client {
  id: string; first_name: string; last_name: string; email: string; phone: string | null
}

interface Case {
  id: string; case_number: string; henry_notes: string | null; pipeline_status: Record<string, boolean> | null; service: { name: string; slug: string } | null
}

interface Doc {
  id: string; case_id: string; document_key: string; name: string
  file_size: number | null; file_path: string; created_at: string
}

interface FormSub {
  form_type: string; form_data: Record<string, unknown>
  status: string; updated_at: string; case_id: string; minor_index: number
}

type TabId = 'docs' | 'client-docs' | 'notas' | 'historia' | 'declaraciones' | 'i360'

export function EmployeeClientDetail({ client, cases, documents, henryDocuments, formSubmissions, appointments }: {
  client: Client; cases: Case[]; documents: Doc[]; henryDocuments: Doc[]; formSubmissions: FormSub[]
  appointments: { id: string; case_id: string; status: string }[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<TabId>('docs')
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null)
  const [selectedCase, setSelectedCase] = useState(cases[0]?.id || '')
  const [uploading, setUploading] = useState(false)

  const activeCase = cases.find(c => c.id === selectedCase)
  const clientName = `${client.first_name} ${client.last_name}`.trim()
  const isVisaJuvenil = activeCase?.service?.slug === 'visa-juvenil'

  // Filter data by selected case
  const caseDocs = documents.filter(d => d.case_id === selectedCase)
  const caseHenryDocs = henryDocuments.filter(d => d.case_id === selectedCase)
  const caseForms = formSubmissions.filter(f => f.case_id === selectedCase)

  const tutorData = caseForms.find(s => s.form_type === 'tutor_guardian')?.form_data || null
  const minorStories = caseForms
    .filter(s => s.form_type === 'client_story')
    .sort((a, b) => (a.minor_index || 0) - (b.minor_index || 0))
    .map(s => ({ minorIndex: s.minor_index || 0, formData: s.form_data }))
  const absentParents = caseForms
    .filter(s => s.form_type === 'client_absent_parent')
    .sort((a, b) => (a.minor_index || 0) - (b.minor_index || 0))
    .map(s => ({ formData: s.form_data }))
  const i360Sub = caseForms.find(s => s.form_type === 'i360_sijs')

  const isPDF = (name: string) => name.toLowerCase().endsWith('.pdf')

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'docs', label: 'Documentos', count: caseDocs.length },
    { id: 'client-docs', label: 'Para el Cliente', count: caseHenryDocs.length },
    { id: 'notas', label: 'Notas' },
    { id: 'historia', label: 'Historia' },
    ...(isVisaJuvenil ? [
      { id: 'declaraciones' as TabId, label: 'Declaraciones' },
      { id: 'i360' as TabId, label: 'I-360' },
    ] : []),
  ]

  return (
    <div className="space-y-5">
      {/* Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setPreviewDoc(null)}>
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <p className="font-bold text-gray-900 truncate flex-1">{previewDoc.name}</p>
              <div className="flex items-center gap-2 ml-3">
                <a href={`/api/employee/download-case-doc?id=${previewDoc.id}`} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline"><Download className="w-3 h-3 mr-1" /> Descargar</Button>
                </a>
                <button onClick={() => setPreviewDoc(null)} className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden bg-gray-100">
              {isPDF(previewDoc.name) ? (
                <iframe src={`/api/employee/download-case-doc?id=${previewDoc.id}`} className="w-full h-[75vh]" title={previewDoc.name} />
              ) : (
                <div className="flex items-center justify-center h-[50vh]">
                  <FileText className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">Vista previa no disponible</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/employee/clientes"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{clientName}</h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-1">
            <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{client.email}</span>
            {client.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{client.phone}</span>}
          </div>
        </div>
      </div>

      {/* Case selector */}
      {cases.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {cases.map(c => (
            <button key={c.id} onClick={() => { setSelectedCase(c.id); setTab('docs') }}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                selectedCase === c.id ? 'border-[#F2A900] bg-[#F2A900]/10 text-[#9a6500]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}>
              #{c.case_number} — {c.service?.name || '—'}
            </button>
          ))}
        </div>
      )}
      {cases.length === 1 && (
        <Badge variant="secondary" className="text-[10px]">#{activeCase?.case_number} — {activeCase?.service?.name}</Badge>
      )}

      {/* Pipeline */}
      {isVisaJuvenil && selectedCase && (
        <CasePipeline
          caseId={selectedCase}
          hasAppointment={appointments.filter(a => a.case_id === selectedCase).some(a => a.status === 'scheduled' || a.status === 'completed')}
          hasDocuments={caseDocs.length >= 3}
          hasHistory={caseForms.some(s => s.form_type === 'client_story' && (s.status === 'submitted' || s.status === 'approved'))}
          hasDeclarations={caseForms.some(s => s.form_type === 'tutor_guardian' && s.status === 'submitted')}
          hasClientDocs={caseHenryDocs.length > 0}
          hasI360={!!i360Sub && (i360Sub.status === 'submitted' || i360Sub.status === 'approved')}
          manualStages={{
            henry_reviewed: !!(activeCase?.pipeline_status as any)?.henry_reviewed,
            presented_to_court: !!(activeCase?.pipeline_status as any)?.presented_to_court,
          }}
          canEdit={true}
        />
      )}

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1" style={{ borderBottom: '1px solid #f0f1f3' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold whitespace-nowrap rounded-t-lg transition-colors ${
              tab === t.id ? 'bg-white text-gray-900 border border-b-0 border-gray-200' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
            {t.count !== undefined && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* === DOCUMENTOS === */}
      {tab === 'docs' && selectedCase && (
        <div className="space-y-3">
          {/* Upload button */}
          <label className={`flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer text-sm font-medium text-gray-500 hover:border-[#F2A900] hover:text-[#9a6500] transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <Upload className="w-4 h-4" />
            {uploading ? 'Subiendo...' : 'Subir Documento del Cliente'}
            <input type="file" accept="application/pdf,.jpg,.jpeg,.png,.doc,.docx" className="hidden" disabled={uploading}
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setUploading(true)
                try {
                  const { uploadDirect } = await import('@/lib/upload-direct')
                  await uploadDirect({ file, documentKey: 'general', mode: 'admin', caseId: selectedCase, clientId: client.id })
                  toast.success('Documento subido')
                  router.refresh()
                } catch { toast.error('Error al subir') }
                finally { setUploading(false); e.target.value = '' }
              }}
            />
          </label>
          {caseDocs.length === 0 ? <p className="text-center text-gray-400 py-8 text-sm">No hay documentos.</p> : caseDocs.map(doc => (
            <DocRow key={doc.id} doc={doc} onPreview={() => setPreviewDoc(doc)} isPDF={isPDF(doc.name)} />
          ))}
        </div>
      )}

      {/* === PARA EL CLIENTE === */}
      {tab === 'client-docs' && selectedCase && (
        <ClientDocsUpload
          caseId={selectedCase}
          clientId={client.id}
          documents={caseHenryDocs}
          uploading={uploading}
          setUploading={setUploading}
          onPreview={setPreviewDoc}
          onRefresh={() => router.refresh()}
        />
      )}

      {/* === NOTAS === */}
      {tab === 'notas' && (
        <div className="space-y-3">
          {activeCase?.henry_notes ? (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
              <p className="text-xs font-bold text-yellow-700 mb-2">Notas del Abogado</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{activeCase.henry_notes}</p>
            </div>
          ) : (
            <p className="text-center text-gray-400 py-8 text-sm">No hay notas para este caso.</p>
          )}
        </div>
      )}

      {/* === HISTORIA === */}
      {tab === 'historia' && (
        <div className="space-y-3">
          {caseForms.filter(s => ['tutor_guardian', 'client_story', 'client_witnesses', 'client_absent_parent'].includes(s.form_type)).map((sub, i) => {
            const labels: Record<string, string> = {
              tutor_guardian: 'Declaración del Tutor',
              client_story: `Historia del Menor ${sub.minor_index + 1}`,
              client_witnesses: `Testigos ${sub.minor_index + 1}`,
              client_absent_parent: `Padre Ausente ${sub.minor_index + 1}`,
            }
            return <FormSection key={sub.form_type + sub.minor_index + i} title={labels[sub.form_type] || sub.form_type} status={sub.status} data={sub.form_data} />
          })}
          {caseForms.filter(s => ['tutor_guardian', 'client_story'].includes(s.form_type)).length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">El cliente no ha llenado la historia.</p>
          )}
        </div>
      )}

      {/* === DECLARACIONES === */}
      {tab === 'declaraciones' && isVisaJuvenil && selectedCase && (
        <div className="space-y-4">
          <SupplementaryDataForm caseId={selectedCase} tutorData={tutorData} minorStories={minorStories} absentParents={absentParents} />
          <ParentalConsentGenerator caseId={selectedCase} clientName={clientName} />
          <div className="border-t border-gray-200" />
          <DeclarationGenerator caseId={selectedCase} clientName={clientName} tutorData={tutorData} minorStories={minorStories} />
        </div>
      )}

      {/* === I-360 === */}
      {tab === 'i360' && isVisaJuvenil && (
        <I360Section submission={i360Sub} />
      )}
    </div>
  )
}

function DocRow({ doc, onPreview, isPDF }: { doc: Doc; onPreview: () => void; isPDF: boolean }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-200 hover:border-gray-300 transition-colors">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isPDF ? 'bg-red-50' : 'bg-blue-50'}`}>
        <FileText className={`w-4 h-4 ${isPDF ? 'text-red-500' : 'text-blue-500'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
        <p className="text-[10px] text-gray-400">
          {doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB · ` : ''}
          {new Date(doc.created_at).toLocaleDateString('es-US', { day: 'numeric', month: 'short' })}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {isPDF && <button onClick={onPreview} className="p-2 rounded-lg hover:bg-gray-100" title="Vista previa"><Eye className="w-4 h-4 text-gray-500" /></button>}
        <a href={`/api/employee/download-case-doc?id=${doc.id}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-gray-100" title="Descargar"><Download className="w-4 h-4 text-gray-500" /></a>
      </div>
    </div>
  )
}

function FormSection({ title, status, data }: { title: string; status: string; data: Record<string, unknown> }) {
  const [open, setOpen] = useState(false)
  const entries = Object.entries(data).filter(([, v]) => v && ((typeof v === 'string' && v.trim()) || typeof v === 'object'))

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100">
        <span className="text-sm font-bold text-gray-700">{title}</span>
        <div className="flex items-center gap-2">
          <Badge className={status === 'submitted' ? 'bg-purple-100 text-purple-700' : status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
            {status === 'submitted' ? 'Enviado' : status === 'approved' ? 'Aprobado' : status}
          </Badge>
          <span className="text-xs text-gray-400">{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && (
        <div className="p-4 space-y-2">
          {entries.map(([key, value]) => {
            if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
              const nested = value as Record<string, string>
              const filled = Object.entries(nested).filter(([, v]) => v && typeof v === 'string' && v.trim())
              if (!filled.length) return null
              return (
                <div key={key} className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}</p>
                  {filled.map(([k, v]) => (
                    <div key={k}><span className="text-[10px] text-gray-400 capitalize">{k.replace(/_/g, ' ')}</span><p className="text-xs text-gray-700">{v}</p></div>
                  ))}
                </div>
              )
            }
            if (Array.isArray(value)) {
              return (
                <div key={key} className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">{key.replace(/_/g, ' ')} ({value.length})</p>
                  {value.filter(v => typeof v === 'object' && v.name).map((item: any, i: number) => (
                    <p key={i} className="text-xs text-gray-700">{item.name} {item.relationship ? `— ${item.relationship}` : ''}</p>
                  ))}
                </div>
              )
            }
            return (
              <div key={key}><span className="text-[10px] text-gray-400 capitalize">{key.replace(/_/g, ' ')}</span><p className="text-xs text-gray-700">{value as string}</p></div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ClientDocsUpload({ caseId, clientId, documents, uploading, setUploading, onPreview, onRefresh }: {
  caseId: string; clientId: string; documents: Doc[]; uploading: boolean
  setUploading: (v: boolean) => void; onPreview: (d: Doc) => void; onRefresh: () => void
}) {
  const categories = [
    { key: 'parental_consent', label: '1. Carta de Renuncia', color: 'bg-blue-100 text-blue-700' },
    { key: 'petition_guardianship', label: '2. Petición de Tutela', color: 'bg-emerald-100 text-emerald-700' },
    { key: 'minor_declaration', label: '3. Declaración del Menor', color: 'bg-amber-100 text-amber-700' },
    { key: 'tutor_declaration', label: '4. Declaración del Tutor', color: 'bg-indigo-100 text-indigo-700' },
    { key: 'witness_declaration', label: '5. Declaración de Testigos', color: 'bg-purple-100 text-purple-700' },
  ]

  async function handleUpload(catKey: string, lang: string, files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    const docKey = `${catKey}_${lang.toLowerCase()}`
    try {
      for (const file of Array.from(files)) {
        const res = await fetch('/api/admin/client-documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ case_id: caseId, client_id: clientId, file_name: file.name, file_size: file.size, document_key: docKey }),
        })
        if (!res.ok) throw new Error()
        const { token: uploadToken, filePath } = await res.json()

        const { createClient } = await import('@/lib/supabase/client')
        const supabaseClient = createClient()
        await supabaseClient.storage.from('case-documents').uploadToSignedUrl(filePath, uploadToken, file)

        await fetch('/api/admin/client-documents', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ case_id: caseId, client_id: clientId, file_path: filePath, file_name: file.name, file_size: file.size, document_key: docKey }),
        })
      }
      toast.success(`${lang} — archivo subido`)
      onRefresh()
    } catch { toast.error('Error al subir') }
    finally { setUploading(false) }
  }

  const isPDF = (name: string) => name.toLowerCase().endsWith('.pdf')

  return (
    <div className="border-2 border-blue-200 rounded-xl bg-blue-50/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Download className="w-5 h-5 text-blue-800" />
        <span className="text-sm font-bold text-blue-800">Documentos para el Cliente</span>
        <Badge variant="outline" className="text-blue-700 border-blue-300">{documents.length}</Badge>
      </div>

      {categories.map(cat => {
        const catDocs = documents.filter(d => d.document_key?.includes(cat.key))
        return (
          <div key={cat.key} className="bg-white rounded-xl border border-gray-200 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge className={cat.color + ' text-[10px]'}>{cat.label}</Badge>
                {catDocs.length > 0 && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
              </div>
              <div className="flex gap-1">
                {['EN', 'ES'].map(lang => (
                  <label key={lang} className={`inline-flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer text-[10px] font-bold ${
                    lang === 'EN' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-amber-500 text-white hover:bg-amber-600'
                  } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <Upload className="w-3 h-3" /> {lang}
                    <input type="file" accept="application/pdf,.doc,.docx" className="hidden" disabled={uploading}
                      onChange={e => { handleUpload(cat.key, lang, e.target.files); e.target.value = '' }} />
                  </label>
                ))}
              </div>
            </div>
            {catDocs.map(doc => (
              <div key={doc.id} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                  <p className="text-xs font-medium text-gray-800 truncate">{doc.name}</p>
                </div>
                <div className="flex gap-1">
                  {isPDF(doc.name) && (
                    <button onClick={() => onPreview(doc)} className="p-1 rounded hover:bg-gray-100"><Eye className="w-3 h-3 text-gray-500" /></button>
                  )}
                  <a href={`/api/employee/download-case-doc?id=${doc.id}`} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-gray-100">
                    <Download className="w-3 h-3 text-gray-500" />
                  </a>
                </div>
              </div>
            ))}
            {catDocs.length === 0 && <p className="text-[10px] text-gray-400 text-center">Sin documento</p>}
          </div>
        )
      })}
    </div>
  )
}

function I360Section({ submission }: { submission?: FormSub }) {
  if (!submission) return (
    <div className="text-center py-12">
      <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
      <p className="text-sm text-gray-500">El cliente aún no ha llenado el formulario I-360.</p>
    </div>
  )

  const d = submission.form_data as Record<string, string>
  const status = submission.status

  const sections = [
    { title: 'Part 1 — Peticionario', color: 'indigo', fields: [
      { label: 'Nombre', value: `${d.petitioner_first_name || ''} ${d.petitioner_middle_name || ''} ${d.petitioner_last_name || ''}`.trim() },
      { label: 'SSN', value: d.petitioner_ssn },
      { label: 'A-Number', value: d.petitioner_a_number },
      { label: 'Dirección', value: `${d.petitioner_address || ''}, ${d.petitioner_city || ''} ${d.petitioner_state || ''} ${d.petitioner_zip || ''}`.trim() },
      { label: 'Dir. segura', value: d.safe_mailing_address ? `${d.safe_mailing_name} — ${d.safe_mailing_address}` : '' },
    ]},
    { title: 'Part 3 — Beneficiario (Menor)', color: 'blue', fields: [
      { label: 'Nombre', value: `${d.beneficiary_first_name || ''} ${d.beneficiary_middle_name || ''} ${d.beneficiary_last_name || ''}`.trim() },
      { label: 'Otros nombres', value: d.other_names },
      { label: 'DOB', value: d.beneficiary_dob },
      { label: 'País/Ciudad', value: `${d.beneficiary_city_birth || ''}, ${d.beneficiary_country_birth || ''}` },
      { label: 'Sexo', value: d.beneficiary_sex },
      { label: 'Estado civil', value: d.beneficiary_marital_status },
      { label: 'SSN', value: d.beneficiary_ssn },
      { label: 'A-Number', value: d.beneficiary_a_number },
      { label: 'Pasaporte', value: `${d.beneficiary_passport_number || ''} (${d.beneficiary_passport_country || ''})` },
      { label: 'I-94', value: d.beneficiary_i94_number },
      { label: 'Última llegada', value: d.beneficiary_last_arrival_date },
      { label: 'Status', value: d.beneficiary_nonimmigrant_status },
    ]},
    { title: 'Part 4 — Procesamiento', color: 'amber', fields: [
      { label: 'Padre/Madre extranjero', value: `${d.foreign_parent_first_name || ''} ${d.foreign_parent_last_name || ''}`.trim() },
      { label: 'En removal proceedings', value: d.in_removal_proceedings },
      { label: 'Otras peticiones', value: d.other_petitions },
      { label: 'Ajuste de estatus', value: d.adjustment_attached },
    ]},
    { title: 'Part 5 — Cónyuge/Hijos', color: 'emerald', fields: [
      { label: 'Hijos con peticiones separadas', value: d.children_filed_separate },
      { label: 'Persona 1', value: d.spouse_child_1_first_name ? `${d.spouse_child_1_first_name} ${d.spouse_child_1_last_name}` : '' },
    ]},
    { title: 'Part 8 — SIJS', color: 'purple', fields: [
      { label: '2A. Dependiente de corte', value: d.declared_dependent_court },
      { label: '2B. Corte/Agencia', value: d.state_agency_name },
      { label: '2C. Bajo jurisdicción', value: d.currently_under_jurisdiction },
      { label: '3A. En placement', value: d.in_court_ordered_placement },
      { label: '4. Reunificación no viable', value: d.reunification_not_viable_reason },
      { label: '5. Mejor interés no regresar', value: d.best_interest_not_return },
      { label: '6A. Custodia HHS', value: d.previously_hhs_custody },
    ]},
    { title: 'Part 11/15 — Contacto', color: 'gray', fields: [
      { label: 'Teléfono', value: d.petitioner_phone },
      { label: 'Celular', value: d.petitioner_mobile },
      { label: 'Email', value: d.petitioner_email },
      { label: 'Idioma', value: d.language_understood },
      { label: 'Intérprete', value: d.interpreter_needed },
      { label: 'Info adicional', value: d.additional_info },
    ]},
  ]

  const colorMap: Record<string, { bg: string; border: string; text: string }> = {
    indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-900' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-900' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-900' },
    gray: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-900' },
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-900">Formulario I-360 — SIJS</h3>
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
          status === 'submitted' ? 'bg-purple-100 text-purple-700' :
          status === 'approved' ? 'bg-green-100 text-green-700' :
          'bg-gray-100 text-gray-600'
        }`}>
          {status === 'submitted' ? 'Enviado por el cliente' : status === 'approved' ? 'Aprobado' : status === 'draft' ? 'Borrador' : status}
        </span>
      </div>

      {sections.map(section => {
        const c = colorMap[section.color] || colorMap.gray
        const filledFields = section.fields.filter(f => f.value && f.value.trim() && f.value.trim() !== ',' && f.value.trim() !== ', ,')
        if (filledFields.length === 0) return null
        return (
          <div key={section.title} className={`rounded-xl border ${c.border} overflow-hidden`}>
            <div className={`px-4 py-2.5 ${c.bg}`}>
              <span className={`text-xs font-bold ${c.text} uppercase`}>{section.title}</span>
            </div>
            <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-2">
              {filledFields.map(f => (
                <div key={f.label}>
                  <span className="text-[10px] text-gray-400 uppercase">{f.label}</span>
                  <p className="text-sm text-gray-900">{f.value}</p>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
