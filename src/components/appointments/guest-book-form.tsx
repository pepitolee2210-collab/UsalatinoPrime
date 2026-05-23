'use client'

import { useState } from 'react'
import { CalendarClock, Clock, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatTime, OFFICE_TIMEZONE, tzShortLabel } from '@/lib/timezones/format'

export interface GuestBookFormProps {
  bookEndpoint?: string
  slotsEndpoint?: string
  viewTimezone?: string
  onSuccess: () => void
}

const DARK_INPUT_CLS =
  'w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-colors focus:border-white/30 ' +
  'bg-white/[0.04] border border-white/10 text-white placeholder:text-white/30'

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-mono-tech)',
  fontSize: 9,
  fontWeight: 500,
  letterSpacing: '0.18em',
  color: '#A1A1A1',
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
    <div className="space-y-4 pt-2">
      <div className="space-y-1.5">
        <label style={LABEL_STYLE}>NOMBRE DEL VISITANTE</label>
        <input
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          placeholder="Ej: Eliana García"
          className={DARK_INPUT_CLS}
        />
      </div>

      <div className="space-y-1.5">
        <label style={LABEL_STYLE}>TELÉFONO (OPCIONAL)</label>
        <input
          value={guestPhone}
          onChange={(e) => setGuestPhone(e.target.value)}
          placeholder="+1 555 555 5555"
          className={DARK_INPUT_CLS}
        />
        <p style={{ fontSize: 10, color: '#525252', fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.05em', marginTop: 4 }}>
          ÚTIL PARA SEGUIMIENTO POR WHATSAPP.
        </p>
      </div>

      <div className="space-y-1.5">
        <label style={LABEL_STYLE}>FECHA</label>
        <input
          type="date"
          min={today}
          value={selectedDate}
          onChange={(e) => {
            setSelectedDate(e.target.value)
            if (e.target.value) loadSlots(e.target.value)
          }}
          className={DARK_INPUT_CLS}
          style={{ colorScheme: 'dark' }}
        />
      </div>

      {selectedDate && (
        <div className="space-y-1.5">
          <label style={LABEL_STYLE}>
            HORARIOS DISPONIBLES <span style={{ color: '#525252', fontSize: 9 }}>
              {userTzIsOffice ? '· MOUNTAIN TIME' : `· ${tzShortLabel(viewTimezone).toUpperCase()}`}
            </span>
          </label>
          {loadingSlots ? (
            <div className="flex items-center gap-2 py-3" style={{ fontSize: 12, color: '#A1A1A1' }}>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando horarios…
            </div>
          ) : blocked ? (
            <p style={{ fontSize: 12, color: '#FCA5A5', padding: '8px 0' }}>Esta fecha está bloqueada</p>
          ) : slots.length === 0 ? (
            <p style={{ fontSize: 12, color: '#525252', padding: '8px 0' }}>No hay horarios disponibles</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto admin-scroll pr-1">
              {slots.map((slot) => {
                const isActive = selectedSlot === slot
                return (
                  <button
                    key={slot}
                    onClick={() => setSelectedSlot(slot)}
                    className="flex flex-col items-center justify-center px-2 py-1.5 rounded-xl transition-all duration-200"
                    style={{
                      background: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.04)',
                      border: isActive ? '0.5px solid #FFFFFF' : '0.5px solid rgba(255,255,255,0.1)',
                      color: isActive ? '#000000' : '#FAFAFA',
                      boxShadow: isActive ? '0 0 12px rgba(255,255,255,0.18)' : 'none',
                    }}
                  >
                    <span className="inline-flex items-center gap-1" style={{ fontSize: 12, fontWeight: 700 }}>
                      <Clock className="w-3 h-3" />
                      {formatTime(slot, viewTimezone)}
                    </span>
                    {!userTzIsOffice && (
                      <span style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 9, marginTop: 1, color: isActive ? 'rgba(0,0,0,0.6)' : '#525252' }}>
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

      <div
        className="rounded-xl p-3"
        style={{
          background: 'rgba(250,204,21,0.06)',
          border: '0.5px solid rgba(250,204,21,0.2)',
        }}
      >
        <p style={{ fontSize: 12, fontWeight: 600, color: '#FDE68A' }}>Visita presencial / prospecto</p>
        <p style={{ fontSize: 11, color: '#A1A1A1', marginTop: 3, lineHeight: 1.5 }}>
          Esta cita bloqueará el horario para que ningún cliente lo reserve.
        </p>
      </div>

      <button
        disabled={!guestName.trim() || !selectedSlot || booking}
        onClick={handleBook}
        className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
        style={{
          background: '#FFFFFF',
          color: '#000000',
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '-0.005em',
          boxShadow: '0 4px 24px rgba(255,255,255,0.2), 0 0 0 0.5px rgba(255,255,255,0.5) inset',
        }}
      >
        {booking ? (
          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Agendando…</>
        ) : (
          <><CalendarClock className="w-3.5 h-3.5" /> Confirmar Visita</>
        )}
      </button>
    </div>
  )
}
