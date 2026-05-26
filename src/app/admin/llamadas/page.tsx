'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Loader2, PhoneCall, PhoneOff, AlertCircle, CheckCircle, Clock,
  TrendingUp, Bot, CalendarCheck, Activity, RefreshCw, XCircle,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { PageHeader, AdminKeyframes } from '@/components/admin-ui'

interface ToolInvocation {
  name: string
  at: number
  ok: boolean
}

interface Lead {
  id: string
  prospect_name: string
  phone: string
  status: string
}

interface Appointment {
  id: string
  scheduled_at: string
  guest_name: string | null
  guest_phone: string | null
  status: string
}

interface VoiceCall {
  id: string
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  ip_address: string | null
  user_agent: string | null
  end_reason: string | null
  error_message: string | null
  tools_invoked: ToolInvocation[] | null
  lead_id: string | null
  appointment_id: string | null
  lead: Lead | null
  appointment: Appointment | null
}

interface Stats {
  total: number
  withLead: number
  withAppointment: number
  withError: number
  avgDurationSeconds: number
  conversionRate: number
  leadRate: number
  windowDays: number
}

interface EndReasonStyle {
  label: string
  icon: typeof PhoneOff
  bg: string
  border: string
  text: string
  dot: string
}

const END_REASON_STYLES: Record<string, EndReasonStyle> = {
  'user-hangup':  { label: 'Colgó cliente',  icon: PhoneOff,    bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.3)', text: '#CBD5E1', dot: '#94A3B8' },
  'timeout':      { label: 'Timeout 15min',  icon: Clock,       bg: 'rgba(250,204,21,0.10)',  border: 'rgba(250,204,21,0.3)',  text: '#FDE68A', dot: '#FACC15' },
  'error':        { label: 'Error',          icon: AlertCircle, bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.3)', text: '#FCA5A5', dot: '#F87171' },
  'server-close': { label: 'Cerró servidor', icon: XCircle,     bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.3)', text: '#FCA5A5', dot: '#F87171' },
  'unmount':      { label: 'Navegó fuera',   icon: PhoneOff,    bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.3)', text: '#CBD5E1', dot: '#94A3B8' },
}

interface OutcomeStyle {
  label: string
  icon: typeof CheckCircle
  bg: string
  border: string
  text: string
  dot: string
}

function outcomeLabel(call: VoiceCall): OutcomeStyle {
  if (call.appointment_id) return { label: 'Cita agendada',   icon: CalendarCheck, bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.3)',   text: '#86EFAC', dot: '#4ADE80' }
  if (call.lead_id)        return { label: 'Lead capturado',  icon: CheckCircle,   bg: 'rgba(96,165,250,0.10)',  border: 'rgba(96,165,250,0.3)',  text: '#93C5FD', dot: '#60A5FA' }
  if (call.end_reason === 'error' || call.end_reason === 'server-close') {
    return { label: 'Error', icon: AlertCircle, bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.3)', text: '#FCA5A5', dot: '#F87171' }
  }
  if (!call.ended_at) return { label: 'En curso', icon: Activity, bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.3)', text: '#C4B5FD', dot: '#A78BFA' }
  return { label: 'Sin resultado', icon: PhoneOff, bg: 'var(--admin-accent-soft)', border: 'var(--admin-border-strong)', text: 'var(--admin-fg-muted)', dot: 'var(--admin-fg-muted)' }
}

