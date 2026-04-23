'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { FileText, Download, Loader2, Eye, Copy, X, Heart } from 'lucide-react'

interface Props {
  caseId: string
  clientName: string
}

type Mode = 'standard' | 'collaborative'

interface Content {
  en: string | null
  es: string | null
}

export function ParentalConsentGenerator({ caseId, clientName }: Props) {
  const [generating, setGenerating] = useState<Mode | null>(null)
  const [standard, setStandard] = useState<Content>({ en: null, es: null })
  const [collab, setCollab] = useState<Content>({ en: null, es: null })
  const [previewDoc, setPreviewDoc] = useState<{ content: string; lang: string; mode: Mode } | null>(null)

  async function generate(mode: Mode) {
    setGenerating(mode)
    const declarationType = mode === 'collaborative' ? 'parental_consent_collaborative' : 'parental_consent'
    try {
      const resEN = await fetch('/api/ai/generate-declaration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId, type: declarationType, index: 0, lang: 'en' }),
      })
      if (!resEN.ok) throw new Error()
      const dataEN = await resEN.json()

      // Spanish = translation of English (cheaper, 1:1 consistency).
      const resES = await fetch('/api/ai/generate-declaration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: caseId,
          type: declarationType,
          index: 0,
          lang: 'es',
          english_source: dataEN.declaration,
        }),
      })
      if (!resES.ok) throw new Error()
      const dataES = await resES.json()

      if (mode === 'collaborative') {
        setCollab({ en: dataEN.declaration, es: dataES.declaration })
      } else {
        setStandard({ en: dataEN.declaration, es: dataES.declaration })
      }
      toast.success(`Carta generada en inglés y español (${mode === 'collaborative' ? 'modo colaborativo' : 'estándar'})`)
    } catch {
      toast.error('Error al generar. Intente de nuevo.')
    } finally {
      setGenerating(null)
    }
  }

  async function downloadPDF(content: string, langLabel: string, mode: Mode) {
    if (!content) return
    try {
      const { default: jsPDF } = await import('jspdf')
      const doc = new jsPDF('p', 'mm', 'letter')
      const pw = doc.internal.pageSize.getWidth()
      const ml = 25
      const contentWidth = pw - ml - 25
      let y = 25

      const titleEN = mode === 'collaborative' ? 'VOLUNTARY RELINQUISHMENT OF PARENTAL CUSTODY' : 'PARENTAL CONSENT TO TEMPORARY GUARDIANSHIP'
      const titleES = mode === 'collaborative' ? 'RENUNCIA VOLUNTARIA DE PATRIA POTESTAD Y CUSTODIA' : 'CONSENTIMIENTO PARENTAL PARA TUTELA TEMPORAL'
      const title = langLabel === 'EN' ? titleEN : titleES

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.text(title, pw / 2, y, { align: 'center' })
      y += 12

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      const clean = content
        .replace(new RegExp('^' + titleEN + '\\s*', 'i'), '')
        .replace(new RegExp('^' + titleES + '\\s*', 'i'), '')
        .trim()
      const lines = doc.splitTextToSize(clean, contentWidth)
      for (const line of lines) {
        if (y > 260) { doc.addPage(); y = 25 }
        doc.text(line, ml, y)
        y += 4.5
      }

      const suffix = mode === 'collaborative' ? 'Colaborativa' : 'Estandar'
      doc.save(`Renuncia_${suffix}_${langLabel}_${clientName.replace(/\s+/g, '_')}.pdf`)
      toast.success('PDF descargado')
    } catch {
      toast.error('Error al generar PDF')
    }
  }

  const renderCard = (mode: Mode, title: string, subtitle: string, icon: React.ReactNode, accent: 'blue' | 'rose') => {
    const content = mode === 'collaborative' ? collab : standard
    const isGenerating = generating === mode
    const hasContent = !!content.en
    const colors = accent === 'rose'
      ? { border: 'border-rose-200', bg: 'bg-rose-50', iconBg: 'bg-rose-100', iconText: 'text-rose-600' }
      : { border: 'border-blue-200', bg: 'bg-blue-50', iconBg: 'bg-blue-100', iconText: 'text-blue-600' }

    return (
      <div className={`rounded-xl border ${colors.border} ${colors.bg} p-4`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${colors.iconBg} flex items-center justify-center flex-shrink-0`}>
              {hasContent ? <FileText className="w-5 h-5 text-green-500" /> : <div className={colors.iconText}>{icon}</div>}
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{title}</p>
              <p className="text-xs text-gray-500">{subtitle}</p>
            </div>
          </div>

          {isGenerating ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#002855]">
              <Loader2 className="w-4 h-4 animate-spin text-[#F2A900]" />
              <span className="text-xs text-white font-medium">Generando EN + ES...</span>
            </div>
          ) : hasContent ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-green-600 font-bold">✓</span>
              <Button size="sm" variant="outline" onClick={() => setPreviewDoc({ content: content.en!, lang: 'en', mode })}>
                <Eye className="w-3 h-3 mr-1" /> EN
              </Button>
              <Button size="sm" variant="outline" onClick={() => content.es && setPreviewDoc({ content: content.es, lang: 'es', mode })}>
                <Eye className="w-3 h-3 mr-1" /> ES
              </Button>
              <Button size="sm" variant="ghost" onClick={() => downloadPDF(content.en!, 'EN', mode)} title="PDF EN">
                <Download className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => content.es && downloadPDF(content.es, 'ES', mode)} title="PDF ES">
                <Download className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => generate(mode)}>Regenerar</Button>
            </div>
          ) : (
            <Button
              className={accent === 'rose'
                ? 'bg-rose-600 hover:bg-rose-700 text-white font-bold'
                : 'bg-[#F2A900] hover:bg-[#D4940A] text-[#001020] font-bold'}
              onClick={() => generate(mode)}
              disabled={!!generating}
            >
              Generar
            </Button>
          )}
        </div>
      </div>
    )
  }

  const previewTitle = previewDoc
    ? `Carta de Renuncia ${previewDoc.mode === 'collaborative' ? '(Papá Colabora) ' : ''}— ${previewDoc.lang === 'en' ? 'English' : 'Español'}`
    : ''

  return (
    <div className="space-y-3">
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setPreviewDoc(null)}>
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <p className="font-bold text-gray-900">{previewTitle}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(previewDoc.content); toast.success('Copiado') }}>
                  <Copy className="w-3 h-3 mr-1" /> Copiar
                </Button>
                <Button size="sm" variant="outline" onClick={() => downloadPDF(previewDoc.content, previewDoc.lang.toUpperCase(), previewDoc.mode)}>
                  <Download className="w-3 h-3 mr-1" /> PDF
                </Button>
                <button onClick={() => setPreviewDoc(null)} className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <pre className="text-sm text-gray-800 whitespace-pre-wrap font-serif leading-relaxed">{previewDoc.content}</pre>
            </div>
          </div>
        </div>
      )}

      {renderCard(
        'standard',
        '1. Carta de Renuncia de los Padres',
        'Parental Consent to Temporary Guardianship (estándar)',
        <FileText className="w-5 h-5" />,
        'blue',
      )}

      {renderCard(
        'collaborative',
        '1.b Carta de Renuncia — Papá Colabora',
        'Voluntary Relinquishment — el padre asume culpa y negligencia',
        <Heart className="w-5 h-5" />,
        'rose',
      )}
    </div>
  )
}
