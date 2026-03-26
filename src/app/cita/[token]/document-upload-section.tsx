'use client'

import { useState, useRef } from 'react'
import { FileText, Upload, CheckCircle, Trash2, Users, Home, FolderOpen, Camera, Eye, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { DOCUMENT_CATEGORIES } from '@/lib/appointments/constants'
import { uploadDirect } from '@/lib/upload-direct'

interface UploadedDoc {
  id: string
  document_key: string
  name: string
  file_size?: number
  status: string
}

const CATEGORY_ICONS = {
  users: Users,
  home: Home,
  file: FolderOpen,
  camera: Camera,
  witness: Users,
} as const

export function DocumentUploadSection({ token, uploadedDocuments }: {
  token: string
  uploadedDocuments: UploadedDoc[]
}) {
  const [uploaded, setUploaded] = useState<UploadedDoc[]>(uploadedDocuments)
  const [uploading, setUploading] = useState<string | null>(null)
  const [previewDoc, setPreviewDoc] = useState<{ id: string; name: string } | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  async function openPreview(doc: { id: string; name: string }) {
    setPreviewDoc(doc)
    setPreviewLoading(true)
    setPreviewUrl(null)
    try {
      const res = await fetch(`/api/client/preview-doc?token=${token}&id=${doc.id}`)
      if (res.ok) {
        const data = await res.json()
        if (data.url) setPreviewUrl(data.url)
      }
    } catch { /* silent */ }
    finally { setPreviewLoading(false) }
  }

  const totalDocs = DOCUMENT_CATEGORIES.flatMap(c => c.docs).length
  const categoriesWithDocs = new Set(uploaded.map(u => u.document_key)).size

  return (
    <div className="space-y-5">
      {/* Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={() => { setPreviewDoc(null); setPreviewUrl(null) }}>
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <p className="text-white font-semibold text-sm truncate flex-1 mr-4">{previewDoc.name}</p>
            <button onClick={() => { setPreviewDoc(null); setPreviewUrl(null) }}
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-70"
              style={{ background: 'rgba(255,255,255,0.12)' }}>
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
            {previewLoading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-[#F2A900] animate-spin" />
                <p className="text-white/60 text-sm">Cargando documento...</p>
              </div>
            ) : previewUrl ? (
              <iframe src={previewUrl} className="w-full h-full rounded-xl bg-white" style={{ maxHeight: '80vh' }} />
            ) : (
              <p className="text-white/60 text-sm">No se pudo cargar el documento.</p>
            )}
          </div>
        </div>
      )}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <FileText className="w-5 h-5 text-[#002855]" />
          <h2 className="text-lg font-bold text-gray-900">Mis Documentos</h2>
        </div>
        <p className="text-sm text-gray-500">
          Suba los siguientes documentos en formato PDF (máximo 40MB cada uno).
        </p>
      </div>

      {DOCUMENT_CATEGORIES.map(category => {
        const Icon = CATEGORY_ICONS[category.icon as keyof typeof CATEGORY_ICONS] || FileText
        const catDocsUploaded = category.docs.filter(d =>
          uploaded.some(u => u.document_key === d.key)
        ).length
        const isComplete = catDocsUploaded === category.docs.length

        return (
          <div key={category.id} className="rounded-2xl border border-gray-200 overflow-hidden">
            {/* Category header */}
            <div className={`flex items-center justify-between px-5 py-3.5 ${
              isComplete ? 'bg-green-50 border-b border-green-100' : 'bg-gray-50 border-b border-gray-100'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  isComplete ? 'bg-green-100' : 'bg-white border border-gray-200'
                }`}>
                  {isComplete
                    ? <CheckCircle className="w-4 h-4 text-green-600" />
                    : <Icon className="w-4 h-4 text-[#002855]" />
                  }
                </div>
                <span className="text-sm font-bold text-gray-900">{category.title}</span>
              </div>
              <span className="text-xs text-gray-400">{catDocsUploaded}/{category.docs.length}</span>
            </div>

            {/* Documents in this category */}
            <div className="divide-y divide-gray-100">
              {category.docs.map(doc => {
                const existingDocs = uploaded.filter(u => u.document_key === doc.key)
                return (
                  <DocumentCard
                    key={doc.key}
                    docKey={doc.key}
                    label={doc.label}
                    required={doc.required}
                    accept={(category as any).accept || 'application/pdf'}
                    uploadedDocs={existingDocs}
                    isUploading={uploading === doc.key}
                    token={token}
                    onUploadStart={() => setUploading(doc.key)}
                    onUploadEnd={(newDoc) => {
                      setUploading(null)
                      if (newDoc) setUploaded(prev => [...prev, newDoc])
                    }}
                    onDelete={(docId) => setUploaded(prev => prev.filter(d => d.id !== docId))}
                    onPreview={(doc) => openPreview(doc)}
                  />
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Overall progress */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-sm text-gray-500">
          {categoriesWithDocs} de {totalDocs} documentos subidos
        </span>
        {categoriesWithDocs === totalDocs && (
          <Badge className="bg-green-100 text-green-800">Completo</Badge>
        )}
      </div>
    </div>
  )
}

function DocumentCard({
  docKey, label, required, accept = 'application/pdf', uploadedDocs, isUploading, token,
  onUploadStart, onUploadEnd, onDelete, onPreview,
}: {
  docKey: string; label: string; required: boolean; accept?: string
  uploadedDocs: UploadedDoc[]; isUploading: boolean; token: string
  onUploadStart: () => void
  onUploadEnd: (doc: UploadedDoc | null) => void
  onDelete: (docId: string) => void
  onPreview: (doc: { id: string; name: string }) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const hasUploads = uploadedDocs.length > 0
  const acceptsImages = accept.includes('jpg') || accept.includes('png') || accept.includes('webp')

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ['application/pdf']
    if (acceptsImages) allowedTypes.push('image/jpeg', 'image/png', 'image/webp')

    if (!allowedTypes.includes(file.type)) {
      toast.error(acceptsImages ? 'Solo se aceptan PDF, JPG, PNG o WebP' : 'Solo se aceptan archivos PDF')
      return
    }

    if (file.size > 40 * 1024 * 1024) {
      toast.error('El archivo excede el límite de 40MB')
      return
    }

    onUploadStart()
    try {
      const { document } = await uploadDirect({ file, documentKey: docKey, mode: 'client', token })
      toast.success(`${label} subido correctamente`)
      onUploadEnd(document)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al subir documento'
      toast.error(msg)
      onUploadEnd(null)
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="px-5 py-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
            hasUploads ? 'bg-green-100' : 'bg-gray-100'
          }`}>
            {hasUploads
              ? <CheckCircle className="w-4 h-4 text-green-600" />
              : <FileText className="w-4 h-4 text-gray-400" />
            }
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900">{label}</p>
            {required && !hasUploads && (
              <p className="text-[10px] text-red-400 font-medium">Requerido</p>
            )}
          </div>
        </div>

        <div>
          <input ref={fileRef} type="file" accept={accept} onChange={handleFile} className="hidden" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={isUploading}
            className="flex-shrink-0"
          >
            {isUploading ? (
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <><Upload className="w-4 h-4 mr-1" /> {acceptsImages ? 'Subir archivo' : 'Subir PDF'}</>
            )}
          </Button>
        </div>
      </div>

      {hasUploads && (
        <div className="mt-2 ml-11 space-y-1.5">
          {uploadedDocs.map(doc => (
            <div key={doc.id} className="flex items-center justify-between gap-2">
              <p className="text-xs text-gray-500 truncate flex-1">
                {doc.name}
                {doc.file_size ? ` (${(doc.file_size / 1024).toFixed(0)} KB)` : ''}
              </p>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => onPreview({ id: doc.id, name: doc.name })}
                  className="text-blue-400 hover:text-blue-600 p-1"
                  title="Previsualizar"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={deleting === doc.id}
                  onClick={async () => {
                    if (!confirm('¿Eliminar este documento?')) return
                    setDeleting(doc.id)
                    try {
                      const res = await fetch('/api/appointments/upload-document', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token, document_id: doc.id }),
                      })
                      if (!res.ok) throw new Error()
                      toast.success('Documento eliminado')
                      onDelete(doc.id)
                    } catch {
                      toast.error('Error al eliminar')
                    } finally {
                      setDeleting(null)
                    }
                  }}
                  className="text-red-400 hover:text-red-600 p-1"
                >
                {deleting === doc.id ? (
                  <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
              </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
