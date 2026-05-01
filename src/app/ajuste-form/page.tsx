'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { ChevronDown, ChevronUp, Play, CheckCircle, Loader2, Plus, X } from 'lucide-react'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC','PR','GU','VI',
]

const LATIN_COUNTRIES = [
  'Mexico','Guatemala','Honduras','El Salvador','Nicaragua','Costa Rica','Panama',
  'Colombia','Venezuela','Ecuador','Peru','Bolivia','Brasil','Chile','Argentina',
  'Uruguay','Paraguay','Cuba','Republica Dominicana','Haiti','Otros',
]

const IMMIGRATION_STATUSES = [
  'Visa de turista (B-1/B-2)','Visa de estudiante (F-1)','Visa de trabajo (H-1B)',
  'TPS','DACA','Asilo aprobado','Refugiado','Parole','Sin estatus (indocumentado)','Otro',
]

const PETITIONER_TYPES = [
  'Esposo/a ciudadano','Esposo/a residente','Padre/Madre ciudadano',
  'Hijo/a ciudadano mayor de 21','Empleador','Auto-peticion VAWA','Otro',
]

const PETITION_CATEGORIES = [
  'Familiar inmediato','Preferencia familiar 1','Preferencia familiar 2A',
  'Preferencia familiar 2B','Preferencia familiar 3','Preferencia familiar 4',
  'Empleo 1','Empleo 2','Empleo 3','Otro',
]

interface ChildEntry {
  child_full_name: string; child_dob: string; child_country_of_birth: string;
  child_a_number: string; child_in_us: boolean; child_included: boolean;
}

interface EmploymentEntry {
  emp_employer: string;        // Nombre de la empresa
  emp_supervisor: string;      // Nombre del jefe / supervisor
  emp_occupation: string;      // Cargo
  emp_address: string;
  emp_country: string;
  emp_city: string;
  emp_state: string;
  emp_zip: string;
  emp_from: string;            // dd/mm/aaaa
  emp_to: string;              // dd/mm/aaaa o "actualidad"
}

interface EducationEntry {
  edu_school: string;          // Nombre del colegio / institucion
  edu_type: string;            // Primaria | Secundaria | Profesional | Tecnico | Otro
  edu_address: string;
  edu_country: string;
  edu_city: string;
  edu_state: string;
  edu_zip: string;
  edu_from: string;            // dd/mm/aaaa
  edu_to: string;              // dd/mm/aaaa
}

interface AddressHistoryEntry {
  addr_street: string;
  addr_country: string;
  addr_city: string;
  addr_state: string;          // Estado o provincia
  addr_zip: string;
  addr_from: string;           // dd/mm/aaaa
  addr_to: string;             // dd/mm/aaaa o "actualidad"
}

const EDUCATION_TYPES = ['Primaria', 'Secundaria', 'Profesional / Universidad', 'Tecnico', 'Otro']
const RACE_OPTIONS = [
  'American Indian or Alaska Native',
  'Asian',
  'Black or African American',
  'Native Hawaiian or Other Pacific Islander',
  'White',
]
const EYE_COLORS = ['Negro', 'Azul', 'Cafe', 'Gris', 'Verde', 'Avellana', 'Marron', 'Rosa', 'Otro / Desconocido']
const HAIR_COLORS = ['Calvo', 'Negro', 'Rubio', 'Cafe', 'Gris', 'Rojo', 'Castano claro', 'Blanco', 'Otro / Desconocido']

const emptyChild: ChildEntry = { child_full_name: '', child_dob: '', child_country_of_birth: '', child_a_number: '', child_in_us: false, child_included: false }
const emptyEmployment: EmploymentEntry = {
  emp_employer: '', emp_supervisor: '', emp_occupation: '', emp_address: '',
  emp_country: '', emp_city: '', emp_state: '', emp_zip: '',
  emp_from: '', emp_to: '',
}
const emptyEducation: EducationEntry = {
  edu_school: '', edu_type: '', edu_address: '',
  edu_country: '', edu_city: '', edu_state: '', edu_zip: '',
  edu_from: '', edu_to: '',
}
const emptyAddressHistory: AddressHistoryEntry = {
  addr_street: '', addr_country: '', addr_city: '', addr_state: '', addr_zip: '',
  addr_from: '', addr_to: '',
}

const sections = [
  { id: 1, title: 'Informacion Personal del Solicitante' },
  { id: 2, title: 'Informacion de Inmigracion' },
  { id: 3, title: 'Informacion del Peticionario/Patrocinador' },
  { id: 4, title: 'Informacion Familiar' },
  { id: 5, title: 'Historial de Empleo y Educacion (ultimos 5 anios)' },
  { id: 6, title: 'Preguntas de Admisibilidad' },
  { id: 7, title: 'Documentos y Declaracion' },
  { id: 8, title: 'Informacion Biografica' },
]

