'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { ChevronDown, ChevronUp, CheckCircle, Loader2 } from 'lucide-react'

const sections = [
  { id: 1, title: 'Datos de la Madre (quien firma)' },
  { id: 2, title: 'Datos de la Hija' },
  { id: 3, title: 'Datos del Padre' },
]

export default function RenunciaFormPage() {
  // Section 1: Datos de la Madre
  const [madreNombre, setMadreNombre] = useState('')
  const [madreNacionalidad, setMadreNacionalidad] = useState('')
  const [madreDni, setMadreDni] = useState('')
  const [madreDireccion, setMadreDireccion] = useState('')

  // Section 2: Datos de la Hija
  const [hijaNombre, setHijaNombre] = useState('')
  const [hijaFechaNacimiento, setHijaFechaNacimiento] = useState('')
  const [hijaMunicipio, setHijaMunicipio] = useState('')

  // Section 3: Datos del Padre
  const [padreNombre, setPadreNombre] = useState('')
  const [padrePasaporte, setPadrePasaporte] = useState('')
  const [padreResidencia, setPadreResidencia] = useState('')
  const [padreDireccionHija, setPadreDireccionHija] = useState('')

  const [openSections, setOpenSections] = useState<Set<number>>(new Set([1]))
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function toggleSection(id: number) {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!madreNombre.trim()) e.madreNombre = 'Nombre completo requerido'
    if (!madreNacionalidad.trim()) e.madreNacionalidad = 'Nacionalidad requerida'
    if (!madreDni.trim()) e.madreDni = 'Numero de DNI requerido'
    if (!madreDireccion.trim()) e.madreDireccion = 'Direccion requerida'
    if (!hijaNombre.trim()) e.hijaNombre = 'Nombre completo requerido'
    if (!hijaFechaNacimiento) e.hijaFechaNacimiento = 'Fecha de nacimiento requerida'
    if (!hijaMunicipio.trim()) e.hijaMunicipio = 'Municipio requerido'
    if (!padreNombre.trim()) e.padreNombre = 'Nombre completo requerido'
    if (!padrePasaporte.trim()) e.padrePasaporte = 'Numero de pasaporte requerido'
    if (!padreResidencia.trim()) e.padreResidencia = 'Pais/Estado de residencia requerido'
    if (!padreDireccionHija.trim()) e.padreDireccionHija = 'Direccion requerida'

    setErrors(e)
    if (Object.keys(e).length > 0) {
      const sectionErrors = new Set<number>()
      const s1 = ['madreNombre', 'madreNacionalidad', 'madreDni', 'madreDireccion']
      const s2 = ['hijaNombre', 'hijaFechaNacimiento', 'hijaMunicipio']
      const s3 = ['padreNombre', 'padrePasaporte', 'padreResidencia', 'padreDireccionHija']
      for (const key of Object.keys(e)) {
        if (s1.includes(key)) sectionErrors.add(1)
        if (s2.includes(key)) sectionErrors.add(2)
        if (s3.includes(key)) sectionErrors.add(3)
      }
      setOpenSections(prev => new Set([...prev, ...sectionErrors]))
      return false
    }
    return true
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) { toast.error('Por favor complete los campos requeridos'); return }

    const body = {
      mother_full_name: madreNombre,
      mother_nationality: madreNacionalidad,
      mother_dni: madreDni,
      mother_address: madreDireccion,
      daughter_full_name: hijaNombre,
      daughter_dob: hijaFechaNacimiento,
      daughter_birth_certificate_municipality: hijaMunicipio,
      father_full_name: padreNombre,
      father_passport: padrePasaporte,
      father_country_state: padreResidencia,
      father_address_with_daughter: padreDireccionHija,
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/renuncia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { const data = await res.json(); toast.error(data.error || 'Error al enviar'); return }
      setSubmitted(true)
      toast.success('Formulario enviado exitosamente')
    } catch { toast.error('Error de conexion. Intente de nuevo.') }
    finally { setSubmitting(false) }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#FFF8F0] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-[#002855] mb-2">Formulario Enviado</h2>
          <p className="text-gray-600 mb-6">
            Su formulario de Renuncia Voluntaria de Custodia ha sido recibido exitosamente.
            Un representante de UsaLatinoPrime lo contactara pronto para revisar su caso.
          </p>
          <div className="bg-blue-50 rounded-lg p-4 text-sm text-[#002855]">
            <p className="font-medium">¿Tiene preguntas?</p>
            <p className="mt-1">Contactenos al <span className="font-semibold">801-941-3479</span></p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FFF8F0]">
      <header className="bg-[#002855] text-white py-4 px-4 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-[#F2A900] rounded-lg flex items-center justify-center font-bold text-[#002855] text-lg">U</div>
          <div>
            <h1 className="text-lg font-bold leading-tight">UsaLatinoPrime</h1>
            <p className="text-xs text-blue-200">Renuncia Voluntaria de Custodia Parental</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-[#F2A900]/10 border border-[#F2A900]/30 rounded-xl p-4 mb-6">
          <p className="text-sm text-[#002855] font-medium mb-1">Instrucciones:</p>
          <p className="text-sm text-gray-700">
            Complete los siguientes datos para generar el documento de renuncia de custodia.
            Los campos marcados con <span className="text-red-500 font-bold">*</span> son obligatorios.
            Esta informacion es confidencial y sera utilizada unicamente para su caso.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* -- Section 1: Datos de la Madre -- */}
          <SectionAccordion section={sections[0]} isOpen={openSections.has(1)} onToggle={() => toggleSection(1)}
            hasErrors={['madreNombre','madreNacionalidad','madreDni','madreDireccion'].some(k => errors[k])}>
            <div className="space-y-4">
              <Field label="Nombre completo de la madre" error={errors.madreNombre} required>
                <input type="text" value={madreNombre} onChange={e => setMadreNombre(e.target.value)} placeholder="Nombre completo" className={inputClass(errors.madreNombre)} />
              </Field>
              <Field label="Nacionalidad" error={errors.madreNacionalidad} required>
                <input type="text" value={madreNacionalidad} onChange={e => setMadreNacionalidad(e.target.value)} placeholder="Ej: Hondurena" className={inputClass(errors.madreNacionalidad)} />
              </Field>
              <Field label="Numero de DNI" error={errors.madreDni} required>
                <input type="text" value={madreDni} onChange={e => setMadreDni(e.target.value)} placeholder="Numero de documento de identidad" className={inputClass(errors.madreDni)} />
              </Field>
              <Field label="Direccion completa de residencia actual" error={errors.madreDireccion} required>
                <input type="text" value={madreDireccion} onChange={e => setMadreDireccion(e.target.value)} placeholder="Direccion completa" className={inputClass(errors.madreDireccion)} />
              </Field>
            </div>
          </SectionAccordion>

          {/* -- Section 2: Datos de la Hija -- */}
          <SectionAccordion section={sections[1]} isOpen={openSections.has(2)} onToggle={() => toggleSection(2)}
            hasErrors={['hijaNombre','hijaFechaNacimiento','hijaMunicipio'].some(k => errors[k])}>
            <div className="space-y-4">
              <Field label="Nombre completo de la hija" error={errors.hijaNombre} required>
                <input type="text" value={hijaNombre} onChange={e => setHijaNombre(e.target.value)} placeholder="Nombre completo" className={inputClass(errors.hijaNombre)} />
              </Field>
              <Field label="Fecha de nacimiento de la hija" error={errors.hijaFechaNacimiento} required>
                <input type="date" value={hijaFechaNacimiento} onChange={e => setHijaFechaNacimiento(e.target.value)} className={inputClass(errors.hijaFechaNacimiento)} />
              </Field>
              <Field label="Municipio que emitio el acta de nacimiento" error={errors.hijaMunicipio} required>
                <input type="text" value={hijaMunicipio} onChange={e => setHijaMunicipio(e.target.value)} placeholder="Ej: Municipio de Tegucigalpa" className={inputClass(errors.hijaMunicipio)} />
              </Field>
            </div>
          </SectionAccordion>

          {/* -- Section 3: Datos del Padre -- */}
          <SectionAccordion section={sections[2]} isOpen={openSections.has(3)} onToggle={() => toggleSection(3)}
            hasErrors={['padreNombre','padrePasaporte','padreResidencia','padreDireccionHija'].some(k => errors[k])}>
            <div className="space-y-4">
              <Field label="Nombre completo del padre" error={errors.padreNombre} required>
                <input type="text" value={padreNombre} onChange={e => setPadreNombre(e.target.value)} placeholder="Nombre completo" className={inputClass(errors.padreNombre)} />
              </Field>
              <Field label="Numero de pasaporte del padre" error={errors.padrePasaporte} required>
                <input type="text" value={padrePasaporte} onChange={e => setPadrePasaporte(e.target.value)} placeholder="Numero de pasaporte" className={inputClass(errors.padrePasaporte)} />
              </Field>
              <Field label="Pais/Estado de residencia del padre" error={errors.padreResidencia} required>
                <input type="text" value={padreResidencia} onChange={e => setPadreResidencia(e.target.value)} placeholder="Ej: Estados Unidos, Utah" className={inputClass(errors.padreResidencia)} />
              </Field>
              <Field label="Direccion completa donde reside la hija con el padre" error={errors.padreDireccionHija} required>
                <input type="text" value={padreDireccionHija} onChange={e => setPadreDireccionHija(e.target.value)} placeholder="Direccion completa" className={inputClass(errors.padreDireccionHija)} />
              </Field>
            </div>
          </SectionAccordion>

          <button type="submit" disabled={submitting}
            className="w-full bg-[#F2A900] text-[#002855] py-4 rounded-xl font-semibold text-lg hover:bg-[#d99a00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg">
            {submitting ? (<><Loader2 className="w-5 h-5 animate-spin" />Enviando...</>) : 'Enviar Formulario de Renuncia'}
          </button>
          <p className="text-xs text-center text-gray-500 mt-4 pb-8">
            Su informacion es confidencial y esta protegida. Solo sera utilizada para generar el documento de renuncia de custodia.
          </p>
        </form>
      </main>
    </div>
  )
}

// -- Helper Components --

function inputClass(error?: string) {
  return `w-full px-3 py-2.5 rounded-lg border ${error ? 'border-red-400 bg-red-50' : 'border-gray-300'} text-sm focus:outline-none focus:ring-2 focus:ring-[#002855]/30 focus:border-[#002855] transition-colors`
}

function Field({ label, error, required, children }: { label: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600 mt-0.5">{error}</p>}
    </div>
  )
}

function SectionAccordion({ section, isOpen, onToggle, hasErrors, children }: {
  section: { id: number; title: string }; isOpen: boolean; onToggle: () => void; hasErrors?: boolean; children: React.ReactNode
}) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border ${hasErrors ? 'border-red-300' : 'border-gray-200'} overflow-hidden`}>
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${hasErrors ? 'bg-red-100 text-red-700' : 'bg-[#002855] text-white'}`}>{section.id}</div>
          <span className="font-semibold text-[#002855]">{section.title}</span>
          {hasErrors && <span className="text-xs text-red-600 font-medium">Campos pendientes</span>}
        </div>
        {isOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>
      {isOpen && <div className="px-4 pb-4 pt-0">{children}</div>}
    </div>
  )
}
