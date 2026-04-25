'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  Scale, Loader2, AlertCircle, AlertTriangle, CheckCircle, ChevronDown, ChevronUp,
  ExternalLink, RotateCw, MapPin, Search, FileText, ListOrdered, Building2,
  Mail, Globe2, MailOpen, Shuffle, Paperclip, DollarSign, Clock, BookOpen, Download,
} from 'lucide-react'

type FilingChannel = 'in_person' | 'email' | 'portal' | 'mail' | 'hybrid'

type AttachmentType =
  | 'birth_certificate'
  | 'school_records'
  | 'medical_records'
  | 'psych_evaluation'
  | 'parental_consent'
  | 'abandonment_proof'
  | 'other'

interface RequiredForm {
  name: string
  url_official: string
  description_es: string
  is_mandatory: boolean
}

interface FilingStep {
  step_number: number
  title_es: string
  detail_es: string
  estimated_time: string | null
  requires_client_action: boolean
}

interface AttachmentRequirement {
  type: AttachmentType
  description_es: string
}

interface FeesInfo {
  amount_usd: number
  currency: 'USD'
  waivable: boolean
  waiver_form_name: string | null
  waiver_form_url: string | null
}

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
  filing_channel?: FilingChannel | null
  required_forms?: RequiredForm[] | null
  filing_steps?: FilingStep[] | null
  attachments_required?: AttachmentRequirement[] | null
  fees?: FeesInfo | null
  research_status?: 'pending' | 'completed' | 'failed' | null
  research_error?: string | null
  // Etapa 1 — radicación de la presentación (intake)
  intake_required_forms?: RequiredForm[] | null
  intake_filing_steps?: FilingStep[] | null
  intake_filing_channel?: FilingChannel | null
  intake_procedure_es?: string | null
  intake_notes?: string | null
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
  queued?: boolean
  error?: string
}

