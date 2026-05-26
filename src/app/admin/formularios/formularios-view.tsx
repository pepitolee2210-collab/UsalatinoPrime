'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Baby, FileText, Plus, Copy, Check, ExternalLink, Link2, Sparkles, Eye } from 'lucide-react'
import { VisaJuvenilRow } from '@/components/admin/VisaJuvenilRow'
import { AsiloRow } from '@/components/admin/AsiloRow'
import { AjusteRow } from '@/components/admin/AjusteRow'
import { RenunciaRow } from '@/components/admin/RenunciaRow'
import { CambioCorteRow } from '@/components/admin/CambioCorteRow'
import Link from 'next/link'

const TABS = [
  { key: 'visa-juvenil', label: 'Visa Juvenil', icon: Baby },
  { key: 'asilo', label: 'Asilo I-589', icon: FileText },
  { key: 'ajuste', label: 'Ajuste I-485', icon: FileText },
  { key: 'renuncia', label: 'Renuncia', icon: FileText },
  { key: 'cambio-corte', label: 'Cambio Corte', icon: FileText },
  { key: 'docs-ia', label: 'Docs IA', icon: Sparkles },
] as const

type TabKey = typeof TABS[number]['key']

const STATUS_FILTERS = ['all', 'pending', 'reviewed', 'archived'] as const
const RENUNCIA_STATUS_FILTERS = ['all', 'nuevo', 'en_revision', 'aprobado', 'rechazado'] as const

interface FormulariosViewProps {
  visaJuvenil: Record<string, unknown>[]
  asilo: Record<string, unknown>[]
  ajuste: Record<string, unknown>[]
  renuncia: Record<string, unknown>[]
  cambioCorte: Record<string, unknown>[]
  aiDocuments: Record<string, unknown>[]
  baseUrl: string
}

const FORM_LINKS = [
  { key: 'visa-juvenil', label: 'Visa Juvenil (SIJS)', path: '/visa-juvenil-form' },
  { key: 'asilo', label: 'Asilo I-589', path: '/asilo-form' },
  { key: 'ajuste', label: 'Ajuste de Estatus I-485', path: '/ajuste-form' },
  { key: 'renuncia', label: 'Renuncia de Custodia', path: '/renuncia-form' },
  { key: 'miedo-creible', label: 'Miedo Creíble', path: '/miedo-creible' },
] as const

