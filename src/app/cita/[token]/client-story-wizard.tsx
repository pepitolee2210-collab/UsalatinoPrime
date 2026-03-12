'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  ChevronLeft, ChevronRight, Loader2, CheckCircle, Send,
  BookOpen, UserPlus, Trash2, Users,
} from 'lucide-react'

// -- Types --

type ParentSituation = 'cooperates' | 'absent' | 'deceased' | 'unknown' | 'never_known' | ''

type GuardianRelation =
  | 'madre' | 'padre' | 'abuela' | 'abuelo'
  | 'tia' | 'tio' | 'hermana' | 'hermano'
  | 'madrastra' | 'padrastro' | 'tutor_legal' | 'otro'

interface MinorInfo {
  name: string
  guardian_relation: GuardianRelation | ''
  guardian_relation_other: string
}

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
  parent_phone: string
  parent_email: string
  willing_to_sign: string
  last_contact_date: string
  last_contact_description: string
  reason_absent: string
  efforts_to_find: string
  death_date: string
  death_place: string
  has_death_certificate: string
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

// All data for one minor
interface MinorDeclaration {
  info: MinorInfo
  story: StoryData
  parent: ParentData
  witnesses: WitnessesData
}

interface ClientStoryWizardProps {
  token: string
  clientName: string
}

// -- Constants --

const EMPTY_WITNESS: Witness = { name: '', relationship: '', phone: '', can_testify: '' }

const EMPTY_STORY: StoryData = {
  arrival_year: '', who_brought: '', current_guardian: '',
  separation_date: '', how_was_abandonment: '', father_economic_support: '',
  father_contact_with_child: '', who_took_care: '', has_complaints: '',
  complaints_detail: '', why_no_reunification: '', additional_details: '',
}

const EMPTY_PARENT: ParentData = {
  situation: '', parent_name: '', parent_relationship: 'padre',
  parent_phone: '', parent_email: '', willing_to_sign: '',
  last_contact_date: '', last_contact_description: '', reason_absent: '', efforts_to_find: '',
  death_date: '', death_place: '', has_death_certificate: '',
  what_is_known: '',
}

const EMPTY_MINOR_INFO: MinorInfo = { name: '', guardian_relation: '', guardian_relation_other: '' }

function createEmptyDeclaration(): MinorDeclaration {
  return {
    info: { ...EMPTY_MINOR_INFO },
    story: { ...EMPTY_STORY },
    parent: { ...EMPTY_PARENT },
    witnesses: { witnesses: [{ ...EMPTY_WITNESS }] },
  }
}

const PARENT_SITUATIONS: { value: ParentSituation; label: string; desc: string }[] = [
  { value: 'cooperates', label: 'Coopera', desc: 'Está dispuesto/a a firmar la renuncia voluntaria de custodia' },
  { value: 'absent', label: 'Ausente', desc: 'No tiene contacto, no sabemos dónde está' },
  { value: 'deceased', label: 'Falleció', desc: 'El padre/madre del menor ha fallecido' },
  { value: 'unknown', label: 'Desconocido', desc: 'No se sabe quién es el padre/madre' },
  { value: 'never_known', label: 'Nunca lo/la conoció', desc: 'El menor nunca tuvo relación con esa persona' },
]

const GUARDIAN_RELATIONS: { value: GuardianRelation; label: string }[] = [
  { value: 'madre', label: 'Madre' },
  { value: 'padre', label: 'Padre' },
  { value: 'abuela', label: 'Abuela' },
  { value: 'abuelo', label: 'Abuelo' },
  { value: 'tia', label: 'Tía' },
  { value: 'tio', label: 'Tío' },
  { value: 'hermana', label: 'Hermana mayor' },
  { value: 'hermano', label: 'Hermano mayor' },
  { value: 'madrastra', label: 'Madrastra' },
  { value: 'padrastro', label: 'Padrastro' },
  { value: 'tutor_legal', label: 'Tutor legal' },
  { value: 'otro', label: 'Otra relación' },
]

// -- Wizard Navigation --
// Steps: [Menores] → per minor: [Declaración, Padre/Madre, Testigos] → [Revisión]
// Step 0 = Minor selection
// Steps 1..N*3 = 3 steps per minor (story, parent, witnesses)
// Last step = Review

