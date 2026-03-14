'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  ChevronLeft, ChevronRight, Loader2, CheckCircle, Send,
  Shield, Users, Globe, Scale, AlertTriangle,
} from 'lucide-react'

// -- Types --

interface PartB1Data {
  asylum_reasons: string[] // raza, religion, nacionalidad, opinion_politica, grupo_social, tortura
  has_suffered_harm: string // 'yes' | 'no' | ''
  harm_details: string
  fears_return: string // 'yes' | 'no' | ''
  fear_details: string
}

interface PartB2Data {
  arrested_abroad: string // 'yes' | 'no' | ''
  arrested_abroad_details: string
  member_organizations: string // 'yes' | 'no' | ''
  organizations_details: string
  still_participating: string // 'yes' | 'no' | ''
  still_participating_details: string
  fears_torture: string // 'yes' | 'no' | ''
  torture_details: string
}

interface PartC1Data {
  applied_before: string // 'yes' | 'no' | ''
  applied_before_details: string
  traveled_other_countries: string // 'yes' | 'no' | ''
  legal_status_other_country: string // 'yes' | 'no' | ''
  other_countries_details: string
}

interface PartC2Data {
  caused_harm: string // 'yes' | 'no' | ''
  caused_harm_details: string
  returned_to_country: string // 'yes' | 'no' | ''
  returned_details: string
  filing_after_one_year: string // 'yes' | 'no' | ''
  filing_delay_reason: string
  crimes_in_us: string // 'yes' | 'no' | ''
  crimes_details: string
}

// -- Constants --

const EMPTY_B1: PartB1Data = {
  asylum_reasons: [],
  has_suffered_harm: '',
  harm_details: '',
  fears_return: '',
  fear_details: '',
}

const EMPTY_B2: PartB2Data = {
  arrested_abroad: '',
  arrested_abroad_details: '',
  member_organizations: '',
  organizations_details: '',
  still_participating: '',
  still_participating_details: '',
  fears_torture: '',
  torture_details: '',
}

const EMPTY_C1: PartC1Data = {
  applied_before: '',
  applied_before_details: '',
  traveled_other_countries: '',
  legal_status_other_country: '',
  other_countries_details: '',
}

const EMPTY_C2: PartC2Data = {
  caused_harm: '',
  caused_harm_details: '',
  returned_to_country: '',
  returned_details: '',
  filing_after_one_year: '',
  filing_delay_reason: '',
  crimes_in_us: '',
  crimes_details: '',
}

const ASYLUM_REASONS = [
  { value: 'raza', label: 'Raza' },
  { value: 'religion', label: 'Religión' },
  { value: 'nacionalidad', label: 'Nacionalidad' },
  { value: 'opinion_politica', label: 'Opinión política' },
  { value: 'grupo_social', label: 'Pertenencia a un grupo social determinado' },
  { value: 'tortura', label: 'Convención contra la Tortura' },
]

const STEP_LABELS = [
  'Motivos de Asilo',
  'Antecedentes',
  'Solicitudes Previas',
  'Historial',
  'Revisión',
]

interface I589WizardProps {
  token: string
  clientName: string
}

// -- Main Component --

