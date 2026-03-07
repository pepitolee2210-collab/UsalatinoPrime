'use client'

import { useState } from 'react'
import { Sparkles, FileText, Loader2, CheckCircle, Clock, AlertCircle, ChevronDown, ChevronUp, Shield, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { SIJ_DOCUMENT_TYPES } from '@/lib/ai/prompts/sij-affidavit'
import { CREDIBLE_FEAR_DOCUMENT_TYPES } from '@/lib/ai/prompts/credible-fear'
import { WITNESS_DOCUMENT_TYPES } from '@/lib/ai/prompts/witness-testimony'

interface FormSubmission {
  id: string
  form_type: string
  status: string
  updated_at: string
}

interface SijFormSectionProps {
  token: string
  submissions: FormSubmission[]
  clientName: string
  minorData?: {
    minor_full_name?: string
    minor_dob?: string
    minor_country_of_birth?: string
    mother_full_name?: string
  }
}

type AgentTab = 'sij' | 'credible_fear' | 'witness'

const AGENT_TABS = [
  { id: 'sij' as AgentTab, label: 'Declaraciones SIJ', icon: FileText, color: 'text-blue-600' },
  { id: 'credible_fear' as AgentTab, label: 'Miedo Creible', icon: Shield, color: 'text-red-600' },
  { id: 'witness' as AgentTab, label: 'Testimonios', icon: Users, color: 'text-green-600' },
]

const STATUS_LABELS: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  draft: { label: 'Borrador', color: 'bg-gray-100 text-gray-600', icon: Clock },
  submitted: { label: 'Enviado', color: 'bg-blue-100 text-blue-700', icon: Clock },
  reviewed: { label: 'Revisado', color: 'bg-purple-100 text-purple-700', icon: CheckCircle },
  needs_correction: { label: 'Requiere Correcciones', color: 'bg-orange-100 text-orange-700', icon: AlertCircle },
  approved: { label: 'Aprobado', color: 'bg-green-100 text-green-700', icon: CheckCircle },
}

const ALL_DOC_TYPES = [
  ...SIJ_DOCUMENT_TYPES.map(d => ({ ...d, agent: 'sij' as AgentTab })),
  ...CREDIBLE_FEAR_DOCUMENT_TYPES.map(d => ({ ...d, agent: 'credible_fear' as AgentTab })),
  ...WITNESS_DOCUMENT_TYPES.map(d => ({ ...d, agent: 'witness' as AgentTab })),
]

export function SijFormSection({ token, submissions, clientName, minorData }: SijFormSectionProps) {
  const [activeAgent, setActiveAgent] = useState<AgentTab>('sij')
  const [showForm, setShowForm] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generatedDoc, setGeneratedDoc] = useState<string | null>(null)

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-[#F2A900]" />
        <h2 className="text-lg font-bold text-gray-900">Generador de Documentos con IA</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Complete la informacion y nuestro sistema generara automaticamente los documentos legales para su caso.
      </p>

      {/* Agent tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
        {AGENT_TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveAgent(tab.id); setShowForm(false); setGeneratedDoc(null) }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                activeAgent === tab.id
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${activeAgent === tab.id ? tab.color : ''}`} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Previously generated documents for this agent */}
      <SubmissionsList submissions={submissions} agent={activeAgent} />

      {/* Toggle form */}
      <Button
        variant="outline"
        className="w-full border-dashed border-2 border-[#F2A900]/50 text-[#002855] hover:bg-amber-50 mt-4"
        onClick={() => { setShowForm(!showForm); setGeneratedDoc(null) }}
      >
        {showForm ? <ChevronUp className="w-4 h-4 mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
        {showForm ? 'Cerrar formulario' : 'Generar nuevo documento'}
      </Button>

      {showForm && activeAgent === 'sij' && (
        <SijForm token={token} minorData={minorData} generating={generating} setGenerating={setGenerating} generatedDoc={generatedDoc} setGeneratedDoc={setGeneratedDoc} />
      )}
      {showForm && activeAgent === 'credible_fear' && (
        <CredibleFearForm token={token} clientName={clientName} generating={generating} setGenerating={setGenerating} generatedDoc={generatedDoc} setGeneratedDoc={setGeneratedDoc} />
      )}
      {showForm && activeAgent === 'witness' && (
        <WitnessForm token={token} minorData={minorData} clientName={clientName} generating={generating} setGenerating={setGenerating} generatedDoc={generatedDoc} setGeneratedDoc={setGeneratedDoc} />
      )}
    </div>
  )
}

