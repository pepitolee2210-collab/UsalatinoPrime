'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Save, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'

interface SupplementaryDataFormProps {
  caseId: string
  tutorData: Record<string, unknown> | null
  minorStories: { minorIndex: number; formData: Record<string, unknown> }[]
  absentParents: { formData: Record<string, unknown> }[]
}

interface SupplementaryData {
  court: { name: string; location: string }
  signing_date: string
  guardian: { passport: string; id_number: string; immigration_status: string; date_of_birth: string }
  absent_parents: { name: string; nationality: string; passport: string; id_number: string; country: string }[]
  minors: { name: string; nationality: string; arrival_date: string; birth_city: string; id_type: string; id_number: string }[]
  witnesses: { name: string; nationality: string; id_type: string; id_number: string }[]
}

function emptyData(
  tutorData: Record<string, unknown> | null,
  minorStories: { formData: Record<string, unknown> }[],
  absentParents: { formData: Record<string, unknown> }[],
): SupplementaryData {
  const witnesses = ((tutorData?.witnesses as Array<Record<string, string>>) || []).filter(w => w.name?.trim())
  return {
    court: { name: '', location: '' },
    signing_date: '',
    guardian: { passport: '', id_number: '', immigration_status: '', date_of_birth: '' },
    absent_parents: absentParents.map(ap => ({
      name: (ap.formData as Record<string, string>)?.parent_name || '',
      nationality: '', passport: '', id_number: '', country: '',
    })),
    minors: minorStories.map(s => {
      const mb = (s.formData?.minorBasic || {}) as Record<string, string>
      return { name: mb.full_name || '', nationality: '', arrival_date: '', birth_city: '', id_type: '', id_number: '' }
    }),
    witnesses: witnesses.map(w => ({
      name: w.name || '', nationality: '', id_type: '', id_number: '',
    })),
  }
}

function Input({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#F2A900]/30 focus:border-[#F2A900] outline-none"
      />
    </div>
  )
}