export function I589Wizard({ token, clientName }: I589WizardProps) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [statuses, setStatuses] = useState<Record<string, string>>({})
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({})

  const [b1, setB1] = useState<PartB1Data>({ ...EMPTY_B1 })
  const [b2, setB2] = useState<PartB2Data>({ ...EMPTY_B2 })
  const [c1, setC1] = useState<PartC1Data>({ ...EMPTY_C1 })
  const [c2, setC2] = useState<PartC2Data>({ ...EMPTY_C2 })

  // -- Data loading --
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/client-story?token=${token}`)
        if (!res.ok) return
        const data = await res.json()

        if (data.i589_part_b1?.data) setB1({ ...EMPTY_B1, ...data.i589_part_b1.data })
        if (data.i589_part_b2?.data) setB2({ ...EMPTY_B2, ...data.i589_part_b2.data })
        if (data.i589_part_c1?.data) setC1({ ...EMPTY_C1, ...data.i589_part_c1.data })
        if (data.i589_part_c2?.data) setC2({ ...EMPTY_C2, ...data.i589_part_c2.data })

        const s: Record<string, string> = {}
        const notes: Record<string, string> = {}
        for (const key of ['i589_part_b1', 'i589_part_b2', 'i589_part_c1', 'i589_part_c2']) {
          if (data[key]?.status) s[key] = data[key].status
          if (data[key]?.admin_notes) notes[key] = data[key].admin_notes
        }
        setStatuses(s)
        setAdminNotes(notes)

        const allDone = ['i589_part_b1', 'i589_part_b2', 'i589_part_c1', 'i589_part_c2']
          .every(k => s[k] === 'submitted' || s[k] === 'approved')
        if (allDone) setSubmitted(true)
      } catch {
        // First time, no data
      } finally {
        setLoadingData(false)
      }
    }
    load()
  }, [token])

  // -- Save helpers --
  function hasB1Content(): boolean {
    return !!(b1.asylum_reasons.length > 0 || b1.harm_details.trim() || b1.fear_details.trim())
  }

  function hasB2Content(): boolean {
    return !!(b2.arrested_abroad_details.trim() || b2.organizations_details.trim() || b2.torture_details.trim() || b2.arrested_abroad)
  }

  function hasC1Content(): boolean {
    return !!(c1.applied_before_details.trim() || c1.other_countries_details.trim() || c1.applied_before)
  }

  function hasC2Content(): boolean {
    return !!(c2.caused_harm_details.trim() || c2.returned_details.trim() || c2.filing_delay_reason.trim() || c2.crimes_details.trim() || c2.caused_harm)
  }

  const saveDraft = useCallback(async (formType: string, formData: unknown) => {
    setSaving(true)
    try {
      await fetch('/api/client-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, form_type: formType, form_data: formData, action: 'draft', minor_index: 0 }),
      })
    } catch {
      // Silent draft save
    } finally {
      setSaving(false)
    }
  }, [token])

  async function saveCurrentStep() {
    if (step === 0 && hasB1Content()) await saveDraft('i589_part_b1', b1)
    if (step === 1 && hasB2Content()) await saveDraft('i589_part_b2', b2)
    if (step === 2 && hasC1Content()) await saveDraft('i589_part_c1', c1)
    if (step === 3 && hasC2Content()) await saveDraft('i589_part_c2', c2)
  }

  function goNext() {
    saveCurrentStep()
    setStep(s => Math.min(s + 1, 4))
  }

  function goBack() {
    saveCurrentStep()
    setStep(s => Math.max(s - 1, 0))
  }

  // -- Validation --
  function validateAll(): boolean {
    if (b1.asylum_reasons.length === 0) {
      toast.error('Selecciona al menos un motivo de tu solicitud de asilo')
      setStep(0)
      return false
    }
    if (!b1.has_suffered_harm) {
      toast.error('Indica si has sufrido daño, maltrato o amenazas')
      setStep(0)
      return false
    }
    if (b1.has_suffered_harm === 'yes' && !b1.harm_details.trim()) {
      toast.error('Describe los daños o amenazas sufridas')
      setStep(0)
      return false
    }
    if (!b1.fears_return) {
      toast.error('Indica si temes regresar a tu país')
      setStep(0)
      return false
    }
    if (b1.fears_return === 'yes' && !b1.fear_details.trim()) {
      toast.error('Describe qué temes si regresas')
      setStep(0)
      return false
    }
    return true
  }

  async function handleSubmit() {
    if (!validateAll()) return

    setSubmitting(true)
    try {
      const submissions = [
        { form_type: 'i589_part_b1', form_data: b1 },
        { form_type: 'i589_part_b2', form_data: b2 },
        { form_type: 'i589_part_c1', form_data: c1 },
        { form_type: 'i589_part_c2', form_data: c2 },
      ]
      for (const sub of submissions) {
        const res = await fetch('/api/client-story', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, ...sub, action: 'submit', minor_index: 0 }),
        })
        if (!res.ok) throw new Error('Error al enviar')
      }
      setSubmitted(true)
      toast.success('¡Formulario I-589 enviado exitosamente!')
    } catch {
      toast.error('Error al enviar. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  // -- Render --

  if (loadingData) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#F2A900]" />
      </div>
    )
  }

  // Correction banner
  const needsCorrection = Object.entries(statuses).some(([, v]) => v === 'needs_correction')

  if (submitted && !needsCorrection) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">¡Formulario I-589 Enviado!</h3>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          Tu información ha sido enviada a tu consultor para revisión.
          Te notificaremos si necesitamos correcciones.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Correction banner */}
      {needsCorrection && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="text-sm font-semibold text-red-700">Correcciones solicitadas</span>
          </div>
          {Object.entries(adminNotes).filter(([, v]) => v).map(([key, note]) => (
            <p key={key} className="text-sm text-red-600 ml-7">{note}</p>
          ))}
        </div>
      )}

      {/* Progress */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold text-gray-900">Formulario I-589 — Partes B y C</h3>
          <span className="text-xs text-gray-400">
            {saving ? 'Guardando...' : `Paso ${step + 1} de 5`}
          </span>
        </div>
        <div className="flex gap-1">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className="flex-1">
              <div className={`h-1.5 rounded-full transition-colors ${i <= step ? 'bg-[#F2A900]' : 'bg-gray-200'}`} />
              <p className={`text-[9px] mt-1 truncate ${i === step ? 'text-[#002855] font-medium' : 'text-gray-400'}`}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Steps */}
      {step === 0 && <StepB1 data={b1} onChange={setB1} />}
      {step === 1 && <StepB2 data={b2} onChange={setB2} />}
      {step === 2 && <StepC1 data={c1} onChange={setC1} />}
      {step === 3 && <StepC2 data={c2} onChange={setC2} />}
      {step === 4 && <StepReview b1={b1} b2={b2} c1={c1} c2={c2} />}

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={goBack} disabled={step === 0}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
        </Button>
        {step < 4 ? (
          <Button onClick={goNext} className="bg-[#002855] hover:bg-[#001d3d]">
            Siguiente <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting} className="bg-green-600 hover:bg-green-700">
            {submitting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
            Enviar al consultor
          </Button>
        )}
      </div>
    </div>
  )
}

// -- Step Components --

function YesNoField({ label, value, onChange, helpText }: {
  label: string; value: string; onChange: (v: string) => void; helpText?: string
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {helpText && <p className="text-xs text-gray-400">{helpText}</p>}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onChange('yes')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            value === 'yes' ? 'bg-[#002855] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Sí
        </button>
        <button
          type="button"
          onClick={() => onChange('no')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            value === 'no' ? 'bg-[#002855] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          No
        </button>
      </div>
    </div>
  )
}

function TextArea({ label, value, onChange, placeholder, helpText }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; helpText?: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {helpText && <p className="text-xs text-gray-400 leading-relaxed">{helpText}</p>}
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F2A900]/50 focus:border-[#F2A900]/30 resize-y"
      />
    </div>
  )
}

function SectionHeader({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 mb-5 p-3 bg-blue-50/50 rounded-xl border border-blue-100/50">
      <div className="w-8 h-8 rounded-lg bg-[#002855]/10 flex items-center justify-center shrink-0 mt-0.5">
        {icon}
      </div>
      <div>
        <h4 className="text-sm font-semibold text-[#002855]">{title}</h4>
        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

function StepB1({ data, onChange }: { data: PartB1Data; onChange: (d: PartB1Data) => void }) {
  function toggleReason(val: string) {
    const reasons = data.asylum_reasons.includes(val)
      ? data.asylum_reasons.filter(r => r !== val)
      : [...data.asylum_reasons, val]
    onChange({ ...data, asylum_reasons: reasons })
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        icon={<Shield className="w-4 h-4 text-[#002855]" />}
        title="Parte B.1 — Motivos de tu Solicitud"
        desc="Selecciona las razones por las que solicitas asilo y describe detalladamente tu situación."
      />

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">¿Por qué solicitas asilo?</label>
        <p className="text-xs text-gray-400">Puedes seleccionar más de una opción</p>
        <div className="grid grid-cols-2 gap-2">
          {ASYLUM_REASONS.map(r => (
            <button
              key={r.value}
              type="button"
              onClick={() => toggleReason(r.value)}
              className={`text-left px-3 py-2.5 rounded-lg text-sm transition-colors border ${
                data.asylum_reasons.includes(r.value)
                  ? 'bg-[#002855] text-white border-[#002855]'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <YesNoField
        label="¿Ha sufrido usted, su familia o personas cercanas algún daño, maltrato o amenaza?"
        value={data.has_suffered_harm}
        onChange={v => onChange({ ...data, has_suffered_harm: v })}
      />
      {data.has_suffered_harm === 'yes' && (
        <TextArea
          label="Describa detalladamente"
          value={data.harm_details}
          onChange={v => onChange({ ...data, harm_details: v })}
          placeholder="Describa qué pasó, cuándo ocurrió, quién lo causó y por qué cree que sucedió..."
          helpText="Incluya: 1) Qué pasó, 2) Cuándo ocurrió, 3) Quién causó el daño, 4) Por qué cree que ocurrió"
        />
      )}

      <YesNoField
        label="¿Teme sufrir daño o maltrato si regresa a su país?"
        value={data.fears_return}
        onChange={v => onChange({ ...data, fears_return: v })}
      />
      {data.fears_return === 'yes' && (
        <TextArea
          label="Describa detalladamente"
          value={data.fear_details}
          onChange={v => onChange({ ...data, fear_details: v })}
          placeholder="Describa qué daño teme, quién lo haría y por qué..."
          helpText="Incluya: 1) Qué daño o maltrato teme, 2) Quién cree que se lo haría, 3) Por qué cree que sería dañado"
        />
      )}
    </div>
  )
}

