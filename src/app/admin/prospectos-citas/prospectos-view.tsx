'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Loader2, Phone, Bot, CalendarCheck, Clock, UserPlus, X,
  CheckCircle, XCircle, RefreshCw, ExternalLink, AlertCircle, Settings2,
  PhoneCall, FileText,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { ProspectoCapturePanel, type CapturedData } from './capture-panel'

type Status = 'scheduled' | 'completed' | 'cancelled' | 'no_show'
type CallStatus = 'llamada_ahora' | 'programada' | 'en_curso' | 'completada' | 'no_procede' | 'no_contesta'
type Probability = 'alta' | 'media' | 'baja'
type ClientDecision = 'acepta' | 'rechaza' | 'lo_pensara' | 'no_procede'

interface VoiceCallSummary {
  id: string
  duration_seconds: number | null
  end_reason: string | null
  tools_invoked: unknown[] | null
  started_at: string
}

export interface Prospecto {
  id: string
  scheduled_at: string
  status: Status
  notes: string | null
  guest_name: string | null
  guest_phone: string | null
  created_at: string
  captured_data: CapturedData | null
  probability: Probability | null
  consultant_id: string | null
  consultant_notes: string | null
  client_decision: ClientDecision | null
  call_status: CallStatus | null
  voice_call: VoiceCallSummary | null
}

type TabKey = 'llamar_ahora' | 'upcoming' | 'en_curso' | 'completadas' | 'no_procede' | 'all'

