'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Loader2, CheckCircle, Send, BookOpen } from 'lucide-react'

type ParentSituation = 'cooperates' | 'absent' | 'deceased' | 'unknown' | 'never_known' | ''

interface StoryData {
  arrival_year: string
  who_brought: string
  current_guardian: string
  separation_date: string
  how_was_abandonment: string
  father_economic_support: string
  father_contact_with_child: string
  who_took_care: string
  has_complaints: string
  complaints_detail: string
  why_no_reunification: string
  additional_details: string
}

interface ParentData {
  situation: ParentSituation
  parent_name: string
  parent_relationship: string
  // cooperates
  parent_phone: string
  parent_email: string
  willing_to_sign: string
  // absent
  last_contact_date: string
  last_contact_description: string
  reason_absent: string
  efforts_to_find: string
  // deceased
  death_date: string
  death_place: string
  has_death_certificate: string
  // unknown / never_known
  what_is_known: string
}

interface Witness {
  name: string
  relationship: string
  phone: string
  can_testify: string
}

interface WitnessesData {
  witnesses: Witness[]
}

interface ClientStoryWizardProps {
  token: string
  clientName: string
}

const EMPTY_WITNESS: Witness = { name: '', relationship: '', phone: '', can_testify: '' }

const STEPS = ['Mi Historia', 'Padre/Madre Ausente', 'Testigos', 'Revisión']

const PARENT_SITUATIONS: { value: ParentSituation; label: string; desc: string }[] = [
  { value: 'cooperates', label: 'Coopera', desc: 'Está dispuesto/a a firmar documentos' },
  { value: 'absent', label: 'Ausente', desc: 'No tiene contacto o está ausente' },
  { value: 'deceased', label: 'Falleció', desc: 'El padre/madre ha fallecido' },
  { value: 'unknown', label: 'Desconocido', desc: 'No sabe quién es' },
  { value: 'never_known', label: 'Nunca lo/la conoció', desc: 'Nunca tuvo relación' },
]