async function readJsonSafe(res: Response): Promise<JurisdictionResponse> {
  // Vercel a veces devuelve text/plain "An error occurred..." en timeout o
  // FUNCTION_INVOCATION_FAILED. Leemos como texto y parseamos a mano para
  // dar un error útil en vez de "Unexpected token 'A'".
  const text = await res.text()
  try {
    return JSON.parse(text) as JurisdictionResponse
  } catch {
    const preview = text.slice(0, 180).replace(/\s+/g, ' ').trim()
    throw new Error(`Respuesta no-JSON del servidor (status ${res.status}): ${preview || '(body vacío)'}`)
  }
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

const CHANNEL_META: Record<FilingChannel, { icon: typeof Building2; label: string }> = {
  in_person: { icon: Building2, label: 'Presencial' },
  email: { icon: Mail, label: 'Por email' },
  portal: { icon: Globe2, label: 'Portal en línea' },
  mail: { icon: MailOpen, label: 'Correo postal' },
  hybrid: { icon: Shuffle, label: 'Múltiples canales' },
}

const ATTACHMENT_LABELS: Record<AttachmentType, string> = {
  birth_certificate: 'Partida de nacimiento',
  school_records: 'Registros escolares',
  medical_records: 'Registros médicos',
  psych_evaluation: 'Evaluación psicológica',
  parental_consent: 'Consentimiento parental',
  abandonment_proof: 'Prueba de abandono',
  other: 'Otro',
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
  const [showProcedureProse, setShowProcedureProse] = useState(false)

  const load = useCallback(async (silent: boolean = false) => {
    if (!silent) setLoading(true)
    try {
      // Default: cache-only. NO dispara research al montar.
      const res = await fetch(`/api/admin/case-jurisdiction?caseId=${encodeURIComponent(caseId)}&lookup=cache`)
      const json = await readJsonSafe(res)
      setData(json)
    } catch (err) {
      if (!silent) toast.error(err instanceof Error ? err.message : 'Error al cargar jurisdicción')
      setData({ jurisdiction: null, clientLocation: null, error: 'load_failed' })
    } finally {
      if (!silent) setLoading(false)
    }
  }, [caseId])

  useEffect(() => { void load() }, [load])

  // Polling mientras research_status = pending. El research en background
  // toma ~30-60s; poleamos cada 5s para no saturar. Paramos al completar
  // o fallar.
  const isPending = data?.jurisdiction?.research_status === 'pending'
  useEffect(() => {
    if (!isPending) return
    const id = setInterval(() => { void load(true) }, 5000)
    return () => clearInterval(id)
  }, [isPending, load])

  // Dispara research con clic explícito. Usamos POST {force:true} — el endpoint
  // borra cache, encola la investigación en background (after()) y devuelve
  // el placeholder pending de inmediato. El polling de arriba toma el control.
  async function investigate() {
    setResearching(true)
    try {
      const res = await fetch('/api/admin/case-jurisdiction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, force: true }),
      })
      const json = await readJsonSafe(res)
      if (!res.ok && !json.jurisdiction) {
        throw new Error(json.error || 'No se pudo investigar')
      }
      setData(json)
      const isPendingNow = json.queued || json.jurisdiction?.research_status === 'pending'
      if (isPendingNow) {
        toast.success('Investigación encolada — la pantalla se actualiza sola en ~30-60s')
      } else if (json.jurisdiction) {
        toast.success('Jurisdicción actualizada')
      } else {
        toast.error('Sin ubicación detectada')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al investigar')
    } finally {
      setResearching(false)
    }
  }

  const researchStatus = data?.jurisdiction?.research_status
  const isResearchPending = researchStatus === 'pending'
  const isResearchFailed = researchStatus === 'failed'
  const isResearchCompleted = Boolean(data?.jurisdiction && (researchStatus === 'completed' || researchStatus == null))
  const hasCache = isResearchCompleted
  const needsInvestigation = Boolean(
    !loading && data && data.clientLocation && !hasCache && !isResearchPending && !isResearchFailed
  )

  const borderColor = (() => {
    if (loading || researching || isResearchPending) return 'border-blue-200 bg-blue-50/40'
    if (!data) return 'border-gray-200 bg-gray-50'
    if (isResearchFailed) return 'border-red-200 bg-red-50/40'
    if (data.error && !data.jurisdiction) return 'border-red-200 bg-red-50/40'
    if (!data.clientLocation) return 'border-red-200 bg-red-50/40'
    if (!data.jurisdiction) return 'border-amber-200 bg-amber-50/40'
    if (data.jurisdiction.confidence === 'high') return 'border-green-200 bg-green-50/40'
    if (data.jurisdiction.confidence === 'low') return 'border-red-200 bg-red-50/40'
    return 'border-amber-200 bg-amber-50/40'
  })()

  const headerIcon = (() => {
    if (loading || researching || isResearchPending) return <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
    if (isResearchFailed) return <AlertCircle className="w-4 h-4 text-red-600" />
    if (!data?.clientLocation) return <AlertCircle className="w-4 h-4 text-red-600" />
    if (!data.jurisdiction) return <AlertTriangle className="w-4 h-4 text-amber-600" />
    if (data.jurisdiction.confidence === 'high') return <CheckCircle className="w-4 h-4 text-green-600" />
    return <AlertTriangle className="w-4 h-4 text-amber-600" />
  })()

  const headerBadgeText = (() => {
    if (loading) return 'Cargando…'
    if (isResearchPending) return `Investigando en ${data?.jurisdiction?.state_name ?? 'background'}…`
    if (researching) return 'Investigando con fuentes oficiales…'
    if (isResearchFailed) return 'La investigación automática falló'
    if (!data) return ''
    if (!data.clientLocation) return 'Sin estado detectado'
    if (!data.jurisdiction) return `${data.clientLocation.stateName} — sin investigar`
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
          {data?.jurisdiction && <ConfidenceBadge confidence={data.jurisdiction.confidence} />}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {loading && (
            <div className="text-xs text-gray-600 flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              Consultando cache…
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

              {/* Pending: research en background disparado al crear contrato */}
              {isResearchPending && data.jurisdiction && (
                <div className="rounded-lg bg-white border border-blue-200 p-4">
                  <div className="flex items-start gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900 mb-1">
                        Investigando la corte competente en {data.jurisdiction.state_name}…
                      </p>
                      <p className="text-[11px] text-gray-600">
                        La IA está consultando fuentes oficiales (.gov/.us) para identificar la corte, el procedimiento y los formularios requeridos. Esto toma ~30–60 segundos.
                      </p>
                      <p className="text-[10px] text-gray-400 mt-2">
                        Se disparó automáticamente al crear el contrato. La página se actualiza sola.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Failed: mostrar error + botón reintentar */}
              {isResearchFailed && data.jurisdiction && (
                <div className="rounded-lg bg-white border border-red-200 p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900 mb-1">
                        La investigación falló
                      </p>
                      {data.jurisdiction.research_error && (
                        <p className="text-[11px] text-red-700 font-mono bg-red-50 rounded px-2 py-1 mt-1">
                          {data.jurisdiction.research_error}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={investigate}
                    disabled={researching}
                    className="bg-[#F2A900] hover:bg-[#D4940A] text-white"
                  >
                    {researching
                      ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Reintentando…</>
                      : <><RotateCw className="w-4 h-4 mr-1.5" /> Reintentar investigación</>
                    }
                  </Button>
                </div>
              )}

              {/* Sin cache → CTA grande para investigar */}
              {needsInvestigation && (
                <div className="rounded-lg bg-white border border-amber-200 p-4">
                  <p className="text-sm font-semibold text-gray-900 mb-1">
                    Aún no se ha investigado la corte para este caso.
                  </p>
                  <p className="text-[11px] text-gray-600 mb-3">
                    Toma ~30 segundos. Consulta 5 fuentes oficiales (.gov/.us). Costo: ≈ $0.40 USD.
                  </p>
                  <Button
                    size="sm"
                    onClick={investigate}
                    disabled={researching}
                    className="bg-[#F2A900] hover:bg-[#D4940A] text-white font-semibold"
                  >
                    {researching ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Investigando…</>
                    ) : (
                      <><Search className="w-4 h-4 mr-1.5" /> Investigar jurisdicción y procedimiento</>
                    )}
                  </Button>
                  {data.error && (
                    <p className="text-[11px] text-red-600 mt-2">Último intento falló: {data.error}</p>
                  )}
                </div>
              )}

              {/* Con cache → render estructurado */}
              {hasCache && data.jurisdiction && (
                <div className="rounded-lg bg-white border border-gray-200 p-4 space-y-5">
                  {/* Corte */}
                  <section>
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
                  </section>

                  {/* ══════════════════════════════════════════════ */}
                  {/* ETAPA 1 — Radicación de la presentación        */}
                  {/* ══════════════════════════════════════════════ */}
                  <PacketSection
                    title="Radicación de la presentación"
                    subtitle="Etapa 1 — formularios administrativos para abrir el caso y obtener número de expediente."
                    accent="violet"
                    channel={data.jurisdiction.intake_filing_channel ?? null}
                    channelAddress={data.jurisdiction.court_address}
                    forms={data.jurisdiction.intake_required_forms ?? []}
                    steps={data.jurisdiction.intake_filing_steps ?? []}
                    procedureProse={data.jurisdiction.intake_procedure_es ?? null}
                    notes={data.jurisdiction.intake_notes ?? null}
                  />

                  {/* ══════════════════════════════════════════════ */}
                  {/* ETAPA 2 — Radicación del procedimiento         */}
                  {/* ══════════════════════════════════════════════ */}
                  <PacketSection
                    title="Radicación del procedimiento del caso"
                    subtitle="Etapa 2 — documentos sustantivos que evalúa el juez para decidir el caso."
                    accent="amber"
                    channel={data.jurisdiction.filing_channel ?? null}
                    channelAddress={data.jurisdiction.court_address}
                    forms={data.jurisdiction.required_forms ?? []}
                    steps={data.jurisdiction.filing_steps ?? []}
                    attachments={data.jurisdiction.attachments_required ?? []}
                    fees={data.jurisdiction.fees ?? null}
                  />

                  {/* Aranceles combinados — si solo hay fee en merits lo mostramos arriba
                      dentro de PacketSection. No duplicamos aquí. */}

                  {/* Fuentes */}
                  {data.jurisdiction.sources.length > 0 && (
                    <section className="pt-2 border-t border-gray-100">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                        Fuentes oficiales verificadas
                      </p>
                      <ul className="space-y-1">
                        {data.jurisdiction.sources.map((url, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <ExternalLink className="w-3 h-3 mt-0.5 text-blue-600 flex-shrink-0" />
                            <a href={url} target="_blank" rel="noopener noreferrer"
                              className="text-[11px] text-blue-700 hover:underline break-all">
                              {url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {data.jurisdiction.notes && (
                    <p className="text-[11px] text-gray-600 italic pt-2 border-t border-gray-100">
                      💡 {data.jurisdiction.notes}
                    </p>
                  )}

                  {/* Procedimiento en prosa — collapsible */}
                  {(data.jurisdiction.filing_procedure || data.jurisdiction.filing_procedure_es) && (
                    <section className="pt-2 border-t border-gray-100">
                      <button
                        onClick={() => setShowProcedureProse(v => !v)}
                        className="flex items-center gap-2 text-[11px] text-gray-600 hover:text-gray-900"
                      >
                        <BookOpen className="w-3 h-3" />
                        {showProcedureProse ? 'Ocultar' : 'Ver'} resumen en prosa
                        {showProcedureProse ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                      {showProcedureProse && (
                        <div className="mt-2 space-y-2">
                          {data.jurisdiction.filing_procedure && (
                            <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                              {data.jurisdiction.filing_procedure}
                            </p>
                          )}
                          {data.jurisdiction.filing_procedure_es && (
                            <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap italic border-l-2 border-gray-200 pl-2">
                              {data.jurisdiction.filing_procedure_es}
                            </p>
                          )}
                        </div>
                      )}
                    </section>
                  )}

                  {/* Footer con fecha + re-verificar */}
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-[10px] text-gray-500">
                      Verificado el {new Date(data.jurisdiction.verified_at).toLocaleDateString('es-MX')}
                    </p>
                    <Button size="sm" variant="outline" onClick={investigate} disabled={researching} className="h-7 text-[11px]">
                      {researching ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RotateCw className="w-3 h-3 mr-1" />}
                      Re-verificar con fuentes oficiales
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Sub-componentes de render
// ─────────────────────────────────────────────────────────────

function ChannelBlock({ channel, address }: { channel: FilingChannel; address: string | null }) {
  const meta = CHANNEL_META[channel]
  const Icon = meta.icon
  return (
    <section className="rounded-lg bg-blue-50/50 border border-blue-100 p-3">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-blue-700" />
        <p className="text-sm font-semibold text-gray-900">{meta.label}</p>
      </div>
      {channel === 'in_person' && address && (
        <p className="text-xs text-gray-600 mt-1 ml-6">{address}</p>
      )}
      {channel === 'hybrid' && (
        <p className="text-xs text-gray-600 mt-1 ml-6">La corte admite múltiples vías — revisa los pasos abajo.</p>
      )}
    </section>
  )
}

function FormsBlock({ forms }: { forms: RequiredForm[] }) {
  if (!forms || forms.length === 0) {
    return (
      <section>
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-3.5 h-3.5 text-gray-500" />
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-600">Formularios requeridos</p>
        </div>
        <p className="text-[11px] text-gray-400 italic">
          No se identificaron formularios específicos en las fuentes oficiales.
        </p>
      </section>
    )
  }

  function downloadAll() {
    // Stagger 60ms entre pop-ups para evitar que el navegador bloquee como
    // pop-up automation. Toast informa al admin por si el navegador bloquea.
    forms.forEach((f, i) => {
      setTimeout(() => window.open(f.url_official, '_blank', 'noopener,noreferrer'), i * 60)
    })
    toast.success(`Abriendo ${forms.length} ${forms.length === 1 ? 'documento' : 'documentos'} oficial${forms.length === 1 ? '' : 'es'} en nuevas pestañas`)
  }

  return (
    <section>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-gray-500" />
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-600">Formularios requeridos</p>
        </div>
        {forms.length > 1 && (
          <button
            type="button"
            onClick={downloadAll}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 hover:text-blue-900 hover:underline"
          >
            <Download className="w-3 h-3" /> Descargar todos los oficiales
          </button>
        )}
      </div>
      <div className="space-y-2">
        {forms.map((f, i) => (
          <div key={i} className="rounded-lg border border-gray-200 p-2.5 bg-gray-50/50">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <p className="text-xs font-semibold text-gray-900 flex-1 min-w-0">{f.name}</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                f.is_mandatory ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-600'
              }`}>
                {f.is_mandatory ? 'Obligatorio' : 'Opcional'}
              </span>
            </div>
            <p className="text-[11px] text-gray-600 mt-1">{f.description_es}</p>
            <a
              href={f.url_official}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-blue-700 hover:underline"
            >
              <Download className="w-3 h-3" /> Descargar oficial
              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
            </a>
          </div>
        ))}
      </div>
    </section>
  )
}

function StepsBlock({ steps }: { steps: FilingStep[] }) {
  if (!steps || steps.length === 0) return null

  const sorted = [...steps].sort((a, b) => a.step_number - b.step_number)

  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <ListOrdered className="w-3.5 h-3.5 text-gray-500" />
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-600">Pasos de radicación</p>
      </div>
      <ol className="space-y-2">
        {sorted.map((s) => (
          <li key={s.step_number} className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#002855] text-white text-[11px] font-bold flex items-center justify-center">
              {s.step_number}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs font-semibold text-gray-900">{s.title_es}</p>
                {s.estimated_time && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                    <Clock className="w-2.5 h-2.5" /> {s.estimated_time}
                  </span>
                )}
                {s.requires_client_action && (
                  <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium">
                    Requiere acción del cliente
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-600 mt-0.5">{s.detail_es}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

function AttachmentsBlock({ items }: { items: AttachmentRequirement[] }) {
  if (!items || items.length === 0) return null

  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <Paperclip className="w-3.5 h-3.5 text-gray-500" />
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-600">Documentos del cliente a adjuntar</p>
      </div>
      <ul className="space-y-1">
        {items.map((a, i) => (
          <li key={i} className="text-xs text-gray-700 flex items-start gap-2">
            <span className="text-gray-400 mt-0.5">🔖</span>
            <div>
              <span className="font-medium text-gray-800">{ATTACHMENT_LABELS[a.type]}</span>
              <span className="text-gray-600"> — {a.description_es}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Sección reutilizable para una de las dos etapas de radicación.
 * Muestra: canal, formularios, pasos, (opcional) anexos, (opcional) fees.
 * El accent define el color del borde lateral y del título.
 */
function PacketSection({
  title,
  subtitle,
  accent,
  channel,
  channelAddress,
  forms,
  steps,
  attachments,
  fees,
  procedureProse,
  notes,
}: {
  title: string
  subtitle: string
  accent: 'violet' | 'amber'
  channel: FilingChannel | null
  channelAddress: string | null
  forms: RequiredForm[]
  steps: FilingStep[]
  attachments?: AttachmentRequirement[]
  fees?: FeesInfo | null
  procedureProse?: string | null
  notes?: string | null
}) {
  const accentBorder = accent === 'violet'
    ? 'border-l-4 border-l-violet-400'
    : 'border-l-4 border-l-amber-400'
  const titleColor = accent === 'violet' ? 'text-violet-900' : 'text-amber-900'

  const hasAnything = forms.length > 0 || steps.length > 0 || channel || procedureProse || notes
    || (attachments && attachments.length > 0) || fees

  return (
    <section className={`rounded-lg bg-gray-50/60 pl-4 pr-3 py-3 space-y-4 ${accentBorder}`}>
      <div>
        <p className={`text-xs font-bold uppercase tracking-wider ${titleColor}`}>{title}</p>
        <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>
      </div>

      {!hasAnything && (
        <p className="text-[11px] text-gray-400 italic">
          Sin información específica encontrada en fuentes oficiales.
        </p>
      )}

      {channel && <ChannelBlock channel={channel} address={channelAddress} />}
      <FormsBlock forms={forms} />
      <StepsBlock steps={steps} />
      {attachments && <AttachmentsBlock items={attachments} />}
      {fees && <FeesBlock fees={fees} />}
      {procedureProse && (
        <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap italic border-l-2 border-gray-200 pl-2">
          {procedureProse}
        </p>
      )}
      {notes && (
        <p className="text-[11px] text-gray-600 italic">💡 {notes}</p>
      )}
    </section>
  )
}

function FeesBlock({ fees }: { fees: FeesInfo }) {
  return (
    <section className="rounded-lg bg-emerald-50/50 border border-emerald-100 p-3">
      <div className="flex items-center gap-2 mb-1">
        <DollarSign className="w-3.5 h-3.5 text-emerald-700" />
        <p className="text-sm font-semibold text-gray-900">
          Arancel: ${fees.amount_usd.toLocaleString('en-US')} {fees.currency}
        </p>
      </div>
      {fees.waivable && (
        <div className="ml-5 mt-1">
          <p className="text-[11px] text-emerald-700 font-medium">✓ Exención disponible</p>
          {fees.waiver_form_url && fees.waiver_form_name && (
            <a
              href={fees.waiver_form_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-blue-700 hover:underline mt-0.5"
            >
              <Download className="w-3 h-3" /> Descargar {fees.waiver_form_name}
              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
            </a>
          )}
        </div>
      )}
    </section>
  )
}
