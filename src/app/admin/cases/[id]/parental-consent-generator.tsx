'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { FileText, Download, Loader2, Eye, Copy, X, Heart, Pencil, Save, Sparkles } from 'lucide-react'
import { fetchJsonSafe } from '@/lib/api/fetch-json'

interface JurisdictionStatusResp {
  ready: boolean
  status: 'completed' | 'incomplete' | 'pending' | 'failed' | 'missing'
  research_error: string | null
}

interface ParentalDeclarationResp {
  declaration: string
}

interface FormSub {
  form_type: string
  form_data: Record<string, unknown>
  status: string
  updated_at: string
  minor_index: number
}

interface Props {
  caseId: string
  clientName: string
  formSubmissions?: FormSub[]
}

type Mode = 'standard' | 'collaborative'
type ParentRole = 'father' | 'mother' | 'any'  // 'any' = legacy / sin diferenciación
type SlotKey = `${Mode}_${ParentRole}`

interface Content {
  en: string | null
  es: string | null
}

// Tipo persistido en case_form_submissions.form_data.declarations[]. Cada
// modo de la carta de renuncia se guarda como una entrada distinta usando
// los `type` del backend (mismos que envía /api/ai/generate-declaration).
// `parent_role` permite distinguir cartas separadas para padre y madre cuando
// el menor reportó abandono por ambos.
interface StoredDoc {
  type: string
  index: number
  label: string
  content: string
  contentES?: string
  witnessName?: string
  parent_role?: 'father' | 'mother'
}

const TYPE_BY_MODE: Record<Mode, string> = {
  standard: 'parental_consent',
  collaborative: 'parental_consent_collaborative',
}

interface SlotDef {
  key: SlotKey
  mode: Mode
  parentRole: ParentRole
  title: string
  subtitle: string
  accent: 'blue' | 'rose'
}

function slotKey(mode: Mode, role: ParentRole): SlotKey {
  return `${mode}_${role}`
}

/**
 * Decide qué slots renderizar según la respuesta del cliente en `minorAbuse.abandoned_by`.
 * - 'both': 4 slots (estándar + colaborativa, padre + madre).
 * - 'father' / 'mother': 2 slots etiquetados con ese rol.
 * - 'none' / '' / undefined: 2 slots genéricos (comportamiento legacy).
 */
function computeSlots(abandonedBy: string | undefined): SlotDef[] {
  if (abandonedBy === 'both') {
    return [
      { key: slotKey('standard', 'father'),      mode: 'standard',      parentRole: 'father', title: '1. Renuncia del Padre — Estándar',         subtitle: 'Parental Consent — perspectiva del padre',          accent: 'blue' },
      { key: slotKey('collaborative', 'father'), mode: 'collaborative', parentRole: 'father', title: '1.b Renuncia del Padre — Colaborativa',    subtitle: 'Voluntary Relinquishment — el padre asume culpa',   accent: 'rose' },
      { key: slotKey('standard', 'mother'),      mode: 'standard',      parentRole: 'mother', title: '2. Renuncia de la Madre — Estándar',       subtitle: 'Parental Consent — perspectiva de la madre',        accent: 'blue' },
      { key: slotKey('collaborative', 'mother'), mode: 'collaborative', parentRole: 'mother', title: '2.b Renuncia de la Madre — Colaborativa',  subtitle: 'Voluntary Relinquishment — la madre asume culpa',   accent: 'rose' },
    ]
  }
  if (abandonedBy === 'father') {
    return [
      { key: slotKey('standard', 'father'),      mode: 'standard',      parentRole: 'father', title: '1. Renuncia del Padre — Estándar',         subtitle: 'Parental Consent to Temporary Guardianship',         accent: 'blue' },
      { key: slotKey('collaborative', 'father'), mode: 'collaborative', parentRole: 'father', title: '1.b Renuncia del Padre — Colaborativa',    subtitle: 'Voluntary Relinquishment — el padre asume culpa',   accent: 'rose' },
    ]
  }
  if (abandonedBy === 'mother') {
    return [
      { key: slotKey('standard', 'mother'),      mode: 'standard',      parentRole: 'mother', title: '1. Renuncia de la Madre — Estándar',       subtitle: 'Parental Consent to Temporary Guardianship',         accent: 'blue' },
      { key: slotKey('collaborative', 'mother'), mode: 'collaborative', parentRole: 'mother', title: '1.b Renuncia de la Madre — Colaborativa',  subtitle: 'Voluntary Relinquishment — la madre asume culpa',   accent: 'rose' },
    ]
  }
  // 'none', vacío o undefined: legacy (genérico)
  return [
    { key: slotKey('standard', 'any'),      mode: 'standard',      parentRole: 'any', title: '1. Carta de Renuncia de los Padres',          subtitle: 'Parental Consent to Temporary Guardianship (estándar)', accent: 'blue' },
    { key: slotKey('collaborative', 'any'), mode: 'collaborative', parentRole: 'any', title: '1.b Carta de Renuncia — Padre Colabora',      subtitle: 'Voluntary Relinquishment — el padre asume culpa y negligencia', accent: 'rose' },
  ]
}

