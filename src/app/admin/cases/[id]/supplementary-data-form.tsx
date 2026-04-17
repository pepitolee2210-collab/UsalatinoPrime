'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Save, ChevronDown, ChevronUp, AlertCircle, CheckCircle, Sparkles, Loader2 } from 'lucide-react'

interface SupplementaryDataFormProps {
  caseId: string
  tutorData: Record<string, unknown> | null
  minorStories: { minorIndex: number; formData: Record<string, unknown> }[]
  absentParents: { formData: Record<string, unknown> }[]
}

interface FieldDef {
  key: string
  label: string
  placeholder: string
  section: string
  sectionLabel: string
  value: string
  source: 'form' | 'supplementary' | 'empty'
}

function Input({ label, value, onChange, placeholder, status }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
  status: 'filled' | 'empty' | 'edited'
}) {
  const borderClass = status === 'filled' ? 'border-green-200 bg-green-50/30' :
                      status === 'edited' ? 'border-amber-300 bg-amber-50/60' :
                      'border-red-200 bg-red-50/30'
  const Icon = status === 'filled' ? CheckCircle : AlertCircle
  const iconColor = status === 'filled' ? 'text-green-500' : status === 'edited' ? 'text-amber-500' : 'text-red-400'
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1">
        <Icon className={`w-3 h-3 ${iconColor}`} />
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-[#F2A900]/30 focus:border-[#F2A900] outline-none ${borderClass}`}
      />
    </div>
  )
}

// Check if value is "bogus" (like "00000", empty, or too short)
function isBogus(v: string) {
  if (!v) return true
  const trimmed = v.trim()
  if (trimmed.length < 2) return true
  if (/^0+$/.test(trimmed)) return true
  return false
}

function cleanValue(v: string): string {
  return isBogus(v) ? '' : v.trim()
}

