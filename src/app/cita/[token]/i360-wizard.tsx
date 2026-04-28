'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, CheckCircle, Loader2, Send } from 'lucide-react'
import { VoiceTextarea } from '@/components/voice/VoiceTextarea'
import { useVoiceToken } from '@/components/voice/voice-context'

// ══ INTERFACES ════════════════════════════════════════════════════

interface I360Data {
  // Part 1 - Petitioner (pre-filled from tutor)
  petitioner_last_name: string; petitioner_first_name: string; petitioner_middle_name: string
  petitioner_ssn: string; petitioner_a_number: string
  petitioner_address: string; petitioner_city: string; petitioner_state: string
  petitioner_zip: string; petitioner_country: string
  // Part 1 #7 - Safe mailing address
  safe_mailing_name: string; safe_mailing_address: string; safe_mailing_city: string
  safe_mailing_state: string; safe_mailing_zip: string
  // Part 3 - Beneficiary (minor) — mostly pre-filled
  beneficiary_last_name: string; beneficiary_first_name: string; beneficiary_middle_name: string
  beneficiary_address: string; beneficiary_city: string; beneficiary_state: string
  beneficiary_zip: string
  beneficiary_dob: string; beneficiary_country_birth: string; beneficiary_city_birth: string
  beneficiary_ssn: string; beneficiary_a_number: string
  beneficiary_sex: string; beneficiary_marital_status: string
  beneficiary_passport_number: string; beneficiary_passport_country: string
  beneficiary_passport_expiry: string
  beneficiary_i94_number: string
  beneficiary_last_arrival_date: string; beneficiary_nonimmigrant_status: string
  beneficiary_status_expiry: string; beneficiary_i94_expiry: string
  other_names: string
  // Part 4 - Processing
  foreign_parent_last_name: string; foreign_parent_first_name: string; foreign_parent_middle_name: string
  foreign_parent_address: string; foreign_parent_city: string
  foreign_parent_province: string; foreign_parent_postal: string; foreign_parent_country: string
  in_removal_proceedings: string; other_petitions: string; other_petitions_count: string
  worked_without_permission: string; adjustment_attached: string
  // Part 5 - Spouse and Children
  children_filed_separate: string
  spouse_child_1_last_name: string; spouse_child_1_first_name: string; spouse_child_1_middle_name: string
  spouse_child_1_dob: string; spouse_child_1_country: string
  spouse_child_1_relationship: string; spouse_child_1_a_number: string
  // Part 8 - SIJS
  declared_dependent_court: string; state_agency_name: string
  currently_under_jurisdiction: string; in_court_ordered_placement: string
  placement_reason: string; reunification_not_viable_reason: string
  parent_names_not_viable: string; best_interest_not_return: string
  previously_hhs_custody: string; hhs_court_order: string
  // Part 11 - Contact & Language
  petitioner_phone: string; petitioner_mobile: string; petitioner_email: string
  language_understood: string; interpreter_needed: string
  // Part 15 - Additional Information
  additional_info: string
}

const EMPTY_I360: I360Data = {
  petitioner_last_name: '', petitioner_first_name: '', petitioner_middle_name: '',
  petitioner_ssn: '', petitioner_a_number: '',
  petitioner_address: '', petitioner_city: '', petitioner_state: '', petitioner_zip: '', petitioner_country: '',
  safe_mailing_name: '', safe_mailing_address: '', safe_mailing_city: '', safe_mailing_state: '', safe_mailing_zip: '',
  beneficiary_last_name: '', beneficiary_first_name: '', beneficiary_middle_name: '',
  beneficiary_address: '', beneficiary_city: '', beneficiary_state: '', beneficiary_zip: '',
  beneficiary_dob: '', beneficiary_country_birth: '', beneficiary_city_birth: '',
  beneficiary_ssn: '', beneficiary_a_number: '',
  beneficiary_sex: '', beneficiary_marital_status: '',
  beneficiary_passport_number: '', beneficiary_passport_country: '', beneficiary_passport_expiry: '',
  beneficiary_i94_number: '',
  beneficiary_last_arrival_date: '', beneficiary_nonimmigrant_status: '',
  beneficiary_status_expiry: '', beneficiary_i94_expiry: '',
  other_names: '',
  foreign_parent_last_name: '', foreign_parent_first_name: '', foreign_parent_middle_name: '',
  foreign_parent_address: '', foreign_parent_city: '',
  foreign_parent_province: '', foreign_parent_postal: '', foreign_parent_country: '',
  in_removal_proceedings: '', other_petitions: '', other_petitions_count: '',
  worked_without_permission: 'No', adjustment_attached: '',
  children_filed_separate: '',
  spouse_child_1_last_name: '', spouse_child_1_first_name: '', spouse_child_1_middle_name: '',
  spouse_child_1_dob: '', spouse_child_1_country: '',
  spouse_child_1_relationship: '', spouse_child_1_a_number: '',
  declared_dependent_court: '', state_agency_name: '',
  currently_under_jurisdiction: '', in_court_ordered_placement: '',
  placement_reason: '', reunification_not_viable_reason: '',
  parent_names_not_viable: '', best_interest_not_return: '',
  previously_hhs_custody: '', hhs_court_order: '',
  petitioner_phone: '', petitioner_mobile: '', petitioner_email: '',
  language_understood: 'Español', interpreter_needed: 'Sí',
  additional_info: '',
}

