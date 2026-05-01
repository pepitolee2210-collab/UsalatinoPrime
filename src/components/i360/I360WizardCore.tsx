'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, CheckCircle, Loader2, Send } from 'lucide-react'
import {
  I360_STEPS,
  I360_ALL_FIELDS,
  type I360Field,
} from './i360-questions'
import {
  LabeledText,
  LabeledDate,
  LabeledSelect,
  LabeledUSState,
  LabeledCountry,
  YesNoButtons,
  MultiSelectChips,
  LabeledVoiceTextarea,
  SaveIndicator,
  SectionHeader,
  type SaveState,
} from './I360FieldRenderer'

/**
 * Wizard I-360 SIJS reusable para el portal del cliente y el panel admin.
 *
 * - Auto-guardado debounced (3.5s) con indicador visual.
 * - Validación de campos requeridos antes de avanzar de paso.
 * - Pre-llenado desde tutor_guardian, client_story (minorBasic) y
 *   client_absent_parent — pasados via prop `prefillSources`.
 * - Modo `client` guarda vía POST `/api/client-story` (form_type='i360_sijs').
 * - Modo `admin` guarda vía PUT `/api/admin/cases/[caseId]/i360-form`.
 * - Modo `admin` también permite reabrir un wizard ya enviado para correcciones.
 */

export type I360FormData = Record<string, string | string[] | undefined>

export interface I360WizardCoreProps {
  mode: 'client' | 'admin'
  /** Token de la cita; obligatorio en mode='client' (también habilita voice input). */
  token?: string
  /** ID del caso; obligatorio en mode='admin'. */
  caseId?: string
  clientName?: string
  /** Datos guardados previamente (form_data del registro). */
  initialData: I360FormData | null
  /** Datos pre-llenados desde otras fuentes (tutor, minor, padre ausente). */
  prefillSources?: Record<string, Record<string, unknown>>
  /** Status actual del registro: draft / submitted / approved. */
  initialStatus?: string | null
  /** Callback cuando se guarda con éxito (refresca el listado de Fases). */
  onSaved?: () => void
  /** Callback cuando se cierra el wizard (admin). */
  onClose?: () => void
}

// ────────────────────────────────────────────────────────────────────
// Pre-llenado desde fuentes
// ────────────────────────────────────────────────────────────────────

function buildPrefilled(
  sources: Record<string, Record<string, unknown>> = {},
): I360FormData {
  const tutor = (sources.tutor_guardian ?? {}) as Record<string, unknown>
  const story = (sources.client_story ?? {}) as Record<string, unknown>
  const mb = ((story.minorBasic as Record<string, unknown>) ?? {}) as Record<string, unknown>
  const absentParent = (sources.client_absent_parent ?? {}) as Record<string, unknown>

  const tutorName = String(tutor.full_name ?? '').trim()
  const tutorParts = tutorName.split(/\s+/)
  const minorName = String(mb.full_name ?? '').trim()
  const minorParts = minorName.split(/\s+/)

  const out: I360FormData = {}
  // Petitioner
  if (tutorParts.length >= 2) {
    out.petitioner_first_name = tutorParts.slice(0, -1).join(' ')
    out.petitioner_last_name = tutorParts[tutorParts.length - 1]
  }
  if (tutor.full_address) out.petitioner_address = String(tutor.full_address)

  // Beneficiary
  if (minorParts.length >= 2) {
    out.beneficiary_first_name = minorParts.slice(0, -2).join(' ') || minorParts[0]
    out.beneficiary_last_name = minorParts.slice(-2).join(' ')
  }
  if (mb.dob) out.beneficiary_dob = String(mb.dob)
  if (mb.country) out.beneficiary_country_birth = String(mb.country)
  if (mb.birth_city) out.beneficiary_city_birth = String(mb.birth_city)
  if (mb.address) out.beneficiary_address = String(mb.address)
  if (mb.civil_status) out.beneficiary_marital_status = String(mb.civil_status)
  if (mb.id_number) out.beneficiary_passport_number = String(mb.id_number)
  if (mb.a_number) out.beneficiary_a_number = String(mb.a_number)
  if (mb.ssn) out.beneficiary_ssn = String(mb.ssn)
  if (mb.i94_number) out.beneficiary_i94_number = String(mb.i94_number)
  if (mb.nonimmigrant_status)
    out.beneficiary_nonimmigrant_status = String(mb.nonimmigrant_status)
  if (mb.arrival_date) out.beneficiary_last_arrival_date = String(mb.arrival_date)
  if (mb.detained_by_immigration)
    out.in_removal_proceedings = mb.detained_by_immigration === 'Sí' ? 'Sí' : 'No'
  if (mb.released_by_orr)
    out.previously_hhs_custody = mb.released_by_orr === 'Sí' ? 'Sí' : 'No'

  // Absent parent
  if (absentParent.parent_name)
    out.parent_names_not_viable = String(absentParent.parent_name)

  return out
}