function StepB2({ data, onChange }: { data: PartB2Data; onChange: (d: PartB2Data) => void }) {
  return (
    <div className="space-y-5">
      <SectionHeader
        icon={<Users className="w-4 h-4 text-[#002855]" />}
        title="Parte B.2-4 — Antecedentes y Organizaciones"
        desc="Información sobre arrestos, organizaciones y temor a tortura."
      />

      <YesNoField
        label="¿Ha sido arrestado, detenido, interrogado o encarcelado en algún país fuera de EE.UU.?"
        value={data.arrested_abroad}
        onChange={v => onChange({ ...data, arrested_abroad: v })}
        helpText="Incluye infracciones de ley de inmigración"
      />
      {data.arrested_abroad === 'yes' && (
        <TextArea
          label="Explique las circunstancias y razones"
          value={data.arrested_abroad_details}
          onChange={v => onChange({ ...data, arrested_abroad_details: v })}
        />
      )}

      <YesNoField
        label="¿Ha pertenecido a alguna organización o grupo (político, religioso, militar, sindical, de derechos humanos, etc.)?"
        value={data.member_organizations}
        onChange={v => onChange({ ...data, member_organizations: v })}
      />
      {data.member_organizations === 'yes' && (
        <TextArea
          label="Describa su participación, cargos y tiempo en cada organización"
          value={data.organizations_details}
          onChange={v => onChange({ ...data, organizations_details: v })}
        />
      )}

      {data.member_organizations === 'yes' && (
        <>
          <YesNoField
            label="¿Sigue participando actualmente en esas organizaciones?"
            value={data.still_participating}
            onChange={v => onChange({ ...data, still_participating: v })}
          />
          {data.still_participating === 'yes' && (
            <TextArea
              label="Describa su participación actual"
              value={data.still_participating_details}
              onChange={v => onChange({ ...data, still_participating_details: v })}
            />
          )}
        </>
      )}

      <YesNoField
        label="¿Teme ser sometido a tortura en su país o en cualquier otro país?"
        value={data.fears_torture}
        onChange={v => onChange({ ...data, fears_torture: v })}
      />
      {data.fears_torture === 'yes' && (
        <TextArea
          label="Describa la tortura que teme, quién la infligiría y por qué"
          value={data.torture_details}
          onChange={v => onChange({ ...data, torture_details: v })}
        />
      )}
    </div>
  )
}

