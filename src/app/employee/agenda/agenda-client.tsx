'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, CalendarDays, Plus, Trash2, Clock, Info } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface AvailabilityRow {
  id?: string
  day_of_week: number
  start_hour: number
  end_hour: number
  is_available: boolean
}

interface BlockRow {
  id: string
  blocked_at_start: string
  blocked_at_end: string
  reason: string | null
}

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const DEFAULT_WEEK: AvailabilityRow[] = Array.from({ length: 7 }).map((_, day) => ({
  day_of_week: day,
  start_hour: day === 0 || day === 6 ? 0 : 9,
  end_hour: day === 0 || day === 6 ? 0 : 18,
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

      const mapped: AvailabilityRow[] = DEFAULT_WEEK.map(def => {
        const existing = (data.availability as AvailabilityRow[]).find(a => a.day_of_week === def.day_of_week)
        return existing ? { ...existing, is_available: true } : { ...def, is_available: false }
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

  function updateDay(idx: number, patch: Partial<AvailabilityRow>) {
    setAvailability(prev => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)))
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

  async function addBlock() {
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

  async function deleteBlock(id: string) {
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
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 flex gap-2">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-900">
              Todas las horas están en tu zona horaria local. Marca solo los días en los que aceptas llamadas.
            </p>
          </div>
          <div className="space-y-2">
            {availability.map((row, idx) => (
              <div key={idx} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-b-0">
                <label className="flex items-center gap-2 w-32 text-sm">
                  <input
                    type="checkbox"
                    checked={row.is_available}
                    onChange={(e) => updateDay(idx, { is_available: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="font-medium text-gray-700">{DAYS[row.day_of_week]}</span>
                </label>
                {row.is_available ? (
                  <div className="flex items-center gap-2 flex-1">
                    <select
                      value={row.start_hour}
                      onChange={(e) => updateDay(idx, { start_hour: Number(e.target.value) })}
                      className="rounded-md border border-gray-200 px-2 py-1 text-sm"
                    >
                      {Array.from({ length: 24 }).map((_, h) => (
                        <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>
                      ))}
                    </select>
                    <span className="text-sm text-gray-400">a</span>
                    <select
                      value={row.end_hour}
                      onChange={(e) => updateDay(idx, { end_hour: Number(e.target.value) })}
                      className="rounded-md border border-gray-200 px-2 py-1 text-sm"
                    >
                      {Array.from({ length: 24 }).map((_, h) => (
                        <option key={h + 1} value={h + 1}>{(h + 1).toString().padStart(2, '0')}:00</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <span className="text-sm text-gray-400 flex-1">No disponible</span>
                )}
              </div>
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
                <Button size="sm" onClick={addBlock}>Añadir</Button>
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
                  <Button size="icon" variant="ghost" onClick={() => deleteBlock(b.id)}>
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
