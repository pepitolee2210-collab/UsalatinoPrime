'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CalendarClock, Clock, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatTime, OFFICE_TIMEZONE, tzShortLabel } from '@/lib/timezones/format'

/**
 * Formulario para agendar una visita/cita a un no-cliente (prospecto sin
 * profile aún). Extraído de src/app/admin/citas/admin-citas-view.tsx
 * (`GuestBookForm`) para reuso entre admin y empleado.
 *
 * No requiere caso ni client_id; solo guarda `guest_name` y opcionalmente
 * `guest_phone` para identificación.
 */

export interface GuestBookFormProps {
  bookEndpoint?: string
  slotsEndpoint?: string
  viewTimezone?: string
  onSuccess: () => void
}

export function GuestBookForm({
  bookEndpoint = '/api/admin/appointments/book',
  slotsEndpoint = '/api/admin/appointments/available-slots',
  viewTimezone = OFFICE_TIMEZONE,
  onSuccess,
}: GuestBookFormProps) {
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedSlot, setSelectedSlot] = useState('')
  const [slots, setSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [booking, setBooking] = useState(false)

  async function loadSlots(date: string) {
    setSelectedSlot('')
    setBlocked(false)
    setLoadingSlots(true)
    try {
      const res = await fetch(`${slotsEndpoint}?date=${date}`)
      const data = await res.json()
      if (data.blocked) {
        setBlocked(true)
        setSlots([])
      } else {
        setSlots(data.slots || [])
      }
    } catch {
      toast.error('Error al cargar horarios')
      setSlots([])
    } finally {
      setLoadingSlots(false)
    }
  }

  async function handleBook() {
    if (!guestName.trim() || !selectedSlot) return
    setBooking(true)
    try {
      const res = await fetch(bookEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_name: guestName.trim(),
          guest_phone: guestPhone.trim() || null,
          scheduled_at: selectedSlot,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      toast.success(`Visita de ${guestName} agendada`)
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al agendar')
    } finally {
      setBooking(false)
    }
  }

  const today = new Date().toISOString().split('T')[0]
  const userTzIsOffice = viewTimezone === OFFICE_TIMEZONE

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Nombre del visitante</Label>
        <Input
          value={guestName}
          onChange={e => setGuestName(e.target.value)}
          placeholder="Ej: Eliana García"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Teléfono (opcional)</Label>
        <Input
          value={guestPhone}
          onChange={e => setGuestPhone(e.target.value)}
          placeholder="+1 555 555 5555"
        />
        <p className="text-[11px] text-gray-400">
          Útil si después necesitas darle seguimiento por WhatsApp.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Fecha</Label>
        <Input
          type="date"
          min={today}
          value={selectedDate}
          onChange={e => {
            setSelectedDate(e.target.value)
            if (e.target.value) loadSlots(e.target.value)
          }}
        />
      </div>

      {selectedDate && (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">
            Horarios disponibles{' '}
            <span className="text-xs font-normal text-gray-400">
              ({userTzIsOffice
                ? 'Mountain Time'
                : `tu hora · ${tzShortLabel(viewTimezone)}`})
            </span>
          </Label>
          {loadingSlots ? (
            <div className="flex items-center gap-2 py-3 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando horarios...
            </div>
          ) : blocked ? (
            <p className="text-sm text-red-600 py-2">Esta fecha está bloqueada</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">No hay horarios disponibles</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {slots.map(slot => (
                <Button
                  key={slot}
                  variant={selectedSlot === slot ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedSlot(slot)}
                  className={`flex-col h-auto py-1.5 ${selectedSlot === slot ? 'bg-[#002855]' : ''}`}
                >
                  <span className="flex items-center gap-1 text-sm">
                    <Clock className="w-3 h-3" />
                    {formatTime(slot, viewTimezone)}
                  </span>
                  {!userTzIsOffice && (
                    <span className={`text-[10px] mt-0.5 ${selectedSlot === slot ? 'text-white/80' : 'text-gray-400'}`}>
                      {formatTime(slot, OFFICE_TIMEZONE)} MT
                    </span>
                  )}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-amber-50 rounded-lg p-3 text-sm text-amber-700">
        <p className="font-medium">Visita presencial / prospecto</p>
        <p className="text-xs text-amber-600 mt-0.5">
          Esta cita bloqueará el horario para que ningún cliente lo reserve.
        </p>
      </div>

      <Button
        className="w-full bg-[#002855] hover:bg-[#003570]"
        disabled={!guestName.trim() || !selectedSlot || booking}
        onClick={handleBook}
      >
        {booking ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Agendando...</>
        ) : (
          <><CalendarClock className="w-4 h-4 mr-2" /> Confirmar Visita</>
        )}
      </Button>
    </div>
  )
}
