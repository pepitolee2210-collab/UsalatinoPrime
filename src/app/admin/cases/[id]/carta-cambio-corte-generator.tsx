'use client'

// Tab del dashboard del caso (admin/empleado) y wizard del cliente para llenar
// los campos y generar la Carta de Cambio de Corte (6 págs, jsPDF).
//
// Estructura de secciones (reorganizada):
//   1. Datos del Cliente
//   2. Beneficiarios
//   3. Datos del Caso
//   4. Corte Actual  → incluye el Fiscal Principal (Chief Counsel) de la corte ACTUAL
//   5. Nueva Dirección → dirección a donde se mudó el cliente + comprobantes +
//      contexto documental (con asistencia IA)
//   6. Nueva Corte → corte a la que se transfiere + su fiscal (sugeridos por IA
//      a partir de la nueva dirección)
//
// `clientMode` muestra al cliente solo lo que conoce (datos, beneficiarios y la
// nueva dirección); el staff completa corte actual, nueva corte y fiscal.
//
// Autosave con debounce 800ms.

import { useEffect, useState, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import {
  ChevronDown, ChevronUp, User, Users, Building2, MapPin, Gavel,
  FileText, Plus, X, Loader2, Download, Save, CheckCircle2, Sparkles, Landmark,
} from 'lucide-react'
import type { CartaCambioCorteData } from '@/lib/cambio-corte/letter-generator'

interface SectionDef {
  id: string
  title: string
  icon: React.ComponentType<{ className?: string }>
  /** Si false, se oculta cuando clientMode está activo (dato que el cliente no conoce). */
  clientVisible: boolean
}

const ALL_SECTIONS: SectionDef[] = [
  { id: 'client', title: 'Datos del Cliente', icon: User, clientVisible: true },
  { id: 'beneficiaries', title: 'Beneficiarios (Esposa/Hijos)', icon: Users, clientVisible: true },
  { id: 'case', title: 'Datos del Caso', icon: Gavel, clientVisible: false },
  { id: 'current_court', title: 'Corte Actual', icon: Building2, clientVisible: false },
  { id: 'new_address', title: 'Nueva Dirección', icon: MapPin, clientVisible: true },
  { id: 'new_court', title: 'Nueva Corte', icon: Landmark, clientVisible: false },
]

const INPUT_CLASS = 'w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--admin-border-strong)] focus:border-[var(--primary)]'
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
  /** Mensaje contextual en el header. Si null/undefined, se calcula default. */
  headerSubtitle?: string
  /** Vista simplificada para el cliente: oculta secciones legales y botones de IA. */
  clientMode?: boolean
}

