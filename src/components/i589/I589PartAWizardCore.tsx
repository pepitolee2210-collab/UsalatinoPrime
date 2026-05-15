'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Loader2, CheckCircle, Send } from 'lucide-react'
import {
  I589_PART_A_STEPS,
  I589_FORM_TYPES,
  type I589Field,
  type I589PartId,
} from './i589-part-a-questions'

/**
 * Wizard interactivo del Formulario I-589 Parte A (páginas 1-4).
 *
 * 4 steps independientes (a1, a2, a3, a4). Cada step se persiste en
 * `case_form_submissions` con `form_type='i589_part_aN'` via POST
 * `/api/client-story`. Autosave en cada cambio (debounced 1.5s) + flush
 * síncrono al cerrar/cambiar de step.
 *
 * Patrón inspirado en `I360WizardCore` (mismo wizard pattern, simplificado).
 */

interface I589DataResponse {
  case_id: string
  parts: Record<I589PartId, {
    form_data: Record<string, unknown>
    status: string | null
    updated_at: string | null
    submitted_at: string | null
    admin_notes: string | null
  }>
  prefill_sources: {
    profile: Record<string, unknown> | null
    contract: Record<string, unknown> | null
  }
}

interface I589PartAWizardCoreProps {
  token: string
  initialData: I589DataResponse
  onSuccess?: () => void
  onClose?: () => void
}

type PartData = Record<string, string>

function buildPrefilledA1(profile: Record<string, unknown> | null, contract: Record<string, unknown> | null): PartData {
  if (!profile && !contract) return {}
  const out: PartData = {}
  const p = profile ?? {}
  const c = contract ?? {}
  if (typeof p.last_name === 'string') out.legal_last_name = p.last_name
  if (typeof p.first_name === 'string') out.legal_first_name = p.first_name
  if (typeof p.phone === 'string') out.residence_phone = p.phone
  if (typeof p.address_street === 'string') out.residence_address_street = p.address_street
  if (typeof p.address_city === 'string') out.residence_address_city = p.address_city
  if (typeof p.address_state === 'string') out.residence_address_state = p.address_state
  if (typeof p.address_zip === 'string') out.residence_address_zip = p.address_zip
  if (typeof p.date_of_birth === 'string') out.date_of_birth = p.date_of_birth
  if (typeof p.country_of_birth === 'string') out.country_of_birth = p.country_of_birth
  if (typeof p.nationality === 'string') out.nationality = p.nationality
  void c
  return out
}

function buildPrefilledA3(contract: Record<string, unknown> | null): PartData {
  if (!contract) return {}
  const out: PartData = {}
  const spouse = contract.spouse as Record<string, unknown> | null | undefined
  if (spouse?.fullName) {
    out.has_spouse = 'yes'
    const parts = String(spouse.fullName).trim().split(/\s+/)
    if (parts.length >= 2) {
      out.spouse_first_name = parts[0]
      out.spouse_last_name = parts.slice(1).join(' ')
    }
    if (typeof spouse.dob === 'string') out.spouse_dob = spouse.dob
  } else {
    out.has_spouse = 'no'
  }
  const minors = contract.minors as Array<{ fullName?: string }> | null | undefined
  if (minors && minors.length > 0) {
    out.has_children = 'yes'
    out.children_count = String(minors.length)
  }
  return out
}