/**
 * Lookup de un slot dentro del array persistido. Empareja por `type` y `parent_role`.
 * Para slots `'any'` (legacy), acepta entradas sin `parent_role` en form_data.
 */
function findStoredFor(all: StoredDoc[], slot: SlotDef): StoredDoc | undefined {
  const targetType = TYPE_BY_MODE[slot.mode]
  if (slot.parentRole === 'any') {
    return all.find(d => d.type === targetType && !d.parent_role)
  }
  return all.find(d => d.type === targetType && d.parent_role === slot.parentRole)
}

function detectAbandonedBy(formSubmissions: FormSub[] | undefined): string | undefined {
  if (!formSubmissions || formSubmissions.length === 0) return undefined
  const stories = formSubmissions.filter(s => s.form_type === 'client_story')
  if (stories.length === 0) return undefined
  // Si CUALQUIER menor reportó "ambos", priorizamos el flujo dual (es el caso
  // más amplio y permite generar todas las cartas posibles).
  if (stories.some(s => readAbandonedBy(s) === 'both')) return 'both'
  if (stories.some(s => readAbandonedBy(s) === 'father') && stories.some(s => readAbandonedBy(s) === 'mother')) return 'both'
  if (stories.some(s => readAbandonedBy(s) === 'father')) return 'father'
  if (stories.some(s => readAbandonedBy(s) === 'mother')) return 'mother'
  if (stories.some(s => readAbandonedBy(s) === 'none')) return 'none'
  return undefined
}