export function ClientStoryWizard({ token, clientName }: ClientStoryWizardProps) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [statuses, setStatuses] = useState<Record<string, string>>({})
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({})

  const [story, setStory] = useState<StoryData>({
    arrival_year: '', who_brought: '', current_guardian: '',
    separation_date: '', how_was_abandonment: '', father_economic_support: '',
    father_contact_with_child: '', who_took_care: '', has_complaints: '',
    complaints_detail: '', why_no_reunification: '', additional_details: '',
  })

  const [parent, setParent] = useState<ParentData>({
    situation: '', parent_name: '', parent_relationship: 'padre',
    parent_phone: '', parent_email: '', willing_to_sign: '',
    last_contact_date: '', last_contact_description: '', reason_absent: '', efforts_to_find: '',
    death_date: '', death_place: '', has_death_certificate: '',
    what_is_known: '',
  })

  const [witnesses, setWitnesses] = useState<WitnessesData>({
    witnesses: [{ ...EMPTY_WITNESS }],
  })

  // Load existing data
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/client-story?token=${token}`)
        if (!res.ok) return
        const data = await res.json()
        if (data.client_story?.data) setStory(prev => ({ ...prev, ...data.client_story.data }))
        if (data.client_witnesses?.data) setWitnesses(prev => ({ ...prev, ...data.client_witnesses.data }))
        if (data.client_absent_parent?.data) setParent(prev => ({ ...prev, ...data.client_absent_parent.data }))

        const s: Record<string, string> = {}
        const notes: Record<string, string> = {}
        for (const key of ['client_story', 'client_witnesses', 'client_absent_parent']) {
          if (data[key]?.status) s[key] = data[key].status
          if (data[key]?.admin_notes) notes[key] = data[key].admin_notes
        }
        setStatuses(s)
        setAdminNotes(notes)

        const allSubmittedOrApproved = Object.values(s).length === 3 &&
          Object.values(s).every(v => v === 'submitted' || v === 'approved')
        if (allSubmittedOrApproved) setSubmitted(true)
      } catch {
        // First time, no data
      } finally {
        setLoadingData(false)
      }
    }
    load()
  }, [token])

  const saveDraft = useCallback(async (formType: string, formData: unknown) => {
    setSaving(true)
    try {
      await fetch('/api/client-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, form_type: formType, form_data: formData, action: 'draft' }),
      })
    } catch {
      // Silent draft save failure
    } finally {
      setSaving(false)
    }
  }, [token])

  // Auto-save when moving between steps
  const saveCurrentStep = useCallback(async () => {
    if (step === 0) await saveDraft('client_story', story)
    if (step === 1) await saveDraft('client_absent_parent', parent)
    if (step === 2) await saveDraft('client_witnesses', witnesses)
  }, [step, story, parent, witnesses, saveDraft])

  function goNext() {
    saveCurrentStep()
    setStep(s => Math.min(s + 1, 3))
  }

  function goBack() {
    saveCurrentStep()
    setStep(s => Math.max(s - 1, 0))
  }

  function validateStory(): boolean {
    if (!story.arrival_year || !story.who_brought || !story.current_guardian || !story.how_was_abandonment) {
      toast.error('Completa los campos obligatorios de "Mi Historia" (marcados con *)')
      return false
    }
    return true
  }

  function validateParent(): boolean {
    if (!parent.situation) {
      toast.error('Selecciona la situación del padre/madre')
      return false
    }
    if (parent.situation === 'cooperates' && !parent.parent_name) {
      toast.error('Ingresa el nombre del padre/madre')
      return false
    }
    if (parent.situation === 'absent' && !parent.reason_absent) {
      toast.error('Describe la razón de la ausencia')
      return false
    }
    return true
  }

  function validateWitnesses(): boolean {
    const valid = witnesses.witnesses.filter(w => w.name.trim())
    if (valid.length === 0) {
      toast.error('Agrega al menos un testigo')
      return false
    }
    for (const w of valid) {
      if (!w.relationship || !w.can_testify) {
        toast.error('Completa los datos de cada testigo')
        return false
      }
    }
    return true
  }

  async function handleSubmit() {
    // Validate only at final submission
    if (!validateStory()) return
    if (!validateParent()) return
    if (!validateWitnesses()) return

    setSubmitting(true)
    try {
      const submissions = [
        { form_type: 'client_story', form_data: story },
        { form_type: 'client_absent_parent', form_data: parent },
        { form_type: 'client_witnesses', form_data: witnesses },
      ]
      for (const sub of submissions) {
        const res = await fetch('/api/client-story', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, ...sub, action: 'submit' }),
        })
        if (!res.ok) throw new Error('Error al enviar')
      }
      setSubmitted(true)
      toast.success('¡Tu historia ha sido enviada exitosamente!')
    } catch {
      toast.error('Error al enviar. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingData) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#F2A900]" />
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">¡Historia Enviada!</h3>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          Tu consultor revisará la información y te contactará si necesita más detalles.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-between">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
              i < step ? 'bg-green-500 text-white'
                : i === step ? 'bg-[#F2A900] text-white'
                  : 'bg-gray-200 text-gray-500'
            }`}>
              {i < step ? <CheckCircle className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`ml-2 text-xs hidden sm:inline ${i === step ? 'text-[#F2A900] font-semibold' : 'text-gray-400'}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <div className="w-8 sm:w-16 h-0.5 mx-2 bg-gray-200" />}
          </div>
        ))}
      </div>

      {/* Corrections banner */}
      {Object.values(statuses).some(s => s === 'needs_correction') && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm font-semibold text-red-700 mb-1">Tu consultor ha solicitado correcciones:</p>
          {Object.entries(adminNotes).map(([key, note]) => note && statuses[key] === 'needs_correction' && (
            <p key={key} className="text-sm text-red-600 mt-1">
              <span className="font-medium">{key === 'client_story' ? 'Historia' : key === 'client_absent_parent' ? 'Padre/Madre' : 'Testigos'}:</span>{' '}
              {note}
            </p>
          ))}
        </div>
      )}

      {/* Step content */}
      {step === 0 && <StoryStep story={story} onChange={setStory} />}
      {step === 1 && <ParentStep parent={parent} onChange={setParent} />}
      {step === 2 && <WitnessStep witnesses={witnesses} onChange={setWitnesses} />}
      {step === 3 && (
        <ReviewStep story={story} parent={parent} witnesses={witnesses} onEdit={setStep} />
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={goBack} disabled={step === 0 || submitting}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
        </Button>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-gray-400">Guardando...</span>}
          {step < 3 ? (
            <Button onClick={goNext} className="bg-[#F2A900] hover:bg-[#D4940A] text-white">
              Siguiente <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting} className="bg-green-600 hover:bg-green-700 text-white">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Enviar a mi consultor
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// -- Step Components --

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {children} {required && <span className="text-red-500">*</span>}
    </label>
  )
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]/50 focus:border-[#F2A900]"
    />
  )
}

function TextArea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]/50 focus:border-[#F2A900] resize-none"
    />
  )
}

function StoryStep({ story, onChange }: { story: StoryData; onChange: (s: StoryData) => void }) {
  const set = (field: keyof StoryData, value: string) => onChange({ ...story, [field]: value })
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <BookOpen className="w-5 h-5 text-[#F2A900]" />
        <h3 className="font-semibold text-gray-900">Tu Historia</h3>
      </div>
      <p className="text-sm text-gray-500">
        Cuéntanos tu experiencia. Esta información es confidencial y será usada por tu consultor para preparar tu caso.
      </p>

      <div>
        <FieldLabel required>¿En qué año llegaste a los Estados Unidos?</FieldLabel>
        <TextInput value={story.arrival_year} onChange={v => set('arrival_year', v)} placeholder="Ej: 2020" />
      </div>
      <div>
        <FieldLabel required>¿Quién te trajo a los Estados Unidos?</FieldLabel>
        <TextInput value={story.who_brought} onChange={v => set('who_brought', v)} placeholder="Ej: Mi madre, mi tía, un familiar, etc." />
      </div>
      <div>
        <FieldLabel required>¿Con quién vives actualmente en EE.UU.?</FieldLabel>
        <TextInput value={story.current_guardian} onChange={v => set('current_guardian', v)} placeholder="Nombre completo de la persona y su relación contigo (ej: Mi madre María López)" />
      </div>
      <div>
        <FieldLabel>¿Cuándo se separaron tus padres? (fecha aproximada)</FieldLabel>
        <TextInput value={story.separation_date} onChange={v => set('separation_date', v)} placeholder="Ej: En 2015, cuando yo tenía 5 años / Nunca vivieron juntos" />
      </div>
      <div>
        <FieldLabel required>¿Cómo fue el abandono? Describe con el mayor detalle posible.</FieldLabel>
        <TextArea value={story.how_was_abandonment} onChange={v => set('how_was_abandonment', v)} placeholder="Cuenta desde el inicio: ¿vivías con ambos padres? ¿qué pasó? ¿se fue, nunca lo/la conociste, tenía otra familia? Incluye nombres, fechas y lugares que recuerdes. Sé lo más detallista posible." rows={6} />
      </div>
      <div>
        <FieldLabel>¿El padre/madre que te abandonó dio apoyo económico alguna vez?</FieldLabel>
        <TextArea value={story.father_economic_support} onChange={v => set('father_economic_support', v)} placeholder="Ej: Nunca dio dinero / Daba algo al principio y luego dejó de dar / Hubo demanda de alimentos..." rows={3} />
      </div>
      <div>
        <FieldLabel>¿El padre/madre ausente tuvo contacto contigo después de la separación? (llamadas, visitas, cumpleaños, etc.)</FieldLabel>
        <TextArea value={story.father_contact_with_child} onChange={v => set('father_contact_with_child', v)} placeholder="Ej: Nunca me llamó / Una vez prometió venir a mi cumpleaños y nunca llegó / No sé nada de él/ella desde 2016..." rows={3} />
      </div>
      <div>
        <FieldLabel>¿Quién se hizo cargo de ti cuando te abandonaron? (nombre completo y relación)</FieldLabel>
        <TextArea value={story.who_took_care} onChange={v => set('who_took_care', v)} placeholder="Ej: Mi madre María López se hizo cargo sola / Mi abuela Juana Pérez me cuidó los primeros años..." rows={3} />
      </div>
      <div>
        <FieldLabel>¿Tienes denuncias o documentos que prueben el abandono?</FieldLabel>
        <div className="flex gap-3 mb-2">
          {['Sí', 'No'].map(opt => (
            <button
              key={opt}
              onClick={() => set('has_complaints', opt)}
              className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                story.has_complaints === opt
                  ? 'border-[#F2A900] bg-[#F2A900]/10 text-[#F2A900]'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
        {story.has_complaints === 'Sí' && (
          <TextArea value={story.complaints_detail} onChange={v => set('complaints_detail', v)} placeholder="Describe qué documentos tienes: demanda de alimentos, denuncia por maltrato, denuncia por violencia, acta policial, etc." rows={3} />
        )}
      </div>
      <div>
        <FieldLabel>¿Por qué no puedes volver a vivir con el padre/madre que te abandonó?</FieldLabel>
        <TextArea value={story.why_no_reunification} onChange={v => set('why_no_reunification', v)} placeholder="Ej: Tiene otra familia, está preso, tiene denuncias por violencia, no sé dónde vive, nunca se hizo responsable..." rows={4} />
      </div>
      <div>
        <FieldLabel>¿Hay algo más que quieras agregar?</FieldLabel>
        <TextArea value={story.additional_details} onChange={v => set('additional_details', v)} placeholder="Cualquier detalle adicional que creas importante para tu caso..." rows={3} />
      </div>
    </div>
  )
}

function ParentStep({ parent, onChange }: { parent: ParentData; onChange: (p: ParentData) => void }) {
  const set = (field: keyof ParentData, value: string) => onChange({ ...parent, [field]: value })
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900">Situación del Padre/Madre</h3>
      <p className="text-sm text-gray-500">
        Selecciona la situación que mejor describe la relación con tu padre o madre ausente.
      </p>

      <div>
        <FieldLabel required>¿De quién estamos hablando?</FieldLabel>
        <div className="flex gap-3">
          {['padre', 'madre'].map(r => (
            <button
              key={r}
              onClick={() => set('parent_relationship', r)}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                parent.parent_relationship === r
                  ? 'border-[#F2A900] bg-[#F2A900]/10 text-[#F2A900]'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {r === 'padre' ? 'Padre' : 'Madre'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <FieldLabel required>¿Cuál es la situación?</FieldLabel>
        <div className="grid gap-2">
          {PARENT_SITUATIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => set('situation', opt.value)}
              className={`text-left p-3 rounded-xl border transition-colors ${
                parent.situation === opt.value
                  ? 'border-[#F2A900] bg-[#F2A900]/10'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-sm font-medium text-gray-800">{opt.label}</span>
              <span className="block text-xs text-gray-500 mt-0.5">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Adaptive fields */}
      {parent.situation === 'cooperates' && (
        <div className="space-y-3 p-4 bg-blue-50 rounded-xl">
          <p className="text-sm font-medium text-blue-800">Información de contacto del padre/madre</p>
          <div>
            <FieldLabel required>Nombre completo</FieldLabel>
            <TextInput value={parent.parent_name} onChange={v => set('parent_name', v)} placeholder="Nombre del padre/madre" />
          </div>
          <div>
            <FieldLabel>Teléfono</FieldLabel>
            <TextInput value={parent.parent_phone} onChange={v => set('parent_phone', v)} placeholder="+1 (000) 000-0000" />
          </div>
          <div>
            <FieldLabel>Email</FieldLabel>
            <TextInput value={parent.parent_email} onChange={v => set('parent_email', v)} placeholder="email@ejemplo.com" />
          </div>
          <div>
            <FieldLabel>¿Está dispuesto/a a firmar documentos de custodia?</FieldLabel>
            <div className="flex gap-3">
              {['Sí', 'No', 'No estoy seguro/a'].map(opt => (
                <button
                  key={opt}
                  onClick={() => set('willing_to_sign', opt)}
                  className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                    parent.willing_to_sign === opt
                      ? 'border-[#F2A900] bg-[#F2A900]/10 text-[#F2A900]'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {parent.situation === 'absent' && (
        <div className="space-y-3 p-4 bg-orange-50 rounded-xl">
          <p className="text-sm font-medium text-orange-800">Información sobre la ausencia</p>
          <div>
            <FieldLabel>Nombre del padre/madre (si lo sabe)</FieldLabel>
            <TextInput value={parent.parent_name} onChange={v => set('parent_name', v)} />
          </div>
          <div>
            <FieldLabel>¿Cuándo fue la última vez que tuvo contacto?</FieldLabel>
            <TextInput value={parent.last_contact_date} onChange={v => set('last_contact_date', v)} placeholder="Ej: Hace 5 años, en 2018, nunca" />
          </div>
          <div>
            <FieldLabel>¿Cómo fue ese último contacto?</FieldLabel>
            <TextArea value={parent.last_contact_description} onChange={v => set('last_contact_description', v)} placeholder="Describe brevemente..." />
          </div>
          <div>
            <FieldLabel required>¿Por qué está ausente?</FieldLabel>
            <TextArea value={parent.reason_absent} onChange={v => set('reason_absent', v)} placeholder="Explica la razón de la ausencia..." rows={4} />
          </div>
          <div>
            <FieldLabel>¿Se ha intentado localizarlo/a?</FieldLabel>
            <TextArea value={parent.efforts_to_find} onChange={v => set('efforts_to_find', v)} placeholder="Describe si se han hecho intentos por encontrarlo/a..." />
          </div>
        </div>
      )}

      {parent.situation === 'deceased' && (
        <div className="space-y-3 p-4 bg-gray-50 rounded-xl">
          <p className="text-sm font-medium text-gray-700">Información sobre el fallecimiento</p>
          <div>
            <FieldLabel>Nombre del padre/madre</FieldLabel>
            <TextInput value={parent.parent_name} onChange={v => set('parent_name', v)} />
          </div>
          <div>
            <FieldLabel>¿Cuándo falleció?</FieldLabel>
            <TextInput value={parent.death_date} onChange={v => set('death_date', v)} placeholder="Ej: 2019, hace 3 años" />
          </div>
          <div>
            <FieldLabel>¿Dónde falleció?</FieldLabel>
            <TextInput value={parent.death_place} onChange={v => set('death_place', v)} placeholder="Ciudad o país" />
          </div>
          <div>
            <FieldLabel>¿Tiene certificado de defunción?</FieldLabel>
            <div className="flex gap-3">
              {['Sí', 'No'].map(opt => (
                <button
                  key={opt}
                  onClick={() => set('has_death_certificate', opt)}
                  className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                    parent.has_death_certificate === opt
                      ? 'border-[#F2A900] bg-[#F2A900]/10 text-[#F2A900]'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {(parent.situation === 'unknown' || parent.situation === 'never_known') && (
        <div className="space-y-3 p-4 bg-purple-50 rounded-xl">
          <p className="text-sm font-medium text-purple-800">
            {parent.situation === 'unknown' ? 'Lo que sabes' : 'Sobre esta situación'}
          </p>
          <div>
            <FieldLabel>¿Qué sabes sobre esta persona? (si algo)</FieldLabel>
            <TextArea
              value={parent.what_is_known}
              onChange={v => set('what_is_known', v)}
              placeholder={parent.situation === 'unknown'
                ? 'Describe lo que sepas, por poco que sea...'
                : 'Describe tu situación, por ejemplo: tu madre nunca te habló de tu padre...'}
              rows={4}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function WitnessStep({ witnesses, onChange }: { witnesses: WitnessesData; onChange: (w: WitnessesData) => void }) {
  function updateWitness(idx: number, field: keyof Witness, value: string) {
    const updated = [...witnesses.witnesses]
    updated[idx] = { ...updated[idx], [field]: value }
    onChange({ witnesses: updated })
  }

  function addWitness() {
    if (witnesses.witnesses.length >= 3) return
    onChange({ witnesses: [...witnesses.witnesses, { ...EMPTY_WITNESS }] })
  }

  function removeWitness(idx: number) {
    if (witnesses.witnesses.length <= 1) return
    onChange({ witnesses: witnesses.witnesses.filter((_, i) => i !== idx) })
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900">Testigos</h3>
      <p className="text-sm text-gray-500">
        Agrega personas que puedan confirmar tu historia (familiares, maestros, conocidos). Mínimo 1, máximo 3.
      </p>

      {witnesses.witnesses.map((w, i) => (
        <div key={i} className="p-4 rounded-xl border border-gray-200 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-gray-700">Testigo {i + 1}</span>
            {witnesses.witnesses.length > 1 && (
              <button onClick={() => removeWitness(i)} className="text-xs text-red-500 hover:text-red-700">
                Eliminar
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel required>Nombre completo</FieldLabel>
              <TextInput value={w.name} onChange={v => updateWitness(i, 'name', v)} placeholder="Nombre del testigo" />
            </div>
            <div>
              <FieldLabel required>Relación contigo</FieldLabel>
              <TextInput value={w.relationship} onChange={v => updateWitness(i, 'relationship', v)} placeholder="Ej: Tía, maestro, vecino" />
            </div>
          </div>
          <div>
            <FieldLabel>Teléfono de contacto</FieldLabel>
            <TextInput value={w.phone} onChange={v => updateWitness(i, 'phone', v)} placeholder="+1 (000) 000-0000" />
          </div>
          <div>
            <FieldLabel required>¿Qué puede declarar esta persona?</FieldLabel>
            <TextArea value={w.can_testify} onChange={v => updateWitness(i, 'can_testify', v)} placeholder="Ej: Ha visto cómo me crio mi madre sola, sabe que mi padre nos abandonó..." rows={3} />
          </div>
        </div>
      ))}

      {witnesses.witnesses.length < 3 && (
        <button
          onClick={addWitness}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-[#F2A900] hover:text-[#F2A900] transition-colors"
        >
          + Agregar otro testigo
        </button>
      )}
    </div>
  )
}

function ReviewStep({
  story, parent, witnesses, onEdit,
}: {
  story: StoryData; parent: ParentData; witnesses: WitnessesData; onEdit: (step: number) => void
}) {
  const situationLabel = PARENT_SITUATIONS.find(s => s.value === parent.situation)?.label || 'No especificado'
  const validWitnesses = witnesses.witnesses.filter(w => w.name.trim())

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900">Revisión Final</h3>
      <p className="text-sm text-gray-500">Revisa tu información antes de enviarla a tu consultor.</p>

      {/* Story summary */}
      <div className="p-4 rounded-xl border border-gray-200">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-semibold text-gray-700">Mi Historia</span>
          <button onClick={() => onEdit(0)} className="text-xs text-[#F2A900] hover:underline">Editar</button>
        </div>
        <div className="space-y-2 text-sm text-gray-600">
          <p><span className="font-medium">Año de llegada:</span> {story.arrival_year || '—'}</p>
          <p><span className="font-medium">Quién te trajo:</span> {story.who_brought || '—'}</p>
          <p><span className="font-medium">Vive con:</span> {story.current_guardian || '—'}</p>
          {story.separation_date && <p><span className="font-medium">Separación:</span> {story.separation_date}</p>}
          {story.how_was_abandonment && (
            <p><span className="font-medium">Abandono:</span> {story.how_was_abandonment.slice(0, 200)}{story.how_was_abandonment.length > 200 ? '...' : ''}</p>
          )}
          {story.has_complaints === 'Sí' && <p><span className="font-medium">Denuncias:</span> Sí{story.complaints_detail ? ` — ${story.complaints_detail.slice(0, 100)}` : ''}</p>}
          {story.why_no_reunification && (
            <p><span className="font-medium">No reunificación:</span> {story.why_no_reunification.slice(0, 150)}{story.why_no_reunification.length > 150 ? '...' : ''}</p>
          )}
        </div>
      </div>

      {/* Parent summary */}
      <div className="p-4 rounded-xl border border-gray-200">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-semibold text-gray-700">Padre/Madre Ausente</span>
          <button onClick={() => onEdit(1)} className="text-xs text-[#F2A900] hover:underline">Editar</button>
        </div>
        <div className="space-y-2 text-sm text-gray-600">
          <p><span className="font-medium">Relación:</span> {parent.parent_relationship === 'padre' ? 'Padre' : 'Madre'}</p>
          <p><span className="font-medium">Situación:</span> {situationLabel}</p>
          {parent.parent_name && <p><span className="font-medium">Nombre:</span> {parent.parent_name}</p>}
        </div>
      </div>

      {/* Witnesses summary */}
      <div className="p-4 rounded-xl border border-gray-200">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-semibold text-gray-700">Testigos ({validWitnesses.length})</span>
          <button onClick={() => onEdit(2)} className="text-xs text-[#F2A900] hover:underline">Editar</button>
        </div>
        <div className="space-y-2 text-sm text-gray-600">
          {validWitnesses.map((w, i) => (
            <p key={i}>{w.name} — {w.relationship}</p>
          ))}
        </div>
      </div>
    </div>
  )
}
