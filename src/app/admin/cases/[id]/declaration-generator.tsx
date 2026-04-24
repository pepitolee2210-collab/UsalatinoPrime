'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  FileText, Loader2, Download, Copy, CheckCircle, Users, User, Eye, X, Sparkles, Pencil, Save,
} from 'lucide-react'
import { ReadinessPanel } from './readiness-panel'

interface DeclarationGeneratorProps {
  caseId: string
  clientName: string
  tutorData: Record<string, unknown> | null
  minorStories: { minorIndex: number; formData: Record<string, unknown> }[]
  absentParents?: { formData: Record<string, unknown> }[]
  supplementaryData?: Record<string, unknown> | null
}

interface GeneratedDoc {
  type: string
  index: number
  label: string
  content: string
  contentES?: string
}

export function DeclarationGenerator({ caseId, clientName, tutorData, minorStories, absentParents, supplementaryData }: DeclarationGeneratorProps) {
  const [generating, setGenerating] = useState<string | null>(null)
  const [docs, setDocs] = useState<GeneratedDoc[]>([])
  const [previewDoc, setPreviewDoc] = useState<GeneratedDoc | null>(null)
  const [loaded, setLoaded] = useState(false)
  // Editor inline (mejora #3) y corrección dirigida (mejora #4)
  const [editing, setEditing] = useState(false)
  const [editedContent, setEditedContent] = useState('')
  const [correcting, setCorrecting] = useState(false)
  const [correctionFeedback, setCorrectionFeedback] = useState('')
  const [applyingCorrection, setApplyingCorrection] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)

  // Load saved declarations on mount
  if (!loaded) {
    setLoaded(true)
    fetch(`/api/cases/saved-declarations?case_id=${caseId}`)
      .then(r => r.json())
      .then(data => {
        if (data.declarations?.length) setDocs(data.declarations)
      })
      .catch(() => {})
  }

  const tutorName = (tutorData?.full_name as string) || clientName
  const witnesses = ((tutorData?.witnesses as Array<Record<string, string>>) || []).filter(w => w.name?.trim())

  async function generate(type: 'tutor' | 'minor' | 'witness' | 'petition_guardianship', index: number, label: string) {
    const key = `${type}-${index}`
    setGenerating(key)
    try {
      // Generate English (from case data)
      const resEN = await fetch('/api/ai/generate-declaration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId, type, index, lang: 'en' }),
      })
      const dataEN = await resEN.json()
      if (!resEN.ok) throw new Error(dataEN.error || 'Error EN')

      // Spanish is TRANSLATED from the English version (not generated from case).
      // Cheaper (~50%) y garantiza consistencia 1:1 entre ambas versiones —
      // mismos datos, mismas fechas, mismo orden de párrafos.
      const resES = await fetch('/api/ai/generate-declaration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: caseId,
          type,
          index,
          lang: 'es',
          english_source: dataEN.declaration,
        }),
      })
      const dataES = await resES.json()
      if (!resES.ok) throw new Error(dataES.error || 'Error ES')

      const newDoc = { type, index, label, content: dataEN.declaration, contentES: dataES.declaration }
      setDocs(prev => {
        const filtered = prev.filter(d => !(d.type === type && d.index === index))
        const updated = [...filtered, newDoc]
        // Save to DB
        fetch('/api/cases/saved-declarations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ case_id: caseId, declarations: updated }),
        }).catch(() => {})
        return updated
      })
      const missingEN: number = dataEN?.warnings?.missingCount ?? 0
      const missingES: number = dataES?.warnings?.missingCount ?? 0
      const totalMissing = Math.max(missingEN, missingES)
      if (totalMissing > 0) {
        toast.warning(`${label} generado con ${totalMissing} dato(s) faltante(s). Revisa antes de usar.`)
      } else {
        toast.success(`${label} generado en inglés y español`)
      }
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'Error al generar. Intente de nuevo.')
    } finally {
      setGenerating(null)
    }
  }

  function copyToClipboard(content: string) {
    navigator.clipboard.writeText(content)
    toast.success('Copiado al portapapeles')
  }

  async function downloadAsPDF(doc: GeneratedDoc) {
    try {
      const { default: jsPDF } = await import('jspdf')
      const pdf = new jsPDF('p', 'mm', 'letter')
      const pw = pdf.internal.pageSize.getWidth()
      const ml = 25
      const contentWidth = pw - ml - 25
      let y = 25

      // Title — first line of content or doc label
      const lines = doc.content.split('\n')
      const titleLine = lines[0]?.trim() || doc.label
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(13)
      const titleWrapped = pdf.splitTextToSize(titleLine, contentWidth)
      titleWrapped.forEach((line: string) => {
        pdf.text(line, pw / 2, y, { align: 'center' })
        y += 6
      })
      y += 6

      // Body
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(11)
      const bodyText = lines.slice(1).join('\n').trim()
      const bodyLines = pdf.splitTextToSize(bodyText, contentWidth)
      for (const line of bodyLines) {
        if (y > 260) { pdf.addPage(); y = 25 }
        pdf.text(line, ml, y)
        y += 4.5
      }

      pdf.save(`${doc.label.replace(/\s+/g, '_')}.pdf`)
      toast.success('PDF descargado')
    } catch {
      toast.error('Error al generar PDF')
    }
  }

  const getDoc = (type: string, index: number) => docs.find(d => d.type === type && d.index === index)

  function previewES(doc: GeneratedDoc) {
    if (doc.contentES) setPreviewDoc({ ...doc, content: doc.contentES, label: doc.label + ' (Español)' })
  }

  function openPreview(doc: GeneratedDoc) {
    setPreviewDoc(doc)
    setEditing(false)
    setCorrecting(false)
    setEditedContent('')
    setCorrectionFeedback('')
  }

  /**
   * Determina si el preview abierto es la versión EN o ES y devuelve el
   * objeto base del documento (sin el sufijo "(Español)") para poder
   * persistir los cambios contra el `docs` array.
   */
  function findBaseDoc(preview: GeneratedDoc): { base: GeneratedDoc; isES: boolean } | null {
    const isES = preview.label.endsWith('(Español)')
    const base = docs.find(d => d.type === preview.type && d.index === preview.index)
    if (!base) return null
    return { base, isES }
  }

  /**
   * Guarda el documento editado manualmente. Si es la versión EN,
   * automáticamente re-traduce la ES para mantener consistencia.
   */
  async function saveEdit() {
    if (!previewDoc || !editedContent.trim()) return
    const found = findBaseDoc(previewDoc)
    if (!found) return

    setSavingEdit(true)
    try {
      let newDoc: GeneratedDoc
      if (found.isES) {
        // Solo actualizamos el ES; no re-generamos EN.
        newDoc = { ...found.base, contentES: editedContent }
      } else {
        // Se editó el EN → re-traducir el ES para mantener consistencia.
        const resES = await fetch('/api/ai/generate-declaration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            case_id: caseId,
            type: previewDoc.type,
            index: previewDoc.index,
            lang: 'es',
            english_source: editedContent,
          }),
        })
        const dataES = await resES.json()
        if (!resES.ok) throw new Error(dataES.error || 'Error al re-traducir ES')
        newDoc = { ...found.base, content: editedContent, contentES: dataES.declaration }
      }

      const updated = docs.filter(d => !(d.type === found.base.type && d.index === found.base.index))
      updated.push(newDoc)
      setDocs(updated)

      // Persist to DB
      await fetch('/api/cases/saved-declarations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId, declarations: updated }),
      })

      // Actualizar el previewDoc para que muestre el contenido nuevo
      if (found.isES) {
        setPreviewDoc({ ...previewDoc, content: editedContent })
      } else {
        setPreviewDoc({ ...previewDoc, content: editedContent })
      }
      setEditing(false)
      setEditedContent('')
      toast.success(found.isES ? 'Cambios guardados en español' : 'Cambios guardados (ES re-traducido automáticamente)')
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'Error al guardar los cambios')
    } finally {
      setSavingEdit(false)
    }
  }

  /**
   * Aplica una corrección dirigida: Claude recibe el documento actual + el
   * feedback del admin y devuelve el documento con SOLO esa corrección.
   * Si se corrigió el EN, re-traduce el ES automáticamente.
   */
  async function applyCorrection() {
    if (!previewDoc || !correctionFeedback.trim()) return
    const found = findBaseDoc(previewDoc)
    if (!found) return

    setApplyingCorrection(true)
    try {
      const resCorrect = await fetch('/api/ai/correct-declaration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_text: previewDoc.content,
          feedback: correctionFeedback.trim(),
          lang: found.isES ? 'es' : 'en',
        }),
      })
      const dataC = await resCorrect.json()
      if (!resCorrect.ok) throw new Error(dataC.error || 'Error al aplicar la corrección')

      let newDoc: GeneratedDoc
      if (found.isES) {
        newDoc = { ...found.base, contentES: dataC.corrected }
      } else {
        // Se corrigió el EN → re-traducir el ES.
        const resES = await fetch('/api/ai/generate-declaration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            case_id: caseId,
            type: previewDoc.type,
            index: previewDoc.index,
            lang: 'es',
            english_source: dataC.corrected,
          }),
        })
        const dataES = await resES.json()
        if (!resES.ok) throw new Error(dataES.error || 'Error al re-traducir ES')
        newDoc = { ...found.base, content: dataC.corrected, contentES: dataES.declaration }
      }

      const updated = docs.filter(d => !(d.type === found.base.type && d.index === found.base.index))
      updated.push(newDoc)
      setDocs(updated)

      await fetch('/api/cases/saved-declarations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId, declarations: updated }),
      })

      setPreviewDoc({ ...previewDoc, content: dataC.corrected })
      setCorrecting(false)
      setCorrectionFeedback('')
      toast.success('Corrección aplicada (ES re-sincronizado)')
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'Error al aplicar la corrección')
    } finally {
      setApplyingCorrection(false)
    }
  }

  function downloadES(doc: GeneratedDoc) {
    if (doc.contentES) downloadAsPDF({ ...doc, content: doc.contentES, label: doc.label + '_ES' })
  }

  return (
    <div className="space-y-4">
      {/* Readiness panel — #2 */}
      <ReadinessPanel
        tutorData={tutorData}
        minorStories={minorStories}
        absentParents={absentParents}
        supplementaryData={supplementaryData}
        caseId={caseId}
      />

      {/* Preview modal — soporta lectura, edición inline (#3) y corrección dirigida (#4) */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => { if (!editing && !correcting) setPreviewDoc(null) }}>
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <p className="font-bold text-gray-900">{previewDoc.label}</p>
                <p className="text-xs text-gray-500">
                  {editing ? '✏️ Modo edición manual' : correcting ? '💬 Corrección dirigida con IA' : 'Vista previa'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!editing && !correcting && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => copyToClipboard(previewDoc.content)}>
                      <Copy className="w-3 h-3 mr-1" /> Copiar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => downloadAsPDF(previewDoc)}>
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
                    setPreviewDoc(null)
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
                        placeholder='Ejemplo: "El párrafo 5 dice que el abandono fue en 2015 pero fue en 2013. También el nombre del testigo en el párrafo 8 está mal escrito: es Libia no Lidia."'
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

      <div className="flex items-center gap-2 mb-2">
        <FileText className="w-5 h-5 text-[#F2A900]" />
        <h3 className="font-bold text-gray-900">Generar Declaraciones Juradas</h3>
      </div>
      <p className="text-xs text-gray-500">
        La IA toma los datos del caso y genera declaraciones listas para imprimir. Cada documento se genera en inglés con formato legal.
      </p>

      {/* Petition for Guardianship — per minor */}
      {minorStories.map((story, i) => {
        const mb = (story.formData?.minorBasic || {}) as Record<string, string>
        const name = mb.full_name || `Hijo/a ${i + 1}`
        return (
          <DocCard
            key={`petition-${i}`}
            icon={<FileText className="w-4 h-4 text-emerald-600" />}
            title="Petición de Tutela"
            subtitle={`Petition for Guardianship — ${name}`}
            color="emerald"
            generating={generating === `petition_guardianship-${i}`}
            generated={!!getDoc('petition_guardianship', i)}
            onGenerate={() => generate('petition_guardianship', i, `Petición ${name}`)}
            onPreview={() => openPreview(getDoc('petition_guardianship', i)!)}
            onCopy={() => copyToClipboard(getDoc('petition_guardianship', i)!.content)}
            onDownload={() => downloadAsPDF(getDoc('petition_guardianship', i)!)}
            onPreviewES={() => previewES(getDoc('petition_guardianship', i)!)}
            onDownloadES={() => downloadES(getDoc('petition_guardianship', i)!)}
          />
        )
      })}

      {/* Tutor Declaration */}
      <DocCard
        icon={<Users className="w-4 h-4 text-blue-600" />}
        title="Declaración del Tutor/Guardián"
        subtitle={tutorName}
        color="blue"
        generating={generating === 'tutor-0'}
        generated={!!getDoc('tutor', 0)}
        onGenerate={() => generate('tutor', 0, tutorName)}
        onPreview={() => openPreview(getDoc('tutor', 0)!)}
        onCopy={() => copyToClipboard(getDoc('tutor', 0)!.content)}
        onDownload={() => downloadAsPDF(getDoc('tutor', 0)!)}
        onPreviewES={() => previewES(getDoc('tutor', 0)!)}
        onDownloadES={() => downloadES(getDoc('tutor', 0)!)}
      />

      {/* Minor Declarations */}
      {minorStories.map((story, i) => {
        const mb = (story.formData?.minorBasic || {}) as Record<string, string>
        const name = mb.full_name || `Hijo/a ${i + 1}`
        return (
          <DocCard
            key={`minor-${i}`}
            icon={<User className="w-4 h-4 text-amber-600" />}
            title={`Declaración del Menor`}
            subtitle={name}
            color="amber"
            generating={generating === `minor-${i}`}
            generated={!!getDoc('minor', i)}
            onGenerate={() => generate('minor', i, name)}
            onPreview={() => openPreview(getDoc('minor', i)!)}
            onCopy={() => copyToClipboard(getDoc('minor', i)!.content)}
            onDownload={() => downloadAsPDF(getDoc('minor', i)!)}
            onPreviewES={() => previewES(getDoc('minor', i)!)}
            onDownloadES={() => downloadES(getDoc('minor', i)!)}
          />
        )
      })}

      {/* Witness Declarations */}
      {witnesses.map((w, i) => (
        <DocCard
          key={`witness-${i}`}
          icon={<Users className="w-4 h-4 text-purple-600" />}
          title={`Declaración del Testigo ${i + 1}`}
          subtitle={w.name}
          color="purple"
          generating={generating === `witness-${i}`}
          generated={!!getDoc('witness', i)}
          onGenerate={() => generate('witness', i, w.name)}
          onPreview={() => openPreview(getDoc('witness', i)!)}
          onCopy={() => copyToClipboard(getDoc('witness', i)!.content)}
          onDownload={() => downloadAsPDF(getDoc('witness', i)!)}
          onPreviewES={() => previewES(getDoc('witness', i)!)}
          onDownloadES={() => downloadES(getDoc('witness', i)!)}
        />
      ))}

      {witnesses.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-2">No hay testigos registrados en la declaración del tutor.</p>
      )}

      {/* Generate All */}
      {(minorStories.length > 0 || witnesses.length > 0) && (
        <Button
          className="w-full bg-[#002855] hover:bg-[#001d3d] h-12"
          disabled={!!generating}
          onClick={async () => {
            for (let i = 0; i < minorStories.length; i++) {
              const mb = (minorStories[i].formData?.minorBasic || {}) as Record<string, string>
              await generate('petition_guardianship', i, `Petición ${mb.full_name || `Hijo/a ${i + 1}`}`)
            }
            await generate('tutor', 0, tutorName)
            for (let i = 0; i < minorStories.length; i++) {
              const mb = (minorStories[i].formData?.minorBasic || {}) as Record<string, string>
              await generate('minor', i, mb.full_name || `Hijo/a ${i + 1}`)
            }
            for (let i = 0; i < witnesses.length; i++) {
              await generate('witness', i, witnesses[i].name)
            }
            toast.success('Todas las declaraciones generadas')
          }}
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
          Generar Todas las Declaraciones
        </Button>
      )}
    </div>
  )
}

