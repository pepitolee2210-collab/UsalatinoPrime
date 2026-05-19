'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Loader2, Gavel, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AppealLetterGeneratorProps {
  caseId: string
  caseNumber: string
}

interface DraftRow {
  id: string
  version: number
  body_md: string
  model_used: string | null
  prompt_version: string | null
  generated_at: string
  is_current: boolean
  edited_by_diana: boolean
  input_tokens: number | null
  output_tokens: number | null
  cache_read_tokens: number | null
  generation_seconds: number | null
}

/**
 * Panel admin para Diana — botón "Generar Carta de Apelación", listado de
 * versiones y descarga DOCX.
 *
 * El generador puede tardar 30-120s porque Claude procesa 4 PDFs nativos
 * (3 del cliente + template) con thinking adaptive. El botón muestra estado
 * loading con contador de segundos para que Diana sepa que no se colgó.
 */
export function AppealLetterGenerator({ caseId, caseNumber }: AppealLetterGeneratorProps) {
  const [drafts, setDrafts] = useState<DraftRow[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)

  const fetchDrafts = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/cases/${caseId}/appeal-letter-drafts`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Error al cargar versiones')
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

  // Contador de segundos visible mientras Claude piensa
  useEffect(() => {
    if (!generating) return
    setElapsedSec(0)
    const id = window.setInterval(() => setElapsedSec((s) => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [generating])

  async function handleGenerate() {
    setGenerating(true)
    const t0 = Date.now()
    try {
      const res = await fetch('/api/ai/generate-appeal-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId }),
      })
      const j = await res.json()
      if (!res.ok) {
        if (Array.isArray(j.missingCodes) && j.missingCodes.length > 0) {
          throw new Error(
            `Faltan documentos del cliente: ${j.missingCodes.join(', ')}. ` +
              `Pídele que los suba en su portal antes de generar la carta.`,
          )
        }
        throw new Error(j.error || `Error ${res.status}`)
      }
      const dt = Math.round((Date.now() - t0) / 1000)
      toast.success(`Carta de Apelación v${j.version} generada en ${dt}s`)
      await fetchDrafts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error generando')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
        <div className="flex items-start gap-3">
          <Gavel className="w-5 h-5 text-rose-700 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-rose-900">Carta de Apelación (IA)</h3>
            <p className="text-xs text-rose-700 mt-1">
              Envía a Claude los 3 documentos del cliente (Pasaporte, Asilo Completo,
              Denegación del Juez) más el template de caso ganador. La IA refuta los
              argumentos del juez con análisis legal, precedentes BIA, CAT y
              doctrina del tercer país. Tarda 30–120s.
            </p>
            {generating && (
              <p className="text-[11px] text-rose-800 mt-2 font-semibold">
                Analizando expediente, identificando errores legales, redactando… ({elapsedSec}s)
              </p>
            )}
          </div>
          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-rose-700 hover:bg-rose-800 text-white"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Gavel className="w-4 h-4 mr-1.5" />
            )}
            {generating ? 'Generando…' : drafts.length === 0 ? 'Generar Carta' : 'Generar nueva versión'}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-gray-900">Historial de versiones</h3>
        {loading ? (
          <p className="text-xs text-gray-400 text-center py-4">Cargando…</p>
        ) : drafts.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6 rounded-xl border border-dashed border-gray-200">
            Aún no se ha generado ninguna Carta de Apelación. Pulsa "Generar Carta".
          </p>
        ) : (
          <ul className="space-y-2">
            {drafts.map((d) => (
              <li key={d.id} className="rounded-xl border border-gray-200 bg-white">
                <div className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                  <button
                    type="button"
                    onClick={() => setOpenId(openId === d.id ? null : d.id)}
                    className="flex items-center gap-3 flex-1 text-left"
                  >
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        d.is_current ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {d.is_current ? 'ACTUAL' : 'Histórico'}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">Versión {d.version}</span>
                    <span className="text-[11px] text-gray-500">
                      {new Date(d.generated_at).toLocaleString('es-MX')}
                    </span>
                    <span className="ml-auto text-[10px] text-gray-400 uppercase font-bold">
                      {d.generation_seconds != null
                        ? `${Math.round(d.generation_seconds)}s · `
                        : ''}
                      {d.input_tokens != null && d.output_tokens != null
                        ? `${d.input_tokens.toLocaleString()}/${d.output_tokens.toLocaleString()} tok`
                        : ''}
                    </span>
                  </button>
                  <a
                    href={`/api/admin/cases/${caseId}/appeal-letter-drafts/${d.id}/download.docx`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button size="sm" variant="outline" className="text-xs">
                      <Download className="w-3 h-3 mr-1" /> Word
                    </Button>
                  </a>
                </div>
                {openId === d.id && (
                  <div className="px-4 py-3 border-t border-gray-100 space-y-3">
                    <div className="bg-gray-50 rounded-lg p-3 max-h-[70vh] overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-gray-800 font-mono">
                      {d.body_md}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-gray-500">
                      <span>Modelo: <strong>{d.model_used ?? '—'}</strong></span>
                      <span>·</span>
                      <span>Prompt: <strong>{d.prompt_version ?? '—'}</strong></span>
                      {d.cache_read_tokens != null && d.cache_read_tokens > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-emerald-700">
                            Cache hit: <strong>{d.cache_read_tokens.toLocaleString()}</strong> tokens
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-gray-500">
          Caso: <strong>{caseNumber}</strong>. La carta se descarga como .docx editable —
          ábrela en Word, ajusta lo que necesites y preséntala ante la BIA.
        </p>
      </div>
    </div>
  )
}
