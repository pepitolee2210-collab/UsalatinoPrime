'use client'

import { useState, useMemo } from 'react'
import { CheckCircle, AlertCircle, AlertTriangle, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react'

const UNKNOWN_VALUE = '__UNKNOWN__'

type FieldStatus = 'filled' | 'unknown' | 'missing'

interface ReadinessField {
  label: string
  status: FieldStatus
  hint?: string
}

interface ReadinessSection {
  name: string
  fields: ReadinessField[]
}

interface ReadinessPanelProps {
  tutorData: Record<string, unknown> | null
  minorStories: { minorIndex: number; formData: Record<string, unknown> }[]
  absentParents?: { formData: Record<string, unknown> }[]
  supplementaryData?: Record<string, unknown> | null
}

/**
 * Evalúa el estado de un campo considerando tres fuentes en orden de
 * prioridad: (1) valor directo del formulario, (2) valor en supplementary,
 * (3) vacío. Distingue entre "falta" (se tendrá que rellenar) y "unknown"
 * (el cliente marcó explícitamente que no lo sabe — se usará la frase legal).
 */
function evalField(primary: string, supplementary?: string): FieldStatus {
  const v1 = (primary || '').trim()
  const v2 = (supplementary || '').trim()
  if (v1 === UNKNOWN_VALUE || v2 === UNKNOWN_VALUE) return 'unknown'
  if (v1.length >= 2 || v2.length >= 2) return 'filled'
  return 'missing'
}

function StatusIcon({ status }: { status: FieldStatus }) {
  if (status === 'filled') return <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
  if (status === 'unknown') return <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
  return <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
}

export function ReadinessPanel({ tutorData, minorStories, absentParents, supplementaryData }: ReadinessPanelProps) {
  const [open, setOpen] = useState(false)

  const report = useMemo(() => {
    const tutor = tutorData || {}
    const supp = (supplementaryData || {}) as Record<string, any>
    const suppGuardian = (supp.guardian || {}) as Record<string, string>
    const suppWitnesses = (supp.witnesses || []) as Array<Record<string, string>>

    const sections: ReadinessSection[] = []

    // === Tutor ===
    sections.push({
      name: 'Tutor / Declarante',
      fields: [
        { label: 'Nombre completo', status: evalField(tutor.full_name as string) },
        { label: 'Relación con el menor', status: evalField(tutor.relationship_to_minor as string) },
        { label: 'Dirección actual', status: evalField(tutor.full_address as string) },
        { label: 'Fecha de nacimiento', status: evalField(tutor.date_of_birth as string, suppGuardian.date_of_birth) },
        { label: 'País de nacimiento', status: evalField(tutor.country_of_birth as string, suppGuardian.country_of_birth) },
        { label: 'Ciudad de nacimiento', status: evalField(tutor.city_of_birth as string, suppGuardian.city_of_birth) },
        { label: 'Nacionalidad', status: evalField(tutor.nationality as string, suppGuardian.nationality) },
        { label: 'Pasaporte / ID', status: evalField(tutor.id_number as string, suppGuardian.id_number) },
      ],
    })

    // === Padre/Madre ausente ===
    // Priorizamos la lista de absent_parents (wizard) y caemos al absent_parent_* del tutor.
    const absentList = (absentParents && absentParents.length > 0)
      ? absentParents.map(p => p.formData as Record<string, string>)
      : [{
          parent_name: tutor.absent_parent_name as string || '',
          parent_nationality: tutor.absent_parent_nationality as string || '',
          parent_passport: tutor.absent_parent_passport as string || '',
          parent_id_number: tutor.absent_parent_id as string || '',
          parent_country: tutor.absent_parent_country as string || '',
        }]

    absentList.forEach((ap, i) => {
      const suppAp = (supp.absent_parents?.[i] || {}) as Record<string, string>
      const idStatus = evalField(ap.parent_passport || ap.parent_id_number, suppAp.passport)
      sections.push({
        name: absentList.length > 1 ? `Padre/Madre ausente #${i + 1}` : 'Padre/Madre ausente',
        fields: [
          { label: 'Nombre completo', status: evalField(ap.parent_name, suppAp.name) },
          { label: 'Nacionalidad', status: evalField(ap.parent_nationality, suppAp.nationality) },
          { label: 'País de residencia', status: evalField(ap.parent_country, suppAp.country) },
          { label: 'Pasaporte o ID (al menos uno)', status: idStatus },
        ],
      })
    })

    // === Menores ===
    minorStories.forEach((s, i) => {
      const mb = (s.formData?.minorBasic || {}) as Record<string, string>
      const suppMinor = (supp.minors?.[i] || {}) as Record<string, string>
      sections.push({
        name: minorStories.length > 1 ? `Menor #${i + 1}` : 'Menor',
        fields: [
          { label: 'Nombre completo', status: evalField(mb.full_name) },
          { label: 'Fecha de nacimiento', status: evalField(mb.dob, suppMinor.dob) },
          { label: 'País de nacimiento', status: evalField(mb.country, suppMinor.country) },
          { label: 'Ciudad de nacimiento', status: evalField(mb.birth_city, suppMinor.birth_city) },
          { label: 'Dirección actual', status: evalField(mb.address, suppMinor.address) },
        ],
      })
    })

    // === Testigos ===
    const witnesses = (tutor.witnesses as Array<Record<string, string>>) || []
    witnesses.filter(w => (w.name || '').trim()).forEach((w, i) => {
      const suppWit = (suppWitnesses[i] || {}) as Record<string, string>
      sections.push({
        name: `Testigo ${i + 1} — ${w.name}`,
        fields: [
          { label: 'Nombre', status: evalField(w.name) },
          { label: 'Relación', status: evalField(w.relationship) },
          { label: 'Nacionalidad', status: evalField((w as any).nationality, suppWit.nationality) },
          { label: 'Nº de ID / Cédula', status: evalField((w as any).id_number, suppWit.id_number) },
        ],
      })
    })

    // Totals
    let filled = 0
    let unknown = 0
    let missing = 0
    for (const s of sections) {
      for (const f of s.fields) {
        if (f.status === 'filled') filled++
        else if (f.status === 'unknown') unknown++
        else missing++
      }
    }
    const total = filled + unknown + missing
    const overall: 'ready' | 'warnings' | 'blocked' =
      missing > 0 ? 'blocked' : unknown > 0 ? 'warnings' : 'ready'

    return { sections, filled, unknown, missing, total, overall }
  }, [tutorData, minorStories, absentParents, supplementaryData])

  const overallColor =
    report.overall === 'ready'
      ? 'border-green-200 bg-green-50/60'
      : report.overall === 'warnings'
        ? 'border-amber-200 bg-amber-50/60'
        : 'border-red-200 bg-red-50/60'

  const overallLabel =
    report.overall === 'ready'
      ? 'Listo para generar'
      : report.overall === 'warnings'
        ? `${report.unknown} campo(s) marcado(s) "No tengo dato"`
        : `Faltan ${report.missing} dato(s) críticos`

  const overallIcon =
    report.overall === 'ready' ? (
      <CheckCircle className="w-4 h-4 text-green-600" />
    ) : report.overall === 'warnings' ? (
      <AlertTriangle className="w-4 h-4 text-amber-600" />
    ) : (
      <AlertCircle className="w-4 h-4 text-red-600" />
    )

  return (
    <div className={`rounded-xl border overflow-hidden ${overallColor}`}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-black/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          {overallIcon}
          <span className="text-sm font-bold text-gray-900">Verificación antes de generar</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              report.overall === 'ready'
                ? 'bg-green-200 text-green-900'
                : report.overall === 'warnings'
                  ? 'bg-amber-200 text-amber-900'
                  : 'bg-red-200 text-red-900'
            }`}
          >
            {overallLabel}
          </span>
          <span className="text-[11px] text-gray-500 font-mono tabular-nums">
            {report.filled}/{report.total} completos
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex items-center gap-3 text-[11px] text-gray-600 flex-wrap">
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-green-500" />
              <strong>{report.filled}</strong> con dato real
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              <strong>{report.unknown}</strong> &ldquo;No tengo dato&rdquo; → el documento dirá &ldquo;manifiesta no conocer&rdquo;
            </span>
            <span className="flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-red-500" />
              <strong>{report.missing}</strong> vacío → el documento saldrá con{' '}
              <code className="text-[10px] bg-red-100 px-1 rounded">[FALTA:...]</code>
            </span>
          </div>

          <div className="space-y-2">
            {report.sections.map((section, si) => {
              const sectionMissing = section.fields.filter(f => f.status === 'missing').length
              const sectionUnknown = section.fields.filter(f => f.status === 'unknown').length
              const sectionOK = sectionMissing === 0 && sectionUnknown === 0
              return (
                <div
                  key={si}
                  className={`rounded-lg border p-2.5 ${
                    sectionMissing > 0
                      ? 'border-red-200 bg-white'
                      : sectionUnknown > 0
                        ? 'border-amber-200 bg-white'
                        : 'border-green-200 bg-white/60'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    {sectionOK ? (
                      <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                    ) : sectionMissing > 0 ? (
                      <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    )}
                    <span className="text-xs font-bold text-gray-800">{section.name}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 pl-5">
                    {section.fields.map((f, fi) => (
                      <div key={fi} className="flex items-center gap-1.5 text-[11px]">
                        <StatusIcon status={f.status} />
                        <span
                          className={
                            f.status === 'missing'
                              ? 'text-red-600 font-medium'
                              : f.status === 'unknown'
                                ? 'text-amber-700'
                                : 'text-gray-700'
                          }
                        >
                          {f.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex items-start gap-2 text-[11px] text-gray-600 p-2 bg-white/70 rounded-lg border border-gray-200">
            <HelpCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-400" />
            <span>
              Completa los campos en rojo desde <strong>Datos Suplementarios</strong> (abajo) antes de generar.
              Los amarillos son válidos — el documento redactará &ldquo;manifiesta no conocer&rdquo; en su lugar.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
