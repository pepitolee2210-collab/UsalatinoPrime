'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { FileText, Download, Loader2, Eye, Copy, X } from 'lucide-react'

interface Props {
  caseId: string
  clientName: string
}

export function ParentalConsentGenerator({ caseId, clientName }: Props) {
  const [generating, setGenerating] = useState(false)
  const [contentEN, setContentEN] = useState<string | null>(null)
  const [contentES, setContentES] = useState<string | null>(null)
  const [previewDoc, setPreviewDoc] = useState<{ content: string; lang: string } | null>(null)

  async function generate() {
    setGenerating(true)
    try {
      // Generate English
      const resEN = await fetch('/api/ai/generate-declaration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId, type: 'parental_consent', index: 0, lang: 'en' }),
      })
      if (!resEN.ok) throw new Error()
      const dataEN = await resEN.json()
      setContentEN(dataEN.declaration)

      // Generate Spanish
      const resES = await fetch('/api/ai/generate-declaration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId, type: 'parental_consent', index: 0, lang: 'es' }),
      })
      if (!resES.ok) throw new Error()
      const dataES = await resES.json()
      setContentES(dataES.declaration)

      toast.success('Carta generada en inglés y español')
    } catch {
      toast.error('Error al generar. Intente de nuevo.')
    } finally {
      setGenerating(false)
    }
  }

  async function downloadPDF(content: string, langLabel: string) {
    if (!content) return
    try {
      const { default: jsPDF } = await import('jspdf')
      const doc = new jsPDF('p', 'mm', 'letter')
      const pw = doc.internal.pageSize.getWidth()
      const ml = 25
      const contentWidth = pw - ml - 25
      let y = 25

      // Title
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.text('PARENTAL CONSENT TO TEMPORARY GUARDIANSHIP', pw / 2, y, { align: 'center' })
      y += 12

      // Body — split by lines
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      const lines = doc.splitTextToSize(content.replace(/^PARENTAL CONSENT TO TEMPORARY GUARDIANSHIP\s*/i, '').trim(), contentWidth)
      for (const line of lines) {
        if (y > 260) { doc.addPage(); y = 25 }
        doc.text(line, ml, y)
        y += 4.5
      }

      doc.save(`Parental_Consent_${langLabel}_${clientName.replace(/\s+/g, '_')}.pdf`)
      toast.success('PDF descargado')
    } catch {
      toast.error('Error al generar PDF')
    }
  }

  return (
    <div className="space-y-3">
      {/* Preview modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setPreviewDoc(null)}>
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <p className="font-bold text-gray-900">Carta de Renuncia — {previewDoc.lang === 'en' ? 'English' : 'Español'}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(previewDoc.content); toast.success('Copiado') }}>
                  <Copy className="w-3 h-3 mr-1" /> Copiar
                </Button>
                <Button size="sm" variant="outline" onClick={() => downloadPDF(previewDoc.content, previewDoc.lang)}>
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

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              {contentEN ? <FileText className="w-5 h-5 text-green-500" /> : <FileText className="w-5 h-5 text-blue-600" />}
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">1. Carta de Renuncia de los Padres</p>
              <p className="text-xs text-gray-500">Parental Consent to Temporary Guardianship</p>
            </div>
          </div>

          {generating ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#002855]">
              <Loader2 className="w-4 h-4 animate-spin text-[#F2A900]" />
              <span className="text-xs text-white font-medium">Generando EN + ES...</span>
            </div>
          ) : contentEN ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-green-600 font-bold">✓</span>
              <Button size="sm" variant="outline" onClick={() => setPreviewDoc({ content: contentEN!, lang: 'en' })}>
                <Eye className="w-3 h-3 mr-1" /> EN
              </Button>
              <Button size="sm" variant="outline" onClick={() => contentES && setPreviewDoc({ content: contentES, lang: 'es' })}>
                <Eye className="w-3 h-3 mr-1" /> ES
              </Button>
              <Button size="sm" variant="ghost" onClick={() => downloadPDF(contentEN!, 'EN')}>
                <Download className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => contentES && downloadPDF(contentES, 'ES')}>
                <Download className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="outline" onClick={generate}>Regenerar</Button>
            </div>
          ) : (
            <Button className="bg-[#F2A900] hover:bg-[#D4940A] text-[#001020] font-bold" onClick={generate}>
              Generar
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
