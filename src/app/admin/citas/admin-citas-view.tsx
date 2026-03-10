'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  CalendarClock, Settings, ChevronDown, ChevronUp,
  CheckCircle, XCircle, AlertTriangle, Trash2, Plus, RefreshCw, UserPlus, Loader2, Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatToMT, formatDateMT } from '@/lib/appointments/slots'
import type { SchedulingConfig, SchedulingSettings, BlockedDate, TimeBlock } from '@/types/database'

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
  no_show: 'bg-red-100 text-red-800',
}

const statusLabels: Record<string, string> = {
  scheduled: 'Agendada',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No se presentó',
}

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

interface ActiveCase {
  id: string
  case_number: string
  client_id: string
  client?: { first_name: string; last_name: string; phone?: string } | { first_name: string; last_name: string; phone?: string }[] | null
  service?: { name: string } | { name: string }[] | null
}

interface AdminCitasViewProps {
  appointments: Array<{
    id: string
    scheduled_at: string
    status: string
    duration_minutes: number
    notes?: string
    cancelled_at?: string
    cancellation_reason?: string
    penalty_waived?: boolean
    client?: { first_name: string; last_name: string; email: string; phone?: string } | null
    case?: { case_number: string; service?: { name: string } | null } | null
  }>
  config: SchedulingConfig[]
  settings: SchedulingSettings | null
  blockedDates: BlockedDate[]
  activeCases: ActiveCase[]
}