function StepC1({ data, onChange }: { data: PartC1Data; onChange: (d: PartC1Data) => void }) {
  return (
    <div className="space-y-5">
      <SectionHeader
        icon={<Globe className="w-4 h-4 text-[#002855]" />}
        title="Parte C.1-2 — Solicitudes Previas y Viajes"
        desc="Información sobre solicitudes anteriores de asilo y viajes a otros países."
      />

      <YesNoField
        label="¿Usted o algún familiar ha solicitado asilo o refugio antes en EE.UU.?"
        value={data.applied_before}
        onChange={v => onChange({ ...data, applied_before: v })}
      />
      {data.applied_before === 'yes' && (
        <TextArea
          label="Explique la decisión y qué ocurrió"
          value={data.applied_before_details}
          onChange={v => onChange({ ...data, applied_before_details: v })}
          helpText="Incluya si fue incluido en la solicitud de un padre o cónyuge, el número A, y cualquier cambio en su situación desde entonces"
        />
      )}

      <YesNoField
        label="Después de salir de su país, ¿viajó o residió en otro país antes de entrar a EE.UU.?"
        value={data.traveled_other_countries}
        onChange={v => onChange({ ...data, traveled_other_countries: v })}
      />

      <YesNoField
        label="¿Ha recibido algún estatus legal en un país distinto al de su solicitud de asilo?"
        value={data.legal_status_other_country}
        onChange={v => onChange({ ...data, legal_status_other_country: v })}
      />

      {(data.traveled_other_countries === 'yes' || data.legal_status_other_country === 'yes') && (
        <TextArea
          label="Para cada país, describa"
          value={data.other_countries_details}
          onChange={v => onChange({ ...data, other_countries_details: v })}
          helpText="Incluya: nombre del país, duración de estancia, estatus, motivo de salida, si tiene derecho a regresar, y si solicitó asilo allí"
          placeholder="País, duración, estatus, razón de salida..."
        />
      )}
    </div>
  )
}

