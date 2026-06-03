'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Loader2, Calendar, Clock, Settings2, ArrowLeft, Save, Plus, Trash2, Ban,
} from 'lucide-react'
import { PageHeader, AdminKeyframes } from '@/components/admin-ui'

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
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--admin-fg-muted)' }} />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <AdminKeyframes />

      <Link
        href="/admin/prospectos-citas"
        className="inline-flex items-center gap-1.5 transition-opacity hover:opacity-80"
        style={{
          fontFamily: 'var(--font-mono-tech)',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.2em',
          color: 'var(--admin-fg-muted)',
        }}
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        VOLVER A PROSPECTOS
      </Link>

      <PageHeader
        eyebrow="Operación · Prospectos IA · Configuración"
        title="Calendario IA"
        accentDot
        description="Configura cuándo la IA puede agendar llamadas con prospectos. Es independiente del calendario de clientes reales."
      />

      {/* Global settings */}
      <Panel icon={<Settings2 className="w-4 h-4" />} title="Configuración global">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <FormField label="Duración de cada cita (min)" hint="Default: 30 min (call de calificación)">
            <DarkNumberInput
              value={settings.slot_duration_minutes}
              min={15}
              max={120}
              step={15}
              onChange={(v) => setSettings({ ...settings, slot_duration_minutes: v })}
            />
          </FormField>
          <FormField label="Aviso mínimo (horas)" hint="No agendar antes de X horas desde ahora">
            <DarkNumberInput
              value={settings.advance_notice_hours}
              min={0}
              max={48}
              step={1}
              onChange={(v) => setSettings({ ...settings, advance_notice_hours: v })}
            />
          </FormField>
          <button onClick={saveSettings} disabled={saving === 'settings'} className={PRIMARY_BTN}>
            {saving === 'settings' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Guardar
          </button>
        </div>
      </Panel>

      {/* Day-of-week grid */}
      <Panel icon={<Clock className="w-4 h-4" />} title="Horarios por día">
        <div className="space-y-2">
          {config.map((day, idx) => (
            <div
              key={day.day_of_week}
              className="rounded-xl p-4"
              style={{
                background: day.is_available ? 'var(--admin-veil-2)' : 'var(--admin-veil-1)',
                border: '0.5px solid var(--admin-border)',
              }}
            >
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <CustomCheckbox
                    checked={day.is_available}
                    onChange={(c) => updateDayAvailable(idx, c)}
                  />
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: day.is_available ? 'var(--admin-fg)' : 'var(--admin-fg-subtle)',
                      letterSpacing: '-0.005em',
                    }}
                  >
                    {DAYS[day.day_of_week]}
                  </span>
                  {!day.is_available && (
                    <span
                      style={{
                        fontFamily: 'var(--font-mono-tech)',
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: '0.18em',
                        color: 'var(--admin-fg-subtle)',
                      }}
                    >
                      INACTIVO
                    </span>
                  )}
                </label>
                <button
                  onClick={() => saveDayConfig(config[idx])}
                  disabled={saving === `day-${day.day_of_week}`}
                  className={ICON_BTN}
                  title="Guardar"
                >
                  {saving === `day-${day.day_of_week}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                </button>
              </div>

              {day.is_available && (
                <div className="mt-3 pl-7 space-y-2">
                  {day.time_blocks.length === 0 && (
                    <p
                      style={{
                        fontSize: 11,
                        color: 'var(--admin-fg-subtle)',
                        fontFamily: 'var(--font-mono-tech)',
                        letterSpacing: '0.1em',
                        fontStyle: 'italic',
                      }}
                    >
                      SIN BLOQUES — AGREGA UNO O DESACTIVA EL DÍA
                    </p>
                  )}
                  {day.time_blocks.map((block, bIdx) => (
                    <div key={bIdx} className="flex items-center gap-2">
                      <HourSelect
                        value={block.start_hour}
                        onChange={(v) => {
                          const blocks = [...day.time_blocks]
                          blocks[bIdx] = { ...block, start_hour: v }
                          updateDayBlocks(idx, blocks)
                        }}
                      />
                      <span style={{ color: 'var(--admin-fg-subtle)', fontSize: 11, fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.2em' }}>
                        A
                      </span>
                      <HourSelect
                        value={block.end_hour}
                        onChange={(v) => {
                          const blocks = [...day.time_blocks]
                          blocks[bIdx] = { ...block, end_hour: v }
                          updateDayBlocks(idx, blocks)
                        }}
                      />
                      <button
                        onClick={() => removeBlock(idx, bIdx)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-red-500/10"
                        style={{ color: 'var(--admin-red-on)' }}
                        title="Eliminar bloque"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => addBlock(idx)} className={GHOST_BTN}>
                    <Plus className="w-3.5 h-3.5" /> Agregar bloque
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Panel>

      {/* Blocked dates */}
      <Panel icon={<Ban className="w-4 h-4" />} title="Fechas bloqueadas" description="Días que la IA NO puede agendar (vacaciones, conferencias, etc.).">
        <div className="flex items-end gap-3 mb-5 flex-wrap">
          <FormField label="Fecha" className="flex-1 min-w-[180px]">
            <DarkDateInput value={newBlockDate} onChange={setNewBlockDate} />
          </FormField>
          <FormField label="Motivo (opcional)" className="flex-1 min-w-[180px]">
            <DarkTextInput
              value={newBlockReason}
              onChange={setNewBlockReason}
              placeholder="Ej: vacaciones"
            />
          </FormField>
          <button
            onClick={() => newBlockDate && toggleBlockDate('block', newBlockDate, newBlockReason)}
            disabled={!newBlockDate}
            className={PRIMARY_BTN}
          >
            <Ban className="w-3.5 h-3.5" /> Bloquear
          </button>
        </div>

        {blockedDates.length === 0 ? (
          <p style={{ fontSize: 11, color: 'var(--admin-fg-subtle)', fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.15em', fontStyle: 'italic' }}>
            NO HAY FECHAS BLOQUEADAS
          </p>
        ) : (
          <div className="space-y-2">
            {blockedDates.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between p-3 rounded-xl"
                style={{
                  background: 'var(--admin-red-soft)',
                  border: '0.5px solid var(--admin-red)',
                }}
              >
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-red-on)' }}>
                    {new Date(b.blocked_date + 'T12:00:00').toLocaleDateString('es-US', {
                      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </p>
                  {b.reason && (
                    <p style={{ fontSize: 11, color: 'var(--admin-fg-muted)', marginTop: 2 }}>
                      {b.reason}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => toggleBlockDate('unblock', b.blocked_date)}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-red-500/15"
                  style={{ color: 'var(--admin-red-on)' }}
                  title="Desbloquear"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════

const PRIMARY_BTN =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full transition-all duration-200 ' +
  'hover:opacity-90 active:scale-95 text-[12px] font-semibold tracking-tight ' +
  'bg-[color:var(--primary)] text-[color:var(--primary-foreground)] shadow-[var(--admin-shadow)] disabled:opacity-50'

const GHOST_BTN =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200 ' +
  'hover:bg-white/10 active:scale-95 text-[11px] font-semibold tracking-tight ' +
  'bg-white/[0.04] border border-white/10 text-[color:var(--admin-fg)]'

const ICON_BTN =
  'inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors ' +
  'hover:bg-white/10 text-[color:var(--admin-fg)] border border-white/10 disabled:opacity-50'

function Panel({
  icon, title, description, children,
}: { icon: React.ReactNode; title: string; description?: string; children: React.ReactNode }) {
  return (
    <div
      className="relative rounded-2xl p-5 overflow-hidden"
      style={{
        background: 'var(--admin-panel-grad)',
        border: '0.5px solid var(--admin-border-strong)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <span
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at top, var(--admin-veil-1), transparent 60%)' }}
      />
      <div className="relative">
        <div className="flex items-start gap-3 mb-4">
          <span
            className="inline-flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
            style={{
              background: 'linear-gradient(135deg, var(--admin-border-strong), var(--admin-veil-1))',
              border: '0.5px solid var(--admin-border-strong)',
              color: 'var(--admin-fg)',
            }}
          >
            {icon}
          </span>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.018em', color: 'var(--admin-fg)' }}>{title}</h2>
            {description && (
              <p style={{ fontSize: 12, color: 'var(--admin-fg-muted)', marginTop: 3, letterSpacing: '-0.005em' }}>{description}</p>
            )}
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

function FormField({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 ${className || ''}`}>
      <label
        style={{
          fontFamily: 'var(--font-mono-tech)',
          fontSize: 9,
          fontWeight: 500,
          letterSpacing: '0.18em',
          color: 'var(--admin-fg-muted)',
        }}
      >
        {label.toUpperCase()}
      </label>
      {children}
      {hint && (
        <p style={{ fontSize: 10, color: 'var(--admin-fg-subtle)', marginTop: 2, fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.05em' }}>
          {hint.toUpperCase()}
        </p>
      )}
    </div>
  )
}

const DARK_INPUT_STYLE: React.CSSProperties = {
  background: 'var(--admin-accent-soft)',
  border: '0.5px solid var(--admin-border-strong)',
  color: 'var(--admin-fg)',
  fontSize: 13,
  letterSpacing: '-0.005em',
  colorScheme: 'dark',
}

function DarkNumberInput({ value, onChange, min, max, step }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(parseInt(e.target.value) || 0)}
      className="w-full px-3.5 py-2.5 rounded-xl outline-none transition-colors focus:border-white/30"
      style={DARK_INPUT_STYLE}
    />
  )
}

function DarkTextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3.5 py-2.5 rounded-xl outline-none transition-colors focus:border-white/30"
      style={DARK_INPUT_STYLE}
    />
  )
}

function DarkDateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3.5 py-2.5 rounded-xl outline-none transition-colors focus:border-white/30"
      style={DARK_INPUT_STYLE}
    />
  )
}

function HourSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="appearance-none px-3 py-1.5 pr-7 rounded-lg outline-none cursor-pointer transition-colors focus:border-white/30"
        style={{
          background: 'var(--admin-accent-soft)',
          border: '0.5px solid var(--admin-border-strong)',
          color: 'var(--admin-fg)',
          fontFamily: 'var(--font-mono-tech)',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.02em',
          minWidth: 92,
        }}
      >
        {Array.from({ length: 24 }, (_, h) => (
          <option key={h} value={h} style={{ background: 'var(--admin-bg)', color: 'var(--admin-fg)' }}>
            {formatHour(h)}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: 'var(--admin-fg-subtle)', fontSize: 9 }}
      >
        ▾
      </span>
    </div>
  )
}

function CustomCheckbox({ checked, onChange }: { checked: boolean; onChange: (c: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); onChange(!checked) }}
      className="inline-flex items-center justify-center w-5 h-5 rounded-md transition-all duration-200"
      style={{
        background: checked ? 'var(--primary)' : 'var(--admin-accent-soft)',
        border: checked ? '0.5px solid var(--primary)' : '0.5px solid var(--admin-border-strong)',
        boxShadow: checked ? 'var(--admin-shadow)' : 'none',
      }}
    >
      {checked && (
        <svg width="11" height="9" viewBox="0 0 12 10" fill="none">
          <path d="M1.5 5L4.5 8L10.5 1.5" stroke="var(--primary-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}

// Ignore unused import on Calendar (kept for symmetry if needed later)
void Calendar
