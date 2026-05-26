'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { QuickContractGenerator } from '@/components/admin/QuickContractGenerator'
import { FileText, Plus, Pencil, Download, Trash2, ChevronLeft, Send, Link2, CheckCircle, Search, Users, List, LayoutGrid } from 'lucide-react'
import { toast } from 'sonner'
import { MinorEditorModal } from './minor-editor-modal'
import { ContractsKanban } from './contracts-kanban'

interface AddonServiceRow {
  name: string
  price: number
  etapas: string[]
}

interface PaymentScheduleRow {
  number: number
  date: string
  amount: number
}

interface MinorRow {
  fullName: string
  dob: string
  passport: string
  birthplace: string
}

interface ContractRow {
  id: string
  created_at: string
  updated_at: string
  service_name: string
  service_slug: string
  variant_index: number
  addon_services: AddonServiceRow[]
  client_full_name: string
  client_passport: string
  client_phone: string | null
  client_dob: string
  client_signature: string
  minors: MinorRow[]
  total_price: number
  initial_payment: number
  installment_count: number
  monthly_amount: number
  use_custom_monthly: boolean
  contract_start_date: string
  has_installments: boolean
  use_custom_price: boolean
  use_custom_installments: boolean
  payment_schedule: PaymentScheduleRow[]
  objeto_del_contrato: string
  etapas: string[]
  status: string
  signing_token: string | null
  client_signature_image: string | null
  signed_at: string | null
}

const statusLabels: Record<string, string> = {
  borrador: 'Borrador',
  pendiente_firma: 'Pendiente Firma',
  firmado: 'Firmado',
  activo: 'Activo',
  completado: 'Completado',
}

type StatusKind = 'neutral' | 'warning' | 'info' | 'success' | 'completed'
const STATUS_KIND: Record<string, StatusKind> = {
  borrador: 'neutral',
  pendiente_firma: 'warning',
  firmado: 'info',
  activo: 'success',
  completado: 'completed',
}

const STATUS_STYLES: Record<StatusKind, { bg: string; border: string; dot: string; text: string }> = {
  neutral:   { bg: 'var(--admin-accent-soft)',  border: 'var(--admin-border-strong)',  dot: 'var(--admin-fg-muted)', text: 'var(--admin-fg-muted)' },
  warning:   { bg: 'rgba(250,204,21,0.10)',   border: 'rgba(250,204,21,0.3)',   dot: '#FACC15', text: '#FDE68A' },
  info:      { bg: 'rgba(96,165,250,0.10)',   border: 'rgba(96,165,250,0.3)',   dot: '#60A5FA', text: '#93C5FD' },
  success:   { bg: 'rgba(34,197,94,0.10)',    border: 'rgba(34,197,94,0.3)',    dot: '#4ADE80', text: '#86EFAC' },
  completed: { bg: 'var(--admin-border)',  border: 'rgba(255,255,255,0.18)', dot: '#FFFFFF', text: '#FFFFFF' },
}

// ─── Dark techno button classes ───
const BTN_PRIMARY =
  'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full transition-all duration-200 ' +
  'hover:opacity-90 active:scale-95 text-[12px] font-semibold tracking-tight ' +
  'bg-white text-black shadow-[0_4px_18px_rgba(255,255,255,0.18),0_0_0_0.5px_rgba(255,255,255,0.4)_inset] disabled:opacity-50'

const BTN_ICON =
  'inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors ' +
  'hover:bg-white/10 disabled:opacity-50'

interface Props {
  basePath: string
  hideHeader?: boolean
}

export function ContratosView({ basePath, hideHeader }: Props) {
  return (
    <Suspense fallback={<p style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 11, color: 'var(--admin-fg-muted)', letterSpacing: '0.15em' }}>CARGANDO CONTRATOS…</p>}>
      <ContratosInner basePath={basePath} hideHeader={hideHeader} />
    </Suspense>
  )
}

