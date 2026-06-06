'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  calculateWitnessProgress,
  isWitnessComplete,
  type WitnessField,
  type WitnessLetterValue,
  type WitnessSection,
} from '@/lib/legal/asilo-testigos-form-schema'
import { useAutosave } from '@/lib/hooks/use-autosave'

interface ApiResponse {
  case_id: string
  form_instance_id: string | null
  current_phase: string | null
  sections: WitnessSection[]
  witnesses: WitnessLetterValue[]
  progress: ReturnType<typeof calculateWitnessProgress>
  locked_for_client: boolean
  status: string | null
}

interface WitnessLettersWizardProps {
  token: string
  /** Llamada al cerrar — el padre debe refrescar required-forms. */
  onClose: () => void
}

const inputStyle = {
  background: 'var(--color-ulp-surface-container-low)',
  borderColor: 'var(--color-ulp-outline-variant)',
  color: 'var(--color-ulp-on-surface)',
} as const

export function WitnessLettersWizard({ token, onClose }: WitnessLettersWizardProps) {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [witnesses, setWitnesses] = useState<WitnessLetterValue[]>([])
  const [expanded, setExpanded] = useState<number | null>(0)
  const [submitting, setSubmitting] = useState(false)
  const lastSavedRef = useRef<string>('')

  // Carga inicial
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/cita/${encodeURIComponent(token)}/asilo-testigos`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) {
          const t = await r.text()
          throw new Error(t || 'No se pudo cargar el formulario de testigos')
        }
        return r.json() as Promise<ApiResponse>
      })
      .then((json) => {
        if (cancelled) return
        setData(json)
        setWitnesses(json.witnesses ?? [])
        setExpanded(json.witnesses && json.witnesses.length > 0 ? 0 : null)
        lastSavedRef.current = JSON.stringify(json.witnesses ?? [])
      })
      .catch((err) => {
        if (cancelled) return
        toast.error(err instanceof Error ? err.message : 'Error al cargar')
        onClose()
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [token, onClose])

  // Bloquear scroll del body
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const progress = useMemo(() => calculateWitnessProgress(witnesses), [witnesses])

  // Autosave a prueba de pérdidas (debounce + reintento + beforeunload/visibilitychange + guardado al desmontar)
  const autosave = useAutosave<WitnessLetterValue[]>({
    save: async (w) => {
      const serialized = JSON.stringify(w)
      // Evita re-enviar un snapshot idéntico al último confirmado.
      if (serialized === lastSavedRef.current) return true
      const r = await fetch(`/api/cita/${encodeURIComponent(token)}/asilo-testigos`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ witnesses: w }),
      })
      if (r.ok) lastSavedRef.current = serialized
      return r.ok
    },
    beacon: (w) => [
      {
        url: `/api/cita/${encodeURIComponent(token)}/asilo-testigos`,
        method: 'PUT',
        body: JSON.stringify({ witnesses: w }),
      },
    ],
  })

  const locked = Boolean(data?.locked_for_client)

  const setWitnessField = useCallback(
    (index: number, key: keyof WitnessLetterValue, value: string | boolean) => {
      setWitnesses((prev) => {
        const next = prev.map((w, i) => (i === index ? { ...w, [key]: value } : w))
        autosave.schedule(next)
        return next
      })
    },
    [autosave],
  )

  const addWitness = useCallback(() => {
    setWitnesses((prev) => {
      const next = [...prev, {} as WitnessLetterValue]
      setExpanded(next.length - 1)
      autosave.schedule(next)
      return next
    })
  }, [autosave])

  const removeWitness = useCallback(
    (index: number) => {
      setWitnesses((prev) => {
        const next = prev.filter((_, i) => i !== index)
        autosave.schedule(next)
        return next
      })
      setExpanded(null)
    },
    [autosave],
  )

  const handleSubmit = useCallback(async () => {
    await autosave.flush()
    setSubmitting(true)
    try {
      const res = await fetch(`/api/cita/${encodeURIComponent(token)}/asilo-testigos/submit`, {
        method: 'POST',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null
        throw new Error(body?.error ?? 'No se pudo enviar')
      }
      toast.success('Testigos enviados a tu equipo legal')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al enviar')
    } finally {
      setSubmitting(false)
    }
  }, [autosave, onClose, token])

  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-3">
        <span
          className="material-symbols-outlined animate-spin"
          style={{ fontSize: 32, color: 'var(--color-ulp-primary)' }}
        >
          progress_activity
        </span>
        <p className="text-sm text-gray-600">Cargando tus testigos…</p>
      </div>
    )
  }

  const canSubmit = !locked && witnesses.some(isWitnessComplete)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header con progreso */}
      <div
        className="flex-shrink-0 px-5 sm:px-8 py-3 border-b"
        style={{
          background: 'var(--color-ulp-surface-container-lowest)',
          borderColor: 'var(--color-ulp-outline-variant)',
        }}
      >
        <div className="flex items-center justify-between gap-3 mb-2">
          <div>
            <p className="ulp-label" style={{ color: 'var(--color-ulp-outline)' }}>Formulario</p>
            <h2 className="ulp-h3 italic" style={{ color: 'var(--color-ulp-on-secondary-fixed)' }}>
              Cartas de Testigos
            </h2>
          </div>
          <span className="flex items-center gap-2 text-[11px] tabular-nums" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
            <span>{progress.completeWitnesses}/{progress.witnessCount} testigos listos</span>
            <SaveBadge state={autosave.saveState} />
          </span>
        </div>
        <p className="text-[12px]" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
          {locked
            ? '🔒 El formulario está bloqueado por tu equipo legal.'
            : 'Agrega a las personas que vieron lo que viviste. Con estos datos tu equipo legal redacta la declaración jurada de cada testigo. Se guarda automáticamente.'}
        </p>
      </div>

      {/* Lista de testigos */}
      <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 space-y-4 max-w-3xl mx-auto w-full">
        {witnesses.length === 0 ? (
          <div
            className="rounded-2xl border-2 border-dashed p-8 text-center"
            style={{ borderColor: 'var(--color-ulp-outline-variant)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 40, color: 'var(--color-ulp-outline)' }}>
              groups
            </span>
            <p className="text-sm mt-2" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
              Aún no has agregado testigos. Un testigo es alguien que vio o vivió de cerca lo que te pasó.
            </p>
          </div>
        ) : (
          witnesses.map((w, i) => (
            <WitnessCard
              key={i}
              index={i}
              witness={w}
              sections={data.sections}
              expanded={expanded === i}
              disabled={locked || submitting}
              onToggle={() => setExpanded(expanded === i ? null : i)}
              onChange={(key, value) => setWitnessField(i, key, value)}
              onRemove={() => removeWitness(i)}
            />
          ))
        )}

        {!locked && witnesses.length < 20 && (
          <button
            type="button"
            onClick={addWitness}
            disabled={submitting}
            className="w-full px-4 py-3 rounded-2xl text-sm font-bold border-2 border-dashed"
            style={{ borderColor: 'var(--color-ulp-outline)', color: 'var(--color-ulp-primary)' }}
          >
            + Agregar testigo
          </button>
        )}
      </div>

      {/* Footer */}
      <footer
        className="flex-shrink-0 px-5 sm:px-8 py-3 flex items-center justify-between gap-3 border-t"
        style={{
          borderColor: 'var(--color-ulp-outline-variant)',
          background: 'var(--color-ulp-surface-container-lowest)',
          paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
        }}
      >
        <button
          type="button"
          onClick={async () => { await autosave.flush(); onClose() }}
          className="px-4 py-2 rounded-full text-sm font-bold"
          style={{ background: 'var(--color-ulp-surface-container)', color: 'var(--color-ulp-on-surface)' }}
        >
          Cerrar
        </button>
        <button
          type="button"
          disabled={!canSubmit || submitting}
          onClick={handleSubmit}
          className="px-4 py-2 rounded-full text-sm font-bold disabled:opacity-50"
          style={{ background: 'var(--color-ulp-primary-container)', color: 'var(--color-ulp-on-primary-container)' }}
        >
          {submitting ? 'Enviando…' : 'Enviar a mi equipo'}
        </button>
      </footer>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────
// Sub-componentes
// ──────────────────────────────────────────────────────────────────

function SaveBadge({ state }: { state: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (state === 'idle') return null
  const map = {
    saving: { label: 'Guardando…', icon: 'progress_activity', color: 'rgb(180 83 9)' },
    saved: { label: 'Guardado', icon: 'check', color: 'rgb(4 120 87)' },
    error: { label: 'Error', icon: 'error', color: 'rgb(185 28 28)' },
  }[state]
  return (
    <span className="inline-flex items-center gap-1 font-semibold" style={{ color: map.color }}>
      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{map.icon}</span>
      {map.label}
    </span>
  )
}

function WitnessCard({
  index,
  witness,
  sections,
  expanded,
  disabled,
  onToggle,
  onChange,
  onRemove,
}: {
  index: number
  witness: WitnessLetterValue
  sections: WitnessSection[]
  expanded: boolean
  disabled: boolean
  onToggle: () => void
  onChange: (key: keyof WitnessLetterValue, value: string | boolean) => void
  onRemove: () => void
}) {
  const complete = isWitnessComplete(witness)
  const title = witness.full_name?.trim() || `Testigo #${index + 1}`
  return (
    <section
      className="rounded-2xl border overflow-hidden"
      style={{ background: 'var(--color-ulp-surface-container-lowest)', borderColor: 'var(--color-ulp-outline-variant)' }}
    >
      <header className="flex items-center gap-2 px-4 py-3">
        <button type="button" onClick={onToggle} className="flex items-center gap-2 flex-1 text-left">
          <span
            className="material-symbols-outlined flex-shrink-0"
            style={{ fontSize: 20, color: complete ? 'rgb(4 120 87)' : 'var(--color-ulp-outline)' }}
            data-fill={complete ? '1' : '0'}
          >
            {complete ? 'check_circle' : 'person'}
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
              Testigo {index + 1}
            </span>
            <span className="text-sm font-semibold" style={{ color: 'var(--color-ulp-on-surface)' }}>{title}</span>
          </span>
        </button>
        {!disabled && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs underline mr-1"
            style={{ color: 'rgb(185 28 28)' }}
          >
            Quitar
          </button>
        )}
        <button type="button" onClick={onToggle} className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--color-ulp-outline)' }}>
          {expanded ? 'expand_less' : 'expand_more'}
        </button>
      </header>

      {expanded && (
        <div className="px-4 pb-5 space-y-6 border-t" style={{ borderColor: 'var(--color-ulp-outline-variant)' }}>
          {sections.map((section) => (
            <div key={section.id} className="pt-4 space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--color-ulp-on-surface)' }}>
                  {section.titleEs}
                </h3>
                {section.descriptionEs && (
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
                    {section.descriptionEs}
                  </p>
                )}
              </div>
              {section.fields.map((field) => (
                <FieldInput
                  key={field.key}
                  field={field}
                  value={witness[field.key]}
                  disabled={disabled}
                  onChange={(v) => onChange(field.key, v)}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function FieldInput({
  field,
  value,
  disabled,
  onChange,
}: {
  field: WitnessField
  value: string | boolean | undefined
  disabled: boolean
  onChange: (v: string | boolean) => void
}) {
  if (field.type === 'checkbox') {
    return (
      <label className="flex items-start gap-2 text-sm cursor-pointer" style={{ color: 'var(--color-ulp-on-surface)' }}>
        <input
          type="checkbox"
          checked={Boolean(value)}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 w-4 h-4 flex-shrink-0"
        />
        <span>{field.labelEs}</span>
      </label>
    )
  }

  const labelBlock = (
    <div>
      <label className="ulp-label block mb-1" style={{ color: 'var(--color-ulp-on-surface)' }}>
        {field.labelEs}
        {field.required && <span style={{ color: 'rgb(185 28 28)' }}> *</span>}
      </label>
      {field.helpEs && (
        <p className="text-[12px] mb-2" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
          {field.helpEs}
        </p>
      )}
    </div>
  )

  const strValue = typeof value === 'string' ? value : ''

  if (field.type === 'textarea') {
    return (
      <div>
        {labelBlock}
        <textarea
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={field.placeholderEs}
          maxLength={field.maxLength}
          rows={4}
          className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2"
          style={inputStyle}
        />
        {field.maxLength && (
          <p className="text-[11px] mt-1 text-right" style={{ color: 'var(--color-ulp-outline)' }}>
            {strValue.length} / {field.maxLength}
          </p>
        )}
      </div>
    )
  }

  if (field.type === 'select') {
    return (
      <div>
        {labelBlock}
        <select
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2"
          style={inputStyle}
        >
          <option value="">— Selecciona —</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.labelEs}</option>
          ))}
        </select>
      </div>
    )
  }

  // text | date
  return (
    <div>
      {labelBlock}
      <input
        type={field.type === 'date' ? 'date' : 'text'}
        value={strValue}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={field.placeholderEs}
        maxLength={field.maxLength}
        className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2"
        style={inputStyle}
      />
    </div>
  )
}
