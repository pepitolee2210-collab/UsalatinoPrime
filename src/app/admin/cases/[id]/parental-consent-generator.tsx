'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { FileText, Download, Loader2, Eye, Copy, X, Heart, Pencil, Save, Sparkles } from 'lucide-react'

interface Props {
  caseId: string
  clientName: string
}

type Mode = 'standard' | 'collaborative'

interface Content {
  en: string | null
  es: string | null
}

// Tipo persistido en case_form_submissions.form_data.declarations[]. Cada
// modo de la carta de renuncia se guarda como una entrada distinta usando
// los `type` del backend (mismos que envía /api/ai/generate-declaration).
interface StoredDoc {
  type: string
  index: number
  label: string
  content: string
  contentES?: string
  witnessName?: string
}

const TYPE_BY_MODE: Record<Mode, string> = {
  standard: 'parental_consent',
  collaborative: 'parental_consent_collaborative',
}

export function ParentalConsentGenerator({ caseId, clientName }: Props) {
  const [generating, setGenerating] = useState<Mode | null>(null)
  const [standard, setStandard] = useState<Content>({ en: null, es: null })
  const [collab, setCollab] = useState<Content>({ en: null, es: null })
  const [loaded, setLoaded] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<{ content: string; lang: 'en' | 'es'; mode: Mode } | null>(null)
  // Edición inline + corrección dirigida con IA, paridad con DeclarationGenerator.
  const [editing, setEditing] = useState(false)
  const [editedContent, setEditedContent] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [correcting, setCorrecting] = useState(false)
  const [correctionFeedback, setCorrectionFeedback] = useState('')
  const [applyingCorrection, setApplyingCorrection] = useState(false)

  // Carga las cartas guardadas desde el mismo endpoint que DeclarationGenerator
  // (single source of truth). Filtra por los `type` de cartas de renuncia.
  useEffect(() => {
    if (loaded) return
    setLoaded(true)
    fetch(`/api/cases/saved-declarations?case_id=${caseId}`)
      .then(r => r.json())
      .then((data: { declarations?: StoredDoc[] }) => {
        const all = data.declarations || []
        const std = all.find(d => d.type === TYPE_BY_MODE.standard)
        const col = all.find(d => d.type === TYPE_BY_MODE.collaborative)
        if (std) setStandard({ en: std.content, es: std.contentES ?? null })
        if (col) setCollab({ en: col.content, es: col.contentES ?? null })
      })
      .catch(() => {})
  }, [caseId, loaded])

  function setContent(mode: Mode, c: Content) {
    if (mode === 'collaborative') setCollab(c)
    else setStandard(c)
  }
  function getContent(mode: Mode): Content {
    return mode === 'collaborative' ? collab : standard
  }

  // Lee el array completo de declaraciones, reemplaza la entry de `mode` por
  // `next` (o la añade si no existe), y persiste todo de vuelta. Hace round
  // trip al GET para no pisar declaraciones de otros tipos (witness, etc.)
  // que viven en el mismo registro.
  async function persist(mode: Mode, content: Content) {
    if (!content.en) return
    try {
      const res = await fetch(`/api/cases/saved-declarations?case_id=${caseId}`)
      const data = await res.json() as { declarations?: StoredDoc[] }
      const all = data.declarations || []
      const targetType = TYPE_BY_MODE[mode]
      const filtered = all.filter(d => d.type !== targetType)
      const next: StoredDoc = {
        type: targetType,
        index: 0,
        label: mode === 'collaborative' ? 'Carta de Renuncia (Papá Colabora)' : 'Carta de Renuncia (Estándar)',
        content: content.en,
        ...(content.es ? { contentES: content.es } : {}),
      }
      const updated = [...filtered, next]
      await fetch('/api/cases/saved-declarations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId, declarations: updated }),
      })
    } catch {
      toast.error('No se pudo guardar la carta en la base de datos')
    }
  }

  async function generate(mode: Mode) {
    setGenerating(mode)
    const declarationType = TYPE_BY_MODE[mode]
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

      const next: Content = { en: dataEN.declaration, es: dataES.declaration }
      setContent(mode, next)
      await persist(mode, next)
      toast.success(`Carta generada en inglés y español (${mode === 'collaborative' ? 'modo colaborativo' : 'estándar'})`)
    } catch {
      toast.error('Error al generar. Intente de nuevo.')
    } finally {
      setGenerating(null)
    }
  }

  /**
   * Re-traduce un texto inglés al español llamando al endpoint de traducción
   * (mismo `english_source` que en la generación). Si falla, devuelve null y el
   * caller decide qué hacer.
   */
  async function retranslateToES(englishText: string, mode: Mode): Promise<string | null> {
    const declarationType = TYPE_BY_MODE[mode]
    try {
      const res = await fetch('/api/ai/generate-declaration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: caseId,
          type: declarationType,
          index: 0,
          lang: 'es',
          english_source: englishText,
        }),
      })
      if (!res.ok) return null
      const data = await res.json()
      return data.declaration as string
    } catch {
      return null
    }
  }

  /**
   * Guarda la edición manual del modal. Si se editó la versión EN, re-traduce
   * la ES para mantener consistencia 1:1. Si se editó la ES, solo actualiza ES.
   */
  async function saveEdit() {
    if (!previewDoc || !editedContent.trim()) return
    setSavingEdit(true)
    try {
      const current = getContent(previewDoc.mode)
      let next: Content
      if (previewDoc.lang === 'en') {
        const newES = await retranslateToES(editedContent, previewDoc.mode)
        if (newES === null) {
          toast.error('Error al re-traducir el español. Cambios EN no guardados.')
          return
        }
        next = { en: editedContent, es: newES }
        toast.success('Cambios guardados (ES re-traducido automáticamente)')
      } else {
        next = { en: current.en, es: editedContent }
        toast.success('Cambios guardados en español')
      }
      setContent(previewDoc.mode, next)
      await persist(previewDoc.mode, next)
      setPreviewDoc({ ...previewDoc, content: editedContent })
      setEditing(false)
      setEditedContent('')
    } catch {
      toast.error('Error al guardar los cambios')
    } finally {
      setSavingEdit(false)
    }
  }

  /**
   * Aplica una corrección dirigida vía /api/ai/correct-declaration: el modelo
   * recibe el texto actual + el feedback de Diana y devuelve el doc con SOLO
   * esa corrección. Si se corrigió EN, re-traduce ES para mantener paridad.
   */
  async function applyCorrection() {
    if (!previewDoc || correctionFeedback.trim().length < 5) return
    setApplyingCorrection(true)
    try {
      const resCorrect = await fetch('/api/ai/correct-declaration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_text: previewDoc.content,
          feedback: correctionFeedback.trim(),
          lang: previewDoc.lang,
        }),
      })
      if (!resCorrect.ok) {
        const dataC = await resCorrect.json().catch(() => ({}))
        throw new Error(dataC.error || 'Error al aplicar la corrección')
      }
      const dataC = await resCorrect.json()
      const corrected: string = dataC.corrected

      const current = getContent(previewDoc.mode)
      let next: Content
      if (previewDoc.lang === 'en') {
        const newES = await retranslateToES(corrected, previewDoc.mode)
        if (newES === null) {
          toast.error('Corrección aplicada en EN, pero ES no se pudo re-traducir.')
          next = { en: corrected, es: current.es }
        } else {
          next = { en: corrected, es: newES }
        }
      } else {
        next = { en: current.en, es: corrected }
      }
      setContent(previewDoc.mode, next)
      await persist(previewDoc.mode, next)
      setPreviewDoc({ ...previewDoc, content: corrected })
      setCorrecting(false)
      setCorrectionFeedback('')
      toast.success(previewDoc.lang === 'en' ? 'Corrección aplicada (ES re-sincronizado)' : 'Corrección aplicada en español')
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'Error al aplicar la corrección')
    } finally {
      setApplyingCorrection(false)
    }
  }

  function closePreview() {
    setPreviewDoc(null)
    setEditing(false)
    setCorrecting(false)
    setEditedContent('')
    setCorrectionFeedback('')
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
    const content = getContent(mode)
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
              <Button size="sm" variant="outline" onClick={() => setPreviewDoc({ content: content.en!, lang: 'en', mode })}
                title="Ver EN — desde aquí podés editar o corregir con IA">
                <Eye className="w-3 h-3 mr-1" /> EN
              </Button>
              <Button size="sm" variant="outline" onClick={() => content.es && setPreviewDoc({ content: content.es, lang: 'es', mode })}
                title="Ver ES">
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
          onClick={() => { if (!editing && !correcting) closePreview() }}>
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <p className="font-bold text-gray-900">{previewTitle}</p>
                <p className="text-xs text-gray-500">
                  {editing ? '✏️ Modo edición manual' : correcting ? '💬 Corrección dirigida con IA' : 'Vista previa'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!editing && !correcting && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(previewDoc.content); toast.success('Copiado') }}>
                      <Copy className="w-3 h-3 mr-1" /> Copiar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => downloadPDF(previewDoc.content, previewDoc.lang.toUpperCase(), previewDoc.mode)}>
                      <Download className="w-3 h-3 mr-1" /> Descargar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setEditing(true); setEditedContent(previewDoc.content) }}
                      className="border-blue-300 text-blue-700 hover:bg-blue-50">
                      <Pencil className="w-3 h-3 mr-1" /> Editar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setCorrecting(true)}
                      className="border-purple-300 text-purple-700 hover:bg-purple-50">
                      <Sparkles className="w-3 h-3 mr-1" /> Corregir con IA
                    </Button>
                  </>
                )}
                <button onClick={() => {
                  if (editing || correcting) {
                    setEditing(false); setCorrecting(false); setEditedContent(''); setCorrectionFeedback('')
                  } else {
                    closePreview()
                  }
                }}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            {editing ? (
              <>
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="mb-2 text-xs text-gray-500 flex items-center gap-2">
                    <Pencil className="w-3 h-3" />
                    Edita el texto directamente. Si modificas la versión EN, la ES se re-traduce al guardar.
                  </div>
                  <textarea
                    value={editedContent}
                    onChange={e => setEditedContent(e.target.value)}
                    className="w-full h-[60vh] p-4 text-sm font-serif leading-relaxed border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300/40 resize-none"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 p-4 border-t bg-gray-50">
                  <Button size="sm" variant="outline" onClick={() => { setEditing(false); setEditedContent('') }} disabled={savingEdit}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={saveEdit} disabled={savingEdit || !editedContent.trim()}
                    className="bg-blue-600 hover:bg-blue-700 text-white">
                    {savingEdit ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                    Guardar cambios
                  </Button>
                </div>
              </>
            ) : correcting ? (
              <>
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Documento actual</p>
                      <div className="h-[55vh] overflow-y-auto p-3 text-xs border border-gray-200 rounded-lg bg-gray-50">
                        <pre className="whitespace-pre-wrap font-serif leading-relaxed">{previewDoc.content}</pre>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">¿Qué hay que corregir?</p>
                      <textarea
                        value={correctionFeedback}
                        onChange={e => setCorrectionFeedback(e.target.value)}
                        placeholder='Ejemplo: "Cambia la fecha de la firma al 15 de mayo de 2026" o "El nombre del padre está mal escrito: es Carlos no Carlo".'
                        className="w-full h-[55vh] p-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300/40 resize-none"
                      />
                      <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                        Claude aplicará <strong>solo esa corrección</strong>, sin tocar el resto del documento. La versión en español se re-traduce automáticamente.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 p-4 border-t bg-gray-50">
                  <Button size="sm" variant="outline" onClick={() => { setCorrecting(false); setCorrectionFeedback('') }} disabled={applyingCorrection}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={applyCorrection} disabled={applyingCorrection || correctionFeedback.trim().length < 5}
                    className="bg-purple-600 hover:bg-purple-700 text-white">
                    {applyingCorrection ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Sparkles className="w-3 h-3 mr-1" />}
                    Aplicar corrección
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 overflow-y-auto p-6">
                <pre className="text-sm text-gray-800 whitespace-pre-wrap font-serif leading-relaxed">{previewDoc.content}</pre>
              </div>
            )}
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
