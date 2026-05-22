'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { Loader2, Receipt, Download, AlertCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Eoir26aLetterGeneratorProps {
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
  status: 'pending' | 'generating' | 'ready' | 'failed'
  error_message: string | null
  job_started_at: string | null
  job_finished_at: string | null
}

/**
 * Panel admin para Diana — botón "Generar Carta de Exoneración", listado de
 * versiones con descarga DOCX, polling automático cuando hay drafts en
 * status pending/generating.
 *
 * Mismo patrón async que AppealLetterGenerator: POST encola en QStash y
 * devuelve inmediato un `draft_id` con status `pending`. El worker procesa
 * sin el límite de 120s de Vercel y actualiza a `ready`. La UI poll cada 5s.
 */
export function Eoir26aLetterGenerator({ caseId, caseNumber }: Eoir26aLetterGeneratorProps) {
  const [drafts, setDrafts] = useState<DraftRow[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const pollingRef = useRef<number | null>(null)

  const fetchDrafts = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/cases/${caseId}/eoir26a-letter-drafts`, { cache: 'no-store' })
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

  const hasInFlight = drafts.some((d) => d.status === 'pending' || d.status === 'generating')
  useEffect(() => {
    if (!hasInFlight) {
      if (pollingRef.current != null) {
        window.clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      return
    }
    if (pollingRef.current != null) return
    pollingRef.current = window.setInterval(() => {
      fetchDrafts()
    }, 5000)
    return () => {
      if (pollingRef.current != null) {
        window.clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [hasInFlight, fetchDrafts])

  async function handleGenerate() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/ai/generate-eoir26a-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId }),
      })
      const j = await res.json()
      if (!res.ok && res.status !== 202) {
        throw new Error(j.error || `Error ${res.status}`)
      }
      toast.info(j.message || `Generación iniciada (v${j.version})`)
      await fetchDrafts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error encolando')
    } finally {
      setSubmitting(false)
    }
  }

  const inFlightDraft = drafts.find((d) => d.status === 'pending' || d.status === 'generating')

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex items-start gap-3">
          <Receipt className="w-5 h-5 text-emerald-700 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-emerald-900">Carta de Exoneración (IA)</h3>
            <p className="text-xs text-emerald-700 mt-1">
              Envía a Claude el pasaporte del cliente, la evidencia financiera
              cargada (talones, beneficios, estados de cuenta, recibos) y los
              valores del EOIR-26A llenado (si existe). La IA redacta una
              declaración corta de incapacidad de pago bajo perjury para
              acompañar al Form EOIR-26A. Genera en segundo plano (30-60s).
            </p>
            {inFlightDraft && (
              <p className="text-[11px] text-emerald-800 mt-2 font-semibold flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                {inFlightDraft.status === 'pending' ? 'Esperando worker…' : 'Claude está redactando…'}
                {inFlightDraft.job_started_at && (
                  <span className="text-emerald-600">
                    {' · '}
                    {Math.round(
                      (Date.now() - new Date(inFlightDraft.job_started_at).getTime()) / 1000,
                    )}
                    s
                  </span>
                )}
              </p>
            )}
          </div>
          <Button
            onClick={handleGenerate}
            disabled={submitting || hasInFlight}
            className="bg-emerald-700 hover:bg-emerald-800 text-white"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Receipt className="w-4 h-4 mr-1.5" />
            )}
            {hasInFlight
              ? 'Generando…'
              : drafts.length === 0
                ? 'Generar Carta'
                : 'Generar nueva versión'}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-gray-900">Historial de versiones</h3>
        {loading ? (
          <p className="text-xs text-gray-400 text-center py-4">Cargando…</p>
        ) : drafts.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6 rounded-xl border border-dashed border-gray-200">
            Aún no se ha generado ninguna Carta de Exoneración. Pulsa &quot;Generar Carta&quot;.
          </p>
        ) : (
          <ul className="space-y-2">
            {drafts.map((d) => {
              const isReady = d.status === 'ready'
              const isFailed = d.status === 'failed'
              const isInFlight = d.status === 'pending' || d.status === 'generating'
              const StateIcon = isReady
                ? null
                : isFailed
                  ? AlertCircle
                  : Clock
              const stateClass = isReady
                ? d.is_current
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-gray-100 text-gray-500'
                : isFailed
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-amber-100 text-amber-800'
              const stateLabel = isReady
                ? d.is_current
                  ? 'ACTUAL'
                  : 'Histórico'
                : isFailed
                  ? 'FALLÓ'
                  : d.status === 'pending'
                    ? 'EN COLA'
                    : 'GENERANDO'
              return (
                <li key={d.id} className="rounded-xl border border-gray-200 bg-white">
                  <div className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                    <button
                      type="button"
                      onClick={() => setOpenId(openId === d.id ? null : d.id)}
                      className="flex items-center gap-3 flex-1 text-left"
                      disabled={!isReady && !isFailed}
                    >
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${stateClass}`}>
                        {StateIcon && <StateIcon className="w-3 h-3" />}
                        {stateLabel}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">Versión {d.version}</span>
                      <span className="text-[11px] text-gray-500">
                        {new Date(d.generated_at).toLocaleString('es-MX')}
                      </span>
                      {isReady && (
                        <span className="ml-auto text-[10px] text-gray-400 uppercase font-bold">
                          {d.generation_seconds != null
                            ? `${Math.round(d.generation_seconds)}s · `
                            : ''}
                          {d.input_tokens != null && d.output_tokens != null
                            ? `${d.input_tokens.toLocaleString()}/${d.output_tokens.toLocaleString()} tok`
                            : ''}
                        </span>
                      )}
                      {isInFlight && (
                        <span className="ml-auto text-[10px] text-amber-700 uppercase font-bold flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          {d.status === 'generating' && d.job_started_at
                            ? `${Math.round((Date.now() - new Date(d.job_started_at).getTime()) / 1000)}s`
                            : 'esperando…'}
                        </span>
                      )}
                    </button>
                    {isReady && (
                      <a
                        href={`/api/admin/cases/${caseId}/eoir26a-letter-drafts/${d.id}/download.docx`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button size="sm" variant="outline" className="text-xs">
                          <Download className="w-3 h-3 mr-1" /> Word
                        </Button>
                      </a>
                    )}
                  </div>
                  {openId === d.id && isReady && (
                    <div className="px-4 py-3 border-t border-gray-100 space-y-3">
                      <div className="bg-gray-50 rounded-lg p-3 max-h-[70vh] overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-gray-800 font-mono">
                        {d.body_md}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-gray-500 flex-wrap">
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
                  {openId === d.id && isFailed && d.error_message && (
                    <div className="px-4 py-3 border-t border-gray-100">
                      <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-900">
                        <p className="font-semibold mb-1">Error:</p>
                        <p>{d.error_message}</p>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <p className="text-[11px] text-gray-500">
          Caso: <strong>{caseNumber}</strong>. La carta se descarga como .docx editable —
          ábrela en Word, ajusta lo que necesites y preséntala junto al Form EOIR-26A ante la BIA.
        </p>
      </div>
    </div>
  )
}