function getStepInfo(step: number, minorCount: number) {
  if (step === 0) return { type: 'minors' as const, minorIdx: -1, subStep: -1 }
  const totalMinorSteps = minorCount * 3
  if (step > totalMinorSteps) return { type: 'review' as const, minorIdx: -1, subStep: -1 }
  const adjustedStep = step - 1
  const minorIdx = Math.floor(adjustedStep / 3)
  const subStep = adjustedStep % 3 // 0=story, 1=parent, 2=witnesses
  return { type: 'minor_form' as const, minorIdx, subStep }
}

function getTotalSteps(minorCount: number) {
  return 1 + minorCount * 3 + 1 // minors + (3 per minor) + review
}

const SUB_STEP_LABELS = ['Declaración', 'Padre/Madre Ausente', 'Testigos']

// -- Main Component --

export function ClientStoryWizard({ token, clientName }: ClientStoryWizardProps) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [statuses, setStatuses] = useState<Record<string, string>>({})
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({})

  const [declarations, setDeclarations] = useState<MinorDeclaration[]>([createEmptyDeclaration()])

  const minorCount = declarations.length
  const totalSteps = getTotalSteps(minorCount)
  const stepInfo = getStepInfo(step, minorCount)

  // -- Data loading --
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/client-story?token=${token}`)
        if (!res.ok) return
        const data = await res.json()

        if (data.declarations && Array.isArray(data.declarations) && data.declarations.length > 0) {
          // New multi-minor format
          const loaded: MinorDeclaration[] = data.declarations.map((d: Record<string, unknown>) => ({
            info: { ...EMPTY_MINOR_INFO, ...(d.info as object || {}) },
            story: { ...EMPTY_STORY, ...(d.story as object || {}) },
            parent: { ...EMPTY_PARENT, ...(d.parent as object || {}) },
            witnesses: d.witnesses
              ? { witnesses: ((d.witnesses as { witnesses?: Witness[] }).witnesses || []).map((w: Witness) => ({ ...EMPTY_WITNESS, ...w })) }
              : { witnesses: [{ ...EMPTY_WITNESS }] },
          }))
          setDeclarations(loaded)
        } else if (data.client_story?.data) {
          // Legacy single-minor format — migrate
          const decl = createEmptyDeclaration()
          decl.story = { ...EMPTY_STORY, ...data.client_story.data }
          if (data.client_absent_parent?.data) decl.parent = { ...EMPTY_PARENT, ...data.client_absent_parent.data }
          if (data.client_witnesses?.data) {
            const wd = data.client_witnesses.data
            decl.witnesses = { witnesses: (wd.witnesses || []).map((w: Witness) => ({ ...EMPTY_WITNESS, ...w })) }
          }
          setDeclarations([decl])
        }

        // Load statuses/notes
        const s: Record<string, string> = {}
        const notes: Record<string, string> = {}
        for (const key of Object.keys(data)) {
          if (data[key]?.status) s[key] = data[key].status
          if (data[key]?.admin_notes) notes[key] = data[key].admin_notes
        }
        setStatuses(s)
        setAdminNotes(notes)

        // Check if all submitted
        const formKeys = ['client_story', 'client_absent_parent', 'client_witnesses']
        const allKeys = declarations.flatMap((_, i) =>
          formKeys.map(k => i === 0 ? k : `${k}_${i}`)
        )
        const allDone = allKeys.length > 0 && allKeys.every(k => s[k] === 'submitted' || s[k] === 'approved')
        if (allDone) setSubmitted(true)
      } catch {
        // First time, no data
      } finally {
        setLoadingData(false)
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // -- Save helpers --

  // Only save draft if the form has meaningful content (not just empty fields)
  function hasStoryContent(decl: MinorDeclaration): boolean {
    return !!(
      decl.info.name.trim() ||
      decl.story.how_was_abandonment.trim() ||
      decl.story.arrival_year.trim() ||
      decl.story.who_brought.trim() ||
      decl.story.separation_date.trim()
    )
  }

  function hasParentContent(parent: ParentData): boolean {
    return !!(parent.situation && (parent.parent_name.trim() || parent.reason_absent.trim()))
  }

  function hasWitnessContent(witnesses: WitnessesData): boolean {
    return witnesses.witnesses.some(w => w.name.trim())
  }

  const saveDraft = useCallback(async (formType: string, formData: unknown, minorIndex: number) => {
    setSaving(true)
    try {
      await fetch('/api/client-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, form_type: formType, form_data: formData, action: 'draft', minor_index: minorIndex }),
      })
    } catch {
      // Silent draft save
    } finally {
      setSaving(false)
    }
  }, [token])

  const saveCurrentStep = useCallback(async () => {
    if (stepInfo.type === 'minor_form') {
      const { minorIdx, subStep } = stepInfo
      const decl = declarations[minorIdx]
      if (!decl) return
      // Only save if user has entered meaningful data
      if (subStep === 0 && hasStoryContent(decl)) {
        await saveDraft('client_story', { ...decl.story, minor_info: decl.info }, minorIdx)
      }
      if (subStep === 1 && hasParentContent(decl.parent)) {
        await saveDraft('client_absent_parent', decl.parent, minorIdx)
      }
      if (subStep === 2 && hasWitnessContent(decl.witnesses)) {
        await saveDraft('client_witnesses', decl.witnesses, minorIdx)
      }
    } else if (stepInfo.type === 'minors') {
      // Save minor info only for minors with content
      for (let i = 0; i < declarations.length; i++) {
        if (hasStoryContent(declarations[i])) {
          await saveDraft('client_story', { ...declarations[i].story, minor_info: declarations[i].info }, i)
        }
      }
    }
  }, [stepInfo, declarations, saveDraft])

  // -- Navigation --
  function goNext() {
    saveCurrentStep()
    setStep(s => Math.min(s + 1, totalSteps - 1))
  }

  function goBack() {
    saveCurrentStep()
    setStep(s => Math.max(s - 1, 0))
  }

  // -- Minor management --
  function addMinor() {
    setDeclarations(prev => [...prev, createEmptyDeclaration()])
  }

  function removeMinor(idx: number) {
    if (declarations.length <= 1) return
    setDeclarations(prev => prev.filter((_, i) => i !== idx))
    // Reset step if current step would be out of bounds
    const newTotal = getTotalSteps(declarations.length - 1)
    if (step >= newTotal) setStep(0)
  }

  function updateMinorInfo(idx: number, info: MinorInfo) {
    setDeclarations(prev => prev.map((d, i) => i === idx ? { ...d, info } : d))
  }

  function updateStory(idx: number, story: StoryData) {
    setDeclarations(prev => prev.map((d, i) => i === idx ? { ...d, story } : d))
  }

  function updateParent(idx: number, parent: ParentData) {
    setDeclarations(prev => prev.map((d, i) => i === idx ? { ...d, parent } : d))
  }

  function updateWitnesses(idx: number, witnesses: WitnessesData) {
    setDeclarations(prev => prev.map((d, i) => i === idx ? { ...d, witnesses } : d))
  }

  // -- Validation --
  function validateAll(): boolean {
    for (let i = 0; i < declarations.length; i++) {
      const d = declarations[i]
      const label = declarations.length > 1 ? ` (${d.info.name || `Menor ${i + 1}`})` : ''

      if (!d.info.name.trim()) {
        toast.error(`Ingresa el nombre del menor${label}`)
        setStep(0)
        return false
      }
      if (!d.info.guardian_relation) {
        toast.error(`Selecciona tu relación con ${d.info.name}`)
        setStep(0)
        return false
      }
      if (!d.story.how_was_abandonment) {
        toast.error(`Completa la historia de abandono${label}`)
        setStep(1 + i * 3)
        return false
      }
      if (!d.parent.situation) {
        toast.error(`Selecciona la situación del padre/madre${label}`)
        setStep(2 + i * 3)
        return false
      }
      if (d.parent.situation === 'absent' && !d.parent.reason_absent) {
        toast.error(`Describe la razón de la ausencia${label}`)
        setStep(2 + i * 3)
        return false
      }
      const validWitnesses = d.witnesses.witnesses.filter(w => w.name.trim())
      if (validWitnesses.length === 0) {
        toast.error(`Agrega al menos un testigo${label}`)
        setStep(3 + i * 3)
        return false
      }
      for (const w of validWitnesses) {
        if (!w.relationship || !w.can_testify) {
          toast.error(`Completa los datos de cada testigo${label}`)
          setStep(3 + i * 3)
          return false
        }
      }
    }
    return true
  }

  async function handleSubmit() {
    if (!validateAll()) return

    setSubmitting(true)
    try {
      for (let i = 0; i < declarations.length; i++) {
        const d = declarations[i]
        const submissions = [
          { form_type: 'client_story', form_data: { ...d.story, minor_info: d.info } },
          { form_type: 'client_absent_parent', form_data: d.parent },
          { form_type: 'client_witnesses', form_data: d.witnesses },
        ]
        for (const sub of submissions) {
          const res = await fetch('/api/client-story', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, ...sub, action: 'submit', minor_index: i }),
          })
          if (!res.ok) throw new Error('Error al enviar')
        }
      }
      setSubmitted(true)
      toast.success('¡Toda la información ha sido enviada exitosamente!')
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
      {/* Step progress bar */}
      <StepProgressBar step={step} totalSteps={totalSteps} stepInfo={stepInfo} declarations={declarations} />

      {/* Corrections banner */}
      {Object.values(statuses).some(s => s === 'needs_correction') && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm font-semibold text-red-700 mb-1">Tu consultor ha solicitado correcciones:</p>
          {Object.entries(adminNotes).map(([key, note]) => note && statuses[key] === 'needs_correction' && (
            <p key={key} className="text-sm text-red-600 mt-1">
              <span className="font-medium">
                {key.startsWith('client_story') ? 'Historia' : key.startsWith('client_absent_parent') ? 'Padre/Madre' : 'Testigos'}:
              </span>{' '}{note}
            </p>
          ))}
        </div>
      )}

      {/* Step content */}
      {stepInfo.type === 'minors' && (
        <MinorsStep
          declarations={declarations}
          onUpdateInfo={updateMinorInfo}
          onAdd={addMinor}
          onRemove={removeMinor}
        />
      )}

      {stepInfo.type === 'minor_form' && stepInfo.subStep === 0 && (
        <StoryStep
          story={declarations[stepInfo.minorIdx].story}
          minorInfo={declarations[stepInfo.minorIdx].info}
          onChange={s => updateStory(stepInfo.minorIdx, s)}
          minorCount={minorCount}
        />
      )}

      {stepInfo.type === 'minor_form' && stepInfo.subStep === 1 && (
        <ParentStep
          parent={declarations[stepInfo.minorIdx].parent}
          minorName={declarations[stepInfo.minorIdx].info.name}
          onChange={p => updateParent(stepInfo.minorIdx, p)}
        />
      )}

      {stepInfo.type === 'minor_form' && stepInfo.subStep === 2 && (
        <WitnessStep
          witnesses={declarations[stepInfo.minorIdx].witnesses}
          minorName={declarations[stepInfo.minorIdx].info.name}
          onChange={w => updateWitnesses(stepInfo.minorIdx, w)}
        />
      )}

      {stepInfo.type === 'review' && (
        <ReviewStep declarations={declarations} onEdit={setStep} />
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={goBack} disabled={step === 0 || submitting}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
        </Button>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-gray-400">Guardando...</span>}
          {stepInfo.type !== 'review' ? (
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

// -- Progress Bar Component --

function StepProgressBar({
  step, totalSteps, stepInfo, declarations,
}: {
  step: number; totalSteps: number; stepInfo: ReturnType<typeof getStepInfo>; declarations: MinorDeclaration[]
}) {
  const progress = ((step) / (totalSteps - 1)) * 100

  let currentLabel = 'Menores'
  if (stepInfo.type === 'minor_form') {
    const minorName = declarations[stepInfo.minorIdx]?.info.name || `Menor ${stepInfo.minorIdx + 1}`
    currentLabel = `${minorName} — ${SUB_STEP_LABELS[stepInfo.subStep]}`
  } else if (stepInfo.type === 'review') {
    currentLabel = 'Revisión Final'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-700">{currentLabel}</span>
        <span className="text-xs text-gray-400">Paso {step + 1} de {totalSteps}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div
          className="bg-gradient-to-r from-[#F2A900] to-[#D4940A] h-2 rounded-full transition-all duration-300"
          style={{ width: `${Math.max(progress, 3)}%` }}
        />
      </div>
    </div>
  )
}

// -- Shared UI Components --

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

// -- Step 0: Minors Selection --

function MinorsStep({
  declarations, onUpdateInfo, onAdd, onRemove,
}: {
  declarations: MinorDeclaration[]
  onUpdateInfo: (idx: number, info: MinorInfo) => void
  onAdd: () => void
  onRemove: (idx: number) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Users className="w-5 h-5 text-[#F2A900]" />
        <h3 className="font-semibold text-gray-900">Menores para la Declaración</h3>
      </div>

      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <strong>Importante:</strong> Agregue cada menor para el cual se hará la declaración.
        Si tiene varios hijos de diferente padre, cada uno se declara por separado.
        Si usted no es la madre/padre biológico, seleccione su relación real con el menor.
      </div>

      {declarations.map((decl, i) => (
        <div key={i} className="p-4 rounded-xl border border-gray-200 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-gray-700">Menor {i + 1}</span>
            {declarations.length > 1 && (
              <button onClick={() => onRemove(i)} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                <Trash2 className="w-3 h-3" /> Eliminar
              </button>
            )}
          </div>

          <div>
            <FieldLabel required>Nombre completo del menor</FieldLabel>
            <TextInput
              value={decl.info.name}
              onChange={v => onUpdateInfo(i, { ...decl.info, name: v })}
              placeholder="Nombre y apellidos del niño/a"
            />
          </div>

          <div>
            <FieldLabel required>¿Cuál es tu relación con este menor?</FieldLabel>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {GUARDIAN_RELATIONS.map(r => (
                <button
                  key={r.value}
                  onClick={() => onUpdateInfo(i, { ...decl.info, guardian_relation: r.value, guardian_relation_other: r.value === 'otro' ? decl.info.guardian_relation_other : '' })}
                  className={`py-2 px-2 rounded-lg border text-xs font-medium transition-colors ${
                    decl.info.guardian_relation === r.value
                      ? 'border-[#F2A900] bg-[#F2A900]/10 text-[#F2A900]'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {decl.info.guardian_relation === 'otro' && (
              <div className="mt-2">
                <TextInput
                  value={decl.info.guardian_relation_other}
                  onChange={v => onUpdateInfo(i, { ...decl.info, guardian_relation_other: v })}
                  placeholder="Especifique la relación (ej: prima, vecina con custodia...)"
                />
              </div>
            )}
          </div>
        </div>
      ))}

      <button
        onClick={onAdd}
        className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-[#F2A900] hover:text-[#F2A900] transition-colors flex items-center justify-center gap-2"
      >
        <UserPlus className="w-4 h-4" /> Agregar otro menor
      </button>
    </div>
  )
}

