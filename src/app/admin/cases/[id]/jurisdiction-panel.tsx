'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  Scale, Loader2, AlertCircle, AlertTriangle, CheckCircle, ChevronDown, ChevronUp,
  ExternalLink, RotateCw, MapPin,
} from 'lucide-react'

interface CachedJurisdiction {
  case_id: string
  state_code: string
  state_name: string
  client_zip: string | null
  court_name: string
  court_name_es: string | null
  court_address: string | null
  filing_procedure: string | null
  filing_procedure_es: string | null
  age_limit_sijs: number | null
  sources: string[]
  confidence: 'high' | 'medium' | 'low'
  notes: string | null
  verified_at: string
}

interface ClientLocation {
  stateCode: string
  stateName: string
  city: string | null
  zip: string | null
  street: string | null
  source: 'contract' | 'profile' | 'tutor_form' | 'zip_derived' | 'missing'
  confidence: 'high' | 'medium' | 'low' | 'missing'
}

interface JurisdictionResponse {
  jurisdiction: CachedJurisdiction | null
  clientLocation: ClientLocation | null
  cached?: boolean
  reason?: string
  error?: string
}

interface Props {
  caseId: string
}

const SOURCE_LABELS: Record<string, string> = {
  contract: 'Contrato firmado',
  profile: 'Perfil del cliente',
  tutor_form: 'Formulario del tutor',
  zip_derived: 'Derivado del ZIP',
  missing: 'Sin datos',
}

function ConfidenceBadge({ confidence }: { confidence: CachedJurisdiction['confidence'] }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    high: { bg: 'bg-green-100', text: 'text-green-800', label: 'Alta confianza' },
    medium: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Confianza media' },
    low: { bg: 'bg-red-100', text: 'text-red-800', label: 'Baja confianza — verifica' },
  }
  const c = map[confidence] || map.medium
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}

