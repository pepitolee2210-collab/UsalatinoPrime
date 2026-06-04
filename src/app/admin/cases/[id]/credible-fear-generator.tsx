'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Loader2, Sparkles, ExternalLink, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CredibleFearGeneratorProps {
  caseId: string
  caseNumber: string
}

interface DraftRow {
  id: string
  version: number
  body_md: string
  sources: Array<{ url: string; title: string; snippet?: string }> | null
  model_used: string | null
  prompt_version: string | null
  generated_at: string
  is_current: boolean
  edited_by_diana: boolean
  status: string | null
  generation_error: string | null
  declaration_total_words: number | null
}

const IN_PROGRESS = new Set(['RESEARCHING', 'DRAFTING'])

function statusBadge(status: string | null, isCurrent: boolean): { label: string; cls: string } {
  switch (status) {
    case 'RESEARCHING':
      return { label: 'Investigando…', cls: 'bg-amber-100 text-amber-800' }
    case 'DRAFTING':
      return { label: 'Redactando…', cls: 'bg-amber-100 text-amber-800' }
    case 'GAPS_FOUND':
      return { label: 'Faltan datos', cls: 'bg-orange-100 text-orange-800' }
    case 'REQUIRES_REVIEW':
      return { label: 'Revisión legal', cls: 'bg-yellow-100 text-yellow-800' }
    case 'FAILED':
      return { label: 'Falló', cls: 'bg-red-100 text-red-800' }
    default:
      return isCurrent
        ? { label: 'ACTUAL', cls: 'bg-emerald-100 text-emerald-800' }
        : { label: 'Histórico', cls: 'bg-gray-100 text-gray-500' }
  }
}

/**
 * Panel admin/paralegal — genera el Memorándum Legal de Asilo (Miedo Creíble
 * v7, ~20 págs) como job ASÍNCRONO y poolea el progreso por fase
 * (RESEARCHING → DRAFTING → DRAFT_COMPLETE).
 */
