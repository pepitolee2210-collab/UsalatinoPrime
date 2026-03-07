'use client'

import { useState } from 'react'
import { Download, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface HenryDoc {
  id: string
  document_key: string
  name: string
  file_size?: number
  status: string
}

interface HenryDocumentsProps {
  token: string
  documents: HenryDoc[]
}

export function HenryDocuments({ token, documents }: HenryDocumentsProps) {
  const [downloading, setDownloading] = useState<string | null>(null)

  async function handleDownload(doc: HenryDoc) {
    setDownloading(doc.id)
    try {
      const res = await fetch(`/api/client-documents/download?token=${token}&document_id=${doc.id}`)
      if (!res.ok) throw new Error('Error al descargar')
      const { url } = await res.json()
      window.open(url, '_blank')
    } catch {
      toast.error('No se pudo descargar el documento')
    } finally {
      setDownloading(null)
    }
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h3 className="text-sm font-medium text-gray-600 mb-1">Sin documentos aun</h3>
        <p className="text-xs text-gray-400">
          Su consultor subira documentos aqui cuando esten listos para usted.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Download className="w-5 h-5 text-[#002855]" />
        <h2 className="text-lg font-bold text-gray-900">Documentos de su Consultor</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Estos documentos fueron subidos por su consultor para usted. Haga clic para descargar.
      </p>

      <div className="space-y-3">
        {documents.map(doc => (
          <div
            key={doc.id}
            className="flex items-center justify-between p-4 border rounded-xl hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                {doc.file_size && (
                  <p className="text-xs text-gray-400">
                    {(doc.file_size / 1024 / 1024).toFixed(1)} MB
                  </p>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="text-blue-600 border-blue-200 hover:bg-blue-50"
              disabled={downloading === doc.id}
              onClick={() => handleDownload(doc)}
            >
              {downloading === doc.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Download className="w-4 h-4 mr-1" />
                  Descargar
                </>
              )}
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
