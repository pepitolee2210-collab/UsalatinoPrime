'use client'

import { useEffect, useRef, useState } from 'react'
import { CalendarClock, Clock, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatTime, OFFICE_TIMEZONE, tzShortLabel } from '@/lib/timezones/format'

export interface ActiveCase {
  id: string
  case_number: string
  client_id: string
  client?:
    | { first_name: string; last_name: string; phone?: string }
    | { first_name: string; last_name: string; phone?: string }[]
    | null
  service?: { name: string } | { name: string }[] | null
}

export interface ClientBookFormProps {
  activeCases: ActiveCase[]
  bookEndpoint?: string
  slotsEndpoint?: string
  viewTimezone?: string
  onSuccess: () => void
}

function resolveJoin<T>(val: unknown): T | null {
  if (Array.isArray(val)) return (val[0] as T) || null
  return (val as T) || null
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

export function ClientBookForm({
  activeCases,
  bookEndpoint = '/api/admin/appointments/book',
  slotsEndpoint = '/api/admin/appointments/available-slots',
  viewTimezone = OFFICE_TIMEZONE,
  onSuccess,
}: ClientBookFormProps) {
  const [selectedCaseId, setSelectedCaseId] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedSlot, setSelectedSlot] = useState('')
  const [slots, setSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [booking, setBooking] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dropdownOpen) return
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [dropdownOpen])

  const selectedCase = activeCases.find(c => c.id === selectedCaseId)

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
    if (!selectedCaseId || !selectedSlot) return
    const caseInfo = activeCases.find(c => c.id === selectedCaseId)
    if (!caseInfo) return

    setBooking(true)
    try {
      const res = await fetch(bookEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: selectedCaseId,
          client_id: caseInfo.client_id,
          scheduled_at: selectedSlot,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      toast.success('Cita agendada exitosamente')
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
        <label style={LABEL_STYLE}>CLIENTE / CASO</label>
        <div ref={dropdownRef} className="relative">
          {!selectedCaseId ? (
            <button
              type="button"
              onClick={() => setDropdownOpen(v => !v)}
              className="w-full h-10 px-3.5 rounded-xl flex items-center justify-between transition-colors hover:border-white/25"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '0.5px solid rgba(255,255,255,0.1)',
                color: '#525252',
                fontSize: 13,
              }}
            >
              <span>Seleccionar cliente…</span>
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" style={{ color: '#525252' }}>
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { setSelectedCaseId(''); setClientSearch(''); setDropdownOpen(true) }}
              className="w-full h-10 px-3.5 rounded-xl flex items-center justify-between"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '0.5px solid rgba(255,255,255,0.25)',
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {(() => {
                const c = activeCases.find(ac => ac.id === selectedCaseId)
                const client = c ? resolveJoin<{ first_name: string; last_name: string }>(c.client) : null
                return (
                  <span className="truncate">
                    {client?.first_name} {client?.last_name} · #{c?.case_number}
                  </span>
                )
              })()}
              <span style={{ color: '#A1A1A1', fontSize: 11, marginLeft: 8 }}>✕</span>
            </button>
          )}

          {dropdownOpen && !selectedCaseId && (
            <div
              className="absolute z-50 mt-2 w-full rounded-xl shadow-2xl admin-scroll"
              style={{
                background: 'linear-gradient(180deg, rgba(15,15,15,0.98), rgba(8,8,8,0.98))',
                border: '0.5px solid rgba(255,255,255,0.12)',
                backdropFilter: 'blur(20px)',
              }}
            >
              <div className="p-2" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
                <input
                  type="text"
                  value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)}
                  placeholder="Buscar por nombre, # caso o servicio…"
                  autoFocus
                  className="w-full h-8 px-2.5 rounded-lg outline-none transition-colors focus:border-white/30"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '0.5px solid rgba(255,255,255,0.1)',
                    color: '#FAFAFA',
                    fontSize: 12,
                  }}
                />
              </div>
              <div className="max-h-60 overflow-y-auto admin-scroll">
                {(() => {
                  const filtered = activeCases.filter(c => {
                    if (!clientSearch.trim()) return true
                    const client = resolveJoin<{ first_name: string; last_name: string }>(c.client)
                    const service = resolveJoin<{ name: string }>(c.service)
                    const q = clientSearch.toLowerCase()
                    return `${client?.first_name || ''} ${client?.last_name || ''}`.toLowerCase().includes(q) ||
                      c.case_number.toLowerCase().includes(q) ||
                      (service?.name || '').toLowerCase().includes(q)
                  })
                  if (filtered.length === 0) {
                    return (
                      <div className="p-3 text-center" style={{ fontSize: 11, color: '#525252', fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.1em' }}>
                        SIN RESULTADOS
                      </div>
                    )
                  }
                  return filtered.map((c, idx) => {
                    const client = resolveJoin<{ first_name: string; last_name: string }>(c.client)
                    const service = resolveJoin<{ name: string }>(c.service)
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setSelectedCaseId(c.id); setClientSearch(''); setDropdownOpen(false) }}
                        className="w-full text-left px-3.5 py-2.5 transition-colors hover:bg-white/5"
                        style={{
                          borderBottom: idx < filtered.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none',
                        }}
                      >
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#FFFFFF', letterSpacing: '-0.005em' }}>
                          {client?.first_name} {client?.last_name}
                        </p>
                        <p style={{ fontSize: 11, color: '#A1A1A1', marginTop: 2, fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.02em' }}>
                          #{c.case_number} · {service?.name || 'Sin servicio'}
                        </p>
                      </button>
                    )
                  })
                })()}
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedCase && (
        <div
          className="rounded-xl p-3"
          style={{
            background: 'rgba(96,165,250,0.06)',
            border: '0.5px solid rgba(96,165,250,0.2)',
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 600, color: '#FFFFFF', letterSpacing: '-0.005em' }}>
            {resolveJoin<{ first_name: string; last_name: string }>(selectedCase.client)?.first_name}{' '}
            {resolveJoin<{ first_name: string; last_name: string }>(selectedCase.client)?.last_name}
          </p>
          <p style={{ fontSize: 11, color: '#93C5FD', marginTop: 2, fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.02em' }}>
            CASO #{selectedCase.case_number} · {resolveJoin<{ name: string }>(selectedCase.service)?.name}
          </p>
          {resolveJoin<{ phone?: string }>(selectedCase.client)?.phone && (
            <p style={{ fontSize: 11, color: '#A1A1A1', marginTop: 2 }}>
              Tel: {resolveJoin<{ phone?: string }>(selectedCase.client)?.phone}
            </p>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <label style={LABEL_STYLE}>FECHA</label>
        <input
          type="date"
          min={today}
          value={selectedDate}
          onChange={e => {
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
            <p style={{ fontSize: 12, color: '#525252', padding: '8px 0' }}>No hay horarios disponibles para esta fecha</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto admin-scroll pr-1">
              {slots.map(slot => {
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

      <button
        disabled={!selectedCaseId || !selectedSlot || booking}
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
          <><CalendarClock className="w-3.5 h-3.5" /> Confirmar Cita</>
        )}
      </button>
    </div>
  )
}
