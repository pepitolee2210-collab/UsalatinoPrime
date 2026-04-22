'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
}

export function ProspectosView({ mode }: Props) {
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
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
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
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Bot className="w-6 h-6 text-rose-500" />
              {title}
            </h1>
            <p className="text-sm text-gray-500">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            {mode === 'admin' && (
              <Link href="/admin/prospectos-citas/configuracion">
                <Button variant="outline" size="sm">
                  <Settings2 className="w-3.5 h-3.5 mr-1" /> Configurar horarios
                </Button>
              </Link>
            )}
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Actualizar
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Llamar ahora" value={stats.ahora} accent="red" icon={<PhoneCall className="w-5 h-5 text-red-600" />} />
          <StatCard label="Programadas" value={stats.proximas} accent="amber" icon={<Clock className="w-5 h-5 text-amber-600" />} />
          <StatCard label="En curso" value={stats.enCurso} accent="blue" icon={<PhoneCall className="w-5 h-5 text-blue-600" />} />
          <StatCard label="Completadas" value={stats.completadas} accent="green" icon={<CheckCircle className="w-5 h-5 text-green-600" />} />
          <StatCard label="Conversión" value={`${conversionRate}%`} accent="blue" icon={<CalendarCheck className="w-5 h-5 text-blue-600" />} hint={`${stats.acepta} de ${stats.total}`} />
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {([
            { key: 'llamar_ahora', label: 'Llamar ahora', count: stats.ahora },
            { key: 'upcoming', label: 'Programadas', count: stats.proximas },
            { key: 'en_curso', label: 'En curso', count: stats.enCurso },
            { key: 'completadas', label: 'Completadas', count: stats.completadas },
            { key: 'no_procede', label: 'No procede' },
            { key: 'all', label: 'Todas' },
          ] as const).map(t => (
            <Button
              key={t.key}
              variant={tab === t.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab(t.key)}
            >
              {t.label}
              {'count' in t && t.count ? (
                <Badge className="ml-1.5 bg-white/20 text-current text-xs px-1.5">{t.count}</Badge>
              ) : null}
            </Button>
          ))}
        </div>

        {/* List */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Bot className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No hay prospectos en esta categoría.</p>
              </CardContent>
            </Card>
          ) : filtered.map(p => {
            const cfg = STATUS_CONFIG[p.status]
            const StatusIcon = cfg.icon
            const scheduled = new Date(p.scheduled_at)
            const isPast = scheduled.getTime() < now
            const isUpdating = updating === p.id
            const isEnCurso = p.call_status === 'en_curso'

            return (
              <Card key={p.id} className={`hover:shadow-sm transition-shadow ${isEnCurso ? 'ring-2 ring-blue-400' : ''}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-base font-semibold text-gray-900">
                          {p.guest_name || 'Sin nombre'}
                        </h3>
                        <Badge className={cfg.color}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {cfg.label}
                        </Badge>
                        <Badge className="bg-rose-100 text-rose-700">
                          <Bot className="w-3 h-3 mr-1" /> IA
                        </Badge>
                        {isEnCurso && (
                          <Badge className="bg-blue-100 text-blue-700 animate-pulse">
                            <PhoneCall className="w-3 h-3 mr-1" /> En llamada
                          </Badge>
                        )}
                        {p.call_status === 'llamada_ahora' && !isEnCurso && (
                          <Badge className="bg-red-100 text-red-700">
                            <PhoneCall className="w-3 h-3 mr-1" /> Llamar ahora
                          </Badge>
                        )}
                        {p.probability && (
                          <Badge className={
                            p.probability === 'alta' ? 'bg-green-100 text-green-700' :
                            p.probability === 'media' ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-700'
                          }>
                            Viabilidad: {p.probability}
                          </Badge>
                        )}
                        {p.client_decision === 'acepta' && (
                          <Badge className="bg-emerald-100 text-emerald-700">
                            <CheckCircle className="w-3 h-3 mr-1" /> Acepta
                          </Badge>
                        )}
                        {isPast && p.status === 'scheduled' && !p.call_status && (
                          <Badge className="bg-orange-100 text-orange-800">
                            <AlertCircle className="w-3 h-3 mr-1" /> Pasó la hora
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-sm text-gray-500 mb-1">
                        {p.guest_phone && (
                          <a href={`tel:${p.guest_phone}`} className="flex items-center gap-1 text-blue-600 hover:underline">
                            <Phone className="w-3.5 h-3.5" />
                            {p.guest_phone}
                          </a>
                        )}
                        <span className="flex items-center gap-1 text-gray-700 font-medium">
                          <CalendarCheck className="w-3.5 h-3.5" />
                          {format(scheduled, "EEEE d 'de' MMMM, HH:mm", { locale: es })}
                        </span>
                        <span className="text-gray-400">
                          (registrado {formatDistanceToNow(new Date(p.created_at), { locale: es, addSuffix: true })})
                        </span>
                      </div>
                      {p.notes && (
                        <p className="text-sm text-gray-600 mt-2 bg-gray-50 rounded-md p-2">
                          <span className="text-xs text-gray-400 uppercase tracking-wide block mb-0.5">Notas de la IA</span>
                          {p.notes}
                        </p>
                      )}
                      {p.voice_call && (
                        <Link
                          href="/admin/llamadas"
                          className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 hover:underline mt-2"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Ver llamada completa ({p.voice_call.duration_seconds || 0}s)
                        </Link>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      {(p.call_status == null || p.call_status === 'llamada_ahora' || p.call_status === 'programada') && (
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                          disabled={isUpdating}
                          onClick={() => startCall(p)}
                        >
                          <PhoneCall className="w-3.5 h-3.5 mr-1" />
                          Iniciar llamada
                        </Button>
                      )}
                      {p.call_status === 'en_curso' && (
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                          disabled={isUpdating}
                          onClick={() => setSelected(p)}
                        >
                          <FileText className="w-3.5 h-3.5 mr-1" />
                          Retomar captura
                        </Button>
                      )}
                      {p.client_decision === 'acepta' && (
                        <Button
                          size="sm"
                          className="bg-[#002855] hover:bg-[#001d3d] text-white"
                          disabled={isUpdating}
                          onClick={() => convertToClient(p)}
                        >
                          <UserPlus className="w-3.5 h-3.5 mr-1" />
                          Pasar a contratos
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
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

function StatCard({
  label, value, hint, icon, accent,
}: {
  label: string
  value: string | number
  hint?: string
  icon: React.ReactNode
  accent?: 'amber' | 'green' | 'red' | 'blue'
}) {
  const accentClass =
    accent === 'amber' ? 'bg-amber-50 border-amber-100' :
    accent === 'green' ? 'bg-green-50 border-green-100' :
    accent === 'red' ? 'bg-red-50 border-red-100' :
    accent === 'blue' ? 'bg-blue-50 border-blue-100' :
    'bg-white border-gray-100'

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