function formatDuration(sec: number | null): string {
  if (!sec || sec <= 0) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ════════════════════════════════════════════════════════════════════
// Style constants
// ════════════════════════════════════════════════════════════════════

const BTN_ICON =
  'inline-flex items-center justify-center w-9 h-9 rounded-xl transition-colors hover:bg-white/10 ' +
  'bg-white/[0.04] border border-white/10 text-white'

const DARK_DIALOG_CLS =
  'bg-[#0A0A0A] border border-white/10 text-white shadow-2xl backdrop-blur-xl max-w-2xl ' +
  '[&>button]:text-white/60 [&>button]:hover:text-white'

// ════════════════════════════════════════════════════════════════════

export default function VoiceCallsPage() {
  const [calls, setCalls] = useState<VoiceCall[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<VoiceCall | null>(null)
  const [days, setDays] = useState(14)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/voice-calls?days=${days}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setCalls(data.calls || [])
      setStats(data.stats || null)
    } catch {
      setCalls([])
      setStats(null)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--admin-fg-muted)' }} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AdminKeyframes />
      <PageHeader
        eyebrow="Comunicación · Llamadas IA"
        title="Llamadas IA"
        accentDot
        description="Conversaciones de voz con el asistente. Monitorea conversión, leads capturados y errores."
        action={
          <div className="flex items-center gap-2">
            <div
              className="inline-flex items-center gap-1 p-1 rounded-full"
              style={{
                background: 'var(--admin-accent-soft)',
                border: '0.5px solid var(--admin-border)',
              }}
            >
              {[7, 14, 30, 90].map(d => {
                const isActive = d === days
                return (
                  <button
                    key={d}
                    onClick={() => setDays(d)}
                    className="px-3 py-1.5 rounded-full transition-all duration-300"
                    style={{
                      background: isActive ? '#FFFFFF' : 'transparent',
                      color: isActive ? 'var(--admin-bg-deep)' : 'var(--admin-fg-muted)',
                      fontFamily: 'var(--font-mono-tech)',
                      fontSize: 11,
                      fontWeight: isActive ? 700 : 500,
                      letterSpacing: '0.05em',
                      boxShadow: isActive ? '0 0 12px rgba(255,255,255,0.18)' : 'none',
                    }}
                  >
                    {d}D
                  </button>
                )
              })}
            </div>
            <button onClick={load} className={BTN_ICON} title="Actualizar">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        }
        telemetry={stats ? [
          { label: 'Llamadas', value: stats.total.toLocaleString() },
          { label: 'Citas', value: stats.withAppointment.toString() },
          { label: 'Leads', value: stats.withLead.toString() },
          { label: 'Conversión', value: `${stats.conversionRate}%` },
        ] : undefined}
      />

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={<PhoneCall className="w-4 h-4" />}
            label="Llamadas"
            value={stats.total.toLocaleString()}
            hint={stats.total === 0 ? 'Sin actividad' : ''}
            tone="info"
          />
          <StatCard
            icon={<CalendarCheck className="w-4 h-4" />}
            label="Citas agendadas"
            value={stats.withAppointment}
            hint={stats.total > 0 ? `${stats.conversionRate}% conversión` : ''}
            tone="success"
          />
          <StatCard
            icon={<CheckCircle className="w-4 h-4" />}
            label="Leads capturados"
            value={stats.withLead}
            hint={stats.total > 0 ? `${stats.leadRate}% captura` : ''}
            tone="info"
          />
          <StatCard
            icon={<Clock className="w-4 h-4" />}
            label="Duración promedio"
            value={formatDuration(stats.avgDurationSeconds)}
            hint={stats.withError > 0 ? `${stats.withError} con error` : ''}
            tone={stats.withError > 0 ? 'danger' : 'purple'}
          />
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {calls.length === 0 ? (
          <div
            className="rounded-2xl py-16 text-center"
            style={{
              background: 'linear-gradient(180deg, rgba(20,20,20,0.7), rgba(8,8,8,0.7))',
              border: '0.5px solid var(--admin-border)',
            }}
          >
            <Bot className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--admin-fg-subtle)' }} />
            <p style={{ fontSize: 13, color: 'var(--admin-fg-subtle)', fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.15em' }}>
              SIN LLAMADAS EN ÚLTIMOS {days} DÍAS
            </p>
          </div>
        ) : calls.map(call => {
          const outcome = outcomeLabel(call)
          const OutcomeIcon = outcome.icon
          const endStyle = call.end_reason ? END_REASON_STYLES[call.end_reason] : null
          return (
            <button
              key={call.id}
              onClick={() => setSelected(call)}
              className="w-full text-left relative rounded-2xl p-4 overflow-hidden transition-all duration-300 group"
              style={{
                background: 'linear-gradient(180deg, rgba(20,20,20,0.92), rgba(8,8,8,0.92))',
                border: '0.5px solid var(--admin-border-strong)',
                backdropFilter: 'blur(20px)',
              }}
            >
              <span
                aria-hidden
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at top, var(--admin-accent-soft), transparent 60%)' }}
              />

              <div className="relative flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--admin-fg)', letterSpacing: '-0.005em' }}>
                      {call.lead?.prospect_name || call.appointment?.guest_name || 'Anónimo'}
                    </span>
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full"
                      style={{
                        background: outcome.bg,
                        border: `0.5px solid ${outcome.border}`,
                        fontFamily: 'var(--font-mono-tech)',
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        color: outcome.text,
                      }}
                    >
                      <OutcomeIcon className="w-2.5 h-2.5" />
                      {outcome.label.toUpperCase()}
                    </span>
                    {endStyle && (
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full"
                        style={{
                          background: endStyle.bg,
                          border: `0.5px solid ${endStyle.border}`,
                          fontFamily: 'var(--font-mono-tech)',
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: '0.1em',
                          color: endStyle.text,
                        }}
                      >
                        <span className="rounded-full" style={{ width: 5, height: 5, background: endStyle.dot }} />
                        {endStyle.label.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-x-4 gap-y-1 flex-wrap">
                    <span
                      title={format(new Date(call.started_at), "d MMM yyyy HH:mm", { locale: es })}
                      style={{
                        fontFamily: 'var(--font-mono-tech)',
                        fontSize: 11,
                        color: 'var(--admin-fg-subtle)',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {formatDistanceToNow(new Date(call.started_at), { locale: es, addSuffix: true }).toUpperCase()}
                    </span>
                    <span
                      className="inline-flex items-center gap-1"
                      style={{
                        fontFamily: 'var(--font-mono-tech)',
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--admin-fg)',
                        letterSpacing: '0.05em',
                      }}
                    >
                      <Clock className="w-3 h-3" style={{ color: '#A78BFA' }} />
                      {formatDuration(call.duration_seconds)}
                    </span>
                    {call.lead?.phone && (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono-tech)',
                          fontSize: 11,
                          color: '#93C5FD',
                          letterSpacing: '0.02em',
                        }}
                      >
                        {call.lead.phone}
                      </span>
                    )}
                    {call.appointment?.guest_phone && (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono-tech)',
                          fontSize: 11,
                          color: '#86EFAC',
                          letterSpacing: '0.02em',
                        }}
                      >
                        {call.appointment.guest_phone}
                      </span>
                    )}
                    {call.appointment && (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono-tech)',
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#86EFAC',
                          letterSpacing: '0.05em',
                        }}
                      >
                        {format(new Date(call.appointment.scheduled_at), "d MMM · HH:mm", { locale: es }).toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Detail modal */}
      <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <DialogContent className={DARK_DIALOG_CLS}>
          <DialogHeader>
            <DialogTitle className="text-white" style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.018em' }}>
              <span style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 10, fontWeight: 500, letterSpacing: '0.2em', color: 'var(--admin-fg-subtle)', display: 'block' }}>
                LLAMADA · DETALLE
              </span>
              Conversación con la IA
            </DialogTitle>
          </DialogHeader>
          {selected && <CallDetail call={selected} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// StatCard
// ════════════════════════════════════════════════════════════════════

type StatTone = 'info' | 'success' | 'danger' | 'purple'

const STAT_TONE: Record<StatTone, { bg: string; border: string; iconColor: string }> = {
  info:    { bg: 'rgba(96,165,250,0.10)',  border: 'rgba(96,165,250,0.3)',  iconColor: '#60A5FA' },
  success: { bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.3)',   iconColor: '#4ADE80' },
  danger:  { bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.3)', iconColor: '#F87171' },
  purple:  { bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.3)', iconColor: '#A78BFA' },
}

function StatCard({
  icon, label, value, hint, tone,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  hint?: string
  tone: StatTone
}) {
  const t = STAT_TONE[tone]
  return (
    <div
      className="relative rounded-2xl p-4 overflow-hidden transition-transform duration-300 hover:-translate-y-0.5"
      style={{
        background: 'linear-gradient(180deg, rgba(20,20,20,0.92), rgba(8,8,8,0.92))',
        border: '0.5px solid var(--admin-border-strong)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="inline-flex items-center justify-center w-7 h-7 rounded-lg"
          style={{
            background: t.bg,
            border: `0.5px solid ${t.border}`,
            color: t.iconColor,
          }}
        >
          {icon}
        </span>
        <p style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 9, fontWeight: 500, letterSpacing: '0.18em', color: 'var(--admin-fg-subtle)' }}>
          {label.toUpperCase()}
        </p>
      </div>
      <p style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.025em', color: 'var(--admin-fg)', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
      {hint && (
        <p style={{ fontSize: 10, color: 'var(--admin-fg-subtle)', marginTop: 4, fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.05em' }}>
          {hint.toUpperCase()}
        </p>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// CallDetail (modal)
// ════════════════════════════════════════════════════════════════════

function CallDetail({ call }: { call: VoiceCall }) {
  const outcome = outcomeLabel(call)
  const OutcomeIcon = outcome.icon
  const endStyle = call.end_reason ? END_REASON_STYLES[call.end_reason] : null

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{
            background: outcome.bg,
            border: `0.5px solid ${outcome.border}`,
            fontFamily: 'var(--font-mono-tech)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.1em',
            color: outcome.text,
          }}
        >
          <OutcomeIcon className="w-3 h-3" />
          {outcome.label.toUpperCase()}
        </span>
        {endStyle && (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{
              background: endStyle.bg,
              border: `0.5px solid ${endStyle.border}`,
              fontFamily: 'var(--font-mono-tech)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: endStyle.text,
            }}
          >
            <span className="rounded-full" style={{ width: 5, height: 5, background: endStyle.dot }} />
            {endStyle.label.toUpperCase()}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="INICIADA" value={format(new Date(call.started_at), "d MMM yyyy, HH:mm:ss", { locale: es })} />
        <Field label="DURACIÓN" value={formatDuration(call.duration_seconds)} mono />
        {call.ended_at && (
          <Field label="FINALIZADA" value={format(new Date(call.ended_at), "d MMM yyyy, HH:mm:ss", { locale: es })} />
        )}
        {call.ip_address && <Field label="IP" value={call.ip_address} mono />}
      </div>

      {call.error_message && (
        <div
          className="rounded-xl p-3"
          style={{
            background: 'rgba(248,113,113,0.08)',
            border: '0.5px solid rgba(248,113,113,0.3)',
          }}
        >
          <p style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', color: '#F87171', marginBottom: 4 }}>
            ⚠ ERROR
          </p>
          <p style={{ fontSize: 11, color: '#FCA5A5', fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.02em', wordBreak: 'break-word' }}>
            {call.error_message}
          </p>
        </div>
      )}

      {call.lead && (
        <div
          className="rounded-xl p-3.5"
          style={{
            background: 'rgba(96,165,250,0.08)',
            border: '0.5px solid rgba(96,165,250,0.3)',
          }}
        >
          <p
            className="inline-flex items-center gap-1.5 mb-2"
            style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', color: '#60A5FA' }}
          >
            <CheckCircle className="w-3 h-3" />
            LEAD CAPTURADO
          </p>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--admin-fg)', letterSpacing: '-0.005em' }}>{call.lead.prospect_name}</p>
          <p style={{ fontSize: 11, color: '#93C5FD', fontFamily: 'var(--font-mono-tech)', marginTop: 2 }}>{call.lead.phone}</p>
          <p style={{ fontSize: 10, color: 'var(--admin-fg-subtle)', marginTop: 4, fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.1em' }}>
            STATUS · {call.lead.status.toUpperCase()}
          </p>
        </div>
      )}

      {call.appointment && (
        <div
          className="rounded-xl p-3.5"
          style={{
            background: 'rgba(34,197,94,0.08)',
            border: '0.5px solid rgba(34,197,94,0.3)',
          }}
        >
          <p
            className="inline-flex items-center gap-1.5 mb-2"
            style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', color: '#4ADE80' }}
          >
            <CalendarCheck className="w-3 h-3" />
            CITA AGENDADA
          </p>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--admin-fg)', letterSpacing: '-0.005em' }}>
            {call.appointment.guest_name || 'Sin nombre'}
          </p>
          {call.appointment.guest_phone && (
            <p style={{ fontSize: 11, color: '#86EFAC', fontFamily: 'var(--font-mono-tech)', marginTop: 2 }}>
              {call.appointment.guest_phone}
            </p>
          )}
          <p
            style={{
              fontFamily: 'var(--font-mono-tech)',
              fontSize: 11,
              fontWeight: 700,
              color: '#86EFAC',
              marginTop: 6,
              letterSpacing: '0.05em',
            }}
          >
            {format(new Date(call.appointment.scheduled_at), "EEEE d 'DE' MMMM · HH:mm", { locale: es }).toUpperCase()}
          </p>
        </div>
      )}

      {call.tools_invoked && call.tools_invoked.length > 0 && (
        <div>
          <p
            className="inline-flex items-center gap-1.5 mb-2"
            style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--admin-fg-muted)' }}
          >
            <TrendingUp className="w-3 h-3" />
            HERRAMIENTAS INVOCADAS
          </p>
          <div className="space-y-1">
            {call.tools_invoked.map((t, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{
                  background: 'rgba(255,255,255,0.025)',
                  border: '0.5px solid var(--admin-accent-soft)',
                }}
              >
                {t.ok ? (
                  <CheckCircle className="w-3 h-3 shrink-0" style={{ color: '#4ADE80' }} />
                ) : (
                  <XCircle className="w-3 h-3 shrink-0" style={{ color: '#F87171' }} />
                )}
                <code
                  className="px-1.5 py-0.5 rounded"
                  style={{
                    fontFamily: 'var(--font-mono-tech)',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--admin-fg)',
                    background: 'var(--admin-accent-soft)',
                    border: '0.5px solid var(--admin-border-strong)',
                  }}
                >
                  {t.name}
                </code>
                <span
                  style={{
                    fontFamily: 'var(--font-mono-tech)',
                    fontSize: 10,
                    color: 'var(--admin-fg-subtle)',
                    letterSpacing: '0.05em',
                    marginLeft: 'auto',
                  }}
                >
                  +{Math.round((t.at - new Date(call.started_at).getTime()) / 1000)}S
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 9, fontWeight: 500, letterSpacing: '0.18em', color: 'var(--admin-fg-subtle)' }}>
        {label}
      </p>
      <p
        className="mt-1"
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--admin-fg)',
          letterSpacing: '-0.005em',
          fontFamily: mono ? 'var(--font-mono-tech)' : undefined,
        }}
      >
        {value}
      </p>
    </div>
  )
}
