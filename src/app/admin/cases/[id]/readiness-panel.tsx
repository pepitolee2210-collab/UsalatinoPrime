'use client'

import { useState, useMemo, useEffect } from 'react'
import { CheckCircle, AlertCircle, AlertTriangle, ChevronDown, ChevronUp, HelpCircle, Scale } from 'lucide-react'
import { normalizeMinorStory } from '@/lib/legal/normalize-minor-story'

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
  /**
   * Opcional — si se pasa, el panel incluye una sección "Jurisdicción" que
   * consulta `/api/admin/case-jurisdiction?lookup=cache` (no dispara
   * research, solo lee el cache llenado por el JurisdictionPanel principal).
   */
  caseId?: string
}

interface JurisdictionStatus {
  hasCourt: boolean
  stateLabel: string | null
  courtName: string | null
  confidence: 'high' | 'medium' | 'low' | null
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
  if (status === 'filled') return <CheckCircle className="w-3.5 h-3.5 text-[var(--admin-green)] flex-shrink-0" />
  if (status === 'unknown') return <AlertTriangle className="w-3.5 h-3.5 text-[var(--admin-gold)] flex-shrink-0" />
  return <AlertCircle className="w-3.5 h-3.5 text-[var(--admin-red)] flex-shrink-0" />
}