const STATUS_CONFIG: Record<Status, { label: string; color: string; icon: typeof Clock }> = {
  scheduled: { label: 'Pendiente', color: 'bg-amber-100 text-amber-800', icon: Clock },
  completed: { label: 'Completada', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  no_show: { label: 'No asistió', color: 'bg-red-100 text-red-800', icon: XCircle },
  cancelled: { label: 'Cancelada', color: 'bg-gray-100 text-gray-700', icon: X },
}

interface Props {
  mode: 'admin' | 'senior_consultant'
  /** Cuando true, oculta el h1 interno (el padre renderiza un PageHeader). */
  hideHeader?: boolean
}

export function ProspectosView({ mode, hideHeader }: Props) {
  const [items, setItems] = useState<Prospecto[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('llamar_ahora')
  const [updating, setUpdating] = useState<string | null>(null)
  const [selected, setSelected] = useState<Prospecto | null>(null)
  const router = useRouter()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/prospectos-citas')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setItems(data.items || [])
    } catch {
      toast.error('Error al cargar prospectos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function patchProspecto(id: string, patch: Partial<Prospecto>) {
    setUpdating(id)
    try {
      const res = await fetch('/api/admin/prospectos-citas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      })
      if (!res.ok) throw new Error()
      await load()
    } catch {
      toast.error('Error al actualizar')
    } finally {
      setUpdating(null)
    }
  }

  async function startCall(p: Prospecto) {
    await patchProspecto(p.id, { call_status: 'en_curso' })
    setSelected(p)
  }

  function convertToClient(p: Prospecto) {
    const params = new URLSearchParams()
    if (p.guest_name) params.set('prefill_name', p.guest_name)
    if (p.guest_phone) params.set('prefill_phone', p.guest_phone)
    params.set('from_voice', p.id)
    // Si llenamos captured_data, lo pasamos como ref por storage temporal
    if (p.captured_data) {
      sessionStorage.setItem(`prospecto_capture_${p.id}`, JSON.stringify(p.captured_data))
    }
    router.push(`/admin/contratos?${params.toString()}`)
  }

  const now = Date.now()
  const filtered = items.filter(p => {
    const cs = p.call_status
    if (tab === 'all') return true
    if (tab === 'llamar_ahora') return cs === 'llamada_ahora' || (cs == null && p.status === 'scheduled' && new Date(p.scheduled_at).getTime() <= now + 3600_000)
    if (tab === 'upcoming') return cs === 'programada' || (cs == null && p.status === 'scheduled' && new Date(p.scheduled_at).getTime() > now + 3600_000)
    if (tab === 'en_curso') return cs === 'en_curso'
    if (tab === 'completadas') return cs === 'completada' || p.status === 'completed'
    if (tab === 'no_procede') return cs === 'no_procede' || p.status === 'no_show' || p.status === 'cancelled'
    return true
  })

  const stats = {
    ahora: items.filter(p => p.call_status === 'llamada_ahora').length,
    proximas: items.filter(p => p.call_status === 'programada').length,
    enCurso: items.filter(p => p.call_status === 'en_curso').length,
    completadas: items.filter(p => p.call_status === 'completada' || p.status === 'completed').length,
    acepta: items.filter(p => p.client_decision === 'acepta').length,
    total: items.length,
  }
  const conversionRate = stats.total > 0 ? Math.round((stats.acepta / stats.total) * 100) : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--admin-fg-muted)' }} />
      </div>
    )
  }

  const title = mode === 'senior_consultant' ? 'Mis Prospectos' : 'Prospectos IA'
  const subtitle = mode === 'senior_consultant'
    ? 'Leads que solicitaron evaluación gratuita a través de la plataforma'
    : 'Prospectos que agendaron evaluación gratuita con una consultora senior'

  return (
    <>
      <div className="space-y-6">
        {!hideHeader && (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--admin-fg)' }}>
                <Bot className="w-6 h-6" style={{ color: 'var(--admin-fg)' }} />
                {title}
              </h1>
              <p style={{ fontSize: 13, color: 'var(--admin-fg-muted)' }}>{subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              {mode === 'admin' && (
                <Link href="/admin/prospectos-citas/configuracion" className={PROS_BTN_GHOST}>
                  <Settings2 className="w-3.5 h-3.5" /> Configurar horarios
                </Link>
              )}
              <button onClick={load} className={PROS_BTN_GHOST}>
                <RefreshCw className="w-3.5 h-3.5" /> Actualizar
              </button>
            </div>
          </div>
        )}

        {/* Toolbar when hideHeader (page-level) */}
        {hideHeader && (
          <div className="flex justify-end">
            <button onClick={load} className={PROS_BTN_GHOST}>
              <RefreshCw className="w-3.5 h-3.5" /> Actualizar
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Llamar ahora" value={stats.ahora} tone="danger" icon={<PhoneCall className="w-4 h-4" />} />
          <StatCard label="Programadas" value={stats.proximas} tone="warning" icon={<Clock className="w-4 h-4" />} />
          <StatCard label="En curso" value={stats.enCurso} tone="info" icon={<PhoneCall className="w-4 h-4" />} pulse={stats.enCurso > 0} />
          <StatCard label="Completadas" value={stats.completadas} tone="success" icon={<CheckCircle className="w-4 h-4" />} />
          <StatCard label="Conversión" value={`${conversionRate}%`} tone="white" icon={<CalendarCheck className="w-4 h-4" />} hint={`${stats.acepta} de ${stats.total}`} />
        </div>

        {/* Tabs — segmented control */}
        <div
          className="inline-flex items-center gap-1 p-1 rounded-full flex-wrap"
          style={{
            background: 'var(--admin-accent-soft)',
            border: '0.5px solid var(--admin-border)',
          }}
        >
          {([
            { key: 'llamar_ahora', label: 'Llamar ahora', count: stats.ahora },
            { key: 'upcoming', label: 'Programadas', count: stats.proximas },
            { key: 'en_curso', label: 'En curso', count: stats.enCurso },
            { key: 'completadas', label: 'Completadas', count: stats.completadas },
            { key: 'no_procede', label: 'No procede' },
            { key: 'all', label: 'Todas' },
          ] as const).map(t => {
            const isActive = tab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all duration-300"
                style={{
                  background: isActive ? 'var(--admin-accent-soft)' : 'transparent',
                  color: isActive ? 'var(--admin-accent)' : 'var(--admin-fg-muted)',
                  fontSize: 12,
                  fontWeight: isActive ? 700 : 500,
                  letterSpacing: '-0.005em',
                  boxShadow: isActive ? '0 4px 12px var(--admin-accent-glow)' : 'none',
                }}
              >
                {t.label}
                {'count' in t && t.count ? (
                  <span
                    className="inline-flex items-center justify-center"
                    style={{
                      background: isActive ? 'var(--admin-veil-3)' : 'var(--admin-border-strong)',
                      color: isActive ? 'var(--admin-accent)' : 'var(--admin-fg-muted)',
                      fontFamily: 'var(--font-mono-tech)',
                      fontSize: 10,
                      fontWeight: 700,
                      minWidth: 16,
                      height: 16,
                      padding: '0 5px',
                      borderRadius: 8,
                    }}
                  >
                    {t.count}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>

        {/* List */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div
              className="rounded-2xl py-16 text-center"
              style={{
                background: 'var(--admin-panel-grad)',
                border: '0.5px solid var(--admin-border)',
              }}
            >
              <div
                className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
                style={{
                  background: 'var(--admin-accent-soft)',
                  border: '0.5px solid var(--admin-border-strong)',
                }}
              >
                <Bot className="w-7 h-7" style={{ color: 'var(--admin-fg-subtle)' }} />
              </div>
              <p style={{ fontSize: 13, color: 'var(--admin-fg-subtle)', fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.15em' }}>
                SIN PROSPECTOS EN ESTA CATEGORÍA
              </p>
            </div>
          ) : filtered.map(p => {
            const scheduled = new Date(p.scheduled_at)
            const isPast = scheduled.getTime() < now
            const isUpdating = updating === p.id
            const isEnCurso = p.call_status === 'en_curso'
            const isLlamarAhora = p.call_status === 'llamada_ahora'

            return (
              <div
                key={p.id}
                className="relative rounded-2xl p-5 transition-all duration-500 group"
                style={{
                  background: 'var(--admin-panel-grad)',
                  border: isEnCurso ? '0.5px solid var(--admin-blue)' : '0.5px solid var(--admin-border-strong)',
                  backdropFilter: 'blur(20px)',
                  boxShadow: isEnCurso ? '0 0 24px var(--admin-blue-soft)' : 'none',
                }}
              >
                {/* Inner glow halo on hover */}
                <span
                  aria-hidden
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
                  style={{ background: 'radial-gradient(ellipse at top, var(--admin-accent-soft), transparent 60%)' }}
                />

                <div className="relative flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h3 style={{ fontSize: 17, fontWeight: 600, color: 'var(--admin-fg)', letterSpacing: '-0.018em' }}>
                        {p.guest_name || 'Sin nombre'}
                      </h3>
                      <ProsBadge kind="ai" label="IA" icon={<Bot className="w-3 h-3" />} />
                      {p.status === 'scheduled' && !isEnCurso && !isLlamarAhora && (
                        <ProsBadge kind="warning" label={STATUS_CONFIG.scheduled.label} icon={<Clock className="w-3 h-3" />} />
                      )}
                      {p.status === 'completed' && (
                        <ProsBadge kind="success" label="Completada" icon={<CheckCircle className="w-3 h-3" />} />
                      )}
                      {p.status === 'no_show' && (
                        <ProsBadge kind="danger" label="No asistió" icon={<XCircle className="w-3 h-3" />} />
                      )}
                      {p.status === 'cancelled' && (
                        <ProsBadge kind="neutral" label="Cancelada" icon={<X className="w-3 h-3" />} />
                      )}
                      {isEnCurso && (
                        <ProsBadge kind="info" label="En llamada" icon={<PhoneCall className="w-3 h-3" />} pulse />
                      )}
                      {isLlamarAhora && !isEnCurso && (
                        <ProsBadge kind="danger" label="Llamar ahora" icon={<PhoneCall className="w-3 h-3" />} pulse />
                      )}
                      {p.probability && (
                        <ProsBadge
                          kind={p.probability === 'alta' ? 'success' : p.probability === 'media' ? 'warning' : 'neutral'}
                          label={`Viabilidad: ${p.probability}`}
                        />
                      )}
                      {p.client_decision === 'acepta' && (
                        <ProsBadge kind="success" label="Acepta" icon={<CheckCircle className="w-3 h-3" />} />
                      )}
                      {isPast && p.status === 'scheduled' && !p.call_status && (
                        <ProsBadge kind="warning" label="Pasó la hora" icon={<AlertCircle className="w-3 h-3" />} />
                      )}
                    </div>

                    <div className="flex items-center gap-x-5 gap-y-1 flex-wrap mb-2">
                      {p.guest_phone && (
                        <a
                          href={`tel:${p.guest_phone}`}
                          className="inline-flex items-center gap-1.5 transition-opacity hover:opacity-80"
                          style={{ color: 'var(--admin-fg)', fontSize: 13, fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.02em' }}
                        >
                          <Phone className="w-3.5 h-3.5" />
                          {p.guest_phone}
                        </a>
                      )}
                      <span
                        className="inline-flex items-center gap-1.5"
                        style={{ color: 'var(--admin-fg-muted)', fontSize: 12, fontWeight: 500 }}
                      >
                        <CalendarCheck className="w-3.5 h-3.5" />
                        {format(scheduled, "EEEE d 'de' MMM · HH:mm", { locale: es })}
                      </span>
                      <span style={{ color: 'var(--admin-fg-subtle)', fontSize: 11, fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.05em' }}>
                        REG. {formatDistanceToNow(new Date(p.created_at), { locale: es, addSuffix: true }).toUpperCase()}
                      </span>
                    </div>

                    {p.notes && (
                      <div
                        className="mt-3 rounded-xl px-3.5 py-2.5"
                        style={{
                          background: 'var(--admin-accent-soft)',
                          border: '0.5px solid var(--admin-accent-soft)',
                        }}
                      >
                        <p style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 9, fontWeight: 500, letterSpacing: '0.2em', color: 'var(--admin-fg-subtle)', marginBottom: 4 }}>
                          NOTAS DE LA IA
                        </p>
                        <p style={{ fontSize: 12.5, color: 'var(--admin-fg-muted)', lineHeight: 1.5 }}>{p.notes}</p>
                      </div>
                    )}

                    {p.voice_call && (
                      <Link
                        href="/admin/llamadas"
                        className="inline-flex items-center gap-1 mt-3 transition-opacity hover:opacity-80"
                        style={{
                          color: 'var(--admin-fg)',
                          fontFamily: 'var(--font-mono-tech)',
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.15em',
                        }}
                      >
                        <ExternalLink className="w-3 h-3" />
                        VER LLAMADA ({p.voice_call.duration_seconds || 0}s) →
                      </Link>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    {(p.call_status == null || p.call_status === 'llamada_ahora' || p.call_status === 'programada') && (
                      <button
                        disabled={isUpdating}
                        onClick={() => startCall(p)}
                        className={PROS_BTN_SOLID}
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                        Iniciar llamada
                      </button>
                    )}
                    {p.call_status === 'en_curso' && (
                      <button
                        disabled={isUpdating}
                        onClick={() => setSelected(p)}
                        className={PROS_BTN_SOLID}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Retomar captura
                      </button>
                    )}
                    {p.client_decision === 'acepta' && (
                      <button
                        disabled={isUpdating}
                        onClick={() => convertToClient(p)}
                        className={PROS_BTN_OUTLINE}
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Pasar a contratos
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {selected && (
        <ProspectoCapturePanel
          prospecto={selected}
          onClose={() => setSelected(null)}
          onSaved={async (patch) => {
            await patchProspecto(selected.id, patch)
          }}
          onConvert={() => convertToClient(selected)}
        />
      )}
    </>
  )
}

// ════════════════════════════════════════════════════════════════════
// Dark techno helpers
// ════════════════════════════════════════════════════════════════════

const PROS_BTN_GHOST =
  'inline-flex items-center gap-1.5 px-3 py-2 rounded-full transition-all duration-200 ' +
  'hover:bg-white/10 active:scale-95 text-[12px] font-semibold tracking-tight ' +
  'bg-white/[0.04] border border-white/10 text-[color:var(--admin-fg)]'

const PROS_BTN_SOLID =
  'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full transition-all duration-200 ' +
  'hover:opacity-90 active:scale-95 text-[12px] font-semibold tracking-tight ' +
  'bg-[color:var(--primary)] text-[color:var(--primary-foreground)] shadow-[var(--admin-shadow)] disabled:opacity-50'

const PROS_BTN_OUTLINE =
  'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full transition-all duration-200 ' +
  'hover:bg-white/10 active:scale-95 text-[12px] font-semibold tracking-tight ' +
  'bg-white/[0.06] border border-white/20 text-[color:var(--admin-fg)] disabled:opacity-50'

type StatTone = 'success' | 'warning' | 'danger' | 'info' | 'white'

const TONE_MAP: Record<StatTone, { icon: string; ring: string; bg: string }> = {
  success: { icon: 'var(--admin-green)', ring: 'var(--admin-green)',  bg: 'var(--admin-green-soft)'  },
  warning: { icon: 'var(--admin-gold)',  ring: 'var(--admin-gold-border)', bg: 'var(--admin-gold-soft)' },
  danger:  { icon: 'var(--admin-red)',   ring: 'var(--admin-red)',  bg: 'var(--admin-red-soft)' },
  info:    { icon: 'var(--admin-blue)',  ring: 'var(--admin-blue)', bg: 'var(--admin-blue-soft)' },
  white:   { icon: 'var(--admin-fg)',    ring: 'var(--admin-border-strong)', bg: 'var(--admin-accent-soft)' },
}

function StatCard({
  label, value, hint, icon, tone, pulse,
}: {
  label: string
  value: string | number
  hint?: string
  icon: React.ReactNode
  tone: StatTone
  pulse?: boolean
}) {
  const t = TONE_MAP[tone]
  return (
    <div
      className="relative rounded-2xl p-4 overflow-hidden transition-transform duration-300 hover:-translate-y-0.5"
      style={{
        background: 'var(--admin-panel-grad)',
        border: '0.5px solid var(--admin-border-strong)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="inline-flex items-center justify-center w-7 h-7 rounded-lg relative"
          style={{
            background: t.bg,
            border: `0.5px solid ${t.ring}`,
            color: t.icon,
          }}
        >
          {icon}
          {pulse && (
            <span
              aria-hidden
              className="absolute inset-0 rounded-lg"
              style={{
                boxShadow: `0 0 12px ${t.icon}`,
                animation: 'ulp-glow 2s ease-in-out infinite',
              }}
            />
          )}
        </span>
        <p style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 9, fontWeight: 500, letterSpacing: '0.18em', color: 'var(--admin-fg-subtle)' }}>
          {label.toUpperCase()}
        </p>
      </div>
      <p style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.025em', color: 'var(--admin-fg)', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
      {hint && (
        <p style={{ fontSize: 10, color: 'var(--admin-fg-subtle)', marginTop: 2, fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.05em' }}>
          {hint.toUpperCase()}
        </p>
      )}
    </div>
  )
}

type ProsBadgeKind = 'ai' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const PROS_BADGE_STYLES: Record<ProsBadgeKind, { bg: string; border: string; text: string; dot: string }> = {
  ai:      { bg: 'var(--admin-accent-soft)',  border: 'var(--admin-border-strong)', text: 'var(--admin-fg)',    dot: 'var(--admin-accent)' },
  success: { bg: 'var(--admin-green-soft)',   border: 'var(--admin-green)',         text: 'var(--admin-green)', dot: 'var(--admin-green)' },
  warning: { bg: 'var(--admin-gold-soft)',    border: 'var(--admin-gold-border)',   text: 'var(--admin-gold)',  dot: 'var(--admin-gold)' },
  danger:  { bg: 'var(--admin-red-soft)',     border: 'var(--admin-red)',           text: 'var(--admin-red)',   dot: 'var(--admin-red)' },
  info:    { bg: 'var(--admin-blue-soft)',    border: 'var(--admin-blue)',          text: 'var(--admin-blue)',  dot: 'var(--admin-blue)' },
  neutral: { bg: 'var(--admin-accent-soft)',  border: 'var(--admin-border-strong)', text: 'var(--admin-fg-muted)', dot: 'var(--admin-fg-muted)' },
}

function ProsBadge({ kind, label, icon, pulse }: { kind: ProsBadgeKind; label: string; icon?: React.ReactNode; pulse?: boolean }) {
  const s = PROS_BADGE_STYLES[kind]
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full"
      style={{
        background: s.bg,
        border: `0.5px solid ${s.border}`,
        fontFamily: 'var(--font-mono-tech)',
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.1em',
        color: s.text,
      }}
    >
      {pulse && (
        <span className="relative flex items-center justify-center" style={{ width: 5, height: 5 }}>
          <span
            className="absolute inset-0 rounded-full"
            style={{ background: s.dot, animation: 'ulp-ping 1.6s ease-in-out infinite' }}
          />
          <span
            className="relative rounded-full"
            style={{ width: 5, height: 5, background: s.dot, boxShadow: `0 0 6px ${s.dot}` }}
          />
        </span>
      )}
      {icon}
      {label.toUpperCase()}
    </span>
  )
}
