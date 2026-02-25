'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { ChevronDown, ChevronUp, CheckCircle, Loader2, Plus, Trash2 } from 'lucide-react'

interface ChildData {
  nombre: string
  fechaNacimiento: string
  municipio: string
}

export default function RenunciaFormPage() {
  // Section 0: Datos del Documento
  const [signerRole, setSignerRole] = useState<'mother' | 'father'>('mother')
  const [childGender, setChildGender] = useState<'daughter' | 'son'>('daughter')
  const [guardianshipState, setGuardianshipState] = useState('')
  const [countryLeft, setCountryLeft] = useState('')
  const [caregiverSinceYear, setCaregiverSinceYear] = useState('')
  const [signingCity, setSigningCity] = useState('')

  // Section 1: Datos del firmante (quien renuncia)
  const [signerNombre, setSignerNombre] = useState('')
  const [signerNacionalidad, setSignerNacionalidad] = useState('')
  const [signerDni, setSignerDni] = useState('')
  const [signerDireccion, setSignerDireccion] = useState('')

  // Section 2: Datos de los hijos (múltiples)
  const [children, setChildren] = useState<ChildData[]>([{ nombre: '', fechaNacimiento: '', municipio: '' }])

  // Section 3: Datos del otro padre/madre (quien tiene custodia)
  const [custodianNombre, setCustodianNombre] = useState('')
  const [custodianPasaporte, setCustodianPasaporte] = useState('')
  const [custodianResidencia, setCustodianResidencia] = useState('')
  const [custodianDireccionChild, setCustodianDireccionChild] = useState('')

  const [openSections, setOpenSections] = useState<Set<number>>(new Set([0]))
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const signerLabel = signerRole === 'mother' ? 'Madre' : 'Padre'
  const custodianLabel = signerRole === 'mother' ? 'Padre' : 'Madre'
  const childLabelSingular = childGender === 'daughter' ? 'Hija' : 'Hijo'
  const childLabelPlural = childGender === 'daughter' ? 'Hijos/as' : 'Hijos/as'
  const elLa = childGender === 'daughter' ? 'la' : 'el'
  const elLaCust = custodianLabel === 'Madre' ? 'la' : 'el'

  const sections = [
    { id: 0, title: 'Configuración del Documento' },
    { id: 1, title: `Datos de ${signerLabel === 'Madre' ? 'la' : 'el'} ${signerLabel} (quien firma)` },
    { id: 2, title: children.length > 1 ? `Datos de los ${childLabelPlural}` : `Datos de ${elLa} ${childLabelSingular}` },
    { id: 3, title: `Datos de ${elLaCust} ${custodianLabel} (quien tiene custodia)` },
  ]

  function updateChild(index: number, field: keyof ChildData, value: string) {
    setChildren(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c))
  }

  function addChild() {
    setChildren(prev => [...prev, { nombre: '', fechaNacimiento: '', municipio: '' }])
  }

  function removeChild(index: number) {
    if (children.length <= 1) return
    setChildren(prev => prev.filter((_, i) => i !== index))
  }

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
    if (!guardianshipState.trim()) e.guardianshipState = 'Estado requerido'
    if (!countryLeft.trim()) e.countryLeft = 'País requerido'
    if (!caregiverSinceYear.trim()) e.caregiverSinceYear = 'Año requerido'
    if (!signingCity.trim()) e.signingCity = 'Ciudad requerida'
    if (!signerNombre.trim()) e.signerNombre = 'Nombre completo requerido'
    if (!signerNacionalidad.trim()) e.signerNacionalidad = 'Nacionalidad requerida'
    if (!signerDni.trim()) e.signerDni = 'Numero de DNI requerido'
    if (!signerDireccion.trim()) e.signerDireccion = 'Direccion requerida'

    children.forEach((child, i) => {
      if (!child.nombre.trim()) e[`child_${i}_nombre`] = 'Nombre requerido'
      if (!child.fechaNacimiento) e[`child_${i}_fecha`] = 'Fecha requerida'
      if (!child.municipio.trim()) e[`child_${i}_municipio`] = 'Municipio requerido'
    })

    if (!custodianNombre.trim()) e.custodianNombre = 'Nombre completo requerido'
    if (!custodianPasaporte.trim()) e.custodianPasaporte = 'Numero de pasaporte requerido'
    if (!custodianResidencia.trim()) e.custodianResidencia = 'Estado de residencia requerido'
    if (!custodianDireccionChild.trim()) e.custodianDireccionChild = 'Direccion requerida'

    setErrors(e)
    if (Object.keys(e).length > 0) {
      const sectionErrors = new Set<number>()
      for (const key of Object.keys(e)) {
        if (['guardianshipState', 'countryLeft', 'caregiverSinceYear', 'signingCity'].includes(key)) sectionErrors.add(0)
        if (['signerNombre', 'signerNacionalidad', 'signerDni', 'signerDireccion'].includes(key)) sectionErrors.add(1)
        if (key.startsWith('child_')) sectionErrors.add(2)
        if (['custodianNombre', 'custodianPasaporte', 'custodianResidencia', 'custodianDireccionChild'].includes(key)) sectionErrors.add(3)
      }
      setOpenSections(prev => new Set([...prev, ...sectionErrors]))
      return false
    }
    return true
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) { toast.error('Por favor complete los campos requeridos'); return }

    const firstChild = children[0]
    const additionalChildren = children.slice(1).map(c => ({
      full_name: c.nombre,
      dob: c.fechaNacimiento,
      birth_certificate_municipality: c.municipio,
    }))

    const body = {
      mother_full_name: signerRole === 'mother' ? signerNombre : custodianNombre,
      mother_nationality: signerRole === 'mother' ? signerNacionalidad : '',
      mother_dni: signerRole === 'mother' ? signerDni : '',
      mother_address: signerRole === 'mother' ? signerDireccion : '',
      daughter_full_name: firstChild.nombre,
      daughter_dob: firstChild.fechaNacimiento,
      daughter_birth_certificate_municipality: firstChild.municipio,
      father_full_name: signerRole === 'father' ? signerNombre : custodianNombre,
      father_passport: signerRole === 'father' ? signerDni : custodianPasaporte,
      father_country_state: custodianResidencia,
      father_address_with_daughter: custodianDireccionChild,
      guardianship_state: guardianshipState,
      signer_role: signerRole,
      child_gender: childGender,
      country_left: countryLeft,
      caregiver_since_year: caregiverSinceYear,
      signing_city: signingCity,
      additional_children: additionalChildren,
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
            Un representante lo contactara pronto para revisar su caso.
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

          {/* -- Section 0: Configuración del Documento -- */}
          <SectionAccordion section={sections[0]} isOpen={openSections.has(0)} onToggle={() => toggleSection(0)}
            hasErrors={['guardianshipState','countryLeft','caregiverSinceYear','signingCity'].some(k => errors[k])}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="¿Quién firma la renuncia?" required>
                  <select value={signerRole} onChange={e => setSignerRole(e.target.value as 'mother' | 'father')} className={inputClass()}>
                    <option value="mother">La Madre</option>
                    <option value="father">El Padre</option>
                  </select>
                </Field>
                <Field label="Género del hijo/a" required>
                  <select value={childGender} onChange={e => setChildGender(e.target.value as 'daughter' | 'son')} className={inputClass()}>
                    <option value="daughter">Hija (femenino)</option>
                    <option value="son">Hijo (masculino)</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Estado de EE.UU. (para custodia)" error={errors.guardianshipState} required>
                  <input type="text" value={guardianshipState} onChange={e => setGuardianshipState(e.target.value)} placeholder="Ej: Utah" className={inputClass(errors.guardianshipState)} />
                </Field>
                <Field label="País que dejó el firmante" error={errors.countryLeft} required>
                  <input type="text" value={countryLeft} onChange={e => setCountryLeft(e.target.value)} placeholder="Ej: Peru" className={inputClass(errors.countryLeft)} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Año desde que el cuidador tiene custodia" error={errors.caregiverSinceYear} required>
                  <input type="text" value={caregiverSinceYear} onChange={e => setCaregiverSinceYear(e.target.value)} placeholder="Ej: 2026" className={inputClass(errors.caregiverSinceYear)} />
                </Field>
                <Field label="Ciudad y país donde se firma" error={errors.signingCity} required>
                  <input type="text" value={signingCity} onChange={e => setSigningCity(e.target.value)} placeholder="Ej: Lima, Peru" className={inputClass(errors.signingCity)} />
                </Field>
              </div>
            </div>
          </SectionAccordion>

          {/* -- Section 1: Datos del firmante -- */}
          <SectionAccordion section={sections[1]} isOpen={openSections.has(1)} onToggle={() => toggleSection(1)}
            hasErrors={['signerNombre','signerNacionalidad','signerDni','signerDireccion'].some(k => errors[k])}>
            <div className="space-y-4">
              <Field label={`Nombre completo de ${signerLabel === 'Madre' ? 'la' : 'el'} ${signerLabel.toLowerCase()}`} error={errors.signerNombre} required>
                <input type="text" value={signerNombre} onChange={e => setSignerNombre(e.target.value)} placeholder="Nombre completo" className={inputClass(errors.signerNombre)} />
              </Field>
              <Field label="Nacionalidad" error={errors.signerNacionalidad} required>
                <input type="text" value={signerNacionalidad} onChange={e => setSignerNacionalidad(e.target.value)} placeholder="Ej: Peruana" className={inputClass(errors.signerNacionalidad)} />
              </Field>
              <Field label="Numero de DNI / documento de identidad" error={errors.signerDni} required>
                <input type="text" value={signerDni} onChange={e => setSignerDni(e.target.value)} placeholder="Numero de documento" className={inputClass(errors.signerDni)} />
              </Field>
              <Field label="Direccion completa de residencia actual" error={errors.signerDireccion} required>
                <input type="text" value={signerDireccion} onChange={e => setSignerDireccion(e.target.value)} placeholder="Direccion completa" className={inputClass(errors.signerDireccion)} />
              </Field>
            </div>
          </SectionAccordion>

          {/* -- Section 2: Datos de los hijos -- */}
          <SectionAccordion section={sections[2]} isOpen={openSections.has(2)} onToggle={() => toggleSection(2)}
            hasErrors={Object.keys(errors).some(k => k.startsWith('child_'))}>
            <div className="space-y-4">
              {children.map((child, i) => (
                <div key={i} className={children.length > 1 ? 'bg-gray-50 rounded-lg p-4 relative' : ''}>
                  {children.length > 1 && (
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-[#002855]">
                        {childGender === 'daughter' ? 'Hija' : 'Hijo'} {i + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeChild(i)}
                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <div className="space-y-3">
                    <Field label={`Nombre completo de ${elLa} ${childLabelSingular.toLowerCase()}`} error={errors[`child_${i}_nombre`]} required>
                      <input type="text" value={child.nombre} onChange={e => updateChild(i, 'nombre', e.target.value)} placeholder="Nombre completo" className={inputClass(errors[`child_${i}_nombre`])} />
                    </Field>
                    <Field label={`Fecha de nacimiento`} error={errors[`child_${i}_fecha`]} required>
                      <input type="date" value={child.fechaNacimiento} onChange={e => updateChild(i, 'fechaNacimiento', e.target.value)} className={inputClass(errors[`child_${i}_fecha`])} />
                    </Field>
                    <Field label="Municipio / lugar que emitio el acta de nacimiento" error={errors[`child_${i}_municipio`]} required>
                      <input type="text" value={child.municipio} onChange={e => updateChild(i, 'municipio', e.target.value)} placeholder="Ej: Neiva Huila Colombia" className={inputClass(errors[`child_${i}_municipio`])} />
                    </Field>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addChild}
                className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-[#002855] hover:text-[#002855] transition-colors"
              >
                <Plus className="w-4 h-4" />
                Agregar otro {childGender === 'daughter' ? 'hija' : 'hijo'}
              </button>
            </div>
          </SectionAccordion>

          {/* -- Section 3: Datos del otro padre/madre (custodio) -- */}
          <SectionAccordion section={sections[3]} isOpen={openSections.has(3)} onToggle={() => toggleSection(3)}
            hasErrors={['custodianNombre','custodianPasaporte','custodianResidencia','custodianDireccionChild'].some(k => errors[k])}>
            <div className="space-y-4">
              <Field label={`Nombre completo de ${elLaCust} ${custodianLabel.toLowerCase()}`} error={errors.custodianNombre} required>
                <input type="text" value={custodianNombre} onChange={e => setCustodianNombre(e.target.value)} placeholder="Nombre completo" className={inputClass(errors.custodianNombre)} />
              </Field>
              <Field label={`Numero de pasaporte de ${elLaCust} ${custodianLabel.toLowerCase()}`} error={errors.custodianPasaporte} required>
                <input type="text" value={custodianPasaporte} onChange={e => setCustodianPasaporte(e.target.value)} placeholder="Numero de pasaporte" className={inputClass(errors.custodianPasaporte)} />
              </Field>
              <Field label={`Estado de residencia en EE.UU. de ${elLaCust} ${custodianLabel.toLowerCase()}`} error={errors.custodianResidencia} required>
                <input type="text" value={custodianResidencia} onChange={e => setCustodianResidencia(e.target.value)} placeholder="Ej: Kansas" className={inputClass(errors.custodianResidencia)} />
              </Field>
              <Field label={`Direccion completa donde reside ${elLa} ${childLabelSingular.toLowerCase()} con ${elLaCust} ${custodianLabel.toLowerCase()}`} error={errors.custodianDireccionChild} required>
                <input type="text" value={custodianDireccionChild} onChange={e => setCustodianDireccionChild(e.target.value)} placeholder="Direccion completa" className={inputClass(errors.custodianDireccionChild)} />
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
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${hasErrors ? 'bg-red-100 text-red-700' : 'bg-[#002855] text-white'}`}>{section.id + 1}</div>
          <span className="font-semibold text-[#002855]">{section.title}</span>
          {hasErrors && <span className="text-xs text-red-600 font-medium">Campos pendientes</span>}
        </div>
        {isOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>
      {isOpen && <div className="px-4 pb-4 pt-0">{children}</div>}
    </div>
  )
}
