'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  CalendarClock, Clock, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatTime, OFFICE_TIMEZONE, tzShortLabel } from '@/lib/timezones/format'

/**
 * Formulario unificado para que admin/empleado agende una cita a un
 * cliente existente con caso. Antes vivía duplicado en
 * src/app/admin/citas/admin-citas-view.tsx (`AdminBookForm`). Ahora es
 * reusable desde el panel de Henry y el de empleados (Vanessa/Andrium),
 * solo cambiando el endpoint.
 *
 * Mantiene el comportamiento de antes (Mountain Time es el horario de la
 * oficina) pero agrega badge con la TZ del usuario que está agendando,
 * para que Vanessa no tenga que convertir mentalmente.
 */

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
  /** Endpoint POST que crea la cita. Default: admin. */
  bookEndpoint?: string
  /** Endpoint GET de slots para una fecha (YYYY-MM-DD). Default: admin. */
  slotsEndpoint?: string
  /** TZ con la que se muestran los horarios al operador. */
  viewTimezone?: string
  onSuccess: () => void
}

function resolveJoin<T>(val: unknown): T | null {
  if (Array.isArray(val)) return (val[0] as T) || null
  return (val as T) || null
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
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Cliente / Caso</Label>
        <div ref={dropdownRef} className="relative">
          {!selectedCaseId ? (
            <button
              type="button"
              onClick={() => setDropdownOpen(v => !v)}
              className="w-full h-10 px-3 rounded-md border border-gray-200 text-sm flex items-center justify-between bg-white hover:border-[#F2A900] focus:outline-none focus:ring-2 focus:ring-[#F2A900]/40 focus:border-[#F2A900]"
            >
              <span className="text-gray-400">Seleccionar cliente...</span>
              <svg className="w-4 h-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { setSelectedCaseId(''); setClientSearch(''); setDropdownOpen(true) }}
              className="w-full h-10 px-3 rounded-md border border-[#F2A900] bg-amber-50 text-sm flex items-center justify-between"
            >
              {(() => {
                const c = activeCases.find(ac => ac.id === selectedCaseId)
                const client = c ? resolveJoin<{ first_name: string; last_name: string }>(c.client) : null
                return (
                  <span className="text-gray-900 font-medium truncate">
                    {client?.first_name} {client?.last_name} — #{c?.case_number}
                  </span>
                )
              })()}
              <span className="text-gray-400 hover:text-gray-600 text-xs ml-2">✕</span>
            </button>
          )}

          {dropdownOpen && !selectedCaseId && (
            <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg">
              <div className="p-2 border-b border-gray-100">
                <input
                  type="text"
                  value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)}
                  placeholder="Buscar por nombre, # caso o servicio..."
                  autoFocus
                  className="w-full h-8 px-2 rounded border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#F2A900]/40"
                />
              </div>
              <div className="max-h-60 overflow-y-auto">
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
                  if (filtered.length === 0) return <div className="p-3 text-xs text-gray-400 text-center">Sin resultados</div>
                  return filtered.map(c => {
                    const client = resolveJoin<{ first_name: string; last_name: string }>(c.client)
                    const service = resolveJoin<{ name: string }>(c.service)
                    return (
                      <button key={c.id} type="button"
                        onClick={() => { setSelectedCaseId(c.id); setClientSearch(''); setDropdownOpen(false) }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50 transition-colors border-b border-gray-100 last:border-b-0">
                        <p className="font-medium text-gray-900">{client?.first_name} {client?.last_name}</p>
                        <p className="text-xs text-gray-500">#{c.case_number} — {service?.name || 'Sin servicio'}</p>
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
        <div className="bg-blue-50 rounded-lg p-3">
          <p className="text-sm font-medium text-[#002855]">
            {resolveJoin<{ first_name: string; last_name: string }>(selectedCase.client)?.first_name}{' '}
            {resolveJoin<{ first_name: string; last_name: string }>(selectedCase.client)?.last_name}
          </p>
          <p className="text-xs text-gray-500">
            Caso #{selectedCase.case_number} — {resolveJoin<{ name: string }>(selectedCase.service)?.name}
          </p>
          {resolveJoin<{ phone?: string }>(selectedCase.client)?.phone && (
            <p className="text-xs text-gray-500">Tel: {resolveJoin<{ phone?: string }>(selectedCase.client)?.phone}</p>
          )}
        </div>
      )}

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
            <p className="text-sm text-gray-500 py-2">No hay horarios disponibles para esta fecha</p>
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

      <Button
        className="w-full bg-[#002855] hover:bg-[#003570]"
        disabled={!selectedCaseId || !selectedSlot || booking}
        onClick={handleBook}
      >
        {booking ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Agendando...</>
        ) : (
          <><CalendarClock className="w-4 h-4 mr-2" /> Confirmar Cita</>
        )}
      </Button>
    </div>
  )
}
