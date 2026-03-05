'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Save, ChevronDown, ChevronUp, User, Building2, MapPin, Gavel, FileText } from 'lucide-react'
import Link from 'next/link'

interface Section {
  id: string
  title: string
  icon: any
  num: number
}

const sections: Section[] = [
  { id: 'client', title: 'Datos del Cliente', icon: User, num: 1 },
  { id: 'case', title: 'Datos del Caso', icon: Gavel, num: 2 },
  { id: 'current_court', title: 'Corte Actual', icon: Building2, num: 3 },
  { id: 'new_location', title: 'Nueva Ubicacion / Corte', icon: MapPin, num: 4 },
  { id: 'counsel', title: 'Fiscal Principal (Chief Counsel)', icon: FileText, num: 5 },
]

export default function NuevoCambioCortePage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    client: true,
    case: false,
    current_court: false,
    new_location: false,
    counsel: false,
  })

  // Client info
  const [clientFullName, setClientFullName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientStreet, setClientStreet] = useState('')
  const [clientCity, setClientCity] = useState('')
  const [clientState, setClientState] = useState('')
  const [clientZip, setClientZip] = useState('')

  // Case info
  const [fileNumber, setFileNumber] = useState('')
  const [judgeName, setJudgeName] = useState('')
  const [nextHearingDate, setNextHearingDate] = useState('')
  const [nextHearingTime, setNextHearingTime] = useState('')

  // Current court
  const [currentCourtName, setCurrentCourtName] = useState('')
  const [currentCourtStreet, setCurrentCourtStreet] = useState('')
  const [currentCourtCityStateZip, setCurrentCourtCityStateZip] = useState('')

  // New location
  const [newStreet, setNewStreet] = useState('')
  const [newCity, setNewCity] = useState('')
  const [newState, setNewState] = useState('')
  const [newZip, setNewZip] = useState('')
  const [newCourtName, setNewCourtName] = useState('')
  const [newCourtStreet, setNewCourtStreet] = useState('')
  const [newCourtCityStateZip, setNewCourtCityStateZip] = useState('')

  // Residence proof documents
  const [residenceProofDocs, setResidenceProofDocs] = useState<string[]>([])

  // Chief counsel
  const [chiefCounselAddress, setChiefCounselAddress] = useState('')

  // Document date
  const [documentDate, setDocumentDate] = useState(
    new Date().toISOString().split('T')[0]
  )

  function toggleSection(id: string) {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    try {
      const res = await fetch('/api/cambio-corte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_full_name: clientFullName,
          client_phone: clientPhone,
          client_address_street: clientStreet,
          client_address_city: clientCity,
          client_address_state: clientState,
          client_address_zip: clientZip,
          file_number: fileNumber,
          judge_name: judgeName,
          next_hearing_date: nextHearingDate,
          next_hearing_time: nextHearingTime,
          current_court_name: currentCourtName,
          current_court_street: currentCourtStreet,
          current_court_city_state_zip: currentCourtCityStateZip,
          new_address_street: newStreet,
          new_address_city: newCity,
          new_address_state: newState,
          new_address_zip: newZip,
          new_court_name: newCourtName,
          new_court_street: newCourtStreet,
          new_court_city_state_zip: newCourtCityStateZip,
          chief_counsel_address: chiefCounselAddress,
          document_date: documentDate,
          residence_proof_docs: residenceProofDocs,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Error al guardar')
        return
      }

      toast.success('Formulario de cambio de corte guardado')
      router.push('/admin/cambio-corte')
    } catch {
      toast.error('Error de conexion')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = "w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#002855]/30 focus:border-[#002855]"
  const labelClass = "text-sm font-medium text-gray-700"

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/cambio-corte"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nuevo Cambio de Corte</h1>
          <p className="text-sm text-gray-500">Complete los datos del cliente para generar el documento</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {sections.map((section) => (
          <div key={section.id} className="bg-white rounded-xl border overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection(section.id)}
              className="flex items-center justify-between w-full p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#002855] text-white flex items-center justify-center text-sm font-bold">
                  {section.num}
                </div>
                <span className="font-semibold text-gray-900">{section.title}</span>
              </div>
              {openSections[section.id] ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>

            {openSections[section.id] && (
              <div className="px-4 pb-4 space-y-4">
                {section.id === 'client' && (
                  <>
                    <div>
                      <label className={labelClass}>Nombre completo del cliente *</label>
                      <input type="text" required value={clientFullName} onChange={e => setClientFullName(e.target.value)} placeholder="Ej: JENY LORENA BARRERA" className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Telefono *</label>
                      <input type="tel" required value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="Ej: (206) 432-1575" className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Direccion actual (calle) *</label>
                      <input type="text" required value={clientStreet} onChange={e => setClientStreet(e.target.value)} placeholder="Ej: 23240 88TH AVE" className={inputClass} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className={labelClass}>Ciudad *</label>
                        <input type="text" required value={clientCity} onChange={e => setClientCity(e.target.value)} placeholder="Kent" className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Estado *</label>
                        <input type="text" required value={clientState} onChange={e => setClientState(e.target.value)} placeholder="WA" className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>ZIP *</label>
                        <input type="text" required value={clientZip} onChange={e => setClientZip(e.target.value)} placeholder="98031" className={inputClass} />
                      </div>
                    </div>
                  </>
                )}

                {section.id === 'case' && (
                  <>
                    <div>
                      <label className={labelClass}>Numero A# (File No.) *</label>
                      <input type="text" required value={fileNumber} onChange={e => setFileNumber(e.target.value)} placeholder="Ej: 245-205119" className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Nombre del Juez *</label>
                      <input type="text" required value={judgeName} onChange={e => setJudgeName(e.target.value)} placeholder="Ej: Windrow, Hayden E" className={inputClass} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>Fecha proxima audiencia *</label>
                        <input type="date" required value={nextHearingDate} onChange={e => setNextHearingDate(e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Hora de audiencia *</label>
                        <input type="time" required value={nextHearingTime} onChange={e => setNextHearingTime(e.target.value)} className={inputClass} />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Fecha del documento *</label>
                      <input type="date" required value={documentDate} onChange={e => setDocumentDate(e.target.value)} className={inputClass} />
                    </div>
                  </>
                )}

                {section.id === 'current_court' && (
                  <>
                    <div>
                      <label className={labelClass}>Nombre de la corte actual *</label>
                      <input type="text" required value={currentCourtName} onChange={e => setCurrentCourtName(e.target.value)} placeholder="Ej: Immigration Court - Seattle" className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Direccion de la corte (calle) *</label>
                      <input type="text" required value={currentCourtStreet} onChange={e => setCurrentCourtStreet(e.target.value)} placeholder="Ej: 915 Second Avenue, Suite 613" className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Ciudad, Estado, ZIP *</label>
                      <input type="text" required value={currentCourtCityStateZip} onChange={e => setCurrentCourtCityStateZip(e.target.value)} placeholder="Ej: Seattle, WA 98174" className={inputClass} />
                    </div>
                  </>
                )}

                {section.id === 'new_location' && (
                  <>
                    <p className="text-xs text-gray-500 bg-blue-50 p-2 rounded">Nueva direccion del cliente (a donde se traslada)</p>
                    <div>
                      <label className={labelClass}>Nueva direccion (calle) *</label>
                      <input type="text" required value={newStreet} onChange={e => setNewStreet(e.target.value)} placeholder="Ej: 10951 N Town Center Drive" className={inputClass} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className={labelClass}>Ciudad *</label>
                        <input type="text" required value={newCity} onChange={e => setNewCity(e.target.value)} placeholder="Highland" className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Estado *</label>
                        <input type="text" required value={newState} onChange={e => setNewState(e.target.value)} placeholder="Utah" className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>ZIP *</label>
                        <input type="text" required value={newZip} onChange={e => setNewZip(e.target.value)} placeholder="84043" className={inputClass} />
                      </div>
                    </div>

                    <div className="border-t pt-4 mt-2">
                      <p className="text-xs text-gray-500 bg-blue-50 p-2 rounded mb-3">Documentos que acreditan nueva residencia (aparecerán en el PDF)</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                        {[
                          { key: 'pay_stub', label: 'Boleta de Pago' },
                          { key: 'lease_agreement', label: 'Contrato de Alquiler' },
                          { key: 'tax_return', label: 'Declaración de Taxes' },
                          { key: 'utility_bills', label: 'Recibo de Servicios' },
                        ].map(opt => (
                          <label key={opt.key} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={residenceProofDocs.includes(opt.key)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setResidenceProofDocs(prev => [...prev, opt.key])
                                } else {
                                  setResidenceProofDocs(prev => prev.filter(k => k !== opt.key))
                                }
                              }}
                              className="rounded border-gray-300 text-[#002855] focus:ring-[#002855]"
                            />
                            <span className="text-sm text-gray-700">{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="border-t pt-4 mt-2">
                      <p className="text-xs text-gray-500 bg-blue-50 p-2 rounded mb-3">Corte a donde se transfiere el caso</p>
                      <div className="space-y-4">
                        <div>
                          <label className={labelClass}>Nombre de la nueva corte *</label>
                          <input type="text" required value={newCourtName} onChange={e => setNewCourtName(e.target.value)} placeholder="Ej: Immigration Court - Salt Lake City" className={inputClass} />
                        </div>
                        <div>
                          <label className={labelClass}>Direccion de la nueva corte (calle) *</label>
                          <input type="text" required value={newCourtStreet} onChange={e => setNewCourtStreet(e.target.value)} placeholder="Ej: 2975 S Decker Lake Drive, Suite 200" className={inputClass} />
                        </div>
                        <div>
                          <label className={labelClass}>Ciudad, Estado, ZIP *</label>
                          <input type="text" required value={newCourtCityStateZip} onChange={e => setNewCourtCityStateZip(e.target.value)} placeholder="Ej: West Valley City, UT 84119" className={inputClass} />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {section.id === 'counsel' && (
                  <>
                    <div>
                      <label className={labelClass}>Direccion completa del Fiscal Principal (Chief Counsel) *</label>
                      <textarea
                        required
                        value={chiefCounselAddress}
                        onChange={e => setChiefCounselAddress(e.target.value)}
                        placeholder={"Ej: Office of the Chief Counsel\n901 Stewart Street, Suite 401\nSeattle, WA 98101"}
                        rows={3}
                        className={inputClass}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 px-4 bg-[#002855] text-white font-semibold rounded-xl hover:bg-[#001d3d] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Guardar Formulario
            </>
          )}
        </button>
      </form>
    </div>
  )
}