const STEP_LABELS = [
  'Part 1 — Peticionario',
  'Part 2/3 — Datos del Menor',
  'Part 3/4 — Migratorio y Procesamiento',
  'Part 8 — SIJS (Corte Juvenil)',
  'Part 11/15 — Contacto e Info Adicional',
  'Confirmar y Enviar',
]
const TOTAL_STEPS = STEP_LABELS.length

// ══ FIELD COMPONENTS ════════════════════════════════════════════

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return <label className="text-sm font-medium text-gray-700 mb-1.5 block">{children}{required && <span className="text-red-400 ml-0.5">*</span>}</label>
}

function TInput({ value, onChange, placeholder, type = 'text', disabled }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean
}) {
  return <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
    className={`w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40 ${disabled ? 'bg-gray-50 text-gray-500' : ''}`} />
}

function YesNo({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2">
      {['Sí', 'No'].map(opt => (
        <button key={opt} type="button" onClick={() => onChange(opt)}
          className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
            value === opt ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}>{opt}</button>
      ))}
    </div>
  )
}

function PrefilledBadge() {
  return <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full ml-1">Pre-llenado</span>
}

// ══ MAIN WIZARD ════════════════════════════════════════════════

export function I360Wizard({ token, clientName }: { token: string; clientName: string }) {
  const [data, setData] = useState<I360Data>({ ...EMPTY_I360 })
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  function upd(field: keyof I360Data, value: string) {
    setData(prev => ({ ...prev, [field]: value }))
  }

  // Load existing data and pre-fill from historia
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/client-story?token=${token}`)
        if (!res.ok) return
        const json = await res.json()

        // Pre-fill from existing I-360 submission if any
        const i360Sub = json.declarations?.find((d: any) => d.form_type === 'i360_sijs')
        if (i360Sub) {
          setData(prev => ({ ...prev, ...i360Sub.data }))
          if (i360Sub.status === 'submitted') setSubmitted(true)
        }

        // Pre-fill from historia data (tutor, minor, absent parent)
        const tutorSub = json.tutor_guardian
        const tutor = tutorSub?.data || {}

        // Use first minor story for beneficiary
        const firstDecl = json.declarations?.find((d: any) => d.form_type === 'client_story')
        const mb = firstDecl?.data?.minorBasic || {}
        const absentParent = json.client_absent_parent?.data || {}

        // Split names for petitioner (tutor)
        const tutorName = (tutor.full_name || '').trim()
        const tutorParts = tutorName.split(' ')

        // Split names for beneficiary (minor)
        const minorName = (mb.full_name || '').trim()
        const minorParts = minorName.split(' ')

        // Parse address
        const tutorAddr = (tutor.full_address || '').trim()
        const minorAddr = (mb.address || '').trim()

        setData(prev => {
          const filled = { ...prev }
          // Petitioner from tutor (only if not already set)
          if (!filled.petitioner_first_name && tutorParts.length >= 2) {
            filled.petitioner_first_name = tutorParts.slice(0, -1).join(' ')
            filled.petitioner_last_name = tutorParts[tutorParts.length - 1]
          }
          if (!filled.petitioner_address && tutorAddr) filled.petitioner_address = tutorAddr

          // Beneficiary from minor
          if (!filled.beneficiary_first_name && minorParts.length >= 2) {
            filled.beneficiary_first_name = minorParts.slice(0, -2).join(' ') || minorParts[0]
            filled.beneficiary_last_name = minorParts.slice(-2).join(' ')
          }
          if (!filled.beneficiary_dob && mb.dob) filled.beneficiary_dob = mb.dob
          if (!filled.beneficiary_country_birth && mb.country) filled.beneficiary_country_birth = mb.country
          if (!filled.beneficiary_city_birth && mb.birth_city) filled.beneficiary_city_birth = mb.birth_city
          if (!filled.beneficiary_address && minorAddr) filled.beneficiary_address = minorAddr
          if (!filled.beneficiary_marital_status && mb.civil_status) filled.beneficiary_marital_status = mb.civil_status
          if (!filled.beneficiary_passport_number && mb.id_number) filled.beneficiary_passport_number = mb.id_number
          if (!filled.beneficiary_a_number && mb.a_number) filled.beneficiary_a_number = mb.a_number
          if (!filled.beneficiary_ssn && mb.ssn) filled.beneficiary_ssn = mb.ssn
          if (!filled.beneficiary_i94_number && mb.i94_number) filled.beneficiary_i94_number = mb.i94_number
          if (!filled.beneficiary_nonimmigrant_status && mb.nonimmigrant_status) filled.beneficiary_nonimmigrant_status = mb.nonimmigrant_status
          if (!filled.beneficiary_last_arrival_date && mb.arrival_date) filled.beneficiary_last_arrival_date = mb.arrival_date
          if (!filled.in_removal_proceedings && mb.detained_by_immigration) {
            filled.in_removal_proceedings = mb.detained_by_immigration === 'Sí' ? 'Sí' : 'No'
          }
          if (!filled.previously_hhs_custody && mb.released_by_orr) {
            filled.previously_hhs_custody = mb.released_by_orr === 'Sí' ? 'Sí' : 'No'
          }
          if (!filled.parent_names_not_viable && absentParent.parent_name) {
            filled.parent_names_not_viable = absentParent.parent_name
          }
          return filled
        })
      } catch { /* ignore */ }
      setLoading(false)
    }
    load()
  }, [token])

  // Auto-save
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveDraft = useCallback(async () => {
    setSaving(true)
    try {
      await fetch('/api/client-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, form_type: 'i360_sijs', form_data: data, action: 'draft', minor_index: 0 }),
      })
    } catch { /* silent */ }
    setSaving(false)
  }, [token, data])

  useEffect(() => {
    if (loading) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(saveDraft, 4000)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [data, saveDraft, loading])

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/client-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, form_type: 'i360_sijs', form_data: data, action: 'submit', minor_index: 0 }),
      })
      if (!res.ok) throw new Error()
      setSubmitted(true)
      toast.success('Formulario I-360 enviado exitosamente')
    } catch {
      toast.error('Error al enviar')
    }
    setSubmitting(false)
  }

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>

  if (submitted) return (
    <div className="text-center py-12">
      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
      <p className="text-lg font-bold text-gray-900">Formulario I-360 Enviado</p>
      <p className="text-sm text-gray-500 mt-1">Tu consultor revisará la información.</p>
      <button onClick={() => setSubmitted(false)} className="text-sm text-indigo-600 mt-3 hover:underline">Editar respuestas</button>
    </div>
  )

  const progress = (step / (TOTAL_STEPS - 1)) * 100

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-bold text-gray-900">Formulario I-360 — Visa Juvenil (SIJS)</h3>
        <p className="text-xs text-gray-500 mt-0.5">{STEP_LABELS[step]}</p>
      </div>

      {/* Progress */}
      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-1.5">
          <span>Paso {step + 1} de {TOTAL_STEPS}</span>
          <span className={saving ? 'text-green-600' : ''}>{saving ? '● Guardando...' : 'Se guarda automáticamente'}</span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.max(progress, 4)}%`, background: 'linear-gradient(90deg, #6366f1, #818cf8)' }} />
        </div>
      </div>

      {/* Steps */}
      <div>
        {step === 0 && <Step1Petitioner data={data} upd={upd} />}
        {step === 1 && <Step2Beneficiary data={data} upd={upd} />}
        {step === 2 && <Step3Immigration data={data} upd={upd} />}
        {step === 3 && <Step4SIJS data={data} upd={upd} />}
        {step === 4 && <Step5Contact data={data} upd={upd} />}
        {step === 5 && <Step6Confirm data={data} onEdit={setStep} />}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-gray-100">
        <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-30">
          <ChevronLeft className="w-4 h-4" /> Anterior
        </button>
        {step < TOTAL_STEPS - 1 ? (
          <button onClick={() => setStep(s => s + 1)}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700">
            Siguiente <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={submitting}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar I-360
          </button>
        )}
      </div>
    </div>
  )
}

