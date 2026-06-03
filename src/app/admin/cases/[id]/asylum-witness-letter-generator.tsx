'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Sparkles, Download, AlertTriangle, Pencil, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { WitnessLetterValue } from '@/lib/legal/asilo-testigos-form-schema'

interface AsylumWitnessLetterGeneratorProps {
  caseId: string
  caseNumber: string
  clientName: string
}

interface WitnessLetter {
  witness_index: number
  witness_name: string
  content: string
  contentES?: string
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  familiar: 'Familiar',
  pareja: 'Cónyuge o pareja',
  vecino: 'Vecino',
  amigo: 'Amigo cercano',
  colega: 'Colega',
  lider_religioso: 'Líder religioso',
  activismo: 'Activismo / partido / sindicato',
  profesional: 'Profesional',
  otro: 'Otro',
}

export function AsylumWitnessLetterGenerator({ caseId, caseNumber, clientName }: AsylumWitnessLetterGeneratorProps) {
  const [witnesses, setWitnesses] = useState<WitnessLetterValue[]>([])
  const [letters, setLetters] = useState<WitnessLetter[]>([])
  const [loading, setLoading] = useState(true)
  const [generatingIdx, setGeneratingIdx] = useState<number | null>(null)
  const [preview, setPreview] = useState<{ idx: number; lang: 'en' | 'es' } | null>(null)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/cases/asylum-witness-letters?case_id=${caseId}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Error al cargar testigos')
      const j = await res.json()
      setWitnesses(j.witnesses ?? [])
      setLetters(j.letters ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [caseId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const persist = useCallback(
    async (next: WitnessLetter[]) => {
      try {
        await fetch('/api/cases/asylum-witness-letters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ case_id: caseId, letters: next }),
        })
      } catch {
        toast.error('No se pudo guardar la carta')
      }
    },
    [caseId],
  )

  const generate = useCallback(
    async (idx: number) => {
      setGeneratingIdx(idx)
      const t0 = Date.now()
      try {
        // 1. Inglés (principal)
        const enRes = await fetch('/api/ai/generate-asylum-witness-letter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ case_id: caseId, witness_index: idx, lang: 'en' }),
        })
        const enJson = await enRes.json()
        if (!enRes.ok) throw new Error(enJson.error || 'Error generando')

        // 2. Español como traducción del inglés (más barato y 1:1)
        let contentES: string | undefined
        try {
          const esRes = await fetch('/api/ai/generate-asylum-witness-letter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ case_id: caseId, witness_index: idx, lang: 'es', english_source: enJson.letter }),
          })
          const esJson = await esRes.json()
          if (esRes.ok) contentES = esJson.letter
        } catch {
          // La traducción es opcional; si falla, conservamos el inglés.
        }

        const newLetter: WitnessLetter = {
          witness_index: idx,
          witness_name: enJson.witness_name || witnesses[idx]?.full_name || `Testigo ${idx + 1}`,
          content: enJson.letter,
          contentES,
        }
        const next = [...letters.filter((l) => l.witness_index !== idx), newLetter].sort(
          (a, b) => a.witness_index - b.witness_index,
        )
        setLetters(next)
        persist(next)
        const dt = Math.round((Date.now() - t0) / 1000)
        const warn = enJson.warnings?.missingCount
          ? ` · ${enJson.warnings.missingCount} dato(s) por completar`
          : ''
        toast.success(`Carta generada en ${dt}s${warn}`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error')
      } finally {
        setGeneratingIdx(null)
      }
    },
    [caseId, letters, persist, witnesses],
  )

  const letterFor = (idx: number) => letters.find((l) => l.witness_index === idx)

  async function downloadAsPDF(letter: WitnessLetter, lang: 'en' | 'es') {
    const text = lang === 'es' ? letter.contentES ?? letter.content : letter.content
    const { default: jsPDF } = await import('jspdf')
    const pdf = new jsPDF('p', 'mm', 'letter')
    const margin = 20
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const contentWidth = pageWidth - margin * 2
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(11)
    let y = margin
    for (const rawLine of text.split('\n')) {
      const wrapped = pdf.splitTextToSize(rawLine === '' ? ' ' : rawLine, contentWidth)
      for (const line of wrapped) {
        if (y > pageHeight - margin) {
          pdf.addPage()
          y = margin
        }
        pdf.text(line, margin, y)
        y += 6
      }
    }
    const safeName = (letter.witness_name || `testigo_${letter.witness_index + 1}`).replace(/\s+/g, '_')
    pdf.save(`Witness_Affidavit_${safeName}_${lang.toUpperCase()}.pdf`)
  }

  function openPreview(idx: number, lang: 'en' | 'es') {
    setPreview({ idx, lang })
    setEditing(false)
  }

  function startEdit(letter: WitnessLetter, lang: 'en' | 'es') {
    setEditText(lang === 'es' ? letter.contentES ?? '' : letter.content)
    setEditing(true)
  }

  async function saveEdit() {
    if (!preview) return
    const letter = letterFor(preview.idx)
    if (!letter) return
    const updated: WitnessLetter =
      preview.lang === 'es'
        ? { ...letter, contentES: editText }
        : { ...letter, content: editText }
    const next = letters.map((l) => (l.witness_index === preview.idx ? updated : l))
    setLetters(next)
    await persist(next)
    setEditing(false)
    toast.success('Cambios guardados')
  }

  if (loading) {
    return <p className="text-xs text-gray-400 text-center py-6">Cargando testigos…</p>
  }

  const previewLetter = preview ? letterFor(preview.idx) : null
  const previewText = previewLetter
    ? (preview!.lang === 'es' ? previewLetter.contentES ?? '(Sin versión en español)' : previewLetter.content)
    : ''

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-indigo-700 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-indigo-900">Cartas de Testigos (IA) — {caseNumber}</h3>
            <p className="text-xs text-indigo-700 mt-1">
              Genera la declaración jurada en inglés de cada testigo que {clientName} agregó en su portal,
              a partir de lo que presenció. Lista para descargar en PDF, firmar y notarizar.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2 mt-3 pt-3 border-t border-indigo-200">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-amber-800">
            Revisa y personaliza cada carta antes de firmar: USCIS desconfía de declaraciones con voz idéntica.
            Idealmente cada testigo la firma (y notariza) en persona.
          </p>
        </div>
      </div>

      {witnesses.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-6 rounded-xl border border-dashed border-gray-200">
          El cliente aún no ha agregado testigos en su portal (formulario “Cartas de Testigos”).
        </p>
      ) : (
        <ul className="space-y-2">
          {witnesses.map((w, idx) => {
            const letter = letterFor(idx)
            const isGenerating = generatingIdx === idx
            return (
              <li key={idx} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {w.full_name?.trim() || `Testigo ${idx + 1}`}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {[RELATIONSHIP_LABELS[w.relationship ?? ''] ?? w.relationship, w.nationality]
                        .filter(Boolean)
                        .join(' · ') || 'Sin relación indicada'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {letter ? (
                      <>
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => openPreview(idx, 'en')}>
                          Ver EN
                        </Button>
                        {letter.contentES && (
                          <Button size="sm" variant="outline" className="text-xs" onClick={() => openPreview(idx, 'es')}>
                            Ver ES
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => downloadAsPDF(letter, 'en')}>
                          <Download className="w-3 h-3 mr-1" /> PDF
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          disabled={isGenerating}
                          onClick={() => generate(idx)}
                        >
                          {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        className="bg-indigo-700 hover:bg-indigo-800 text-white text-xs"
                        disabled={isGenerating}
                        onClick={() => generate(idx)}
                      >
                        {isGenerating ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
                        {isGenerating ? 'Generando…' : 'Generar carta'}
                      </Button>
                    )}
                  </div>
                </div>
                {!letter && (w.witnessed_events ?? '').trim() && (
                  <p className="text-[11px] text-gray-400 mt-2 line-clamp-2">
                    Presenció: {w.witnessed_events}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Preview / editor */}
      {preview && previewLetter && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b">
              <h3 className="text-sm font-bold text-gray-900">
                {previewLetter.witness_name} — {preview.lang === 'es' ? 'Español' : 'Inglés'}
              </h3>
              <div className="flex items-center gap-2">
                {!editing && (
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => startEdit(previewLetter, preview.lang)}>
                    <Pencil className="w-3 h-3 mr-1" /> Editar
                  </Button>
                )}
                <Button size="sm" variant="outline" className="text-xs" onClick={() => downloadAsPDF(previewLetter, preview.lang)}>
                  <Download className="w-3 h-3 mr-1" /> PDF
                </Button>
                <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {editing ? (
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={20}
                  className="w-full text-xs font-mono border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              ) : (
                <pre className="whitespace-pre-wrap text-xs text-gray-800 leading-relaxed font-sans">{previewText}</pre>
              )}
            </div>
            {editing && (
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t">
                <Button size="sm" variant="outline" className="text-xs" onClick={() => setEditing(false)}>Cancelar</Button>
                <Button size="sm" className="bg-indigo-700 hover:bg-indigo-800 text-white text-xs" onClick={saveEdit}>Guardar cambios</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
