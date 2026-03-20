'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { TutorFormSections } from './tutor-form-sections'
import { MinorBasicSection, MinorAbuseSection, MinorBestInterestSection } from './minor-form-sections'
import {
  ChevronLeft, ChevronRight, CheckCircle, Send, Loader2,
  BookOpen, Lock, ArrowRight, Upload, X, FileText,
  UserPlus, Trash2, AlertCircle, Users,
} from 'lucide-react'

// ══ TYPES ══════════════════════════════════════════════════════════

type ParentSituation = 'cooperates' | 'absent' | 'deceased' | 'unknown' | 'never_known' | ''
type GuardianRelation =
  | 'madre' | 'padre' | 'abuela' | 'abuelo' | 'tia' | 'tio'
  | 'hermana' | 'hermano' | 'madrastra' | 'padrastro' | 'tutor_legal' | 'otro'

interface ChildInfo {
  name: string
  guardian_relation: GuardianRelation | ''
  guardian_relation_other: string
}

// Minor declaration data — 30 questions organized in sections
interface MinorBasicData {
  full_name: string; dob: string; country: string; nationality: string
  civil_status: string; in_us: string; address: string
  lives_with: string; lives_with_relationship: string
  how_arrived: string; arrival_date: string; accompanied_by: string
  detained_by_immigration: string; released_by_orr: string; orr_sponsor: string
}

interface MinorAbuseData {
  life_in_country: string
  abuse_by_father: string; abuse_by_mother: string
  physical_abuse: string; emotional_abuse: string
  negligence: string; abandonment: string; abandonment_details: string
  parent_substance_abuse: string
}

interface MinorBestInterestData {
  reported_to_authorities: string; report_details: string
  physical_scars: string; therapy_received: string; therapy_details: string
  fear_of_return: string; fear_details: string
  gang_threats: string; gang_details: string
  caretaker_in_country: string
  current_life_us: string; attends_school: string
  safe_home: string
  legal_problems: string
  wants_to_stay: string; why_stay: string
}

// Keep legacy types for backward compatibility
interface StoryData {
  arrival_year: string; who_brought: string; current_guardian: string
  separation_date: string; how_was_abandonment: string; father_economic_support: string
  father_contact_with_child: string; who_took_care: string; has_complaints: string
  complaints_detail: string; why_no_reunification: string; additional_details: string
}

interface ParentData {
  situation: ParentSituation; parent_name: string; parent_relationship: string
  parent_phone: string; parent_email: string; willing_to_sign: string
  last_contact_date: string; last_contact_description: string
  reason_absent: string; efforts_to_find: string
  death_date: string; death_place: string; has_death_certificate: string; what_is_known: string
}

interface TutorWitness { name: string; relationship: string; phone: string; address: string; can_testify: string }

interface TutorData {
  // Sección 1: Información Básica (Q1-5)
  full_name: string
  relationship_to_minor: string
  full_address: string
  time_in_state: string
  immigration_status: string
  // Sección 2: Sobre el Menor (Q6-12)
  minor_full_name: string
  minor_dob: string
  minor_country: string
  minor_civil_status: string
  minor_location: string
  minor_lives_with: string
  minor_lives_with_since: string
  // Sección 3: Hechos de Maltrato (Q13-19)
  why_cannot_reunify: string
  abuse_description: string
  who_perpetrated: string
  when_occurred: string
  where_occurred: string
  evidence_exists: string
  evidence_description: string
  minor_treatment: string
  treatment_description: string
  // Sección 4: Mejor Interés (Q20-23)
  risk_if_returned: string
  caretaker_in_country: string
  access_to_services: string
  gang_threats: string
  // Sección 5: Proceso Legal (Q24-30)
  parent_consent: string
  minor_in_removal: string
  minor_released_orr: string
  orr_details: string
  guardian_criminal_record: string
  guardian_can_provide: string
  household_members: string
  understands_sijs: string
  // Testigos
  witnesses: TutorWitness[]
}

interface Witness { name: string; relationship: string; phone: string; can_testify: string }

interface DJDoc { id: string; name: string; file_size: number }

interface DJState {
  status: 'empty' | 'draft' | 'submitted' | 'approved' | 'needs_correction'
  children: ChildInfo[]
  // New structured minor data
  minorBasic: MinorBasicData
  minorAbuse: MinorAbuseData
  minorBestInterest: MinorBestInterestData
  // Legacy (kept for backward compat loading)
  story: StoryData
  parent: ParentData
  witnesses: Witness[]
  hasAnotherFather: boolean | null
  adminNotes?: string
  docs: DJDoc[]
}

interface ClientStoryWizardProps {
  token: string
  clientName: string
  declarationDocs?: { id: string; name: string; file_size: number; declaration_number: number }[]
}

// ══ CONSTANTS ══════════════════════════════════════════════════════

const EMPTY_STORY: StoryData = {
  arrival_year: '', who_brought: '', current_guardian: '', separation_date: '',
  how_was_abandonment: '', father_economic_support: '', father_contact_with_child: '',
  who_took_care: '', has_complaints: '', complaints_detail: '',
  why_no_reunification: '', additional_details: '',
}

const EMPTY_PARENT: ParentData = {
  situation: '', parent_name: '', parent_relationship: 'padre',
  parent_phone: '', parent_email: '', willing_to_sign: '',
  last_contact_date: '', last_contact_description: '',
  reason_absent: '', efforts_to_find: '',
  death_date: '', death_place: '', has_death_certificate: '', what_is_known: '',
}

const EMPTY_TUTOR: TutorData = {
  full_name: '', relationship_to_minor: '', full_address: '',
  time_in_state: '', immigration_status: '',
  minor_full_name: '', minor_dob: '', minor_country: '',
  minor_civil_status: '', minor_location: '', minor_lives_with: '', minor_lives_with_since: '',
  why_cannot_reunify: '', abuse_description: '', who_perpetrated: '',
  when_occurred: '', where_occurred: '', evidence_exists: '', evidence_description: '',
  minor_treatment: '', treatment_description: '',
  risk_if_returned: '', caretaker_in_country: '', access_to_services: '', gang_threats: '',
  parent_consent: '', minor_in_removal: '', minor_released_orr: '', orr_details: '',
  guardian_criminal_record: '', guardian_can_provide: '', household_members: '', understands_sijs: '',
  witnesses: [{ name: '', relationship: '', phone: '', address: '', can_testify: '' }],
}

const EMPTY_MINOR_BASIC: MinorBasicData = {
  full_name: '', dob: '', country: '', nationality: '', civil_status: 'soltero',
  in_us: 'si', address: '', lives_with: '', lives_with_relationship: '',
  how_arrived: '', arrival_date: '', accompanied_by: '',
  detained_by_immigration: '', released_by_orr: '', orr_sponsor: '',
}

const EMPTY_MINOR_ABUSE: MinorAbuseData = {
  life_in_country: '', abuse_by_father: '', abuse_by_mother: '',
  physical_abuse: '', emotional_abuse: '', negligence: '',
  abandonment: '', abandonment_details: '', parent_substance_abuse: '',
}

const EMPTY_MINOR_BEST_INTEREST: MinorBestInterestData = {
  reported_to_authorities: '', report_details: '',
  physical_scars: '', therapy_received: '', therapy_details: '',
  fear_of_return: '', fear_details: '', gang_threats: '', gang_details: '',
  caretaker_in_country: '', current_life_us: '', attends_school: '',
  safe_home: '', legal_problems: '', wants_to_stay: '', why_stay: '',
}

