'use client'

import { useState, useRef } from 'react'
import { FileText, Upload, CheckCircle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { APPOINTMENT_DOCUMENT_KEYS } from '@/lib/appointments/constants'

interface UploadedDoc {
  id: string
  document_key: string
  name: string
  file_size?: number
  status: string
}

interface DocumentUploadSectionProps {
  token: string
  uploadedDocuments: UploadedDoc[]
}

export function DocumentUploadSection({ token, uploadedDocuments }: DocumentUploadSectionProps) {
  const [uploaded, setUploaded] = useState<UploadedDoc[]>(uploadedDocuments)
  const [uploading, setUploading] = useState<string | null>(null)

  const categoriesWithDocs = new Set(uploaded.map(u => u.document_key)).size

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-[#002855]" />
        <h2 className="text-lg font-bold text-gray-900">Documentos Requeridos</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Suba los siguientes documentos en formato PDF (m&aacute;ximo 10MB cada uno).
      </p>

      <div className="space-y-3">
        {APPOINTMENT_DOCUMENT_KEYS.map(doc => {
          const existingDocs = uploaded.filter(u => u.document_key === doc.key)

          return (
            <DocumentCard
              key={doc.key}
              docKey={doc.key}
              label={doc.label}
              uploadedDocs={existingDocs}
              isUploading={uploading === doc.key}
              token={token}
              onUploadStart={() => setUploading(doc.key)}
              onUploadEnd={(newDoc) => {
                setUploading(null)
                if (newDoc) {
                  setUploaded(prev => [...prev, newDoc])
                }
              }}
              onDelete={(docId) => {
                setUploaded(prev => prev.filter(d => d.id !== docId))
              }}
            />
          )
        })}
      </div>

      {/* Progreso general */}
      <div className="mt-4 pt-4 border-t">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            {categoriesWithDocs} de {APPOINTMENT_DOCUMENT_KEYS.length} categorías con documentos
          </span>
          {categoriesWithDocs === APPOINTMENT_DOCUMENT_KEYS.length && (
            <Badge className="bg-green-100 text-green-800">Completo</Badge>
          )}
        </div>
      </div>
    </div>
  )
}

function DocumentCard({
  docKey,
  label,
  uploadedDocs,
  isUploading,
  token,
  onUploadStart,
  onUploadEnd,
  onDelete,
}: {
  docKey: string
  label: string
  uploadedDocs: UploadedDoc[]
  isUploading: boolean
  token: string
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

    if (file.size > 10 * 1024 * 1024) {
      toast.error('El archivo excede el límite de 10MB')
      return
    }

    onUploadStart()

    const formData = new FormData()
    formData.append('token', token)
    formData.append('document_key', docKey)
    formData.append('file', file)

    try {
      const res = await fetch('/api/appointments/upload-document', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Error al subir documento')
        onUploadEnd(null)
        return
      }

      toast.success(`${label} subido correctamente`)
      onUploadEnd(data.document)
    } catch {
      toast.error('Error de conexión')
      onUploadEnd(null)
    }

    // Reset file input
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className={`p-4 rounded-xl border ${
      hasUploads ? 'border-green-200 bg-green-50/50' : 'border-gray-200'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
            hasUploads ? 'bg-green-100' : 'bg-gray-100'
          }`}>
            {hasUploads
              ? <CheckCircle className="w-5 h-5 text-green-600" />
              : <FileText className="w-5 h-5 text-gray-400" />
            }
          </div>
          <p className="text-sm font-medium text-gray-900">{label}</p>
        </div>

        <>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            onChange={handleFile}
            className="hidden"
          />
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
              <>
                <Upload className="w-4 h-4 mr-1" />
                Subir PDF
              </>
            )}
          </Button>
        </>
      </div>

      {/* Lista de archivos subidos */}
      {hasUploads && (
        <div className="mt-3 ml-13 space-y-2">
          {uploadedDocs.map(doc => (
            <div key={doc.id} className="flex items-center justify-between gap-2">
              <p className="text-xs text-gray-500 truncate">
                {doc.name}
                {doc.file_size && ` (${(doc.file_size / 1024).toFixed(0)} KB)`}
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
                    if (!res.ok) {
                      const data = await res.json()
                      throw new Error(data.error)
                    }
                    toast.success('Documento eliminado')
                    onDelete(doc.id)
                  } catch (err: any) {
                    toast.error(err.message || 'Error al eliminar')
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
