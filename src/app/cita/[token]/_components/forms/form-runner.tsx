'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import type { FormDetail, ClientField } from './types'
import { SOURCE_LABEL } from './types'

interface FormRunnerProps {
  token: string
  slug: string
  onClose: () => void
  onSubmitted: () => void
}

export function FormRunner({ token, slug, onClose, onSubmitted }: FormRunnerProps) {
  const [data, setData] = useState<FormDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [values, setValues] = useState<Record<string, string | boolean | null>>({})
  const [activeSection, setActiveSection] = useState(0)
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [submitting, setSubmitting] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cargar form
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/cita/${encodeURIComponent(token)}/forms/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    })
      .then((r) => {
        if (!r.ok) throw new Error('Error al cargar formulario')
        return r.json()
      })
      .then((j: FormDetail) => {
        if (cancelled) return
        setData(j)
        setValues({ ...(j.saved_values ?? {}) })
      })
      .catch((err) => {
        if (cancelled) return
        toast.error(err instanceof Error ? err.message : 'Error')
        onClose()
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, slug, onClose])

  // Autosave debounced
  const saveValues = useCallback(
    async (toSave: Record<string, string | boolean | null>) => {
      setSavingState('saving')
      try {
        const res = await fetch(`/api/cita/${encodeURIComponent(token)}/forms/${encodeURIComponent(slug)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: toSave }),
        })
        if (!res.ok) throw new Error('Error al guardar')
        setSavingState('saved')
      } catch {
        setSavingState('error')
        toast.error('Error al guardar')
      }
    },
    [token, slug],
  )

  function setField(key: string, val: string | boolean | null) {
    setValues((prev) => {
      const next = { ...prev, [key]: val }
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        // Solo enviar el cambio incremental
        saveValues({ [key]: val })
      }, 800)
      return next
    })
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      // Asegurar último guardado
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        await saveValues(values)
      }
      const res = await fetch(`/api/cita/${encodeURIComponent(token)}/forms/${encodeURIComponent(slug)}/submit`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Error al enviar')
      toast.success('Formulario enviado a tu equipo legal')
      onSubmitted()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <FullscreenDrawer onClose={onClose} title="Cargando formulario...">
        <div className="p-8 text-center">
          <span
            className="material-symbols-outlined animate-spin"
            style={{ fontSize: 32, color: 'var(--color-ulp-primary)' }}
          >
            progress_activity
          </span>
        </div>
      </FullscreenDrawer>
    )
  }

  if (!data) return null

  const totalSections = data.sections.length
  const isLastSection = activeSection >= totalSections - 1
  const allComplete = data.sections.every((s) =>
    s.fields.every((f) => !f.required || hasValue(values[f.semanticKey])),
  )

  // Si el form no tiene secciones (todo viene auto-resuelto), mostrar review pantalla
  const isAllAutoResolved = totalSections === 0

  return (
    <FullscreenDrawer onClose={onClose} title={data.form_name}>
      <div className="flex flex-col h-full">
        {/* Status de guardado */}
        <div
          className="px-4 py-2 flex items-center justify-between text-[11px] border-b"
          style={{
            background: 'var(--color-ulp-surface-container-low)',
            borderColor: 'var(--color-ulp-outline-variant)',
          }}
        >
          <span style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
            {data.state ? `Estado: ${data.state} · ` : ''}
            {data.locked_for_client ? '🔒 Bloqueado por tu equipo legal' : 'Tus respuestas se guardan automáticamente'}
          </span>
          <SaveBadge state={savingState} />
        </div>

        <div className="flex-1 overflow-y-auto">
          {data.confirmed_values.length > 0 && activeSection === 0 && (
            <ConfirmedValuesPanel values={data.confirmed_values} />
          )}

          {isAllAutoResolved ? (
            <div className="p-6 text-center space-y-3">
              <span
                className="material-symbols-outlined block mx-auto"
                data-fill="1"
                style={{ fontSize: 56, color: 'var(--color-ulp-status-approved)' }}
              >
                check_circle
              </span>
              <p className="ulp-body-md font-semibold">¡Todo listo!</p>
              <p className="ulp-body-sm" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
                Este formulario se llena automáticamente con datos que tu equipo ya tiene. No
                necesitas hacer nada — Diana lo revisará e imprimirá cuando esté lista.
              </p>
            </div>
          ) : (
            <SectionRenderer
              section={data.sections[activeSection]}
              values={values}
              setField={setField}
              disabled={data.locked_for_client || submitting}
            />
          )}
        </div>

        {/* Footer navegación */}
        {!isAllAutoResolved && (
          <footer
            className="px-4 py-3 flex items-center justify-between gap-3 border-t"
            style={{ borderColor: 'var(--color-ulp-outline-variant)', background: 'var(--color-ulp-surface-container-lowest)' }}
          >
            <button
              type="button"
              disabled={activeSection === 0}
              onClick={() => setActiveSection((s) => Math.max(0, s - 1))}
              className="px-4 py-2 rounded-full text-sm font-bold disabled:opacity-30"
              style={{ background: 'var(--color-ulp-surface-container)', color: 'var(--color-ulp-on-surface)' }}
            >
              ← Anterior
            </button>
            <span className="text-[11px] tabular-nums" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
              {activeSection + 1} de {totalSections}
            </span>
            {isLastSection ? (
              <button
                type="button"
                disabled={!allComplete || submitting || data.locked_for_client}
                onClick={handleSubmit}
                className="px-4 py-2 rounded-full text-sm font-bold disabled:opacity-50"
                style={{ background: 'var(--color-ulp-primary-container)', color: 'var(--color-ulp-on-primary-container)' }}
              >
                {submitting ? 'Enviando...' : 'Enviar a revisión'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveSection((s) => Math.min(totalSections - 1, s + 1))}
                className="px-4 py-2 rounded-full text-sm font-bold"
                style={{ background: 'var(--color-ulp-primary-container)', color: 'var(--color-ulp-on-primary-container)' }}
              >
                Siguiente →
              </button>
            )}
          </footer>
        )}
      </div>
    </FullscreenDrawer>
  )
}

function FullscreenDrawer({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/40" onClick={onClose}>
      <div
        className="mt-auto sm:mt-12 sm:mx-auto bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-2xl flex-1 sm:max-h-[88vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header
          className="px-4 py-3 flex items-center gap-3 border-b"
          style={{ borderColor: 'var(--color-ulp-outline-variant)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'var(--color-ulp-surface-container)' }}
            aria-label="Cerrar"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
              close
            </span>
          </button>
          <h2 className="ulp-body-md font-bold flex-1 truncate" style={{ color: 'var(--color-ulp-on-surface)' }}>
            {title}
          </h2>
        </header>
        {children}
      </div>
    </div>
  )
}

function SaveBadge({ state }: { state: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (state === 'idle') return null
  const map = {
    saving: { label: 'Guardando...', icon: 'progress_activity', color: 'rgb(180 83 9)' },
    saved: { label: 'Guardado', icon: 'check', color: 'rgb(4 120 87)' },
    error: { label: 'Error al guardar', icon: 'error', color: 'rgb(185 28 28)' },
  }[state]
  return (
    <span className="inline-flex items-center gap-1 font-semibold" style={{ color: map.color }}>
      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{map.icon}</span>
      {map.label}
    </span>
  )
}

function ConfirmedValuesPanel({ values }: { values: FormDetail['confirmed_values'] }) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <section
      className="px-4 py-3 border-b"
      style={{
        background: 'var(--color-ulp-primary-fixed)',
        borderColor: 'var(--color-ulp-outline-variant)',
      }}
    >
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center gap-2 text-left"
      >
        <span
          className="material-symbols-outlined"
          data-fill="1"
          style={{ fontSize: 18, color: 'var(--color-ulp-primary)' }}
        >
          verified
        </span>
        <p className="ulp-body-sm font-semibold flex-1" style={{ color: 'var(--color-ulp-primary)' }}>
          {values.length} datos ya confirmados (no necesitas llenarlos)
        </p>
        <span
          className="material-symbols-outlined transition-transform"
          style={{
            fontSize: 18,
            color: 'var(--color-ulp-primary)',
            transform: collapsed ? 'rotate(0)' : 'rotate(180deg)',
          }}
        >
          expand_more
        </span>
      </button>
      {!collapsed && (
        <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto">
          {values.map((cv) => (
            <li key={cv.semanticKey} className="text-[11px] flex items-baseline gap-2">
              <span style={{ color: 'var(--color-ulp-on-surface-variant)' }}>{cv.labelEs}:</span>
              <span className="font-semibold" style={{ color: 'var(--color-ulp-on-surface)' }}>
                {formatConfirmedValue(cv.value)}
              </span>
              <span className="text-[9px] ml-auto opacity-70 flex-shrink-0" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
                {SOURCE_LABEL[cv.source]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function formatConfirmedValue(v: string | boolean | null): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (v === '') return '—'
  return v
}

function SectionRenderer({
  section,
  values,
  setField,
  disabled,
}: {
  section: ClientSection
  values: Record<string, string | boolean | null>
  setField: (key: string, val: string | boolean | null) => void
  disabled: boolean
}) {
  if (!section) return null
  return (
    <div className="p-5 space-y-5">
      <header>
        <h3 className="ulp-h3" style={{ fontSize: 22, color: 'var(--color-ulp-on-surface)' }}>
          {section.titleEs}
        </h3>
        <p className="ulp-body-sm mt-1" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
          {section.descriptionEs}
        </p>
      </header>
      <div className="space-y-4">
        {section.fields.map((field) => (
          <FieldRenderer
            key={field.semanticKey}
            field={field}
            value={values[field.semanticKey]}
            onChange={(v) => setField(field.semanticKey, v)}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  )
}

interface ClientSection {
  id: number
  titleEs: string
  descriptionEs: string
  fields: ClientField[]
}

function FieldRenderer({
  field,
  value,
  onChange,
  disabled,
}: {
  field: ClientField
  value: string | boolean | null | undefined
  onChange: (v: string | boolean | null) => void
  disabled: boolean
}) {
  const inputStyle = {
    background: 'var(--color-ulp-surface-container-low)',
    borderColor: 'var(--color-ulp-outline-variant)',
    color: 'var(--color-ulp-on-surface)',
  }
  const baseLabel = (
    <label
      htmlFor={field.semanticKey}
      className="ulp-label block mb-1.5"
      style={{ color: 'var(--color-ulp-on-surface-variant)' }}
    >
      {field.labelEs}{' '}
      {field.required && <span style={{ color: 'rgb(185 28 28)' }}>*</span>}
    </label>
  )
  const help = field.helpEs && (
    <p className="text-[11px] mt-1" style={{ color: 'var(--color-ulp-outline)' }}>
      {field.helpEs}
    </p>
  )

  if (field.type === 'checkbox') {
    return (
      <div className="flex items-start gap-3">
        <input
          id={field.semanticKey}
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="mt-1 w-4 h-4"
        />
        <div className="flex-1">
          <label htmlFor={field.semanticKey} className="ulp-body-sm" style={{ color: 'var(--color-ulp-on-surface)' }}>
            {field.labelEs}
          </label>
          {help}
        </div>
      </div>
    )
  }

  if (field.type === 'textarea') {
    return (
      <div>
        {baseLabel}
        <textarea
          id={field.semanticKey}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          maxLength={field.maxLength}
          rows={4}
          className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2"
          style={inputStyle}
        />
        {help}
      </div>
    )
  }

  const inputType =
    field.type === 'date' ? 'date'
    : field.type === 'phone' ? 'tel'
    : 'text'

  return (
    <div>
      {baseLabel}
      <input
        id={field.semanticKey}
        type={inputType}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        maxLength={field.maxLength}
        className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2"
        style={inputStyle}
      />
      {help}
    </div>
  )
}

function hasValue(v: string | boolean | null | undefined): boolean {
  if (v === null || v === undefined) return false
  if (typeof v === 'string') return v.trim().length > 0
  return true
}
