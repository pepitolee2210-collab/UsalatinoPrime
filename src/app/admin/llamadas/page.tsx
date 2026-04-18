'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Loader2, PhoneCall, PhoneOff, AlertCircle, CheckCircle, Clock,
  TrendingUp, Bot, CalendarCheck, Activity, RefreshCw, XCircle,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

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

const END_REASON_CONFIG: Record<string, { label: string; icon: typeof PhoneOff; color: string }> = {
  'user-hangup': { label: 'Colgó el cliente', icon: PhoneOff, color: 'bg-gray-100 text-gray-700' },
  'timeout': { label: 'Timeout (15 min)', icon: Clock, color: 'bg-amber-100 text-amber-700' },
  'error': { label: 'Error', icon: AlertCircle, color: 'bg-red-100 text-red-700' },
  'server-close': { label: 'Cerrada por servidor', icon: XCircle, color: 'bg-red-100 text-red-700' },
  'unmount': { label: 'Navegó fuera', icon: PhoneOff, color: 'bg-gray-100 text-gray-700' },
}

function formatDuration(sec: number | null): string {
  if (!sec || sec <= 0) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function outcomeLabel(call: VoiceCall): { label: string; icon: typeof CheckCircle; color: string } {
  if (call.appointment_id) return { label: 'Cita agendada', icon: CalendarCheck, color: 'bg-green-100 text-green-800' }
  if (call.lead_id) return { label: 'Lead capturado', icon: CheckCircle, color: 'bg-blue-100 text-blue-800' }
  if (call.end_reason === 'error' || call.end_reason === 'server-close') {
    return { label: 'Error', icon: AlertCircle, color: 'bg-red-100 text-red-700' }
  }
  if (!call.ended_at) return { label: 'En curso', icon: Activity, color: 'bg-purple-100 text-purple-700' }
  return { label: 'Sin resultado', icon: PhoneOff, color: 'bg-gray-100 text-gray-600' }
}

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
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bot className="w-6 h-6 text-[#0ea5e9]" />
            Llamadas con el Asistente
          </h1>
          <p className="text-sm text-gray-500">
            Conversaciones de voz con la IA — últimos {days} días
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden bg-white">
            {[7, 14, 30, 90].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  d === days
                    ? 'bg-[#002855] text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={<PhoneCall className="w-5 h-5 text-[#0ea5e9]" />}
            label="Llamadas"
            value={stats.total}
            hint={stats.total === 0 ? 'Sin actividad' : ''}
          />
          <StatCard
            icon={<CalendarCheck className="w-5 h-5 text-green-600" />}
            label="Citas agendadas"
            value={stats.withAppointment}
            hint={stats.total > 0 ? `${stats.conversionRate}% conversión` : ''}
            accent="green"
          />
          <StatCard
            icon={<CheckCircle className="w-5 h-5 text-blue-600" />}
            label="Leads capturados"
            value={stats.withLead}
            hint={stats.total > 0 ? `${stats.leadRate}% captura` : ''}
            accent="blue"
          />
          <StatCard
            icon={<Clock className="w-5 h-5 text-purple-600" />}
            label="Duración promedio"
            value={formatDuration(stats.avgDurationSeconds)}
            hint={stats.withError > 0 ? `${stats.withError} con error` : ''}
            accent={stats.withError > 0 ? 'red' : undefined}
          />
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {calls.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Bot className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                No hay llamadas en los últimos {days} días.
              </p>
            </CardContent>
          </Card>
        ) : calls.map(call => {
          const outcome = outcomeLabel(call)
          const OutcomeIcon = outcome.icon
          return (
            <Card
              key={call.id}
              className="hover:shadow-sm transition-shadow cursor-pointer"
              onClick={() => setSelected(call)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-semibold text-gray-900">
                        {call.lead?.prospect_name ||
                          call.appointment?.guest_name ||
                          'Anónimo'}
                      </span>
                      <Badge className={outcome.color}>
                        <OutcomeIcon className="w-3 h-3 mr-1" />
                        {outcome.label}
                      </Badge>
                      {call.end_reason && END_REASON_CONFIG[call.end_reason] && (
                        <Badge variant="outline" className="text-xs">
                          {END_REASON_CONFIG[call.end_reason].label}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-gray-500">
                      <span title={format(new Date(call.started_at), "d MMM yyyy HH:mm", { locale: es })}>
                        {formatDistanceToNow(new Date(call.started_at), { locale: es, addSuffix: true })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(call.duration_seconds)}
                      </span>
                      {call.lead?.phone && (
                        <span className="text-blue-600 font-mono">{call.lead.phone}</span>
                      )}
                      {call.appointment?.guest_phone && (
                        <span className="text-green-700 font-mono">{call.appointment.guest_phone}</span>
                      )}
                      {call.appointment && (
                        <span className="text-green-700">
                          {format(new Date(call.appointment.scheduled_at), "d MMM HH:mm", { locale: es })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Detail modal */}
      <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle de la llamada</DialogTitle>
          </DialogHeader>
          {selected && <CallDetail call={selected} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatCard({
  icon, label, value, hint, accent,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  hint?: string
  accent?: 'green' | 'blue' | 'red'
}) {
  const accentClass = accent === 'green'
    ? 'bg-green-50 border-green-100'
    : accent === 'blue'
    ? 'bg-blue-50 border-blue-100'
    : accent === 'red'
    ? 'bg-red-50 border-red-100'
    : 'bg-white border-gray-100'
  return (
    <Card className={`${accentClass} border`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <p className="text-xs text-gray-500 font-medium">{label}</p>
        </div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {hint && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
      </CardContent>
    </Card>
  )
}

function CallDetail({ call }: { call: VoiceCall }) {
  const outcome = outcomeLabel(call)
  const OutcomeIcon = outcome.icon

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge className={outcome.color}>
          <OutcomeIcon className="w-3 h-3 mr-1" />
          {outcome.label}
        </Badge>
        {call.end_reason && END_REASON_CONFIG[call.end_reason] && (
          <Badge variant="outline">{END_REASON_CONFIG[call.end_reason].label}</Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <Field label="Iniciada" value={format(new Date(call.started_at), "d MMM yyyy, HH:mm:ss", { locale: es })} />
        <Field label="Duración" value={formatDuration(call.duration_seconds)} />
        {call.ended_at && (
          <Field label="Finalizada" value={format(new Date(call.ended_at), "d MMM yyyy, HH:mm:ss", { locale: es })} />
        )}
        {call.ip_address && <Field label="IP" value={call.ip_address} />}
      </div>

      {call.error_message && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3">
          <p className="text-xs font-semibold text-red-700 mb-1">Error</p>
          <p className="text-xs text-red-600 font-mono break-words">{call.error_message}</p>
        </div>
      )}

      {call.lead && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
          <p className="text-xs font-semibold text-blue-700 mb-1 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Lead capturado
          </p>
          <p className="text-sm text-gray-900 font-medium">{call.lead.prospect_name}</p>
          <p className="text-xs text-gray-600">{call.lead.phone}</p>
          <p className="text-[10px] text-gray-400 mt-1">Status: {call.lead.status}</p>
        </div>
      )}

      {call.appointment && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-3">
          <p className="text-xs font-semibold text-green-700 mb-1 flex items-center gap-1">
            <CalendarCheck className="w-3 h-3" /> Cita agendada
          </p>
          <p className="text-sm text-gray-900 font-medium">
            {call.appointment.guest_name || 'Sin nombre'}
          </p>
          <p className="text-xs text-gray-600">{call.appointment.guest_phone}</p>
          <p className="text-xs text-green-700 font-medium mt-1">
            {format(new Date(call.appointment.scheduled_at), "EEEE d 'de' MMMM, HH:mm", { locale: es })}
          </p>
        </div>
      )}

      {call.tools_invoked && call.tools_invoked.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Herramientas invocadas
          </p>
          <div className="space-y-1">
            {call.tools_invoked.map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                {t.ok ? (
                  <CheckCircle className="w-3 h-3 text-green-500" />
                ) : (
                  <XCircle className="w-3 h-3 text-red-500" />
                )}
                <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-800">{t.name}</code>
                <span className="text-gray-400">
                  +{Math.round((t.at - new Date(call.started_at).getTime()) / 1000)}s
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">{label}</p>
      <p className="text-sm text-gray-900 font-medium">{value}</p>
    </div>
  )
}
