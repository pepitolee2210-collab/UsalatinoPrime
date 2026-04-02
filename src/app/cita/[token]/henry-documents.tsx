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

function detectLang(doc: { name: string; document_key: string }): 'en' | 'es' | 'unknown' {
  const key = (doc.document_key || '').toLowerCase()
  if (key.endsWith('_en')) return 'en'
  if (key.endsWith('_es')) return 'es'
  const lower = doc.name.toLowerCase()
  if (lower.includes('_en.') || lower.includes('_en ') || lower.includes('(en)') || lower.includes('english')) return 'en'
  if (lower.includes('_es.') || lower.includes('_es ') || lower.includes('(es)') || lower.includes('español') || lower.includes('spanish')) return 'es'
  return 'unknown'
}

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
      // Use <a> tag instead of window.open — works on iPhone/Safari
      const a = document.createElement('a')
      a.href = url
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      a.setAttribute('download', doc.name)
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch {
      toast.error('No se pudo descargar el documento')
    } finally {
      setDownloading(null)
    }
  }

  // Categorize documents
  function getCategoryDocs(cat: typeof DOC_CATEGORIES[0]) {
    return documents.filter(d => {
      const key = d.document_key?.toLowerCase() || ''
      return cat.keys.some(k => key.includes(k))
    })
  }

  const uncategorized = documents.filter(d =>
    !DOC_CATEGORIES.some(cat => cat.keys.some(k => d.document_key?.toLowerCase().includes(k)))
  )

  const hasAnyDoc = documents.length > 0

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
            {catDocs.length > 0 ? (
              <div>
                {/* English docs */}
                {catDocs.filter(d => detectLang(d) === 'en' || (detectLang(d) === 'unknown' && d.name.match(/english|affidavit|petition|consent|declaration/i))).length > 0 && (
                  <div className="px-4 pt-2 pb-1">
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">English</span>
                  </div>
                )}
                {catDocs.filter(d => detectLang(d) === 'en' || (detectLang(d) === 'unknown' && d.name.match(/english|affidavit|petition|consent|declaration/i))).map(doc => (
                  <div key={doc.id} className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded flex-shrink-0">EN</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50 flex-shrink-0"
                      disabled={downloading === doc.id} onClick={() => handleDownload(doc)}>
                      {downloading === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Download className="w-4 h-4 mr-1" /> Descargar</>}
                    </Button>
                  </div>
                ))}

                {/* Spanish docs */}
                {catDocs.filter(d => detectLang(d) === 'es' || (detectLang(d) === 'unknown' && d.name.match(/español|declaración|petición|carta|jurada/i))).length > 0 && (
                  <div className="px-4 pt-2 pb-1">
                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Español</span>
                  </div>
                )}
                {catDocs.filter(d => detectLang(d) === 'es' || (detectLang(d) === 'unknown' && d.name.match(/español|declaración|petición|carta|jurada/i))).map(doc => (
                  <div key={doc.id} className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded flex-shrink-0">ES</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50 flex-shrink-0"
                      disabled={downloading === doc.id} onClick={() => handleDownload(doc)}>
                      {downloading === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Download className="w-4 h-4 mr-1" /> Descargar</>}
                    </Button>
                  </div>
                ))}

                {/* Docs without detectable language */}
                {catDocs.filter(d => detectLang(d) === 'unknown' && !d.name.match(/english|affidavit|petition|consent|declaration|español|declaración|petición|carta|jurada/i)).map(doc => (
                  <div key={doc.id} className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50 flex-shrink-0"
                      disabled={downloading === doc.id} onClick={() => handleDownload(doc)}>
                      {downloading === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Download className="w-4 h-4 mr-1" /> Descargar</>}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-3">
                <div className="flex gap-3">
                  <div className="flex-1 text-center py-2 rounded-lg bg-blue-50/50 border border-blue-100">
                    <span className="text-[10px] font-bold text-blue-500">EN</span>
                    <p className="text-[10px] text-gray-400 mt-0.5">Pendiente</p>
                  </div>
                  <div className="flex-1 text-center py-2 rounded-lg bg-amber-50/50 border border-amber-100">
                    <span className="text-[10px] font-bold text-amber-500">ES</span>
                    <p className="text-[10px] text-gray-400 mt-0.5">Pendiente</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}

    </div>
  )
}