const EMPTY_CHILD: ChildInfo = { name: '', guardian_relation: '', guardian_relation_other: '' }

const PARENT_SITUATIONS: { value: ParentSituation; label: string; desc: string }[] = [
  { value: 'cooperates', label: 'Coopera', desc: 'Está dispuesto/a a firmar la renuncia voluntaria de custodia' },
  { value: 'absent', label: 'Ausente', desc: 'No tiene contacto, no sabemos dónde está' },
  { value: 'deceased', label: 'Falleció', desc: 'El padre/madre del menor ha fallecido' },
  { value: 'unknown', label: 'Desconocido', desc: 'No se sabe quién es el padre/madre' },
  { value: 'never_known', label: 'Nunca lo/la conoció', desc: 'El menor nunca tuvo relación con esa persona' },
]

const GUARDIAN_RELATIONS: { value: GuardianRelation; label: string }[] = [
  { value: 'madre', label: 'Madre' }, { value: 'padre', label: 'Padre' },
  { value: 'abuela', label: 'Abuela' }, { value: 'abuelo', label: 'Abuelo' },
  { value: 'tia', label: 'Tía' }, { value: 'tio', label: 'Tío' },
  { value: 'hermana', label: 'Hermana' }, { value: 'hermano', label: 'Hermano' },
  { value: 'madrastra', label: 'Madrastra' }, { value: 'padrastro', label: 'Padrastro' },
  { value: 'tutor_legal', label: 'Tutor legal' }, { value: 'otro', label: 'Otro' },
]

const DJ_STEP_LABELS = ['Información Básica', 'Hechos de Maltrato', 'Mejor Interés', 'Testigos', 'Confirmar y Enviar']
const DJ_TOTAL_STEPS = 5

function createEmptyDJ(docs: DJDoc[] = []): DJState {
  return {
    status: 'empty',
    children: [{ ...EMPTY_CHILD }],
    minorBasic: { ...EMPTY_MINOR_BASIC },
    minorAbuse: { ...EMPTY_MINOR_ABUSE },
    minorBestInterest: { ...EMPTY_MINOR_BEST_INTEREST },
    story: { ...EMPTY_STORY },
    parent: { ...EMPTY_PARENT },
    witnesses: [{ name: '', relationship: '', phone: '', can_testify: '' }],
    hasAnotherFather: null,
    docs,
  }
}

// ══ MAIN COMPONENT ═════════════════════════════════════════════════

