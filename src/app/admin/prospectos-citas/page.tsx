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
  CheckCircle, XCircle, RefreshCw, ExternalLink, AlertCircle,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

type Status = 'scheduled' | 'completed' | 'cancelled' | 'no_show'

interface VoiceCallSummary {
  id: string
  duration_seconds: number | null
  end_reason: string | null
  tools_invoked: unknown[] | null
  started_at: string
}

interface Prospecto {
  id: string
  scheduled_at: string
  status: Status
  notes: string | null
  guest_name: string | null
  guest_phone: string | null
  created_at: string
  voice_call: VoiceCallSummary | null
}

type TabKey = 'upcoming' | 'scheduled' | 'completed' | 'no_show' | 'cancelled' | 'all'

const STATUS_CONFIG: Record<Status, { label: string; color: string; icon: typeof Clock }> = {
  scheduled: { label: 'Pendiente', color: 'bg-amber-100 text-amber-800', icon: Clock },
  completed: { label: 'Completada', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  no_show: { label: 'No asistió', color: 'bg-red-100 text-red-800', icon: XCircle },
  cancelled: { label: 'Cancelada', color: 'bg-gray-100 text-gray-700', icon: X },
}

export default function ProspectosCitasPage() {
  const [items, setItems] = useState<Prospecto[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('upcoming')
  const [updating, setUpdating] = useState<string | null>(null)
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

  async function updateStatus(id: string, status: Status) {
    setUpdating(id)
    try {
      const res = await fetch('/api/admin/prospectos-citas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (!res.ok) throw new Error()
      toast.success('Estado actualizado')
      await load()
    } catch {
      toast.error('Error al actualizar')
    } finally {
      setUpdating(null)
    }
  }

  function convertToClient(p: Prospecto) {
    const params = new URLSearchParams()
    if (p.guest_name) params.set('prefill_name', p.guest_name)
    if (p.guest_phone) params.set('prefill_phone', p.guest_phone)
    params.set('from_voice', p.id)
    router.push(`/admin/contratos?${params.toString()}`)
  }

  const now = Date.now()
  const filtered = items.filter(p => {
    if (tab === 'all') return true
    if (tab === 'upcoming') {
      return p.status === 'scheduled' && new Date(p.scheduled_at).getTime() >= now - 24 * 3600_000
    }
    return p.status === tab
  })

  const stats = {
    upcoming: items.filter(p => p.status === 'scheduled' && new Date(p.scheduled_at).getTime() >= now).length,
    completed: items.filter(p => p.status === 'completed').length,
    noShow: items.filter(p => p.status === 'no_show').length,
    total: items.length,
  }
  const conversionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0

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
            <Bot className="w-6 h-6 text-rose-500" />
            Prospectos agendados por IA
          </h1>
          <p className="text-sm text-gray-500">
            Leads calientes que acaban de agendar una llamada con Henry a través de la IA de voz
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Actualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Próximas" value={stats.upcoming} accent="amber" icon={<Clock className="w-5 h-5 text-amber-600" />} />
        <StatCard label="Completadas" value={stats.completed} accent="green" icon={<CheckCircle className="w-5 h-5 text-green-600" />} />
        <StatCard label="No asistieron" value={stats.noShow} accent="red" icon={<XCircle className="w-5 h-5 text-red-600" />} />
        <StatCard label="Conversión" value={`${conversionRate}%`} accent="blue" icon={<CalendarCheck className="w-5 h-5 text-blue-600" />} hint={`${stats.total} total`} />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {([
          { key: 'upcoming', label: 'Próximas', count: stats.upcoming },
          { key: 'scheduled', label: 'Pendientes' },
          { key: 'completed', label: 'Completadas', count: stats.completed },
          { key: 'no_show', label: 'No asistieron', count: stats.noShow },
          { key: 'cancelled', label: 'Canceladas' },
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
              <p className="text-sm text-gray-500">
                No hay prospectos en esta categoría.
              </p>
            </CardContent>
          </Card>
        ) : filtered.map(p => {
          const cfg = STATUS_CONFIG[p.status]
          const StatusIcon = cfg.icon
          const scheduled = new Date(p.scheduled_at)
          const isPast = scheduled.getTime() < now
          const isUpdating = updating === p.id

          return (
            <Card key={p.id} className="hover:shadow-sm transition-shadow">
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
                        <Bot className="w-3 h-3 mr-1" />
                        IA
                      </Badge>
                      {isPast && p.status === 'scheduled' && (
                        <Badge className="bg-orange-100 text-orange-800">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Pasó la hora
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
                        (agendada {formatDistanceToNow(new Date(p.created_at), { locale: es, addSuffix: true })})
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
                    {p.status === 'scheduled' && (
                      <>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          disabled={isUpdating}
                          onClick={() => updateStatus(p.id, 'completed')}
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-1" />
                          Completada
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600"
                          disabled={isUpdating}
                          onClick={() => updateStatus(p.id, 'no_show')}
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" />
                          No asistió
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-gray-500"
                          disabled={isUpdating}
                          onClick={() => updateStatus(p.id, 'cancelled')}
                        >
                          Cancelar
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      className="bg-[#002855] hover:bg-[#001d3d] text-white"
                      disabled={isUpdating}
                      onClick={() => convertToClient(p)}
                    >
                      <UserPlus className="w-3.5 h-3.5 mr-1" />
                      Convertir en cliente
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
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
