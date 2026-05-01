'use client'

import { useState, useRef, useEffect } from 'react'
import { VoiceTextarea } from '@/components/voice/VoiceTextarea'
import { usStates } from '@/lib/data/us-states'
import { countries } from '@/lib/data/countries'
import type { I360Field } from './i360-questions'

/**
 * Componentes UI reusables para el wizard I-360. Diseñados para verse
 * bien tanto en el portal cliente (modal fullscreen) como en el panel
 * admin (modal regular). Usan estilos Tailwind con paleta neutral —
 * compatibles con cualquier contexto.
 */

// ─────────────────────────────────────────────────────────────────
// Common label + help + tooltip
// ─────────────────────────────────────────────────────────────────

interface LabelHelpProps {
  label: string
  help?: string
  required?: boolean
  prefilled?: boolean
}

function LabelWithHelp({ label, help, required, prefilled }: LabelHelpProps) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
      <label className="text-sm font-semibold text-gray-800">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {prefilled && (
        <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full border border-emerald-100 font-semibold">
          Pre-llenado
        </span>
      )}
      {help && (
        <div className="relative inline-block">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            className="w-4 h-4 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center justify-center hover:bg-amber-200 transition-colors"
            aria-label="Más información"
          >
            i
          </button>
          {open && (
            <div className="absolute z-30 left-1/2 -translate-x-1/2 mt-1 w-64 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl pointer-events-none">
              {help}
              <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// LabeledText (text, email, phone, ssn, a_number)
// ─────────────────────────────────────────────────────────────────

interface LabeledTextProps {
  field: I360Field
  value: string
  onChange: (v: string) => void
  prefilled?: boolean
}

export function LabeledText({ field, value, onChange, prefilled }: LabeledTextProps) {
  const inputType =
    field.type === 'email' ? 'email' :
    field.type === 'phone' ? 'tel' :
    'text'
  return (
    <div>
      <LabelWithHelp label={field.label} help={field.help} required={field.required} prefilled={prefilled} />
      <input
        type={inputType}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 transition-colors"
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// LabeledDate (HTML5 date with nicer styling)
// ─────────────────────────────────────────────────────────────────

export function LabeledDate({ field, value, onChange, prefilled }: LabeledTextProps) {
  return (
    <div>
      <LabelWithHelp label={field.label} help={field.help} required={field.required} prefilled={prefilled} />
      <input
        type="date"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 transition-colors"
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// LabeledSelect (native select with custom styling)
// ─────────────────────────────────────────────────────────────────

export function LabeledSelect({ field, value, onChange, prefilled }: LabeledTextProps) {
  return (
    <div>
      <LabelWithHelp label={field.label} help={field.help} required={field.required} prefilled={prefilled} />
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 transition-colors"
      >
        <option value="" disabled>
          Selecciona una opción
        </option>
        {(field.options ?? []).map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// YesNoButtons (large pill buttons)
// ─────────────────────────────────────────────────────────────────

export function YesNoButtons({ field, value, onChange, prefilled }: LabeledTextProps) {
  return (
    <div>
      <LabelWithHelp label={field.label} help={field.help} required={field.required} prefilled={prefilled} />
      <div className="flex gap-2">
        {['Sí', 'No'].map((opt) => {
          const active = value === opt
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`flex-1 max-w-[140px] py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                active
                  ? 'border-amber-500 bg-amber-50 text-amber-800 shadow-sm'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// MultiSelectChips (checkboxes as chips, value is comma-separated string
// or array; normalized to array internally then serialized as JSON-like
// string array)
// ─────────────────────────────────────────────────────────────────

interface MultiSelectProps {
  field: I360Field
  value: string | string[]
  onChange: (v: string[]) => void
  prefilled?: boolean
}

export function MultiSelectChips({ field, value, onChange, prefilled }: MultiSelectProps) {
  const arr: string[] = Array.isArray(value)
    ? value
    : typeof value === 'string' && value
      ? value.split(',').map((s) => s.trim()).filter(Boolean)
      : []

  function toggle(v: string) {
    if (arr.includes(v)) onChange(arr.filter((x) => x !== v))
    else onChange([...arr, v])
  }

  return (
    <div>
      <LabelWithHelp label={field.label} help={field.help} required={field.required} prefilled={prefilled} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {(field.options ?? []).map((opt) => {
          const active = arr.includes(opt.value)
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className={`text-left px-3 py-2.5 rounded-xl border-2 text-sm transition-all flex items-center gap-2 ${
                active
                  ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-sm'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              <span
                className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                  active ? 'border-amber-500 bg-amber-500' : 'border-gray-300 bg-white'
                }`}
              >
                {active && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              <span className="font-medium">{opt.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// SearchableSelect (US states, countries) — custom searchable popover
// ─────────────────────────────────────────────────────────────────

interface SearchableSelectProps {
  field: I360Field
  value: string
  onChange: (v: string) => void
  prefilled?: boolean
  options: { value: string; label: string }[]
  placeholder?: string
}

export function SearchableSelect({
  field,
  value,
  onChange,
  prefilled,
  options,
  placeholder = 'Selecciona…',
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options
  const selected = options.find((o) => o.value === value)

  return (
    <div ref={containerRef} className="relative">
      <LabelWithHelp label={field.label} help={field.help} required={field.required} prefilled={prefilled} />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-white text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400"
      >
        <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar…"
              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400"
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-3">Sin resultados</p>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value)
                    setOpen(false)
                    setSearch('')
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-amber-50 transition-colors ${
                    value === opt.value ? 'bg-amber-100 font-semibold text-amber-900' : 'text-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function LabeledUSState(props: Omit<SearchableSelectProps, 'options' | 'placeholder'>) {
  return <SearchableSelect {...props} options={usStates} placeholder="Selecciona un estado de EE.UU." />
}

export function LabeledCountry(props: Omit<SearchableSelectProps, 'options' | 'placeholder'>) {
  return <SearchableSelect {...props} options={countries} placeholder="Selecciona un país" />
}

// ─────────────────────────────────────────────────────────────────
// LabeledVoiceTextarea (with optional voice; falls back to plain
// textarea if no token)
// ─────────────────────────────────────────────────────────────────

interface LabeledVoiceProps {
  field: I360Field
  value: string
  onChange: (v: string) => void
  prefilled?: boolean
  /** Token de la cita; si está presente, habilita voice input. */
  voiceToken?: string | null
}

export function LabeledVoiceTextarea({
  field,
  value,
  onChange,
  prefilled,
  voiceToken,
}: LabeledVoiceProps) {
  return (
    <div>
      <LabelWithHelp label={field.label} help={field.help} required={field.required} prefilled={prefilled} />
      {voiceToken ? (
        <VoiceTextarea
          token={voiceToken}
          value={value || ''}
          onChange={onChange}
          placeholder={field.placeholder}
          rows={4}
          hint={
            field.help
              ? undefined
              : 'Tip: si te cuesta escribir, toca el botón de micrófono y cuéntalo en voz alta.'
          }
        />
      ) : (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={4}
          className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 resize-none transition-colors"
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// SaveIndicator (Guardando.../Guardado/Error)
// ─────────────────────────────────────────────────────────────────

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function SaveIndicator({ state, lastSavedAt }: { state: SaveState; lastSavedAt?: string | null }) {
  if (state === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-blue-600 font-medium">
        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        Guardando…
      </span>
    )
  }
  if (state === 'saved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
        Guardado
      </span>
    )
  }
  if (state === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-rose-600 font-medium">
        <span className="w-2 h-2 rounded-full bg-rose-500" />
        Error al guardar
      </span>
    )
  }
  if (lastSavedAt) {
    const date = new Date(lastSavedAt)
    return (
      <span className="text-xs text-gray-400">
        Última edición: {date.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
      </span>
    )
  }
  return <span className="text-xs text-gray-400">Se guarda automáticamente</span>
}

// ─────────────────────────────────────────────────────────────────
// SectionHeader
// ─────────────────────────────────────────────────────────────────

export function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="border-l-4 border-amber-400 pl-3">
      <h3 className="text-base font-bold text-gray-900">{title}</h3>
      {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
    </div>
  )
}