function StepC2({ data, onChange }: { data: PartC2Data; onChange: (d: PartC2Data) => void }) {
  return (
    <div className="space-y-5">
      <SectionHeader
        icon={<Scale className="w-4 h-4 text-[#002855]" />}
        title="Parte C.3-6 — Historial y Antecedentes Penales"
        desc="Información sobre antecedentes y circunstancias adicionales de su caso."
      />

      <YesNoField
        label="¿Ha causado usted o su familia daño a alguien por motivos de raza, religión, nacionalidad, grupo social u opinión política?"
        value={data.caused_harm}
        onChange={v => onChange({ ...data, caused_harm: v })}
      />
      {data.caused_harm === 'yes' && (
        <TextArea
          label="Describa detalladamente cada incidente"
          value={data.caused_harm_details}
          onChange={v => onChange({ ...data, caused_harm_details: v })}
        />
      )}

      <YesNoField
        label="Después de salir del país donde sufrió daños, ¿regresó a ese país?"
        value={data.returned_to_country}
        onChange={v => onChange({ ...data, returned_to_country: v })}
      />
      {data.returned_to_country === 'yes' && (
        <TextArea
          label="Describa las circunstancias de su(s) visita(s)"
          value={data.returned_details}
          onChange={v => onChange({ ...data, returned_details: v })}
          helpText="Incluya: fechas de viaje, propósito y tiempo que permaneció"
        />
      )}

      <YesNoField
        label="¿Está presentando esta solicitud más de 1 año después de su última llegada a EE.UU.?"
        value={data.filing_after_one_year}
        onChange={v => onChange({ ...data, filing_after_one_year: v })}
      />
      {data.filing_after_one_year === 'yes' && (
        <TextArea
          label="Explique por qué no presentó la solicitud en el primer año"
          value={data.filing_delay_reason}
          onChange={v => onChange({ ...data, filing_delay_reason: v })}
          helpText="Debe estar preparado para explicar esto en su entrevista o audiencia"
        />
      )}

      <YesNoField
        label="¿Ha cometido algún delito o ha sido detenido/condenado en Estados Unidos?"
        value={data.crimes_in_us}
        onChange={v => onChange({ ...data, crimes_in_us: v })}
        helpText="Incluye infracciones de ley de inmigración"
      />
      {data.crimes_in_us === 'yes' && (
        <TextArea
          label="Describa cada caso detalladamente"
          value={data.crimes_details}
          onChange={v => onChange({ ...data, crimes_details: v })}
          helpText="Incluya: qué ocurrió, fechas, duración de condena, lugar, motivo de detención, y documentos disponibles"
        />
      )}
    </div>
  )
}