// ══ STEP 1: PETITIONER ════════════════════════════════════════

function Step1Petitioner({ data, upd }: { data: I360Data; upd: (f: keyof I360Data, v: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-800">
        Part 1 — Información de la persona que presenta esta petición. Los campos pre-llenados vienen de su formulario anterior.
      </div>
      <p className="text-xs font-bold text-gray-500 uppercase">1. Nombre completo</p>
      <div className="grid grid-cols-3 gap-3">
        <div><FieldLabel required>Apellido(s)<PrefilledBadge /></FieldLabel><TInput value={data.petitioner_last_name} onChange={v => upd('petitioner_last_name', v)} placeholder="Apellido(s)" /></div>
        <div><FieldLabel required>Nombre(s)<PrefilledBadge /></FieldLabel><TInput value={data.petitioner_first_name} onChange={v => upd('petitioner_first_name', v)} placeholder="Nombre(s)" /></div>
        <div><FieldLabel>Segundo nombre</FieldLabel><TInput value={data.petitioner_middle_name} onChange={v => upd('petitioner_middle_name', v)} placeholder="Si tiene" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><FieldLabel>3. Social Security Number (si tiene)</FieldLabel><TInput value={data.petitioner_ssn} onChange={v => upd('petitioner_ssn', v)} placeholder="123-45-6789" /></div>
        <div><FieldLabel>4. A-Number (si tiene)</FieldLabel><TInput value={data.petitioner_a_number} onChange={v => upd('petitioner_a_number', v)} placeholder="A-123456789" /></div>
      </div>
      <p className="text-xs font-bold text-gray-500 uppercase">6. Dirección de correo</p>
      <div><FieldLabel required>Dirección<PrefilledBadge /></FieldLabel><TInput value={data.petitioner_address} onChange={v => upd('petitioner_address', v)} placeholder="Calle, número, apto" /></div>
      <div className="grid grid-cols-3 gap-3">
        <div><FieldLabel>Ciudad</FieldLabel><TInput value={data.petitioner_city} onChange={v => upd('petitioner_city', v)} placeholder="Ciudad" /></div>
        <div><FieldLabel>Estado</FieldLabel><TInput value={data.petitioner_state} onChange={v => upd('petitioner_state', v)} placeholder="Ej: UT, TN" /></div>
        <div><FieldLabel>ZIP Code</FieldLabel><TInput value={data.petitioner_zip} onChange={v => upd('petitioner_zip', v)} placeholder="Ej: 84003" /></div>
      </div>
      <p className="text-xs font-bold text-gray-500 uppercase mt-2">7. Dirección segura/alternativa de envío (opcional)</p>
      <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-500 mb-2">Si no desea que USCIS envíe correspondencia a su dirección principal, puede proporcionar una dirección alternativa segura.</div>
      <div><FieldLabel>Nombre de referencia</FieldLabel><TInput value={data.safe_mailing_name} onChange={v => upd('safe_mailing_name', v)} placeholder="Ej: A nombre de..." /></div>
      <div><FieldLabel>Dirección alternativa</FieldLabel><TInput value={data.safe_mailing_address} onChange={v => upd('safe_mailing_address', v)} placeholder="Calle, número" /></div>
      <div className="grid grid-cols-3 gap-3">
        <div><FieldLabel>Ciudad</FieldLabel><TInput value={data.safe_mailing_city} onChange={v => upd('safe_mailing_city', v)} placeholder="Ciudad" /></div>
        <div><FieldLabel>Estado</FieldLabel><TInput value={data.safe_mailing_state} onChange={v => upd('safe_mailing_state', v)} placeholder="Estado" /></div>
        <div><FieldLabel>ZIP Code</FieldLabel><TInput value={data.safe_mailing_zip} onChange={v => upd('safe_mailing_zip', v)} placeholder="ZIP" /></div>
      </div>
    </div>
  )
}

// ══ STEP 2: BENEFICIARY (MINOR) ═══════════════════════════════

function Step2Beneficiary({ data, upd }: { data: I360Data; upd: (f: keyof I360Data, v: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-800">
        Part 3 — Información del menor (beneficiario). Verifique y complete los datos.
      </div>
      <div><FieldLabel>¿Ha usado otros nombres? (alias, nombres anteriores)</FieldLabel><TInput value={data.other_names} onChange={v => upd('other_names', v)} placeholder="Ej: Ninguno / María García..." /></div>
      <div className="grid grid-cols-3 gap-3">
        <div><FieldLabel required>Apellido(s)<PrefilledBadge /></FieldLabel><TInput value={data.beneficiary_last_name} onChange={v => upd('beneficiary_last_name', v)} placeholder="Apellido(s)" /></div>
        <div><FieldLabel required>Nombre(s)<PrefilledBadge /></FieldLabel><TInput value={data.beneficiary_first_name} onChange={v => upd('beneficiary_first_name', v)} placeholder="Nombre(s)" /></div>
        <div><FieldLabel>Segundo nombre</FieldLabel><TInput value={data.beneficiary_middle_name} onChange={v => upd('beneficiary_middle_name', v)} placeholder="Si tiene" /></div>
      </div>
      <div><FieldLabel>Dirección actual<PrefilledBadge /></FieldLabel><TInput value={data.beneficiary_address} onChange={v => upd('beneficiary_address', v)} placeholder="Dirección completa" /></div>
      <div className="grid grid-cols-3 gap-3">
        <div><FieldLabel>Ciudad</FieldLabel><TInput value={data.beneficiary_city} onChange={v => upd('beneficiary_city', v)} placeholder="Ciudad" /></div>
        <div><FieldLabel>Estado</FieldLabel><TInput value={data.beneficiary_state} onChange={v => upd('beneficiary_state', v)} placeholder="Estado" /></div>
        <div><FieldLabel>ZIP Code</FieldLabel><TInput value={data.beneficiary_zip} onChange={v => upd('beneficiary_zip', v)} placeholder="ZIP" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><FieldLabel required>Fecha de nacimiento<PrefilledBadge /></FieldLabel><TInput type="date" value={data.beneficiary_dob} onChange={v => upd('beneficiary_dob', v)} /></div>
        <div><FieldLabel required>País de nacimiento<PrefilledBadge /></FieldLabel><TInput value={data.beneficiary_country_birth} onChange={v => upd('beneficiary_country_birth', v)} placeholder="País" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><FieldLabel>Ciudad de nacimiento<PrefilledBadge /></FieldLabel><TInput value={data.beneficiary_city_birth} onChange={v => upd('beneficiary_city_birth', v)} placeholder="Ciudad" /></div>
        <div>
          <FieldLabel required>Sexo</FieldLabel>
          <div className="flex gap-2">
            {['Masculino', 'Femenino'].map(opt => (
              <button key={opt} type="button" onClick={() => upd('beneficiary_sex', opt)}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${data.beneficiary_sex === opt ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600'}`}>{opt}</button>
            ))}
          </div>
        </div>
      </div>
      <div>
        <FieldLabel>Estado civil</FieldLabel>
        <div className="flex gap-2">
          {['Soltero/a', 'Casado/a', 'Divorciado/a', 'Viudo/a'].map(opt => (
            <button key={opt} type="button" onClick={() => upd('beneficiary_marital_status', opt)}
              className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${data.beneficiary_marital_status === opt ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600'}`}>{opt}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ══ STEP 3: IMMIGRATION DATA ═══════════════════════════════════

function Step3Immigration({ data, upd }: { data: I360Data; upd: (f: keyof I360Data, v: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-800">
        Part 3 (cont.) y Part 4 — Datos migratorios y de procesamiento. Si no tiene algún número, déjelo vacío.
      </div>
      <p className="text-xs font-bold text-gray-500 uppercase">Documentos del menor</p>
      <div className="grid grid-cols-2 gap-3">
        <div><FieldLabel>5. SSN del menor</FieldLabel><TInput value={data.beneficiary_ssn} onChange={v => upd('beneficiary_ssn', v)} placeholder="123-45-6789" /></div>
        <div><FieldLabel>6. A-Number del menor</FieldLabel><TInput value={data.beneficiary_a_number} onChange={v => upd('beneficiary_a_number', v)} placeholder="A-123456789" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><FieldLabel>8. Fecha exacta de última llegada<PrefilledBadge /></FieldLabel><TInput type="date" value={data.beneficiary_last_arrival_date} onChange={v => upd('beneficiary_last_arrival_date', v)} /></div>
        <div><FieldLabel>9. I-94 Number o I-95</FieldLabel><TInput value={data.beneficiary_i94_number} onChange={v => upd('beneficiary_i94_number', v)} placeholder="Ej: 6731-0649-0243" /></div>
      </div>
      <div>
        <div><FieldLabel>10. Número de pasaporte<PrefilledBadge /></FieldLabel><TInput value={data.beneficiary_passport_number} onChange={v => upd('beneficiary_passport_number', v)} placeholder="Número" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><FieldLabel>12. País emisor del pasaporte</FieldLabel><TInput value={data.beneficiary_passport_country} onChange={v => upd('beneficiary_passport_country', v)} placeholder="Ej: Peru, Ecuador" /></div>
        <div><FieldLabel>13. Fecha expiración pasaporte</FieldLabel><TInput type="date" value={data.beneficiary_passport_expiry} onChange={v => upd('beneficiary_passport_expiry', v)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><FieldLabel>14. Estatus migratorio actual</FieldLabel><TInput value={data.beneficiary_nonimmigrant_status} onChange={v => upd('beneficiary_nonimmigrant_status', v)} placeholder="Ej: B-2, Parolee" /></div>
        <div><FieldLabel>15. Expira en / I-94 expira</FieldLabel><TInput type="date" value={data.beneficiary_i94_expiry} onChange={v => upd('beneficiary_i94_expiry', v)} /></div>
      </div>

      <p className="text-xs font-bold text-gray-500 uppercase mt-3">Part 4 — Procesamiento</p>
      <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-500">Dirección del padre/madre en el país de origen (si se proporcionó dirección en EE.UU. en Part 3)</div>
      <div className="grid grid-cols-3 gap-3">
        <div><FieldLabel>Apellido(s) del padre/madre</FieldLabel><TInput value={data.foreign_parent_last_name} onChange={v => upd('foreign_parent_last_name', v)} placeholder="Apellido" /></div>
        <div><FieldLabel>Nombre(s)</FieldLabel><TInput value={data.foreign_parent_first_name} onChange={v => upd('foreign_parent_first_name', v)} placeholder="Nombre" /></div>
        <div><FieldLabel>Segundo nombre</FieldLabel><TInput value={data.foreign_parent_middle_name} onChange={v => upd('foreign_parent_middle_name', v)} placeholder="Si tiene" /></div>
      </div>
      <div><FieldLabel>Dirección en el extranjero</FieldLabel><TInput value={data.foreign_parent_address} onChange={v => upd('foreign_parent_address', v)} placeholder="Calle, número" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><FieldLabel>Ciudad</FieldLabel><TInput value={data.foreign_parent_city} onChange={v => upd('foreign_parent_city', v)} placeholder="Ciudad" /></div>
        <div><FieldLabel>Provincia/Estado</FieldLabel><TInput value={data.foreign_parent_province} onChange={v => upd('foreign_parent_province', v)} placeholder="Provincia" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><FieldLabel>Código postal</FieldLabel><TInput value={data.foreign_parent_postal} onChange={v => upd('foreign_parent_postal', v)} placeholder="Código postal" /></div>
        <div><FieldLabel>País</FieldLabel><TInput value={data.foreign_parent_country} onChange={v => upd('foreign_parent_country', v)} placeholder="Ej: Peru, Ecuador" /></div>
      </div>
      <div><FieldLabel>3. Sexo del menor</FieldLabel>
        <div className="flex gap-2">
          {['Masculino', 'Femenino'].map(opt => (
            <button key={opt} type="button" onClick={() => upd('beneficiary_sex', opt)}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${data.beneficiary_sex === opt ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600'}`}>{opt}</button>
          ))}
        </div>
      </div>
      <div><FieldLabel>4. ¿Tiene otras peticiones pendientes?</FieldLabel><YesNo value={data.other_petitions} onChange={v => upd('other_petitions', v)} /></div>
      {data.other_petitions === 'Sí' && <div><FieldLabel>¿Cuántas?</FieldLabel><TInput value={data.other_petitions_count} onChange={v => upd('other_petitions_count', v)} placeholder="Número" /></div>}
      <div><FieldLabel>5. ¿Está en proceso de deportación (removal proceedings)?</FieldLabel><YesNo value={data.in_removal_proceedings} onChange={v => upd('in_removal_proceedings', v)} /></div>
      <div><FieldLabel>6. ¿Ha trabajado sin autorización en EE.UU.?</FieldLabel><YesNo value={data.worked_without_permission} onChange={v => upd('worked_without_permission', v)} /></div>
      <div><FieldLabel>7. ¿Se adjunta solicitud de ajuste de estatus (I-485)?</FieldLabel><YesNo value={data.adjustment_attached} onChange={v => upd('adjustment_attached', v)} /></div>

      <p className="text-xs font-bold text-gray-500 uppercase mt-3">Part 5 — Cónyuge e hijos del beneficiario</p>
      <div><FieldLabel>1. ¿Alguno de sus hijos ha presentado peticiones separadas?</FieldLabel><YesNo value={data.children_filed_separate} onChange={v => upd('children_filed_separate', v)} /></div>
      {data.children_filed_separate === 'Sí' && (
        <div className="space-y-3 p-4 bg-gray-50 rounded-xl">
          <p className="text-xs font-bold text-gray-600">Persona 1</p>
          <div className="grid grid-cols-3 gap-3">
            <div><FieldLabel>Apellido(s)</FieldLabel><TInput value={data.spouse_child_1_last_name} onChange={v => upd('spouse_child_1_last_name', v)} placeholder="Apellido" /></div>
            <div><FieldLabel>Nombre(s)</FieldLabel><TInput value={data.spouse_child_1_first_name} onChange={v => upd('spouse_child_1_first_name', v)} placeholder="Nombre" /></div>
            <div><FieldLabel>Segundo nombre</FieldLabel><TInput value={data.spouse_child_1_middle_name} onChange={v => upd('spouse_child_1_middle_name', v)} placeholder="Si tiene" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><FieldLabel>Fecha de nacimiento</FieldLabel><TInput type="date" value={data.spouse_child_1_dob} onChange={v => upd('spouse_child_1_dob', v)} /></div>
            <div><FieldLabel>País de nacimiento</FieldLabel><TInput value={data.spouse_child_1_country} onChange={v => upd('spouse_child_1_country', v)} placeholder="País" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Relación</FieldLabel>
              <div className="flex gap-2">
                {['Spouse', 'Child'].map(opt => (
                  <button key={opt} type="button" onClick={() => upd('spouse_child_1_relationship', opt)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${data.spouse_child_1_relationship === opt ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600'}`}>
                    {opt === 'Spouse' ? 'Cónyuge' : 'Hijo/a'}
                  </button>
                ))}
              </div>
            </div>
            <div><FieldLabel>A-Number (si tiene)</FieldLabel><TInput value={data.spouse_child_1_a_number} onChange={v => upd('spouse_child_1_a_number', v)} placeholder="A-" /></div>
          </div>
        </div>
      )}
    </div>
  )
}

// ══ STEP 4: SIJS SPECIFIC ═══════════════════════════════════════

function Step4SIJS({ data, upd }: { data: I360Data; upd: (f: keyof I360Data, v: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-800">
        Part 8 — Complete solo si presenta como Special Immigrant Juvenile (SIJS).
      </div>

      <p className="text-xs font-bold text-gray-500 uppercase">1. Otros nombres usados</p>
      <div><FieldLabel>¿Ha usado otros nombres? (Si no, deje vacío)</FieldLabel><TInput value={data.other_names} onChange={v => upd('other_names', v)} placeholder="Ej: Ninguno" /></div>

      <p className="text-xs font-bold text-gray-500 uppercase mt-2">2A. Dependencia de corte juvenil</p>
      <div>
        <FieldLabel required>¿Ha sido declarado/a dependiente de una corte juvenil en los EE.UU., O ha sido colocado/a bajo custodia de una agencia, departamento de un estado, o un individuo o entidad?</FieldLabel>
        <YesNo value={data.declared_dependent_court} onChange={v => upd('declared_dependent_court', v)} />
      </div>

      <p className="text-xs font-bold text-gray-500 uppercase mt-2">2B. Nombre de la agencia/corte</p>
      <div><FieldLabel>Nombre de la agencia estatal, departamento, corte u organización</FieldLabel><TInput value={data.state_agency_name} onChange={v => upd('state_agency_name', v)} placeholder="Ej: FOURTH DISTRICT JUVENILE COURT OF THE STATE OF UTAH AMERICAN FORK LOCATION" /></div>

      <p className="text-xs font-bold text-gray-500 uppercase mt-2">2C. Jurisdicción actual</p>
      <div>
        <FieldLabel required>¿Está actualmente bajo la jurisdicción de la corte juvenil que hizo su colocación o determinación de custodia?</FieldLabel>
        <YesNo value={data.currently_under_jurisdiction} onChange={v => upd('currently_under_jurisdiction', v)} />
      </div>

      <p className="text-xs font-bold text-gray-500 uppercase mt-2">3A. Colocación actual</p>
      {data.currently_under_jurisdiction === 'Sí' && (
        <div>
          <FieldLabel>Si respondió "Sí" a 2C, ¿reside actualmente en una colocación ordenada por la corte?</FieldLabel>
          <YesNo value={data.in_court_ordered_placement} onChange={v => upd('in_court_ordered_placement', v)} />
        </div>
      )}
      {data.currently_under_jurisdiction === 'No' && (
        <div>
          <FieldLabel>3B. Si respondió "No" a 2C, seleccione la razón:</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {['Adoptado/a o en guardianship permanente', 'Cumplió la edad límite de la corte', 'Otra razón'].map(opt => (
              <button key={opt} type="button" onClick={() => upd('placement_reason', opt)}
                className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${data.placement_reason === opt ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-600'}`}>{opt}</button>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs font-bold text-gray-500 uppercase mt-2">4. Reunificación no viable</p>
      <div>
        <FieldLabel required>La corte determinó que la reunificación NO es viable con:</FieldLabel>
        <div className="flex gap-3 mb-3">
          {['Uno de mis padres', 'Ambos padres'].map(opt => (
            <button key={opt} type="button" onClick={() => upd('reunification_not_viable_reason', opt === 'Ambos padres' ? data.reunification_not_viable_reason.replace(/^(Uno|Ambos).*?due to:?\s*/i, '') ? `Ambos padres — ${data.reunification_not_viable_reason.replace(/^(Uno|Ambos).*?—\s*/i, '')}` : 'Ambos padres' : opt)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                data.reunification_not_viable_reason.includes(opt.split(' ')[0]) ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-600'
              }`}>{opt}</button>
          ))}
        </div>
        <FieldLabel>Debido a (seleccione todas las que apliquen):</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {[{ key: 'Abuse', label: 'Abuso' }, { key: 'Neglect', label: 'Negligencia' }, { key: 'Abandonment', label: 'Abandono' }].map(opt => {
            const reasons = (data.reunification_not_viable_reason || '').split(', ').map(r => r.trim())
            const isSelected = reasons.includes(opt.key)
            return (
              <button key={opt.key} type="button"
                onClick={() => {
                  const base = reasons.filter(r => !['Abuse', 'Neglect', 'Abandonment'].includes(r)).join(', ')
                  const current = reasons.filter(r => ['Abuse', 'Neglect', 'Abandonment'].includes(r))
                  const next = isSelected ? current.filter(r => r !== opt.key) : [...current, opt.key]
                  upd('reunification_not_viable_reason', [base, ...next].filter(Boolean).join(', '))
                }}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  isSelected ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-600'
                }`}>☐ {opt.label}</button>
            )
          })}
        </div>
      </div>

      <p className="text-xs font-bold text-gray-500 uppercase mt-2">5. Mejor interés</p>
      <div>
        <FieldLabel required>¿Se ha determinado en procedimientos judiciales o administrativos que NO es en el mejor interés del menor regresar a su país de origen o de ciudadanía?</FieldLabel>
        <YesNo value={data.best_interest_not_return} onChange={v => upd('best_interest_not_return', v)} />
      </div>

      <p className="text-xs font-bold text-gray-500 uppercase mt-2">6A. Custodia HHS</p>
      <div>
        <FieldLabel>¿Estuvo o está actualmente bajo custodia del Departamento de Salud y Servicios Humanos (HHS)?<PrefilledBadge /></FieldLabel>
        <YesNo value={data.previously_hhs_custody} onChange={v => upd('previously_hhs_custody', v)} />
      </div>
    </div>
  )
}

// ══ STEP 5: CONTACT & ADDITIONAL INFO ════════════════════════════

function Step5Contact({ data, upd }: { data: I360Data; upd: (f: keyof I360Data, v: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-800">
        Part 11 — Información de contacto del peticionario, y Part 15 — Información adicional.
      </div>
      <p className="text-xs font-bold text-gray-500 uppercase">Contacto del peticionario</p>
      <div className="grid grid-cols-2 gap-3">
        <div><FieldLabel>3. Teléfono fijo</FieldLabel><TInput value={data.petitioner_phone} onChange={v => upd('petitioner_phone', v)} placeholder="Ej: 5619250029" /></div>
        <div><FieldLabel>4. Teléfono celular</FieldLabel><TInput value={data.petitioner_mobile} onChange={v => upd('petitioner_mobile', v)} placeholder="Ej: 5619250028" /></div>
      </div>
      <div><FieldLabel>5. Email</FieldLabel><TInput value={data.petitioner_email} onChange={v => upd('petitioner_email', v)} placeholder="correo@ejemplo.com" /></div>
      <div>
        <FieldLabel>1. ¿El peticionario puede leer y entender inglés?</FieldLabel>
        <div className="flex gap-2">
          {['Sí, entiendo inglés', 'No, necesito intérprete'].map(opt => (
            <button key={opt} type="button" onClick={() => {
              upd('language_understood', opt.includes('inglés') ? 'English' : 'Español')
              upd('interpreter_needed', opt.includes('No') ? 'Sí' : 'No')
            }}
              className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-colors ${
                (opt.includes('No') && data.interpreter_needed === 'Sí') || (opt.includes('Sí') && data.interpreter_needed === 'No')
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600'
              }`}>{opt}</button>
          ))}
        </div>
      </div>

      <p className="text-xs font-bold text-gray-500 uppercase mt-3">Part 15 — Información adicional</p>
      <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
        Aquí puede escribir información adicional relevante. Por ejemplo: &quot;La corte juvenil determinó que la reunificación no es viable con ambos padres debido a abandono y negligencia. Los nombres de los padres son: ...&quot;
      </div>
      <I360AdditionalInfo
        value={data.additional_info}
        onChange={(v) => upd('additional_info', v)}
      />
    </div>
  )
}

function I360AdditionalInfo({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const token = useVoiceToken()
  if (token) {
    return (
      <div>
        <FieldLabel>Información adicional</FieldLabel>
        <VoiceTextarea
          token={token}
          value={value}
          onChange={onChange}
          placeholder="Escriba o dicte información adicional que desee incluir en la petición..."
          rows={6}
        />
      </div>
    )
  }
  return (
    <div>
      <FieldLabel>Información adicional</FieldLabel>
      <textarea value={value} onChange={e => onChange(e.target.value)}
        placeholder="Escriba información adicional que desee incluir en la petición..."
        rows={6}
        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40 resize-none" />
    </div>
  )
}

// ══ STEP 6: CONFIRM ═════════════════════════════════════════════

function Step6Confirm({ data, onEdit }: { data: I360Data; onEdit: (step: number) => void }) {
  const sections = [
    { title: 'Part 1 — Peticionario', step: 0, fields: [
      ['Nombre', `${data.petitioner_first_name} ${data.petitioner_last_name}`],
      ['Dirección', `${data.petitioner_address}, ${data.petitioner_city} ${data.petitioner_state} ${data.petitioner_zip}`],
      ['A-Number', data.petitioner_a_number || 'N/A'],
      ['SSN', data.petitioner_ssn || 'N/A'],
    ]},
    { title: 'Part 3 — Beneficiario (Menor)', step: 1, fields: [
      ['Nombre', `${data.beneficiary_first_name} ${data.beneficiary_last_name}`],
      ['DOB', data.beneficiary_dob],
      ['País/Ciudad', `${data.beneficiary_city_birth}, ${data.beneficiary_country_birth}`],
      ['Sexo', data.beneficiary_sex],
      ['Estado civil', data.beneficiary_marital_status],
    ]},
    { title: 'Part 3/4 — Migratorio', step: 2, fields: [
      ['A-Number', data.beneficiary_a_number || 'N/A'],
      ['Pasaporte', `${data.beneficiary_passport_number} (${data.beneficiary_passport_country})`],
      ['I-94', data.beneficiary_i94_number || 'N/A'],
      ['Status', data.beneficiary_nonimmigrant_status || 'N/A'],
      ['En deportación', data.in_removal_proceedings],
      ['Padre extranjero', `${data.foreign_parent_first_name} ${data.foreign_parent_last_name}`.trim() || 'N/A'],
    ]},
    { title: 'Part 8 — SIJS', step: 3, fields: [
      ['Dependiente de corte', data.declared_dependent_court],
      ['Corte/Agencia', data.state_agency_name],
      ['Bajo jurisdicción', data.currently_under_jurisdiction],
      ['Razón no-reunificación', data.reunification_not_viable_reason],
      ['Padres', data.parent_names_not_viable],
      ['Mejor interés no regresar', data.best_interest_not_return],
    ]},
    { title: 'Part 11/15 — Contacto', step: 4, fields: [
      ['Teléfono', data.petitioner_phone || data.petitioner_mobile || 'N/A'],
      ['Email', data.petitioner_email || 'N/A'],
      ['Idioma', data.interpreter_needed === 'Sí' ? 'Necesita intérprete' : 'Entiende inglés'],
      ['Info adicional', data.additional_info ? 'Sí' : 'No'],
    ]},
  ]

  return (
    <div className="space-y-4">
      <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800">
        Revise toda la información antes de enviar. Puede editar cualquier sección haciendo clic en "Editar".
      </div>
      {sections.map(s => (
        <div key={s.title} className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50">
            <span className="text-xs font-bold text-gray-600 uppercase">{s.title}</span>
            <button onClick={() => onEdit(s.step)} className="text-xs text-indigo-600 hover:underline">Editar</button>
          </div>
          <div className="p-4 grid grid-cols-2 gap-2">
            {s.fields.map(([label, value]) => (
              <div key={label as string}>
                <span className="text-[10px] text-gray-400">{label as string}</span>
                <p className={`text-sm ${(value as string) ? 'text-gray-900' : 'text-red-500'}`}>{(value as string) || '[FALTA]'}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
