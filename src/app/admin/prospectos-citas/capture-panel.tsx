'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Save, PhoneCall, Info, UserPlus, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Prospecto } from './prospectos-view'

export interface CapturedData {
  menor_nombre?: string
  menor_edad?: string
  menor_pais_origen?: string
  menor_fecha_llegada?: string
  menor_estado?: string
  abandono_tipo?: 'padre' | 'madre' | 'ambos' | ''
  abandono_fecha_aprox?: string
  abandono_ultima_vez?: string
  custodio_nombre?: string
  custodio_parentesco?: string
  custodio_estado_civil?: string
  custodio_direccion?: string
  detenido_inmigracion?: 'si' | 'no' | ''
  orden_judicial_previa?: 'si' | 'no' | ''
  orr_sponsor?: 'si' | 'no' | ''
  notas_libres?: string
}

interface Props {
  prospecto: Prospecto
  onClose: () => void
  onSaved: (patch: Partial<Prospecto>) => Promise<void>
  onConvert: () => void
}

export function ProspectoCapturePanel({ prospecto, onClose, onSaved, onConvert }: Props) {
  const [data, setData] = useState<CapturedData>((prospecto.captured_data as CapturedData) || {})
  const [probability, setProbability] = useState<'alta' | 'media' | 'baja' | ''>(prospecto.probability || '')
  const [decision, setDecision] = useState<'acepta' | 'rechaza' | 'lo_pensara' | 'no_procede' | ''>(prospecto.client_decision || '')
  const [notes, setNotes] = useState<string>(prospecto.consultant_notes || '')
  const [saving, setSaving] = useState(false)
  const dirtyRef = useRef(false)
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function markDirty() { dirtyRef.current = true }

  async function save(extraPatch: Partial<Prospecto> = {}) {
    setSaving(true)
    try {
      await onSaved({
        captured_data: data,
        probability: probability || null,
        client_decision: decision || null,
        consultant_notes: notes,
        ...extraPatch,
      } as Partial<Prospecto>)
      dirtyRef.current = false
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    if (!dirtyRef.current) return
    autosaveTimerRef.current = setTimeout(() => {
      save().catch(() => {})
    }, 15_000)
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, probability, decision, notes])

  function update<K extends keyof CapturedData>(key: K, value: CapturedData[K]) {
    setData(prev => ({ ...prev, [key]: value }))
    markDirty()
  }

  async function finalize(callStatus: 'completada' | 'no_procede' | 'no_contesta') {
    await save({ call_status: callStatus } as Partial<Prospecto>)
    toast.success(
      callStatus === 'completada' ? 'Llamada completada' :
      callStatus === 'no_procede' ? 'Marcado como no procede' :
      'Marcado como no contesta'
    )
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay con backdrop blur */}
      <div
        className="flex-1"
        onClick={onClose}
        style={{
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(8px)',
        }}
      />

      {/* Panel lateral */}
      <div
        className="w-full max-w-2xl h-full overflow-y-auto admin-scroll"
        style={{
          background: 'linear-gradient(180deg, #0B0B0E 0%, #050505 100%)',
          borderLeft: '0.5px solid rgba(255,255,255,0.1)',
          boxShadow: '-40px 0 80px rgba(0,0,0,0.5)',
          color: 'var(--admin-fg)',
        }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between"
          style={{
            background: 'rgba(10,10,10,0.85)',
            backdropFilter: 'blur(20px)',
            borderBottom: '0.5px solid rgba(255,255,255,0.08)',
          }}
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className="inline-flex items-center justify-center w-9 h-9 rounded-xl"
                style={{
                  background: 'rgba(96,165,250,0.12)',
                  border: '0.5px solid rgba(96,165,250,0.3)',
                }}
              >
                <PhoneCall className="w-4 h-4" style={{ color: '#60A5FA' }} />
              </span>
              <div>
                <p style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 9, fontWeight: 500, letterSpacing: '0.2em', color: 'var(--admin-fg-subtle)' }}>
                  EVALUACIÓN · EN VIVO
                </p>
                <h2 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em', color: '#FFFFFF', lineHeight: 1.2 }}>
                  {prospecto.guest_name || 'Sin nombre'}
                </h2>
              </div>
              {saving && (
                <span className="inline-flex items-center gap-1 ml-2" style={{ fontSize: 10, color: 'var(--admin-fg-muted)', fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.1em' }}>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  GUARDANDO…
                </span>
              )}
            </div>
            <p style={{ fontSize: 12, color: 'var(--admin-fg-muted)', marginLeft: 44, fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.02em' }}>
              {prospecto.guest_phone || 'sin teléfono'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full transition-colors hover:bg-white/10 flex items-center justify-center"
            style={{ color: 'var(--admin-fg-muted)', border: '0.5px solid rgba(255,255,255,0.1)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-7">
          {/* Disclaimer */}
          <div
            className="rounded-xl p-3.5 flex gap-2.5"
            style={{
              background: 'rgba(96,165,250,0.06)',
              border: '0.5px solid rgba(96,165,250,0.2)',
            }}
          >
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#60A5FA' }} />
            <div style={{ fontSize: 12, color: '#93C5FD', lineHeight: 1.55 }}>
              <strong style={{ color: '#FFFFFF' }}>Recordatorio:</strong> UsaLatino Prime es una plataforma que guía al usuario a organizar su propio expediente. Tu rol es acompañar al cliente, evaluar viabilidad y capturar los datos clave. No das asesoría legal.
            </div>
          </div>

          {/* Menor */}
          <Section title="Datos del menor">
            <Row>
              <Field label="Nombre completo" value={data.menor_nombre || ''} onChange={v => update('menor_nombre', v)} />
              <Field label="Edad" value={data.menor_edad || ''} onChange={v => update('menor_edad', v)} />
            </Row>
            <Row>
              <Field label="País de origen" value={data.menor_pais_origen || ''} onChange={v => update('menor_pais_origen', v)} />
              <Field label="Estado donde vive" value={data.menor_estado || ''} onChange={v => update('menor_estado', v)} />
            </Row>
            <Field label="Fecha aprox. de llegada a EE.UU." value={data.menor_fecha_llegada || ''} onChange={v => update('menor_fecha_llegada', v)} placeholder="ej: marzo 2022" />
          </Section>

          {/* Abandono */}
          <Section title="Abandono / Maltrato">
            <RadioGroup
              label="¿Quién abandonó al menor?"
              value={data.abandono_tipo || ''}
              options={[
                { value: 'padre', label: 'Padre' },
                { value: 'madre', label: 'Madre' },
                { value: 'ambos', label: 'Ambos' },
              ]}
              onChange={(v) => update('abandono_tipo', v as CapturedData['abandono_tipo'])}
            />
            <Row>
              <Field label="Fecha aproximada del abandono" value={data.abandono_fecha_aprox || ''} onChange={v => update('abandono_fecha_aprox', v)} placeholder="ej: 2018" />
              <Field label="Última vez que vio al padre/madre" value={data.abandono_ultima_vez || ''} onChange={v => update('abandono_ultima_vez', v)} placeholder="ej: hace 5 años" />
            </Row>
          </Section>

          {/* Custodio */}
          <Section title="Custodio actual">
            <Row>
              <Field label="Nombre completo" value={data.custodio_nombre || ''} onChange={v => update('custodio_nombre', v)} />
              <Field label="Parentesco con el menor" value={data.custodio_parentesco || ''} onChange={v => update('custodio_parentesco', v)} placeholder="ej: madre, tío, abuela" />
            </Row>
            <Field label="Estado civil" value={data.custodio_estado_civil || ''} onChange={v => update('custodio_estado_civil', v)} />
            <Field label="Dirección" value={data.custodio_direccion || ''} onChange={v => update('custodio_direccion', v)} />
          </Section>

          {/* Antecedentes */}
          <Section title="Antecedentes">
            <RadioGroup
              label="¿Detenido por inmigración?"
              value={data.detenido_inmigracion || ''}
              options={[{ value: 'si', label: 'Sí' }, { value: 'no', label: 'No' }]}
              onChange={(v) => update('detenido_inmigracion', v as 'si' | 'no')}
            />
            <RadioGroup
              label="¿Orden judicial previa?"
              value={data.orden_judicial_previa || ''}
              options={[{ value: 'si', label: 'Sí' }, { value: 'no', label: 'No' }]}
              onChange={(v) => update('orden_judicial_previa', v as 'si' | 'no')}
            />
            <RadioGroup
              label="¿Pasó por ORR (Office of Refugee Resettlement)?"
              value={data.orr_sponsor || ''}
              options={[{ value: 'si', label: 'Sí' }, { value: 'no', label: 'No' }]}
              onChange={(v) => update('orr_sponsor', v as 'si' | 'no')}
            />
          </Section>

          {/* Notas libres */}
          <Section title="Notas de la consultora">
            <textarea
              value={notes}
              onChange={(e) => { setNotes(e.target.value); markDirty() }}
              rows={4}
              placeholder="Escribe cualquier detalle del caso que sea relevante…"
              className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-colors focus:border-white/30 resize-y"
              style={{
                background: 'var(--admin-accent-soft)',
                border: '0.5px solid rgba(255,255,255,0.1)',
                color: 'var(--admin-fg)',
                fontSize: 13,
                letterSpacing: '-0.005em',
                minHeight: 100,
              }}
            />
          </Section>

          {/* Evaluación */}
          <Section title="Tu evaluación">
            <RadioGroup
              label="Probabilidad de viabilidad del caso"
              value={probability}
              options={[
                { value: 'alta', label: 'Alta' },
                { value: 'media', label: 'Media' },
                { value: 'baja', label: 'Baja' },
              ]}
              onChange={(v) => { setProbability(v as 'alta' | 'media' | 'baja'); markDirty() }}
            />
            <RadioGroup
              label="Decisión del cliente"
              value={decision}
              options={[
                { value: 'acepta', label: 'Acepta iniciar proceso' },
                { value: 'lo_pensara', label: 'Lo va a pensar' },
                { value: 'rechaza', label: 'No acepta' },
                { value: 'no_procede', label: 'No procede (no califica)' },
              ]}
              onChange={(v) => { setDecision(v as 'acepta' | 'rechaza' | 'lo_pensara' | 'no_procede'); markDirty() }}
            />
          </Section>
        </div>

        {/* Footer con acciones */}
        <div
          className="sticky bottom-0 px-6 py-4 flex flex-wrap gap-2 justify-between"
          style={{
            background: 'rgba(10,10,10,0.92)',
            backdropFilter: 'blur(20px)',
            borderTop: '0.5px solid rgba(255,255,255,0.08)',
          }}
        >
          <button
            onClick={() => save().then(() => toast.success('Guardado'))}
            disabled={saving}
            className={BTN_GHOST}
          >
            <Save className="w-3.5 h-3.5" /> Guardar borrador
          </button>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => finalize('no_contesta')} disabled={saving} className={BTN_GHOST}>
              No contestó
            </button>
            <button onClick={() => finalize('no_procede')} disabled={saving} className={BTN_DANGER}>
              <XCircle className="w-3.5 h-3.5" /> No procede
            </button>
            <button
              onClick={() => finalize('completada')}
              disabled={saving}
              className={BTN_SUCCESS}
            >
              <CheckCircle className="w-3.5 h-3.5" /> Finalizar
            </button>
            {decision === 'acepta' && (
              <button
                onClick={async () => { await save({ call_status: 'completada' } as Partial<Prospecto>); onConvert() }}
                disabled={saving}
                className={BTN_PRIMARY}
              >
                <UserPlus className="w-3.5 h-3.5" /> Pasar a contratos
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════

const BTN_GHOST =
  'inline-flex items-center gap-1.5 px-3 py-2 rounded-full transition-all duration-200 ' +
  'hover:bg-white/10 active:scale-95 text-[12px] font-semibold tracking-tight ' +
  'bg-white/[0.04] border border-white/10 text-white disabled:opacity-50'

const BTN_DANGER =
  'inline-flex items-center gap-1.5 px-3 py-2 rounded-full transition-all duration-200 ' +
  'hover:bg-red-500/15 active:scale-95 text-[12px] font-semibold tracking-tight ' +
  'bg-red-500/10 border border-red-500/30 text-red-300 disabled:opacity-50'

const BTN_SUCCESS =
  'inline-flex items-center gap-1.5 px-3 py-2 rounded-full transition-all duration-200 ' +
  'hover:bg-emerald-500/15 active:scale-95 text-[12px] font-semibold tracking-tight ' +
  'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 disabled:opacity-50'

const BTN_PRIMARY =
  'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full transition-all duration-200 ' +
  'hover:opacity-90 active:scale-95 text-[12px] font-semibold tracking-tight ' +
  'bg-white text-black shadow-[0_4px_18px_rgba(255,255,255,0.18),0_0_0_0.5px_rgba(255,255,255,0.4)_inset] disabled:opacity-50'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3
        className="pb-1.5"
        style={{
          fontFamily: 'var(--font-mono-tech)',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.2em',
          color: '#FFFFFF',
          borderBottom: '0.5px solid rgba(255,255,255,0.1)',
        }}
      >
        {title.toUpperCase()}
      </h3>
      <div className="space-y-3 pt-1">{children}</div>
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block space-y-1.5">
      <span
        style={{
          fontFamily: 'var(--font-mono-tech)',
          fontSize: 9,
          fontWeight: 500,
          letterSpacing: '0.18em',
          color: 'var(--admin-fg-muted)',
        }}
      >
        {label.toUpperCase()}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-colors focus:border-white/30"
        style={{
          background: 'var(--admin-accent-soft)',
          border: '0.5px solid rgba(255,255,255,0.1)',
          color: 'var(--admin-fg)',
          fontSize: 13,
          letterSpacing: '-0.005em',
        }}
      />
    </label>
  )
}

function RadioGroup({
  label, value, options, onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      <span
        style={{
          fontFamily: 'var(--font-mono-tech)',
          fontSize: 9,
          fontWeight: 500,
          letterSpacing: '0.18em',
          color: 'var(--admin-fg-muted)',
        }}
      >
        {label.toUpperCase()}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => {
          const isActive = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className="px-3 py-1.5 rounded-full transition-all duration-200"
              style={{
                background: isActive ? '#FFFFFF' : 'var(--admin-accent-soft)',
                color: isActive ? 'var(--admin-bg-deep)' : 'var(--admin-fg-muted)',
                border: isActive ? '0.5px solid #FFFFFF' : '0.5px solid rgba(255,255,255,0.1)',
                fontSize: 12,
                fontWeight: isActive ? 700 : 500,
                letterSpacing: '-0.005em',
                boxShadow: isActive ? '0 0 12px rgba(255,255,255,0.15)' : 'none',
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
