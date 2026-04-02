'use client'

import { useState } from 'react'
import { Download, FileText, Loader2, CheckCircle, Users, User, Shield, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface HenryDoc {
  id: string
  document_key: string
  name: string
  file_size?: number
  status: string
}

const DOC_CATEGORIES = [
  {
    id: 'parental_consent',
    title: 'Carta de Renuncia de los Padres',
    subtitle: 'Parental Consent to Temporary Guardianship',
    icon: Shield,
    color: 'blue',
    keys: ['parental_consent', 'carta_renuncia'],
  },
  {
    id: 'petition_guardianship',
    title: 'Petición de Tutela',
    subtitle: 'Petition for Temporary Guardianship',
    icon: BookOpen,
    color: 'emerald',
    keys: ['petition_guardianship', 'peticion_tutela'],
  },
  {
    id: 'minor_declaration',
    title: 'Declaración Jurada del Menor',
    subtitle: 'Sworn Declaration of the Minor',
    icon: User,
    color: 'amber',
    keys: ['minor_declaration', 'declaracion_menor'],
  },
  {
    id: 'tutor_declaration',
    title: 'Declaración Jurada del Tutor',
    subtitle: 'Affidavit of the Guardian/Parent',
    icon: Users,
    color: 'indigo',
    keys: ['tutor_declaration', 'declaracion_tutor', 'declaracion_padre'],
  },
  {
    id: 'witness_declaration',
    title: 'Declaración Jurada de Testigos',
    subtitle: 'Witness Affidavit',
    icon: Users,
    color: 'purple',
    keys: ['witness_declaration', 'declaracion_testigo'],
  },
]

const COLOR_MAP: Record<string, { bg: string; border: string; iconBg: string }> = {
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-200',    iconBg: 'bg-blue-100' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', iconBg: 'bg-emerald-100' },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',   iconBg: 'bg-amber-100' },
  indigo:  { bg: 'bg-indigo-50',  border: 'border-indigo-200',  iconBg: 'bg-indigo-100' },
  purple:  { bg: 'bg-purple-50',  border: 'border-purple-200',  iconBg: 'bg-purple-100' },
}

export function HenryDocuments({ token, documents }: { token: string; documents: HenryDoc[] }) {
  const [downloading, setDownloading] = useState<string | null>(null)

  async function handleDownload(doc: HenryDoc) {
    setDownloading(doc.id)
    try {
      const res = await fetch(`/api/client-documents/download?token=${token}&document_id=${doc.id}`)
      if (!res.ok) throw new Error()
      const { url } = await res.json()
      window.open(url, '_blank')
    } catch {
      toast.error('No se pudo descargar el documento')
    } finally {
      setDownloading(null)
    }
  }

  // Categorize documents
  function getCategoryDocs(cat: typeof DOC_CATEGORIES[0]) {
    return documents.filter(d => cat.keys.some(k => d.document_key?.toLowerCase().includes(k)))
  }

  const uncategorized = documents.filter(d =>
    !DOC_CATEGORIES.some(cat => cat.keys.some(k => d.document_key?.toLowerCase().includes(k)))
  )

  const hasAnyDoc = documents.length > 0

  if (!hasAnyDoc) {
    return (
      <div className="text-center py-12">
        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h3 className="text-sm font-medium text-gray-600 mb-1">Sin documentos aún</h3>
        <p className="text-xs text-gray-400">
          Su consultor subirá documentos aquí cuando estén listos para usted.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Download className="w-5 h-5 text-[#002855]" />
          <h2 className="text-lg font-bold text-gray-900">Documentos de su Consultor</h2>
        </div>
        <p className="text-sm text-gray-500">
          Estos documentos fueron preparados por su consultor. Toque para descargar.
        </p>
      </div>

      {DOC_CATEGORIES.map(cat => {
        const catDocs = getCategoryDocs(cat)
        if (catDocs.length === 0) return null
        const Icon = cat.icon
        const colors = COLOR_MAP[cat.color] || COLOR_MAP.blue

        return (
          <div key={cat.id} className={`rounded-2xl border ${colors.border} overflow-hidden`}>
            <div className={`px-4 py-3 ${colors.bg} flex items-center gap-2.5`}>
              <div className={`w-8 h-8 rounded-lg ${colors.iconBg} flex items-center justify-center`}>
                <Icon className="w-4 h-4 text-gray-700" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{cat.title}</p>
                <p className="text-[10px] text-gray-500">{cat.subtitle}</p>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {catDocs.map(doc => (
                <div key={doc.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                      {doc.file_size && <p className="text-[10px] text-gray-400">{(doc.file_size / 1024 / 1024).toFixed(1)} MB</p>}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50 flex-shrink-0"
                    disabled={downloading === doc.id} onClick={() => handleDownload(doc)}>
                    {downloading === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Download className="w-4 h-4 mr-1" /> Descargar</>}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Uncategorized docs */}
      {uncategorized.length > 0 && (
        <div className="rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <FileText className="w-4 h-4 text-gray-500" />
            </div>
            <p className="text-sm font-bold text-gray-900">Otros Documentos</p>
          </div>
          <div className="divide-y divide-gray-100">
            {uncategorized.map(doc => (
              <div key={doc.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                </div>
                <Button size="sm" variant="outline" disabled={downloading === doc.id} onClick={() => handleDownload(doc)}>
                  {downloading === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Download className="w-4 h-4 mr-1" /> Descargar</>}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
