'use client'

import { useState } from 'react'
import { Sparkles, FileText, Loader2, CheckCircle, Clock, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
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
import type { SijGenerationInput, SijDocumentType } from '@/lib/ai/prompts/sij-affidavit'

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

const STATUS_LABELS: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  draft: { label: 'Borrador', color: 'bg-gray-100 text-gray-600', icon: Clock },
  submitted: { label: 'Enviado', color: 'bg-blue-100 text-blue-700', icon: Clock },
  reviewed: { label: 'Revisado', color: 'bg-purple-100 text-purple-700', icon: CheckCircle },
  needs_correction: { label: 'Requiere Correcciones', color: 'bg-orange-100 text-orange-700', icon: AlertCircle },
  approved: { label: 'Aprobado', color: 'bg-green-100 text-green-700', icon: CheckCircle },
}

export function SijFormSection({ token, submissions, clientName, minorData }: SijFormSectionProps) {
  const [showForm, setShowForm] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generatedDoc, setGeneratedDoc] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<SijDocumentType | ''>('')

  // Form state - pre-filled where possible
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
    tone: 'professional' as 'professional' | 'strong' | 'persuasive',
    language: 'en' as 'en' | 'es',
  })

  function updateField(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleGenerate() {
    if (!selectedType) {
      toast.error('Selecciona un tipo de documento')
      return
    }
    if (!form.minor_full_name || !form.declarant_full_name || !form.absent_parent_full_name || !form.key_facts) {
      toast.error('Completa los campos requeridos')
      return
    }

    setGenerating(true)
    setGeneratedDoc(null)

    try {
      const input: SijGenerationInput = {
        document_type: selectedType,
        minor_full_name: form.minor_full_name,
        minor_dob: form.minor_dob,
        minor_country_of_birth: form.minor_country_of_birth,
        declarant_full_name: form.declarant_full_name,
        declarant_relationship: form.declarant_relationship,
        declarant_nationality: form.declarant_nationality || undefined,
        declarant_residence: form.declarant_residence || undefined,
        mother_full_name: form.mother_full_name || undefined,
        absent_parent_full_name: form.absent_parent_full_name,
        absent_parent_nationality: form.absent_parent_nationality || undefined,
        absent_parent_residence: form.absent_parent_residence || undefined,
        key_facts: form.key_facts,
        separation_age: form.separation_age || undefined,
        family_support_details: form.family_support_details || undefined,
        tone: form.tone,
        language: form.language,
      }

      const res = await fetch('/api/ai/generate-sij-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, input }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al generar')
      }

      const data = await res.json()
      setGeneratedDoc(data.document)
      toast.success('Documento generado exitosamente')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al generar documento')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-[#F2A900]" />
        <h2 className="text-lg font-bold text-gray-900">Formularios SIJ (Visa Juvenil)</h2>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Complete la informacion y nuestro sistema generara automaticamente los documentos legales para su caso.
      </p>

      {/* Previously generated documents */}
      {submissions.length > 0 && (
        <div className="space-y-2 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Documentos generados</h3>
          {submissions.map(sub => {
            const docType = SIJ_DOCUMENT_TYPES.find(d => d.id === sub.form_type)
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
      )}

      {/* Toggle form */}
      <Button
        variant="outline"
        className="w-full border-dashed border-2 border-[#F2A900]/50 text-[#002855] hover:bg-amber-50"
        onClick={() => { setShowForm(!showForm); setGeneratedDoc(null) }}
      >
        {showForm ? <ChevronUp className="w-4 h-4 mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
        {showForm ? 'Cerrar formulario' : 'Generar nuevo documento'}
      </Button>

      {showForm && (
        <div className="mt-6 space-y-6">
          {/* Document type selector */}
          <div className="space-y-1.5">
            <Label className="font-semibold">Tipo de Documento *</Label>
            <Select value={selectedType} onValueChange={v => setSelectedType(v as SijDocumentType)}>
              <SelectTrigger><SelectValue placeholder="Selecciona el tipo de documento" /></SelectTrigger>
              <SelectContent>
                {SIJ_DOCUMENT_TYPES.map(dt => (
                  <SelectItem key={dt.id} value={dt.id}>{dt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Minor info */}
          <fieldset className="space-y-3 p-4 bg-blue-50/50 rounded-xl">
            <legend className="text-sm font-semibold text-[#002855] px-1">Informacion del Menor</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nombre completo *</Label>
                <Input value={form.minor_full_name} onChange={e => updateField('minor_full_name', e.target.value)} placeholder="Nombre completo del menor" />
              </div>
              <div>
                <Label className="text-xs">Fecha de nacimiento</Label>
                <Input type="date" value={form.minor_dob} onChange={e => updateField('minor_dob', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Pais de nacimiento</Label>
                <Input value={form.minor_country_of_birth} onChange={e => updateField('minor_country_of_birth', e.target.value)} placeholder="Ej: Honduras, Guatemala, Cuba..." />
              </div>
            </div>
          </fieldset>

          {/* Declarant info */}
          <fieldset className="space-y-3 p-4 bg-amber-50/50 rounded-xl">
            <legend className="text-sm font-semibold text-[#002855] px-1">Quien Declara (Declarante)</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nombre completo *</Label>
                <Input value={form.declarant_full_name} onChange={e => updateField('declarant_full_name', e.target.value)} placeholder="Nombre del declarante" />
              </div>
              <div>
                <Label className="text-xs">Relacion con el menor *</Label>
                <Input value={form.declarant_relationship} onChange={e => updateField('declarant_relationship', e.target.value)} placeholder="Ej: Madre, Abuelo, Tia..." />
              </div>
              <div>
                <Label className="text-xs">Nacionalidad</Label>
                <Input value={form.declarant_nationality} onChange={e => updateField('declarant_nationality', e.target.value)} placeholder="Nacionalidad" />
              </div>
              <div>
                <Label className="text-xs">Residencia actual</Label>
                <Input value={form.declarant_residence} onChange={e => updateField('declarant_residence', e.target.value)} placeholder="Ej: United States, Honduras..." />
              </div>
            </div>
          </fieldset>

          {/* Parent info */}
          <fieldset className="space-y-3 p-4 bg-red-50/30 rounded-xl">
            <legend className="text-sm font-semibold text-[#002855] px-1">Padres</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nombre de la madre</Label>
                <Input value={form.mother_full_name} onChange={e => updateField('mother_full_name', e.target.value)} placeholder="Nombre completo de la madre" />
              </div>
              <div>
                <Label className="text-xs">Nombre del padre/madre ausente *</Label>
                <Input value={form.absent_parent_full_name} onChange={e => updateField('absent_parent_full_name', e.target.value)} placeholder="Nombre del progenitor ausente" />
              </div>
              <div>
                <Label className="text-xs">Nacionalidad del ausente</Label>
                <Input value={form.absent_parent_nationality} onChange={e => updateField('absent_parent_nationality', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Residencia del ausente</Label>
                <Input value={form.absent_parent_residence} onChange={e => updateField('absent_parent_residence', e.target.value)} />
              </div>
            </div>
          </fieldset>

          {/* Key facts */}
          <fieldset className="space-y-3 p-4 bg-green-50/50 rounded-xl">
            <legend className="text-sm font-semibold text-[#002855] px-1">Hechos del Caso</legend>
            <div>
              <Label className="text-xs">Hechos clave del abandono/negligencia *</Label>
              <Textarea
                value={form.key_facts}
                onChange={e => updateField('key_facts', e.target.value)}
                rows={5}
                placeholder="Describa los hechos principales: cuando abandono el padre, que tipo de abandono (economico, emocional), como afecto al menor, quien asumio el cuidado..."
              />
              <p className="text-[10px] text-gray-400 mt-1">Escriba en español o inglés. El sistema interpreta ambos idiomas.</p>
            </div>
            <div>
              <Label className="text-xs">Edad del menor cuando ocurrio la separacion</Label>
              <Input value={form.separation_age} onChange={e => updateField('separation_age', e.target.value)} placeholder="Ej: 1 año, 3 años, desde el nacimiento..." />
            </div>
            <div>
              <Label className="text-xs">Apoyo familiar especifico</Label>
              <Textarea
                value={form.family_support_details}
                onChange={e => updateField('family_support_details', e.target.value)}
                rows={3}
                placeholder="Quien cuido al menor, quien lo llevaba al hospital, quien pagaba ropa y escuela, quien enviaba dinero desde EE.UU..."
              />
            </div>
          </fieldset>

          {/* Options */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Tono del documento</Label>
              <Select value={form.tone} onValueChange={v => updateField('tone', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Profesional</SelectItem>
                  <SelectItem value="strong">Fuerte y convincente</SelectItem>
                  <SelectItem value="persuasive">Narrativo persuasivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Idioma de salida</Label>
              <Select value={form.language} onValueChange={v => updateField('language', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">Ingles (recomendado)</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Generate button */}
          <Button
            className="w-full bg-gradient-to-r from-[#002855] to-[#003d80] hover:from-[#001d3d] hover:to-[#002855] text-white h-12 text-base"
            disabled={generating}
            onClick={handleGenerate}
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Generando documento con IA...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Generar Documento
              </>
            )}
          </Button>

          {/* Generated document preview */}
          {generatedDoc && (
            <div className="mt-6 border-2 border-green-200 rounded-xl overflow-hidden">
              <div className="bg-green-50 px-4 py-3 flex items-center gap-2 border-b border-green-200">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <h3 className="text-sm font-semibold text-green-800">Documento Generado</h3>
              </div>
              <div className="p-4 bg-white max-h-[500px] overflow-y-auto">
                <pre className="text-sm text-gray-800 whitespace-pre-wrap font-serif leading-relaxed">
                  {generatedDoc}
                </pre>
              </div>
              <div className="bg-gray-50 px-4 py-3 border-t flex justify-between items-center">
                <p className="text-xs text-gray-500">
                  Su consultor revisara este documento antes de finalizar.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedDoc)
                    toast.success('Copiado al portapapeles')
                  }}
                >
                  Copiar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