export function AdminCitasView({ appointments, config, settings, blockedDates, activeCases }: AdminCitasViewProps) {
  const [filter, setFilter] = useState<string>('all')
  const [showConfig, setShowConfig] = useState(false)
  const [bookDialogOpen, setBookDialogOpen] = useState(false)

  const filtered = filter === 'all'
    ? appointments
    : appointments.filter(a => a.status === filter)

  return (
    <div className="space-y-6">
      {/* Filtros + Boton agendar */}
      <div className="flex flex-wrap items-center gap-2">
        {['all', 'scheduled', 'completed', 'cancelled', 'no_show'].map(s => (
          <Button
            key={s}
            variant={filter === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(s)}
            className={filter === s ? 'bg-[#002855]' : ''}
          >
            {s === 'all' ? 'Todas' : statusLabels[s]}
          </Button>
        ))}
        <div className="ml-auto">
          <Dialog open={bookDialogOpen} onOpenChange={setBookDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#002855] hover:bg-[#003570]">
                <UserPlus className="w-4 h-4 mr-2" />
                Agendar para Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Agendar Cita para Cliente</DialogTitle>
              </DialogHeader>
              <AdminBookForm
                activeCases={activeCases}
                onSuccess={() => { setBookDialogOpen(false); window.location.reload() }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabla de citas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5" />
            Citas ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha / Hora</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Caso / Servicio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    No hay citas para este filtro
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(apt => (
                  <AppointmentRow key={apt.id} appointment={apt} />
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Toggle configuración */}
      <Button
        variant="outline"
        onClick={() => setShowConfig(!showConfig)}
        className="w-full"
      >
        <Settings className="w-4 h-4 mr-2" />
        Configuración de Horarios
        {showConfig ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
      </Button>

      {showConfig && (
        <div className="space-y-6">
          <ScheduleConfigPanel config={config} settings={settings} />
          <BlockedDatesPanel blockedDates={blockedDates} />
        </div>
      )}
    </div>
  )
}

// ── Fila de cita ──
function AppointmentRow({ appointment }: { appointment: AdminCitasViewProps['appointments'][0] }) {
  const [updating, setUpdating] = useState(false)
  const [waiving, setWaiving] = useState(false)

  const clientRaw = appointment.client as unknown
  const client = Array.isArray(clientRaw)
    ? (clientRaw[0] as { first_name: string; last_name: string } | undefined)
    : (clientRaw as { first_name: string; last_name: string } | null)

  const caseRaw = appointment.case as unknown
  const caseInfo = Array.isArray(caseRaw)
    ? (caseRaw[0] as { case_number: string; service?: { name: string } | null } | undefined)
    : (caseRaw as { case_number: string; service?: { name: string } | null } | null)

  const serviceRaw = caseInfo?.service as unknown
  const service = Array.isArray(serviceRaw)
    ? (serviceRaw[0] as { name: string } | undefined)
    : (serviceRaw as { name: string } | null)

  async function updateStatus(status: string) {
    setUpdating(true)
    try {
      const res = await fetch('/api/admin/appointments/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_id: appointment.id, status }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Error')
        return
      }
      toast.success(`Cita marcada como ${statusLabels[status]}`)
      window.location.reload()
    } catch {
      toast.error('Error de conexión')
    } finally {
      setUpdating(false)
    }
  }

  async function handleWaivePenalty() {
    setWaiving(true)
    try {
      const res = await fetch('/api/admin/appointments/waive-penalty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_id: appointment.id }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Error')
        return
      }
      toast.success('Penalizacion levantada. El cliente puede reagendar.')
      window.location.reload()
    } catch {
      toast.error('Error de conexion')
    } finally {
      setWaiving(false)
    }
  }

  return (
    <TableRow>
      <TableCell>
        <div>
          <p className="text-sm font-medium">{formatDateMT(appointment.scheduled_at)}</p>
          <p className="text-xs text-gray-500">{formatToMT(appointment.scheduled_at)} MT</p>
        </div>
      </TableCell>
      <TableCell>
        <p className="text-sm font-medium">
          {client?.first_name} {client?.last_name}
        </p>
      </TableCell>
      <TableCell>
        <p className="text-sm">#{caseInfo?.case_number}</p>
        <p className="text-xs text-gray-500">{service?.name || '—'}</p>
      </TableCell>
      <TableCell>
        <Badge className={statusColors[appointment.status] || ''}>
          {statusLabels[appointment.status] || appointment.status}
        </Badge>
      </TableCell>
      <TableCell>
        {appointment.status === 'scheduled' && (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateStatus('completed')}
              disabled={updating}
              className="text-green-600 border-green-200 hover:bg-green-50"
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              Completada
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateStatus('no_show')}
              disabled={updating}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              <XCircle className="w-3 h-3 mr-1" />
              No Show
            </Button>
          </div>
        )}
        {(appointment.status === 'cancelled' || appointment.status === 'no_show') && (
          <div className="space-y-1">
            {appointment.cancellation_reason && (
              <p className="text-[11px] text-gray-500 italic">{appointment.cancellation_reason}</p>
            )}
            {appointment.penalty_waived ? (
              <Badge className="bg-green-100 text-green-700 text-[10px]">Reagendamiento habilitado</Badge>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleWaivePenalty()}
                disabled={waiving}
                className="text-amber-700 border-amber-200 hover:bg-amber-50"
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${waiving ? 'animate-spin' : ''}`} />
                Permitir Reagendar
              </Button>
            )}
          </div>
        )}
      </TableCell>
    </TableRow>
  )
}

// ── Formulario para agendar cita desde admin ──
function AdminBookForm({ activeCases, onSuccess }: { activeCases: ActiveCase[]; onSuccess: () => void }) {
  const [selectedCaseId, setSelectedCaseId] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedSlot, setSelectedSlot] = useState('')
  const [slots, setSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [booking, setBooking] = useState(false)

  const selectedCase = activeCases.find(c => c.id === selectedCaseId)

  // Resolver joins que pueden venir como array
  function resolveJoin<T>(val: unknown): T | null {
    if (Array.isArray(val)) return (val[0] as T) || null
    return (val as T) || null
  }

  async function loadSlots(date: string) {
    setSelectedSlot('')
    setBlocked(false)
    setLoadingSlots(true)
    try {
      const res = await fetch(`/api/admin/appointments/available-slots?date=${date}`)
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
      const res = await fetch('/api/admin/appointments/book', {
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

  return (
    <div className="space-y-4">
      {/* Selector de cliente/caso */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Cliente / Caso</Label>
        <Select value={selectedCaseId} onValueChange={setSelectedCaseId}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar cliente..." />
          </SelectTrigger>
          <SelectContent>
            {activeCases.map(c => {
              const client = resolveJoin<{ first_name: string; last_name: string; phone?: string }>(c.client)
              const service = resolveJoin<{ name: string }>(c.service)
              return (
                <SelectItem key={c.id} value={c.id}>
                  {client?.first_name} {client?.last_name} — #{c.case_number} ({service?.name || 'Sin servicio'})
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Info del cliente seleccionado */}
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

      {/* Selector de fecha */}
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

      {/* Horarios disponibles */}
      {selectedDate && (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Horario disponible (Mountain Time)</Label>
          {loadingSlots ? (
            <div className="flex items-center gap-2 py-3 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando horarios...
            </div>
          ) : blocked ? (
            <p className="text-sm text-red-600 py-2">Esta fecha esta bloqueada</p>
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
                  className={selectedSlot === slot ? 'bg-[#002855]' : ''}
                >
                  <Clock className="w-3 h-3 mr-1" />
                  {formatToMT(slot)}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Boton confirmar */}
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

// ── Panel de configuración de horarios ──
function formatHour(h: number): string {
  if (h === 0) return '12 AM'
  if (h < 12) return `${h} AM`
  if (h === 12) return '12 PM'
  return `${h - 12} PM`
}

function ScheduleConfigPanel({
  config: initialConfig,
  settings: initialSettings,
}: {
  config: SchedulingConfig[]
  settings: SchedulingSettings | null
}) {
  const [config, setConfig] = useState(() =>
    initialConfig.map(c => ({
      ...c,
      time_blocks: c.time_blocks && c.time_blocks.length > 0
        ? c.time_blocks
        : c.is_available ? [{ start_hour: c.start_hour, end_hour: c.end_hour }] : [],
    }))
  )
  const [zoomLink, setZoomLink] = useState(initialSettings?.zoom_link || '')
  const [slotDuration, setSlotDuration] = useState(initialSettings?.slot_duration_minutes || 60)
  const [saving, setSaving] = useState(false)

  function toggleDay(dayOfWeek: number, enabled: boolean) {
    setConfig(prev =>
      prev.map(c =>
        c.day_of_week === dayOfWeek
          ? {
              ...c,
              is_available: enabled,
              time_blocks: enabled && c.time_blocks.length === 0
                ? [{ start_hour: 9, end_hour: 17 }]
                : c.time_blocks,
            }
          : c
      )
    )
  }

  function updateBlock(dayOfWeek: number, blockIndex: number, field: 'start_hour' | 'end_hour', value: number) {
    setConfig(prev =>
      prev.map(c => {
        if (c.day_of_week !== dayOfWeek) return c
        const blocks = [...c.time_blocks]
        blocks[blockIndex] = { ...blocks[blockIndex], [field]: value }
        return { ...c, time_blocks: blocks }
      })
    )
  }

  function addBlock(dayOfWeek: number) {
    setConfig(prev =>
      prev.map(c => {
        if (c.day_of_week !== dayOfWeek) return c
        const lastBlock = c.time_blocks[c.time_blocks.length - 1]
        const newStart = lastBlock ? lastBlock.end_hour + 1 : 9
        return {
          ...c,
          time_blocks: [...c.time_blocks, { start_hour: Math.min(newStart, 22), end_hour: Math.min(newStart + 3, 23) }],
        }
      })
    )
  }

  function removeBlock(dayOfWeek: number, blockIndex: number) {
    setConfig(prev =>
      prev.map(c => {
        if (c.day_of_week !== dayOfWeek) return c
        const blocks = c.time_blocks.filter((_, i) => i !== blockIndex)
        return { ...c, time_blocks: blocks, is_available: blocks.length > 0 }
      })
    )
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/appointments/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: config.map(c => ({
            day_of_week: c.day_of_week,
            start_hour: c.start_hour,
            end_hour: c.end_hour,
            is_available: c.is_available,
            time_blocks: c.time_blocks,
          })),
          settings: {
            id: initialSettings?.id,
            zoom_link: zoomLink,
            slot_duration_minutes: slotDuration,
          },
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Configuracion guardada')
    } catch {
      toast.error('Error al guardar configuracion')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Horarios por Dia</CardTitle>
        <p className="text-xs text-gray-500">Puede agregar multiples bloques horarios por dia (ej: manana y tarde)</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {config.map(day => (
          <div key={day.day_of_week} className="border rounded-lg p-3">
            <div className="flex items-center gap-3 mb-2">
              <Switch
                checked={day.is_available}
                onCheckedChange={v => toggleDay(day.day_of_week, v)}
              />
              <span className={`text-sm font-medium ${day.is_available ? 'text-gray-900' : 'text-gray-400'}`}>
                {DAY_NAMES[day.day_of_week]}
              </span>
              {day.is_available && (
                <span className="text-xs text-gray-400">
                  {day.time_blocks.map(b => `${formatHour(b.start_hour)}-${formatHour(b.end_hour)}`).join(' | ')}
                </span>
              )}
            </div>
            {day.is_available && (
              <div className="ml-10 space-y-2">
                {day.time_blocks.map((block, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-16">Bloque {idx + 1}</span>
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      value={block.start_hour}
                      onChange={e => updateBlock(day.day_of_week, idx, 'start_hour', Number(e.target.value))}
                      className="w-16 text-center h-8 text-sm"
                    />
                    <span className="text-xs text-gray-500">a</span>
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      value={block.end_hour}
                      onChange={e => updateBlock(day.day_of_week, idx, 'end_hour', Number(e.target.value))}
                      className="w-16 text-center h-8 text-sm"
                    />
                    <span className="text-xs text-gray-400">hrs</span>
                    {day.time_blocks.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                        onClick={() => removeBlock(day.day_of_week, idx)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-blue-600 hover:text-blue-800 h-7"
                  onClick={() => addBlock(day.day_of_week)}
                >
                  <Plus className="w-3 h-3 mr-1" /> Agregar bloque
                </Button>
              </div>
            )}
          </div>
        ))}

        <div className="border-t pt-4 space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700">Zoom Link</label>
            <Input
              value={zoomLink}
              onChange={e => setZoomLink(e.target.value)}
              placeholder="https://zoom.us/j/..."
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Duracion de slot (minutos)</label>
            <Input
              type="number"
              min={15}
              max={180}
              value={slotDuration}
              onChange={e => setSlotDuration(Number(e.target.value))}
              className="mt-1 w-24"
            />
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="bg-[#002855]">
          {saving ? 'Guardando...' : 'Guardar Configuracion'}
        </Button>
      </CardContent>
    </Card>
  )
}

// ── Panel de días bloqueados ──
function BlockedDatesPanel({ blockedDates: initial }: { blockedDates: BlockedDate[] }) {
  const [dates, setDates] = useState(initial)
  const [newDate, setNewDate] = useState('')
  const [newReason, setNewReason] = useState('')
  const [adding, setAdding] = useState(false)

  async function handleAdd() {
    if (!newDate) return
    setAdding(true)
    try {
      const res = await fetch('/api/admin/appointments/blocked-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked_date: newDate, reason: newReason }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Error')
        return
      }
      setDates(prev => [...prev, data.blocked_date])
      setNewDate('')
      setNewReason('')
      toast.success('Fecha bloqueada')
    } catch {
      toast.error('Error de conexión')
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/admin/appointments/blocked-dates?id=${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        toast.error('Error al eliminar')
        return
      }
      setDates(prev => prev.filter(d => d.id !== id))
      toast.success('Fecha desbloqueada')
    } catch {
      toast.error('Error de conexión')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="w-4 h-4" />
          Días Bloqueados
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Agregar nuevo */}
        <div className="flex gap-2 flex-wrap">
          <Input
            type="date"
            value={newDate}
            onChange={e => setNewDate(e.target.value)}
            className="w-40"
          />
          <Input
            value={newReason}
            onChange={e => setNewReason(e.target.value)}
            placeholder="Razón (opcional)"
            className="flex-1 min-w-[150px]"
          />
          <Button
            onClick={handleAdd}
            disabled={adding || !newDate}
            size="sm"
            className="bg-[#002855]"
          >
            <Plus className="w-4 h-4 mr-1" />
            Bloquear
          </Button>
        </div>

        {/* Lista */}
        {dates.length === 0 ? (
          <p className="text-sm text-gray-500">No hay días bloqueados</p>
        ) : (
          <div className="space-y-2">
            {dates.map(d => (
              <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <div>
                  <p className="text-sm font-medium">
                    {new Date(d.blocked_date + 'T12:00:00').toLocaleDateString('es-US', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                  {d.reason && <p className="text-xs text-gray-500">{d.reason}</p>}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(d.id)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