export function SupplementaryDataForm({ caseId, tutorData, minorStories, absentParents }: SupplementaryDataFormProps) {
  const [data, setData] = useState<SupplementaryData>(() =>
    emptyData(tutorData, minorStories, absentParents)
  )
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [open, setOpen] = useState(false)

  const tutorName = (tutorData?.full_name as string) || 'Tutor'

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/cases/supplementary-data?case_id=${caseId}`)
      if (res.ok) {
        const json = await res.json()
        if (json.data) {
          const base = emptyData(tutorData, minorStories, absentParents)
          const saved = json.data as Partial<SupplementaryData>
          setData({
            court: { ...base.court, ...saved.court },
            signing_date: saved.signing_date || base.signing_date,
            guardian: { ...base.guardian, ...saved.guardian },
            absent_parents: base.absent_parents.map((ap, i) => ({
              ...ap,
              ...(saved.absent_parents?.[i] || {}),
              name: ap.name,
            })),
            minors: base.minors.map((m, i) => ({
              ...m,
              ...(saved.minors?.[i] || {}),
              name: m.name,
            })),
            witnesses: base.witnesses.map((w, i) => ({
              ...w,
              ...(saved.witnesses?.[i] || {}),
              name: w.name,
            })),
          })
        }
      }
    } catch { /* ignore */ }
    setLoaded(true)
  }, [caseId, tutorData, minorStories, absentParents])

  useEffect(() => { load() }, [load])

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/cases/supplementary-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId, data }),
      })
      if (!res.ok) throw new Error()
      toast.success('Datos complementarios guardados')
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const hasEmptyFields = !data.guardian.date_of_birth ||
    data.absent_parents.some(p => !p.passport || !p.nationality) ||
    data.minors.some(m => !m.birth_city || !m.id_number) ||
    data.witnesses.some(w => !w.id_number) ||
    !data.signing_date

  if (!loaded) return null

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/50 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-bold text-gray-900">Datos Complementarios</span>
          {hasEmptyFields && (
            <span className="text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-medium">
              Campos por llenar
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-5">
          <p className="text-xs text-gray-500">
            Complete estos datos para eliminar los [PENDING] de los documentos generados.
          </p>

          {/* Court + Signing Date */}
          <Section title="Corte / Tribunal y Fecha">
            <div className="grid grid-cols-3 gap-3">
              <Input label="Nombre del Tribunal" value={data.court.name}
                onChange={v => setData(d => ({ ...d, court: { ...d.court, name: v } }))}
                placeholder="Juvenile Court of the State of Tennessee" />
              <Input label="Ubicación" value={data.court.location}
                onChange={v => setData(d => ({ ...d, court: { ...d.court, location: v } }))}
                placeholder="Jackson, Madison County" />
              <Input label="Fecha de Firma" value={data.signing_date}
                onChange={v => setData(d => ({ ...d, signing_date: v }))}
                placeholder="Ej: 2 de abril de 2026" />
            </div>
          </Section>

          {/* Guardian */}
          <Section title={`Tutor/Guardián — ${tutorName}`}>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Pasaporte No." value={data.guardian.passport}
                onChange={v => setData(d => ({ ...d, guardian: { ...d.guardian, passport: v } }))}
                placeholder="Número de pasaporte" />
              <Input label="Cédula / ID" value={data.guardian.id_number}
                onChange={v => setData(d => ({ ...d, guardian: { ...d.guardian, id_number: v } }))}
                placeholder="Número de identificación" />
              <Input label="Estatus Migratorio" value={data.guardian.immigration_status}
                onChange={v => setData(d => ({ ...d, guardian: { ...d.guardian, immigration_status: v } }))}
                placeholder="Ej: Solicitante de asilo" />
              <Input label="Fecha de Nacimiento" value={data.guardian.date_of_birth}
                onChange={v => setData(d => ({ ...d, guardian: { ...d.guardian, date_of_birth: v } }))}
                placeholder="Ej: 1990-05-15" />
            </div>
          </Section>

          {/* Absent Parents */}
          {data.absent_parents.map((parent, i) => (
            <Section key={`parent-${i}`} title={`Padre Ausente — ${parent.name || `#${i + 1}`}`}>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Nacionalidad" value={parent.nationality}
                  onChange={v => setData(d => {
                    const arr = [...d.absent_parents]
                    arr[i] = { ...arr[i], nationality: v }
                    return { ...d, absent_parents: arr }
                  })}
                  placeholder="Ej: Ecuatoriana" />
                <Input label="Pasaporte No." value={parent.passport}
                  onChange={v => setData(d => {
                    const arr = [...d.absent_parents]
                    arr[i] = { ...arr[i], passport: v }
                    return { ...d, absent_parents: arr }
                  })}
                  placeholder="Número de pasaporte" />
                <Input label="Cédula / ID" value={parent.id_number}
                  onChange={v => setData(d => {
                    const arr = [...d.absent_parents]
                    arr[i] = { ...arr[i], id_number: v }
                    return { ...d, absent_parents: arr }
                  })}
                  placeholder="Número de identificación" />
                <Input label="País de Residencia" value={parent.country}
                  onChange={v => setData(d => {
                    const arr = [...d.absent_parents]
                    arr[i] = { ...arr[i], country: v }
                    return { ...d, absent_parents: arr }
                  })}
                  placeholder="Ej: Ecuador" />
              </div>
            </Section>
          ))}

          {/* Minors */}
          {data.minors.map((minor, i) => (
            <Section key={`minor-${i}`} title={`Menor — ${minor.name || `#${i + 1}`}`}>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Ciudad de Nacimiento" value={minor.birth_city}
                  onChange={v => setData(d => {
                    const arr = [...d.minors]
                    arr[i] = { ...arr[i], birth_city: v }
                    return { ...d, minors: arr }
                  })}
                  placeholder="Ej: Guayaquil" />
                <Input label="Nacionalidad" value={minor.nationality}
                  onChange={v => setData(d => {
                    const arr = [...d.minors]
                    arr[i] = { ...arr[i], nationality: v }
                    return { ...d, minors: arr }
                  })}
                  placeholder="Ej: Ecuatoriana" />
                <Input label="Tipo de Documento" value={minor.id_type}
                  onChange={v => setData(d => {
                    const arr = [...d.minors]
                    arr[i] = { ...arr[i], id_type: v }
                    return { ...d, minors: arr }
                  })}
                  placeholder="Ej: Pasaporte, Certificado de nacimiento" />
                <Input label="No. de Documento" value={minor.id_number}
                  onChange={v => setData(d => {
                    const arr = [...d.minors]
                    arr[i] = { ...arr[i], id_number: v }
                    return { ...d, minors: arr }
                  })}
                  placeholder="Número de documento" />
              </div>
            </Section>
          ))}

          {/* Witnesses */}
          {data.witnesses.map((witness, i) => (
            <Section key={`witness-${i}`} title={`Testigo ${i + 1} — ${witness.name || ''}`}>
              <div className="grid grid-cols-3 gap-3">
                <Input label="Nacionalidad" value={witness.nationality}
                  onChange={v => setData(d => {
                    const arr = [...d.witnesses]
                    arr[i] = { ...arr[i], nationality: v }
                    return { ...d, witnesses: arr }
                  })}
                  placeholder="Ej: Ecuatoriana" />
                <Input label="Tipo de ID" value={witness.id_type}
                  onChange={v => setData(d => {
                    const arr = [...d.witnesses]
                    arr[i] = { ...arr[i], id_type: v }
                    return { ...d, witnesses: arr }
                  })}
                  placeholder="Ej: Cédula, Pasaporte" />
                <Input label="Número de ID" value={witness.id_number}
                  onChange={v => setData(d => {
                    const arr = [...d.witnesses]
                    arr[i] = { ...arr[i], id_number: v }
                    return { ...d, witnesses: arr }
                  })}
                  placeholder="Número de identificación" />
              </div>
            </Section>
          ))}

          <Button onClick={save} disabled={saving} className="w-full bg-[#F2A900] hover:bg-[#D4940A] text-[#001020] font-bold h-10">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Guardando...' : 'Guardar Datos Complementarios'}
          </Button>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">{title}</p>
      {children}
    </div>
  )
}
