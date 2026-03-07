'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ClipboardList, Baby, FileText, Clock, CheckCircle, Archive, Search, XCircle, Plus, Copy, Check, ExternalLink, Link2, AlertTriangle, Sparkles, Eye } from 'lucide-react'
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
  visaJuvenil: any[]
  asilo: any[]
  ajuste: any[]
  renuncia: any[]
  cambioCorte: any[]
  aiDocuments: any[]
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
    return subs.filter(s => s.status === statusFilter)
  }

  function getPendingCount(subs: any[], tab: TabKey) {
    if (tab === 'renuncia' || tab === 'cambio-corte') {
      return subs.filter(s => s.status === 'nuevo').length
    }
    return subs.filter(s => s.status === 'pending').length
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-[#002855]" />
            Formularios
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Todos los formularios recibidos de clientes
          </p>
        </div>
        {activeTab === 'cambio-corte' && (
          <Link
            href="/admin/cambio-corte/nuevo"
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#002855] text-white rounded-lg hover:bg-[#001d3d] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuevo Cambio de Corte
          </Link>
        )}
      </div>

      {/* Links de Formularios Públicos */}
      <Card className="border-[#002855]/10 bg-[#002855]/[0.02]">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="w-4 h-4 text-[#002855]" />
            <span className="text-sm font-semibold text-gray-900">Links de Formularios</span>
            <span className="text-xs text-gray-400">— copia y comparte por WhatsApp</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {FORM_LINKS.map((fl) => (
              <div
                key={fl.key}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white border border-gray-100 hover:border-[#002855]/20 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{fl.label}</p>
                  <p className="text-xs text-gray-400 font-mono truncate">{fl.path}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={fl.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-gray-400 hover:text-[#002855] hover:bg-[#002855]/5 rounded transition-colors"
                    title="Abrir formulario"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => handleCopyLink(fl.path)}
                    className={`p-1.5 rounded transition-colors ${
                      copiedLink === fl.path
                        ? 'text-green-600 bg-green-50'
                        : 'text-gray-400 hover:text-[#002855] hover:bg-[#002855]/5'
                    }`}
                    title="Copiar link"
                  >
                    {copiedLink === fl.path ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {TABS.map((tab) => {
          const subs = tab.key === 'visa-juvenil' ? visaJuvenil
            : tab.key === 'asilo' ? asilo
            : tab.key === 'ajuste' ? ajuste
            : tab.key === 'renuncia' ? renuncia
            : tab.key === 'docs-ia' ? aiDocuments
            : cambioCorte
          const pendingCount = tab.key === 'docs-ia'
            ? subs.filter((s: any) => s.status === 'draft').length
            : getPendingCount(subs, tab.key)
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? 'bg-[#002855] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {pendingCount > 0 && (
                <Badge className={`ml-1 text-xs ${
                  activeTab === tab.key
                    ? 'bg-white/20 text-white'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {pendingCount}
                </Badge>
              )}
            </button>
          )
        })}
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {filters.map((f) => (
          <Button
            key={f}
            variant={statusFilter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(f)}
            className={statusFilter === f ? 'bg-[#002855]' : ''}
          >
            {filterLabels[f]}
          </Button>
        ))}
        <span className="text-sm text-gray-500 ml-2">
          {submissions.length} resultado{submissions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Submissions */}
      {submissions.length > 0 ? (
        <div className="space-y-3">
          {submissions.map((sub: any) => {
            switch (activeTab) {
              case 'visa-juvenil':
                return <VisaJuvenilRow key={sub.id} submission={sub} />
              case 'asilo':
                return <AsiloRow key={sub.id} submission={sub} />
              case 'ajuste':
                return <AjusteRow key={sub.id} submission={sub} />
              case 'renuncia':
                return <RenunciaRow key={sub.id} submission={sub} />
              case 'cambio-corte':
                return <CambioCorteRow key={sub.id} submission={sub} />
              case 'docs-ia':
                return <AiDocRow key={sub.id} submission={sub} />
            }
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-gray-500 text-sm">
            No hay formularios {statusFilter !== 'all' ? `con estado "${filterLabels[statusFilter]}"` : ''} en esta categoría
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// === AI Document Row ===
const AI_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Borrador', color: 'bg-gray-100 text-gray-600' },
  submitted: { label: 'Enviado', color: 'bg-blue-100 text-blue-700' },
  reviewed: { label: 'Revisado', color: 'bg-purple-100 text-purple-700' },
  needs_correction: { label: 'Correcciones', color: 'bg-orange-100 text-orange-700' },
  approved: { label: 'Aprobado', color: 'bg-green-100 text-green-700' },
}

function AiDocRow({ submission }: { submission: any }) {
  const [expanded, setExpanded] = useState(false)
  const caseInfo = submission.case
  const clientInfo = Array.isArray(caseInfo?.client) ? caseInfo.client[0] : caseInfo?.client
  const formData = submission.form_data || {}
  const agentLabel = formData.agent === 'sij' ? 'Declaracion SIJ'
    : formData.agent === 'credible_fear' ? 'Miedo Creible'
    : formData.agent === 'witness' ? 'Testimonio'
    : submission.form_type
  const statusConfig = AI_STATUS_CONFIG[submission.status] || AI_STATUS_CONFIG.draft
  const generatedDoc = formData.generated_document || ''

  return (
    <Card className="border-l-4 border-l-[#F2A900]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Sparkles className="w-4 h-4 text-[#F2A900]" />
              <span className="font-semibold text-gray-900 text-sm">{agentLabel}</span>
              <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
              {caseInfo?.case_number && (
                <span className="text-xs text-gray-400">Caso #{caseInfo.case_number}</span>
              )}
            </div>
            <p className="text-sm text-gray-600">
              {clientInfo ? `${clientInfo.first_name} ${clientInfo.last_name}` : 'Cliente'}
              {' — '}
              <span className="text-xs text-gray-400">
                {new Date(submission.updated_at).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </p>
            {formData.input?.minor_full_name && (
              <p className="text-xs text-gray-400 mt-0.5">Menor: {formData.input.minor_full_name}</p>
            )}
            {formData.input?.applicant_full_name && formData.agent === 'credible_fear' && (
              <p className="text-xs text-gray-400 mt-0.5">Solicitante: {formData.input.applicant_full_name}</p>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setExpanded(!expanded)}
          >
            <Eye className="w-3.5 h-3.5 mr-1" />
            {expanded ? 'Cerrar' : 'Ver'}
          </Button>
        </div>

        {expanded && generatedDoc && (
          <div className="mt-4 border rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-3 py-2 border-b flex justify-between items-center">
              <span className="text-xs font-medium text-gray-600">Documento generado con {formData.model || 'IA'}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => { navigator.clipboard.writeText(generatedDoc); }}
              >
                <Copy className="w-3 h-3 mr-1" /> Copiar
              </Button>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto bg-white">
              <pre className="text-sm text-gray-800 whitespace-pre-wrap font-serif leading-relaxed">{generatedDoc}</pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