// ────────────────────────────────────────────────────────────────────
// Field renderer (dispatches to right component by type)
// ────────────────────────────────────────────────────────────────────

interface FieldDispatchProps {
  field: I360Field
  value: string | string[] | undefined
  onChange: (v: string | string[]) => void
  prefilled: boolean
  voiceToken?: string | null
}

function FieldDispatch({ field, value, onChange, prefilled, voiceToken }: FieldDispatchProps) {
  const stringValue = Array.isArray(value) ? value.join(',') : (value ?? '')
  const onChangeStr = (v: string) => onChange(v)

  switch (field.type) {
    case 'date':
      return <LabeledDate field={field} value={stringValue} onChange={onChangeStr} prefilled={prefilled} />
    case 'select':
      return <LabeledSelect field={field} value={stringValue} onChange={onChangeStr} prefilled={prefilled} />
    case 'us_state':
      return <LabeledUSState field={field} value={stringValue} onChange={onChangeStr} prefilled={prefilled} />
    case 'country':
      return <LabeledCountry field={field} value={stringValue} onChange={onChangeStr} prefilled={prefilled} />
    case 'yesno':
      return <YesNoButtons field={field} value={stringValue} onChange={onChangeStr} prefilled={prefilled} />
    case 'multiselect':
      return (
        <MultiSelectChips
          field={field}
          value={value ?? ''}
          onChange={(arr) => onChange(arr)}
          prefilled={prefilled}
        />
      )
    case 'voice_textarea':
      return (
        <LabeledVoiceTextarea
          field={field}
          value={stringValue}
          onChange={onChangeStr}
          prefilled={prefilled}
          voiceToken={voiceToken}
        />
      )
    case 'textarea':
      return (
        <LabeledVoiceTextarea
          field={field}
          value={stringValue}
          onChange={onChangeStr}
          prefilled={prefilled}
          voiceToken={null}
        />
      )
    default:
      return <LabeledText field={field} value={stringValue} onChange={onChangeStr} prefilled={prefilled} />
  }
}

// ────────────────────────────────────────────────────────────────────
// Save logic per mode
// ────────────────────────────────────────────────────────────────────

async function saveDraftClient(token: string, formData: I360FormData) {
  const res = await fetch('/api/client-story', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token,
      form_type: 'i360_sijs',
      form_data: formData,
      action: 'draft',
      minor_index: 0,
    }),
  })
  if (!res.ok) throw new Error('Error al guardar borrador')
}

async function submitClient(token: string, formData: I360FormData) {
  const res = await fetch('/api/client-story', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token,
      form_type: 'i360_sijs',
      form_data: formData,
      action: 'submit',
      minor_index: 0,
    }),
  })
  if (!res.ok) throw new Error('Error al enviar')
}

async function saveDraftAdmin(caseId: string, formData: I360FormData) {
  const res = await fetch(`/api/admin/cases/${encodeURIComponent(caseId)}/i360-form`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ form_data: formData, action: 'draft' }),
  })
  if (!res.ok) throw new Error('Error al guardar')
}

// ────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────