export function ReadinessPanel({ tutorData, minorStories, absentParents, supplementaryData, caseId }: ReadinessPanelProps) {
  const [open, setOpen] = useState(false)
  const [jurisdiction, setJurisdiction] = useState<JurisdictionStatus | null>(null)

  useEffect(() => {
    if (!caseId) return
    let cancelled = false
    fetch(`/api/admin/case-jurisdiction?caseId=${encodeURIComponent(caseId)}&lookup=cache`)
      .then(r => r.json())
      .then((data: { jurisdiction?: Record<string, unknown> | null; clientLocation?: { stateName?: string; stateCode?: string } | null }) => {
        if (cancelled) return
        const loc = data.clientLocation
        const j = data.jurisdiction as {
          court_name?: string; state_name?: string; state_code?: string; confidence?: 'high' | 'medium' | 'low'
        } | null | undefined
        setJurisdiction({
          hasCourt: Boolean(j?.court_name),
          stateLabel: j?.state_name ? `${j.state_name} (${j.state_code})` : (loc?.stateName ? `${loc.stateName} (${loc.stateCode})` : null),
          courtName: j?.court_name ?? null,
          confidence: j?.confidence ?? null,
        })
      })
      .catch(() => { if (!cancelled) setJurisdiction(null) })
    return () => { cancelled = true }
  }, [caseId])

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
      const suppMinor = (supp.minors?.[i] || {}) as Record<string, string>
      // Normalizamos para que casos legacy (form_data con `minor_info` en vez
      // de `minorBasic`) muestren correctamente "Nombre completo" como filled.
      const mb = normalizeMinorStory(s.formData, suppMinor).minorBasic
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
      ? 'border-green-200 bg-[var(--admin-green-soft)]'
      : report.overall === 'warnings'
        ? 'border-amber-200 bg-[var(--admin-gold-soft)]'
        : 'border-red-200 bg-[var(--admin-red-soft)]'

  const overallLabel =
    report.overall === 'ready'
      ? 'Listo para generar'
      : report.overall === 'warnings'
        ? `${report.unknown} campo(s) marcado(s) "No tengo dato"`
        : `Faltan ${report.missing} dato(s) críticos`

  const overallIcon =
    report.overall === 'ready' ? (
      <CheckCircle className="w-4 h-4 text-[var(--admin-green-on)]" />
    ) : report.overall === 'warnings' ? (
      <AlertTriangle className="w-4 h-4 text-[var(--admin-gold-on)]" />
    ) : (
      <AlertCircle className="w-4 h-4 text-[var(--admin-red-on)]" />
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
          <span className="text-sm font-bold text-[var(--admin-fg)]">Verificación antes de generar</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              report.overall === 'ready'
                ? 'bg-[var(--admin-green-soft)] text-[var(--admin-green-on)]'
                : report.overall === 'warnings'
                  ? 'bg-[var(--admin-gold-soft)] text-[var(--admin-gold-on)]'
                  : 'bg-[var(--admin-red-soft)] text-[var(--admin-red-on)]'
            }`}
          >
            {overallLabel}
          </span>
          <span className="text-[11px] text-[var(--admin-fg-muted)] font-mono tabular-nums">
            {report.filled}/{report.total} completos
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-[var(--admin-fg-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--admin-fg-muted)]" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex items-center gap-3 text-[11px] text-[var(--admin-fg-muted)] flex-wrap">
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-[var(--admin-green)]" />
              <strong>{report.filled}</strong> con dato real
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-[var(--admin-gold)]" />
              <strong>{report.unknown}</strong> &ldquo;No tengo dato&rdquo; → el documento dirá &ldquo;manifiesta no conocer&rdquo;
            </span>
            <span className="flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-[var(--admin-red)]" />
              <strong>{report.missing}</strong> vacío → el documento saldrá con{' '}
              <code className="text-[10px] bg-[var(--admin-red-soft)] px-1 rounded">[FALTA:...]</code>
            </span>
          </div>

          {/* Jurisdiction status row (court + state) — populated from the
             cache populated by the JurisdictionPanel above. */}
          {caseId && jurisdiction && (
            <div className={`rounded-lg border p-2.5 ${
              jurisdiction.hasCourt && jurisdiction.confidence === 'high'
                ? 'border-green-200 bg-[var(--admin-veil-1)]'
                : jurisdiction.hasCourt
                  ? 'border-amber-200 bg-[var(--admin-bg-elev)]'
                  : jurisdiction.stateLabel
                    ? 'border-amber-200 bg-[var(--admin-bg-elev)]'
                    : 'border-red-200 bg-[var(--admin-bg-elev)]'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <Scale className="w-3.5 h-3.5 text-[var(--admin-accent)]" />
                <span className="text-xs font-bold text-[var(--admin-fg)]">Jurisdicción</span>
                {jurisdiction.hasCourt ? (
                  jurisdiction.confidence === 'high' ? (
                    <CheckCircle className="w-3.5 h-3.5 text-[var(--admin-green)]" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-[var(--admin-gold)]" />
                  )
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-[var(--admin-red)]" />
                )}
              </div>
              <div className="pl-5 text-[11px] text-[var(--admin-fg)] leading-relaxed">
                {jurisdiction.hasCourt ? (
                  <>
                    <span className="text-[var(--admin-fg-muted)]">Corte detectada:</span>{' '}
                    <strong>{jurisdiction.courtName}</strong>{' '}
                    <span className="text-[var(--admin-fg-muted)]">— {jurisdiction.stateLabel}</span>
                  </>
                ) : jurisdiction.stateLabel ? (
                  <>
                    Estado detectado: <strong>{jurisdiction.stateLabel}</strong> — aún no se ha investigado la corte.{' '}
                    Abre el panel <em>Jurisdicción detectada</em> arriba para investigar.
                  </>
                ) : (
                  <>No se pudo detectar el estado del cliente — los documentos saldrán con <code className="text-[10px] bg-[var(--admin-red-soft)] px-1 rounded">[FALTA: Nombre del tribunal]</code>.</>
                )}
              </div>
            </div>
          )}

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
                      ? 'border-red-200 bg-[var(--admin-bg-elev)]'
                      : sectionUnknown > 0
                        ? 'border-amber-200 bg-[var(--admin-bg-elev)]'
                        : 'border-green-200 bg-[var(--admin-veil-1)]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    {sectionOK ? (
                      <CheckCircle className="w-3.5 h-3.5 text-[var(--admin-green)]" />
                    ) : sectionMissing > 0 ? (
                      <AlertCircle className="w-3.5 h-3.5 text-[var(--admin-red)]" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-[var(--admin-gold)]" />
                    )}
                    <span className="text-xs font-bold text-[var(--admin-fg)]">{section.name}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 pl-5">
                    {section.fields.map((f, fi) => (
                      <div key={fi} className="flex items-center gap-1.5 text-[11px]">
                        <StatusIcon status={f.status} />
                        <span
                          className={
                            f.status === 'missing'
                              ? 'text-[var(--admin-red-on)] font-medium'
                              : f.status === 'unknown'
                                ? 'text-[var(--admin-gold-on)]'
                                : 'text-[var(--admin-fg)]'
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

          <div className="flex items-start gap-2 text-[11px] text-[var(--admin-fg-muted)] p-2 bg-[var(--admin-veil-1)] rounded-lg border border-[var(--admin-border)]">
            <HelpCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-[var(--admin-fg-subtle)]" />
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