// === Submissions list ===
function SubmissionsList({ submissions, agent }: { submissions: FormSubmission[]; agent: AgentTab }) {
  const agentSubs = submissions.filter(s => s.form_type.startsWith(`${agent}_`) || (!s.form_type.includes('_') && agent === 'sij'))
  if (agentSubs.length === 0) return null

  return (
    <div className="space-y-2 mb-4">
      <h3 className="text-sm font-semibold text-gray-700">Documentos generados</h3>
      {agentSubs.map(sub => {
        const docType = ALL_DOC_TYPES.find(d => sub.form_type.endsWith(d.id))
        const statusInfo = STATUS_LABELS[sub.status] || STATUS_LABELS.draft
        const StatusIcon = statusInfo.icon
        return (
          <div key={sub.id} className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">{docType?.label || sub.form_type}</p>
                <p className="text-xs text-gray-400">
                  {new Date(sub.updated_at).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>
            <Badge className={statusInfo.color}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusInfo.label}
            </Badge>
          </div>
        )
      })}
    </div>
  )
}

// === Shared props for forms ===
interface FormProps {
  token: string
  generating: boolean
  setGenerating: (v: boolean) => void
  generatedDoc: string | null
  setGeneratedDoc: (v: string | null) => void
}

// === Generate button + preview (shared) ===
function GenerateSection({ generating, generatedDoc, onGenerate }: {
  generating: boolean
  generatedDoc: string | null
  onGenerate: () => void
}) {
  return (
    <>
      <Button
        className="w-full bg-gradient-to-r from-[#002855] to-[#003d80] hover:from-[#001d3d] hover:to-[#002855] text-white h-12 text-base"
        disabled={generating}
        onClick={onGenerate}
      >
        {generating ? (
          <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Generando documento con IA...</>
        ) : (
          <><Sparkles className="w-5 h-5 mr-2" />Generar Documento</>
        )}
      </Button>

      {generatedDoc && (
        <div className="mt-6 border-2 border-green-200 rounded-xl overflow-hidden">
          <div className="bg-green-50 px-4 py-3 flex items-center gap-2 border-b border-green-200">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <h3 className="text-sm font-semibold text-green-800">Documento Generado</h3>
          </div>
          <div className="p-4 bg-white max-h-[500px] overflow-y-auto">
            <pre className="text-sm text-gray-800 whitespace-pre-wrap font-serif leading-relaxed">{generatedDoc}</pre>
          </div>
          <div className="bg-gray-50 px-4 py-3 border-t flex justify-between items-center">
            <p className="text-xs text-gray-500">Su consultor revisara este documento.</p>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(generatedDoc); toast.success('Copiado') }}>
              Copiar
            </Button>
          </div>
        </div>
      )}
    </>
  )
}