export function I360WizardCore({
  mode,
  token,
  caseId,
  clientName,
  initialData,
  prefillSources,
  initialStatus,
  onSaved,
  onClose,
}: I360WizardCoreProps) {
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set())

  // Pre-fill from sources, layered with saved data (saved takes priority)
  const prefilled = useMemo(() => buildPrefilled(prefillSources ?? {}), [prefillSources])
  const prefilledKeys = useMemo(() => new Set(Object.keys(prefilled)), [prefilled])

  const [data, setData] = useState<I360FormData>(() => {
    const merged: I360FormData = { ...prefilled }
    if (initialData) Object.assign(merged, initialData)
    return merged
  })

  const isSubmitted = initialStatus === 'submitted' || initialStatus === 'approved'
  const [submittedSuccess, setSubmittedSuccess] = useState(false)

  function upd(key: string, value: string | string[]) {
    setData((prev) => ({ ...prev, [key]: value }))
    if (validationErrors.has(key)) {
      setValidationErrors((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  // Auto-save debounced 3.5s
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dataRef = useRef(data)
  dataRef.current = data

  const doSave = useCallback(async () => {
    setSaveState('saving')
    try {
      if (mode === 'client' && token) {
        await saveDraftClient(token, dataRef.current)
      } else if (mode === 'admin' && caseId) {
        await saveDraftAdmin(caseId, dataRef.current)
      }
      setSaveState('saved')
      setLastSavedAt(new Date().toISOString())
      // Auto-vuelve a idle después de 2s para limpiar el badge
      setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 2000)
    } catch {
      setSaveState('error')
    }
  }, [mode, token, caseId])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      doSave()
    }, 3500)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  // Flush save al desmontar / cerrar (no perder último cambio)
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        // Save sync (fire-and-forget, no await — la página puede estar cerrándose)
        if (mode === 'client' && token) {
          saveDraftClient(token, dataRef.current).catch(() => {})
        } else if (mode === 'admin' && caseId) {
          saveDraftAdmin(caseId, dataRef.current).catch(() => {})
        }
      }
    }
  }, [mode, token, caseId])

  function visibleFieldsForStep(stepIdx: number): I360Field[] {
    const stepDef = I360_STEPS[stepIdx]
    return stepDef.sections.flatMap((sec) =>
      sec.fields.filter((f) => {
        if (!f.showIf) return true
        const condValue = data[f.showIf.key]
        if (Array.isArray(f.showIf.equals)) return f.showIf.equals.includes(String(condValue))
        return String(condValue) === f.showIf.equals
      }),
    )
  }

  function validateStep(stepIdx: number): boolean {
    const required = visibleFieldsForStep(stepIdx).filter((f) => f.required)
    const missing = new Set<string>()
    for (const f of required) {
      const v = data[f.key]
      const empty =
        v == null ||
        (typeof v === 'string' && v.trim() === '') ||
        (Array.isArray(v) && v.length === 0)
      if (empty) missing.add(f.key)
    }
    setValidationErrors(missing)
    return missing.size === 0
  }

  function next() {
    if (!validateStep(step)) {
      toast.error('Faltan campos por llenar antes de continuar')
      return
    }
    setStep((s) => Math.min(I360_STEPS.length, s + 1))
  }

  function prev() {
    setStep((s) => Math.max(0, s - 1))
  }

  async function handleSubmit() {
    // Validar TODOS los steps (excepto último de confirmación)
    for (let i = 0; i < I360_STEPS.length; i++) {
      if (!validateStep(i)) {
        setStep(i)
        toast.error('Hay campos faltantes en el paso ' + (i + 1))
        return
      }
    }
    setSubmitting(true)
    try {
      if (mode === 'client' && token) {
        await submitClient(token, data)
      } else if (mode === 'admin' && caseId) {
        // En admin, "Submit" guarda con status='submitted'
        const res = await fetch(`/api/admin/cases/${encodeURIComponent(caseId)}/i360-form`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ form_data: data, action: 'submit' }),
        })
        if (!res.ok) throw new Error()
      }
      setSubmittedSuccess(true)
      toast.success('Formulario I-360 enviado exitosamente')
      onSaved?.()
    } catch {
      toast.error('Error al enviar')
    }
    setSubmitting(false)
  }

  const totalSteps = I360_STEPS.length + 1 // +1 confirm step
  const isConfirmStep = step >= I360_STEPS.length
  const progress = ((step) / (totalSteps - 1)) * 100

  if (submittedSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-6">
        <CheckCircle className="w-16 h-16 text-emerald-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900">Formulario I-360 Enviado</h2>
        <p className="text-sm text-gray-500 mt-2 max-w-sm">
          Tu equipo legal revisará la información y se pondrá en contacto contigo si necesita
          alguna corrección o documento adicional.
        </p>
        <div className="flex gap-2 mt-6">
          <button
            onClick={() => setSubmittedSuccess(false)}
            className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Editar respuestas
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-amber-600 text-sm font-semibold text-white hover:bg-amber-700"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            {isConfirmStep ? `Paso ${totalSteps} de ${totalSteps}` : I360_STEPS[step].number}
          </p>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mt-0.5">
            {isConfirmStep ? 'Revisar y enviar' : I360_STEPS[step].title}
          </h2>
          {!isConfirmStep && (
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{I360_STEPS[step].intro}</p>
          )}
        </div>
        <SaveIndicator state={saveState} lastSavedAt={lastSavedAt ?? null} />
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${Math.max(progress, 4)}%`,
            background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
          }}
        />
      </div>

      {/* Mode banner */}
      {mode === 'admin' && (
        <div className="rounded-xl bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800 flex items-start gap-2">
          <span className="font-bold">Modo equipo legal:</span>
          <span>
            Estás editando como equipo legal. Tus cambios se guardan en el mismo registro que el
            cliente puede ver.
          </span>
        </div>
      )}
      {mode === 'client' && isSubmitted && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800">
          Ya enviaste este formulario. Si necesitas hacer correcciones, puedes seguir editando y
          tu equipo legal lo verá.
        </div>
      )}

      {/* Body */}
      {!isConfirmStep ? (
        <div className="space-y-6">
          {I360_STEPS[step].sections.map((sec, idx) => (
            <div key={idx} className="space-y-4">
              <SectionHeader title={sec.title} description={sec.description} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sec.fields
                  .filter((f) => {
                    if (!f.showIf) return true
                    const condValue = data[f.showIf.key]
                    if (Array.isArray(f.showIf.equals))
                      return f.showIf.equals.includes(String(condValue))
                    return String(condValue) === f.showIf.equals
                  })
                  .map((f) => (
                    <div
                      key={f.key}
                      className={
                        f.type === 'voice_textarea' ||
                        f.type === 'textarea' ||
                        f.type === 'multiselect' ||
                        sec.title.includes('Dirección')
                          ? 'sm:col-span-2'
                          : ''
                      }
                    >
                      <FieldDispatch
                        field={f}
                        value={data[f.key]}
                        onChange={(v) => upd(f.key, v)}
                        prefilled={prefilledKeys.has(f.key) && !!data[f.key]}
                        voiceToken={mode === 'client' ? token : null}
                      />
                      {validationErrors.has(f.key) && (
                        <p className="text-[11px] text-rose-600 mt-1 font-medium">
                          Este campo es obligatorio para continuar
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <ConfirmStep data={data} onEdit={(s) => setStep(s)} clientName={clientName} />
      )}

      {/* Navigation */}
      <div className="flex justify-between gap-2 pt-4 border-t border-gray-200">
        <button
          onClick={prev}
          disabled={step === 0}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" /> Anterior
        </button>
        {!isConfirmStep ? (
          <button
            onClick={next}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-sm"
          >
            Siguiente <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {mode === 'admin' ? 'Marcar como enviado' : 'Enviar I-360'}
          </button>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// Confirm step — review answers
// ────────────────────────────────────────────────────────────────────

function ConfirmStep({
  data,
  onEdit,
  clientName,
}: {
  data: I360FormData
  onEdit: (step: number) => void
  clientName?: string
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
        <p className="font-semibold">Revisa que toda la información esté correcta.</p>
        <p className="text-xs mt-1">
          Una vez enviado, el equipo legal de {clientName ? clientName : 'tu caso'} revisará la
          información. Si necesitas corregir algo, puedes hacer click en &ldquo;Editar&rdquo; en cualquier paso.
        </p>
      </div>

      {I360_STEPS.map((stepDef, idx) => {
        const visibleFields = stepDef.sections.flatMap((s) => s.fields)
        const filled = visibleFields.filter((f) => {
          const v = data[f.key]
          if (Array.isArray(v)) return v.length > 0
          return v != null && String(v).trim() !== ''
        })
        return (
          <div key={stepDef.id} className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between gap-2 border-b border-gray-200">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  {stepDef.number}
                </p>
                <p className="text-sm font-semibold text-gray-800 truncate">{stepDef.title}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-500">
                  {filled.length} de {visibleFields.length}
                </span>
                <button
                  onClick={() => onEdit(idx)}
                  className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline"
                >
                  Editar
                </button>
              </div>
            </div>
            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {filled.length === 0 && (
                <p className="text-gray-400 italic col-span-2">Sin respuestas todavía</p>
              )}
              {filled.slice(0, 8).map((f) => {
                const v = data[f.key]
                const display = Array.isArray(v) ? v.join(', ') : String(v ?? '')
                return (
                  <div key={f.key} className="min-w-0">
                    <p className="text-[10px] text-gray-400 truncate">{f.label}</p>
                    <p className="text-gray-700 font-medium truncate">{display || '—'}</p>
                  </div>
                )
              })}
              {filled.length > 8 && (
                <p className="text-[11px] text-gray-400 col-span-2 italic">
                  + {filled.length - 8} respuestas más en este paso
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Helper para contar campos llenos en un form_data — usado por el endpoint
 * required-forms para mostrar progreso del FormCard.
 */
export function countI360FilledFields(formData: Record<string, unknown> | null | undefined): number {
  if (!formData) return 0
  let n = 0
  for (const f of I360_ALL_FIELDS) {
    const v = formData[f.key]
    if (v == null) continue
    if (Array.isArray(v) && v.length > 0) n++
    else if (typeof v === 'string' && v.trim() !== '') n++
    else if (typeof v === 'boolean') n++
    else if (typeof v === 'number') n++
  }
  return n
}