export function JurisdictionPanel({ caseId }: Props) {
  const [loading, setLoading] = useState(true)
  const [researching, setResearching] = useState(false)
  const [data, setData] = useState<JurisdictionResponse | null>(null)
  const [open, setOpen] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/case-jurisdiction?caseId=${encodeURIComponent(caseId)}`)
      const json = (await res.json()) as JurisdictionResponse
      setData(json)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cargar jurisdicción')
      setData({ jurisdiction: null, clientLocation: null, error: 'load_failed' })
    } finally {
      setLoading(false)
    }
  }, [caseId])

  useEffect(() => { void load() }, [load])

  async function reverify() {
    setResearching(true)
    try {
      const res = await fetch('/api/admin/case-jurisdiction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, force: true }),
      })
      const json = (await res.json()) as JurisdictionResponse
      if (!res.ok && !json.jurisdiction) {
        throw new Error(json.error || 'No se pudo re-verificar')
      }
      setData(json)
      toast.success(json.jurisdiction ? 'Jurisdicción re-verificada' : 'Sin ubicación detectada')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al re-verificar')
    } finally {
      setResearching(false)
    }
  }

  // Color del borde según estado
  const borderColor = (() => {
    if (loading || researching) return 'border-blue-200 bg-blue-50/40'
    if (!data) return 'border-gray-200 bg-gray-50'
    if (data.error && !data.jurisdiction) return 'border-red-200 bg-red-50/40'
    if (!data.clientLocation) return 'border-red-200 bg-red-50/40'
    if (!data.jurisdiction) return 'border-amber-200 bg-amber-50/40'
    if (data.jurisdiction.confidence === 'high') return 'border-green-200 bg-green-50/40'
    if (data.jurisdiction.confidence === 'low') return 'border-red-200 bg-red-50/40'
    return 'border-amber-200 bg-amber-50/40'
  })()

  const headerIcon = (() => {
    if (loading || researching) return <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
    if (!data?.clientLocation) return <AlertCircle className="w-4 h-4 text-red-600" />
    if (!data.jurisdiction) return <AlertTriangle className="w-4 h-4 text-amber-600" />
    if (data.jurisdiction.confidence === 'high') return <CheckCircle className="w-4 h-4 text-green-600" />
    return <AlertTriangle className="w-4 h-4 text-amber-600" />
  })()

  const headerBadgeText = (() => {
    if (loading) return 'Cargando…'
    if (researching) return 'Investigando con fuentes oficiales…'
    if (!data) return ''
    if (!data.clientLocation) return 'Sin estado detectado'
    if (!data.jurisdiction) return `${data.clientLocation.stateName} — sin corte aún`
    return `${data.jurisdiction.court_name}`
  })()

  return (
    <div className={`rounded-xl border overflow-hidden ${borderColor}`}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-black/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Scale className="w-4 h-4 text-[#002855] flex-shrink-0" />
          {headerIcon}
          <span className="text-sm font-bold text-gray-900">Jurisdicción detectada</span>
          <span className="text-[11px] text-gray-600 truncate">— {headerBadgeText}</span>
          {data?.jurisdiction && (
            <ConfidenceBadge confidence={data.jurisdiction.confidence} />
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {loading && (
            <div className="text-xs text-gray-600 flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              Resolviendo ubicación del cliente y consultando fuentes oficiales…
            </div>
          )}

          {!loading && data && !data.clientLocation && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="font-medium mb-1">No se pudo detectar el estado del cliente.</p>
              <p className="text-[11px] text-red-600">
                No hay dirección en el contrato, en el perfil ni en el formulario del tutor.
                Los documentos saldrán con <code className="bg-red-100 px-1 rounded">[FALTA: Nombre del tribunal]</code> —
                completa el estado manualmente en <strong>Datos Suplementarios</strong> o en el contrato del cliente.
              </p>
            </div>
          )}

          {!loading && data?.clientLocation && (
            <>
              {/* Info de ubicación detectada */}
              <div className="rounded-lg bg-white/70 border border-gray-200 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="w-3.5 h-3.5 text-gray-500" />
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-600">
                    Ubicación del cliente
                  </p>
                </div>
                <p className="text-sm text-gray-900">
                  <strong>{data.clientLocation.stateName}</strong> ({data.clientLocation.stateCode})
                  {data.clientLocation.city && <> — {data.clientLocation.city}</>}
                  {data.clientLocation.zip && <> — ZIP {data.clientLocation.zip}</>}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Fuente: {SOURCE_LABELS[data.clientLocation.source]} · confianza {data.clientLocation.confidence}
                </p>
              </div>

              {/* Jurisdicción investigada */}
              {data.jurisdiction ? (
                <div className="rounded-lg bg-white border border-gray-200 p-3 space-y-2">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                      Corte competente
                    </p>
                    <p className="text-sm font-semibold text-gray-900">{data.jurisdiction.court_name}</p>
                    {data.jurisdiction.court_name_es && (
                      <p className="text-xs text-gray-600 italic">{data.jurisdiction.court_name_es}</p>
                    )}
                    {data.jurisdiction.court_address && (
                      <p className="text-xs text-gray-500 mt-1">📍 {data.jurisdiction.court_address}</p>
                    )}
                    {data.jurisdiction.age_limit_sijs && (
                      <p className="text-[11px] text-gray-600 mt-1">
                        Edad máxima SIJS en {data.jurisdiction.state_name}:{' '}
                        <strong>{data.jurisdiction.age_limit_sijs} años</strong>
                      </p>
                    )}
                  </div>

                  {data.jurisdiction.filing_procedure && (
                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                        Procedimiento de radicación
                      </p>
                      <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {data.jurisdiction.filing_procedure}
                      </p>
                      {data.jurisdiction.filing_procedure_es && (
                        <details className="mt-1">
                          <summary className="text-[11px] text-gray-500 cursor-pointer hover:text-gray-700">
                            Ver en español
                          </summary>
                          <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap mt-1">
                            {data.jurisdiction.filing_procedure_es}
                          </p>
                        </details>
                      )}
                    </div>
                  )}

                  {data.jurisdiction.sources.length > 0 && (
                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                        Fuentes oficiales verificadas
                      </p>
                      <ul className="space-y-1">
                        {data.jurisdiction.sources.map((url, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <ExternalLink className="w-3 h-3 mt-0.5 text-blue-600 flex-shrink-0" />
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-blue-700 hover:underline break-all"
                            >
                              {url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {data.jurisdiction.notes && (
                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-[11px] text-gray-600 italic">💡 {data.jurisdiction.notes}</p>
                    </div>
                  )}

                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                    <p className="text-[10px] text-gray-500">
                      Verificado el {new Date(data.jurisdiction.verified_at).toLocaleDateString('es-MX')}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={reverify}
                      disabled={researching}
                      className="h-7 text-[11px]"
                    >
                      {researching ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : (
                        <RotateCw className="w-3 h-3 mr-1" />
                      )}
                      Re-verificar con fuentes oficiales
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                  <p className="text-xs text-amber-800 mb-2">
                    {data.error
                      ? `La investigación falló: ${data.error}. Puedes reintentar o llenar manualmente en Datos Suplementarios.`
                      : 'Aún no se ha investigado la corte para este caso.'}
                  </p>
                  <Button
                    size="sm"
                    onClick={reverify}
                    disabled={researching}
                    className="h-7 text-[11px] bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {researching ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <Scale className="w-3 h-3 mr-1" />
                    )}
                    Investigar ahora
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