function readAbandonedBy(sub: FormSub): string | undefined {
  const minorAbuse = (sub.form_data?.minorAbuse ?? null) as Record<string, unknown> | null
  const v = minorAbuse?.abandoned_by
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

export function ParentalConsentGenerator({ caseId, clientName, formSubmissions }: Props) {
  const abandonedBy = useMemo(() => detectAbandonedBy(formSubmissions), [formSubmissions])
  const slots = useMemo(() => computeSlots(abandonedBy), [abandonedBy])

  const [generating, setGenerating] = useState<SlotKey | null>(null)
  const [contents, setContents] = useState<Record<SlotKey, Content>>({} as Record<SlotKey, Content>)
  const [loaded, setLoaded] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<{ content: string; lang: 'en' | 'es'; slot: SlotDef } | null>(null)
  const [editing, setEditing] = useState(false)
  const [editedContent, setEditedContent] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [correcting, setCorrecting] = useState(false)
  const [correctionFeedback, setCorrectionFeedback] = useState('')
  const [applyingCorrection, setApplyingCorrection] = useState(false)
  // Si la jurisdicción del case no está investigada, mostramos un modal que
  // explica qué hacer en vez de dejar que el endpoint se cuelgue intentando
  // auto-investigarla (excede el maxDuration de Vercel y bloquea la UI).
  const [jurisdictionMissing, setJurisdictionMissing] = useState<{
    status: 'missing' | 'pending' | 'failed'
    error: string | null
  } | null>(null)

  // Carga las cartas guardadas. Filtra por (type, parent_role) según los slots
  // computados a partir de la respuesta del cliente.
  useEffect(() => {
    if (loaded) return
    setLoaded(true)
    fetchJsonSafe<{ declarations?: StoredDoc[] }>(`/api/cases/saved-declarations?case_id=${caseId}`)
      .then((data) => {
        const all = data.declarations || []
        const next: Record<SlotKey, Content> = {} as Record<SlotKey, Content>
        for (const slot of slots) {
          const stored = findStoredFor(all, slot)
          if (stored) next[slot.key] = { en: stored.content, es: stored.contentES ?? null }
        }
        setContents(next)
      })
      .catch(() => {})
  }, [caseId, loaded, slots])

  function setContent(key: SlotKey, c: Content) {
    setContents(prev => ({ ...prev, [key]: c }))
  }
  function getContent(key: SlotKey): Content {
    return contents[key] ?? { en: null, es: null }
  }

  // Lee el array completo, reemplaza la entry del slot por `next` y persiste
  // todo de vuelta. Hace round trip al GET para no pisar declaraciones de
  // otros tipos (witness, tutor, etc.) que viven en el mismo registro.
  async function persist(slot: SlotDef, content: Content) {
    if (!content.en) return
    try {
      const data = await fetchJsonSafe<{ declarations?: StoredDoc[] }>(`/api/cases/saved-declarations?case_id=${caseId}`)
      const all = data.declarations || []
      const targetType = TYPE_BY_MODE[slot.mode]
      const filtered = all.filter(d => {
        if (d.type !== targetType) return true
        if (slot.parentRole === 'any') return !!d.parent_role
        return d.parent_role !== slot.parentRole
      })
      const next: StoredDoc = {
        type: targetType,
        index: 0,
        label: slot.title,
        content: content.en,
        ...(content.es ? { contentES: content.es } : {}),
        ...(slot.parentRole !== 'any' ? { parent_role: slot.parentRole } : {}),
      }
      const updated = [...filtered, next]
      await fetchJsonSafe('/api/cases/saved-declarations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId, declarations: updated }),
      })
    } catch {
      toast.error('No se pudo guardar la carta en la base de datos')
    }
  }

  async function generate(slot: SlotDef) {
    setGenerating(slot.key)
    const declarationType = TYPE_BY_MODE[slot.mode]
    const parentRoleParam = slot.parentRole === 'any' ? undefined : slot.parentRole
    try {
      // Pre-check: la generación necesita jurisdicción cacheada. Si no la hay,
      // mostramos modal y abortamos para no colgar al usuario esperando 90s.
      const statusData = await fetchJsonSafe<JurisdictionStatusResp>(
        `/api/cases/${encodeURIComponent(caseId)}/jurisdiction-status`,
        { cache: 'no-store' },
      ).catch(() => null)
      if (statusData && !statusData.ready) {
        setJurisdictionMissing({
          status: statusData.status === 'pending' ? 'pending' : statusData.status === 'failed' ? 'failed' : 'missing',
          error: statusData.research_error,
        })
        setGenerating(null)
        return
      }

      const dataEN = await fetchJsonSafe<ParentalDeclarationResp>('/api/ai/generate-declaration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: caseId,
          type: declarationType,
          index: 0,
          lang: 'en',
          ...(parentRoleParam ? { parent_role: parentRoleParam } : {}),
        }),
      })

      // Spanish = translation of English (cheaper, 1:1 consistency).
      const dataES = await fetchJsonSafe<ParentalDeclarationResp>('/api/ai/generate-declaration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: caseId,
          type: declarationType,
          index: 0,
          lang: 'es',
          english_source: dataEN.declaration,
          ...(parentRoleParam ? { parent_role: parentRoleParam } : {}),
        }),
      })

      const next: Content = { en: dataEN.declaration, es: dataES.declaration }
      setContent(slot.key, next)
      await persist(slot, next)
      toast.success(`Carta generada en inglés y español (${slot.title})`)
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'Error al generar. Intente de nuevo.')
    } finally {
      setGenerating(null)
    }
  }

  async function retranslateToES(englishText: string, slot: SlotDef): Promise<string | null> {
    const declarationType = TYPE_BY_MODE[slot.mode]
    const parentRoleParam = slot.parentRole === 'any' ? undefined : slot.parentRole
    try {
      const data = await fetchJsonSafe<ParentalDeclarationResp>('/api/ai/generate-declaration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: caseId,
          type: declarationType,
          index: 0,
          lang: 'es',
          english_source: englishText,
          ...(parentRoleParam ? { parent_role: parentRoleParam } : {}),
        }),
      })
      return data.declaration
    } catch {
      return null
    }
  }

  async function saveEdit() {
    if (!previewDoc || !editedContent.trim()) return
    setSavingEdit(true)
    try {
      const current = getContent(previewDoc.slot.key)
      let next: Content
      if (previewDoc.lang === 'en') {
        const newES = await retranslateToES(editedContent, previewDoc.slot)
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
      setContent(previewDoc.slot.key, next)
      await persist(previewDoc.slot, next)
      setPreviewDoc({ ...previewDoc, content: editedContent })
      setEditing(false)
      setEditedContent('')
    } catch {
      toast.error('Error al guardar los cambios')
    } finally {
      setSavingEdit(false)
    }
  }

  async function applyCorrection() {
    if (!previewDoc || correctionFeedback.trim().length < 5) return
    setApplyingCorrection(true)
    try {
      const dataC = await fetchJsonSafe<{ corrected: string }>('/api/ai/correct-declaration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_text: previewDoc.content,
          feedback: correctionFeedback.trim(),
          lang: previewDoc.lang,
        }),
      })
      const corrected: string = dataC.corrected

      const current = getContent(previewDoc.slot.key)
      let next: Content
      if (previewDoc.lang === 'en') {
        const newES = await retranslateToES(corrected, previewDoc.slot)
        if (newES === null) {
          toast.error('Corrección aplicada en EN, pero ES no se pudo re-traducir.')
          next = { en: corrected, es: current.es }
        } else {
          next = { en: corrected, es: newES }
        }
      } else {
        next = { en: current.en, es: corrected }
      }
      setContent(previewDoc.slot.key, next)
      await persist(previewDoc.slot, next)
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

  async function downloadPDF(content: string, langLabel: string, slot: SlotDef) {
    if (!content) return
    try {
      const { default: jsPDF } = await import('jspdf')
      const doc = new jsPDF('p', 'mm', 'letter')
      const pw = doc.internal.pageSize.getWidth()
      const ml = 25
      const contentWidth = pw - ml - 25
      let y = 25

      const titleEN = slot.mode === 'collaborative' ? 'VOLUNTARY RELINQUISHMENT OF PARENTAL CUSTODY' : 'PARENTAL CONSENT TO TEMPORARY GUARDIANSHIP'
      const titleES = slot.mode === 'collaborative' ? 'RENUNCIA VOLUNTARIA DE PATRIA POTESTAD Y CUSTODIA' : 'CONSENTIMIENTO PARENTAL PARA TUTELA TEMPORAL'
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

      const modeSuffix = slot.mode === 'collaborative' ? 'Colaborativa' : 'Estandar'
      const roleSuffix = slot.parentRole === 'father' ? 'Padre' : slot.parentRole === 'mother' ? 'Madre' : ''
      const suffixParts = [modeSuffix, roleSuffix].filter(Boolean).join('_')
      doc.save(`Renuncia_${suffixParts}_${langLabel}_${clientName.replace(/\s+/g, '_')}.pdf`)
      toast.success('PDF descargado')
    } catch {
      toast.error('Error al generar PDF')
    }
  }

  const renderCard = (slot: SlotDef) => {
    const content = getContent(slot.key)
    const isGenerating = generating === slot.key
    const hasContent = !!content.en
    const colors = slot.accent === 'rose'
      ? { border: 'border-rose-200', bg: 'bg-rose-50', iconBg: 'bg-rose-100', iconText: 'text-rose-600' }
      : { border: 'border-blue-200', bg: 'bg-blue-50', iconBg: 'bg-blue-100', iconText: 'text-blue-600' }
    const icon = slot.accent === 'rose' ? <Heart className="w-5 h-5" /> : <FileText className="w-5 h-5" />

    return (
      <div key={slot.key} className={`rounded-xl border ${colors.border} ${colors.bg} p-4`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${colors.iconBg} flex items-center justify-center flex-shrink-0`}>
              {hasContent ? <FileText className="w-5 h-5 text-green-500" /> : <div className={colors.iconText}>{icon}</div>}
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{slot.title}</p>
              <p className="text-xs text-gray-500">{slot.subtitle}</p>
            </div>
          </div>

          {isGenerating ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--primary)]">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--admin-gold)]" />
              <span className="text-xs text-[var(--primary-foreground)] font-medium">Generando EN + ES...</span>
            </div>
          ) : hasContent ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-green-600 font-bold">✓</span>
              <Button size="sm" variant="outline" onClick={() => setPreviewDoc({ content: content.en!, lang: 'en', slot })}
                title="Ver EN — desde aquí podés editar o corregir con IA">
                <Eye className="w-3 h-3 mr-1" /> EN
              </Button>
              <Button size="sm" variant="outline" onClick={() => content.es && setPreviewDoc({ content: content.es, lang: 'es', slot })}
                title="Ver ES">
                <Eye className="w-3 h-3 mr-1" /> ES
              </Button>
              <Button size="sm" variant="ghost" onClick={() => downloadPDF(content.en!, 'EN', slot)} title="PDF EN">
                <Download className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => content.es && downloadPDF(content.es, 'ES', slot)} title="PDF ES">
                <Download className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => generate(slot)}>Regenerar</Button>
            </div>
          ) : (
            <Button
              className={slot.accent === 'rose'
                ? 'bg-rose-600 hover:bg-rose-700 text-white font-bold'
                : 'bg-[var(--admin-gold)] hover:opacity-90 text-[var(--primary-foreground)] font-bold'}
              onClick={() => generate(slot)}
              disabled={!!generating}
            >
              Generar
            </Button>
          )}
        </div>
      </div>
    )
  }

  const previewTitle = previewDoc ? `${previewDoc.slot.title} — ${previewDoc.lang === 'en' ? 'English' : 'Español'}` : ''

  return (
    <div className="space-y-3">
      {abandonedBy === 'none' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs text-amber-800">
            El cliente indicó que <strong>ningún padre</strong> lo abandonó. Las cartas siguen disponibles por si necesitas
            generarlas igualmente, pero quizás no apliquen para este caso.
          </p>
        </div>
      )}
      {abandonedBy === undefined && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <p className="text-xs text-gray-600">
            El cliente aún no ha indicado quién lo abandonó. Las cartas se generan en formato genérico
            con los datos del padre/madre ausente registrado.
          </p>
        </div>
      )}

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
                    <Button size="sm" variant="outline" onClick={() => downloadPDF(previewDoc.content, previewDoc.lang.toUpperCase(), previewDoc.slot)}>
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

      {slots.map(renderCard)}

      {jurisdictionMissing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setJurisdictionMissing(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-gray-900">
                  Falta la jurisdicción del caso
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {jurisdictionMissing.status === 'pending' ? (
                    <>La investigación del tribunal está en curso. Vuelve a intentar en 1-2 minutos cuando termine.</>
                  ) : jurisdictionMissing.status === 'failed' ? (
                    <>La investigación previa del tribunal falló. Debes ingresar a la pestaña <strong>&ldquo;Radicación&rdquo;</strong> y dar click en <strong>&ldquo;Re-verificar&rdquo;</strong> para obtener la jurisdicción.</>
                  ) : (
                    <>Para generar esta carta primero necesitamos identificar el tribunal competente. Ingresa a la pestaña <strong>&ldquo;Radicación&rdquo;</strong> de este caso para obtener la jurisdicción.</>
                  )}
                </p>
                {jurisdictionMissing.error && (
                  <p className="text-xs text-amber-700 mt-2 italic">
                    Detalle: {jurisdictionMissing.error}
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button
                variant="outline"
                onClick={() => setJurisdictionMissing(null)}
              >
                Entendido
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