// -- Story Step --

function StoryStep({
  story, minorInfo, onChange, minorCount,
}: {
  story: StoryData; minorInfo: MinorInfo; onChange: (s: StoryData) => void; minorCount: number
}) {
  const set = (field: keyof StoryData, value: string) => onChange({ ...story, [field]: value })
  const guardianLabel = GUARDIAN_RELATIONS.find(r => r.value === minorInfo.guardian_relation)?.label || 'tutor/a'
  const minorName = minorInfo.name || 'el menor'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <BookOpen className="w-5 h-5 text-[#F2A900]" />
        <h3 className="font-semibold text-gray-900">
          Tu Declaración {minorCount > 1 && <span className="text-[#F2A900]">— {minorName}</span>}
        </h3>
      </div>
      <p className="text-sm text-gray-500">
        Esta información es para <strong>tu declaración jurada</strong> como {guardianLabel.toLowerCase()} de <strong>{minorName}</strong>.
        Escribe desde tu perspectiva. Toda la información es confidencial.
      </p>
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
        Incluye todos los detalles que puedas: violencia, penurias, momentos difíciles, todo suma. Nuestro sistema tomará los puntos más relevantes para tu caso.
      </div>

      <div>
        <FieldLabel required>¿En qué año llegaron a los Estados Unidos?</FieldLabel>
        <TextInput value={story.arrival_year} onChange={v => set('arrival_year', v)} placeholder="Ej: 2020" />
      </div>
      <div>
        <FieldLabel required>¿Quién trajo a {minorName} a los Estados Unidos?</FieldLabel>
        <TextInput value={story.who_brought} onChange={v => set('who_brought', v)} placeholder={`Ej: Yo (su ${guardianLabel.toLowerCase()}), un familiar, un conocido, etc.`} />
      </div>
      <div>
        <FieldLabel required>¿Con quién vive {minorName} actualmente en EE.UU.? (nombre completo y relación)</FieldLabel>
        <TextInput value={story.current_guardian} onChange={v => set('current_guardian', v)} placeholder={`Ej: Conmigo (su ${guardianLabel.toLowerCase()}) / Con su abuela Juana Pérez`} />
      </div>
      <div>
        <FieldLabel>¿Cuándo se separaron usted y la pareja? (fecha aproximada)</FieldLabel>
        <TextInput value={story.separation_date} onChange={v => set('separation_date', v)} placeholder="Ej: En 2015 / Nunca vivimos juntos / Cuando estaba embarazada" />
      </div>
      <div>
        <FieldLabel required>¿Cómo fue el abandono? Describe con el mayor detalle posible.</FieldLabel>
        <TextArea value={story.how_was_abandonment} onChange={v => set('how_was_abandonment', v)} placeholder={`Cuenta desde el inicio: ¿Vivían juntos? ¿Qué pasó? ¿Se fue con otra persona, fue violento, nunca quiso hacerse cargo de ${minorName}? Incluye nombres, fechas y lugares.`} rows={6} />
      </div>
      <div>
        <FieldLabel>¿La pareja que los abandonó dio apoyo económico alguna vez?</FieldLabel>
        <TextArea value={story.father_economic_support} onChange={v => set('father_economic_support', v)} placeholder="Ej: Nunca dio dinero / Al principio daba algo y luego dejó de dar / Tuve que poner demanda de alimentos..." rows={3} />
      </div>
      <div>
        <FieldLabel>¿La pareja ausente tuvo contacto con {minorName} después de la separación?</FieldLabel>
        <TextArea value={story.father_contact_with_child} onChange={v => set('father_contact_with_child', v)} placeholder="Ej: Nunca llamó / Una vez prometió ir al cumpleaños y nunca llegó / No sabemos nada desde 2016..." rows={3} />
      </div>
      <div>
        <FieldLabel>¿Quién se hizo cargo de {minorName} cuando los abandonaron? (nombre completo y relación)</FieldLabel>
        <TextArea value={story.who_took_care} onChange={v => set('who_took_care', v)} placeholder="Ej: Yo sola me hice cargo / Tuve que ir a casa de mis padres: Juan Pérez (mi papá) y Rosa López (mi mamá) me ayudaron..." rows={3} />
      </div>
      <div>
        <FieldLabel>¿Tiene denuncias o documentos que prueben el abandono?</FieldLabel>
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
          <TextArea value={story.complaints_detail} onChange={v => set('complaints_detail', v)} placeholder="Describe qué documentos tiene: demanda de alimentos, denuncia por maltrato, orden de alejamiento, etc." rows={3} />
        )}
        {story.has_complaints === 'No' && (
          <p className="text-xs text-gray-500 mt-1">Si nunca denunció, puede escribir por qué: por temor, por falta de recursos, porque en su país no procede, etc.</p>
        )}
      </div>
      <div>
        <FieldLabel>¿Por qué {minorName} no puede volver a vivir con el padre/madre que lo abandonó?</FieldLabel>
        <TextArea value={story.why_no_reunification} onChange={v => set('why_no_reunification', v)} placeholder="Ej: Ya tiene otra familia, está preso, tiene denuncias por violencia, no sabemos dónde vive, nunca se hizo responsable..." rows={4} />
      </div>
      <div>
        <FieldLabel>¿Hay algo más que quiera agregar?</FieldLabel>
        <TextArea value={story.additional_details} onChange={v => set('additional_details', v)} placeholder="Escriba todo lo que considere importante: agresiones, momentos difíciles, si su hijo/a le ha preguntado por el padre, las penurias que pasó... todo suma." rows={4} />
      </div>
    </div>
  )
}