function DocCard({ icon, title, subtitle, color, generating, generated, onGenerate, onPreview, onPreviewES, onCopy, onDownload, onDownloadES }: {
  icon: React.ReactNode; title: string; subtitle: string; color: string
  generating: boolean; generated: boolean
  onGenerate: () => void; onPreview: () => void; onPreviewES?: () => void; onCopy: () => void; onDownload: () => void; onDownloadES?: () => void
}) {
  void onCopy

  const colorMap: Record<string, { bg: string; border: string; badge: string }> = {
    blue:    { bg: 'bg-blue-50',    border: 'border-blue-200',    badge: 'bg-blue-100 text-blue-700' },
    amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',   badge: 'bg-amber-100 text-amber-700' },
    purple:  { bg: 'bg-purple-50',  border: 'border-purple-200',  badge: 'bg-purple-100 text-purple-700' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700' },
  }
  const c = colorMap[color] || colorMap.blue

  return (
    <div className={`rounded-xl border ${c.border} ${generated ? c.bg : 'bg-white'} p-4`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center flex-shrink-0`}>
            {generated ? <CheckCircle className="w-5 h-5 text-green-500" /> : icon}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">{title}</p>
            <p className="text-xs text-gray-500 truncate">{subtitle}</p>
          </div>
        </div>

        {generating ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[#F2A900]" />
            <span className="text-xs text-[#9a6500] font-medium">Henry está generando...</span>
          </div>
        ) : generated ? (
          <div className="flex items-center gap-1 flex-wrap">
            <Badge className="bg-green-100 text-green-700">✓</Badge>
            <Button size="sm" variant="outline" onClick={onPreview} title="Ver EN — desde aquí podés editar o corregir con IA"><Eye className="w-3 h-3 mr-1" />EN</Button>
            {onPreviewES && <Button size="sm" variant="outline" onClick={onPreviewES} title="Ver ES"><Eye className="w-3 h-3 mr-1" />ES</Button>}
            <Button size="sm" variant="ghost" onClick={onDownload} title="PDF EN"><Download className="w-3 h-3" /></Button>
            {onDownloadES && <Button size="sm" variant="ghost" onClick={onDownloadES} title="PDF ES"><Download className="w-3 h-3" /></Button>}
          </div>
        ) : (
          <Button size="sm" className="bg-[#F2A900] hover:bg-[#D4940A] text-[#001020] font-bold"
            onClick={onGenerate}>
            Generar
          </Button>
        )}
      </div>
    </div>
  )
}
