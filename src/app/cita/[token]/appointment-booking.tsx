'use client'

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CalendarClock, Clock, Video, AlertTriangle, CheckCircle, X, Globe,
} from 'lucide-react'
import { toast } from 'sonner'
import { checkPenalty } from '@/lib/appointments/penalty'
import { TimezoneSelector } from '@/components/appointments/timezone-selector'
import {
  formatTime,
  formatDate,
  OFFICE_TIMEZONE,
  tzShortLabel,
  getBrowserTimezone,
  isValidTimezone,
} from '@/lib/timezones/format'
import type { TzSource } from '@/lib/appointments/resolve-tz'
import type { Appointment } from '@/types/database'

/**
 * Snapshot del browser timezone vía useSyncExternalStore — necesario
 * para refinar la TZ cuando el server cayó al fallback "office" sin
 * disparar un setState dentro de un useEffect (regla del codebase).
 */
const noopSubscribe = () => () => {}
function getBrowserSnapshot(): string | null {
  if (typeof window === 'undefined') return null
  return getBrowserTimezone() || null
}
function getBrowserServerSnapshot(): string | null {
  return null
}

interface AppointmentBookingProps {
  token: string
  appointments: Appointment[]
  zoomLink: string
  initialTimezone: string
  initialTimezoneSource: TzSource
}

/**
 * Booking UI del cliente. Las citas se almacenan siempre en UTC; este
 * componente decide qué TZ usar para mostrar slots y hora confirmada.
 *
 * La TZ inicial viene del server (cascada preferred → contract → profile).
 * Si la cascada terminó en 'office' (no había nada del cliente), aquí
 * podemos refinar con el browser tz; cuando el cliente la cambia con el
 * selector, persistimos vía POST /api/cita/[token]/preferred-timezone.
 */
export function AppointmentBooking({
  token,
  appointments,
  zoomLink,
  initialTimezone,
  initialTimezoneSource,
}: AppointmentBookingProps) {
  const scheduledAppointment = appointments.find(a => a.status === 'scheduled')
  const penalty = checkPenalty(appointments)

  // Si el server cayó en 'office' (sin preferred ni state), refinamos con
  // el browser tz para que un cliente de Florida vea Eastern sin tener
  // que tocar el combobox manualmente.
  const browserTz = useSyncExternalStore(noopSubscribe, getBrowserSnapshot, getBrowserServerSnapshot)
  const inferred = useMemo<{ tz: string; src: TzSource }>(() => {
    if (initialTimezoneSource !== 'office') {
      return { tz: initialTimezone, src: initialTimezoneSource }
    }
    if (browserTz && isValidTimezone(browserTz) && browserTz !== initialTimezone) {
      return { tz: browserTz, src: 'browser' }
    }
    return { tz: initialTimezone, src: initialTimezoneSource }
  }, [initialTimezone, initialTimezoneSource, browserTz])

  const [override, setOverride] = useState<{ tz: string; src: TzSource } | null>(null)
  const tz = override?.tz ?? inferred.tz
  const tzSource = override?.src ?? inferred.src

  const persistTz = useCallback(
    async (next: string) => {
      setOverride({ tz: next, src: 'preferred' })
      try {
        const res = await fetch(`/api/cita/${token}/preferred-timezone`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timezone: next }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          toast.error(data.error || 'No se pudo guardar tu zona horaria')
        }
      } catch {
        toast.error('No se pudo guardar tu zona horaria')
      }
    },
    [token],
  )

  if (penalty.isPenalized) {
    return <PenaltyView penalty={penalty} />
  }

  if (scheduledAppointment) {
    return (
      <ScheduledView
        appointment={scheduledAppointment}
        zoomLink={zoomLink}
        token={token}
        tz={tz}
        tzSource={tzSource}
        onTzChange={persistTz}
      />
    )
  }

  return (
    <BookingView
      token={token}
      tz={tz}
      tzSource={tzSource}
      onTzChange={persistTz}
    />
  )
}

function TzSelectorBlock({
  tz,
  tzSource,
  onTzChange,
}: {
  tz: string
  tzSource: TzSource
  onTzChange: (next: string) => void
}) {
  const hint = tzSource === 'preferred'
    ? 'Zona horaria guardada en tu cuenta'
    : tzSource === 'contract'
    ? 'Detectada del estado en tu contrato'
    : tzSource === 'profile'
    ? 'Detectada de la dirección en tu perfil'
    : tzSource === 'browser'
    ? 'Detectada de tu dispositivo'
    : 'Hora de la oficina · cambia abajo si no es la tuya'

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-3 flex items-center gap-3">
      <Globe className="w-4 h-4 text-gray-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-700">Ver horarios en mi hora local</p>
        <p className="text-[10px] text-gray-400 truncate">{hint}</p>
      </div>
      <div className="w-44 shrink-0">
        <TimezoneSelector value={tz} onChange={onTzChange} size="sm" />
      </div>
    </div>
  )
}

