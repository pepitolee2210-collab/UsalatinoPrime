'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  Loader2, Calendar, Clock, Settings2, ArrowLeft, Save, Plus, Trash2, Ban,
} from 'lucide-react'

interface TimeBlock { start_hour: number; end_hour: number }
interface DayConfig {
  day_of_week: number
  time_blocks: TimeBlock[]
  is_available: boolean
}
interface Settings {
  slot_duration_minutes: number
  advance_notice_hours: number
}
interface BlockedDate {
  id: string
  blocked_date: string
  reason: string | null
}

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function formatHour(h: number): string {
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:00 ${ampm}`
}

export default function ProspectSchedulingConfigPage() {
  const [config, setConfig] = useState<DayConfig[]>([])
  const [settings, setSettings] = useState<Settings>({ slot_duration_minutes: 30, advance_notice_hours: 2 })
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [newBlockDate, setNewBlockDate] = useState('')
  const [newBlockReason, setNewBlockReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/prospect-scheduling')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setConfig(data.config || [])
      setSettings(data.settings || { slot_duration_minutes: 30, advance_notice_hours: 2 })
      setBlockedDates(data.blockedDates || [])
    } catch {
      toast.error('Error al cargar configuración')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function saveDayConfig(day: DayConfig) {
    setSaving(`day-${day.day_of_week}`)
    try {
      const res = await fetch('/api/admin/prospect-scheduling', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day_of_week: day.day_of_week,
          time_blocks: day.time_blocks,
          is_available: day.is_available,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success(`${DAYS[day.day_of_week]} guardado`)
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(null)
    }
  }

  async function saveSettings() {
    setSaving('settings')
    try {
      const res = await fetch('/api/admin/prospect-scheduling', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot_duration_minutes: settings.slot_duration_minutes,
          advance_notice_hours: settings.advance_notice_hours,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Configuración global guardada')
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(null)
    }
  }

  async function toggleBlockDate(action: 'block' | 'unblock', date: string, reason?: string) {
    try {
      const res = await fetch('/api/admin/prospect-scheduling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, date, reason }),
      })
      if (!res.ok) throw new Error()
      if (action === 'block') {
        toast.success('Fecha bloqueada')
        setNewBlockDate('')
        setNewBlockReason('')
      } else {
        toast.success('Fecha desbloqueada')
      }
      await load()
    } catch {
      toast.error('Error')
    }
  }

  function updateDayBlocks(idx: number, blocks: TimeBlock[]) {
    const updated = [...config]
    updated[idx] = { ...updated[idx], time_blocks: blocks }
    setConfig(updated)
  }

  function updateDayAvailable(idx: number, available: boolean) {
    const updated = [...config]
    updated[idx] = { ...updated[idx], is_available: available }
    setConfig(updated)
  }

  function addBlock(idx: number) {
    const blocks = [...(config[idx]?.time_blocks || []), { start_hour: 10, end_hour: 12 }]
    updateDayBlocks(idx, blocks)
  }

  function removeBlock(idx: number, blockIdx: number) {
    const blocks = [...(config[idx]?.time_blocks || [])]
    blocks.splice(blockIdx, 1)
    updateDayBlocks(idx, blocks)
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href="/admin/prospectos-citas" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-2">
            <ArrowLeft className="w-4 h-4" /> Volver
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-rose-500" />
            Calendario de Prospectos IA
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Configura cuándo la IA puede agendar llamadas con prospectos.
            Es independiente del calendario de clientes reales.
          </p>
        </div>
      </div>

      {/* Global settings */}
      <Card>
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Settings2 className="w-4 h-4 text-gray-500" />
            Configuración global
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <Label className="text-xs">Duración de cada cita (min)</Label>
              <Input
                type="number"
                min={15}
                max={120}
                step={15}
                value={settings.slot_duration_minutes}
                onChange={e => setSettings({ ...settings, slot_duration_minutes: parseInt(e.target.value) || 30 })}
              />
              <p className="text-[10px] text-gray-400 mt-1">Default: 30 min (call de calificación)</p>
            </div>
            <div>
              <Label className="text-xs">Aviso mínimo (horas)</Label>
              <Input
                type="number"
                min={0}
                max={48}
                step={1}
                value={settings.advance_notice_hours}
                onChange={e => setSettings({ ...settings, advance_notice_hours: parseInt(e.target.value) || 0 })}
              />
              <p className="text-[10px] text-gray-400 mt-1">No agendar antes de X horas desde ahora</p>
            </div>
            <Button onClick={saveSettings} disabled={saving === 'settings'}>
              {saving === 'settings' ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              Guardar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Day-of-week grid */}
      <Card>
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-gray-500" />
            Horarios por día
          </h2>
          <div className="space-y-3">
            {config.map((day, idx) => (
              <div key={day.day_of_week} className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={day.is_available}
                      onChange={e => updateDayAvailable(idx, e.target.checked)}
                      className="w-4 h-4 accent-rose-500"
                    />
                    <span className="font-medium text-gray-900 text-sm">{DAYS[day.day_of_week]}</span>
                  </label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => saveDayConfig(config[idx])}
                    disabled={saving === `day-${day.day_of_week}`}
                  >
                    {saving === `day-${day.day_of_week}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  </Button>
                </div>

                {day.is_available && (
                  <div className="space-y-2 pl-6">
                    {day.time_blocks.length === 0 && (
                      <p className="text-xs text-gray-400 italic">Sin bloques de horario — agrega uno o desactiva el día</p>
                    )}
                    {day.time_blocks.map((block, bIdx) => (
                      <div key={bIdx} className="flex items-center gap-2 text-sm">
                        <select
                          value={block.start_hour}
                          onChange={e => {
                            const blocks = [...day.time_blocks]
                            blocks[bIdx] = { ...block, start_hour: parseInt(e.target.value) }
                            updateDayBlocks(idx, blocks)
                          }}
                          className="h-8 rounded border border-gray-200 bg-white px-2 text-xs"
                        >
                          {Array.from({ length: 24 }, (_, h) => (
                            <option key={h} value={h}>{formatHour(h)}</option>
                          ))}
                        </select>
                        <span className="text-gray-400">a</span>
                        <select
                          value={block.end_hour}
                          onChange={e => {
                            const blocks = [...day.time_blocks]
                            blocks[bIdx] = { ...block, end_hour: parseInt(e.target.value) }
                            updateDayBlocks(idx, blocks)
                          }}
                          className="h-8 rounded border border-gray-200 bg-white px-2 text-xs"
                        >
                          {Array.from({ length: 24 }, (_, h) => (
                            <option key={h} value={h}>{formatHour(h)}</option>
                          ))}
                        </select>
                        <Button size="sm" variant="ghost" onClick={() => removeBlock(idx, bIdx)} className="text-red-400 hover:text-red-600 h-8">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => addBlock(idx)} className="mt-1">
                      <Plus className="w-3.5 h-3.5 mr-1" /> Agregar bloque
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Blocked dates */}
      <Card>
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Ban className="w-4 h-4 text-gray-500" />
            Fechas bloqueadas
          </h2>
          <p className="text-xs text-gray-500 mb-3">
            Días que la IA NO puede agendar (vacaciones, conferencias, etc.).
          </p>

          <div className="flex items-end gap-2 mb-4 flex-wrap">
            <div className="flex-1 min-w-[180px]">
              <Label className="text-xs">Fecha</Label>
              <Input type="date" value={newBlockDate} onChange={e => setNewBlockDate(e.target.value)} />
            </div>
            <div className="flex-1 min-w-[180px]">
              <Label className="text-xs">Motivo (opcional)</Label>
              <Input value={newBlockReason} onChange={e => setNewBlockReason(e.target.value)} placeholder="Ej: vacaciones" />
            </div>
            <Button
              onClick={() => newBlockDate && toggleBlockDate('block', newBlockDate, newBlockReason)}
              disabled={!newBlockDate}
            >
              <Ban className="w-4 h-4 mr-1" />
              Bloquear
            </Button>
          </div>

          {blockedDates.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No hay fechas bloqueadas</p>
          ) : (
            <div className="space-y-1.5">
              {blockedDates.map(b => (
                <div key={b.id} className="flex items-center justify-between p-2 rounded-lg bg-red-50 border border-red-100">
                  <div>
                    <p className="text-sm font-medium text-red-900">
                      {new Date(b.blocked_date + 'T12:00:00').toLocaleDateString('es-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    {b.reason && <p className="text-xs text-red-600">{b.reason}</p>}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => toggleBlockDate('unblock', b.blocked_date)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