export function ClientStoryWizard({ token, declarationDocs = [] }: ClientStoryWizardProps) {
  const [activeDJ, setActiveDJ] = useState<1 | 2 | 3 | 4 | null>(null)
  const [showTutorForm, setShowTutorForm] = useState(false)
  const [loading, setLoading] = useState(true)

  // Tutor is a separate state — filled once, shared across all DJs
  const [tutorData, setTutorData] = useState<TutorData>({ ...EMPTY_TUTOR })
  const [tutorSaved, setTutorSaved] = useState(false)

  const initialStates = (): Record<number, DJState> => ({
    1: createEmptyDJ(declarationDocs.filter(d => d.declaration_number === 1)),
    2: createEmptyDJ(declarationDocs.filter(d => d.declaration_number === 2)),
    3: createEmptyDJ(declarationDocs.filter(d => d.declaration_number === 3)),
    4: createEmptyDJ(declarationDocs.filter(d => d.declaration_number === 4)),
  })

  const [djStates, setDjStates] = useState<Record<number, DJState>>(initialStates)

  // Load saved data on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/client-story?token=${token}`)
        if (!res.ok) { setLoading(false); return }
        const data = await res.json()

        // Load tutor data (stored in tutor_guardian submission)
        if (data.tutor_guardian?.data) {
          setTutorData({ ...EMPTY_TUTOR, ...data.tutor_guardian.data })
          setTutorSaved(true)
        }

        if (data.declarations && Array.isArray(data.declarations)) {
          // New multi-minor format
          setDjStates(prev => {
            const next = { ...prev }
            data.declarations.forEach((decl: Record<string, unknown>, idx: number) => {
              const djNum = idx + 1
              if (djNum > 4) return
              const storyRaw = (decl.story || {}) as Record<string, unknown>
              const { children, has_another_father, tutor: _t, minorBasic, minorAbuse, minorBestInterest, ...restStory } = storyRaw

              // Load tutor from DJ1 story if not loaded yet (backward compat)
              if (!data.tutor_guardian?.data && _t && idx === 0) {
                setTutorData(prev => ({ ...prev, ...(_t as Partial<TutorData>) }))
                setTutorSaved(true)
              }

              let loadedChildren: ChildInfo[] = []
              if (Array.isArray(children) && children.length > 0) {
                loadedChildren = children as ChildInfo[]
              } else if (decl.info && (decl.info as ChildInfo).name) {
                loadedChildren = [decl.info as ChildInfo]
              }

              const statusKey = idx === 0 ? 'client_story' : `client_story_${idx}`
              next[djNum] = {
                ...prev[djNum],
                status: (data[statusKey]?.status as DJState['status']) || 'draft',
                children: loadedChildren.length > 0 ? loadedChildren : [{ ...EMPTY_CHILD }],
                minorBasic: { ...EMPTY_MINOR_BASIC, ...(minorBasic as Partial<MinorBasicData> || {}) },
                minorAbuse: { ...EMPTY_MINOR_ABUSE, ...(minorAbuse as Partial<MinorAbuseData> || {}) },
                minorBestInterest: { ...EMPTY_MINOR_BEST_INTEREST, ...(minorBestInterest as Partial<MinorBestInterestData> || {}) },
                story: { ...EMPTY_STORY, ...(restStory as Partial<StoryData>) },
                parent: { ...EMPTY_PARENT, ...(decl.parent as Partial<ParentData> || {}) },
                witnesses: ((decl.witnesses as { witnesses?: Witness[] })?.witnesses || []) as Witness[],
                hasAnotherFather: has_another_father === true ? true : has_another_father === false ? false : null,
                adminNotes: data[statusKey]?.admin_notes,
              }
            })
            return next
          })
        } else if (data.client_story) {
          // Legacy format fallback — load into DJ1
          setDjStates(prev => {
            const storyRaw = (data.client_story?.data || {}) as Record<string, unknown>
            const { children, has_another_father, minor_info, tutor: _t, minorBasic, minorAbuse, minorBestInterest, ...restStory } = storyRaw

            if (!data.tutor_guardian?.data && _t) {
              setTutorData(prev => ({ ...prev, ...(_t as Partial<TutorData>) }))
              setTutorSaved(true)
            }

            let loadedChildren: ChildInfo[] = []
            if (Array.isArray(children) && children.length > 0) {
              loadedChildren = children as ChildInfo[]
            } else if (minor_info && (minor_info as ChildInfo).name) {
              loadedChildren = [minor_info as ChildInfo]
            }

            const parentData = (data.client_absent_parent?.data || {}) as Partial<ParentData>
            const witnessesData = (data.client_witnesses?.data || {}) as { witnesses?: Witness[] }

            return {
              ...prev,
              1: {
                ...prev[1],
                status: (data.client_story?.status as DJState['status']) || 'draft',
                children: loadedChildren.length > 0 ? loadedChildren : [{ ...EMPTY_CHILD }],
                minorBasic: { ...EMPTY_MINOR_BASIC, ...(minorBasic as Partial<MinorBasicData> || {}) },
                minorAbuse: { ...EMPTY_MINOR_ABUSE, ...(minorAbuse as Partial<MinorAbuseData> || {}) },
                minorBestInterest: { ...EMPTY_MINOR_BEST_INTEREST, ...(minorBestInterest as Partial<MinorBestInterestData> || {}) },
                story: { ...EMPTY_STORY, ...(restStory as Partial<StoryData>) },
                parent: { ...EMPTY_PARENT, ...parentData },
                witnesses: witnessesData?.witnesses?.length ? witnessesData.witnesses : [{ name: '', relationship: '', phone: '', can_testify: '' }],
                hasAnotherFather: has_another_father === true ? true : has_another_father === false ? false : null,
                adminNotes: data.client_story?.admin_notes,
              },
            }
          })
        }
      } catch {
        // First load, no data
      } finally {
        setLoading(false)
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // How many children need declarations
  const [childCount, setChildCount] = useState<number | null>(() => {
    const filledCount = ([1, 2, 3, 4] as const).filter(n => djStates[n].status !== 'empty').length
    return filledCount > 0 ? filledCount : null
  })

  // Father grouping: same father or different?
  const [sameFather, setSameFather] = useState<boolean | null>(null)
  const [fatherGroupCount, setFatherGroupCount] = useState<number>(1)
  // Map: child number → father group (A=1, B=2, etc.)
  const [fatherGroups, setFatherGroups] = useState<Record<number, number>>({ 1: 1, 2: 1, 3: 1, 4: 1 })
  const [setupDone, setSetupDone] = useState(false)

  function handleDJUpdated(djNum: number, newState: DJState) {
    setDjStates(prev => ({ ...prev, [djNum]: newState }))
  }

  function handleDocAdded(djNum: number, doc: DJDoc) {
    setDjStates(prev => ({
      ...prev,
      [djNum]: { ...prev[djNum], docs: [...prev[djNum].docs, doc] },
    }))
  }

  function handleDocRemoved(djNum: number, docId: string) {
    setDjStates(prev => ({
      ...prev,
      [djNum]: { ...prev[djNum], docs: prev[djNum].docs.filter(d => d.id !== docId) },
    }))
  }

  async function saveTutor() {
    try {
      await fetch('/api/client-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, form_type: 'tutor_guardian', form_data: tutorData, action: 'submit', minor_index: 0 }),
      })
      setTutorSaved(true)
      setShowTutorForm(false)
      toast.success('Historia del tutor guardada')
    } catch {
      toast.error('Error al guardar')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#F2A900]" />
      </div>
    )
  }

  // Show tutor form
  if (showTutorForm) {
    return (
      <TutorStep
        tutor={tutorData}
        token={token}
        onChange={setTutorData}
        onSave={saveTutor}
        onBack={() => setShowTutorForm(false)}
      />
    )
  }

  if (activeDJ) {
    return (
      <DJWizard
        djNumber={activeDJ}
        token={token}
        initial={djStates[activeDJ]}
        isLastPossibleDJ={activeDJ === (childCount || 1)}
        onBack={() => {
          // After completing, auto-open next if available
          const currentState = djStates[activeDJ]
          if (currentState.status === 'submitted' && childCount && activeDJ < childCount) {
            const next = (activeDJ + 1) as 1 | 2 | 3 | 4
            if (djStates[next].status === 'empty') {
              setActiveDJ(next)
              toast.success(`¡Declaración ${activeDJ} enviada! Ahora llene la del siguiente hijo.`)
              return
            }
          }
          setActiveDJ(null)
        }}
        onStateChange={(state) => handleDJUpdated(activeDJ, state)}
        onDocAdded={(doc) => handleDocAdded(activeDJ, doc)}
        onDocRemoved={(docId) => handleDocRemoved(activeDJ, docId)}
      />
    )
  }

  return (
    <div className="space-y-5">
      {/* Tutor card — always at the top */}
      <div
        className="rounded-2xl border-2 p-5 cursor-pointer transition-all hover:shadow-md"
        style={{
          borderColor: tutorSaved ? '#bbf7d0' : '#fde68a',
          background: tutorSaved ? '#f0fdf4' : '#fffbeb',
        }}
        onClick={() => setShowTutorForm(true)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: tutorSaved ? '#dcfce7' : '#fef3c7' }}>
              <Users className="w-5 h-5" style={{ color: tutorSaved ? '#059669' : '#d97706' }} />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">Mi Historia (Tutor/Guardián)</p>
              {tutorSaved && (tutorData.full_name as string) ? (
                <p className="text-xs text-gray-500">{tutorData.full_name as string} — Completado</p>
              ) : (
                <p className="text-xs text-amber-600 font-medium">Pendiente — Toca para llenar</p>
              )}
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-400" />
        </div>
      </div>

      {/* Step 2: Setup wizard — how many children + father grouping */}
      {!childCount ? (
        <div className="rounded-2xl border-2 border-[#002855]/20 p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #002855, #001d3d)' }}>
            <Users className="w-7 h-7 text-[#F2A900]" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-lg">¿Cuántos hijos necesitan su declaración?</p>
            <p className="text-sm text-gray-500 mt-1">Cada hijo necesita llenar su propia historia.</p>
          </div>
          <div className="flex justify-center gap-3">
            {[1, 2, 3, 4].map(n => (
              <button key={n} onClick={() => {
                setChildCount(n)
                if (n === 1) { setSameFather(true); setSetupDone(true) }
              }}
                className="w-16 h-16 rounded-2xl border-2 border-gray-200 text-2xl font-bold text-gray-700 hover:border-[#F2A900] hover:bg-[#F2A900]/5 hover:text-[#F2A900] transition-all active:scale-95">
                {n}
              </button>
            ))}
          </div>
        </div>
      ) : childCount > 1 && sameFather === null ? (
        /* Ask if same father */
        <div className="rounded-2xl border-2 border-[#002855]/20 p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #002855, #001d3d)' }}>
            <Users className="w-7 h-7 text-[#F2A900]" />
          </div>
          <p className="font-bold text-gray-900 text-lg">¿Todos sus hijos son del mismo padre ausente?</p>
          <p className="text-sm text-gray-500">Esto ayuda al abogado a organizar las declaraciones correctamente.</p>
          <div className="flex justify-center gap-4">
            <button onClick={() => { setSameFather(true); setFatherGroupCount(1); setSetupDone(true) }}
              className="flex-1 max-w-[200px] py-4 rounded-2xl border-2 border-green-300 bg-green-50 text-sm font-bold text-green-700 hover:bg-green-100 transition-all">
              Sí, mismo padre
            </button>
            <button onClick={() => { setSameFather(false) }}
              className="flex-1 max-w-[200px] py-4 rounded-2xl border-2 border-amber-300 bg-amber-50 text-sm font-bold text-amber-700 hover:bg-amber-100 transition-all">
              No, padres diferentes
            </button>
          </div>
        </div>
      ) : childCount > 1 && sameFather === false && !setupDone ? (
        /* Ask how many different fathers + assign groups */
        <div className="rounded-2xl border-2 border-[#002855]/20 p-6 space-y-5">
          <div className="text-center">
            <p className="font-bold text-gray-900 text-lg">¿Cuántos padres ausentes diferentes hay?</p>
            <div className="flex justify-center gap-3 mt-3">
              {[2, 3].filter(n => n <= childCount).map(n => (
                <button key={n} onClick={() => setFatherGroupCount(n)}
                  className={`w-14 h-14 rounded-2xl border-2 text-xl font-bold transition-all ${
                    fatherGroupCount === n ? 'border-[#F2A900] bg-[#F2A900]/10 text-[#F2A900]' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}>{n}</button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-bold text-gray-700 mb-3">Asigne cada hijo a su padre:</p>
            <div className="space-y-2">
              {([1, 2, 3, 4] as const).filter(n => n <= childCount).map(n => {
                const name = djStates[n].minorBasic.full_name || `Hijo/a ${n}`
                return (
                  <div key={n} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200">
                    <span className="text-sm font-medium text-gray-800">{name}</span>
                    <div className="flex gap-2">
                      {Array.from({ length: fatherGroupCount }, (_, i) => i + 1).map(g => (
                        <button key={g} onClick={() => setFatherGroups(prev => ({ ...prev, [n]: g }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            fatherGroups[n] === g
                              ? g === 1 ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-orange-100 text-orange-700 border border-orange-300'
                              : 'bg-gray-100 text-gray-400 border border-gray-200'
                          }`}>
                          Padre {String.fromCharCode(64 + g)}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <button onClick={() => setSetupDone(true)}
            className="w-full py-3 rounded-xl text-sm font-bold text-[#001020] transition-all hover:opacity-90"
            style={{ background: '#F2A900' }}>
            Continuar
          </button>
        </div>
      ) : (
        <>
          {/* Child count indicator */}
          <div className="flex items-center justify-between px-1">
            <p className="text-sm font-bold text-gray-700">
              Declaraciones de los hijos ({([1, 2, 3, 4] as const).filter(n => n <= childCount && djStates[n].status !== 'empty').length}/{childCount})
            </p>
            {childCount < 4 && (
              <button onClick={() => setChildCount(c => Math.min((c || 1) + 1, 4))}
                className="text-xs text-[#F2A900] font-bold hover:underline">
                + Agregar otro hijo
              </button>
            )}
          </div>

          {/* Declaration cards */}
          <div className="space-y-3">
            {([1, 2, 3, 4] as const).filter(n => n <= childCount).map(n => {
              const state = djStates[n]
              const cfg = STATUS_CONFIG[state.status] || STATUS_CONFIG.empty
              const childName = state.minorBasic.full_name || `Hijo/a ${n}`
              const fGroup = fatherGroups[n] || 1
              const isNext = state.status === 'empty' && ([1, 2, 3, 4] as const)
                .filter(x => x < n && x <= childCount)
                .every(x => djStates[x].status !== 'empty')

              return (
                <div key={n}
                  className="rounded-2xl border-2 p-4 cursor-pointer transition-all hover:shadow-md"
                  style={{ borderColor: isNext ? '#F2A900' : cfg.border, background: isNext ? '#fffbeb' : cfg.bg }}
                  onClick={() => setActiveDJ(n)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm"
                        style={{ background: isNext ? '#F2A900' : state.status !== 'empty' ? cfg.border : '#e5e7eb', color: isNext ? '#001020' : state.status !== 'empty' ? cfg.color : '#9ca3af' }}>
                        {n}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-900 text-sm">{childName}</p>
                          {!sameFather && fatherGroupCount > 1 && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              fGroup === 1 ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                            }`}>
                              Padre {String.fromCharCode(64 + fGroup)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs" style={{ color: cfg.color }}>
                          {isNext ? '→ Toca aquí para comenzar' : `● ${cfg.label}`}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5" style={{ color: isNext ? '#F2A900' : '#d1d5db' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ══ DJ SELECTOR ════════════════════════════════════════════════════

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  empty:            { label: 'No iniciada', color: '#9ca3af', bg: '#f9fafb', border: '#e5e7eb' },
  draft:            { label: 'Borrador guardado', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  submitted:        { label: 'Enviada — pendiente', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  approved:         { label: 'Aprobada ✓', color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
  needs_correction: { label: 'Requiere correcciones', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
}

function DJSelector({
  djStates, visibleDJs, onOpen,
}: {
  djStates: Record<number, DJState>
  visibleDJs: (1 | 2 | 3 | 4)[]
  onOpen: (n: 1 | 2 | 3 | 4) => void
}) {
  return (
    <div className="space-y-4">
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <p className="text-sm text-blue-800">
          <strong>¿Todos sus hijos son del mismo padre/madre?</strong> Solo llene la Declaración Jurada 1.
          Al finalizar, le preguntaremos si tiene hijos con otro padre — así se desbloqueará la Declaración 2.
        </p>
      </div>

      {([1, 2, 3, 4] as const).map(n => {
        const state = djStates[n]
        const isVisible = visibleDJs.includes(n)
        const cfg = STATUS_CONFIG[state.status]
        const childNames = state.children.filter(c => c.name.trim()).map(c => c.name)
        const parentName = state.parent.parent_name

        return (
          <div
            key={n}
            className="rounded-2xl border-2 p-5"
            style={{
              background: isVisible ? cfg.bg : '#f9fafb',
              borderColor: isVisible ? cfg.border : '#e5e7eb',
              opacity: isVisible ? 1 : 0.55,
            }}
          >
            <div className="flex items-start gap-3 justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  {isVisible
                    ? <BookOpen className="w-4 h-4 shrink-0" style={{ color: '#F2A900' }} />
                    : <Lock className="w-4 h-4 shrink-0 text-gray-400" />
                  }
                  <span className="font-bold text-gray-900">Declaración Jurada {n}</span>
                </div>

                {!isVisible ? (
                  <p className="text-xs text-gray-400">
                    Se activa al indicar que hay otro padre en la declaración anterior
                  </p>
                ) : (
                  <>
                    <p className="text-xs font-medium" style={{ color: cfg.color }}>● {cfg.label}</p>

                    {childNames.length > 0 && (
                      <p className="text-xs text-gray-600 mt-1">
                        {childNames.length === 1 ? 'Hijo/a:' : 'Hijos/as:'} {childNames.join(', ')}
                        {parentName && <span className="text-gray-400"> — Padre: {parentName}</span>}
                      </p>
                    )}

                    {state.docs.length > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        📎 {state.docs.length} documento{state.docs.length !== 1 ? 's' : ''} adjunto{state.docs.length !== 1 ? 's' : ''}
                      </p>
                    )}

                    {state.adminNotes && state.status === 'needs_correction' && (
                      <div className="mt-2 p-2 rounded-lg bg-red-100">
                        <p className="text-xs text-red-700 font-medium">Corrección solicitada:</p>
                        <p className="text-xs text-red-700">{state.adminNotes}</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {isVisible && (
                <button
                  onClick={() => onOpen(n)}
                  className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-95"
                  style={{ background: '#F2A900', color: '#001020' }}
                >
                  {state.status === 'empty' ? 'Comenzar' : state.status === 'approved' ? 'Ver' : 'Continuar'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ══ DJ WIZARD ══════════════════════════════════════════════════════

function DJWizard({
  djNumber, token, initial, isLastPossibleDJ,
  onBack, onStateChange, onDocAdded, onDocRemoved,
}: {
  djNumber: number
  token: string
  initial: DJState
  isLastPossibleDJ: boolean
  onBack: () => void
  onStateChange: (s: DJState) => void
  onDocAdded: (doc: DJDoc) => void
  onDocRemoved: (docId: string) => void
}) {
  const [step, setStep] = useState(0)
  const [state, setState] = useState<DJState>(initial)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const minorIndex = djNumber - 1

  function updateState(patch: Partial<DJState>) {
    setState(prev => {
      const next = { ...prev, ...patch }
      onStateChange(next)
      return next
    })
  }

  const saveDraft = useCallback(async (formType: string, formData: unknown) => {
    setSaving(true)
    try {
      await fetch('/api/client-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, form_type: formType, form_data: formData, action: 'draft', minor_index: minorIndex }),
      })
    } catch { /* silent */ } finally { setSaving(false) }
  }, [token, minorIndex])

  // Auto-save with debounce — saves every 4 seconds while user edits
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      // Save all minor data together in client_story
      const hasData = state.minorBasic.full_name.trim() || state.minorAbuse.abuse_by_father.trim() || state.minorBestInterest.fear_of_return.trim()
      if (hasData) {
        saveDraft('client_story', {
          minorBasic: state.minorBasic,
          minorAbuse: state.minorAbuse,
          minorBestInterest: state.minorBestInterest,
          children: state.children,
          has_another_father: state.hasAnotherFather,
        })
      }
      if (state.witnesses.some(w => w.name.trim())) {
        saveDraft('client_witnesses', { witnesses: state.witnesses })
      }
    }, 4000)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [state, saveDraft])

  function goNext() {
    setStep(s => Math.min(s + 1, DJ_TOTAL_STEPS - 1))
  }

  function goBack() {
    if (step === 0) { onBack(); return }
    setStep(s => s - 1)
  }

  function validate(): boolean {
    if (!state.minorBasic.full_name.trim()) {
      toast.error('Ingresa el nombre completo del menor')
      setStep(0); return false
    }
    if (!state.minorAbuse.abuse_by_father.trim() && !state.minorAbuse.abuse_by_mother.trim()) {
      toast.error('Describe los hechos de abuso/abandono por al menos un padre')
      setStep(1); return false
    }
    if (!state.minorBestInterest.fear_of_return.trim()) {
      toast.error('Describe por qué el menor tiene miedo de regresar')
      setStep(2); return false
    }
    if (!state.witnesses.some(w => w.name.trim())) {
      toast.error('Agrega al menos un testigo')
      setStep(3); return false
    }
    return true
  }

  async function handleSubmit() {
    if (!validate()) return
    setSubmitting(true)
    try {
      const submissions = [
        {
          form_type: 'client_story',
          form_data: {
            minorBasic: state.minorBasic,
            minorAbuse: state.minorAbuse,
            minorBestInterest: state.minorBestInterest,
            children: state.children.filter(c => c.name.trim()),
            has_another_father: state.hasAnotherFather,
          },
        },
        { form_type: 'client_witnesses', form_data: { witnesses: state.witnesses.filter(w => w.name.trim()) } },
      ]

      for (const sub of submissions) {
        const res = await fetch('/api/client-story', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, ...sub, action: 'submit', minor_index: minorIndex }),
        })
        if (!res.ok) throw new Error('Error al enviar')
      }

      updateState({ status: 'submitted' })
      toast.success(`Declaración Jurada ${djNumber} enviada exitosamente`)
      onBack()
    } catch {
      toast.error('Error al enviar. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  const progress = (step / (DJ_TOTAL_STEPS - 1)) * 100

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <button onClick={goBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ChevronLeft className="w-4 h-4" /> Volver a declaraciones
        </button>
        <h3 className="font-bold text-gray-900">Declaración Jurada {djNumber}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{DJ_STEP_LABELS[step]}</p>
      </div>

      {/* Progress */}
      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-1.5">
          <span>Paso {step + 1} de {DJ_TOTAL_STEPS}</span>
          <span className={saving ? 'text-green-600' : ''}>{saving ? '● Guardando...' : 'Se guarda automáticamente'}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${Math.max(progress, 4)}%`, background: 'linear-gradient(90deg, #F2A900, #ffca28)' }}
          />
        </div>
        <div className="flex gap-1 mt-2">
          {DJ_STEP_LABELS.map((label, i) => (
            <div key={i} className="flex-1 h-1 rounded-full transition-all"
              style={{ background: i <= step ? '#F2A900' : '#f0f1f3' }} />
          ))}
        </div>
      </div>

      {/* Correction banner */}
      {state.status === 'needs_correction' && state.adminNotes && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">Tu consultor solicitó correcciones:</p>
            <p className="text-sm text-red-600 mt-0.5">{state.adminNotes}</p>
          </div>
        </div>
      )}

      {/* Step content */}
      <div>
        {step === 0 && (
          <MinorBasicSection
            data={state.minorBasic}
            onChange={minorBasic => updateState({ minorBasic })}
          />
        )}
        {step === 1 && (
          <MinorAbuseSection
            data={state.minorAbuse}
            onChange={minorAbuse => updateState({ minorAbuse })}
          />
        )}
        {step === 2 && (
          <MinorBestInterestSection
            data={state.minorBestInterest}
            onChange={minorBestInterest => updateState({ minorBestInterest })}
          />
        )}
        {step === 3 && (
          <WitnessStep
            witnesses={state.witnesses}
            childNames={[state.minorBasic.full_name || 'el menor']}
            onChange={witnesses => updateState({ witnesses })}
          />
        )}
        {step === 4 && (
          <FinalStep
            djNumber={djNumber}
            state={state}
            onEditStep={setStep}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-gray-100">
        <button
          onClick={goBack}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {step === 0 ? 'Volver' : 'Anterior'}
        </button>

        {step < DJ_TOTAL_STEPS - 1 ? (
          <button
            onClick={goNext}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-95"
            style={{ background: '#F2A900', color: '#001020' }}
          >
            Siguiente <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-green-600 hover:bg-green-700 text-white transition-all disabled:opacity-60"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar al consultor
          </button>
        )}
      </div>
    </div>
  )
}

// ══ TUTOR STEP (independent, outside DJ wizard) — uses new 30-question form ═══

function TutorStep({ tutor, token, onChange, onSave, onBack }: {
  tutor: TutorData; token: string; onChange: (t: TutorData) => void
  onSave: () => void; onBack: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [autoSaved, setAutoSaved] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-save tutor draft every 4 seconds
  useEffect(() => {
    if (!(tutor.full_name as string)?.trim()) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        await fetch('/api/client-story', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, form_type: 'tutor_guardian', form_data: tutor, action: 'draft', minor_index: 0 }),
        })
        setAutoSaved(true)
        setTimeout(() => setAutoSaved(false), 2000)
      } catch { /* silent */ }
    }, 4000)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [tutor, token])

  async function handleSave() {
    if (!(tutor.full_name as string)?.trim()) { toast.error('Ingresa tu nombre completo'); return }
    setSaving(true)
    await onSave()
    setSaving(false)
  }

  return (
    <div className="space-y-5">
      <div>
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ChevronLeft className="w-4 h-4" /> Volver
        </button>
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-[#F2A900]" />
          <h3 className="font-bold text-gray-900">Declaración Jurada del Padre/Tutor</h3>
        </div>
        <p className="text-sm text-gray-500 mt-1">30 preguntas organizadas en 6 secciones. Su progreso se guarda automáticamente.</p>
      </div>

      {autoSaved && (
        <p className="text-xs text-green-600 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" /> Progreso guardado automáticamente
        </p>
      )}

      <TutorFormSections data={tutor as unknown as Record<string, string | TutorWitness[]>} onChange={d => onChange(d as unknown as TutorData)} />

      {/* Save button */}
      <div className="flex justify-end pt-4 border-t border-gray-100">
        <button
          onClick={handleSave}
          disabled={saving || !(tutor.full_name as string)?.trim()}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
          style={{ background: '#F2A900', color: '#001020' }}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          Enviar al abogado
        </button>
      </div>
    </div>
  )
}

// ══ STEP 0: CHILDREN ═══════════════════════════════════════════════

function ChildrenStep({ children, onChange, djNumber }: {
  children: ChildInfo[]
  onChange: (c: ChildInfo[]) => void
  djNumber: number
}) {
  function update(idx: number, patch: Partial<ChildInfo>) {
    onChange(children.map((c, i) => i === idx ? { ...c, ...patch } : c))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Users className="w-5 h-5 text-[#F2A900]" />
        <h3 className="font-semibold text-gray-900">Hijos en esta declaración</h3>
      </div>
      <p className="text-sm text-gray-500">
        Agregue los hijos que pertenecen a este {djNumber === 1 ? 'padre/madre' : `padre/madre (Declaración ${djNumber})`}.
        Si tienen el mismo padre, pueden ir todos aquí.
      </p>

      {children.map((child, i) => (
        <div key={i} className="p-4 rounded-xl border border-gray-200 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-gray-700">Hijo/a {i + 1}</span>
            {children.length > 1 && (
              <button
                onClick={() => onChange(children.filter((_, j) => j !== i))}
                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> Eliminar
              </button>
            )}
          </div>

          <div>
            <FieldLabel required>Nombre completo</FieldLabel>
            <TextInput
              value={child.name}
              onChange={v => update(i, { name: v })}
              placeholder="Nombre y apellidos del niño/a"
            />
          </div>

          <div>
            <FieldLabel required>¿Cuál es tu relación con este menor?</FieldLabel>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {GUARDIAN_RELATIONS.map(r => (
                <button
                  key={r.value}
                  onClick={() => update(i, { guardian_relation: r.value, guardian_relation_other: r.value === 'otro' ? child.guardian_relation_other : '' })}
                  className={`py-2 px-2 rounded-lg border text-xs font-medium transition-colors ${
                    child.guardian_relation === r.value
                      ? 'border-[#F2A900] bg-[#F2A900]/10 text-[#F2A900]'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {child.guardian_relation === 'otro' && (
              <div className="mt-2">
                <TextInput
                  value={child.guardian_relation_other}
                  onChange={v => update(i, { guardian_relation_other: v })}
                  placeholder="Especifique la relación"
                />
              </div>
            )}
          </div>
        </div>
      ))}

      {children.length < 6 && (
        <button
          onClick={() => onChange([...children, { ...EMPTY_CHILD }])}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-[#F2A900] hover:text-[#F2A900] transition-colors flex items-center justify-center gap-2"
        >
          <UserPlus className="w-4 h-4" /> Agregar otro hijo/a (mismo padre)
        </button>
      )}
    </div>
  )
}

// ══ STEP 1: STORY ══════════════════════════════════════════════════

function StoryStep({ story, children, onChange }: {
  story: StoryData
  children: ChildInfo[]
  onChange: (s: StoryData) => void
}) {
  const set = (field: keyof StoryData, v: string) => onChange({ ...story, [field]: v })
  const names = children.map(c => c.name).join(' y ') || 'el/los menor(es)'
  const guardianLabel = children[0]
    ? GUARDIAN_RELATIONS.find(r => r.value === children[0].guardian_relation)?.label?.toLowerCase() || 'tutor/a'
    : 'tutor/a'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <BookOpen className="w-5 h-5 text-[#F2A900]" />
        <h3 className="font-semibold text-gray-900">Tu declaración sobre {names}</h3>
      </div>
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
        Escribe desde tu perspectiva. Incluye todos los detalles: violencia, penurias, momentos difíciles — todo suma.
        La información es confidencial.
      </div>

      <div>
        <FieldLabel required>¿En qué año llegaron a los Estados Unidos?</FieldLabel>
        <TextInput value={story.arrival_year} onChange={v => set('arrival_year', v)} placeholder="Ej: 2020" />
      </div>
      <div>
        <FieldLabel required>¿Quién trajo a {names} a los Estados Unidos?</FieldLabel>
        <TextInput value={story.who_brought} onChange={v => set('who_brought', v)} placeholder={`Ej: Yo (su ${guardianLabel}), un familiar, etc.`} />
      </div>
      <div>
        <FieldLabel required>¿Con quién vive(n) actualmente en EE.UU.?</FieldLabel>
        <TextInput value={story.current_guardian} onChange={v => set('current_guardian', v)} placeholder={`Ej: Conmigo (su ${guardianLabel}) / Con su abuela...`} />
      </div>
      <div>
        <FieldLabel>¿Cuándo se separaron usted y la pareja? (fecha aproximada)</FieldLabel>
        <TextInput value={story.separation_date} onChange={v => set('separation_date', v)} placeholder="Ej: En 2015 / Nunca vivimos juntos" />
      </div>
      <div>
        <FieldLabel required>¿Cómo fue el abandono? Describe con el mayor detalle posible.</FieldLabel>
        <TextArea value={story.how_was_abandonment} onChange={v => set('how_was_abandonment', v)}
          placeholder={`Cuenta desde el inicio: ¿Vivían juntos? ¿Qué pasó? ¿Se fue con otra persona, fue violento, nunca quiso hacerse cargo de ${names}? Incluye nombres, fechas y lugares.`}
          rows={6} />
      </div>
      <div>
        <FieldLabel>¿La pareja dio apoyo económico alguna vez?</FieldLabel>
        <TextArea value={story.father_economic_support} onChange={v => set('father_economic_support', v)} placeholder="Ej: Nunca dio dinero / Al principio daba algo y luego dejó de dar..." rows={3} />
      </div>
      <div>
        <FieldLabel>¿Tuvo contacto con {names} después de la separación?</FieldLabel>
        <TextArea value={story.father_contact_with_child} onChange={v => set('father_contact_with_child', v)} placeholder="Ej: Nunca llamó / Una vez prometió ir al cumpleaños y nunca llegó..." rows={3} />
      </div>
      <div>
        <FieldLabel>¿Quién se hizo cargo de {names} cuando los abandonaron?</FieldLabel>
        <TextArea value={story.who_took_care} onChange={v => set('who_took_care', v)} placeholder="Ej: Yo sola / Mis padres me ayudaron..." rows={3} />
      </div>
      <div>
        <FieldLabel>¿Tiene denuncias o documentos que prueben el abandono?</FieldLabel>
        <div className="flex gap-3 mb-2">
          {['Sí', 'No'].map(opt => (
            <button key={opt} onClick={() => set('has_complaints', opt)}
              className={`px-4 py-2 rounded-lg border text-sm transition-colors ${story.has_complaints === opt ? 'border-[#F2A900] bg-[#F2A900]/10 text-[#F2A900]' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
              {opt}
            </button>
          ))}
        </div>
        {story.has_complaints === 'Sí' && (
          <TextArea value={story.complaints_detail} onChange={v => set('complaints_detail', v)} placeholder="Describe qué documentos tiene: demanda de alimentos, denuncia por maltrato, etc." rows={3} />
        )}
      </div>
      <div>
        <FieldLabel>¿Por qué {names} no puede volver a vivir con quien los abandonó?</FieldLabel>
        <TextArea value={story.why_no_reunification} onChange={v => set('why_no_reunification', v)} placeholder="Ej: Tiene otra familia, nunca se hizo responsable, no sabemos dónde vive..." rows={4} />
      </div>
      <div>
        <FieldLabel>¿Hay algo más que quiera agregar?</FieldLabel>
        <TextArea value={story.additional_details} onChange={v => set('additional_details', v)} placeholder="Escriba todo lo que considere importante..." rows={4} />
      </div>
    </div>
  )
}

// ══ STEP 2: PARENT ═════════════════════════════════════════════════

function ParentStep({ parent, childNames, onChange }: {
  parent: ParentData
  childNames: string[]
  onChange: (p: ParentData) => void
}) {
  const set = (field: keyof ParentData, v: string) => onChange({ ...parent, [field]: v })
  const names = childNames.join(' y ') || 'el/los menor(es)'

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900">Padre/Madre de {names}</h3>
      <p className="text-sm text-gray-500">Información sobre el padre o madre que aparece en esta declaración.</p>

      <div>
        <FieldLabel required>¿Quién es la persona ausente?</FieldLabel>
        <div className="flex gap-3">
          {['padre', 'madre'].map(r => (
            <button key={r} onClick={() => set('parent_relationship', r)}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${parent.parent_relationship === r ? 'border-[#F2A900] bg-[#F2A900]/10 text-[#F2A900]' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
              {r === 'padre' ? 'Padre' : 'Madre'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <FieldLabel required>¿Cuál es la situación de esa persona?</FieldLabel>
        <div className="grid gap-2">
          {PARENT_SITUATIONS.map(opt => (
            <button key={opt.value} onClick={() => set('situation', opt.value)}
              className={`text-left p-3 rounded-xl border transition-colors ${parent.situation === opt.value ? 'border-[#F2A900] bg-[#F2A900]/10' : 'border-gray-200 hover:border-gray-300'}`}>
              <span className="text-sm font-medium text-gray-800">{opt.label}</span>
              <span className="block text-xs text-gray-500 mt-0.5">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {parent.situation === 'cooperates' && (
        <div className="space-y-3 p-4 bg-blue-50 rounded-xl">
          <p className="text-sm font-medium text-blue-800">Información de contacto</p>
          <div><FieldLabel required>Nombre completo</FieldLabel><TextInput value={parent.parent_name} onChange={v => set('parent_name', v)} placeholder="Nombre completo" /></div>
          <div><FieldLabel>Teléfono</FieldLabel><TextInput value={parent.parent_phone} onChange={v => set('parent_phone', v)} placeholder="+1 (000) 000-0000" /></div>
          <div><FieldLabel>Email</FieldLabel><TextInput value={parent.parent_email} onChange={v => set('parent_email', v)} placeholder="email@ejemplo.com" /></div>
          <div>
            <FieldLabel>¿Dispuesto/a a firmar la renuncia?</FieldLabel>
            <div className="flex gap-2">
              {['Sí', 'No', 'No estoy seguro/a'].map(opt => (
                <button key={opt} onClick={() => set('willing_to_sign', opt)}
                  className={`px-3 py-1.5 rounded-lg border text-xs transition-colors ${parent.willing_to_sign === opt ? 'border-[#F2A900] bg-[#F2A900]/10 text-[#F2A900]' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>{opt}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {parent.situation === 'absent' && (
        <div className="space-y-3 p-4 bg-orange-50 rounded-xl">
          <div><FieldLabel>Nombre completo (si lo sabe)</FieldLabel><TextInput value={parent.parent_name} onChange={v => set('parent_name', v)} placeholder="Nombre completo" /></div>
          <div><FieldLabel>¿Cuándo fue el último contacto?</FieldLabel><TextInput value={parent.last_contact_date} onChange={v => set('last_contact_date', v)} placeholder="Ej: Hace 5 años, en 2018" /></div>
          <div><FieldLabel>¿Cómo fue ese contacto?</FieldLabel><TextArea value={parent.last_contact_description} onChange={v => set('last_contact_description', v)} placeholder="Describe cómo fue..." /></div>
          <div><FieldLabel required>¿Por qué está ausente?</FieldLabel><TextArea value={parent.reason_absent} onChange={v => set('reason_absent', v)} placeholder="Ej: Nos abandonó, no quiso saber de nosotros..." rows={4} /></div>
          <div><FieldLabel>¿Ha intentado localizarlo/a?</FieldLabel><TextArea value={parent.efforts_to_find} onChange={v => set('efforts_to_find', v)} placeholder="Ej: Sí, para pedirle dinero... / No, perdí todo contacto..." /></div>
        </div>
      )}

      {parent.situation === 'deceased' && (
        <div className="space-y-3 p-4 bg-gray-50 rounded-xl">
          <div><FieldLabel>Nombre completo</FieldLabel><TextInput value={parent.parent_name} onChange={v => set('parent_name', v)} placeholder="Nombre completo" /></div>
          <div><FieldLabel>¿Cuándo falleció?</FieldLabel><TextInput value={parent.death_date} onChange={v => set('death_date', v)} placeholder="Ej: 2019" /></div>
          <div><FieldLabel>¿Dónde falleció?</FieldLabel><TextInput value={parent.death_place} onChange={v => set('death_place', v)} placeholder="Ciudad o país" /></div>
          <div>
            <FieldLabel>¿Tiene certificado de defunción?</FieldLabel>
            <div className="flex gap-3">
              {['Sí', 'No'].map(opt => (
                <button key={opt} onClick={() => set('has_death_certificate', opt)}
                  className={`px-4 py-2 rounded-lg border text-sm transition-colors ${parent.has_death_certificate === opt ? 'border-[#F2A900] bg-[#F2A900]/10 text-[#F2A900]' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>{opt}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {(parent.situation === 'unknown' || parent.situation === 'never_known') && (
        <div className="space-y-3 p-4 bg-purple-50 rounded-xl">
          <div><FieldLabel>¿Qué sabes sobre esta persona?</FieldLabel><TextArea value={parent.what_is_known} onChange={v => set('what_is_known', v)} placeholder="Describe lo que sepas, por poco que sea..." rows={4} /></div>
        </div>
      )}
    </div>
  )
}

// ══ STEP 3: WITNESSES ══════════════════════════════════════════════

function WitnessStep({ witnesses, childNames, onChange }: {
  witnesses: Witness[]
  childNames: string[]
  onChange: (w: Witness[]) => void
}) {
  function update(idx: number, field: keyof Witness, value: string) {
    onChange(witnesses.map((w, i) => i === idx ? { ...w, [field]: value } : w))
  }
  const names = childNames.join(' y ') || 'el/los menor(es)'

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900">Testigos</h3>
      <p className="text-sm text-gray-500">
        Personas que pueden dar fe del abandono y de su situación con {names}.
        Recomendamos 2 de su país de origen y 1 de EE.UU. Mínimo 1, máximo 3.
      </p>

      {witnesses.map((w, i) => (
        <div key={i} className="p-4 rounded-xl border border-gray-200 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-gray-700">Testigo {i + 1}</span>
            {witnesses.length > 1 && (
              <button onClick={() => onChange(witnesses.filter((_, j) => j !== i))} className="text-xs text-red-500 hover:text-red-700">Eliminar</button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><FieldLabel required>Nombre completo</FieldLabel><TextInput value={w.name} onChange={v => update(i, 'name', v)} placeholder="Nombre del testigo" /></div>
            <div><FieldLabel required>Relación con usted o {names}</FieldLabel><TextInput value={w.relationship} onChange={v => update(i, 'relationship', v)} placeholder="Ej: Mi mamá, vecina en EE.UU." /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><FieldLabel>Teléfono</FieldLabel><TextInput value={w.phone} onChange={v => update(i, 'phone', v)} placeholder="+1 (000) 000-0000" /></div>
            <div><FieldLabel>Dirección</FieldLabel><TextInput value={(w as any).address || ''} onChange={v => onChange(witnesses.map((ww, j) => j === i ? { ...ww, address: v } as any : ww))} placeholder="Ciudad, Estado, País" /></div>
          </div>
          <div>
            <FieldLabel required>¿Qué puede declarar? ¿Qué etapa presenció?</FieldLabel>
            <TextArea value={w.can_testify} onChange={v => update(i, 'can_testify', v)}
              placeholder={`Ej: Vivió cerca de nosotros entre 2018-2022, vio que el padre de ${names} nunca estuvo presente...`} rows={3} />
          </div>
        </div>
      ))}

      {witnesses.length < 3 && (
        <button
          onClick={() => onChange([...witnesses, { name: '', relationship: '', phone: '', can_testify: '' }])}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 border-[#F2A900] text-sm font-bold text-[#9a6500] bg-[#F2A900]/10"
        >
          <UserPlus className="w-4 h-4" />
          Agregar otro testigo
        </button>
      )}
    </div>
  )
}

// ══ STEP 4: DOCUMENTS ══════════════════════════════════════════════

function DocsStep({ djNumber, token, docs, onAdded, onRemoved }: {
  djNumber: number
  token: string
  docs: DJDoc[]
  onAdded: (doc: DJDoc) => void
  onRemoved: (docId: string) => void
}) {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') { toast.error('Solo se aceptan PDFs'); return }

    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('token', token)
      fd.append('declaration_number', String(djNumber))

      const res = await fetch('/api/declarations/upload-document', { method: 'POST', body: fd })
      if (!res.ok) { toast.error('Error al subir documento'); return }
      const { document } = await res.json()
      onAdded({ id: document.id, name: document.name, file_size: document.file_size })
      toast.success('Documento subido')
    } catch { toast.error('Error al subir documento') }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  async function handleDelete(docId: string) {
    try {
      await fetch('/api/declarations/upload-document', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, document_id: docId }),
      })
      onRemoved(docId)
    } catch { toast.error('Error al eliminar') }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <FileText className="w-5 h-5 text-[#F2A900]" />
        <h3 className="font-semibold text-gray-900">Documentos — Declaración {djNumber}</h3>
      </div>
      <p className="text-sm text-gray-500">
        Suba los documentos relacionados con esta declaración (actas de nacimiento, identificaciones, etc.).
        <span className="font-medium"> Este paso es opcional</span> — puede subirlos ahora o más adelante.
      </p>

      {docs.length > 0 && (
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50">
              <FileText className="w-4 h-4 text-gray-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{doc.name}</p>
                <p className="text-xs text-gray-400">{(doc.file_size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
              <button onClick={() => handleDelete(doc.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 border-dashed border-gray-300 text-sm font-medium text-gray-600 hover:border-[#F2A900] hover:text-[#F2A900] transition-colors disabled:opacity-60"
      >
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {uploading ? 'Subiendo...' : 'Subir documento PDF'}
      </button>
      <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleUpload} />
    </div>
  )
}

// ══ STEP 5: FINAL ══════════════════════════════════════════════════

function FinalStep({ djNumber, state, onEditStep }: {
  djNumber: number
  state: DJState
  onEditStep: (step: number) => void
}) {
  const validWitnesses = state.witnesses.filter(w => w.name.trim())

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-gray-900">Revisión — Declaración del Hijo/a {djNumber}</h3>
        <p className="text-sm text-gray-500 mt-1">Verifique la información antes de enviar al abogado.</p>
      </div>

      {/* Basic info summary */}
      <ReviewCard title="Información Básica" onEdit={() => onEditStep(0)}>
        {state.minorBasic.full_name && <p className="text-sm text-gray-700"><span className="font-medium">Nombre:</span> {state.minorBasic.full_name}</p>}
        {state.minorBasic.dob && <p className="text-sm text-gray-700"><span className="font-medium">Fecha nac.:</span> {state.minorBasic.dob}</p>}
        {state.minorBasic.country && <p className="text-sm text-gray-700"><span className="font-medium">País:</span> {state.minorBasic.country}</p>}
        {state.minorBasic.lives_with && <p className="text-sm text-gray-700"><span className="font-medium">Vive con:</span> {state.minorBasic.lives_with}</p>}
      </ReviewCard>

      {/* Abuse summary */}
      <ReviewCard title="Hechos de Maltrato" onEdit={() => onEditStep(1)}>
        {state.minorAbuse.abuse_by_father && (
          <p className="text-sm text-gray-700">
            <span className="font-medium">Abuso por padre:</span>{' '}
            {state.minorAbuse.abuse_by_father.slice(0, 150)}{state.minorAbuse.abuse_by_father.length > 150 ? '...' : ''}
          </p>
        )}
        {state.minorAbuse.abuse_by_mother && (
          <p className="text-sm text-gray-700">
            <span className="font-medium">Abuso por madre:</span>{' '}
            {state.minorAbuse.abuse_by_mother.slice(0, 150)}{state.minorAbuse.abuse_by_mother.length > 150 ? '...' : ''}
          </p>
        )}
      </ReviewCard>

      {/* Best interest summary */}
      <ReviewCard title="Mejor Interés" onEdit={() => onEditStep(2)}>
        {state.minorBestInterest.fear_of_return && (
          <p className="text-sm text-gray-700">
            <span className="font-medium">Miedo de regresar:</span>{' '}
            {state.minorBestInterest.fear_of_return.slice(0, 150)}{state.minorBestInterest.fear_of_return.length > 150 ? '...' : ''}
          </p>
        )}
        {state.minorBestInterest.wants_to_stay && <p className="text-sm text-gray-700"><span className="font-medium">Desea quedarse:</span> {state.minorBestInterest.wants_to_stay}</p>}
      </ReviewCard>

      {/* Witnesses summary */}
      <ReviewCard title={`Testigos (${validWitnesses.length})`} onEdit={() => onEditStep(3)}>
        {validWitnesses.map((w, i) => (
          <p key={i} className="text-sm text-gray-700">{w.name} — <span className="text-gray-500">{w.relationship}</span></p>
        ))}
      </ReviewCard>

      <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
        <p className="text-xs text-blue-700">
          Al enviar, Henry recibirá toda la información de esta declaración para revisarla.
          Podrás ver el estado de aprobación en la pantalla principal.
        </p>
      </div>
    </div>
  )
}

function ReviewCard({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-xl border border-gray-200">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-semibold text-gray-700">{title}</span>
        <button onClick={onEdit} className="text-xs text-[#F2A900] hover:underline">Editar</button>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

// ══ SHARED UI ══════════════════════════════════════════════════════

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {children} {required && <span className="text-red-500">*</span>}
    </label>
  )
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]/50 focus:border-[#F2A900]" />
  )
}

function TextArea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]/50 focus:border-[#F2A900] resize-none" />
  )
}