// ── Vista de penalización ──
function PenaltyView({ penalty }: { penalty: ReturnType<typeof checkPenalty> }) {
  return (
    <div className="text-center py-6">
      <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
        <AlertTriangle className="w-7 h-7 text-red-600" />
      </div>
      <h2 className="text-lg font-bold text-gray-900 mb-2">Cuenta temporalmente suspendida</h2>
      <p className="text-sm text-gray-500 mb-4">{penalty.reason}</p>
      {penalty.canScheduleAfter && (
        <p className="text-sm text-gray-600">
          Podr&aacute; agendar nuevamente despu&eacute;s del{' '}
          <span className="font-semibold">
            {penalty.canScheduleAfter.toLocaleDateString('es-US', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </span>
        </p>
      )}
    </div>
  )
}

// ── Vista de cita agendada ──
function ScheduledView({
  appointment,
  zoomLink,
  token,
  tz,
  tzSource,
  onTzChange,
}: {
  appointment: Appointment
  zoomLink: string
  token: string
  tz: string
  tzSource: TzSource
  onTzChange: (next: string) => void
}) {
  const [cancelling, setCancelling] = useState(false)
  const [cancelled, setCancelled] = useState(false)

  const hoursUntil = (new Date(appointment.scheduled_at).getTime() - Date.now()) / (1000 * 60 * 60)
  const tzIsOffice = tz === OFFICE_TIMEZONE

  async function handleCancel() {
    if (!confirm(
      hoursUntil < 24
        ? 'Cancelar con menos de 24 horas de anticipación resultará en una penalización de 7 días. ¿Desea continuar?'
        : '¿Está seguro que desea cancelar su cita?'
    )) return

    setCancelling(true)
    try {
      const res = await fetch('/api/appointments/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, appointment_id: appointment.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Error al cancelar')
        return
      }
      toast.success(data.message)
      setCancelled(true)
    } catch {
      toast.error('Error de conexión')
    } finally {
      setCancelling(false)
    }
  }

  if (cancelled) {
    return (
      <div className="text-center py-6">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <X className="w-7 h-7 text-gray-400" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Cita cancelada</h2>
        <p className="text-sm text-gray-500">Recargue la p&aacute;gina para agendar una nueva cita.</p>
      </div>
    )
  }

  return (
    <div>
      <TzSelectorBlock tz={tz} tzSource={tzSource} onTzChange={onTzChange} />

      <div className="flex items-center gap-2 mb-4">
        <CheckCircle className="w-5 h-5 text-green-600" />
        <h2 className="text-lg font-bold text-gray-900">Cita Agendada</h2>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-green-700" />
          <span className="text-sm font-medium text-green-900">
            {formatDate(appointment.scheduled_at, tz)}
          </span>
        </div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <Clock className="w-4 h-4 text-green-700 shrink-0" />
          <span className="text-sm text-green-800">
            {formatTime(appointment.scheduled_at, tz)}{' '}
            <span className="text-xs text-green-700/70">({tzShortLabel(tz)})</span>
          </span>
          {!tzIsOffice && (
            <span className="text-xs text-green-700/60">
              · equivale a {formatTime(appointment.scheduled_at, OFFICE_TIMEZONE)} en Utah
            </span>
          )}
        </div>
        {zoomLink && (
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-green-700" />
            <a
              href={zoomLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline"
            >
              Unirse a la reunión por Zoom
            </a>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-gray-400">
          {hoursUntil < 24
            ? 'Cancelar ahora resultará en penalización de 7 días'
            : 'Puede cancelar hasta 24 horas antes sin penalización'}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCancel}
          disabled={cancelling}
          className="text-red-600 border-red-200 hover:bg-red-50"
        >
          {cancelling ? 'Cancelando...' : 'Cancelar cita'}
        </Button>
      </div>
    </div>
  )
}

// ── Vista de agendamiento ──
function BookingView({
  token,
  tz,
  tzSource,
  onTzChange,
}: {
  token: string
  tz: string
  tzSource: TzSource
  onTzChange: (next: string) => void
}) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>()
  const [slots, setSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [reminder1h, setReminder1h] = useState(false)
  const [reminder24h, setReminder24h] = useState(true)
  const [booking, setBooking] = useState(false)
  const [booked, setBooked] = useState(false)
  const [blocked, setBlocked] = useState(false)

  const tzIsOffice = tz === OFFICE_TIMEZONE

  async function handleDateSelect(date: Date | undefined) {
    setSelectedDate(date)
    setSelectedSlot(null)
    setBlocked(false)

    if (!date) {
      setSlots([])
      return
    }

    const dateStr = date.toISOString().split('T')[0]
    setLoadingSlots(true)

    try {
      const res = await fetch(`/api/appointments/available?token=${token}&date=${dateStr}`)
      const data = await res.json()

      if (data.blocked) {
        setBlocked(true)
        setSlots([])
      } else {
        setSlots(data.slots || [])
      }
    } catch {
      toast.error('Error al cargar horarios')
    } finally {
      setLoadingSlots(false)
    }
  }

  async function handleBook() {
    if (!selectedSlot) return

    setBooking(true)
    try {
      const res = await fetch('/api/appointments/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          scheduled_at: selectedSlot,
          reminder_1h: reminder1h,
          reminder_24h: reminder24h,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Error al agendar')
        return
      }

      toast.success('Cita agendada exitosamente')
      setBooked(true)
    } catch {
      toast.error('Error de conexión')
    } finally {
      setBooking(false)
    }
  }

  if (booked) {
    return (
      <div className="text-center py-6">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-7 h-7 text-green-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Cita agendada</h2>
        <p className="text-sm text-gray-500">Recargue la p&aacute;gina para ver los detalles de su cita.</p>
      </div>
    )
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div>
      <TzSelectorBlock tz={tz} tzSource={tzSource} onTzChange={onTzChange} />

      <div className="flex items-center gap-2 mb-4">
        <CalendarClock className="w-5 h-5 text-[#002855]" />
        <h2 className="text-lg font-bold text-gray-900">Agendar Cita</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Seleccione un d&iacute;a y horario disponible. Los horarios se muestran en tu hora local
        {tzIsOffice ? ' (Mountain Time)' : ` (${tzShortLabel(tz)}) — la hora de Utah aparece debajo`}.
      </p>

      {/* Calendario */}
      <div className="flex justify-center mb-6">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          disabled={{ before: today }}
        />
      </div>

      {/* Slots */}
      {selectedDate && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Horarios disponibles para el {selectedDate.toLocaleDateString('es-US', { day: 'numeric', month: 'long' })}:
          </h3>

          {loadingSlots ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-[#002855] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : blocked ? (
            <p className="text-sm text-red-600 text-center py-4">
              Este d&iacute;a no est&aacute; disponible para citas.
            </p>
          ) : slots.length === 0 ? (
            <div className="text-center py-4">
              <Badge className="bg-red-100 text-red-700 mb-2">Agenda Llena</Badge>
              <p className="text-sm text-gray-500">
                Todos los horarios de este d&iacute;a est&aacute;n ocupados. Seleccione otro d&iacute;a.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {slots.map(slot => {
                const isSelected = selectedSlot === slot
                return (
                  <button
                    key={slot}
                    onClick={() => setSelectedSlot(slot)}
                    className={`px-2 py-2 text-sm rounded-lg border transition-colors flex flex-col items-center ${
                      isSelected
                        ? 'bg-[#002855] text-white border-[#002855]'
                        : 'border-gray-200 hover:border-[#002855] hover:bg-[#002855]/5'
                    }`}
                  >
                    <span className="font-medium">{formatTime(slot, tz)}</span>
                    {!tzIsOffice && (
                      <span className={`text-[10px] mt-0.5 ${isSelected ? 'text-white/70' : 'text-gray-400'}`}>
                        {formatTime(slot, OFFICE_TIMEZONE)} MT
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Recordatorios */}
      {selectedSlot && (
        <div className="mb-6 space-y-3">
          <h3 className="text-sm font-medium text-gray-700">Recordatorios por email:</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={reminder24h}
              onChange={e => setReminder24h(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-600">Recordarme 1 d&iacute;a antes</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={reminder1h}
              onChange={e => setReminder1h(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-600">Recordarme 1 hora antes</span>
          </label>
        </div>
      )}

      {/* Confirmar */}
      {selectedSlot && (
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {formatDate(selectedSlot, tz)}
              </p>
              <p className="text-sm text-gray-500">
                {formatTime(selectedSlot, tz)}{' '}
                <span className="text-xs text-gray-400">({tzShortLabel(tz)})</span>
                {!tzIsOffice && (
                  <span className="text-xs text-gray-400">
                    {' '}· equivale a {formatTime(selectedSlot, OFFICE_TIMEZONE)} en Utah
                  </span>
                )}
              </p>
            </div>
            <Badge className="bg-[#002855]/10 text-[#002855]">Seleccionado</Badge>
          </div>

          {/* Aviso importante de penalización */}
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900">Aviso Importante</p>
              <p className="text-xs text-amber-700 mt-1">
                Si cancela esta cita, no podrá agendar una nueva hasta después de <span className="font-bold">7 días</span>. Por favor, asegúrese de que puede asistir antes de confirmar.
              </p>
            </div>
          </div>

          <Button
            className="w-full bg-[#002855] hover:bg-[#002855]/90"
            onClick={handleBook}
            disabled={booking}
          >
            {booking ? 'Agendando...' : 'Confirmar Cita'}
          </Button>
        </div>
      )}
    </div>
  )
}