export default function AjusteFormPage() {
  // Section 1: Informacion Personal
  const [legalLastName, setLegalLastName] = useState('')
  const [legalFirstName, setLegalFirstName] = useState('')
  const [legalMiddleName, setLegalMiddleName] = useState('')
  const [otherNames, setOtherNames] = useState<string[]>([])
  const [dob, setDob] = useState('')
  const [cityOfBirth, setCityOfBirth] = useState('')
  const [countryOfBirth, setCountryOfBirth] = useState('')
  const [nationality, setNationality] = useState('')
  const [gender, setGender] = useState('')
  const [maritalStatus, setMaritalStatus] = useState('')
  const [ssn, setSsn] = useState('')
  const [aNumber, setANumber] = useState('')
  const [uscisOnlineAccount, setUscisOnlineAccount] = useState('')
  const [resStreet, setResStreet] = useState('')
  const [resCity, setResCity] = useState('')
  const [resState, setResState] = useState('')
  const [resZip, setResZip] = useState('')
  const [resPhone, setResPhone] = useState('')
  const [email, setEmail] = useState('')
  // Section 1.b: Historial de direcciones de los ultimos 5 anios
  const [addressHistory, setAddressHistory] = useState<AddressHistoryEntry[]>([])
  // Section 1.c: Ultima direccion en pais de origen
  const [originStreet, setOriginStreet] = useState('')
  const [originCountry, setOriginCountry] = useState('')
  const [originCity, setOriginCity] = useState('')
  const [originState, setOriginState] = useState('')
  const [originZip, setOriginZip] = useState('')
  const [originFrom, setOriginFrom] = useState('')
  const [originTo, setOriginTo] = useState('')

  // Section 2: Informacion de Inmigracion
  const [currentImmigrationStatus, setCurrentImmigrationStatus] = useState('')
  const [currentStatusOther, setCurrentStatusOther] = useState('')
  const [dateOfLastEntry, setDateOfLastEntry] = useState('')
  const [placeOfLastEntry, setPlaceOfLastEntry] = useState('')
  const [i94Number, setI94Number] = useState('')
  const [passportNumber, setPassportNumber] = useState('')
  const [passportCountry, setPassportCountry] = useState('')
  const [passportExpiry, setPassportExpiry] = useState('')
  const [entryStatusAtArrival, setEntryStatusAtArrival] = useState('')
  const [currentStatusExpires, setCurrentStatusExpires] = useState('')
  const [everInRemovalProceedings, setEverInRemovalProceedings] = useState(false)
  const [removalDetails, setRemovalDetails] = useState('')
  const [everDeniedVisaOrEntry, setEverDeniedVisaOrEntry] = useState(false)
  const [denialDetails, setDenialDetails] = useState('')

  // Section 3: Peticionario/Patrocinador
  const [petitionerType, setPetitionerType] = useState('')
  const [petitionerFullName, setPetitionerFullName] = useState('')
  const [petitionerRelationship, setPetitionerRelationship] = useState('')
  const [petitionerANumber, setPetitionerANumber] = useState('')
  const [petitionerDob, setPetitionerDob] = useState('')
  const [petitionerCountryOfBirth, setPetitionerCountryOfBirth] = useState('')
  const [petitionReceiptNumber, setPetitionReceiptNumber] = useState('')
  const [petitionPriorityDate, setPetitionPriorityDate] = useState('')
  const [petitionCategory, setPetitionCategory] = useState('')

  // Section 4: Informacion Familiar
  const [hasSpouse, setHasSpouse] = useState(false)
  const [spouseFullName, setSpouseFullName] = useState('')
  const [spouseDob, setSpouseDob] = useState('')
  const [spouseCountryOfBirth, setSpouseCountryOfBirth] = useState('')
  const [spouseANumber, setSpouseANumber] = useState('')
  const [spouseImmigrationStatus, setSpouseImmigrationStatus] = useState('')
  const [spouseIncluded, setSpouseIncluded] = useState(false)
  const [marriageDate, setMarriageDate] = useState('')
  const [marriageCity, setMarriageCity] = useState('')
  const [marriageState, setMarriageState] = useState('')
  const [hasChildren, setHasChildren] = useState(false)
  const [children, setChildren] = useState<ChildEntry[]>([])

  // Section 5: Empleo y Educacion
  const [employments, setEmployments] = useState<EmploymentEntry[]>([])
  const [educationList, setEducationList] = useState<EducationEntry[]>([])

  // Section 6: Preguntas de Admisibilidad
  const [criminalArrest, setCriminalArrest] = useState(false)
  const [criminalDetails, setCriminalDetails] = useState('')
  const [criminalConviction, setCriminalConviction] = useState(false)
  const [convictionDetails, setConvictionDetails] = useState('')
  const [drugRelated, setDrugRelated] = useState(false)
  const [drugDetails, setDrugDetails] = useState('')
  const [immigrationFraud, setImmigrationFraud] = useState(false)
  const [fraudDetails, setFraudDetails] = useState('')
  const [falseUsCitizen, setFalseUsCitizen] = useState(false)
  const [citizenDetails, setCitizenDetails] = useState('')
  const [removedDeported, setRemovedDeported] = useState(false)
  const [removedDetails, setRemovedDetails] = useState('')
  const [unlawfulPresence, setUnlawfulPresence] = useState(false)
  const [unlawfulDetails, setUnlawfulDetails] = useState('')
  const [publicCharge, setPublicCharge] = useState(false)
  const [publicChargeDetails, setPublicChargeDetails] = useState('')

  // Section 7: Documentos y Declaracion
  const [hasMedicalExam, setHasMedicalExam] = useState(false)
  const [hasAffidavitSupport, setHasAffidavitSupport] = useState(false)
  const [additionalInfo, setAdditionalInfo] = useState('')
  const [applicantDeclaration, setApplicantDeclaration] = useState(false)

  // Section 8: Informacion Biografica (Part 8 del I-485)
  const [bioEthnicity, setBioEthnicity] = useState<'' | 'hispanic' | 'not_hispanic'>('')
  const [bioRaces, setBioRaces] = useState<string[]>([])
  const [bioHeightFeet, setBioHeightFeet] = useState('')
  const [bioHeightInches, setBioHeightInches] = useState('')
  const [bioWeightLbs, setBioWeightLbs] = useState('')
  const [bioEyeColor, setBioEyeColor] = useState('')
  const [bioHairColor, setBioHairColor] = useState('')

  // Form state
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

  function isSectionComplete(sectionId: number): boolean {
    switch (sectionId) {
      case 1: return !!(legalLastName && legalFirstName && dob && cityOfBirth && countryOfBirth && nationality && gender && maritalStatus && resStreet && resCity && resState && resZip && resPhone)
      case 2: return !!(currentImmigrationStatus && dateOfLastEntry && placeOfLastEntry)
      case 3: return !!(petitionerType && petitionerFullName && petitionerRelationship)
      case 4: return true
      case 5: return true
      case 6: return true
      case 7: return applicantDeclaration
      case 8: return !!(bioEthnicity && bioHeightFeet && bioWeightLbs && bioEyeColor && bioHairColor)
      default: return false
    }
  }

  function validate(): boolean {
    const e: Record<string, string> = {}

    // Section 1
    if (!legalLastName.trim()) e.legalLastName = 'Apellido requerido'
    if (!legalFirstName.trim()) e.legalFirstName = 'Nombre requerido'
    if (!dob) e.dob = 'Fecha de nacimiento requerida'
    if (!cityOfBirth.trim()) e.cityOfBirth = 'Ciudad de nacimiento requerida'
    if (!countryOfBirth) e.countryOfBirth = 'Pais de nacimiento requerido'
    if (!nationality) e.nationality = 'Nacionalidad requerida'
    if (!gender) e.gender = 'Sexo requerido'
    if (!maritalStatus) e.maritalStatus = 'Estado civil requerido'
    if (!resStreet.trim()) e.resStreet = 'Direccion requerida'
    if (!resCity.trim()) e.resCity = 'Ciudad requerida'
    if (!resState) e.resState = 'Estado requerido'
    if (!resZip.trim()) e.resZip = 'Codigo postal requerido'
    if (!resPhone.trim()) e.resPhone = 'Telefono requerido'

    // Section 2
    if (!currentImmigrationStatus) e.currentImmigrationStatus = 'Estatus migratorio requerido'
    if (!dateOfLastEntry) e.dateOfLastEntry = 'Fecha de ultima entrada requerida'
    if (!placeOfLastEntry.trim()) e.placeOfLastEntry = 'Lugar de entrada requerido'

    // Section 3
    if (!petitionerType) e.petitionerType = 'Tipo de peticionario requerido'
    if (!petitionerFullName.trim()) e.petitionerFullName = 'Nombre del peticionario requerido'
    if (!petitionerRelationship.trim()) e.petitionerRelationship = 'Relacion requerida'

    // Section 7
    if (!applicantDeclaration) e.applicantDeclaration = 'Debe aceptar la declaracion'

    setErrors(e)
    if (Object.keys(e).length > 0) {
      const sectionErrors = new Set<number>()
      const s1 = ['legalLastName','legalFirstName','dob','cityOfBirth','countryOfBirth','nationality','gender','maritalStatus','resStreet','resCity','resState','resZip','resPhone']
      const s2 = ['currentImmigrationStatus','dateOfLastEntry','placeOfLastEntry']
      const s3 = ['petitionerType','petitionerFullName','petitionerRelationship']
      const s7 = ['applicantDeclaration']
      for (const key of Object.keys(e)) {
        if (s1.includes(key)) sectionErrors.add(1)
        if (s2.includes(key)) sectionErrors.add(2)
        if (s3.includes(key)) sectionErrors.add(3)
        if (s7.includes(key)) sectionErrors.add(7)
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
      // Section 1
      legal_last_name: legalLastName, legal_first_name: legalFirstName, legal_middle_name: legalMiddleName,
      other_names: otherNames.filter(Boolean),
      date_of_birth: dob, city_of_birth: cityOfBirth, country_of_birth: countryOfBirth,
      nationality, gender, marital_status: maritalStatus,
      ssn, a_number: aNumber, uscis_online_account: uscisOnlineAccount,
      residence_address_street: resStreet, residence_address_city: resCity,
      residence_address_state: resState, residence_address_zip: resZip,
      residence_phone: resPhone, email,

      // Section 2
      current_immigration_status: currentImmigrationStatus, current_status_other: currentStatusOther,
      date_of_last_entry: dateOfLastEntry, place_of_last_entry: placeOfLastEntry,
      i94_number: i94Number, passport_number: passportNumber,
      passport_country: passportCountry, passport_expiry: passportExpiry,
      entry_status_at_arrival: entryStatusAtArrival, current_status_expires: currentStatusExpires,
      ever_in_removal_proceedings: everInRemovalProceedings, removal_details: removalDetails,
      ever_denied_visa_or_entry: everDeniedVisaOrEntry, denial_details: denialDetails,

      // Section 3
      petitioner_type: petitionerType, petitioner_full_name: petitionerFullName,
      petitioner_relationship: petitionerRelationship, petitioner_a_number: petitionerANumber,
      petitioner_date_of_birth: petitionerDob, petitioner_country_of_birth: petitionerCountryOfBirth,
      petition_receipt_number: petitionReceiptNumber, petition_priority_date: petitionPriorityDate,
      petition_category: petitionCategory,

      // Section 4
      has_spouse: hasSpouse,
      ...(hasSpouse ? { spouse_info: {
        spouse_full_name: spouseFullName, spouse_dob: spouseDob,
        spouse_country_of_birth: spouseCountryOfBirth, spouse_a_number: spouseANumber,
        spouse_immigration_status: spouseImmigrationStatus, spouse_included_in_application: spouseIncluded,
        marriage_date: marriageDate, marriage_city: marriageCity, marriage_state: marriageState,
      }} : {}),
      has_children: hasChildren, children,

      // Section 5
      employments, education: educationList,

      // Section 6
      criminal_arrest: criminalArrest, criminal_details: criminalDetails,
      criminal_conviction: criminalConviction, conviction_details: convictionDetails,
      drug_related: drugRelated, drug_details: drugDetails,
      immigration_fraud: immigrationFraud, fraud_details: fraudDetails,
      false_us_citizen: falseUsCitizen, citizen_details: citizenDetails,
      removed_deported: removedDeported, removal_details_deport: removedDetails,
      unlawful_presence: unlawfulPresence, unlawful_details: unlawfulDetails,
      public_charge: publicCharge, public_charge_details: publicChargeDetails,

      // Section 7
      has_medical_exam: hasMedicalExam, has_affidavit_support: hasAffidavitSupport,
      additional_info: additionalInfo, applicant_declaration: applicantDeclaration,

      // Section 1.b: Historial de direcciones (ultimos 5 anios)
      address_history: addressHistory,

      // Section 1.c: Ultima direccion en pais de origen
      last_origin_address: {
        street: originStreet,
        country: originCountry,
        city: originCity,
        state: originState,
        zip: originZip,
        from: originFrom,
        to: originTo,
      },

      // Section 8: Informacion Biografica (Part 8 del I-485 oficial)
      biographic: {
        ethnicity: bioEthnicity,            // 'hispanic' | 'not_hispanic' | ''
        races: bioRaces,                    // Multi-select array
        height_feet: bioHeightFeet,
        height_inches: bioHeightInches,
        weight_lbs: bioWeightLbs,
        eye_color: bioEyeColor,
        hair_color: bioHairColor,
      },
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/ajuste-estatus', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { const data = await res.json(); toast.error(data.error || 'Error al enviar'); return }
      setSubmitted(true)
      toast.success('Formulario enviado exitosamente')
    } catch { toast.error('Error de conexion. Intente de nuevo.') }
    finally { setSubmitting(false) }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#002855] via-[#003366] to-[#001d3d] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center text-gray-900">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-[#002855] mb-2">Formulario Enviado Exitosamente</h2>
          <p className="text-gray-600 mb-6">
            Su informacion ha sido recibida. Un consultor de UsaLatinoPrime se comunicara con usted.
          </p>
          <div className="bg-blue-50 rounded-lg p-4 text-sm text-[#002855] space-y-1">
            <p className="font-medium">Contactenos:</p>
            <p>Telefono: <span className="font-semibold">801-941-3479</span></p>
            <p>Zelle: <span className="font-semibold">Henryorellana@usalatinoprime.com</span></p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#002855] via-[#003366] to-[#001d3d] text-white">
      <header className="bg-[#002855]/80 backdrop-blur-sm text-white py-4 px-4 shadow-md border-b border-white/10">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-[#F2A900] rounded-lg flex items-center justify-center font-bold text-[#002855] text-lg">U</div>
          <div>
            <h1 className="text-lg font-bold leading-tight">UsaLatinoPrime</h1>
            <p className="text-xs text-blue-200">Formulario I-485 — Ajuste de Estatus</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Video Placeholder */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden mb-6 text-gray-900">
          <div className="aspect-video bg-gradient-to-br from-[#002855] to-[#003d7a] flex flex-col items-center justify-center text-white">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-3 backdrop-blur-sm">
              <Play className="w-8 h-8 text-white ml-1" />
            </div>
            <p className="text-sm font-medium">Video de instrucciones</p>
            <p className="text-xs text-blue-200 mt-1">Proximamente</p>
          </div>
        </div>

        {/* Title Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 mb-6 text-gray-900">
          <h2 className="text-xl font-bold text-[#002855] mb-1">Formulario de Ajuste de Estatus (I-485)</h2>
          <p className="text-sm text-gray-600">
            Complete la siguiente informacion para iniciar su proceso de Ajuste de Estatus ante USCIS
          </p>
        </div>

        {/* Instructions */}
        <div className="bg-[#F2A900]/10 border border-[#F2A900]/30 rounded-xl p-4 mb-6">
          <p className="text-sm font-medium mb-1">Instrucciones:</p>
          <p className="text-sm text-blue-100">
            Complete las 7 secciones del formulario I-485 con la mayor cantidad de detalle posible.
            Los campos marcados con <span className="text-red-400 font-bold">*</span> son obligatorios.
            Esta informacion es confidencial y sera utilizada unicamente para su proceso de Ajuste de Estatus.
          </p>
        </div>

        {/* Section Progress */}
        <div className="flex flex-wrap gap-2 mb-6">
          {sections.map(s => (
            <div key={s.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${isSectionComplete(s.id) ? 'bg-green-100 text-green-800' : 'bg-white/10 text-white/70'}`}>
              {isSectionComplete(s.id) && <CheckCircle className="w-3.5 h-3.5" />}
              <span>{s.id}. {s.title.split(' ')[0]}</span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ── Section 1: Informacion Personal del Solicitante ── */}
          <SectionAccordion section={sections[0]} isOpen={openSections.has(1)} onToggle={() => toggleSection(1)}
            hasErrors={['legalLastName','legalFirstName','dob','cityOfBirth','countryOfBirth','nationality','gender','maritalStatus','resStreet','resCity','resState','resZip','resPhone'].some(k => errors[k])}>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Apellido legal" error={errors.legalLastName} required>
                  <input type="text" value={legalLastName} onChange={e => setLegalLastName(e.target.value)} placeholder="Apellido" className={inputClass(errors.legalLastName)} />
                </Field>
                <Field label="Nombre legal" error={errors.legalFirstName} required>
                  <input type="text" value={legalFirstName} onChange={e => setLegalFirstName(e.target.value)} placeholder="Nombre" className={inputClass(errors.legalFirstName)} />
                </Field>
                <Field label="Segundo nombre">
                  <input type="text" value={legalMiddleName} onChange={e => setLegalMiddleName(e.target.value)} className={inputClass()} />
                </Field>
              </div>

              <RepeatableText label="Otros nombres usados" items={otherNames} setItems={setOtherNames} placeholder="Alias, nombre de soltera..." />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Fecha de nacimiento" error={errors.dob} required>
                  <input type="date" value={dob} onChange={e => setDob(e.target.value)} className={inputClass(errors.dob)} />
                </Field>
                <Field label="Ciudad de nacimiento" error={errors.cityOfBirth} required>
                  <input type="text" value={cityOfBirth} onChange={e => setCityOfBirth(e.target.value)} className={inputClass(errors.cityOfBirth)} />
                </Field>
                <Field label="Pais de nacimiento" error={errors.countryOfBirth} required>
                  <select value={countryOfBirth} onChange={e => setCountryOfBirth(e.target.value)} className={inputClass(errors.countryOfBirth)}>
                    <option value="">Seleccione</option>
                    {LATIN_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Nacionalidad" error={errors.nationality} required>
                  <select value={nationality} onChange={e => setNationality(e.target.value)} className={inputClass(errors.nationality)}>
                    <option value="">Seleccione</option>
                    {LATIN_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Sexo" error={errors.gender} required>
                  <select value={gender} onChange={e => setGender(e.target.value)} className={inputClass(errors.gender)}>
                    <option value="">Seleccione</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                  </select>
                </Field>
                <Field label="Estado civil" error={errors.maritalStatus} required>
                  <select value={maritalStatus} onChange={e => setMaritalStatus(e.target.value)} className={inputClass(errors.maritalStatus)}>
                    <option value="">Seleccione</option>
                    {['Soltero','Casado','Divorciado','Viudo','Union Libre'].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </Field>
                <Field label="SSN">
                  <input type="text" value={ssn} onChange={e => setSsn(e.target.value)} placeholder="000-00-0000" className={inputClass()} />
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Numero A (Alien Number)">
                  <input type="text" value={aNumber} onChange={e => setANumber(e.target.value)} placeholder="A-000000000" className={inputClass()} />
                </Field>
                <Field label="Cuenta en linea USCIS">
                  <input type="text" value={uscisOnlineAccount} onChange={e => setUscisOnlineAccount(e.target.value)} className={inputClass()} />
                </Field>
              </div>

              <Field label="Direccion de residencia (calle)" error={errors.resStreet} required>
                <input type="text" value={resStreet} onChange={e => setResStreet(e.target.value)} className={inputClass(errors.resStreet)} />
              </Field>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Ciudad" error={errors.resCity} required>
                  <input type="text" value={resCity} onChange={e => setResCity(e.target.value)} className={inputClass(errors.resCity)} />
                </Field>
                <Field label="Estado" error={errors.resState} required>
                  <select value={resState} onChange={e => setResState(e.target.value)} className={inputClass(errors.resState)}>
                    <option value="">Seleccione</option>
                    {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Codigo postal" error={errors.resZip} required>
                  <input type="text" value={resZip} onChange={e => setResZip(e.target.value)} className={inputClass(errors.resZip)} />
                </Field>
                <Field label="Telefono" error={errors.resPhone} required>
                  <input type="tel" value={resPhone} onChange={e => setResPhone(e.target.value)} placeholder="801-000-0000" className={inputClass(errors.resPhone)} />
                </Field>
              </div>

              <Field label="Correo electronico">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" className={inputClass()} />
              </Field>

              {/* ── Section 1.b: Historial de direcciones (ultimos 5 anios) ── */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                  <p className="text-sm font-semibold text-blue-900 mb-1">Historial de direcciones de los ultimos 5 anios</p>
                  <p className="text-xs text-blue-800">
                    Incluya TODAS las direcciones donde vivio en los ultimos 5 anios — tanto dentro como fuera de EE.UU. Si vivio en su pais de origen y luego se mudo a EE.UU., agregue ambas. Use formato dd/mm/aaaa para las fechas.
                  </p>
                </div>
                <RepeatableGroup<AddressHistoryEntry>
                  label="Direcciones de los ultimos 5 anios"
                  items={addressHistory}
                  setItems={setAddressHistory}
                  emptyItem={emptyAddressHistory}
                  renderItem={(addr, _i, update) => (
                    <div className="space-y-3">
                      <Field label="Direccion (calle)">
                        <input type="text" value={addr.addr_street} onChange={e => update('addr_street', e.target.value)} placeholder="Calle, numero, apartamento" className={inputClass()} />
                      </Field>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <Field label="Pais">
                          <input type="text" value={addr.addr_country} onChange={e => update('addr_country', e.target.value)} placeholder="Ej: Mexico, USA, Guatemala" className={inputClass()} />
                        </Field>
                        <Field label="Ciudad">
                          <input type="text" value={addr.addr_city} onChange={e => update('addr_city', e.target.value)} className={inputClass()} />
                        </Field>
                        <Field label="Estado / Provincia">
                          <input type="text" value={addr.addr_state} onChange={e => update('addr_state', e.target.value)} placeholder="Estado o provincia" className={inputClass()} />
                        </Field>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <Field label="Codigo postal (si lo hay)">
                          <input type="text" value={addr.addr_zip} onChange={e => update('addr_zip', e.target.value)} placeholder="Opcional" className={inputClass()} />
                        </Field>
                        <Field label="Desde (dd/mm/aaaa)">
                          <input type="date" value={addr.addr_from} onChange={e => update('addr_from', e.target.value)} className={inputClass()} />
                        </Field>
                        <Field label="Hasta (dd/mm/aaaa)">
                          <input type="date" value={addr.addr_to} onChange={e => update('addr_to', e.target.value)} className={inputClass()} />
                        </Field>
                      </div>
                    </div>
                  )}
                />
              </div>

              {/* ── Section 1.c: Ultima direccion en pais de origen ── */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                  <p className="text-sm font-semibold text-amber-900 mb-1">Ultima direccion donde vivio en su pais de origen</p>
                  <p className="text-xs text-amber-800">
                    Esta es la direccion completa donde vivio por ultima vez ANTES de venir a EE.UU. Es informacion clave para USCIS.
                  </p>
                </div>
                <Field label="Direccion (calle)">
                  <input type="text" value={originStreet} onChange={e => setOriginStreet(e.target.value)} placeholder="Calle, numero, apartamento, barrio..." className={inputClass()} />
                </Field>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                  <Field label="Pais">
                    <input type="text" value={originCountry} onChange={e => setOriginCountry(e.target.value)} placeholder="Pais de origen" className={inputClass()} />
                  </Field>
                  <Field label="Ciudad">
                    <input type="text" value={originCity} onChange={e => setOriginCity(e.target.value)} className={inputClass()} />
                  </Field>
                  <Field label="Estado / Provincia">
                    <input type="text" value={originState} onChange={e => setOriginState(e.target.value)} className={inputClass()} />
                  </Field>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                  <Field label="Codigo postal (si lo hay)">
                    <input type="text" value={originZip} onChange={e => setOriginZip(e.target.value)} placeholder="Opcional" className={inputClass()} />
                  </Field>
                  <Field label="Desde (dd/mm/aaaa)">
                    <input type="date" value={originFrom} onChange={e => setOriginFrom(e.target.value)} className={inputClass()} />
                  </Field>
                  <Field label="Hasta (dd/mm/aaaa)">
                    <input type="date" value={originTo} onChange={e => setOriginTo(e.target.value)} className={inputClass()} />
                  </Field>
                </div>
              </div>
            </div>
          </SectionAccordion>

          {/* ── Section 2: Informacion de Inmigracion ── */}
          <SectionAccordion section={sections[1]} isOpen={openSections.has(2)} onToggle={() => toggleSection(2)}
            hasErrors={['currentImmigrationStatus','dateOfLastEntry','placeOfLastEntry'].some(k => errors[k])}>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Estatus migratorio actual" error={errors.currentImmigrationStatus} required>
                  <select value={currentImmigrationStatus} onChange={e => setCurrentImmigrationStatus(e.target.value)} className={inputClass(errors.currentImmigrationStatus)}>
                    <option value="">Seleccione</option>
                    {IMMIGRATION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                {currentImmigrationStatus === 'Otro' && (
                  <Field label="Especifique estatus">
                    <input type="text" value={currentStatusOther} onChange={e => setCurrentStatusOther(e.target.value)} className={inputClass()} />
                  </Field>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Fecha de ultima entrada a EE.UU." error={errors.dateOfLastEntry} required>
                  <input type="date" value={dateOfLastEntry} onChange={e => setDateOfLastEntry(e.target.value)} className={inputClass(errors.dateOfLastEntry)} />
                </Field>
                <Field label="Lugar de ultima entrada" error={errors.placeOfLastEntry} required>
                  <input type="text" value={placeOfLastEntry} onChange={e => setPlaceOfLastEntry(e.target.value)} placeholder="Puerto de entrada, aeropuerto..." className={inputClass(errors.placeOfLastEntry)} />
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Numero I-94">
                  <input type="text" value={i94Number} onChange={e => setI94Number(e.target.value)} className={inputClass()} />
                </Field>
                <Field label="Estatus de entrada al llegar">
                  <input type="text" value={entryStatusAtArrival} onChange={e => setEntryStatusAtArrival(e.target.value)} placeholder="Ej: B-2, Parole..." className={inputClass()} />
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Numero de pasaporte">
                  <input type="text" value={passportNumber} onChange={e => setPassportNumber(e.target.value)} className={inputClass()} />
                </Field>
                <Field label="Pais del pasaporte">
                  <select value={passportCountry} onChange={e => setPassportCountry(e.target.value)} className={inputClass()}>
                    <option value="">Seleccione</option>
                    {LATIN_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Expiracion del pasaporte">
                  <input type="date" value={passportExpiry} onChange={e => setPassportExpiry(e.target.value)} className={inputClass()} />
                </Field>
              </div>

              <Field label="Fecha de expiracion del estatus actual">
                <input type="date" value={currentStatusExpires} onChange={e => setCurrentStatusExpires(e.target.value)} className={inputClass()} />
              </Field>

              <Checkbox label="¿Ha estado en procesos de deportacion/remocion?" checked={everInRemovalProceedings} onChange={setEverInRemovalProceedings} />
              {everInRemovalProceedings && (
                <Field label="Detalles del proceso de remocion">
                  <textarea value={removalDetails} onChange={e => setRemovalDetails(e.target.value)} rows={3} placeholder="Explique las circunstancias..." className={inputClass()} />
                </Field>
              )}

              <Checkbox label="¿Alguna vez le han negado una visa o la entrada a EE.UU.?" checked={everDeniedVisaOrEntry} onChange={setEverDeniedVisaOrEntry} />
              {everDeniedVisaOrEntry && (
                <Field label="Detalles de la negacion">
                  <textarea value={denialDetails} onChange={e => setDenialDetails(e.target.value)} rows={3} placeholder="Explique las circunstancias..." className={inputClass()} />
                </Field>
              )}
            </div>
          </SectionAccordion>

          {/* ── Section 3: Informacion del Peticionario/Patrocinador ── */}
          <SectionAccordion section={sections[2]} isOpen={openSections.has(3)} onToggle={() => toggleSection(3)}
            hasErrors={['petitionerType','petitionerFullName','petitionerRelationship'].some(k => errors[k])}>
            <div className="space-y-4">
              <Field label="Tipo de peticionario" error={errors.petitionerType} required>
                <select value={petitionerType} onChange={e => setPetitionerType(e.target.value)} className={inputClass(errors.petitionerType)}>
                  <option value="">Seleccione</option>
                  {PETITIONER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Nombre completo del peticionario" error={errors.petitionerFullName} required>
                  <input type="text" value={petitionerFullName} onChange={e => setPetitionerFullName(e.target.value)} placeholder="Nombre y apellido completo" className={inputClass(errors.petitionerFullName)} />
                </Field>
                <Field label="Relacion con el solicitante" error={errors.petitionerRelationship} required>
                  <input type="text" value={petitionerRelationship} onChange={e => setPetitionerRelationship(e.target.value)} placeholder="Ej: Esposo/a, Padre, Empleador..." className={inputClass(errors.petitionerRelationship)} />
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Numero A del peticionario">
                  <input type="text" value={petitionerANumber} onChange={e => setPetitionerANumber(e.target.value)} placeholder="A-000000000" className={inputClass()} />
                </Field>
                <Field label="Fecha de nacimiento del peticionario">
                  <input type="date" value={petitionerDob} onChange={e => setPetitionerDob(e.target.value)} className={inputClass()} />
                </Field>
                <Field label="Pais de nacimiento del peticionario">
                  <select value={petitionerCountryOfBirth} onChange={e => setPetitionerCountryOfBirth(e.target.value)} className={inputClass()}>
                    <option value="">Seleccione</option>
                    {LATIN_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Numero de recibo de peticion">
                  <input type="text" value={petitionReceiptNumber} onChange={e => setPetitionReceiptNumber(e.target.value)} placeholder="Ej: MSC-XXX-XXX-XXXX" className={inputClass()} />
                </Field>
                <Field label="Fecha de prioridad">
                  <input type="date" value={petitionPriorityDate} onChange={e => setPetitionPriorityDate(e.target.value)} className={inputClass()} />
                </Field>
                <Field label="Categoria de peticion">
                  <select value={petitionCategory} onChange={e => setPetitionCategory(e.target.value)} className={inputClass()}>
                    <option value="">Seleccione</option>
                    {PETITION_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
              </div>
            </div>
          </SectionAccordion>

          {/* ── Section 4: Informacion Familiar ── */}
          <SectionAccordion section={sections[3]} isOpen={openSections.has(4)} onToggle={() => toggleSection(4)}>
            <div className="space-y-4">
              <Checkbox label="¿Tiene conyuge?" checked={hasSpouse} onChange={setHasSpouse} />
              {hasSpouse && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  <p className="text-sm font-medium text-[#002855]">Informacion del Conyuge</p>
                  <Field label="Nombre completo del conyuge">
                    <input type="text" value={spouseFullName} onChange={e => setSpouseFullName(e.target.value)} placeholder="Nombre y apellido" className={inputClass()} />
                  </Field>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Field label="Fecha de nacimiento">
                      <input type="date" value={spouseDob} onChange={e => setSpouseDob(e.target.value)} className={inputClass()} />
                    </Field>
                    <Field label="Pais de nacimiento">
                      <select value={spouseCountryOfBirth} onChange={e => setSpouseCountryOfBirth(e.target.value)} className={inputClass()}>
                        <option value="">Seleccione</option>
                        {LATIN_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </Field>
                    <Field label="Numero A">
                      <input type="text" value={spouseANumber} onChange={e => setSpouseANumber(e.target.value)} placeholder="A-000000000" className={inputClass()} />
                    </Field>
                  </div>
                  <Field label="Estatus migratorio del conyuge">
                    <input type="text" value={spouseImmigrationStatus} onChange={e => setSpouseImmigrationStatus(e.target.value)} className={inputClass()} />
                  </Field>
                  <Checkbox label="¿Incluir conyuge en esta solicitud?" checked={spouseIncluded} onChange={setSpouseIncluded} />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Field label="Fecha de matrimonio">
                      <input type="date" value={marriageDate} onChange={e => setMarriageDate(e.target.value)} className={inputClass()} />
                    </Field>
                    <Field label="Ciudad de matrimonio">
                      <input type="text" value={marriageCity} onChange={e => setMarriageCity(e.target.value)} className={inputClass()} />
                    </Field>
                    <Field label="Estado de matrimonio">
                      <select value={marriageState} onChange={e => setMarriageState(e.target.value)} className={inputClass()}>
                        <option value="">Seleccione</option>
                        {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </Field>
                  </div>
                </div>
              )}

              <Checkbox label="¿Tiene hijos?" checked={hasChildren} onChange={setHasChildren} />
              {hasChildren && (
                <RepeatableGroup<ChildEntry> label="Hijos" items={children} setItems={setChildren} emptyItem={emptyChild}
                  renderItem={(child, i, update) => (
                    <div className="space-y-3">
                      <Field label="Nombre completo del hijo/a">
                        <input type="text" value={child.child_full_name} onChange={e => update('child_full_name', e.target.value)} className={inputClass()} />
                      </Field>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <Field label="Fecha de nacimiento">
                          <input type="date" value={child.child_dob} onChange={e => update('child_dob', e.target.value)} className={inputClass()} />
                        </Field>
                        <Field label="Pais de nacimiento">
                          <select value={child.child_country_of_birth} onChange={e => update('child_country_of_birth', e.target.value)} className={inputClass()}>
                            <option value="">Seleccione</option>
                            {LATIN_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </Field>
                        <Field label="Numero A">
                          <input type="text" value={child.child_a_number} onChange={e => update('child_a_number', e.target.value)} placeholder="A-000000000" className={inputClass()} />
                        </Field>
                      </div>
                      <Checkbox label="¿Esta en EE.UU.?" checked={child.child_in_us} onChange={v => update('child_in_us', v)} />
                      <Checkbox label="¿Incluir en esta solicitud?" checked={child.child_included} onChange={v => update('child_included', v)} />
                    </div>
                  )} />
              )}
            </div>
          </SectionAccordion>

          {/* ── Section 5: Historial de Empleo y Educacion (ultimos 5 anios) ── */}
          <SectionAccordion section={sections[4]} isOpen={openSections.has(5)} onToggle={() => toggleSection(5)}>
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm font-semibold text-amber-900 mb-1">Informacion de los ultimos 5 anios</p>
                <p className="text-xs text-amber-800">
                  Incluya empleos y estudios tanto en su pais de origen como en EE.UU. durante los ultimos 5 anios. Use el formato dd/mm/aaaa en las fechas.
                </p>
              </div>

              <RepeatableGroup<EmploymentEntry> label="Historial de empleo" items={employments} setItems={setEmployments} emptyItem={emptyEmployment}
                renderItem={(emp, _i, update) => (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Field label="Nombre de la empresa">
                        <input type="text" value={emp.emp_employer} onChange={e => update('emp_employer', e.target.value)} className={inputClass()} />
                      </Field>
                      <Field label="Nombre del jefe / supervisor">
                        <input type="text" value={emp.emp_supervisor} onChange={e => update('emp_supervisor', e.target.value)} className={inputClass()} />
                      </Field>
                    </div>
                    <Field label="Cargo / Ocupacion">
                      <input type="text" value={emp.emp_occupation} onChange={e => update('emp_occupation', e.target.value)} className={inputClass()} />
                    </Field>
                    <Field label="Direccion">
                      <input type="text" value={emp.emp_address} onChange={e => update('emp_address', e.target.value)} className={inputClass()} />
                    </Field>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <Field label="Pais">
                        <input type="text" value={emp.emp_country} onChange={e => update('emp_country', e.target.value)} placeholder="Ej: Mexico, USA" className={inputClass()} />
                      </Field>
                      <Field label="Ciudad">
                        <input type="text" value={emp.emp_city} onChange={e => update('emp_city', e.target.value)} className={inputClass()} />
                      </Field>
                      <Field label="Estado / Provincia">
                        <input type="text" value={emp.emp_state} onChange={e => update('emp_state', e.target.value)} placeholder="Estado o provincia" className={inputClass()} />
                      </Field>
                      <Field label="Codigo postal (si lo hay)">
                        <input type="text" value={emp.emp_zip} onChange={e => update('emp_zip', e.target.value)} placeholder="Opcional" className={inputClass()} />
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Desde (dd/mm/aaaa)">
                        <input type="date" value={emp.emp_from} onChange={e => update('emp_from', e.target.value)} className={inputClass()} />
                      </Field>
                      <Field label="Hasta (dd/mm/aaaa)">
                        <input type="date" value={emp.emp_to} onChange={e => update('emp_to', e.target.value)} className={inputClass()} />
                      </Field>
                    </div>
                  </div>
                )} />

              <RepeatableGroup<EducationEntry> label="Historial de educacion" items={educationList} setItems={setEducationList} emptyItem={emptyEducation}
                renderItem={(edu, _i, update) => (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Field label="Nombre del colegio / institucion">
                        <input type="text" value={edu.edu_school} onChange={e => update('edu_school', e.target.value)} className={inputClass()} />
                      </Field>
                      <Field label="Que estudio">
                        <select value={edu.edu_type} onChange={e => update('edu_type', e.target.value)} className={inputClass()}>
                          <option value="">Seleccione</option>
                          {EDUCATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </Field>
                    </div>
                    <Field label="Direccion">
                      <input type="text" value={edu.edu_address} onChange={e => update('edu_address', e.target.value)} className={inputClass()} />
                    </Field>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <Field label="Pais">
                        <input type="text" value={edu.edu_country} onChange={e => update('edu_country', e.target.value)} className={inputClass()} />
                      </Field>
                      <Field label="Ciudad">
                        <input type="text" value={edu.edu_city} onChange={e => update('edu_city', e.target.value)} className={inputClass()} />
                      </Field>
                      <Field label="Estado / Provincia">
                        <input type="text" value={edu.edu_state} onChange={e => update('edu_state', e.target.value)} className={inputClass()} />
                      </Field>
                      <Field label="Codigo postal (si lo hay)">
                        <input type="text" value={edu.edu_zip} onChange={e => update('edu_zip', e.target.value)} placeholder="Opcional" className={inputClass()} />
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Desde (dd/mm/aaaa)">
                        <input type="date" value={edu.edu_from} onChange={e => update('edu_from', e.target.value)} className={inputClass()} />
                      </Field>
                      <Field label="Hasta (dd/mm/aaaa)">
                        <input type="date" value={edu.edu_to} onChange={e => update('edu_to', e.target.value)} className={inputClass()} />
                      </Field>
                    </div>
                  </div>
                )} />
            </div>
          </SectionAccordion>

          {/* ── Section 6: Preguntas de Admisibilidad ── */}
          <SectionAccordion section={sections[5]} isOpen={openSections.has(6)} onToggle={() => toggleSection(6)}>
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm font-medium text-amber-800">Responda con honestidad. Proporcionar informacion falsa puede resultar en la negacion de su caso.</p>
              </div>

              <Checkbox label="¿Ha sido arrestado, citado o detenido?" checked={criminalArrest} onChange={setCriminalArrest} />
              {criminalArrest && (
                <Field label="Detalles del arresto">
                  <textarea value={criminalDetails} onChange={e => setCriminalDetails(e.target.value)} rows={3} placeholder="Explique las circunstancias, fechas y resultados..." className={inputClass()} />
                </Field>
              )}

              <Checkbox label="¿Ha sido condenado por algun delito?" checked={criminalConviction} onChange={setCriminalConviction} />
              {criminalConviction && (
                <Field label="Detalles de la condena">
                  <textarea value={convictionDetails} onChange={e => setConvictionDetails(e.target.value)} rows={3} placeholder="Tipo de delito, fecha, sentencia..." className={inputClass()} />
                </Field>
              )}

              <Checkbox label="¿Ha violado leyes de sustancias controladas?" checked={drugRelated} onChange={setDrugRelated} />
              {drugRelated && (
                <Field label="Detalles">
                  <textarea value={drugDetails} onChange={e => setDrugDetails(e.target.value)} rows={3} className={inputClass()} />
                </Field>
              )}

              <Checkbox label="¿Ha cometido fraude de inmigracion?" checked={immigrationFraud} onChange={setImmigrationFraud} />
              {immigrationFraud && (
                <Field label="Detalles del fraude">
                  <textarea value={fraudDetails} onChange={e => setFraudDetails(e.target.value)} rows={3} className={inputClass()} />
                </Field>
              )}

              <Checkbox label="¿Ha reclamado ser ciudadano de EE.UU. falsamente?" checked={falseUsCitizen} onChange={setFalseUsCitizen} />
              {falseUsCitizen && (
                <Field label="Detalles">
                  <textarea value={citizenDetails} onChange={e => setCitizenDetails(e.target.value)} rows={3} className={inputClass()} />
                </Field>
              )}

              <Checkbox label="¿Ha sido deportado o removido?" checked={removedDeported} onChange={setRemovedDeported} />
              {removedDeported && (
                <Field label="Detalles de la deportacion">
                  <textarea value={removedDetails} onChange={e => setRemovedDetails(e.target.value)} rows={3} className={inputClass()} />
                </Field>
              )}

              <Checkbox label="¿Ha permanecido ilegalmente en EE.UU.?" checked={unlawfulPresence} onChange={setUnlawfulPresence} />
              {unlawfulPresence && (
                <Field label="Detalles de la permanencia ilegal">
                  <textarea value={unlawfulDetails} onChange={e => setUnlawfulDetails(e.target.value)} rows={3} placeholder="Periodos y circunstancias..." className={inputClass()} />
                </Field>
              )}

              <Checkbox label="¿Ha recibido asistencia publica?" checked={publicCharge} onChange={setPublicCharge} />
              {publicCharge && (
                <Field label="Detalles de la asistencia publica">
                  <textarea value={publicChargeDetails} onChange={e => setPublicChargeDetails(e.target.value)} rows={3} placeholder="Tipo de asistencia, periodos..." className={inputClass()} />
                </Field>
              )}
            </div>
          </SectionAccordion>

          {/* ── Section 7: Documentos y Declaracion ── */}
          <SectionAccordion section={sections[6]} isOpen={openSections.has(7)} onToggle={() => toggleSection(7)}
            hasErrors={!!errors.applicantDeclaration}>
            <div className="space-y-4">
              <Checkbox label="¿Ya tiene el examen medico I-693?" checked={hasMedicalExam} onChange={setHasMedicalExam} />
              <Checkbox label="¿Tiene el I-864 Affidavit of Support?" checked={hasAffidavitSupport} onChange={setHasAffidavitSupport} />

              <Field label="Informacion adicional">
                <textarea value={additionalInfo} onChange={e => setAdditionalInfo(e.target.value)} rows={4} placeholder="Cualquier informacion adicional que desee incluir en su solicitud..." className={inputClass()} />
              </Field>

              <div className={`bg-gray-50 rounded-lg p-4 border ${errors.applicantDeclaration ? 'border-red-400' : 'border-gray-200'}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={applicantDeclaration} onChange={e => setApplicantDeclaration(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-[#002855] focus:ring-[#002855] mt-0.5" />
                  <span className="text-sm text-gray-700">
                    <span className="text-red-500 font-bold mr-1">*</span>
                    Declaro que la informacion proporcionada en este formulario es verdadera y correcta hasta donde yo se y entiendo.
                    Entiendo que cualquier informacion falsa puede resultar en la negacion de mi solicitud de Ajuste de Estatus.
                  </span>
                </label>
                {errors.applicantDeclaration && <p className="text-xs text-red-600 mt-2 ml-8">{errors.applicantDeclaration}</p>}
              </div>
            </div>
          </SectionAccordion>

          {/* ── Section 8: Informacion Biografica (Part 8 del I-485 oficial) ── */}
          <SectionAccordion section={sections[7]} isOpen={openSections.has(8)} onToggle={() => toggleSection(8)}>
            <div className="space-y-5">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm font-semibold text-blue-900 mb-1">Part 8 — Informacion Biografica</p>
                <p className="text-xs text-blue-800">
                  Estos datos los pide USCIS en el formulario oficial I-485 Part 8. Responda con la informacion que mejor describa su apariencia fisica.
                </p>
              </div>

              {/* Etnicidad */}
              <Field label="Etnicidad (seleccione una)" required>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { value: 'hispanic', label: 'Hispano o Latino' },
                    { value: 'not_hispanic', label: 'No Hispano ni Latino' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setBioEthnicity(opt.value as 'hispanic' | 'not_hispanic')}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        bioEthnicity === opt.value
                          ? 'border-[#002855] bg-[#002855]/10 text-[#002855]'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </Field>

              {/* Raza */}
              <Field label="Raza (seleccione todas las que apliquen)">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {RACE_OPTIONS.map(race => {
                    const checked = bioRaces.includes(race)
                    return (
                      <label
                        key={race}
                        className={`flex items-center gap-2 cursor-pointer rounded-lg p-2 border transition-colors ${
                          checked ? 'border-[#002855] bg-[#002855]/5' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) setBioRaces(prev => [...prev, race])
                            else setBioRaces(prev => prev.filter(r => r !== race))
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-[#002855] focus:ring-[#002855]"
                        />
                        <span className="text-sm text-gray-700">{race}</span>
                      </label>
                    )
                  })}
                </div>
              </Field>

              {/* Estatura y peso */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Estatura — Pies" required>
                  <select value={bioHeightFeet} onChange={e => setBioHeightFeet(e.target.value)} className={inputClass()}>
                    <option value="">-</option>
                    {[3, 4, 5, 6, 7].map(f => <option key={f} value={String(f)}>{f}</option>)}
                  </select>
                </Field>
                <Field label="Estatura — Pulgadas">
                  <select value={bioHeightInches} onChange={e => setBioHeightInches(e.target.value)} className={inputClass()}>
                    <option value="">-</option>
                    {Array.from({ length: 12 }).map((_, i) => <option key={i} value={String(i)}>{i}</option>)}
                  </select>
                </Field>
                <Field label="Peso (libras / lbs)" required>
                  <input
                    type="number"
                    value={bioWeightLbs}
                    onChange={e => setBioWeightLbs(e.target.value)}
                    placeholder="Ej: 150"
                    min={50}
                    max={500}
                    className={inputClass()}
                  />
                </Field>
              </div>

              {/* Color de ojos y pelo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Color de ojos" required>
                  <select value={bioEyeColor} onChange={e => setBioEyeColor(e.target.value)} className={inputClass()}>
                    <option value="">Seleccione</option>
                    {EYE_COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Color de pelo" required>
                  <select value={bioHairColor} onChange={e => setBioHairColor(e.target.value)} className={inputClass()}>
                    <option value="">Seleccione</option>
                    {HAIR_COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
              </div>
            </div>
          </SectionAccordion>

          <button type="submit" disabled={submitting}
            className="w-full bg-[#F2A900] text-white py-4 rounded-xl font-semibold text-lg hover:bg-[#D4940A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg">
            {submitting ? (<><Loader2 className="w-5 h-5 animate-spin" />Enviando...</>) : 'Enviar Formulario I-485'}
          </button>
          <p className="text-xs text-center text-blue-200 mt-4 pb-8">
            Su informacion es confidencial y esta protegida. Solo sera utilizada para su solicitud de Ajuste de Estatus.
          </p>
        </form>
      </main>
    </div>
  )
}

// ── Helper Components ──

function inputClass(error?: string) {
  return `w-full px-3 py-2 border ${error ? 'border-red-500 bg-red-50' : 'border-gray-300'} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#002855]/30 focus:border-[#002855] transition-colors`
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

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer bg-gray-50 rounded-lg p-3">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="w-5 h-5 rounded border-gray-300 text-[#002855] focus:ring-[#002855]" />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  )
}

function SectionAccordion({ section, isOpen, onToggle, hasErrors, children }: {
  section: { id: number; title: string }; isOpen: boolean; onToggle: () => void; hasErrors?: boolean; children: React.ReactNode
}) {
  return (
    <div className={`bg-white rounded-2xl shadow-2xl border ${hasErrors ? 'border-red-300' : 'border-gray-200'} overflow-hidden text-gray-900`}>
      <button type="button" onClick={onToggle}
        className={`w-full flex items-center justify-between p-4 text-left transition-colors ${isOpen ? 'bg-[#002855] text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${hasErrors ? 'bg-red-100 text-red-700' : isOpen ? 'bg-[#F2A900] text-[#002855]' : 'bg-[#002855] text-white'}`}>{section.id}</div>
          <span className="font-semibold">{section.title}</span>
          {hasErrors && <span className={`text-xs font-medium ${isOpen ? 'text-red-300' : 'text-red-600'}`}>Campos pendientes</span>}
        </div>
        {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>
      {isOpen && <div className="px-4 pb-4 pt-4">{children}</div>}
    </div>
  )
}

function RepeatableText({ label, items, setItems, placeholder }: { label: string; items: string[]; setItems: (v: string[]) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 mb-2">
          <input type="text" value={item} onChange={e => { const next = [...items]; next[i] = e.target.value; setItems(next) }} placeholder={placeholder} className={inputClass()} />
          <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-700 px-2"><X className="w-4 h-4" /></button>
        </div>
      ))}
      <button type="button" onClick={() => setItems([...items, ''])} className="text-xs text-[#002855] font-medium flex items-center gap-1 hover:underline">
        <Plus className="w-3.5 h-3.5" /> Agregar otro nombre
      </button>
    </div>
  )
}

function RepeatableGroup<T extends Record<string, any>>({ label, items, setItems, emptyItem, renderItem }: {
  label: string; items: T[]; setItems: (v: T[]) => void; emptyItem: T;
  renderItem: (item: T, index: number, update: (field: string, value: any) => void) => React.ReactNode
}) {
  function addItem() { setItems([...items, { ...emptyItem }]) }
  function removeItem(index: number) { setItems(items.filter((_, i) => i !== index)) }
  function updateItem(index: number, field: string, value: any) {
    setItems(items.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-2">{label}</label>
      {items.map((item, i) => (
        <div key={i} className="bg-gray-50 rounded-lg p-3 mb-2 relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500">#{i + 1}</span>
            <button type="button" onClick={() => removeItem(i)} className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> Eliminar
            </button>
          </div>
          {renderItem(item, i, (field, value) => updateItem(i, field, value))}
        </div>
      ))}
      <button type="button" onClick={addItem} className="text-xs text-[#002855] font-medium flex items-center gap-1 hover:underline mt-1">
        <Plus className="w-3.5 h-3.5" /> Agregar otro
      </button>
    </div>
  )
}
