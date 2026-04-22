'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { X, Save, PhoneCall, Info, UserPlus, CheckCircle, XCircle } from 'lucide-react'
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

  // Autoguardado cada 15s si hay cambios
  useEffect(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    if (!dirtyRef.current) return
    autosaveTimerRef.current = setTimeout(() => {
      save().catch(() => {})
    }, 15_000)
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    }
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
    <div className="fixed inset-0 z-40 flex">
      {/* Overlay */}
      <div className="flex-1 bg-black/40" onClick={onClose} />

      {/* Panel lateral */}
      <div className="w-full max-w-2xl bg-white h-full overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b z-10 px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <PhoneCall className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold text-gray-900">Evaluación en vivo</h2>
              {saving && <span className="text-xs text-gray-400">Guardando…</span>}
            </div>
            <p className="text-sm text-gray-500">
              {prospecto.guest_name} · {prospecto.guest_phone || 'sin teléfono'}
            </p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Disclaimer */}
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 flex gap-2">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900 leading-relaxed">
              <strong>Recordatorio:</strong> UsaLatino Prime es una plataforma que guía al usuario a organizar su propio expediente. Tu rol es acompañar al cliente, evaluar viabilidad y capturar los datos clave. No das asesoría legal.
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
            <Field label="Fecha aproximada de llegada a EE.UU." value={data.menor_fecha_llegada || ''} onChange={v => update('menor_fecha_llegada', v)} placeholder="ej: marzo 2022" />
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
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
              placeholder="Escribe cualquier detalle del caso que sea relevante..."
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
        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex flex-wrap gap-2 justify-between">
          <Button variant="outline" size="sm" onClick={() => save().then(() => toast.success('Guardado'))} disabled={saving}>
            <Save className="w-4 h-4 mr-1" /> Guardar borrador
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => finalize('no_contesta')} disabled={saving}>
              No contestó
            </Button>
            <Button variant="outline" size="sm" onClick={() => finalize('no_procede')} disabled={saving}>
              <XCircle className="w-4 h-4 mr-1" /> No procede
            </Button>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => finalize('completada')}
              disabled={saving}
            >
              <CheckCircle className="w-4 h-4 mr-1" /> Finalizar llamada
            </Button>
            {decision === 'acepta' && (
              <Button
                size="sm"
                className="bg-[#002855] hover:bg-[#001d3d] text-white"
                onClick={async () => { await save({ call_status: 'completada' } as Partial<Prospecto>); onConvert() }}
                disabled={saving}
              >
                <UserPlus className="w-4 h-4 mr-1" /> Pasar a contratos
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-1">{title}</h3>
      {children}
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-500 font-medium block mb-1">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
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
    <div>
      <span className="text-xs text-gray-500 font-medium block mb-1.5">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              value === opt.value
                ? 'bg-[#002855] text-white border-[#002855]'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
