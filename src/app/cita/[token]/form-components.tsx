'use client'

import { useState } from 'react'
import { AlertCircle, HelpCircle } from 'lucide-react'

/**
 * Sentinel value almacenado en el formulario cuando el cliente marcó
 * explícitamente "No tengo este dato". Esto se diferencia de `""`
 * (no llenado aún) y permite al generador de declaraciones tratarlo
 * sin `[FALTA:...]` — redactando algo como "el declarante manifiesta
 * no conocer este dato".
 */
export const UNKNOWN_VALUE = '__UNKNOWN__'

export function isUnknown(v: unknown): boolean {
  return typeof v === 'string' && v.trim() === UNKNOWN_VALUE
}

/**
 * Normaliza un valor para guardado: si está marcado como UNKNOWN o vacío,
 * lo devuelve tal cual. Si trae contenido, lo trimea.
 */
export function normalizeFormValue(v: string): string {
  if (isUnknown(v)) return UNKNOWN_VALUE
  return v.trim()
}

/**
 * Detecta valores "basura" que suelen dar los clientes cuando no saben
 * un dato: 00000, espacios, guiones solitarios, "nose", "nada", etc.
 * Se considera inválido si es un intento de "llenar por llenar".
 */
export function looksLikeJunk(v: string): boolean {
  if (!v) return false
  const trimmed = v.trim().toLowerCase()
  if (trimmed.length === 0) return false
  if (trimmed.length < 2) return true
  if (/^0+$/.test(trimmed)) return true
  if (/^-+$/.test(trimmed)) return true
  if (/^\.+$/.test(trimmed)) return true
  if (/^(nose|no sé|no se|nada|ninguno|ninguna|na|nn|xxx+|aaa+)$/i.test(trimmed)) return true
  return false
}

export function FieldLabel({
  children,
  required,
  help,
}: {
  children: React.ReactNode
  required?: boolean
  help?: string
}) {
  const [showHelp, setShowHelp] = useState(false)
  return (
    <div className="flex items-start gap-1.5 mb-1.5 relative">
      <label className="text-sm font-medium text-gray-700">
        {children}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {help && (
        <button
          type="button"
          onClick={() => setShowHelp(v => !v)}
          onBlur={() => setShowHelp(false)}
          className="mt-0.5 text-gray-400 hover:text-[#F2A900] transition-colors"
          aria-label="Ayuda sobre este campo"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      )}
      {showHelp && help && (
        <div className="absolute top-6 left-0 z-10 max-w-sm p-3 rounded-xl bg-[#002855] text-white text-xs leading-relaxed shadow-xl">
          {help}
        </div>
      )}
    </div>
  )
}

/**
 * Input de texto con validación de basura y soporte para
 * "No tengo este dato". Diseñado para campos legales donde un valor
 * incorrecto (00000, "nose") es peor que un campo vacío.
 */
export function LegalFieldInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  allowUnknown = true,
  unknownLabel = 'No tengo este dato',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  allowUnknown?: boolean
  unknownLabel?: string
}) {
  const unknown = isUnknown(value)
  const junk = !unknown && looksLikeJunk(value)

  const borderClass = unknown
    ? 'border-gray-300 bg-gray-100 text-gray-500 italic'
    : junk
      ? 'border-red-300 bg-red-50 focus:ring-red-300/40'
      : 'border-gray-200 focus:ring-[#F2A900]/40'

  return (
    <div className="space-y-1.5">
      <input
        type={type}
        value={unknown ? '' : value}
        onChange={e => onChange(e.target.value)}
        placeholder={unknown ? unknownLabel : placeholder}
        disabled={unknown}
        className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-colors ${borderClass}`}
      />
      {junk && (
        <p className="flex items-start gap-1.5 text-xs text-red-600 leading-snug">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>
            Este campo aparecerá en un documento legal firmado ante corte. Ingrese el dato real,
            o marque <strong>&ldquo;{unknownLabel}&rdquo;</strong> si no lo conoce.
          </span>
        </p>
      )}
      {allowUnknown && (
        <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none hover:text-gray-700">
          <input
            type="checkbox"
            checked={unknown}
            onChange={e => onChange(e.target.checked ? UNKNOWN_VALUE : '')}
            className="rounded border-gray-300 text-[#F2A900] focus:ring-[#F2A900]/40"
          />
          <span>{unknownLabel}</span>
        </label>
      )}
    </div>
  )
}

/**
 * Input de texto regular con validación anti-basura (sin checkbox
 * "No tengo este dato"). Para campos donde no tiene sentido "no saber"
 * (ej: nombre propio del cliente).
 */
export function ValidatedInput({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  const junk = looksLikeJunk(value)
  const borderClass = junk
    ? 'border-red-300 bg-red-50 focus:ring-red-300/40'
    : 'border-gray-200 focus:ring-[#F2A900]/40'

  return (
    <div className="space-y-1">
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-colors ${borderClass}`}
      />
      {junk && (
        <p className="flex items-start gap-1.5 text-xs text-red-600 leading-snug">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>Ingrese un valor real. Este dato aparecerá en un documento legal.</span>
        </p>
      )}
    </div>
  )
}