export function I589PartAWizardCore({
  token,
  initialData,
  onSuccess,
  onClose,
}: I589PartAWizardCoreProps) {
  const [currentStepIdx, setCurrentStepIdx] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  // Estado de los 4 parts. Cada uno es un Record<key, string>.
  const [partsData, setPartsData] = useState<Record<I589PartId, PartData>>(() => {
    const a1Saved = initialData.parts.a1.form_data as PartData
    const hasA1Saved = a1Saved && Object.keys(a1Saved).length > 0
    return {
      a1: hasA1Saved ? a1Saved : {
        ...buildPrefilledA1(initialData.prefill_sources.profile, initialData.prefill_sources.contract),
      },
      a2: (initialData.parts.a2.form_data as PartData) ?? {},
      a3: (() => {
        const saved = initialData.parts.a3.form_data as PartData
        if (saved && Object.keys(saved).length > 0) return saved
        return buildPrefilledA3(initialData.prefill_sources.contract)
      })(),
      a4: (initialData.parts.a4.form_data as PartData) ?? {},
    }
  })

  // Ref para flush sin esperar React (en cleanup / cierre)
  const dataRef = useRef(partsData)
  dataRef.current = partsData

  const currentStep = I589_PART_A_STEPS[currentStepIdx]
  const currentPartId = currentStep.id

  // Autosave debounced
  useEffect(() => {
    const timer = setTimeout(() => {
      void saveDraft(currentPartId, dataRef.current[currentPartId])
    }, 1500)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partsData, currentPartId])

  const updateField = useCallback((key: string, value: string) => {
    setPartsData((prev) => ({
      ...prev,
      [currentPartId]: {
        ...prev[currentPartId],
        [key]: value,
      },
    }))
  }, [currentPartId])

  async function saveDraft(partId: I589PartId, data: PartData): Promise<boolean> {
    setSaving(true)
    try {
      const res = await fetch('/api/client-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          form_type: I589_FORM_TYPES[partId],
          form_data: data,
          action: 'draft',
          minor_index: 0,
        }),
      })
      if (!res.ok) return false
      return true
    } catch {
      return false
    } finally {
      setSaving(false)
    }
  }

  function isFieldVisible(field: I589Field, data: PartData): boolean {
    if (!field.showIf) return true
    const v = data[field.showIf.key]
    const expected = field.showIf.equals
    return Array.isArray(expected) ? expected.includes(v) : v === expected
  }

  function validateStep(partId: I589PartId): string | null {
    const data = partsData[partId]
    for (const sec of currentStep.sections) {
      for (const f of sec.fields) {
        if (!f.required) continue
        if (!isFieldVisible(f, data)) continue
        const v = data[f.key]
        if (!v || String(v).trim() === '') {
          return `Falta: "${f.label}"`
        }
      }
    }
    return null
  }

  async function handleNext() {
    const err = validateStep(currentPartId)
    if (err) {
      toast.error(err)
      return
    }
    await saveDraft(currentPartId, dataRef.current[currentPartId])
    setCurrentStepIdx((idx) => Math.min(idx + 1, I589_PART_A_STEPS.length - 1))
  }

  async function handleBack() {
    await saveDraft(currentPartId, dataRef.current[currentPartId])
    setCurrentStepIdx((idx) => Math.max(0, idx - 1))
  }

  async function handleSubmitAll() {
    // Validar todos los steps
    for (const step of I589_PART_A_STEPS) {
      const data = partsData[step.id]
      for (const sec of step.sections) {
        for (const f of sec.fields) {
          if (!f.required) continue
          if (!isFieldVisible(f, data)) continue
          const v = data[f.key]
          if (!v || String(v).trim() === '') {
            toast.error(`Falta en ${step.title}: "${f.label}"`)
            setCurrentStepIdx(I589_PART_A_STEPS.findIndex((s) => s.id === step.id))
            return
          }
        }
      }
    }

    setSubmitting(true)
    try {
      // Submit todas las parts secuencialmente
      for (const step of I589_PART_A_STEPS) {
        const res = await fetch('/api/client-story', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            form_type: I589_FORM_TYPES[step.id],
            form_data: partsData[step.id],
            action: 'submit',
            minor_index: 0,
          }),
        })
        if (!res.ok) {
          throw new Error(`Error al enviar ${step.title}`)
        }
      }
      setSuccess(true)
      toast.success('Formulario I-589 enviado. Tu equipo legal lo revisará.')
      setTimeout(() => onSuccess?.(), 1500)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al enviar')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-4">
        <CheckCircle className="w-16 h-16 text-emerald-600" />
        <h2 className="text-2xl font-bold text-gray-900">¡Enviado!</h2>
        <p className="text-gray-600 max-w-md">
          Tu formulario I-589 — Páginas 1 a 4 fue enviado correctamente. Tu equipo legal lo
          revisará y te contactará si necesita aclaraciones.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="border-b border-gray-200 px-6 py-4 bg-white sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              {currentStep.number} · Paso {currentStepIdx + 1} de {I589_PART_A_STEPS.length}
            </p>
            <h2 className="text-lg font-bold text-gray-900 mt-0.5">{currentStep.title}</h2>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {saving && <><Loader2 className="w-3 h-3 animate-spin" /> Guardando…</>}
            {!saving && <span className="text-emerald-600">✓ Guardado</span>}
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-2">{currentStep.intro}</p>
        <div className="mt-3 flex gap-1">
          {I589_PART_A_STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`flex-1 h-1.5 rounded-full ${
                i < currentStepIdx ? 'bg-emerald-500' :
                i === currentStepIdx ? 'bg-[#F2A900]' :
                'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {currentStep.sections.map((sec, secIdx) => (
            <section key={secIdx} className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
              <header>
                <h3 className="font-semibold text-gray-900">{sec.title}</h3>
                {sec.description && <p className="text-xs text-gray-500 mt-1">{sec.description}</p>}
              </header>
              <div className="space-y-3">
                {sec.fields.map((field) => {
                  if (!isFieldVisible(field, partsData[currentPartId])) return null
                  const value = partsData[currentPartId][field.key] ?? ''
                  return (
                    <FieldInput
                      key={field.key}
                      field={field}
                      value={value}
                      onChange={(v) => updateField(field.key, v)}
                    />
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white px-6 py-3 flex items-center justify-between sticky bottom-0">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStepIdx === 0 || submitting}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Atrás
        </Button>
        <div className="flex gap-2">
          {onClose && (
            <Button variant="ghost" onClick={onClose} disabled={submitting}>
              Cerrar
            </Button>
          )}
          {currentStepIdx < I589_PART_A_STEPS.length - 1 ? (
            <Button onClick={handleNext} disabled={submitting} className="bg-[#002855] hover:bg-[#001a3a]">
              Siguiente
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmitAll}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submitting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
              Enviar formulario
            </Button>
          )}
        </div>
      </footer>
    </div>
  )
}

interface FieldInputProps {
  field: I589Field
  value: string
  onChange: (v: string) => void
}

function FieldInput({ field, value, onChange }: FieldInputProps) {
  const baseInputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]'

  return (
    <div>
      <label className="block text-xs font-bold text-gray-700 mb-1">
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {field.help && <p className="text-[10px] text-gray-500 mb-1.5">{field.help}</p>}
      {field.type === 'textarea' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className={baseInputClass}
        />
      ) : field.type === 'select' || field.type === 'us_state' || field.type === 'country' ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={baseInputClass}
        >
          <option value="">— Selecciona —</option>
          {field.type === 'us_state' && US_STATES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
          {field.type === 'country' && COUNTRIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
          {field.type === 'select' && field.options?.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : field.type === 'yesno' ? (
        <div className="flex gap-2">
          {[
            { v: 'yes', label: 'Sí' },
            { v: 'no', label: 'No' },
          ].map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => onChange(opt.v)}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                value === opt.v
                  ? 'border-[#002855] bg-[#002855] text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : (
        <input
          type={
            field.type === 'date' ? 'date' :
            field.type === 'phone' ? 'tel' :
            field.type === 'email' ? 'email' :
            'text'
          }
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={baseInputClass}
        />
      )}
    </div>
  )
}

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC','PR',
]

// Lista corta de países más comunes para asilo. Para selección completa,
// el cliente puede escribir manualmente fuera de la lista (no validamos).
const COUNTRIES = [
  'Argentina','Bolivia','Brasil','Chile','Colombia','Costa Rica','Cuba',
  'Ecuador','El Salvador','España','Estados Unidos','Guatemala','Haití',
  'Honduras','México','Nicaragua','Panamá','Paraguay','Perú','República Dominicana',
  'Uruguay','Venezuela','Otro',
]
