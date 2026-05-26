'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, Clock, Info, X } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { PageHeader, AdminKeyframes } from '@/components/admin-ui'

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

const defaultBlocks = (): TimeBlock[] => [{ start_hour: 9, end_hour: 18 }]

const DEFAULT_WEEK: AvailabilityRow[] = Array.from({ length: 7 }).map((_, day) => ({
  day_of_week: day,
  time_blocks: day === 0 || day === 6 ? [] : defaultBlocks(),
  is_available: day !== 0 && day !== 6,
}))

const CARD_STYLE: React.CSSProperties = {
  background: 'var(--admin-panel-grad)',
  border: '0.5px solid var(--admin-border)',
  boxShadow: 'var(--admin-shadow, 0 6px 20px rgba(11,31,58,0.06))',
}

const INPUT_STYLE: React.CSSProperties = {
  background: 'var(--admin-bg-elev)',
  color: 'var(--admin-fg)',
  border: '0.5px solid var(--admin-border-strong)',
  padding: '8px 12px',
  borderRadius: 8,
  fontSize: 14,
}

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
        <Loader2
          className="w-5 h-5 animate-spin"
          style={{ color: 'var(--admin-fg-muted)' }}
        />
      </div>
    )
  }

  const activeDays = availability.filter(r => r.is_available).length

  return (
    <div className="space-y-6 max-w-4xl">
      <AdminKeyframes />
      <PageHeader
        eyebrow="CONSULTORA · AGENDA"
        title="Mi Agenda"
        accentDot
        description="Define los horarios en que estas disponible para las evaluaciones gratuitas. La IA de voz usara estos horarios para proponer slots a los prospectos."
        telemetry={[
          { label: 'Dias activos', value: activeDays.toString() },
          { label: 'Bloqueos', value: blocks.length.toString() },
        ]}
      />

      {/* Horario semanal */}
      <div className="rounded-2xl p-6 space-y-4" style={CARD_STYLE}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-bold" style={{ color: 'var(--admin-fg)' }}>
            Horario semanal
          </h2>
          <button
            type="button"
            onClick={saveAvailability}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full transition-opacity hover:opacity-90 active:scale-95 disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #F2C14E, var(--admin-gold))',
              color: 'var(--admin-accent)',
              boxShadow: 'var(--admin-shadow-gold, 0 12px 28px rgba(216,155,29,0.28))',
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: '-0.005em',
              border: '0.5px solid var(--admin-gold-border, rgba(255,255,255,0.2))',
            }}
          >
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...</> : 'Guardar'}
          </button>
        </div>

        <div
          className="rounded-xl p-3 flex gap-2"
          style={{
            background: 'var(--admin-blue-soft)',
            border: '0.5px solid var(--admin-blue)',
          }}
        >
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--admin-blue)' }} />
          <div className="text-xs leading-relaxed">
            <p className="font-semibold mb-0.5" style={{ color: 'var(--admin-accent)' }}>
              Mountain Time (Utah · El Salvador)
            </p>
            <p style={{ color: 'var(--admin-blue)' }}>
              Las horas se interpretan en horario de las Montanas (UTC-7 / UTC-6 en horario de verano), igual que Utah y El Salvador. Puedes definir varios bloques por dia, por ejemplo: 9 a 12, 15 a 18, y 20 a 21.
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
      </div>

      {/* Bloqueos puntuales */}
      <div className="rounded-2xl p-6 space-y-4" style={CARD_STYLE}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--admin-fg)' }}>
              Bloqueos puntuales
            </h2>
            <p className="text-xs" style={{ color: 'var(--admin-fg-muted)' }}>
              Vacaciones, reuniones, almuerzos largos, etc.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowBlockForm(s => !s)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-opacity hover:opacity-80"
            style={{
              background: 'var(--admin-bg-elev)',
              color: 'var(--admin-blue)',
              border: '0.5px solid var(--admin-border-strong)',
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            Anadir bloqueo
          </button>
        </div>

        {showBlockForm && (
          <div
            className="rounded-xl p-4 space-y-3"
            style={{
              background: 'var(--admin-bg-elev-2)',
              border: '0.5px solid var(--admin-border)',
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block">
                <span
                  className="block mb-1"
                  style={{
                    fontFamily: 'var(--font-mono-tech)',
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.14em',
                    color: 'var(--admin-fg-subtle)',
                    textTransform: 'uppercase',
                  }}
                >
                  Desde
                </span>
                <input
                  type="datetime-local"
                  value={blockStart}
                  onChange={(e) => setBlockStart(e.target.value)}
                  className="w-full focus:outline-none focus:ring-2"
                  style={INPUT_STYLE}
                />
              </label>
              <label className="block">
                <span
                  className="block mb-1"
                  style={{
                    fontFamily: 'var(--font-mono-tech)',
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.14em',
                    color: 'var(--admin-fg-subtle)',
                    textTransform: 'uppercase',
                  }}
                >
                  Hasta
                </span>
                <input
                  type="datetime-local"
                  value={blockEnd}
                  onChange={(e) => setBlockEnd(e.target.value)}
                  className="w-full focus:outline-none focus:ring-2"
                  style={INPUT_STYLE}
                />
              </label>
            </div>
            <label className="block">
              <span
                className="block mb-1"
                style={{
                  fontFamily: 'var(--font-mono-tech)',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.14em',
                  color: 'var(--admin-fg-subtle)',
                  textTransform: 'uppercase',
                }}
              >
                Motivo (opcional)
              </span>
              <input
                type="text"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="ej: vacaciones, reunion"
                className="w-full focus:outline-none focus:ring-2"
                style={INPUT_STYLE}
              />
            </label>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowBlockForm(false)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-opacity hover:opacity-80"
                style={{
                  background: 'var(--admin-bg-elev)',
                  color: 'var(--admin-fg-muted)',
                  border: '0.5px solid var(--admin-border-strong)',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={addPunctualBlock}
                className="px-4 py-1.5 rounded-full text-xs font-semibold transition-opacity hover:opacity-90 active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, var(--admin-accent), var(--admin-blue))',
                  color: '#FFFFFF',
                  boxShadow: '0 12px 28px rgba(30,78,154,0.25)',
                  border: '0.5px solid rgba(255,255,255,0.2)',
                }}
              >
                Anadir
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {blocks.length === 0 ? (
            <p
              className="text-sm text-center py-4"
              style={{ color: 'var(--admin-fg-subtle)' }}
            >
              Sin bloqueos activos
            </p>
          ) : (
            blocks.map(b => (
              <div
                key={b.id}
                className="flex items-center justify-between py-2 last:border-b-0"
                style={{ borderBottom: '0.5px solid var(--admin-border)' }}
              >
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4" style={{ color: 'var(--admin-fg-muted)' }} />
                  <div>
                    <p
                      className="text-sm font-medium"
                      style={{ color: 'var(--admin-fg)' }}
                    >
                      {format(new Date(b.blocked_at_start), "d MMM HH:mm", { locale: es })} →{' '}
                      {format(new Date(b.blocked_at_end), "d MMM HH:mm", { locale: es })}
                    </p>
                    {b.reason && (
                      <p
                        className="text-xs"
                        style={{ color: 'var(--admin-fg-muted)' }}
                      >
                        {b.reason}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => deletePunctualBlock(b.id)}
                  className="w-8 h-8 rounded-md inline-flex items-center justify-center transition-colors hover:bg-opacity-50"
                  style={{ color: 'var(--admin-red)' }}
                  aria-label="Eliminar bloqueo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

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
  const selectStyle: React.CSSProperties = {
    background: 'var(--admin-bg-elev)',
    color: 'var(--admin-fg)',
    border: '0.5px solid var(--admin-border-strong)',
    padding: '4px 8px',
    borderRadius: 6,
    fontSize: 13,
  }

  return (
    <div
      className="rounded-xl px-3 py-2.5"
      style={{
        background: 'var(--admin-bg-elev)',
        border: '0.5px solid var(--admin-border)',
      }}
    >
      <div className="flex items-start gap-3">
        <label className="flex items-center gap-2 w-32 text-sm flex-shrink-0 pt-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={row.is_available}
            onChange={(e) => onToggleDay(dayIdx, e.target.checked)}
            className="w-4 h-4"
            style={{ accentColor: 'var(--admin-accent)' }}
          />
          <span className="font-medium" style={{ color: 'var(--admin-fg)' }}>
            {DAYS[row.day_of_week]}
          </span>
        </label>

        {!row.is_available ? (
          <span
            className="text-sm flex-1 pt-1.5"
            style={{ color: 'var(--admin-fg-subtle)' }}
          >
            No disponible
          </span>
        ) : (
          <div className="flex-1 space-y-1.5">
            {row.time_blocks.map((block, blockIdx) => (
              <div key={blockIdx} className="flex items-center gap-2">
                <select
                  value={block.start_hour}
                  onChange={(e) => onUpdateBlock(dayIdx, blockIdx, { start_hour: Number(e.target.value) })}
                  style={selectStyle}
                >
                  {Array.from({ length: 24 }).map((_, h) => (
                    <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>
                  ))}
                </select>
                <span className="text-sm" style={{ color: 'var(--admin-fg-subtle)' }}>
                  a
                </span>
                <select
                  value={block.end_hour}
                  onChange={(e) => onUpdateBlock(dayIdx, blockIdx, { end_hour: Number(e.target.value) })}
                  style={selectStyle}
                >
                  {Array.from({ length: 24 }).map((_, h) => (
                    <option key={h + 1} value={h + 1}>{(h + 1).toString().padStart(2, '0')}:00</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onRemoveBlock(dayIdx, blockIdx)}
                  title="Eliminar este bloque"
                  className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-opacity-50"
                  style={{
                    color: 'var(--admin-fg-subtle)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--admin-red)'
                    e.currentTarget.style.background = 'var(--admin-red-soft)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--admin-fg-subtle)'
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => onAddBlock(dayIdx)}
              className="text-xs font-medium inline-flex items-center gap-1 mt-1 hover:underline"
              style={{ color: 'var(--admin-blue)' }}
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
