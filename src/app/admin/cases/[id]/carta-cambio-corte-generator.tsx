'use client'

// Tab del dashboard del caso (admin/empleado) que permite llenar los campos
// extra y generar la Carta de Cambio de Corte (6 págs, jsPDF).
//
// Layout: secciones colapsables espejo del CambioCorteForm legacy
// (src/components/admin/CambioCorteForm.tsx) pero conectado al endpoint
// /api/admin/cases/[id]/carta-cambio-corte.
//
// Autosave con debounce 800ms.

import { useEffect, useState, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import {
  ChevronDown, ChevronUp, User, Users, Building2, MapPin, Gavel,
  FileText, Plus, X, Loader2, Download, Save, CheckCircle2,
} from 'lucide-react'
import type { CartaCambioCorteData } from '@/lib/cambio-corte/letter-generator'

interface Section {
  id: string
  title: string
  icon: React.ComponentType<{ className?: string }>
  num: number
}

const SECTIONS: Section[] = [
  { id: 'client', title: 'Datos del Cliente', icon: User, num: 1 },
  { id: 'beneficiaries', title: 'Beneficiarios (Esposa/Hijos)', icon: Users, num: 2 },
  { id: 'case', title: 'Datos del Caso', icon: Gavel, num: 3 },
  { id: 'current_court', title: 'Corte Actual', icon: Building2, num: 4 },
  { id: 'new_location', title: 'Nueva Ubicación / Corte', icon: MapPin, num: 5 },
  { id: 'counsel', title: 'Fiscal Principal (Chief Counsel)', icon: FileText, num: 6 },
]

const INPUT_CLASS = 'w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#002855]/30 focus:border-[#002855]'
const LABEL_CLASS = 'text-sm font-medium text-gray-700'

interface Props {
  caseId: string
  caseNumber: string
  clientName: string
  /** Override del endpoint base. Default: '/api/admin/cases/{caseId}/carta-cambio-corte'.
   *  Sobrescribir para usar la versión cliente '/api/cita/{token}/carta-cambio-corte'. */
  apiUrl?: string
  /** Mostrar el botón "Generar PDF" (solo admin/empleado). Default true. */
  showGenerateButton?: boolean
  /** Mensaje contextual en el header (ej. "Te queda…"). Si null/undefined, se calcula default. */
  headerSubtitle?: string
}

export function CartaCambioCorteGenerator({
  caseId,
  caseNumber,
  clientName,
  apiUrl,
  showGenerateButton = true,
  headerSubtitle,
}: Props) {
  const endpoint = apiUrl ?? `/api/admin/cases/${caseId}/carta-cambio-corte`
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<CartaCambioCorteData | null>(null)
  const [filledPdfAt, setFilledPdfAt] = useState<string | null>(null)
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [generating, setGenerating] = useState(false)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    client: true, beneficiaries: false, case: true, current_court: true,
    new_location: false, counsel: false,
  })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load on mount
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(endpoint, { cache: 'no-store' })
      .then((r) => { if (!r.ok) throw new Error('Error al cargar carta'); return r.json() })
      .then((j) => {
        if (cancelled) return
        const merged: CartaCambioCorteData = { ...(j.prefill ?? {}), ...(j.saved ?? {}) }
        setData(merged)
        setFilledPdfAt(j.filled_pdf_generated_at ?? null)
      })
      .catch((err) => { if (!cancelled) toast.error(err instanceof Error ? err.message : 'Error') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [endpoint])

  const persistValues = useCallback(async (next: CartaCambioCorteData) => {
    setSavingState('saving')
    try {
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: next }),
      })
      if (!res.ok) throw new Error('Error al guardar')
      setSavingState('saved')
      setTimeout(() => setSavingState('idle'), 1500)
    } catch {
      setSavingState('error')
      toast.error('Error al guardar')
    }
  }, [endpoint])

  function update<K extends keyof CartaCambioCorteData>(key: K, val: CartaCambioCorteData[K]) {
    setData((prev) => {
      if (!prev) return prev
      const next = { ...prev, [key]: val }
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => persistValues(next), 800)
      return next
    })
  }

  function toggleResidenceProof(key: string) {
    if (!data) return
    const next = data.residence_proof_docs.includes(key)
      ? data.residence_proof_docs.filter((k) => k !== key)
      : [...data.residence_proof_docs, key]
    update('residence_proof_docs', next)
  }

  function updateBeneficiary(i: number, field: 'full_name' | 'file_number', val: string) {
    if (!data) return
    const next = [...data.beneficiaries]
    next[i] = { ...next[i], [field]: val }
    update('beneficiaries', next)
  }

  function addBeneficiary() {
    if (!data || data.beneficiaries.length >= 4) return
    update('beneficiaries', [...data.beneficiaries, { full_name: '', file_number: '' }])
  }

  function removeBeneficiary(i: number) {
    if (!data) return
    update('beneficiaries', data.beneficiaries.filter((_, idx) => idx !== i))
  }

  async function handleGenerate() {
    if (!data) return
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      await persistValues(data)
    }
    setGenerating(true)
    try {
      const res = await fetch(endpoint, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (err.missingFields?.length) {
          throw new Error(`Faltan campos obligatorios: ${err.missingFields.slice(0, 5).join(', ')}`)
        }
        throw new Error(err.error || `Error ${res.status}`)
      }
      const blob = await res.blob()
      const cd = res.headers.get('Content-Disposition') || ''
      const m = /filename="([^"]+)"/.exec(cd)
      const filename = m?.[1] ?? `carta-cambio-corte_${caseNumber}.pdf`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setFilledPdfAt(new Date().toISOString())
      toast.success('Carta generada y descargada')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al generar')
    } finally {
      setGenerating(false)
    }
  }

  function toggleSection(id: string) {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header con info + save state + botón generar */}
      <div className="flex items-center justify-between flex-wrap gap-3 px-4 py-3 rounded-xl border border-blue-200 bg-blue-50/40">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-blue-700" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">Carta de Cambio de Corte — {clientName}</p>
            <p className="text-xs text-gray-500">
              {headerSubtitle ?? '6 págs, redactada en inglés para presentar ante la Corte de Inmigración actual.'}
              {showGenerateButton && filledPdfAt && (
                <> · <span className="text-emerald-700">Último PDF: {new Date(filledPdfAt).toLocaleString('es-MX')}</span></>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <SaveBadge state={savingState} />
          {showGenerateButton && (
            <button
              type="button"
              disabled={generating}
              onClick={handleGenerate}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#002855] text-white rounded-lg hover:bg-[#001d3d] transition-colors disabled:opacity-60"
            >
              {generating ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generando…</>
              ) : (
                <><Download className="w-3.5 h-3.5" /> Generar Carta (6 págs)</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Secciones colapsables */}
      {SECTIONS.map((section) => {
        const isOpen = openSections[section.id]
        return (
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
              {isOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>

            {isOpen && (
              <div className="px-4 pb-4 space-y-4">
                {section.id === 'client' && (
                  <>
                    <FieldText label="Nombre completo del cliente *" value={data.client_full_name} onChange={(v) => update('client_full_name', v)} />
                    <FieldText label="Teléfono *" value={data.client_phone} onChange={(v) => update('client_phone', v)} />
                    <FieldText label="Dirección actual (calle) *" value={data.client_address_street} onChange={(v) => update('client_address_street', v)} />
                    <div className="grid grid-cols-3 gap-3">
                      <FieldText label="Ciudad *" value={data.client_address_city} onChange={(v) => update('client_address_city', v)} />
                      <FieldText label="Estado *" value={data.client_address_state} onChange={(v) => update('client_address_state', v)} />
                      <FieldText label="ZIP *" value={data.client_address_zip} onChange={(v) => update('client_address_zip', v)} />
                    </div>
                  </>
                )}

                {section.id === 'beneficiaries' && (
                  <>
                    <p className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
                      Agregue esposa/esposo e hijos incluidos en el caso (máximo 4).
                    </p>
                    {data.beneficiaries.map((b, i) => (
                      <div key={i} className="flex items-start gap-2 p-3 rounded-lg border border-gray-200 bg-gray-50">
                        <div className="flex-1 grid grid-cols-2 gap-3">
                          <FieldText label="Nombre completo *" value={b.full_name} onChange={(v) => updateBeneficiary(i, 'full_name', v)} />
                          <FieldText label="File No. (A#) *" value={b.file_number} onChange={(v) => updateBeneficiary(i, 'file_number', v)} />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeBeneficiary(i)}
                          className="mt-6 flex items-center justify-center w-8 h-8 rounded border border-red-200 bg-white text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {data.beneficiaries.length < 4 && (
                      <button
                        type="button"
                        onClick={addBeneficiary}
                        className="w-full flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-[#002855]/20 hover:border-[#002855] bg-white hover:bg-gray-50 px-3 py-2.5 text-xs font-medium text-[#002855]/60 hover:text-[#002855] transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Agregar beneficiario ({data.beneficiaries.length}/4)
                      </button>
                    )}
                  </>
                )}

                {section.id === 'case' && (
                  <>
                    <FieldText label="Número A# (File No.) *" value={data.file_number} onChange={(v) => update('file_number', v)} />
                    <FieldText label="Nombre del Juez *" value={data.judge_name} onChange={(v) => update('judge_name', v)} placeholder="Ej: Windrow, Hayden E" />
                    <div className="grid grid-cols-2 gap-3">
                      <FieldText label="Fecha próxima audiencia *" type="date" value={data.next_hearing_date} onChange={(v) => update('next_hearing_date', v)} />
                      <FieldText label="Hora de audiencia *" type="time" value={data.next_hearing_time} onChange={(v) => update('next_hearing_time', v)} />
                    </div>
                    <FieldText label="Fecha del documento *" type="date" value={data.document_date} onChange={(v) => update('document_date', v)} />
                  </>
                )}

                {section.id === 'current_court' && (
                  <>
                    <FieldText label="Nombre de la corte actual *" value={data.current_court_name} onChange={(v) => update('current_court_name', v)} placeholder="Ej: Immigration Court - Seattle" />
                    <FieldText label="Dirección de la corte (calle) *" value={data.current_court_street} onChange={(v) => update('current_court_street', v)} placeholder="Ej: 915 Second Avenue, Suite 613" />
                    <FieldText label="Ciudad, Estado, ZIP *" value={data.current_court_city_state_zip} onChange={(v) => update('current_court_city_state_zip', v)} placeholder="Ej: Seattle, WA 98174" />
                  </>
                )}

                {section.id === 'new_location' && (
                  <>
                    <p className="text-xs text-gray-500 bg-blue-50 p-2 rounded">Nueva dirección del cliente (a donde se traslada)</p>
                    <FieldText label="Nueva dirección (calle) *" value={data.new_address_street} onChange={(v) => update('new_address_street', v)} />
                    <div className="grid grid-cols-3 gap-3">
                      <FieldText label="Ciudad *" value={data.new_address_city} onChange={(v) => update('new_address_city', v)} />
                      <FieldText label="Estado *" value={data.new_address_state} onChange={(v) => update('new_address_state', v)} />
                      <FieldText label="ZIP *" value={data.new_address_zip} onChange={(v) => update('new_address_zip', v)} />
                    </div>

                    <div className="border-t pt-4 mt-2">
                      <p className="text-xs text-gray-500 bg-blue-50 p-2 rounded mb-3">Documentos que acreditan nueva residencia (aparecerán en el PDF)</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                        {[
                          { key: 'pay_stub', label: 'Boleta de Pago' },
                          { key: 'lease_agreement', label: 'Contrato de Alquiler' },
                          { key: 'tax_return', label: 'Declaración de Taxes' },
                          { key: 'utility_bills', label: 'Recibo de Servicios' },
                        ].map((opt) => (
                          <label key={opt.key} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={data.residence_proof_docs.includes(opt.key)}
                              onChange={() => toggleResidenceProof(opt.key)}
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
                        <FieldText label="Nombre de la nueva corte *" value={data.new_court_name} onChange={(v) => update('new_court_name', v)} placeholder="Ej: Immigration Court - Salt Lake City" />
                        <FieldText label="Dirección de la nueva corte (calle) *" value={data.new_court_street} onChange={(v) => update('new_court_street', v)} />
                        <FieldText label="Ciudad, Estado, ZIP *" value={data.new_court_city_state_zip} onChange={(v) => update('new_court_city_state_zip', v)} />
                      </div>
                    </div>
                  </>
                )}

                {section.id === 'counsel' && (
                  <div>
                    <label className={LABEL_CLASS}>Dirección completa del Fiscal Principal (Chief Counsel) *</label>
                    <textarea
                      value={data.chief_counsel_address}
                      onChange={(e) => update('chief_counsel_address', e.target.value)}
                      placeholder={'Ej: Office of the Chief Counsel\n901 Stewart Street, Suite 401\nSeattle, WA 98101'}
                      rows={3}
                      className={INPUT_CLASS}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function FieldText({
  label, value, onChange, type = 'text', placeholder,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className={LABEL_CLASS}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={INPUT_CLASS}
      />
    </div>
  )
}

function SaveBadge({ state }: { state: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (state === 'idle') return null
  if (state === 'saving') {
    return <span className="text-xs text-amber-700 inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Guardando</span>
  }
  if (state === 'saved') {
    return <span className="text-xs text-emerald-700 inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Guardado</span>
  }
  return <span className="text-xs text-red-700 inline-flex items-center gap-1"><Save className="w-3 h-3" /> Error</span>
}