// === SIJ FORM ===
function SijForm({ token, minorData, generating, setGenerating, generatedDoc, setGeneratedDoc }: FormProps & { minorData?: SijFormSectionProps['minorData'] }) {
  const [selectedType, setSelectedType] = useState('')
  const [form, setForm] = useState({
    minor_full_name: minorData?.minor_full_name || '',
    minor_dob: minorData?.minor_dob || '',
    minor_country_of_birth: minorData?.minor_country_of_birth || '',
    declarant_full_name: '',
    declarant_relationship: '',
    declarant_nationality: '',
    declarant_residence: '',
    mother_full_name: minorData?.mother_full_name || '',
    absent_parent_full_name: '',
    absent_parent_nationality: '',
    absent_parent_residence: '',
    key_facts: '',
    separation_age: '',
    family_support_details: '',
    tone: 'professional',
    language: 'en',
  })
  const u = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  async function handleGenerate() {
    if (!selectedType) { toast.error('Selecciona un tipo de documento'); return }
    if (!form.minor_full_name || !form.declarant_full_name || !form.absent_parent_full_name || !form.key_facts) {
      toast.error('Completa los campos requeridos'); return
    }
    setGenerating(true); setGeneratedDoc(null)
    try {
      const res = await fetch('/api/ai/generate-sij-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, agent: 'sij', input: { document_type: selectedType, ...form } }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      setGeneratedDoc(data.document)
      toast.success('Documento generado')
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error') }
    finally { setGenerating(false) }
  }

  return (
    <div className="mt-6 space-y-5">
      <div className="space-y-1.5">
        <Label className="font-semibold">Tipo de Documento *</Label>
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
          <SelectContent>
            {SIJ_DOCUMENT_TYPES.map(dt => <SelectItem key={dt.id} value={dt.id}>{dt.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <fieldset className="space-y-3 p-4 bg-blue-50/50 rounded-xl">
        <legend className="text-sm font-semibold text-[#002855] px-1">Menor</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label className="text-xs">Nombre completo *</Label><Input value={form.minor_full_name} onChange={e => u('minor_full_name', e.target.value)} /></div>
          <div><Label className="text-xs">Fecha de nacimiento</Label><Input type="date" value={form.minor_dob} onChange={e => u('minor_dob', e.target.value)} /></div>
          <div className="sm:col-span-2"><Label className="text-xs">Pais de nacimiento</Label><Input value={form.minor_country_of_birth} onChange={e => u('minor_country_of_birth', e.target.value)} /></div>
        </div>
      </fieldset>
      <fieldset className="space-y-3 p-4 bg-amber-50/50 rounded-xl">
        <legend className="text-sm font-semibold text-[#002855] px-1">Declarante</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label className="text-xs">Nombre completo *</Label><Input value={form.declarant_full_name} onChange={e => u('declarant_full_name', e.target.value)} /></div>
          <div><Label className="text-xs">Relacion con el menor *</Label><Input value={form.declarant_relationship} onChange={e => u('declarant_relationship', e.target.value)} placeholder="Madre, Abuelo, Tia..." /></div>
          <div><Label className="text-xs">Nacionalidad</Label><Input value={form.declarant_nationality} onChange={e => u('declarant_nationality', e.target.value)} /></div>
          <div><Label className="text-xs">Residencia actual</Label><Input value={form.declarant_residence} onChange={e => u('declarant_residence', e.target.value)} /></div>
        </div>
      </fieldset>
      <fieldset className="space-y-3 p-4 bg-red-50/30 rounded-xl">
        <legend className="text-sm font-semibold text-[#002855] px-1">Padres</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label className="text-xs">Nombre de la madre</Label><Input value={form.mother_full_name} onChange={e => u('mother_full_name', e.target.value)} /></div>
          <div><Label className="text-xs">Padre/madre ausente *</Label><Input value={form.absent_parent_full_name} onChange={e => u('absent_parent_full_name', e.target.value)} /></div>
          <div><Label className="text-xs">Nacionalidad del ausente</Label><Input value={form.absent_parent_nationality} onChange={e => u('absent_parent_nationality', e.target.value)} /></div>
          <div><Label className="text-xs">Residencia del ausente</Label><Input value={form.absent_parent_residence} onChange={e => u('absent_parent_residence', e.target.value)} /></div>
        </div>
      </fieldset>
      <fieldset className="space-y-3 p-4 bg-green-50/50 rounded-xl">
        <legend className="text-sm font-semibold text-[#002855] px-1">Hechos del Caso</legend>
        <div><Label className="text-xs">Hechos clave *</Label><Textarea value={form.key_facts} onChange={e => u('key_facts', e.target.value)} rows={5} placeholder="Describa los hechos del abandono/negligencia..." /><p className="text-[10px] text-gray-400 mt-1">Escriba en español o ingles.</p></div>
        <div><Label className="text-xs">Edad al momento de la separacion</Label><Input value={form.separation_age} onChange={e => u('separation_age', e.target.value)} placeholder="Ej: 1 año, desde el nacimiento..." /></div>
        <div><Label className="text-xs">Apoyo familiar especifico</Label><Textarea value={form.family_support_details} onChange={e => u('family_support_details', e.target.value)} rows={3} placeholder="Quien cuido al menor, quien pagaba escuela..." /></div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Tono</Label><Select value={form.tone} onValueChange={v => u('tone', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="professional">Profesional</SelectItem><SelectItem value="strong">Fuerte</SelectItem><SelectItem value="persuasive">Persuasivo</SelectItem></SelectContent></Select></div>
        <div><Label className="text-xs">Idioma</Label><Select value={form.language} onValueChange={v => u('language', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="en">Ingles</SelectItem><SelectItem value="es">Español</SelectItem></SelectContent></Select></div>
      </div>
      <GenerateSection generating={generating} generatedDoc={generatedDoc} onGenerate={handleGenerate} />
    </div>
  )
}

// === CREDIBLE FEAR FORM ===
function CredibleFearForm({ token, clientName, generating, setGenerating, generatedDoc, setGeneratedDoc }: FormProps & { clientName: string }) {
  const [selectedType, setSelectedType] = useState('')
  const [form, setForm] = useState({
    applicant_full_name: clientName,
    applicant_dob: '',
    country_of_origin: '',
    city_or_region: '',
    who_harmed: '',
    what_happened: '',
    when_happened: '',
    why_persecuted: '',
    self_protection_attempts: '',
    reported_to_authorities: '',
    authority_response: '',
    why_cannot_return: '',
    consequences: '',
    witnesses_or_evidence: '',
    tone: 'clear',
    output_language: 'es',
  })
  const u = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  async function handleGenerate() {
    if (!selectedType) { toast.error('Selecciona un tipo de documento'); return }
    if (!form.applicant_full_name || !form.country_of_origin || !form.who_harmed || !form.what_happened || !form.why_cannot_return) {
      toast.error('Completa los campos requeridos'); return
    }
    setGenerating(true); setGeneratedDoc(null)
    try {
      const res = await fetch('/api/ai/generate-sij-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, agent: 'credible_fear', input: { document_type: selectedType, ...form } }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      setGeneratedDoc(data.document)
      toast.success('Documento generado')
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error') }
    finally { setGenerating(false) }
  }

  return (
    <div className="mt-6 space-y-5">
      <div className="space-y-1.5">
        <Label className="font-semibold">Tipo de Documento *</Label>
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
          <SelectContent>
            {CREDIBLE_FEAR_DOCUMENT_TYPES.map(dt => <SelectItem key={dt.id} value={dt.id}>{dt.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <fieldset className="space-y-3 p-4 bg-red-50/50 rounded-xl">
        <legend className="text-sm font-semibold text-[#002855] px-1">Solicitante</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label className="text-xs">Nombre completo *</Label><Input value={form.applicant_full_name} onChange={e => u('applicant_full_name', e.target.value)} /></div>
          <div><Label className="text-xs">Fecha de nacimiento</Label><Input type="date" value={form.applicant_dob} onChange={e => u('applicant_dob', e.target.value)} /></div>
          <div><Label className="text-xs">Pais de origen *</Label><Input value={form.country_of_origin} onChange={e => u('country_of_origin', e.target.value)} placeholder="Honduras, Guatemala..." /></div>
          <div><Label className="text-xs">Ciudad o region</Label><Input value={form.city_or_region} onChange={e => u('city_or_region', e.target.value)} /></div>
        </div>
      </fieldset>
      <fieldset className="space-y-3 p-4 bg-orange-50/50 rounded-xl">
        <legend className="text-sm font-semibold text-[#002855] px-1">Hechos de Persecucion</legend>
        <div><Label className="text-xs">Quien le hizo daño *</Label><Input value={form.who_harmed} onChange={e => u('who_harmed', e.target.value)} placeholder="Pandillas, ex pareja, crimen organizado..." /></div>
        <div><Label className="text-xs">Que paso *</Label><Textarea value={form.what_happened} onChange={e => u('what_happened', e.target.value)} rows={5} placeholder="Describa lo que ocurrio con el mayor detalle posible..." /><p className="text-[10px] text-gray-400 mt-1">Escriba libremente. El sistema organiza y limpia la redaccion.</p></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label className="text-xs">Cuando paso</Label><Input value={form.when_happened} onChange={e => u('when_happened', e.target.value)} placeholder="Fechas o periodos aproximados" /></div>
          <div><Label className="text-xs">Por que cree que fue perseguido</Label><Input value={form.why_persecuted} onChange={e => u('why_persecuted', e.target.value)} /></div>
        </div>
        <div><Label className="text-xs">Que hizo para protegerse</Label><Input value={form.self_protection_attempts} onChange={e => u('self_protection_attempts', e.target.value)} placeholder="Se mudo, huyo, escondio a familiares..." /></div>
      </fieldset>
      <fieldset className="space-y-3 p-4 bg-blue-50/50 rounded-xl">
        <legend className="text-sm font-semibold text-[#002855] px-1">Autoridades y Consecuencias</legend>
        <div><Label className="text-xs">Denuncio a las autoridades?</Label><Input value={form.reported_to_authorities} onChange={e => u('reported_to_authorities', e.target.value)} placeholder="Si/No - donde acudio" /></div>
        <div><Label className="text-xs">Que respuesta recibio</Label><Input value={form.authority_response} onChange={e => u('authority_response', e.target.value)} placeholder="Indiferencia, corrupcion, no hicieron nada..." /></div>
        <div><Label className="text-xs">Consecuencias sufridas</Label><Textarea value={form.consequences} onChange={e => u('consequences', e.target.value)} rows={2} placeholder="Lesiones, miedo, perdida de trabajo, desplazamiento..." /></div>
        <div><Label className="text-xs">Por que no puede regresar *</Label><Textarea value={form.why_cannot_return} onChange={e => u('why_cannot_return', e.target.value)} rows={3} placeholder="Que pasaria si regresa a su pais hoy..." /></div>
      </fieldset>
      <div><Label className="text-xs">Testigos o evidencia</Label><Textarea value={form.witnesses_or_evidence} onChange={e => u('witnesses_or_evidence', e.target.value)} rows={2} placeholder="Familiares, fotos, mensajes, denuncias..." /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Tono</Label><Select value={form.tone} onValueChange={v => u('tone', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="clear">Claro y creible</SelectItem><SelectItem value="strong">Fuerte y detallado</SelectItem><SelectItem value="ordered">Cronologico</SelectItem></SelectContent></Select></div>
        <div><Label className="text-xs">Idioma</Label><Select value={form.output_language} onValueChange={v => u('output_language', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="es">Español</SelectItem><SelectItem value="en">Ingles</SelectItem></SelectContent></Select></div>
      </div>
      <GenerateSection generating={generating} generatedDoc={generatedDoc} onGenerate={handleGenerate} />
    </div>
  )
}

// === WITNESS FORM ===
function WitnessForm({ token, minorData, clientName, generating, setGenerating, generatedDoc, setGeneratedDoc }: FormProps & { minorData?: SijFormSectionProps['minorData']; clientName: string }) {
  const [selectedType, setSelectedType] = useState('')
  const [form, setForm] = useState({
    subject_full_name: minorData?.minor_full_name || clientName,
    subject_dob: minorData?.minor_dob || '',
    subject_country_of_birth: minorData?.minor_country_of_birth || '',
    witness_full_name: '',
    witness_relationship: '',
    witness_nationality: '',
    witness_residence: '',
    absent_person_or_persecutor: '',
    what_happened: '',
    since_when: '',
    what_witness_observed: '',
    how_witness_helped: '',
    concrete_examples: '',
    tone: 'clear',
    output_language: 'en',
  })
  const u = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  async function handleGenerate() {
    if (!selectedType) { toast.error('Selecciona un tipo de documento'); return }
    if (!form.subject_full_name || !form.witness_full_name || !form.witness_relationship || !form.what_happened || !form.what_witness_observed) {
      toast.error('Completa los campos requeridos'); return
    }
    setGenerating(true); setGeneratedDoc(null)
    try {
      const res = await fetch('/api/ai/generate-sij-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, agent: 'witness', input: { document_type: selectedType, ...form } }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      setGeneratedDoc(data.document)
      toast.success('Documento generado')
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error') }
    finally { setGenerating(false) }
  }

  return (
    <div className="mt-6 space-y-5">
      <div className="space-y-1.5">
        <Label className="font-semibold">Tipo de Documento *</Label>
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
          <SelectContent>
            {WITNESS_DOCUMENT_TYPES.map(dt => <SelectItem key={dt.id} value={dt.id}>{dt.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <fieldset className="space-y-3 p-4 bg-blue-50/50 rounded-xl">
        <legend className="text-sm font-semibold text-[#002855] px-1">Menor o Solicitante</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label className="text-xs">Nombre completo *</Label><Input value={form.subject_full_name} onChange={e => u('subject_full_name', e.target.value)} /></div>
          <div><Label className="text-xs">Fecha de nacimiento</Label><Input type="date" value={form.subject_dob} onChange={e => u('subject_dob', e.target.value)} /></div>
          <div className="sm:col-span-2"><Label className="text-xs">Pais de origen</Label><Input value={form.subject_country_of_birth} onChange={e => u('subject_country_of_birth', e.target.value)} /></div>
        </div>
      </fieldset>
      <fieldset className="space-y-3 p-4 bg-green-50/50 rounded-xl">
        <legend className="text-sm font-semibold text-[#002855] px-1">Testigo</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label className="text-xs">Nombre completo *</Label><Input value={form.witness_full_name} onChange={e => u('witness_full_name', e.target.value)} /></div>
          <div><Label className="text-xs">Relacion *</Label><Input value={form.witness_relationship} onChange={e => u('witness_relationship', e.target.value)} placeholder="Madre, Abuelo, Tia, Vecino..." /></div>
          <div><Label className="text-xs">Nacionalidad</Label><Input value={form.witness_nationality} onChange={e => u('witness_nationality', e.target.value)} /></div>
          <div><Label className="text-xs">Residencia actual</Label><Input value={form.witness_residence} onChange={e => u('witness_residence', e.target.value)} /></div>
        </div>
      </fieldset>
      <fieldset className="space-y-3 p-4 bg-amber-50/50 rounded-xl">
        <legend className="text-sm font-semibold text-[#002855] px-1">Hechos</legend>
        <div><Label className="text-xs">Padre/madre ausente o perseguidor</Label><Input value={form.absent_person_or_persecutor} onChange={e => u('absent_person_or_persecutor', e.target.value)} /></div>
        <div><Label className="text-xs">Que ocurrio *</Label><Textarea value={form.what_happened} onChange={e => u('what_happened', e.target.value)} rows={3} placeholder="Hechos principales del abandono, violencia o persecucion..." /></div>
        <div><Label className="text-xs">Desde cuando</Label><Input value={form.since_when} onChange={e => u('since_when', e.target.value)} placeholder="Ej: desde el nacimiento, hace 5 años..." /></div>
        <div><Label className="text-xs">Que observo el testigo *</Label><Textarea value={form.what_witness_observed} onChange={e => u('what_witness_observed', e.target.value)} rows={3} placeholder="Lo que el testigo vio personalmente..." /></div>
        <div><Label className="text-xs">Como ayudo el testigo</Label><Textarea value={form.how_witness_helped} onChange={e => u('how_witness_helped', e.target.value)} rows={2} placeholder="Enviaba dinero, compraba ropa, cuidaba al menor..." /></div>
        <div><Label className="text-xs">Ejemplos concretos</Label><Textarea value={form.concrete_examples} onChange={e => u('concrete_examples', e.target.value)} rows={2} placeholder="Nunca vi que el padre pagara escuela, lo llevabamos al hospital..." /></div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Tono</Label><Select value={form.tone} onValueChange={v => u('tone', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="clear">Claro y creible</SelectItem><SelectItem value="convincing">Convincente</SelectItem><SelectItem value="professional">Profesional para juez</SelectItem></SelectContent></Select></div>
        <div><Label className="text-xs">Idioma</Label><Select value={form.output_language} onValueChange={v => u('output_language', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="en">Ingles</SelectItem><SelectItem value="es">Español</SelectItem></SelectContent></Select></div>
      </div>
      <GenerateSection generating={generating} generatedDoc={generatedDoc} onGenerate={handleGenerate} />
    </div>
  )
}