export function CartaCambioCorteGenerator({
  caseId,
  caseNumber,
  clientName,
  apiUrl,
  showGenerateButton = true,
  headerSubtitle,
  clientMode = false,
}: Props) {
  const endpoint = apiUrl ?? `/api/admin/cases/${caseId}/carta-cambio-corte`
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<CartaCambioCorteData | null>(null)
  const [filledPdfAt, setFilledPdfAt] = useState<string | null>(null)
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [generating, setGenerating] = useState(false)
  const [suggestingCourt, setSuggestingCourt] = useState(false)
  const [courtSuggestion, setCourtSuggestion] = useState<{ confidence: string; reasoning: string; note?: string } | null>(null)
  const [suggestingDocs, setSuggestingDocs] = useState(false)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    client: true, beneficiaries: false, case: true, current_court: true,
    new_address: true, new_court: true,
  })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sections = ALL_SECTIONS.filter((s) => !clientMode || s.clientVisible)
  const showAi = !clientMode

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

  const scheduleSave = useCallback((next: CartaCambioCorteData, delay = 800) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => persistValues(next), delay)
  }, [persistValues])

  function update<K extends keyof CartaCambioCorteData>(key: K, val: CartaCambioCorteData[K]) {
    setData((prev) => {
      if (!prev) return prev
      const next = { ...prev, [key]: val }
      scheduleSave(next)
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

  function currentAddressPayload() {
    return {
      street: data?.new_address_street ?? '',
      city: data?.new_address_city ?? '',
      state: data?.new_address_state ?? '',
      zip: data?.new_address_zip ?? '',
    }
  }

  async function handleSuggestCourt() {
    if (!data) return
    const addr = currentAddressPayload()
    if (![addr.street, addr.city, addr.state, addr.zip].some((s) => s.trim())) {
      toast.error('Primero ingresa la nueva dirección del cliente.')
      return
    }
    setSuggestingCourt(true)
    setCourtSuggestion(null)
    try {
      const res = await fetch(`${endpoint}/suggest-court`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || `Error ${res.status}`)
      }
      const s = await res.json()
      if (!s.matched_court_key) {
        setCourtSuggestion({ confidence: s.confidence ?? 'baja', reasoning: s.reasoning || 'No se identificó una corte con seguridad. Ingrésala manualmente.' })
        toast.message('Sin sugerencia clara', { description: s.reasoning })
        return
      }
      setData((prev) => {
        if (!prev) return prev
        const next = {
          ...prev,
          new_court_name: s.new_court_name ?? '',
          new_court_street: s.new_court_street ?? '',
          new_court_city_state_zip: s.new_court_city_state_zip ?? '',
          new_court_chief_counsel_address: s.new_court_chief_counsel_address ?? '',
        }
        scheduleSave(next, 300)
        return next
      })
      setCourtSuggestion({ confidence: s.confidence, reasoning: s.reasoning, note: s.note })
      toast.success(`Corte sugerida (confianza ${s.confidence})`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al sugerir la corte')
    } finally {
      setSuggestingCourt(false)
    }
  }

  async function handleSuggestDocContext() {
    if (!data) return
    setSuggestingDocs(true)
    try {
      const res = await fetch(`${endpoint}/suggest-doc-context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: currentAddressPayload(), staffNote: data.additional_context ?? '' }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || `Error ${res.status}`)
      }
      const r = await res.json()
      update('additional_context', r.text)
      toast.success(`Texto propuesto desde ${r.documentsUsed?.length ?? 0} documento(s)`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al proponer el texto')
    } finally {
      setSuggestingDocs(false)
    }
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
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:opacity-90 transition-colors disabled:opacity-60"
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
      {sections.map((section, idx) => {
        const isOpen = openSections[section.id]
        return (
          <div key={section.id} className="bg-white rounded-xl border overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection(section.id)}
              className="flex items-center justify-between w-full p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] flex items-center justify-center text-sm font-bold">
                  {idx + 1}
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
                        className="w-full flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-[var(--admin-border-strong)] hover:border-[var(--primary)] bg-white hover:bg-gray-50 px-3 py-2.5 text-xs font-medium text-[var(--admin-fg-muted)] hover:text-[var(--primary)] transition-all"
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
                    <p className="text-xs text-gray-500 bg-blue-50 p-2 rounded">Corte donde el caso se encuentra actualmente.</p>
                    <FieldText label="Nombre de la corte actual *" value={data.current_court_name} onChange={(v) => update('current_court_name', v)} placeholder="Ej: Immigration Court - Seattle" />
                    <FieldText label="Dirección de la corte (calle) *" value={data.current_court_street} onChange={(v) => update('current_court_street', v)} placeholder="Ej: 915 Second Avenue, Suite 613" />
                    <FieldText label="Ciudad, Estado, ZIP *" value={data.current_court_city_state_zip} onChange={(v) => update('current_court_city_state_zip', v)} placeholder="Ej: Seattle, WA 98174" />

                    <div className="border-t pt-4 mt-2">
                      <label className={LABEL_CLASS}>Fiscal Principal (Chief Counsel) de la corte actual *</label>
                      <p className="text-xs text-gray-500 mb-2">Oficina del OPLA / Chief Counsel a la que se entrega la moción (Certificate of Service). Corresponde a la corte ACTUAL.</p>
                      <textarea
                        value={data.chief_counsel_address}
                        onChange={(e) => update('chief_counsel_address', e.target.value)}
                        placeholder={'Ej: Office of the Chief Counsel\n901 Stewart Street, Suite 401\nSeattle, WA 98101'}
                        rows={3}
                        className={INPUT_CLASS}
                      />
                    </div>
                  </>
                )}

                {section.id === 'new_address' && (
                  <>
                    <p className="text-xs text-gray-500 bg-blue-50 p-2 rounded">Nueva dirección del cliente (a donde se trasladó).</p>
                    <FieldText label="Nueva dirección (calle) *" value={data.new_address_street} onChange={(v) => update('new_address_street', v)} />
                    <div className="grid grid-cols-3 gap-3">
                      <FieldText label="Ciudad *" value={data.new_address_city} onChange={(v) => update('new_address_city', v)} />
                      <FieldText label="Estado *" value={data.new_address_state} onChange={(v) => update('new_address_state', v)} />
                      <FieldText label="ZIP *" value={data.new_address_zip} onChange={(v) => update('new_address_zip', v)} />
                    </div>

                    <div className="border-t pt-4 mt-2">
                      <p className="text-xs text-gray-500 bg-blue-50 p-2 rounded mb-3">Documentos que acreditan nueva residencia (aparecerán en el PDF)</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
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
                              className="rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                            />
                            <span className="text-sm text-gray-700">{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="border-t pt-4 mt-2">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <label className={LABEL_CLASS}>Contexto adicional sobre los documentos (opcional)</label>
                        {showAi && (
                          <button
                            type="button"
                            disabled={suggestingDocs}
                            onClick={handleSuggestDocContext}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors disabled:opacity-60"
                          >
                            {suggestingDocs ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                            Proponer con IA (lee los documentos)
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mb-2">
                        Explica casos especiales para reforzar la moción. Ej: el contrato de alquiler está a nombre del cónyuge.
                        Este texto se agrega como párrafo en la página 2 del PDF.
                      </p>
                      <textarea
                        value={data.additional_context ?? ''}
                        onChange={(e) => update('additional_context', e.target.value)}
                        placeholder={'Ej: The attached lease agreement, executed in the name of my spouse, Elio Pérez, with whom I reside, together with utility bills, evidences my new address.'}
                        rows={4}
                        className={INPUT_CLASS}
                      />
                    </div>
                  </>
                )}

                {section.id === 'new_court' && (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-gray-500 bg-blue-50 p-2 rounded flex-1">Corte a donde se transfiere el caso (según la nueva dirección).</p>
                      {showAi && (
                        <button
                          type="button"
                          disabled={suggestingCourt}
                          onClick={handleSuggestCourt}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors disabled:opacity-60 flex-shrink-0"
                        >
                          {suggestingCourt ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          Sugerir corte con IA
                        </button>
                      )}
                    </div>

                    {showAi && courtSuggestion && (
                      <div className={`rounded-lg border p-3 text-xs ${
                        courtSuggestion.confidence === 'alta' ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : courtSuggestion.confidence === 'media' ? 'border-amber-200 bg-amber-50 text-amber-800'
                          : 'border-red-200 bg-red-50 text-red-800'
                      }`}>
                        <p className="font-semibold">Sugerencia IA — confianza {courtSuggestion.confidence}</p>
                        {courtSuggestion.reasoning && <p className="mt-1">{courtSuggestion.reasoning}</p>}
                        {courtSuggestion.note && <p className="mt-1 italic">⚠ {courtSuggestion.note}</p>}
                        <p className="mt-1 text-[11px] opacity-80">Verifica los datos antes de generar el PDF.</p>
                      </div>
                    )}

                    <FieldText label="Nombre de la nueva corte *" value={data.new_court_name} onChange={(v) => update('new_court_name', v)} placeholder="Ej: Immigration Court - Salt Lake City" />
                    <FieldText label="Dirección de la nueva corte (calle) *" value={data.new_court_street} onChange={(v) => update('new_court_street', v)} />
                    <FieldText label="Ciudad, Estado, ZIP *" value={data.new_court_city_state_zip} onChange={(v) => update('new_court_city_state_zip', v)} />

                    <div className="border-t pt-4 mt-2">
                      <label className={LABEL_CLASS}>Fiscal Principal (Chief Counsel) de la nueva corte</label>
                      <p className="text-xs text-gray-500 mb-2">Solo de referencia (no se imprime en la moción). Útil para futuras notificaciones a la nueva corte.</p>
                      <textarea
                        value={data.new_court_chief_counsel_address ?? ''}
                        onChange={(e) => update('new_court_chief_counsel_address', e.target.value)}
                        placeholder={'Se completa automáticamente al usar "Sugerir corte con IA".'}
                        rows={3}
                        className={INPUT_CLASS}
                      />
                    </div>
                  </>
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
