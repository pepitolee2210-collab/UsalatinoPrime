'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, CalendarDays, Plus, Trash2, Clock, Info, X } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface TimeBlock {
  start_hour: number
  end_hour: number
}

interface AvailabilityRow {
  day_of_week: number
  time_blocks: TimeBlock[]
  is_available: boolean
}

interface BlockRow {
  id: string
  blocked_at_start: string
  blocked_at_end: string
  reason: string | null
}

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

// Bloque por defecto cuando se activa un día (1 bloque 9-18)
const defaultBlocks = (): TimeBlock[] => [{ start_hour: 9, end_hour: 18 }]

const DEFAULT_WEEK: AvailabilityRow[] = Array.from({ length: 7 }).map((_, day) => ({
  day_of_week: day,
  time_blocks: day === 0 || day === 6 ? [] : defaultBlocks(),
  is_available: day !== 0 && day !== 6,
}))

export function AgendaClient() {
  const [availability, setAvailability] = useState<AvailabilityRow[]>(DEFAULT_WEEK)
  const [blocks, setBlocks] = useState<BlockRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showBlockForm, setShowBlockForm] = useState(false)
  const [blockStart, setBlockStart] = useState('')
  const [blockEnd, setBlockEnd] = useState('')
  const [blockReason, setBlockReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/consultant/availability')
      if (!res.ok) throw new Error()
      const data = await res.json()

      type RawRow = { day_of_week: number; start_hour: number; end_hour: number; time_blocks?: TimeBlock[] | null }
      const rawList = (data.availability as RawRow[]) || []

      const mapped: AvailabilityRow[] = DEFAULT_WEEK.map(def => {
        const existing = rawList.find(a => a.day_of_week === def.day_of_week)
        if (!existing) return { ...def, is_available: false, time_blocks: [] }
        const blocks = (existing.time_blocks && existing.time_blocks.length > 0)
          ? existing.time_blocks
          : [{ start_hour: existing.start_hour, end_hour: existing.end_hour }]
        return {
          day_of_week: def.day_of_week,
          is_available: true,
          time_blocks: blocks,
        }
      })
      setAvailability(mapped)
      setBlocks(data.blocks || [])
    } catch {
      toast.error('Error al cargar agenda')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function toggleDay(idx: number, available: boolean) {
    setAvailability(prev => prev.map((row, i) => {
      if (i !== idx) return row
      return {
        ...row,
        is_available: available,
        time_blocks: available
          ? (row.time_blocks.length > 0 ? row.time_blocks : defaultBlocks())
          : [],
      }
    }))
  }

  function updateBlock(dayIdx: number, blockIdx: number, patch: Partial<TimeBlock>) {
    setAvailability(prev => prev.map((row, i) => {
      if (i !== dayIdx) return row
      return {
        ...row,
        time_blocks: row.time_blocks.map((b, j) => j === blockIdx ? { ...b, ...patch } : b),
      }
    }))
  }

  function addBlockToDay(dayIdx: number) {
    setAvailability(prev => prev.map((row, i) => {
      if (i !== dayIdx) return row
      // Sugerir un bloque que empiece después del último (máx 22-23)
      const last = row.time_blocks[row.time_blocks.length - 1]
      const nextStart = last ? Math.min(last.end_hour + 1, 22) : 9
      const nextEnd = Math.min(nextStart + 3, 23)
      return {
        ...row,
        time_blocks: [...row.time_blocks, { start_hour: nextStart, end_hour: nextEnd }],
      }
    }))
  }

  function removeBlockFromDay(dayIdx: number, blockIdx: number) {
    setAvailability(prev => prev.map((row, i) => {
      if (i !== dayIdx) return row
      const newBlocks = row.time_blocks.filter((_, j) => j !== blockIdx)
      // Si era el único bloque, desactivamos el día
      if (newBlocks.length === 0) {
        return { ...row, time_blocks: [], is_available: false }
      }
      return { ...row, time_blocks: newBlocks }
    }))
  }

  async function saveAvailability() {
    setSaving(true)
    try {
      const res = await fetch('/api/consultant/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availability }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Error')
      }
      toast.success('Horario guardado')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function addPunctualBlock() {
    if (!blockStart || !blockEnd) return toast.error('Fechas requeridas')
    try {
      const res = await fetch('/api/consultant/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blocked_at_start: new Date(blockStart).toISOString(),
          blocked_at_end: new Date(blockEnd).toISOString(),
          reason: blockReason,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Bloqueo añadido')
      setShowBlockForm(false)
      setBlockStart(''); setBlockEnd(''); setBlockReason('')
      await load()
    } catch {
      toast.error('Error al crear bloqueo')
    }
  }

  async function deletePunctualBlock(id: string) {
    if (!confirm('¿Eliminar este bloqueo?')) return
    try {
      const res = await fetch(`/api/consultant/blocks?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Bloqueo eliminado')
      await load()
    } catch {
      toast.error('Error al eliminar')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CalendarDays className="w-6 h-6 text-blue-600" />
          Mi Agenda
        </h1>
        <p className="text-sm text-gray-500">
          Define los horarios en que estás disponible para las evaluaciones gratuitas. La IA de voz usará estos horarios para proponer slots a los prospectos.
        </p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Horario semanal</h2>
            <Button size="sm" onClick={saveAvailability} disabled={saving}>
              {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Guardando…</> : 'Guardar'}
            </Button>
          </div>

          <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 flex gap-2">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900 leading-relaxed">
              <p className="font-semibold mb-0.5">Mountain Time (Utah · El Salvador)</p>
              <p className="text-blue-800">
                Las horas se interpretan en horario de las Montañas (UTC-7 / UTC-6 en horario de verano), igual que Utah y El Salvador. Puedes definir varios bloques por día, por ejemplo: 9 a 12, 15 a 18, y 20 a 21.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {availability.map((row, dayIdx) => (
              <DayRow
                key={dayIdx}
                row={row}
                dayIdx={dayIdx}
                onToggleDay={toggleDay}
                onUpdateBlock={updateBlock}
                onAddBlock={addBlockToDay}
                onRemoveBlock={removeBlockFromDay}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Bloqueos puntuales</h2>
              <p className="text-xs text-gray-500">Vacaciones, reuniones, almuerzos largos, etc.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowBlockForm(s => !s)}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              Añadir bloqueo
            </Button>
          </div>

          {showBlockForm && (
            <div className="rounded-lg border border-gray-200 p-4 space-y-3 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-gray-500 font-medium block mb-1">Desde</span>
                  <input
                    type="datetime-local"
                    value={blockStart}
                    onChange={(e) => setBlockStart(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-gray-500 font-medium block mb-1">Hasta</span>
                  <input
                    type="datetime-local"
                    value={blockEnd}
                    onChange={(e) => setBlockEnd(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs text-gray-500 font-medium block mb-1">Motivo (opcional)</span>
                <input
                  type="text"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="ej: vacaciones, reunión"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => setShowBlockForm(false)}>Cancelar</Button>
                <Button size="sm" onClick={addPunctualBlock}>Añadir</Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {blocks.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Sin bloqueos activos</p>
            ) : (
              blocks.map(b => (
                <div key={b.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        {format(new Date(b.blocked_at_start), "d MMM HH:mm", { locale: es })} →{' '}
                        {format(new Date(b.blocked_at_end), "d MMM HH:mm", { locale: es })}
                      </p>
                      {b.reason && <p className="text-xs text-gray-500">{b.reason}</p>}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => deletePunctualBlock(b.id)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────
// Fila por día con N bloques editables
// ──────────────────────────────────────────────────────────────────
function DayRow({
  row, dayIdx, onToggleDay, onUpdateBlock, onAddBlock, onRemoveBlock,
}: {
  row: AvailabilityRow
  dayIdx: number
  onToggleDay: (idx: number, on: boolean) => void
  onUpdateBlock: (dayIdx: number, blockIdx: number, patch: Partial<TimeBlock>) => void
  onAddBlock: (dayIdx: number) => void
  onRemoveBlock: (dayIdx: number, blockIdx: number) => void
}) {
  return (
    <div className="rounded-lg border border-gray-100 px-3 py-2.5">
      <div className="flex items-start gap-3">
        <label className="flex items-center gap-2 w-32 text-sm flex-shrink-0 pt-1.5">
          <input
            type="checkbox"
            checked={row.is_available}
            onChange={(e) => onToggleDay(dayIdx, e.target.checked)}
            className="w-4 h-4"
          />
          <span className="font-medium text-gray-700">{DAYS[row.day_of_week]}</span>
        </label>

        {!row.is_available ? (
          <span className="text-sm text-gray-400 flex-1 pt-1.5">No disponible</span>
        ) : (
          <div className="flex-1 space-y-1.5">
            {row.time_blocks.map((block, blockIdx) => (
              <div key={blockIdx} className="flex items-center gap-2">
                <select
                  value={block.start_hour}
                  onChange={(e) => onUpdateBlock(dayIdx, blockIdx, { start_hour: Number(e.target.value) })}
                  className="rounded-md border border-gray-200 px-2 py-1 text-sm"
                >
                  {Array.from({ length: 24 }).map((_, h) => (
                    <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>
                  ))}
                </select>
                <span className="text-sm text-gray-400">a</span>
                <select
                  value={block.end_hour}
                  onChange={(e) => onUpdateBlock(dayIdx, blockIdx, { end_hour: Number(e.target.value) })}
                  className="rounded-md border border-gray-200 px-2 py-1 text-sm"
                >
                  {Array.from({ length: 24 }).map((_, h) => (
                    <option key={h + 1} value={h + 1}>{(h + 1).toString().padStart(2, '0')}:00</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onRemoveBlock(dayIdx, blockIdx)}
                  title="Eliminar este bloque"
                  className="w-7 h-7 rounded-md hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-600 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => onAddBlock(dayIdx)}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1 mt-1"
            >
              <Plus className="w-3 h-3" />
              Agregar otro bloque
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