// -- Parent Step --

function ParentStep({
  parent, minorName, onChange,
}: {
  parent: ParentData; minorName: string; onChange: (p: ParentData) => void
}) {
  const set = (field: keyof ParentData, value: string) => onChange({ ...parent, [field]: value })
  const name = minorName || 'el menor'

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900">Padre/Madre Ausente de {name}</h3>
      <p className="text-sm text-gray-500">
        Seleccione la situación que mejor describe la relación de {name} con el padre o madre ausente.
      </p>

      <div>
        <FieldLabel required>¿Quién es la persona ausente?</FieldLabel>
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
        <FieldLabel required>¿Cuál es la situación actual de esa persona?</FieldLabel>
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

      {parent.situation === 'cooperates' && (
        <div className="space-y-3 p-4 bg-blue-50 rounded-xl">
          <p className="text-sm font-medium text-blue-800">Información de contacto de la pareja que coopera</p>
          <div>
            <FieldLabel required>Nombre completo del padre/madre de {name}</FieldLabel>
            <TextInput value={parent.parent_name} onChange={v => set('parent_name', v)} placeholder="Nombre completo" />
          </div>
          <div>
            <FieldLabel>Teléfono de contacto</FieldLabel>
            <TextInput value={parent.parent_phone} onChange={v => set('parent_phone', v)} placeholder="+1 (000) 000-0000" />
          </div>
          <div>
            <FieldLabel>Email</FieldLabel>
            <TextInput value={parent.parent_email} onChange={v => set('parent_email', v)} placeholder="email@ejemplo.com" />
          </div>
          <div>
            <FieldLabel>¿Está dispuesto/a a firmar la renuncia voluntaria de custodia?</FieldLabel>
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
            <FieldLabel>Nombre completo del padre/madre ausente (si lo sabe)</FieldLabel>
            <TextInput value={parent.parent_name} onChange={v => set('parent_name', v)} placeholder="Nombre completo" />
          </div>
          <div>
            <FieldLabel>¿Cuándo fue la última vez que tuvo contacto con {name} o con usted?</FieldLabel>
            <TextInput value={parent.last_contact_date} onChange={v => set('last_contact_date', v)} placeholder="Ej: Hace 5 años, en 2018, nunca tuvo contacto" />
          </div>
          <div>
            <FieldLabel>¿Cómo fue ese último contacto?</FieldLabel>
            <TextArea value={parent.last_contact_description} onChange={v => set('last_contact_description', v)} placeholder="Ej: Me llamó para pedir algo pero no preguntó por los niños / Fue cortante / Lo busqué para el cumpleaños y no contestó..." />
          </div>
          <div>
            <FieldLabel required>¿Por qué está ausente? Explique la razón.</FieldLabel>
            <TextArea value={parent.reason_absent} onChange={v => set('reason_absent', v)} placeholder="Ej: Nos abandonó, no quiso saber de nosotros, tiene otra relación, nunca supimos de él/ella, se fue del país..." rows={4} />
          </div>
          <div>
            <FieldLabel>¿Ha intentado localizarlo/a en algún momento?</FieldLabel>
            <TextArea value={parent.efforts_to_find} onChange={v => set('efforts_to_find', v)} placeholder="Ej: Sí, para pedirle dinero cuando la niña estaba enferma / Sí, para el cumpleaños / No, perdí todo contacto..." />
          </div>
        </div>
      )}

      {parent.situation === 'deceased' && (
        <div className="space-y-3 p-4 bg-gray-50 rounded-xl">
          <p className="text-sm font-medium text-gray-700">Información sobre el fallecimiento</p>
          <div>
            <FieldLabel>Nombre completo del padre/madre fallecido/a</FieldLabel>
            <TextInput value={parent.parent_name} onChange={v => set('parent_name', v)} placeholder="Nombre completo" />
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

// -- Witness Step --

function WitnessStep({
  witnesses, minorName, onChange,
}: {
  witnesses: WitnessesData; minorName: string; onChange: (w: WitnessesData) => void
}) {
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

  const name = minorName || 'el menor'

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900">Testigos para {name}</h3>
      <p className="text-sm text-gray-500">
        Personas que puedan dar fe del abandono y de su situación con {name}: familiares, amigos, vecinos. Recomendamos 2 de su país de origen y 1 de EE.UU. Mínimo 1, máximo 3.
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
              <TextInput value={w.name} onChange={v => updateWitness(i, 'name', v)} placeholder="Nombre completo del testigo" />
            </div>
            <div>
              <FieldLabel required>Relación con usted o {name}</FieldLabel>
              <TextInput value={w.relationship} onChange={v => updateWitness(i, 'relationship', v)} placeholder="Ej: Mi mamá, mi hermana, amiga, vecina en EE.UU." />
            </div>
          </div>
          <div>
            <FieldLabel>Teléfono de contacto</FieldLabel>
            <TextInput value={w.phone} onChange={v => updateWitness(i, 'phone', v)} placeholder="+1 (000) 000-0000" />
          </div>
          <div>
            <FieldLabel required>¿Qué puede declarar esta persona? ¿Qué etapa presenció?</FieldLabel>
            <TextArea value={w.can_testify} onChange={v => updateWitness(i, 'can_testify', v)} placeholder={`Ej: 'Entre 2018-2022 vivió cerca de nosotros, vio que el padre de ${name} nunca estuvo, me ayudó a cuidar al niño/a...'`} rows={3} />
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

// -- Review Step --

function ReviewStep({
  declarations, onEdit,
}: {
  declarations: MinorDeclaration[]; onEdit: (step: number) => void
}) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900">Revisión Final</h3>
      <p className="text-sm text-gray-500">Revise la información de {declarations.length === 1 ? 'su menor' : `sus ${declarations.length} menores`} antes de enviarla.</p>

      {declarations.map((decl, i) => {
        const baseStep = 1 + i * 3
        const situationLabel = PARENT_SITUATIONS.find(s => s.value === decl.parent.situation)?.label || 'No especificado'
        const guardianLabel = GUARDIAN_RELATIONS.find(r => r.value === decl.info.guardian_relation)?.label || '—'
        const validWitnesses = decl.witnesses.witnesses.filter(w => w.name.trim())

        return (
          <div key={i} className="space-y-3">
            {declarations.length > 1 && (
              <h4 className="text-sm font-bold text-[#F2A900] border-b pb-1">
                {decl.info.name || `Menor ${i + 1}`}
              </h4>
            )}

            {/* Story summary */}
            <div className="p-4 rounded-xl border border-gray-200">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-semibold text-gray-700">Declaración</span>
                <button onClick={() => onEdit(baseStep)} className="text-xs text-[#F2A900] hover:underline">Editar</button>
              </div>
              <div className="space-y-1 text-sm text-gray-600">
                <p><span className="font-medium">Menor:</span> {decl.info.name || '—'}</p>
                <p><span className="font-medium">Relación:</span> {guardianLabel}{decl.info.guardian_relation === 'otro' ? ` (${decl.info.guardian_relation_other})` : ''}</p>
                <p><span className="font-medium">Año llegada:</span> {decl.story.arrival_year || '—'}</p>
                <p><span className="font-medium">Vive con:</span> {decl.story.current_guardian || '—'}</p>
                {decl.story.how_was_abandonment && (
                  <p><span className="font-medium">Abandono:</span> {decl.story.how_was_abandonment.slice(0, 200)}{decl.story.how_was_abandonment.length > 200 ? '...' : ''}</p>
                )}
              </div>
            </div>

            {/* Parent summary */}
            <div className="p-4 rounded-xl border border-gray-200">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-semibold text-gray-700">Padre/Madre Ausente</span>
                <button onClick={() => onEdit(baseStep + 1)} className="text-xs text-[#F2A900] hover:underline">Editar</button>
              </div>
              <div className="space-y-1 text-sm text-gray-600">
                <p><span className="font-medium">Relación:</span> {decl.parent.parent_relationship === 'padre' ? 'Padre' : 'Madre'}</p>
                <p><span className="font-medium">Situación:</span> {situationLabel}</p>
                {decl.parent.parent_name && <p><span className="font-medium">Nombre:</span> {decl.parent.parent_name}</p>}
              </div>
            </div>

            {/* Witnesses summary */}
            <div className="p-4 rounded-xl border border-gray-200">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-semibold text-gray-700">Testigos ({validWitnesses.length})</span>
                <button onClick={() => onEdit(baseStep + 2)} className="text-xs text-[#F2A900] hover:underline">Editar</button>
              </div>
              <div className="space-y-1 text-sm text-gray-600">
                {validWitnesses.map((w, wi) => (
                  <p key={wi}>{w.name} — {w.relationship}</p>
                ))}
                {validWitnesses.length === 0 && <p className="text-red-500">Sin testigos</p>}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