export function FormulariosView({ visaJuvenil, asilo, ajuste, renuncia, cambioCorte, aiDocuments, baseUrl }: FormulariosViewProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialTab = (searchParams.get('tab') as TabKey) || 'visa-juvenil'
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [copiedLink, setCopiedLink] = useState<string | null>(null)

  async function handleCopyLink(path: string) {
    const url = `${baseUrl}${path}`
    await navigator.clipboard.writeText(url)
    setCopiedLink(path)
    setTimeout(() => setCopiedLink(null), 2000)
  }

  function handleTabChange(tab: TabKey) {
    setActiveTab(tab)
    setStatusFilter('all')
    router.replace(`/admin/formularios?tab=${tab}`, { scroll: false })
  }

  function getSubmissions() {
    switch (activeTab) {
      case 'visa-juvenil': return visaJuvenil
      case 'asilo': return asilo
      case 'ajuste': return ajuste
      case 'renuncia': return renuncia
      case 'cambio-corte': return cambioCorte
      case 'docs-ia': return aiDocuments
    }
  }

  function getFilteredSubmissions() {
    const subs = getSubmissions()
    if (statusFilter === 'all') return subs
    return subs.filter((s) => (s as Record<string, unknown>).status === statusFilter)
  }

  function getPendingCount(subs: Record<string, unknown>[], tab: TabKey) {
    if (tab === 'renuncia' || tab === 'cambio-corte') {
      return subs.filter((s) => s.status === 'nuevo').length
    }
    return subs.filter((s) => s.status === 'pending').length
  }

  const isRenunciaStyle = activeTab === 'renuncia' || activeTab === 'cambio-corte'
  const filters = isRenunciaStyle ? RENUNCIA_STATUS_FILTERS : STATUS_FILTERS
  const submissions = getFilteredSubmissions()

  const filterLabels: Record<string, string> = {
    all: 'Todos',
    pending: 'Pendientes',
    reviewed: 'Revisados',
    archived: 'Archivados',
    nuevo: 'Nuevos',
    en_revision: 'En Revisión',
    aprobado: 'Aprobados',
    rechazado: 'Rechazados',
  }

  return (
    <div className="space-y-6">
      {/* Action button para cambio-corte */}
      {activeTab === 'cambio-corte' && (
        <div className="flex justify-end">
          <Link
            href="/admin/cambio-corte/nuevo"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full transition-all duration-200 hover:opacity-90 active:scale-95"
            style={{
              background: '#FFFFFF',
              color: 'var(--admin-bg-deep)',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '-0.005em',
              boxShadow: '0 4px 18px rgba(255,255,255,0.18), 0 0 0 0.5px rgba(255,255,255,0.4) inset',
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo Cambio de Corte
          </Link>
        </div>
      )}

      {/* Links de Formularios Públicos */}
      <div
        className="rounded-2xl p-5 relative overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(20,20,20,0.92), rgba(8,8,8,0.92))',
          border: '0.5px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <span
            className="inline-flex items-center justify-center w-8 h-8 rounded-xl"
            style={{
              background: 'var(--admin-accent-soft)',
              border: '0.5px solid rgba(255,255,255,0.12)',
            }}
          >
            <Link2 className="w-3.5 h-3.5" style={{ color: '#FFFFFF' }} />
          </span>
          <div>
            <p
              style={{
                fontFamily: 'var(--font-mono-tech)',
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: '0.2em',
                color: 'var(--admin-fg-muted)',
              }}
            >
              LINKS PÚBLICOS · COMPARTIR POR WHATSAPP
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {FORM_LINKS.map((fl) => (
            <div
              key={fl.key}
              className="group flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl transition-all duration-300 hover:bg-white/5"
              style={{
                background: 'rgba(255,255,255,0.025)',
                border: '0.5px solid rgba(255,255,255,0.08)',
              }}
            >
              <div className="min-w-0">
                <p style={{ fontSize: 13, fontWeight: 600, color: '#FFFFFF', letterSpacing: '-0.005em' }} className="truncate">
                  {fl.label}
                </p>
                <p
                  className="truncate"
                  style={{
                    fontFamily: 'var(--font-mono-tech)',
                    fontSize: 10,
                    color: 'var(--admin-fg-subtle)',
                    letterSpacing: '0.02em',
                    marginTop: 2,
                  }}
                >
                  {fl.path}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={fl.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:bg-white/10"
                  style={{ color: 'var(--admin-fg-muted)' }}
                  title="Abrir formulario"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  onClick={() => handleCopyLink(fl.path)}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
                  style={{
                    color: copiedLink === fl.path ? '#4ADE80' : 'var(--admin-fg-muted)',
                    background: copiedLink === fl.path ? 'rgba(34,197,94,0.10)' : 'transparent',
                  }}
                  title="Copiar link"
                >
                  {copiedLink === fl.path ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Service tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {TABS.map((tab) => {
          const subs = tab.key === 'visa-juvenil' ? visaJuvenil
            : tab.key === 'asilo' ? asilo
            : tab.key === 'ajuste' ? ajuste
            : tab.key === 'renuncia' ? renuncia
            : tab.key === 'docs-ia' ? aiDocuments
            : cambioCorte
          const pendingCount = tab.key === 'docs-ia'
            ? subs.filter((s: Record<string, unknown>) => s.status === 'draft').length
            : getPendingCount(subs, tab.key)
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 whitespace-nowrap"
              style={{
                background: isActive
                  ? 'linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.04))'
                  : 'rgba(255,255,255,0.025)',
                border: isActive ? '0.5px solid rgba(255,255,255,0.3)' : '0.5px solid rgba(255,255,255,0.08)',
                color: isActive ? '#FFFFFF' : 'var(--admin-fg-muted)',
                fontSize: 13,
                fontWeight: isActive ? 600 : 500,
                letterSpacing: '-0.005em',
                boxShadow: isActive ? '0 4px 16px rgba(255,255,255,0.12), 0 0 0 0.5px rgba(255,255,255,0.05) inset' : 'none',
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              {pendingCount > 0 && (
                <span
                  className="inline-flex items-center justify-center"
                  style={{
                    background: isActive ? '#FFFFFF' : 'rgba(250,204,21,0.15)',
                    color: isActive ? 'var(--admin-bg-deep)' : '#FDE68A',
                    fontFamily: 'var(--font-mono-tech)',
                    fontSize: 10,
                    fontWeight: 700,
                    minWidth: 18,
                    height: 18,
                    padding: '0 5px',
                    borderRadius: 9,
                    border: isActive ? 'none' : '0.5px solid rgba(250,204,21,0.3)',
                  }}
                >
                  {pendingCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div
          className="inline-flex items-center gap-1 p-1 rounded-full"
          style={{
            background: 'var(--admin-accent-soft)',
            border: '0.5px solid rgba(255,255,255,0.08)',
          }}
        >
          {filters.map((f) => {
            const isActive = statusFilter === f
            return (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className="px-3.5 py-1.5 rounded-full transition-all duration-300"
                style={{
                  background: isActive ? '#FFFFFF' : 'transparent',
                  color: isActive ? 'var(--admin-bg-deep)' : 'var(--admin-fg-muted)',
                  fontSize: 11.5,
                  fontWeight: isActive ? 700 : 500,
                  letterSpacing: '-0.005em',
                  boxShadow: isActive ? '0 0 12px rgba(255,255,255,0.18)' : 'none',
                }}
              >
                {filterLabels[f]}
              </button>
            )
          })}
        </div>
        <span
          style={{
            fontFamily: 'var(--font-mono-tech)',
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: '0.18em',
            color: 'var(--admin-fg-subtle)',
          }}
        >
          {submissions.length} RESULTADO{submissions.length !== 1 ? 'S' : ''}
        </span>
      </div>

      {/* Submissions */}
      {submissions.length > 0 ? (
        <div className="space-y-3">
          {submissions.map((sub: Record<string, unknown>) => {
            const id = sub.id as string
            switch (activeTab) {
              case 'visa-juvenil':
                return <VisaJuvenilRow key={id} submission={sub as unknown as Parameters<typeof VisaJuvenilRow>[0]['submission']} />
              case 'asilo':
                return <AsiloRow key={id} submission={sub as unknown as Parameters<typeof AsiloRow>[0]['submission']} />
              case 'ajuste':
                return <AjusteRow key={id} submission={sub as unknown as Parameters<typeof AjusteRow>[0]['submission']} />
              case 'renuncia':
                return <RenunciaRow key={id} submission={sub as unknown as Parameters<typeof RenunciaRow>[0]['submission']} />
              case 'cambio-corte':
                return <CambioCorteRow key={id} submission={sub as unknown as Parameters<typeof CambioCorteRow>[0]['submission']} />
              case 'docs-ia':
                return <AiDocRow key={id} submission={sub} />
            }
          })}
        </div>
      ) : (
        <div
          className="rounded-2xl py-16 text-center"
          style={{
            background: 'linear-gradient(180deg, rgba(20,20,20,0.7), rgba(8,8,8,0.7))',
            border: '0.5px solid rgba(255,255,255,0.08)',
          }}
        >
          <p style={{ fontSize: 13, color: 'var(--admin-fg-subtle)', fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.15em' }}>
            SIN FORMULARIOS {statusFilter !== 'all' ? `· ${filterLabels[statusFilter].toUpperCase()}` : ''}
          </p>
        </div>
      )}
    </div>
  )
}

// === AI Document Row — dark techno ===
const AI_STATUS_STYLES: Record<string, { bg: string; border: string; dot: string; text: string; label: string }> = {
  draft:            { bg: 'var(--admin-accent-soft)', border: 'var(--admin-border-strong)', dot: 'var(--admin-fg-muted)', text: 'var(--admin-fg-muted)', label: 'Borrador' },
  submitted:        { bg: 'rgba(96,165,250,0.10)', border: 'rgba(96,165,250,0.3)', dot: '#60A5FA', text: '#93C5FD', label: 'Enviado' },
  reviewed:         { bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.3)', dot: '#A78BFA', text: '#C4B5FD', label: 'Revisado' },
  needs_correction: { bg: 'rgba(251,146,60,0.10)', border: 'rgba(251,146,60,0.3)', dot: '#FB923C', text: '#FDBA74', label: 'Correcciones' },
  approved:         { bg: 'rgba(34,197,94,0.10)', border: 'rgba(34,197,94,0.3)', dot: '#4ADE80', text: '#86EFAC', label: 'Aprobado' },
}

function AiDocRow({ submission }: { submission: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false)
  const caseInfo = submission.case as Record<string, unknown> | null
  const clientInfo = Array.isArray(caseInfo?.client) ? caseInfo.client[0] : (caseInfo?.client as Record<string, unknown> | null)
  const formData = (submission.form_data as Record<string, unknown>) || {}
  const agent = formData.agent as string | undefined
  const agentLabel = agent === 'sij' ? 'Declaración SIJ'
    : agent === 'credible_fear' ? 'Miedo Creíble'
    : agent === 'witness' ? 'Testimonio'
    : (submission.form_type as string)
  const status = (submission.status as string) || 'draft'
  const statusStyle = AI_STATUS_STYLES[status] || AI_STATUS_STYLES.draft
  const generatedDoc = (formData.generated_document as string) || ''
  const input = formData.input as Record<string, unknown> | undefined

  return (
    <div
      className="relative rounded-2xl p-5 overflow-hidden transition-all duration-300"
      style={{
        background: 'linear-gradient(180deg, rgba(20,20,20,0.92), rgba(8,8,8,0.92))',
        border: '0.5px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Left accent line */}
      <span
        aria-hidden
        className="absolute top-0 left-0 bottom-0 w-[2px]"
        style={{
          background: 'linear-gradient(180deg, transparent, #F2A900 30%, #F2A900 70%, transparent)',
          opacity: 0.6,
        }}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Sparkles className="w-3.5 h-3.5" style={{ color: '#F2A900' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#FFFFFF', letterSpacing: '-0.005em' }}>
              {agentLabel}
            </span>
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full"
              style={{
                background: statusStyle.bg,
                border: `0.5px solid ${statusStyle.border}`,
                fontFamily: 'var(--font-mono-tech)',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: statusStyle.text,
              }}
            >
              <span className="rounded-full" style={{ width: 5, height: 5, background: statusStyle.dot }} />
              {statusStyle.label.toUpperCase()}
            </span>
            {(caseInfo?.case_number as string | undefined) && (
              <span
                style={{
                  fontFamily: 'var(--font-mono-tech)',
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--admin-fg-subtle)',
                  letterSpacing: '0.05em',
                }}
              >
                #{caseInfo!.case_number as string}
              </span>
            )}
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--admin-fg-muted)' }}>
            {clientInfo ? `${(clientInfo as Record<string, unknown>).first_name} ${(clientInfo as Record<string, unknown>).last_name}` : 'Cliente'}
            <span style={{ color: 'var(--admin-fg-subtle)', fontFamily: 'var(--font-mono-tech)', fontSize: 10, marginLeft: 8, letterSpacing: '0.05em' }}>
              {' · '}
              {new Date(submission.updated_at as string).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).toUpperCase()}
            </span>
          </p>
          {(input?.minor_full_name as string | undefined) && (
            <p style={{ fontSize: 11, color: 'var(--admin-fg-subtle)', marginTop: 4 }}>
              Menor: <span style={{ color: 'var(--admin-fg-muted)' }}>{input!.minor_full_name as string}</span>
            </p>
          )}
          {(input?.applicant_full_name as string | undefined) && agent === 'credible_fear' && (
            <p style={{ fontSize: 11, color: 'var(--admin-fg-subtle)', marginTop: 4 }}>
              Solicitante: <span style={{ color: 'var(--admin-fg-muted)' }}>{input!.applicant_full_name as string}</span>
            </p>
          )}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200 hover:bg-white/10 active:scale-95"
          style={{
            background: 'var(--admin-accent-soft)',
            border: '0.5px solid rgba(255,255,255,0.1)',
            color: '#FFFFFF',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '-0.005em',
          }}
        >
          <Eye className="w-3 h-3" />
          {expanded ? 'Cerrar' : 'Ver'}
        </button>
      </div>

      {expanded && generatedDoc && (
        <div
          className="mt-4 rounded-xl overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '0.5px solid rgba(255,255,255,0.08)',
          }}
        >
          <div
            className="px-3.5 py-2 flex justify-between items-center"
            style={{
              background: 'rgba(255,255,255,0.025)',
              borderBottom: '0.5px solid rgba(255,255,255,0.06)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono-tech)',
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: '0.15em',
                color: 'var(--admin-fg-muted)',
              }}
            >
              GENERADO CON {((formData.model as string) || 'IA').toUpperCase()}
            </span>
            <button
              onClick={() => { navigator.clipboard.writeText(generatedDoc) }}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded transition-colors hover:bg-white/5"
              style={{
                fontFamily: 'var(--font-mono-tech)',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: 'var(--admin-fg-muted)',
              }}
            >
              <Copy className="w-2.5 h-2.5" /> COPIAR
            </button>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto admin-scroll">
            <pre
              className="whitespace-pre-wrap"
              style={{
                fontSize: 12.5,
                color: 'var(--admin-fg-muted)',
                fontFamily: 'Georgia, serif',
                lineHeight: 1.65,
              }}
            >
              {generatedDoc}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