function StepReview({ b1, b2, c1, c2 }: { b1: PartB1Data; b2: PartB2Data; c1: PartC1Data; c2: PartC2Data }) {
  const yesNo = (v: string) => v === 'yes' ? 'Sí' : v === 'no' ? 'No' : '—'

  return (
    <div className="space-y-5">
      <SectionHeader
        icon={<CheckCircle className="w-4 h-4 text-green-600" />}
        title="Revisión Final"
        desc="Revisa toda tu información antes de enviarla. Puedes volver a cualquier paso para corregir."
      />

      {/* B1 */}
      <ReviewSection title="Motivos de Asilo (Parte B.1)">
        <ReviewRow label="Motivos" value={b1.asylum_reasons.map(r => ASYLUM_REASONS.find(a => a.value === r)?.label).filter(Boolean).join(', ') || '—'} />
        <ReviewRow label="¿Ha sufrido daño?" value={yesNo(b1.has_suffered_harm)} />
        {b1.has_suffered_harm === 'yes' && <ReviewRow label="Detalles" value={b1.harm_details} />}
        <ReviewRow label="¿Teme regresar?" value={yesNo(b1.fears_return)} />
        {b1.fears_return === 'yes' && <ReviewRow label="Detalles" value={b1.fear_details} />}
      </ReviewSection>

      {/* B2 */}
      <ReviewSection title="Antecedentes (Parte B.2-4)">
        <ReviewRow label="¿Arrestado en el exterior?" value={yesNo(b2.arrested_abroad)} />
        {b2.arrested_abroad === 'yes' && <ReviewRow label="Detalles" value={b2.arrested_abroad_details} />}
        <ReviewRow label="¿Miembro de organizaciones?" value={yesNo(b2.member_organizations)} />
        {b2.member_organizations === 'yes' && <ReviewRow label="Detalles" value={b2.organizations_details} />}
        <ReviewRow label="¿Teme tortura?" value={yesNo(b2.fears_torture)} />
        {b2.fears_torture === 'yes' && <ReviewRow label="Detalles" value={b2.torture_details} />}
      </ReviewSection>

      {/* C1 */}
      <ReviewSection title="Solicitudes Previas (Parte C.1-2)">
        <ReviewRow label="¿Solicitó asilo antes?" value={yesNo(c1.applied_before)} />
        {c1.applied_before === 'yes' && <ReviewRow label="Detalles" value={c1.applied_before_details} />}
        <ReviewRow label="¿Viajó por otros países?" value={yesNo(c1.traveled_other_countries)} />
        <ReviewRow label="¿Estatus en otro país?" value={yesNo(c1.legal_status_other_country)} />
        {(c1.traveled_other_countries === 'yes' || c1.legal_status_other_country === 'yes') && (
          <ReviewRow label="Detalles" value={c1.other_countries_details} />
        )}
      </ReviewSection>

      {/* C2 */}
      <ReviewSection title="Historial (Parte C.3-6)">
        <ReviewRow label="¿Ha causado daño?" value={yesNo(c2.caused_harm)} />
        {c2.caused_harm === 'yes' && <ReviewRow label="Detalles" value={c2.caused_harm_details} />}
        <ReviewRow label="¿Regresó al país?" value={yesNo(c2.returned_to_country)} />
        {c2.returned_to_country === 'yes' && <ReviewRow label="Detalles" value={c2.returned_details} />}
        <ReviewRow label="¿Más de 1 año después?" value={yesNo(c2.filing_after_one_year)} />
        {c2.filing_after_one_year === 'yes' && <ReviewRow label="Razón" value={c2.filing_delay_reason} />}
        <ReviewRow label="¿Delitos en EE.UU.?" value={yesNo(c2.crimes_in_us)} />
        {c2.crimes_in_us === 'yes' && <ReviewRow label="Detalles" value={c2.crimes_details} />}
      </ReviewSection>
    </div>
  )
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="bg-gray-50 px-4 py-2.5">
        <h4 className="text-sm font-semibold text-[#002855]">{title}</h4>
      </div>
      <div className="p-4 space-y-2">{children}</div>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  if (!value || value === '—') return (
    <div className="flex gap-2 text-sm">
      <span className="text-gray-400 shrink-0">{label}:</span>
      <span className="text-gray-300">—</span>
    </div>
  )
  return (
    <div className="text-sm">
      <span className="text-gray-500 font-medium">{label}:</span>
      <p className="text-gray-800 whitespace-pre-wrap mt-0.5">{value}</p>
    </div>
  )
}