function ContratosInner({ basePath, hideHeader }: Props) {
  const [contracts, setContracts] = useState<ContractRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editingContract, setEditingContract] = useState<ContractRow | null>(null)
  const [showGenerator, setShowGenerator] = useState(false)
  const [search, setSearch] = useState('')
  const [editingMinorsOf, setEditingMinorsOf] = useState<ContractRow | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')
  const supabase = createClient()
  const searchParams = useSearchParams()
  const router = useRouter()

  const prefillFromVoice = useMemo(() => {
    const name = searchParams.get('prefill_name')
    const phone = searchParams.get('prefill_phone')
    const fromVoice = searchParams.get('from_voice')
    if (!name && !phone && !fromVoice) return null
    return {
      name: name || '',
      phone: phone || '',
      fromVoiceAppointmentId: fromVoice || null,
    }
  }, [searchParams])

  useEffect(() => {
    if (prefillFromVoice) setShowGenerator(true)
  }, [prefillFromVoice])

  useEffect(() => {
    const v = searchParams.get('view')
    if (v === 'kanban' || v === 'list') setViewMode(v)
  }, [searchParams])

  function changeViewMode(mode: 'list' | 'kanban') {
    setViewMode(mode)
    const url = new URL(window.location.href)
    if (mode === 'kanban') url.searchParams.set('view', 'kanban')
    else url.searchParams.delete('view')
    router.replace(url.pathname + url.search)
  }

  const filteredContracts = contracts.filter(c => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return c.client_full_name.toLowerCase().includes(q) ||
      c.service_name.toLowerCase().includes(q) ||
      (c.client_passport || '').toLowerCase().includes(q)
  })

  async function loadContracts() {
    setLoading(true)
    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) toast.error('Error al cargar contratos')
    else setContracts(data || [])
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadContracts() }, [])

  async function handleDelete(id: string, clientName: string) {
    if (!confirm(`¿Eliminar el contrato de ${clientName}?`)) return
    const { error } = await supabase.from('contracts').delete().eq('id', id)
    if (error) toast.error('Error al eliminar')
    else { toast.success('Contrato eliminado'); loadContracts() }
  }

  async function handleStatusChange(id: string, newStatus: string) {
    const { error } = await supabase.from('contracts').update({ status: newStatus }).eq('id', id)
    if (error) toast.error('Error al actualizar estado')
    else loadContracts()
  }

  async function handleSendToClient(contract: ContractRow) {
    try {
      const res = await fetch('/api/contracts/generate-signing-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ contract_id: contract.id }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Error al generar enlace'); return }
      await navigator.clipboard.writeText(data.url)
      toast.success('Enlace copiado al portapapeles. Envíeselo al cliente.')
      loadContracts()
    } catch { toast.error('Error de conexión') }
  }

  async function handleCopyLink(token: string) {
    const url = `${window.location.origin}/contrato/${token}`
    await navigator.clipboard.writeText(url)
    toast.success('Enlace copiado al portapapeles')
  }

  function handleWhatsApp(contract: ContractRow) {
    const phone = (contract.client_phone || '').replace(/\D/g, '')
    if (!phone) return toast.error('Este contrato no tiene teléfono registrado')
    const normalized = phone.length === 10 ? `1${phone}` : phone
    if (!contract.signing_token) return toast.error('El contrato aún no tiene enlace de firma')
    const url = `${window.location.origin}/contrato/${contract.signing_token}`
    const firstName = contract.client_full_name.split(' ')[0] || ''
    const message =
      `Hola ${firstName}, soy del equipo de UsaLatino Prime. ` +
      `Aquí está tu contrato para que lo revises y firmes digitalmente: ${url}\n\n` +
      `Cualquier pregunta respóndeme por aquí. ¡Gracias!`
    const waUrl = `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
    window.open(waUrl, '_blank', 'noopener,noreferrer')
    toast.success('Abriendo WhatsApp…')
  }

  async function handleDownloadPDF(contract: ContractRow) {
    try {
      const { generateContractPDF } = await import('@/lib/pdf/generate-contract-pdf')
      const pdf = generateContractPDF({
        serviceName: contract.service_name,
        totalPrice: contract.total_price,
        installments: contract.has_installments,
        installmentCount: contract.installment_count,
        clientFullName: contract.client_full_name,
        clientPassport: contract.client_passport,
        clientDOB: contract.client_dob,
        clientSignature: contract.client_signature,
        objetoDelContrato: contract.objeto_del_contrato,
        etapas: contract.etapas || [],
        addonServices: contract.addon_services?.length > 0 ? contract.addon_services : undefined,
        initialPayment: contract.initial_payment > 0 ? contract.initial_payment : undefined,
        paymentSchedule: contract.payment_schedule?.length > 0 ? contract.payment_schedule : undefined,
        minors: contract.minors?.length > 0 ? contract.minors : undefined,
        clientSignatureImage: contract.client_signature_image || undefined,
      })
      const arrayBuffer = pdf.output('arraybuffer')
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Contrato-${contract.service_slug}-${contract.client_full_name.replace(/\s+/g, '_')}.pdf`
      link.type = 'application/pdf'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success('PDF descargado')
    } catch (error) {
      toast.error(`Error al generar PDF: ${(error as Error).message}`)
    }
  }

  function handleEdit(contract: ContractRow) { setEditingContract(contract); setShowGenerator(true) }
  function handleNewContract() { setEditingContract(null); setShowGenerator(true) }
  function handleGeneratorDone() { setShowGenerator(false); setEditingContract(null); loadContracts() }

  if (showGenerator) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => {
            setShowGenerator(false)
            setEditingContract(null)
            if (prefillFromVoice) router.replace(basePath)
          }}
          className="inline-flex items-center gap-1.5 transition-opacity hover:opacity-80"
          style={{
            fontFamily: 'var(--font-mono-tech)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.2em',
            color: 'var(--admin-fg-muted)',
          }}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          VOLVER A LA LISTA
        </button>

        {prefillFromVoice && (
          <div
            className="rounded-xl px-4 py-3 flex items-start gap-2"
            style={{
              background: 'rgba(244,114,182,0.06)',
              border: '0.5px solid rgba(244,114,182,0.25)',
            }}
          >
            <svg className="w-5 h-5 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="#F472B6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#F9A8D4' }}>
                Cliente proveniente de auto-agenda con IA
              </p>
              <p style={{ fontSize: 12, color: '#FBCFE8', marginTop: 3, lineHeight: 1.5 }}>
                Datos pre-cargados desde la llamada. Ajusta servicio, cuotas y monto, guarda y envía el link por WhatsApp.
              </p>
            </div>
          </div>
        )}

        <h1 style={{ fontSize: 24, fontWeight: 600, color: '#FFFFFF', letterSpacing: '-0.025em' }}>
          {editingContract ? 'Editar Contrato' : 'Nuevo Contrato'}
        </h1>

        <QuickContractGenerator
          editData={editingContract as unknown as Parameters<typeof QuickContractGenerator>[0]['editData']}
          onSaved={handleGeneratorDone}
          prefillName={prefillFromVoice?.name}
          prefillPhone={prefillFromVoice?.phone}
          prefillService={prefillFromVoice ? 'visa-juvenil' : undefined}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        {!hideHeader && (
          <h1 style={{ fontSize: 24, fontWeight: 600, color: '#FFFFFF', letterSpacing: '-0.025em' }}>
            Contratos
          </h1>
        )}
        {hideHeader && <span />}

        <div className="flex items-center gap-2">
          {/* Toggle list / kanban */}
          <div
            className="inline-flex items-center gap-1 p-1 rounded-full"
            style={{
              background: 'var(--admin-accent-soft)',
              border: '0.5px solid rgba(255,255,255,0.08)',
            }}
          >
            <button
              type="button"
              onClick={() => changeViewMode('list')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-300"
              style={{
                background: viewMode === 'list' ? '#FFFFFF' : 'transparent',
                color: viewMode === 'list' ? 'var(--admin-bg-deep)' : 'var(--admin-fg-muted)',
                fontSize: 12,
                fontWeight: viewMode === 'list' ? 700 : 500,
                letterSpacing: '-0.005em',
                boxShadow: viewMode === 'list' ? '0 0 12px rgba(255,255,255,0.15)' : 'none',
              }}
            >
              <List className="w-3 h-3" />
              Lista
            </button>
            <button
              type="button"
              onClick={() => changeViewMode('kanban')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-300"
              style={{
                background: viewMode === 'kanban' ? '#FFFFFF' : 'transparent',
                color: viewMode === 'kanban' ? 'var(--admin-bg-deep)' : 'var(--admin-fg-muted)',
                fontSize: 12,
                fontWeight: viewMode === 'kanban' ? 700 : 500,
                letterSpacing: '-0.005em',
                boxShadow: viewMode === 'kanban' ? '0 0 12px rgba(255,255,255,0.15)' : 'none',
              }}
            >
              <LayoutGrid className="w-3 h-3" />
              Kanban
            </button>
          </div>

          <button onClick={handleNewContract} className={BTN_PRIMARY}>
            <Plus className="w-3.5 h-3.5" />
            Nuevo Contrato
          </button>
        </div>
      </div>

      {contracts.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--admin-fg-subtle)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente por nombre, servicio o pasaporte…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none transition-colors focus:border-white/25"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '0.5px solid rgba(255,255,255,0.1)',
              color: 'var(--admin-fg)',
              fontSize: 13,
              letterSpacing: '-0.005em',
            }}
          />
          {search && (
            <p
              className="mt-2"
              style={{
                fontFamily: 'var(--font-mono-tech)',
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: '0.15em',
                color: 'var(--admin-fg-subtle)',
              }}
            >
              {filteredContracts.length} RESULTADO{filteredContracts.length !== 1 ? 'S' : ''} DE {contracts.length}
            </p>
          )}
        </div>
      )}

      {loading ? (
        <p
          className="text-center py-12"
          style={{
            fontFamily: 'var(--font-mono-tech)',
            fontSize: 11,
            color: 'var(--admin-fg-muted)',
            letterSpacing: '0.15em',
          }}
        >
          CARGANDO CONTRATOS…
        </p>
      ) : contracts.length === 0 ? (
        <div
          className="rounded-2xl py-16 text-center space-y-4"
          style={{
            background: 'linear-gradient(180deg, rgba(20,20,20,0.7), rgba(8,8,8,0.7))',
            border: '0.5px dashed rgba(255,255,255,0.12)',
          }}
        >
          <FileText className="w-12 h-12 mx-auto" style={{ color: 'var(--admin-fg-subtle)' }} />
          <p style={{ fontSize: 13, color: 'var(--admin-fg-muted)' }}>No hay contratos guardados aún.</p>
          <div className="flex justify-center">
            <button onClick={handleNewContract} className={BTN_PRIMARY}>
              <Plus className="w-3.5 h-3.5" />
              Crear primer contrato
            </button>
          </div>
        </div>
      ) : filteredContracts.length === 0 ? (
        <p
          className="text-center py-8"
          style={{
            fontFamily: 'var(--font-mono-tech)',
            fontSize: 11,
            color: 'var(--admin-fg-subtle)',
            letterSpacing: '0.15em',
          }}
        >
          NO SE ENCONTRARON CONTRATOS CON &quot;{search.toUpperCase()}&quot;
        </p>
      ) : null}

      {editingMinorsOf && (
        <MinorEditorModal
          contractId={editingMinorsOf.id}
          minors={editingMinorsOf.minors as { fullName?: string; dob?: string; passport?: string; birthplace?: string }[]}
          onClose={() => setEditingMinorsOf(null)}
          onSaved={() => loadContracts()}
        />
      )}

      {filteredContracts.length > 0 && contracts.length > 0 && viewMode === 'kanban' && (
        <ContractsKanban
          contracts={filteredContracts.map((c) => ({
            id: c.id,
            client_full_name: c.client_full_name,
            service_name: c.service_name,
            total_price: Number(c.total_price),
            status: c.status,
            signing_token: c.signing_token,
            signed_at: c.signed_at,
            created_at: c.created_at,
            has_installments: c.has_installments,
            installment_count: c.installment_count,
            client_phone: c.client_phone,
          }))}
          onEdit={(id) => {
            const c = contracts.find((x) => x.id === id)
            if (c) handleEdit(c)
          }}
          onSendToClient={(id) => {
            const c = contracts.find((x) => x.id === id)
            if (c) handleSendToClient(c)
          }}
          onCopyLink={handleCopyLink}
          onWhatsApp={(id) => {
            const c = contracts.find((x) => x.id === id)
            if (c) handleWhatsApp(c)
          }}
          onDownloadPDF={(id) => {
            const c = contracts.find((x) => x.id === id)
            if (c) handleDownloadPDF(c)
          }}
          onDelete={handleDelete}
        />
      )}

      {filteredContracts.length > 0 && contracts.length > 0 && viewMode === 'list' && (
        <div className="space-y-3">
          {filteredContracts.map((c) => (
            <ContractCard
              key={c.id}
              contract={c}
              onStatusChange={handleStatusChange}
              onCopyLink={handleCopyLink}
              onWhatsApp={handleWhatsApp}
              onSendToClient={handleSendToClient}
              onDownloadPDF={handleDownloadPDF}
              onEdit={handleEdit}
              onEditMinors={(c) => setEditingMinorsOf(c)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// ContractCard
// ════════════════════════════════════════════════════════════════════

function ContractCard({
  contract: c, onStatusChange, onCopyLink, onWhatsApp, onSendToClient, onDownloadPDF, onEdit, onEditMinors, onDelete,
}: {
  contract: ContractRow
  onStatusChange: (id: string, status: string) => void
  onCopyLink: (token: string) => void
  onWhatsApp: (c: ContractRow) => void
  onSendToClient: (c: ContractRow) => void
  onDownloadPDF: (c: ContractRow) => void
  onEdit: (c: ContractRow) => void
  onEditMinors: (c: ContractRow) => void
  onDelete: (id: string, name: string) => void
}) {
  const kind = STATUS_KIND[c.status] ?? 'neutral'
  const s = STATUS_STYLES[kind]
  const signed = c.status === 'firmado' || c.status === 'activo' || c.status === 'completado'

  return (
    <div
      className="relative rounded-2xl p-5 overflow-hidden transition-all duration-300 group"
      style={{
        background: 'linear-gradient(180deg, rgba(20,20,20,0.92), rgba(8,8,8,0.92))',
        border: '0.5px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <span
        aria-hidden
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at top, rgba(255,255,255,0.04), transparent 60%)' }}
      />

      <div className="relative space-y-3">
        {/* Header row */}
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <p style={{ fontSize: 15, fontWeight: 600, color: '#FFFFFF', letterSpacing: '-0.012em' }}>
              {c.client_full_name}
            </p>
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full"
              style={{
                background: s.bg,
                border: `0.5px solid ${s.border}`,
                fontFamily: 'var(--font-mono-tech)',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: s.text,
              }}
            >
              <span className="rounded-full" style={{ width: 5, height: 5, background: s.dot }} />
              {(statusLabels[c.status] || c.status).toUpperCase()}
            </span>
          </div>

          <p style={{ fontSize: 12, color: 'var(--admin-fg-muted)' }}>
            {c.service_name}
            {c.addon_services?.length > 0 && (
              <span style={{ color: 'var(--admin-fg-subtle)' }}> · {c.addon_services.map((a: AddonServiceRow) => a.name).join(' + ')}</span>
            )}
          </p>

          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <span
              style={{
                fontFamily: 'var(--font-mono-tech)',
                fontSize: 16,
                fontWeight: 700,
                color: '#FFFFFF',
                letterSpacing: '-0.012em',
              }}
            >
              ${Number(c.total_price).toLocaleString()}
              <span style={{ fontSize: 10, color: 'var(--admin-fg-subtle)', marginLeft: 4, letterSpacing: '0.1em' }}> USD</span>
            </span>

            {c.has_installments && (
              <span
                style={{
                  fontFamily: 'var(--font-mono-tech)',
                  fontSize: 11,
                  color: 'var(--admin-fg-muted)',
                  letterSpacing: '0.05em',
                }}
              >
                {c.initial_payment > 0 && `INICIAL $${Number(c.initial_payment).toLocaleString()} · `}
                {c.installment_count} CUOTAS
              </span>
            )}

            <span
              style={{
                fontFamily: 'var(--font-mono-tech)',
                fontSize: 10,
                color: 'var(--admin-fg-subtle)',
                letterSpacing: '0.1em',
              }}
            >
              {new Date(c.created_at).toLocaleDateString('es-US', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()}
            </span>

            {c.signed_at && (
              <span
                style={{
                  fontFamily: 'var(--font-mono-tech)',
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#4ADE80',
                  letterSpacing: '0.1em',
                }}
              >
                ✓ FIRMADO {new Date(c.signed_at).toLocaleDateString('es-US', { day: 'numeric', month: 'short' }).toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* Actions row */}
        <div className="flex items-center gap-1.5 flex-wrap pt-2" style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
          {/* Status select */}
          <div className="relative">
            <select
              value={c.status}
              onChange={(e) => onStatusChange(c.id, e.target.value)}
              className="appearance-none px-3 py-1.5 pr-7 rounded-lg outline-none cursor-pointer transition-colors focus:border-white/30"
              style={{
                background: 'var(--admin-accent-soft)',
                border: '0.5px solid rgba(255,255,255,0.1)',
                color: 'var(--admin-fg)',
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '-0.005em',
                colorScheme: 'dark',
              }}
            >
              <option value="borrador" style={{ background: 'var(--admin-bg)', color: 'var(--admin-fg)' }}>Borrador</option>
              <option value="pendiente_firma" style={{ background: 'var(--admin-bg)', color: 'var(--admin-fg)' }}>Pendiente Firma</option>
              <option value="firmado" style={{ background: 'var(--admin-bg)', color: 'var(--admin-fg)' }}>Firmado</option>
              <option value="activo" style={{ background: 'var(--admin-bg)', color: 'var(--admin-fg)' }}>Activo</option>
              <option value="completado" style={{ background: 'var(--admin-bg)', color: 'var(--admin-fg)' }}>Completado</option>
            </select>
            <span
              aria-hidden
              className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--admin-fg-subtle)', fontSize: 9 }}
            >
              ▾
            </span>
          </div>

          {c.signing_token ? (
            <>
              <button
                onClick={() => onCopyLink(c.signing_token!)}
                title="Copiar enlace de firma"
                className={BTN_ICON}
                style={{ color: '#FACC15', border: '0.5px solid rgba(250,204,21,0.25)' }}
              >
                <Link2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onWhatsApp(c)}
                title="Enviar por WhatsApp"
                className={BTN_ICON}
                style={{ color: '#4ADE80', border: '0.5px solid rgba(34,197,94,0.25)' }}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
              </button>
            </>
          ) : signed ? (
            <button
              disabled
              title="Ya firmado"
              className={BTN_ICON}
              style={{ color: '#4ADE80', border: '0.5px solid rgba(34,197,94,0.25)' }}
            >
              <CheckCircle className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => onSendToClient(c)}
              title="Enviar al cliente para firmar"
              className={BTN_ICON}
              style={{ color: '#FACC15', border: '0.5px solid rgba(250,204,21,0.3)' }}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => onDownloadPDF(c)}
            title="Descargar PDF"
            className={BTN_ICON}
            style={{ color: 'var(--admin-fg-muted)', border: '0.5px solid rgba(255,255,255,0.1)' }}
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onEdit(c)}
            title="Editar"
            className={BTN_ICON}
            style={{ color: 'var(--admin-fg-muted)', border: '0.5px solid rgba(255,255,255,0.1)' }}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          {Array.isArray(c.minors) && c.minors.length > 0 && signed && (
            <button
              onClick={() => onEditMinors(c)}
              title="Editar menores (correcciones)"
              className={BTN_ICON}
              style={{ color: '#60A5FA', border: '0.5px solid rgba(96,165,250,0.25)' }}
            >
              <Users className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => onDelete(c.id, c.client_full_name)}
            title="Eliminar"
            className={BTN_ICON}
            style={{ color: '#FCA5A5', border: '0.5px solid rgba(248,113,113,0.25)' }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