export function CredibleFearGenerator({ caseId, caseNumber }: CredibleFearGeneratorProps) {
  const [drafts, setDrafts] = useState<DraftRow[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const fetchDrafts = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/cases/${caseId}/credible-fear-drafts`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Error al cargar drafts')
      const j = await res.json()
      setDrafts(j.drafts ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [caseId])

  useEffect(() => {
    fetchDrafts()
  }, [fetchDrafts])

  // Si al cargar la página el draft más reciente sigue en progreso (worker
  // corriendo de una sesión previa), reanudar el polling automáticamente.
  useEffect(() => {
    if (!loading && !generating && IN_PROGRESS.has(drafts[0]?.status ?? '')) {
      setGenerating(true)
    }
  }, [loading, generating, drafts])

  // Polling mientras hay generación en progreso.
  useEffect(() => {
    if (!generating) return
    const iv = setInterval(() => { fetchDrafts() }, 4000)
    return () => clearInterval(iv)
  }, [generating, fetchDrafts])

  // Detección de estado terminal para detener el polling y avisar.
  useEffect(() => {
    if (!generating) return
    const latest = drafts[0]
    if (!latest || !latest.status || IN_PROGRESS.has(latest.status)) return
    setGenerating(false)
    if (latest.status === 'DRAFT_COMPLETE') {
      toast.success(`Memorándum v${latest.version} listo${latest.declaration_total_words ? ` (${latest.declaration_total_words} palabras)` : ''}`)
    } else if (latest.status === 'GAPS_FOUND') {
      toast.message('Faltan datos del cliente — revisa el draft para ver qué pedirle')
    } else if (latest.status === 'REQUIRES_REVIEW') {
      toast.message('Generado, pero requiere revisión legal')
    } else if (latest.status === 'FAILED') {
      toast.error(`Falló la generación: ${latest.generation_error ?? 'error desconocido'}`)
    }
  }, [drafts, generating])

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await fetch('/api/ai/generate-credible-fear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Error generando')
      toast.message('Generación iniciada — el memorándum tarda varios minutos. Puedes cerrar esta pestaña.')
      await fetchDrafts()
    } catch (err) {
      setGenerating(false)
      toast.error(err instanceof Error ? err.message : 'Error')
    }
  }

  function expedienteUrl(format: 'zip' | 'pdf' | 'i589') {
    return `/api/admin/cases/${caseId}/asilo-politico/expediente?format=${format}`
  }

  const latest = drafts[0]
  const progressLabel = generating
    ? latest?.status === 'DRAFTING'
      ? 'Redactando el memorándum legal y la tabla cronológica…'
      : 'Investigando jurisprudencia federal y condiciones de país…'
    : null

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-purple-200 bg-purple-50 p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-purple-700 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-purple-900">Memorándum Legal de Asilo (IA)</h3>
            <p className="text-xs text-purple-700 mt-1">
              Genera un memorándum legal robusto (~20 págs): argumentación jurídica,
              jurisprudencia federal real verificada, anexo de noticias con carátula
              y links comprobados, y tabla cronológica. Corre en segundo plano.
            </p>
            {progressLabel && (
              <p className="text-xs text-purple-900 font-semibold mt-2 inline-flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> {progressLabel}
              </p>
            )}
          </div>
          <Button
            onClick={handleGenerate}
            disabled={generating || IN_PROGRESS.has(drafts[0]?.status ?? '')}
            className="bg-purple-700 hover:bg-purple-800 text-white"
          >
            {generating ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
            {generating ? 'Generando…' : 'Generar nuevo'}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-sm font-bold text-gray-900">Expediente final — {caseNumber}</h3>
          <div className="flex flex-wrap gap-2">
            <a href={expedienteUrl('zip')} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <Download className="w-3 h-3 mr-1" /> ZIP completo
              </Button>
            </a>
            <a href={expedienteUrl('pdf')} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <Download className="w-3 h-3 mr-1" /> PDF unificado
              </Button>
            </a>
            <a href={expedienteUrl('i589')} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <Download className="w-3 h-3 mr-1" /> Solo I-589
              </Button>
            </a>
          </div>
        </div>
        <p className="text-[11px] text-gray-500">
          ZIP: I-589 + Memorándum Legal + documentos del cliente + evidencias.md ·
          PDF unificado: I-589 mergeado de 14 páginas + Memorándum + anexos ·
          Solo I-589: las 14 páginas en un PDF.
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-gray-900">Historial de generaciones</h3>
        {loading ? (
          <p className="text-xs text-gray-400 text-center py-4">Cargando…</p>
        ) : drafts.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6 rounded-xl border border-dashed border-gray-200">
            Aún no se ha generado ningún memorándum. Pulsa “Generar nuevo”.
          </p>
        ) : (
          <ul className="space-y-2">
            {drafts.map((d) => {
              const badge = statusBadge(d.status, d.is_current)
              const inProgress = IN_PROGRESS.has(d.status ?? '')
              const sources = d.sources ?? []
              return (
                <li key={d.id} className="rounded-xl border border-gray-200 bg-white">
                  <div className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                    <button
                      type="button"
                      onClick={() => setOpenId(openId === d.id ? null : d.id)}
                      className="flex items-center gap-3 flex-1 text-left min-w-0"
                    >
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${badge.cls}`}>
                        {inProgress && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                        {badge.label}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">Versión {d.version}</span>
                      <span className="text-[11px] text-gray-500">
                        {new Date(d.generated_at).toLocaleString('es-MX')}
                      </span>
                      <span className="ml-auto text-[10px] text-gray-400 uppercase font-bold whitespace-nowrap">
                        {d.declaration_total_words ? `${d.declaration_total_words} pal.` : `${sources.length} fuente${sources.length === 1 ? '' : 's'}`}
                      </span>
                    </button>
                    <a
                      href={`/api/admin/cases/${caseId}/credible-fear-drafts/${d.id}/download.docx`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => { if (inProgress) e.preventDefault(); e.stopPropagation() }}
                      aria-disabled={inProgress}
                    >
                      <Button size="sm" variant="outline" className="text-xs" disabled={inProgress}>
                        <Download className="w-3 h-3 mr-1" /> Word
                      </Button>
                    </a>
                  </div>
                  {openId === d.id && (
                    <div className="px-4 py-3 border-t border-gray-100 space-y-3">
                      {d.status === 'FAILED' && d.generation_error && (
                        <p className="text-[11px] text-red-700 bg-red-50 rounded p-2">Error: {d.generation_error}</p>
                      )}
                      <div className="bg-gray-50 rounded-lg p-3 max-h-[70vh] overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-gray-800">
                        {d.body_md}
                      </div>
                      {sources.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase text-gray-500 mb-1">Fuentes</p>
                          <ul className="space-y-1 text-[11px]">
                            {sources.map((s, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-gray-700">
                                <span className="text-gray-400">[{i + 1}]</span>
                                <a
                                  href={s.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-700 hover:underline truncate flex items-center gap-1"
                                >
                                  {s.title || s.url}
                                  <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
