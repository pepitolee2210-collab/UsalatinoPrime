'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Save, ChevronDown, ChevronUp, AlertCircle, CheckCircle } from 'lucide-react'

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
  source: 'form' | 'supplementary'
}

function Input({ label, value, onChange, placeholder, filled }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; filled?: boolean
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1">
        {filled ? <CheckCircle className="w-3 h-3 text-green-500" /> : <AlertCircle className="w-3 h-3 text-amber-500" />}
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-[#F2A900]/30 focus:border-[#F2A900] outline-none ${
          filled ? 'border-green-200 bg-green-50/50' : 'border-amber-200 bg-amber-50/30'
        }`}
      />
    </div>
  )
}

export function SupplementaryDataForm({ caseId, tutorData, minorStories, absentParents }: SupplementaryDataFormProps) {
  const [suppData, setSuppData] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [open, setOpen] = useState(false)

  const tutorName = (tutorData?.full_name as string) || 'Tutor'
  const witnesses = ((tutorData?.witnesses as Array<Record<string, string>>) || []).filter(w => w.name?.trim())

  // Load saved supplementary data
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

  // Build the list of ALL fields needed for declarations, checking what's already filled
  function buildMissingFields(): { missing: FieldDef[]; filled: FieldDef[]; total: number } {
    const fields: FieldDef[] = []

    // === GENERAL ===
    const courtName = suppData?.court?.name || ''
    fields.push({ key: 'court_name', label: 'Nombre del Tribunal/Corte', placeholder: 'Ej: Probate Court of Madison County, Jackson, Tennessee', section: 'general', sectionLabel: 'General', value: courtName, source: 'supplementary' })

    const signingDate = suppData?.signing_date || ''
    fields.push({ key: 'signing_date', label: 'Fecha de Firma', placeholder: 'Ej: 2 de abril de 2026', section: 'general', sectionLabel: 'General', value: signingDate, source: 'supplementary' })

    // === TUTOR ===
    const tutorDob = (tutorData?.date_of_birth as string) || suppData?.guardian?.date_of_birth || ''
    fields.push({ key: 'guardian_dob', label: 'Fecha de Nacimiento del Tutor', placeholder: 'Ej: 15 de marzo de 1990', section: 'guardian', sectionLabel: `Tutor — ${tutorName}`, value: tutorDob, source: tutorData?.date_of_birth ? 'form' : 'supplementary' })

    // === ABSENT PARENTS ===
    absentParents.forEach((ap, i) => {
      const apData = ap.formData as Record<string, string>
      const name = apData?.parent_name || `Padre ${i + 1}`
      const suppParent = suppData?.absent_parents?.[i] || {}

      const nationality = apData?.parent_nationality || apData?.absent_parent_nationality || suppParent.nationality || ''
      fields.push({ key: `parent_${i}_nationality`, label: 'Nacionalidad', placeholder: 'Ej: Ecuatoriano', section: `parent_${i}`, sectionLabel: `Padre Ausente — ${name}`, value: nationality, source: apData?.parent_nationality ? 'form' : 'supplementary' })

      const passport = apData?.parent_passport || apData?.absent_parent_passport || suppParent.passport || ''
      fields.push({ key: `parent_${i}_passport`, label: 'No. Pasaporte/Cédula', placeholder: 'Número de documento', section: `parent_${i}`, sectionLabel: `Padre Ausente — ${name}`, value: passport, source: apData?.parent_passport ? 'form' : 'supplementary' })
    })

    // === MINORS ===
    minorStories.forEach((s, i) => {
      const mb = (s.formData?.minorBasic || {}) as Record<string, string>
      const name = mb.full_name || `Menor ${i + 1}`
      const suppMinor = suppData?.minors?.[i] || {}

      const birthCity = mb.birth_city || suppMinor.birth_city || ''
      fields.push({ key: `minor_${i}_birth_city`, label: 'Ciudad de Nacimiento', placeholder: 'Ej: Guayaquil', section: `minor_${i}`, sectionLabel: `Menor — ${name}`, value: birthCity, source: mb.birth_city ? 'form' : 'supplementary' })

      const idType = mb.id_type || suppMinor.id_type || ''
      fields.push({ key: `minor_${i}_id_type`, label: 'Tipo de Documento', placeholder: 'Ej: Pasaporte', section: `minor_${i}`, sectionLabel: `Menor — ${name}`, value: idType, source: mb.id_type ? 'form' : 'supplementary' })

      const idNumber = mb.id_number || suppMinor.id_number || ''
      fields.push({ key: `minor_${i}_id_number`, label: 'No. de Documento', placeholder: 'Número', section: `minor_${i}`, sectionLabel: `Menor — ${name}`, value: idNumber, source: mb.id_number ? 'form' : 'supplementary' })
    })

    // === WITNESSES ===
    witnesses.forEach((w, i) => {
      const suppWitness = suppData?.witnesses?.[i] || {}

      const idType = w.id_type || suppWitness.id_type || ''
      fields.push({ key: `witness_${i}_id_type`, label: 'Tipo de ID', placeholder: 'Ej: Cédula', section: `witness_${i}`, sectionLabel: `Testigo ${i + 1} — ${w.name}`, value: idType, source: w.id_type ? 'form' : 'supplementary' })

      const idNumber = w.id_number || suppWitness.id_number || ''
      fields.push({ key: `witness_${i}_id_number`, label: 'Número de ID', placeholder: 'Número', section: `witness_${i}`, sectionLabel: `Testigo ${i + 1} — ${w.name}`, value: idNumber, source: w.id_number ? 'form' : 'supplementary' })
    })

    const missing = fields.filter(f => !f.value.trim())
    const filled = fields.filter(f => f.value.trim())
    return { missing, filled, total: fields.length }
  }

  const { missing, filled, total } = loaded ? buildMissingFields() : { missing: [], filled: [], total: 0 }
  const allComplete = missing.length === 0

  // Track local edits
  const [localValues, setLocalValues] = useState<Record<string, string>>({})

  function getLocalValue(key: string, original: string) {
    return localValues[key] !== undefined ? localValues[key] : original
  }

  function setLocalValue(key: string, value: string) {
    setLocalValues(prev => ({ ...prev, [key]: value }))
  }

  async function save() {
    setSaving(true)
    try {
      // Build updated supplementary data from local values
      const updated: Record<string, any> = { ...suppData }

      // General
      if (localValues.court_name !== undefined) {
        updated.court = { ...(updated.court || {}), name: localValues.court_name }
      }
      if (localValues.signing_date !== undefined) updated.signing_date = localValues.signing_date
      if (localValues.guardian_dob !== undefined) {
        updated.guardian = { ...(updated.guardian || {}), date_of_birth: localValues.guardian_dob }
      }

      // Parents
      absentParents.forEach((_, i) => {
        if (!updated.absent_parents) updated.absent_parents = []
        if (!updated.absent_parents[i]) updated.absent_parents[i] = { name: (absentParents[i]?.formData as any)?.parent_name || '' }
        if (localValues[`parent_${i}_nationality`] !== undefined) updated.absent_parents[i].nationality = localValues[`parent_${i}_nationality`]
        if (localValues[`parent_${i}_passport`] !== undefined) updated.absent_parents[i].passport = localValues[`parent_${i}_passport`]
      })

      // Minors
      minorStories.forEach((s, i) => {
        if (!updated.minors) updated.minors = []
        const mb = (s.formData?.minorBasic || {}) as Record<string, string>
        if (!updated.minors[i]) updated.minors[i] = { name: mb.full_name || '' }
        if (localValues[`minor_${i}_birth_city`] !== undefined) updated.minors[i].birth_city = localValues[`minor_${i}_birth_city`]
        if (localValues[`minor_${i}_id_type`] !== undefined) updated.minors[i].id_type = localValues[`minor_${i}_id_type`]
        if (localValues[`minor_${i}_id_number`] !== undefined) updated.minors[i].id_number = localValues[`minor_${i}_id_number`]
      })

      // Witnesses
      witnesses.forEach((w, i) => {
        if (!updated.witnesses) updated.witnesses = []
        if (!updated.witnesses[i]) updated.witnesses[i] = { name: w.name || '' }
        if (localValues[`witness_${i}_id_type`] !== undefined) updated.witnesses[i].id_type = localValues[`witness_${i}_id_type`]
        if (localValues[`witness_${i}_id_number`] !== undefined) updated.witnesses[i].id_number = localValues[`witness_${i}_id_number`]
      })

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

  if (!loaded) return null

  // Group missing by section
  const missingSections = new Map<string, { label: string; fields: FieldDef[] }>()
  missing.forEach(f => {
    if (!missingSections.has(f.section)) missingSections.set(f.section, { label: f.sectionLabel, fields: [] })
    missingSections.get(f.section)!.fields.push(f)
  })

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
              Completo {filled.length}/{total}
            </span>
          ) : (
            <span className="text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-medium">
              Faltan {missing.length} campos
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {allComplete ? (
            <p className="text-xs text-green-700">Todos los datos necesarios están completos. Los documentos no tendrán campos [PENDING].</p>
          ) : (
            <p className="text-xs text-amber-700">Complete estos campos para que los documentos generados no tengan [PENDING]. Solo se muestran los que faltan.</p>
          )}

          {/* Missing fields grouped by section */}
          {Array.from(missingSections.entries()).map(([sectionKey, section]) => (
            <div key={sectionKey}>
              <p className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">{section.label}</p>
              <div className={`grid gap-3 ${section.fields.length === 1 ? 'grid-cols-1' : section.fields.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {section.fields.map(f => (
                  <Input key={f.key} label={f.label} placeholder={f.placeholder}
                    value={getLocalValue(f.key, f.value)} filled={!!getLocalValue(f.key, f.value).trim()}
                    onChange={v => setLocalValue(f.key, v)} />
                ))}
              </div>
            </div>
          ))}

          {/* Show filled count */}
          {filled.length > 0 && !allComplete && (
            <p className="text-[10px] text-gray-400">{filled.length} campo{filled.length !== 1 ? 's' : ''} ya completado{filled.length !== 1 ? 's' : ''} (del formulario del cliente o datos previos)</p>
          )}

          {!allComplete && (
            <Button onClick={save} disabled={saving} className="w-full bg-[#F2A900] hover:bg-[#D4940A] text-[#001020] font-bold h-10">
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Guardando...' : 'Guardar Datos'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
