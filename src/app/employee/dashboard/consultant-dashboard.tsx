'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  PhoneCall, Clock, CalendarCheck, UserPlus, ArrowRight,
  CheckCircle, Flame, Phone, Users,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { PageHeader, AdminKeyframes } from '@/components/admin-ui'

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

  // Snapshot al mount para evitar Date.now() en render (react-hooks/purity).
  const [now] = useState(() => Date.now())
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
      <AdminKeyframes />
      <PageHeader
        eyebrow="CONSULTORA · DASHBOARD"
        title={`Hola, ${firstName}`}
        accentDot
        description="Vista del día. Prospectos pendientes y leads listos para cerrar."
        telemetry={[
          { label: 'Llamadas hoy', value: today.length.toString() },
          { label: 'Leads calientes', value: callNow.length.toString() },
          { label: 'Aceptaron', value: acceptedNoContract.length.toString() },
          { label: 'Conversion 7d', value: `${conversionRate}%` },
        ]}
      />

      {/* Stats de la semana */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<PhoneCall className="w-5 h-5" />}
          label="Llamadas hoy"
          value={today.length}
          hint={upcomingToday.length > 0 ? `${upcomingToday.length} proximas` : 'Todas pasaron'}
          accent="blue"
        />
        <StatCard
          icon={<Flame className="w-5 h-5" />}
          label="Leads calientes"
          value={callNow.length}
          hint="Llamar ya"
          accent="red"
        />
        <StatCard
          icon={<UserPlus className="w-5 h-5" />}
          label="Aceptaron"
          value={acceptedNoContract.length}
          hint="Pasar a contratos"
          accent="green"
        />
        <StatCard
          icon={<CheckCircle className="w-5 h-5" />}
          label="Conversion 7d"
          value={`${conversionRate}%`}
          hint={`${weekStats.acepta} de ${weekStats.completadas}`}
          accent="gold"
        />
      </div>

      {/* LLAMAR AHORA - sección urgente */}
      {callNow.length > 0 && (
        <div
          className="rounded-2xl p-5"
          style={{
            background: 'var(--admin-red-soft)',
            border: '0.5px solid var(--admin-red)',
            boxShadow: 'var(--admin-shadow, 0 8px 20px rgba(185,28,28,0.10))',
          }}
        >
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2
              className="text-base font-bold flex items-center gap-2"
              style={{ color: 'var(--admin-red)' }}
            >
              <Flame className="w-4 h-4 animate-pulse" />
              Leads pidieron que los llamemos YA
            </h2>
            <Link
              href="/employee/prospectos"
              className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
              style={{
                background: 'var(--admin-bg-elev)',
                color: 'var(--admin-blue)',
                border: '0.5px solid var(--admin-border-strong)',
              }}
            >
              Ver todos <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="space-y-2">
            {callNow.slice(0, 5).map(p => (
              <div
                key={p.id}
                className="rounded-xl p-3 flex items-center justify-between gap-3"
                style={{
                  background: 'var(--admin-bg-elev)',
                  border: '0.5px solid var(--admin-red-soft)',
                }}
              >
                <div className="min-w-0 flex-1">
                  <p
                    className="text-sm font-semibold"
                    style={{ color: 'var(--admin-fg)' }}
                  >
                    {p.guest_name || 'Sin nombre'}
                  </p>
                  <div
                    className="flex items-center gap-3 text-xs mt-0.5"
                    style={{ color: 'var(--admin-fg-muted)' }}
                  >
                    {p.guest_phone && (
                      <a
                        href={`tel:${p.guest_phone}`}
                        className="flex items-center gap-1 hover:underline"
                        style={{ color: 'var(--admin-blue)' }}
                      >
                        <Phone className="w-3 h-3" /> {p.guest_phone}
                      </a>
                    )}
                    {p.created_at && (
                      <span style={{ color: 'var(--admin-fg-subtle)' }}>
                        {formatDistanceToNow(new Date(p.created_at), { locale: es, addSuffix: true })}
                      </span>
                    )}
                  </div>
                  {p.notes && (
                    <p
                      className="text-xs mt-1 truncate"
                      style={{ color: 'var(--admin-fg-muted)' }}
                    >
                      {p.notes}
                    </p>
                  )}
                </div>
                <Link
                  href="/employee/prospectos"
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90 flex-shrink-0"
                  style={{
                    background: 'var(--admin-red)',
                    color: '#FFFFFF',
                    boxShadow: '0 4px 14px rgba(185,28,28,0.25)',
                  }}
                >
                  <PhoneCall className="w-3.5 h-3.5" /> Llamar
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Próximas llamadas de hoy */}
        <div
          className="rounded-2xl p-5 transition-shadow hover:shadow-lg"
          style={{
            background: 'var(--admin-panel-grad)',
            border: '0.5px solid var(--admin-border)',
            boxShadow: 'var(--admin-shadow, 0 6px 20px rgba(11,31,58,0.06))',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2
              className="text-base font-bold flex items-center gap-2"
              style={{ color: 'var(--admin-fg)' }}
            >
              <Clock className="w-4 h-4" style={{ color: 'var(--admin-gold)' }} />
              Llamadas de hoy
            </h2>
            <CountBadge value={upcomingToday.length} tone="gold" />
          </div>
          {today.length === 0 ? (
            <div className="text-center py-8">
              <CalendarCheck
                className="w-10 h-10 mx-auto mb-2"
                style={{ color: 'var(--admin-fg-faint)' }}
              />
              <p className="text-sm" style={{ color: 'var(--admin-fg-subtle)' }}>
                Sin llamadas programadas para hoy
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingToday.map(a => (
                <AppointmentRow key={a.id} appt={a} tone="upcoming" />
              ))}
              {pastToday.length > 0 && (
                <>
                  <p
                    className="uppercase mt-4 mb-2"
                    style={{
                      fontFamily: 'var(--font-mono-tech)',
                      fontSize: 10,
                      letterSpacing: '0.18em',
                      color: 'var(--admin-fg-subtle)',
                    }}
                  >
                    Ya pasaron
                  </p>
                  {pastToday.map(a => (
                    <AppointmentRow key={a.id} appt={a} tone="past" />
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Aceptaron — pasar a contratos */}
        <div
          className="rounded-2xl p-5 transition-shadow hover:shadow-lg"
          style={{
            background: 'var(--admin-panel-grad)',
            border: '0.5px solid var(--admin-border)',
            boxShadow: 'var(--admin-shadow, 0 6px 20px rgba(11,31,58,0.06))',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2
              className="text-base font-bold flex items-center gap-2"
              style={{ color: 'var(--admin-fg)' }}
            >
              <Users className="w-4 h-4" style={{ color: 'var(--admin-green)' }} />
              Listos para contrato
            </h2>
            <CountBadge value={acceptedNoContract.length} tone="green" />
          </div>
          {acceptedNoContract.length === 0 ? (
            <div className="text-center py-8">
              <UserPlus
                className="w-10 h-10 mx-auto mb-2"
                style={{ color: 'var(--admin-fg-faint)' }}
              />
              <p className="text-sm" style={{ color: 'var(--admin-fg-subtle)' }}>
                Los leads que acepten iniciar proceso apareceran aqui para pasarlos a Andriuw.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {acceptedNoContract.slice(0, 6).map(p => (
                <div
                  key={p.id}
                  className="rounded-xl p-3 flex items-center justify-between gap-3"
                  style={{
                    background: 'var(--admin-green-soft)',
                    border: '0.5px solid var(--admin-green-soft)',
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm font-semibold truncate"
                      style={{ color: 'var(--admin-fg)' }}
                    >
                      {p.guest_name || 'Sin nombre'}
                    </p>
                    <div
                      className="flex items-center gap-3 text-xs mt-0.5"
                      style={{ color: 'var(--admin-fg-muted)' }}
                    >
                      {p.guest_phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {p.guest_phone}
                        </span>
                      )}
                      {p.updated_at && (
                        <span style={{ color: 'var(--admin-fg-subtle)' }}>
                          {formatDistanceToNow(new Date(p.updated_at), { locale: es, addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => convertToContract(p)}
                    className="inline-flex items-center justify-center rounded-full transition-all active:scale-95 hover:opacity-90 flex-shrink-0"
                    style={{
                      width: 36,
                      height: 36,
                      background: 'linear-gradient(135deg, var(--admin-accent), var(--admin-blue))',
                      color: '#FFFFFF',
                      boxShadow: '0 8px 20px rgba(30,78,154,0.25)',
                    }}
                    aria-label="Pasar a contrato"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {acceptedNoContract.length > 6 && (
                <Link
                  href="/employee/prospectos"
                  className="block text-center text-xs pt-2 hover:underline"
                  style={{ color: 'var(--admin-fg-muted)' }}
                >
                  Ver {acceptedNoContract.length - 6} mas
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Accesos rápidos */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <QuickLink
          href="/employee/prospectos"
          icon={<PhoneCall className="w-5 h-5" />}
          label="Todos los prospectos"
          iconColor="var(--admin-red)"
        />
        <QuickLink
          href="/employee/agenda"
          icon={<CalendarCheck className="w-5 h-5" />}
          label="Mi agenda"
          iconColor="var(--admin-blue)"
        />
        <QuickLink
          href="/employee/clientes"
          icon={<Users className="w-5 h-5" />}
          label="Mis clientes"
          iconColor="var(--admin-green)"
        />
      </div>
    </div>
  )
}

function AppointmentRow({ appt, tone }: { appt: Appt; tone: 'upcoming' | 'past' }) {
  const date = new Date(appt.scheduled_at)
  const isLlamadaAhora = appt.call_status === 'llamada_ahora'

  const rowStyle: React.CSSProperties =
    tone === 'past'
      ? {
          background: 'var(--admin-bg-elev-2)',
          border: '0.5px solid var(--admin-border)',
          opacity: 0.7,
        }
      : isLlamadaAhora
        ? {
            background: 'var(--admin-red-soft)',
            border: '0.5px solid var(--admin-red)',
          }
        : {
            background: 'var(--admin-bg-elev)',
            border: '0.5px solid var(--admin-gold-soft)',
          }

  return (
    <Link href="/employee/prospectos" className="block">
      <div
        className="rounded-xl p-3 flex items-center justify-between gap-3 transition-all hover:translate-y-[-1px] hover:shadow-sm"
        style={rowStyle}
      >
        <div className="min-w-0 flex-1">
          <p
            className="text-sm font-semibold truncate"
            style={{ color: 'var(--admin-fg)' }}
          >
            {appt.guest_name || 'Sin nombre'}
          </p>
          <div
            className="flex items-center gap-2 text-xs mt-0.5 flex-wrap"
            style={{ color: 'var(--admin-fg-muted)' }}
          >
            <span
              className="flex items-center gap-1 font-medium"
              style={{ color: 'var(--admin-fg)' }}
            >
              <Clock className="w-3 h-3" /> {format(date, 'HH:mm', { locale: es })}
            </span>
            {appt.guest_phone && <span>{appt.guest_phone}</span>}
            {isLlamadaAhora && <StatusChip label="Llamar ahora" tone="red" />}
            {appt.client_decision === 'acepta' && <StatusChip label="Acepto" tone="green" />}
          </div>
        </div>
        <ArrowRight
          className="w-4 h-4 flex-shrink-0"
          style={{ color: 'var(--admin-fg-faint)' }}
        />
      </div>
    </Link>
  )
}

function StatusChip({ label, tone }: { label: string; tone: 'red' | 'green' }) {
  const bg = tone === 'red' ? 'var(--admin-red-soft)' : 'var(--admin-green-soft)'
  const color = tone === 'red' ? 'var(--admin-red)' : 'var(--admin-green)'
  return (
    <span
      style={{
        background: bg,
        color,
        border: `0.5px solid ${color}`,
        letterSpacing: '0.1em',
        fontSize: 10,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 9999,
        fontFamily: 'var(--font-mono-tech)',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </span>
  )
}

function CountBadge({ value, tone }: { value: number; tone: 'gold' | 'green' }) {
  const bg = tone === 'gold' ? 'var(--admin-gold-soft)' : 'var(--admin-green-soft)'
  const color = tone === 'gold' ? 'var(--admin-gold)' : 'var(--admin-green)'
  return (
    <span
      style={{
        background: bg,
        color,
        border: `0.5px solid ${color}`,
        fontFamily: 'var(--font-mono-tech)',
        fontSize: 11,
        fontWeight: 700,
        padding: '2px 10px',
        borderRadius: 9999,
      }}
    >
      {value}
    </span>
  )
}

function StatCard({
  icon, label, value, hint, accent,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  hint?: string
  accent: 'blue' | 'red' | 'green' | 'gold'
}) {
  const accentColor =
    accent === 'blue'
      ? 'var(--admin-blue)'
      : accent === 'red'
        ? 'var(--admin-red)'
        : accent === 'green'
          ? 'var(--admin-green)'
          : 'var(--admin-gold)'
  const accentSoft =
    accent === 'blue'
      ? 'var(--admin-blue-soft)'
      : accent === 'red'
        ? 'var(--admin-red-soft)'
        : accent === 'green'
          ? 'var(--admin-green-soft)'
          : 'var(--admin-gold-soft)'

  return (
    <div
      className="relative rounded-2xl p-4 overflow-hidden transition-transform duration-300 hover:-translate-y-0.5"
      style={{
        background: 'var(--admin-panel-grad)',
        border: '0.5px solid var(--admin-border)',
        boxShadow: 'var(--admin-shadow, 0 6px 20px rgba(11,31,58,0.06))',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="inline-flex w-8 h-8 rounded-lg items-center justify-center"
          style={{
            background: accentSoft,
            border: `0.5px solid ${accentColor}`,
            color: accentColor,
          }}
        >
          {icon}
        </span>
        <p
          style={{
            fontFamily: 'var(--font-mono-tech)',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.16em',
            color: 'var(--admin-fg-subtle)',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </p>
      </div>
      <p
        style={{
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: '-0.025em',
          color: 'var(--admin-fg)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </p>
      {hint && (
        <p
          className="mt-1"
          style={{ fontSize: 11, color: 'var(--admin-fg-muted)' }}
        >
          {hint}
        </p>
      )}
    </div>
  )
}

function QuickLink({
  href, icon, label, iconColor,
}: {
  href: string
  icon: React.ReactNode
  label: string
  iconColor: string
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl p-4 flex items-center gap-3 transition-all hover:translate-y-[-1px] hover:shadow-md"
      style={{
        background: 'var(--admin-panel-grad)',
        border: '0.5px solid var(--admin-border)',
        boxShadow: 'var(--admin-shadow, 0 6px 18px rgba(11,31,58,0.05))',
      }}
    >
      <span
        className="inline-flex w-9 h-9 rounded-lg items-center justify-center flex-shrink-0"
        style={{
          background: 'var(--admin-bg-elev-2)',
          border: '0.5px solid var(--admin-border)',
          color: iconColor,
        }}
      >
        {icon}
      </span>
      <span
        className="text-sm font-semibold"
        style={{ color: 'var(--admin-fg)' }}
      >
        {label}
      </span>
    </Link>
  )
}
