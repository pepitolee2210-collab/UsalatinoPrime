'use client'

import { useState, useRef } from 'react'
import { FileText, Upload, CheckCircle, Trash2, Users, Home, FolderOpen } from 'lucide-react'
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
} as const

export function DocumentUploadSection({ token, uploadedDocuments }: {
  token: string
  uploadedDocuments: UploadedDoc[]
}) {
  const [uploaded, setUploaded] = useState<UploadedDoc[]>(uploadedDocuments)
  const [uploading, setUploading] = useState<string | null>(null)

  const totalDocs = DOCUMENT_CATEGORIES.flatMap(c => c.docs).length
  const categoriesWithDocs = new Set(uploaded.map(u => u.document_key)).size

  return (
    <div className="space-y-5">
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
                    uploadedDocs={existingDocs}
                    isUploading={uploading === doc.key}
                    token={token}
                    onUploadStart={() => setUploading(doc.key)}
                    onUploadEnd={(newDoc) => {
                      setUploading(null)
                      if (newDoc) setUploaded(prev => [...prev, newDoc])
                    }}
                    onDelete={(docId) => setUploaded(prev => prev.filter(d => d.id !== docId))}
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
  docKey, label, required, uploadedDocs, isUploading, token,
  onUploadStart, onUploadEnd, onDelete,
}: {
  docKey: string; label: string; required: boolean
  uploadedDocs: UploadedDoc[]; isUploading: boolean; token: string
  onUploadStart: () => void
  onUploadEnd: (doc: UploadedDoc | null) => void
  onDelete: (docId: string) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const hasUploads = uploadedDocs.length > 0

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      toast.error('Solo se aceptan archivos PDF')
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
          <input ref={fileRef} type="file" accept="application/pdf" onChange={handleFile} className="hidden" />
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
              <><Upload className="w-4 h-4 mr-1" /> Subir PDF</>
            )}
          </Button>
        </div>
      </div>

      {hasUploads && (
        <div className="mt-2 ml-11 space-y-1.5">
          {uploadedDocs.map(doc => (
            <div key={doc.id} className="flex items-center justify-between gap-2">
              <p className="text-xs text-gray-500 truncate">
                {doc.name}
                {doc.file_size ? ` (${(doc.file_size / 1024).toFixed(0)} KB)` : ''}
              </p>
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
                className="text-red-400 hover:text-red-600 flex-shrink-0 p-1"
              >
                {deleting === doc.id ? (
                  <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
