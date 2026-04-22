'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  PhoneCall, Clock, CalendarCheck, UserPlus, ArrowRight,
  AlertCircle, CheckCircle, Flame, Phone, Sparkles, Users,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface Appt {
  id: string
  scheduled_at: string
  guest_name: string | null
  guest_phone: string | null
  notes?: string | null
  call_status?: string | null
  client_decision?: string | null
  created_at?: string
  updated_at?: string
  captured_data?: Record<string, unknown> | null
}

interface WeekStats {
  total: number
  completadas: number
  acepta: number
  rechaza: number
}

interface Props {
  firstName: string
  today: Appt[]
  callNow: Appt[]
  acceptedNoContract: Appt[]
  weekStats: WeekStats
}

export function ConsultantDashboard({ firstName, today, callNow, acceptedNoContract, weekStats }: Props) {
  const router = useRouter()
  const conversionRate = weekStats.completadas > 0
    ? Math.round((weekStats.acepta / weekStats.completadas) * 100)
    : 0

  const now = Date.now()
  const upcomingToday = today.filter(a => new Date(a.scheduled_at).getTime() >= now)
  const pastToday = today.filter(a => new Date(a.scheduled_at).getTime() < now)

  function convertToContract(p: Appt) {
    const params = new URLSearchParams()
    if (p.guest_name) params.set('prefill_name', p.guest_name)
    if (p.guest_phone) params.set('prefill_phone', p.guest_phone)
    params.set('from_voice', p.id)
    if (p.captured_data) {
      sessionStorage.setItem(`prospecto_capture_${p.id}`, JSON.stringify(p.captured_data))
    }
    router.push(`/admin/contratos?${params.toString()}`)
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Saludo */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-amber-500" />
          Hola, {firstName}
        </h1>
        <p className="text-sm text-gray-500">
          Vista del día. Aquí tienes los prospectos pendientes y los leads que están listos para cerrar.
        </p>
      </div>

      {/* Stats de la semana */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<PhoneCall className="w-5 h-5 text-blue-600" />}
          label="Llamadas hoy"
          value={today.length}
          hint={upcomingToday.length > 0 ? `${upcomingToday.length} próximas` : 'Todas pasaron'}
          accent="blue"
        />
        <StatCard
          icon={<Flame className="w-5 h-5 text-red-600" />}
          label="Leads calientes"
          value={callNow.length}
          hint="Llamar ya"
          accent="red"
        />
        <StatCard
          icon={<UserPlus className="w-5 h-5 text-emerald-600" />}
          label="Aceptaron"
          value={acceptedNoContract.length}
          hint="Pasar a contratos"
          accent="green"
        />
        <StatCard
          icon={<CheckCircle className="w-5 h-5 text-amber-600" />}
          label="Conversión 7d"
          value={`${conversionRate}%`}
          hint={`${weekStats.acepta} de ${weekStats.completadas}`}
          accent="amber"
        />
      </div>

      {/* LLAMAR AHORA — sección urgente */}
      {callNow.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-red-900 flex items-center gap-2">
                <Flame className="w-4 h-4 animate-pulse" />
                Leads pidieron que los llamemos YA
              </h2>
              <Link href="/employee/prospectos">
                <Button size="sm" variant="outline" className="bg-white">
                  Ver todos <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="space-y-2">
              {callNow.slice(0, 5).map(p => (
                <div key={p.id} className="bg-white rounded-lg p-3 flex items-center justify-between gap-3 border border-red-100">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">
                      {p.guest_name || 'Sin nombre'}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                      {p.guest_phone && (
                        <a href={`tel:${p.guest_phone}`} className="flex items-center gap-1 text-blue-600 hover:underline">
                          <Phone className="w-3 h-3" /> {p.guest_phone}
                        </a>
                      )}
                      {p.created_at && (
                        <span className="text-gray-400">
                          {formatDistanceToNow(new Date(p.created_at), { locale: es, addSuffix: true })}
                        </span>
                      )}
                    </div>
                    {p.notes && (
                      <p className="text-xs text-gray-600 mt-1 truncate">{p.notes}</p>
                    )}
                  </div>
                  <Link href="/employee/prospectos">
                    <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white flex-shrink-0">
                      <PhoneCall className="w-3.5 h-3.5 mr-1" /> Llamar
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Próximas llamadas de hoy */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                Llamadas de hoy
              </h2>
              <Badge className="bg-amber-100 text-amber-800">
                {upcomingToday.length}
              </Badge>
            </div>
            {today.length === 0 ? (
              <div className="text-center py-8">
                <CalendarCheck className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Sin llamadas programadas para hoy</p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingToday.map(a => (
                  <AppointmentRow key={a.id} appt={a} tone="upcoming" />
                ))}
                {pastToday.length > 0 && (
                  <>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mt-4 mb-2">Ya pasaron</p>
                    {pastToday.map(a => (
                      <AppointmentRow key={a.id} appt={a} tone="past" />
                    ))}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Aceptaron — pasar a contratos */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                Listos para contrato
              </h2>
              <Badge className="bg-emerald-100 text-emerald-800">
                {acceptedNoContract.length}
              </Badge>
            </div>
            {acceptedNoContract.length === 0 ? (
              <div className="text-center py-8">
                <UserPlus className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">
                  Los leads que acepten iniciar proceso aparecerán aquí para pasarlos a Andriuw.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {acceptedNoContract.slice(0, 6).map(p => (
                  <div key={p.id} className="rounded-lg p-3 flex items-center justify-between gap-3 border border-emerald-100 bg-emerald-50/50">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {p.guest_name || 'Sin nombre'}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                        {p.guest_phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {p.guest_phone}
                          </span>
                        )}
                        {p.updated_at && (
                          <span className="text-gray-400">
                            {formatDistanceToNow(new Date(p.updated_at), { locale: es, addSuffix: true })}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="bg-[#002855] hover:bg-[#001d3d] text-white flex-shrink-0"
                      onClick={() => convertToContract(p)}
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
                {acceptedNoContract.length > 6 && (
                  <Link
                    href="/employee/prospectos"
                    className="block text-center text-xs text-gray-500 hover:text-gray-700 pt-2"
                  >
                    Ver {acceptedNoContract.length - 6} más
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Accesos rápidos */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <QuickLink href="/employee/prospectos" icon={<PhoneCall className="w-5 h-5" />} label="Todos los prospectos" color="bg-rose-50 text-rose-700 border-rose-100" />
        <QuickLink href="/employee/agenda" icon={<CalendarCheck className="w-5 h-5" />} label="Mi agenda" color="bg-blue-50 text-blue-700 border-blue-100" />
        <QuickLink href="/employee/clientes" icon={<Users className="w-5 h-5" />} label="Mis clientes" color="bg-emerald-50 text-emerald-700 border-emerald-100" />
      </div>
    </div>
  )
}

function AppointmentRow({ appt, tone }: { appt: Appt; tone: 'upcoming' | 'past' }) {
  const date = new Date(appt.scheduled_at)
  const isLlamadaAhora = appt.call_status === 'llamada_ahora'

  return (
    <Link href="/employee/prospectos" className="block">
      <div className={`rounded-lg p-3 flex items-center justify-between gap-3 border transition-colors hover:bg-gray-50 ${
        tone === 'past' ? 'border-gray-100 opacity-70' : isLlamadaAhora ? 'border-red-200 bg-red-50/30' : 'border-amber-100'
      }`}>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {appt.guest_name || 'Sin nombre'}
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5 flex-wrap">
            <span className="flex items-center gap-1 font-medium text-gray-700">
              <Clock className="w-3 h-3" /> {format(date, 'HH:mm', { locale: es })}
            </span>
            {appt.guest_phone && <span>{appt.guest_phone}</span>}
            {isLlamadaAhora && (
              <Badge className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0">
                Llamar ahora
              </Badge>
            )}
            {appt.client_decision === 'acepta' && (
              <Badge className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0">
                Aceptó
              </Badge>
            )}
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
      </div>
    </Link>
  )
}

function StatCard({
  icon, label, value, hint, accent,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  hint?: string
  accent: 'blue' | 'red' | 'green' | 'amber'
}) {
  const bg = {
    blue: 'bg-blue-50 border-blue-100',
    red: 'bg-red-50 border-red-100',
    green: 'bg-emerald-50 border-emerald-100',
    amber: 'bg-amber-50 border-amber-100',
  }[accent]

  return (
    <Card className={`${bg} border`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <p className="text-xs text-gray-600 font-medium">{label}</p>
        </div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {hint && <p className="text-[11px] text-gray-500 mt-1">{hint}</p>}
      </CardContent>
    </Card>
  )
}

function QuickLink({ href, icon, label, color }: { href: string; icon: React.ReactNode; label: string; color: string }) {
  return (
    <Link href={href} className={`rounded-xl border ${color} p-4 flex items-center gap-3 hover:shadow-sm transition-shadow`}>
      {icon}
      <span className="text-sm font-semibold">{label}</span>
    </Link>
  )
}
