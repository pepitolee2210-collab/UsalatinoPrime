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
  sources: Array<{ url: string; title: string; snippet: string }>
  model_used: string | null
  prompt_version: string | null
  generated_at: string
  is_current: boolean
  edited_by_diana: boolean
}

/**
 * Panel admin para Diana — botón "Generar Miedo Creíble", listado de
 * versiones y descarga del expediente final del caso.
 *
 * El generador puede tardar 5-15s; el botón muestra estado loading.
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

  async function handleGenerate() {
    setGenerating(true)
    const t0 = Date.now()
    try {
      const res = await fetch('/api/ai/generate-credible-fear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Error generando')
      const dt = Math.round((Date.now() - t0) / 1000)
      toast.success(`Miedo Creíble v${j.version} generado en ${dt}s`)
      await fetchDrafts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally {
      setGenerating(false)
    }
  }

  function expedienteUrl(format: 'zip' | 'pdf' | 'i589') {
    return `/api/admin/cases/${caseId}/asilo-politico/expediente?format=${format}`
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-purple-200 bg-purple-50 p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-purple-700 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-purple-900">Miedo Creíble (IA)</h3>
            <p className="text-xs text-purple-700 mt-1">
              Combina la declaración jurada del cliente, las URLs de evidencia y
              búsqueda automática de country conditions vía Tavily para redactar
              el relato formal listo para USCIS.
            </p>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={generating}
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
          ZIP: I-589 + Miedo Creíble + documentos del cliente + evidencias.md ·
          PDF unificado: I-589 mergeado de 14 páginas + Miedo Creíble + anexos ·
          Solo I-589: las 14 páginas en un PDF.
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-gray-900">Historial de generaciones</h3>
        {loading ? (
          <p className="text-xs text-gray-400 text-center py-4">Cargando…</p>
        ) : drafts.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6 rounded-xl border border-dashed border-gray-200">
            Aún no se ha generado ningún Miedo Creíble. Pulsa “Generar nuevo”.
          </p>
        ) : (
          <ul className="space-y-2">
            {drafts.map((d) => (
              <li key={d.id} className="rounded-xl border border-gray-200 bg-white">
                <button
                  type="button"
                  onClick={() => setOpenId(openId === d.id ? null : d.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                >
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${d.is_current ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'}`}>
                    {d.is_current ? 'ACTUAL' : 'Histórico'}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">Versión {d.version}</span>
                  <span className="text-[11px] text-gray-500">
                    {new Date(d.generated_at).toLocaleString('es-MX')}
                  </span>
                  <span className="ml-auto text-[10px] text-gray-400 uppercase font-bold">
                    {d.sources.length} fuente{d.sources.length === 1 ? '' : 's'}
                  </span>
                </button>
                {openId === d.id && (
                  <div className="px-4 py-3 border-t border-gray-100 space-y-3">
                    <div className="bg-gray-50 rounded-lg p-3 max-h-[70vh] overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-gray-800">
                      {d.body_md}
                    </div>
                    {d.sources.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase text-gray-500 mb-1">Fuentes</p>
                        <ul className="space-y-1 text-[11px]">
                          {d.sources.map((s, i) => (
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
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