export function SupplementaryDataForm({ caseId, tutorData, minorStories, absentParents }: SupplementaryDataFormProps) {
  const [suppData, setSuppData] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [open, setOpen] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [localValues, setLocalValues] = useState<Record<string, string>>({})

  const tutorName = (tutorData?.full_name as string) || 'Tutor'
  const witnesses = ((tutorData?.witnesses as Array<Record<string, string>>) || []).filter(w => w.name?.trim())
  const additionalMinors = ((tutorData?.additional_minors as Array<Record<string, string>>) || [])

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/cases/supplementary-data?case_id=${caseId}`)
      if (res.ok) {
        const json = await res.json()
        if (json.data) setSuppData(json.data)
      }
    } catch { /* ignore */ }
    setLoaded(true)
  }, [caseId])

  useEffect(() => { load() }, [load])

  function buildAllFields(): FieldDef[] {
    const fields: FieldDef[] = []

    // === GENERAL ===
    const courtName = cleanValue(suppData?.court?.name || '')
    fields.push({
      key: 'court_name',
      label: 'Nombre del Tribunal/Corte',
      placeholder: 'Ej: Probate Court of Madison County, Jackson, Tennessee',
      section: 'general', sectionLabel: 'Información General',
      value: courtName, source: courtName ? 'supplementary' : 'empty'
    })

    const signingDate = cleanValue(suppData?.signing_date || '')
    fields.push({
      key: 'signing_date',
      label: 'Fecha de Firma (se puede dejar en blanco)',
      placeholder: 'Ej: 2 de abril de 2026',
      section: 'general', sectionLabel: 'Información General',
      value: signingDate, source: signingDate ? 'supplementary' : 'empty'
    })

    // === TUTOR ===
    const tutorDob = cleanValue((tutorData?.date_of_birth as string) || suppData?.guardian?.date_of_birth || '')
    fields.push({
      key: 'guardian_dob',
      label: 'Fecha de Nacimiento del Tutor',
      placeholder: 'Ej: 15 de marzo de 1990',
      section: 'guardian', sectionLabel: `Tutor — ${tutorName}`,
      value: tutorDob, source: cleanValue(tutorData?.date_of_birth as string || '') ? 'form' : (tutorDob ? 'supplementary' : 'empty')
    })

    const tutorCountryBirth = cleanValue((tutorData?.country_of_birth as string) || suppData?.guardian?.country_of_birth || '')
    fields.push({
      key: 'guardian_country_birth',
      label: 'País de Nacimiento del Tutor',
      placeholder: 'Ej: Venezuela, Ecuador, Perú',
      section: 'guardian', sectionLabel: `Tutor — ${tutorName}`,
      value: tutorCountryBirth, source: cleanValue(tutorData?.country_of_birth as string || '') ? 'form' : (tutorCountryBirth ? 'supplementary' : 'empty')
    })

    const tutorCityBirth = cleanValue((tutorData?.city_of_birth as string) || suppData?.guardian?.city_of_birth || '')
    fields.push({
      key: 'guardian_city_birth',
      label: 'Ciudad de Nacimiento del Tutor',
      placeholder: 'Ej: Caracas, Lima, Guayaquil',
      section: 'guardian', sectionLabel: `Tutor — ${tutorName}`,
      value: tutorCityBirth, source: cleanValue(tutorData?.city_of_birth as string || '') ? 'form' : (tutorCityBirth ? 'supplementary' : 'empty')
    })

    const tutorNationality = cleanValue((tutorData?.nationality as string) || suppData?.guardian?.nationality || '')
    fields.push({
      key: 'guardian_nationality',
      label: 'Nacionalidad del Tutor',
      placeholder: 'Ej: Venezolana, Peruana',
      section: 'guardian', sectionLabel: `Tutor — ${tutorName}`,
      value: tutorNationality, source: cleanValue(tutorData?.nationality as string || '') ? 'form' : (tutorNationality ? 'supplementary' : 'empty')
    })

    const tutorId = cleanValue((tutorData?.id_number as string) || suppData?.guardian?.id_number || '')
    fields.push({
      key: 'guardian_id_number',
      label: 'No. Pasaporte/Cédula del Tutor',
      placeholder: 'Número de documento de identidad',
      section: 'guardian', sectionLabel: `Tutor — ${tutorName}`,
      value: tutorId, source: cleanValue(tutorData?.id_number as string || '') ? 'form' : (tutorId ? 'supplementary' : 'empty')
    })

    // === ABSENT PARENTS ===
    const tutorAbsentName = cleanValue(tutorData?.absent_parent_name as string || '')
    const tutorAbsentNationality = cleanValue(tutorData?.absent_parent_nationality as string || '')
    const tutorAbsentPassport = cleanValue(tutorData?.absent_parent_passport as string || '')
    const tutorAbsentId = cleanValue(tutorData?.absent_parent_id as string || '')

    // Build list of absent parents to show (at least one if there's any minor)
    const absentParentsList = absentParents.length > 0
      ? absentParents.map((ap, i) => ({ apData: ap.formData as Record<string, string>, index: i }))
      : tutorAbsentName ? [{ apData: {} as Record<string, string>, index: 0 }] : []

    absentParentsList.forEach(({ apData, index: i }) => {
      const name = cleanValue(apData?.parent_name || '') || tutorAbsentName || `Padre ${i + 1}`
      const suppParent = suppData?.absent_parents?.[i] || {}

      // Parent name (show too - admin might need to correct)
      fields.push({
        key: `parent_${i}_name`,
        label: 'Nombre Completo',
        placeholder: 'Nombre del padre/madre ausente',
        section: `parent_${i}`, sectionLabel: `Padre/Madre Ausente #${i + 1}`,
        value: name, source: cleanValue(apData?.parent_name || '') ? 'form' : (name ? 'supplementary' : 'empty')
      })

      const nationality = cleanValue(apData?.parent_nationality || '') ||
                         cleanValue(apData?.absent_parent_nationality || '') ||
                         tutorAbsentNationality ||
                         cleanValue(suppParent.nationality || '')
      fields.push({
        key: `parent_${i}_nationality`,
        label: 'Nacionalidad',
        placeholder: 'Ej: Ecuatoriano, Peruano',
        section: `parent_${i}`, sectionLabel: `Padre/Madre Ausente #${i + 1} — ${name}`,
        value: nationality,
        source: (cleanValue(apData?.parent_nationality || '') || tutorAbsentNationality) ? 'form' : (nationality ? 'supplementary' : 'empty')
      })

      const passport = cleanValue(apData?.parent_passport || '') ||
                      cleanValue(apData?.parent_id_number || '') ||
                      cleanValue(apData?.absent_parent_passport || '') ||
                      cleanValue(apData?.absent_parent_id || '') ||
                      tutorAbsentPassport ||
                      tutorAbsentId ||
                      cleanValue(suppParent.passport || '')
      fields.push({
        key: `parent_${i}_passport`,
        label: 'No. Pasaporte/Cédula/DNI',
        placeholder: 'Número de documento',
        section: `parent_${i}`, sectionLabel: `Padre/Madre Ausente #${i + 1} — ${name}`,
        value: passport,
        source: (cleanValue(apData?.parent_passport || '') || cleanValue(apData?.parent_id_number || '') || tutorAbsentPassport || tutorAbsentId) ? 'form' : (passport ? 'supplementary' : 'empty')
      })

      const country = cleanValue(apData?.parent_country || '') ||
                     cleanValue(apData?.absent_parent_country || '') ||
                     cleanValue(tutorData?.absent_parent_country as string || '') ||
                     cleanValue(suppParent.country || '')
      fields.push({
        key: `parent_${i}_country`,
        label: 'País de Residencia Actual',
        placeholder: 'Ej: Ecuador, Panamá, EE.UU.',
        section: `parent_${i}`, sectionLabel: `Padre/Madre Ausente #${i + 1} — ${name}`,
        value: country,
        source: cleanValue(apData?.parent_country || '') ? 'form' : (country ? 'supplementary' : 'empty')
      })
    })

    // === MINORS from client_story + additional_minors from tutor ===
    // Combine both sources
    const allMinors: { source: 'story' | 'additional'; idx: number; data: Record<string, string>; name: string }[] = []

    minorStories.forEach((s, i) => {
      const mb = (s.formData?.minorBasic || {}) as Record<string, string>
      const mi = (s.formData?.minor_info || {}) as Record<string, string>
      const name = cleanValue(mb.full_name || '') || cleanValue(mi.name || '') || `Menor ${i + 1}`
      allMinors.push({ source: 'story', idx: i, data: mb, name })
    })

    // Add any additional_minors from tutor that aren't already covered
    additionalMinors.forEach((am, i) => {
      const name = cleanValue(am.name || '') || `Menor Adicional ${i + 1}`
      // Only add if not already in allMinors (by name match)
      if (!allMinors.some(m => m.name.toLowerCase().trim() === name.toLowerCase().trim())) {
        allMinors.push({ source: 'additional', idx: i, data: am, name })
      }
    })

    allMinors.forEach((m, i) => {
      const suppMinor = suppData?.minors?.[i] || {}
      const data = m.data

      // Birth city
      const birthCity = cleanValue(data.birth_city || '') ||
                       cleanValue(data.city || '') ||
                       cleanValue(suppMinor.birth_city || '')
      fields.push({
        key: `minor_${i}_birth_city`,
        label: 'Ciudad de Nacimiento',
        placeholder: 'Ej: Caracas, Lima',
        section: `minor_${i}`, sectionLabel: `Menor #${i + 1} — ${m.name}`,
        value: birthCity,
        source: (cleanValue(data.birth_city || '') || cleanValue(data.city || '')) ? 'form' : (birthCity ? 'supplementary' : 'empty')
      })

      // Country of birth (for additional_minors, there's a "country" field)
      const country = cleanValue(data.country || '') || cleanValue(suppMinor.country || '')
      fields.push({
        key: `minor_${i}_country`,
        label: 'País de Nacimiento',
        placeholder: 'Ej: Venezuela, Perú',
        section: `minor_${i}`, sectionLabel: `Menor #${i + 1} — ${m.name}`,
        value: country,
        source: cleanValue(data.country || '') ? 'form' : (country ? 'supplementary' : 'empty')
      })

      // DOB
      const dob = cleanValue(data.dob || '') || cleanValue(suppMinor.dob || '')
      fields.push({
        key: `minor_${i}_dob`,
        label: 'Fecha de Nacimiento',
        placeholder: 'YYYY-MM-DD',
        section: `minor_${i}`, sectionLabel: `Menor #${i + 1} — ${m.name}`,
        value: dob,
        source: cleanValue(data.dob || '') ? 'form' : (dob ? 'supplementary' : 'empty')
      })

      // ID Type
      const idType = cleanValue(data.id_type || '') || cleanValue(suppMinor.id_type || '')
      fields.push({
        key: `minor_${i}_id_type`,
        label: 'Tipo de Documento',
        placeholder: 'Ej: Pasaporte, Acta de Nacimiento',
        section: `minor_${i}`, sectionLabel: `Menor #${i + 1} — ${m.name}`,
        value: idType,
        source: cleanValue(data.id_type || '') ? 'form' : (idType ? 'supplementary' : 'empty')
      })

      // ID Number
      const idNumber = cleanValue(data.id_number || '') || cleanValue(suppMinor.id_number || '')
      fields.push({
        key: `minor_${i}_id_number`,
        label: 'No. de Documento',
        placeholder: 'Número',
        section: `minor_${i}`, sectionLabel: `Menor #${i + 1} — ${m.name}`,
        value: idNumber,
        source: cleanValue(data.id_number || '') ? 'form' : (idNumber ? 'supplementary' : 'empty')
      })

      // Address
      const address = cleanValue(data.address || '') ||
                     cleanValue(data.location || '') ||
                     cleanValue(tutorData?.full_address as string || '') ||
                     cleanValue(suppMinor.address || '')
      fields.push({
        key: `minor_${i}_address`,
        label: 'Dirección Actual',
        placeholder: 'Dirección donde vive el menor',
        section: `minor_${i}`, sectionLabel: `Menor #${i + 1} — ${m.name}`,
        value: address,
        source: (cleanValue(data.address || '') || cleanValue(data.location || '')) ? 'form' : (address ? 'supplementary' : 'empty')
      })
    })

    // === WITNESSES ===
    witnesses.forEach((w, i) => {
      const suppWitness = suppData?.witnesses?.[i] || {}

      const nationality = cleanValue(w.nationality || '') || cleanValue(suppWitness.nationality || '')
      fields.push({
        key: `witness_${i}_nationality`,
        label: 'Nacionalidad',
        placeholder: 'Ej: Peruana',
        section: `witness_${i}`, sectionLabel: `Testigo ${i + 1} — ${w.name}`,
        value: nationality,
        source: cleanValue(w.nationality || '') ? 'form' : (nationality ? 'supplementary' : 'empty')
      })

      const idNumber = cleanValue(w.id_number || '') || cleanValue(suppWitness.id_number || '')
      fields.push({
        key: `witness_${i}_id_number`,
        label: 'Número de ID/Cédula',
        placeholder: 'Número',
        section: `witness_${i}`, sectionLabel: `Testigo ${i + 1} — ${w.name}`,
        value: idNumber,
        source: cleanValue(w.id_number || '') ? 'form' : (idNumber ? 'supplementary' : 'empty')
      })
    })

    return fields
  }

  const allFields = loaded ? buildAllFields() : []
  const emptyFields = allFields.filter(f => !f.value && localValues[f.key] === undefined)
  const allComplete = emptyFields.length === 0 && allFields.length > 0

  function getLocalValue(key: string, original: string) {
    return localValues[key] !== undefined ? localValues[key] : original
  }

  function setLocalValue(key: string, value: string) {
    setLocalValues(prev => ({ ...prev, [key]: value }))
  }

  function getFieldStatus(f: FieldDef): 'filled' | 'empty' | 'edited' {
    const localVal = localValues[f.key]
    if (localVal !== undefined) {
      return localVal.trim() ? 'edited' : 'empty'
    }
    return f.value ? 'filled' : 'empty'
  }

  async function save() {
    setSaving(true)
    try {
      const updated: Record<string, any> = { ...suppData }

      // General
      if (localValues.court_name !== undefined) {
        updated.court = { ...(updated.court || {}), name: localValues.court_name }
      }
      if (localValues.signing_date !== undefined) updated.signing_date = localValues.signing_date

      // Guardian
      if (!updated.guardian) updated.guardian = {}
      if (localValues.guardian_dob !== undefined) updated.guardian.date_of_birth = localValues.guardian_dob
      if (localValues.guardian_country_birth !== undefined) updated.guardian.country_of_birth = localValues.guardian_country_birth
      if (localValues.guardian_city_birth !== undefined) updated.guardian.city_of_birth = localValues.guardian_city_birth
      if (localValues.guardian_nationality !== undefined) updated.guardian.nationality = localValues.guardian_nationality
      if (localValues.guardian_id_number !== undefined) updated.guardian.id_number = localValues.guardian_id_number

      // Absent parents
      const parentKeys = Object.keys(localValues).filter(k => k.startsWith('parent_'))
      if (parentKeys.length > 0) {
        if (!updated.absent_parents) updated.absent_parents = []
        const maxIdx = Math.max(...parentKeys.map(k => parseInt(k.split('_')[1])))
        for (let i = 0; i <= maxIdx; i++) {
          if (!updated.absent_parents[i]) updated.absent_parents[i] = {}
          if (localValues[`parent_${i}_name`] !== undefined) updated.absent_parents[i].name = localValues[`parent_${i}_name`]
          if (localValues[`parent_${i}_nationality`] !== undefined) updated.absent_parents[i].nationality = localValues[`parent_${i}_nationality`]
          if (localValues[`parent_${i}_passport`] !== undefined) updated.absent_parents[i].passport = localValues[`parent_${i}_passport`]
          if (localValues[`parent_${i}_country`] !== undefined) updated.absent_parents[i].country = localValues[`parent_${i}_country`]
        }
      }

      // Minors
      const minorKeys = Object.keys(localValues).filter(k => k.startsWith('minor_'))
      if (minorKeys.length > 0) {
        if (!updated.minors) updated.minors = []
        const maxIdx = Math.max(...minorKeys.map(k => parseInt(k.split('_')[1])))
        for (let i = 0; i <= maxIdx; i++) {
          if (!updated.minors[i]) updated.minors[i] = {}
          if (localValues[`minor_${i}_birth_city`] !== undefined) updated.minors[i].birth_city = localValues[`minor_${i}_birth_city`]
          if (localValues[`minor_${i}_country`] !== undefined) updated.minors[i].country = localValues[`minor_${i}_country`]
          if (localValues[`minor_${i}_dob`] !== undefined) updated.minors[i].dob = localValues[`minor_${i}_dob`]
          if (localValues[`minor_${i}_id_type`] !== undefined) updated.minors[i].id_type = localValues[`minor_${i}_id_type`]
          if (localValues[`minor_${i}_id_number`] !== undefined) updated.minors[i].id_number = localValues[`minor_${i}_id_number`]
          if (localValues[`minor_${i}_address`] !== undefined) updated.minors[i].address = localValues[`minor_${i}_address`]
        }
      }

      // Witnesses
      const witnessKeys = Object.keys(localValues).filter(k => k.startsWith('witness_'))
      if (witnessKeys.length > 0) {
        if (!updated.witnesses) updated.witnesses = []
        const maxIdx = Math.max(...witnessKeys.map(k => parseInt(k.split('_')[1])))
        for (let i = 0; i <= maxIdx; i++) {
          if (!updated.witnesses[i]) updated.witnesses[i] = {}
          if (localValues[`witness_${i}_nationality`] !== undefined) updated.witnesses[i].nationality = localValues[`witness_${i}_nationality`]
          if (localValues[`witness_${i}_id_number`] !== undefined) updated.witnesses[i].id_number = localValues[`witness_${i}_id_number`]
        }
      }

      const res = await fetch('/api/cases/supplementary-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId, data: updated }),
      })
      if (!res.ok) throw new Error()
      setSuppData(updated)
      setLocalValues({})
      toast.success('Datos guardados')
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function extractFromPDFs() {
    setExtracting(true)
    try {
      const res = await fetch('/api/admin/extract-pdf-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error')
      }
      const json = await res.json()
      toast.success(`Se extrajeron datos de ${json.documents_processed || 0} documento(s). Recargando...`)
      setTimeout(() => window.location.reload(), 1500)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al leer PDFs')
    } finally {
      setExtracting(false)
    }
  }

  if (!loaded) return null

  // Group by section
  const sectionsMap = new Map<string, { label: string; fields: FieldDef[] }>()
  allFields.forEach(f => {
    if (!sectionsMap.has(f.section)) sectionsMap.set(f.section, { label: f.sectionLabel, fields: [] })
    sectionsMap.get(f.section)!.fields.push(f)
  })

  const hasEdits = Object.keys(localValues).length > 0

  return (
    <div className={`rounded-xl border overflow-hidden ${allComplete ? 'border-green-200 bg-green-50/50' : 'border-amber-200 bg-amber-50/50'}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-50/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {allComplete ? <CheckCircle className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-amber-600" />}
          <span className="text-sm font-bold text-gray-900">Datos para Documentos</span>
          {allComplete ? (
            <span className="text-[10px] bg-green-200 text-green-800 px-2 py-0.5 rounded-full font-medium">
              Completo {allFields.length}/{allFields.length}
            </span>
          ) : (
            <span className="text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-medium">
              Faltan {emptyFields.length} de {allFields.length} campos
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs text-gray-600 flex-1">
              Todos los campos son editables. <span className="text-green-600 font-medium">Verde</span> = ya tiene dato,
              <span className="text-red-500 font-medium"> rojo</span> = falta,
              <span className="text-amber-500 font-medium"> naranja</span> = modificado sin guardar.
            </p>
            <Button onClick={extractFromPDFs} disabled={extracting} size="sm" variant="outline"
              className="border-purple-300 text-purple-700 hover:bg-purple-50">
              {extracting ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
              {extracting ? 'Leyendo PDFs...' : 'Leer PDFs subidos con IA'}
            </Button>
          </div>

          {Array.from(sectionsMap.entries()).map(([sectionKey, section]) => (
            <div key={sectionKey} className="bg-white rounded-lg p-3">
              <p className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">{section.label}</p>
              <div className={`grid gap-3 ${section.fields.length === 1 ? 'grid-cols-1' : section.fields.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {section.fields.map(f => (
                  <Input key={f.key} label={f.label} placeholder={f.placeholder}
                    value={getLocalValue(f.key, f.value)}
                    status={getFieldStatus(f)}
                    onChange={v => setLocalValue(f.key, v)} />
                ))}
              </div>
            </div>
          ))}

          {hasEdits && (
            <Button onClick={save} disabled={saving} className="w-full bg-[#F2A900] hover:bg-[#D4940A] text-[#001020] font-bold h-10">
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Guardando...' : `Guardar ${Object.keys(localValues).length} cambio${Object.keys(localValues).length !== 1 ? 's' : ''}`}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
