'use client'

import { useState, useRef } from 'react'
import {
  CalendarClock, FileUp, Download, CheckCircle, BookOpen,
  ClipboardList, Users, Camera, Loader2, FileText, X,
} from 'lucide-react'
import { AppointmentBooking } from './appointment-booking'
import { DocumentUploadSection } from './document-upload-section'
import { HenryDocuments } from './henry-documents'
import { ClientStoryWizard } from './client-story-wizard'
import { I589Wizard } from './i589-wizard'
import { I360Wizard } from './i360-wizard'
import { CommunityPortal } from './community-portal'
import type { Appointment } from '@/types/database'

interface UploadedDoc {
  id: string; document_key: string; name: string
  file_size?: number; status: string; direction?: string
}
interface FormSubmission {
  id: string; form_type: string; status: string; updated_at: string
}
interface CommunityPost {
  id: string; type: string; title: string | null; content: string | null
  video_url: string | null; zoom_url: string | null; pinned: boolean; created_at: string
}
interface CommunityReaction {
  post_id: string; user_id: string; emoji: string
}
interface SchedulingDay {
  day_of_week: number; start_hour: number; end_hour: number
}

interface DeclarationDoc {
  id: string; name: string; file_size: number; declaration_number: number
}

interface ClientPortalProps {
  token: string
  clientId: string
  clientName: string
  caseNumber: string
  avatarUrl: string | null
  appointments: Appointment[]
  zoomLink: string
  uploadedDocuments: UploadedDoc[]
  henryDocuments: UploadedDoc[]
  formSubmissions: FormSubmission[]
  communityPosts: CommunityPost[]
  communityReactions: CommunityReaction[]
  schedulingDays: SchedulingDay[]
  declarationDocs: DeclarationDoc[]
  serviceName: string
  serviceSlug: string
  minorData?: {
    minor_full_name?: string; minor_dob?: string
    minor_country_of_birth?: string; mother_full_name?: string
  }
  hasSignedContract?: boolean
}

const TABS = {
  cita:       { label: 'Cita',            shortLabel: 'Cita',      icon: CalendarClock },
  documentos: { label: 'Mis Documentos',  shortLabel: 'Documentos', icon: FileUp },
  historia:   { label: 'Mi Historia',     shortLabel: 'Historia',   icon: BookOpen },
  i360:       { label: 'I-360',           shortLabel: 'I-360',     icon: ClipboardList },
  i589:       { label: 'I-589',           shortLabel: 'I-589',     icon: ClipboardList },
  consultor:  { label: 'Del Consultor',   shortLabel: 'Consultor',  icon: Download },
  comunidad:  { label: 'Comunidad',       shortLabel: 'Comunidad',  icon: Users },
} as const

type TabId = keyof typeof TABS

export function ClientPortal({
  token, clientId, clientName, caseNumber, avatarUrl,
  appointments, zoomLink, uploadedDocuments, henryDocuments,
  formSubmissions, communityPosts, communityReactions, schedulingDays,
  declarationDocs, serviceName, serviceSlug, minorData, hasSignedContract,
}: ClientPortalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('cita')
  const [contractOpen, setContractOpen] = useState(false)
  const [avatar, setAvatar] = useState<string | null>(avatarUrl)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isVisaJuvenil = serviceSlug === 'visa-juvenil'
  const isAsilo = serviceSlug === 'asilo-defensivo' || serviceSlug === 'asilo-afirmativo'

  const hasAppointment = appointments.some(a => a.status === 'scheduled' || a.status === 'completed')
  const hasClientDocs = uploadedDocuments.filter(d => !d.direction || d.direction === 'client_to_admin').length >= 3
  const hasHenryDocs = henryDocuments.length > 0
  const hasSubmittedStory = formSubmissions.some(f =>
    f.form_type === 'client_story' && (f.status === 'submitted' || f.status === 'approved')
  )
  const hasSubmittedI589 = formSubmissions.some(f =>
    f.form_type === 'i589_part_b1' && (f.status === 'submitted' || f.status === 'approved')
  )
  const hasSubmittedI360 = formSubmissions.some(f =>
    f.form_type === 'i360_sijs' && (f.status === 'submitted' || f.status === 'approved')
  )

  const steps = isVisaJuvenil
    ? [{ done: hasAppointment, label: 'Cita' }, { done: hasClientDocs, label: 'Documentos' }, { done: hasSubmittedStory, label: 'Historia' }, { done: hasSubmittedI360, label: 'I-360' }, { done: hasHenryDocs, label: 'Consultor' }]
    : isAsilo
    ? [{ done: hasAppointment, label: 'Cita' }, { done: hasClientDocs, label: 'Documentos' }, { done: hasSubmittedI589, label: 'I-589' }, { done: hasHenryDocs, label: 'Consultor' }]
    : [{ done: hasAppointment, label: 'Cita' }, { done: hasClientDocs, label: 'Documentos' }, { done: hasHenryDocs, label: 'Consultor' }]

  const completedSteps = steps.filter(s => s.done).length
  const progressPct = Math.round((completedSteps / steps.length) * 100)

  const visibleTabs: TabId[] = isVisaJuvenil
    ? ['cita', 'documentos', 'historia', 'i360', 'comunidad', 'consultor']
    : isAsilo
    ? ['cita', 'documentos', 'i589', 'comunidad', 'consultor']
    : ['cita', 'documentos', 'comunidad', 'consultor']

  const initials = clientName.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase()

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('token', token)
    try {
      const res = await fetch('/api/client/avatar', { method: 'POST', body: fd })
      if (res.ok) {
        const { url } = await res.json()
        setAvatar(url + '?t=' + Date.now())
      }
    } catch { /* silent */ } finally {
      setUploadingAvatar(false)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');

        .portal-root { font-family: 'DM Sans', sans-serif; }
        .portal-name { font-family: 'Playfair Display', serif; }

        .tab-bar { scrollbar-width: none; }
        .tab-bar::-webkit-scrollbar { display: none; }

        @keyframes tab-fade {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .tab-content { animation: tab-fade 0.22s ease both; }

        @keyframes avatar-ring {
          0%,100% { box-shadow: 0 0 0 3px rgba(242,169,0,0.6); }
          50%      { box-shadow: 0 0 0 7px rgba(242,169,0,0); }
        }
        .avatar-uploading { animation: avatar-ring 1.1s ease-in-out infinite; }

        @keyframes cp-pulse {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:0.4; transform:scale(0.8); }
        }

        @keyframes progress-grow {
          from { width: 0%; }
        }
        .progress-bar { animation: progress-grow 0.9s cubic-bezier(0.22,1,0.36,1) both; }
      `}</style>

      <div className="portal-root space-y-3">

        {/* ════════════════════════════════
            PROFILE CARD
        ════════════════════════════════ */}
        <div className="bg-white rounded-3xl overflow-hidden shadow-xl">

          {/* Banner */}
          <div
            className="h-28 relative"
            style={{ background: 'linear-gradient(135deg, #000f1f 0%, #001d3d 40%, #002f5c 100%)' }}
          >
            {/* Dot texture */}
            <div className="absolute inset-0 opacity-[0.15]"
              style={{ backgroundImage: 'radial-gradient(circle, #F2A900 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
            {/* Gold glow corner */}
            <div className="absolute top-0 right-0 w-40 h-40 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at top right, rgba(242,169,0,0.15) 0%, transparent 65%)' }} />
          </div>

          <div className="px-6 pb-6">
            {/* Avatar + case badge row */}
            <div className="flex items-end justify-between -mt-12 mb-4">
              {/* Avatar */}
              <div className="relative">
                <div
                  className={`w-24 h-24 rounded-2xl overflow-hidden ring-4 ring-white shadow-xl ${uploadingAvatar ? 'avatar-uploading' : ''}`}
                  style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.15), 0 0 0 4px white' }}
                >
                  {avatar ? (
                    <img src={avatar} alt={clientName} className="w-full h-full object-cover" />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-3xl font-black"
                      style={{ background: 'linear-gradient(135deg, #001d3d, #002f5c)', color: '#F2A900' }}
                    >
                      {initials}
                    </div>
                  )}
                </div>
                {/* Camera button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  title="Cambiar foto de perfil"
                  className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl flex items-center justify-center shadow-lg transition-all hover:scale-110 active:scale-95 border-2 border-white"
                  style={{ background: '#F2A900' }}
                >
                  {uploadingAvatar
                    ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                    : <Camera className="w-3.5 h-3.5 text-white" />
                  }
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </div>

              {/* Case number badge */}
              <div
                className="text-xs font-bold px-4 py-2 rounded-xl tracking-wide"
                style={{ background: 'rgba(0,40,85,0.07)', color: '#002855' }}
              >
                #{caseNumber}
              </div>
            </div>

            {/* Name & service */}
            <h1 className="portal-name text-2xl text-gray-900 leading-tight mb-0.5">{clientName}</h1>
            <p className="text-sm text-gray-500 mb-5">{serviceName}</p>

            {/* Progress */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 tracking-wide uppercase">Progreso del caso</span>
                <span className="text-xs font-bold tabular-nums" style={{ color: '#F2A900' }}>
                  {completedSteps} / {steps.length}
                </span>
              </div>

              {/* Bar */}
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: '#f0f1f3' }}>
                <div
                  className="progress-bar h-full rounded-full"
                  style={{
                    width: `${progressPct}%`,
                    background: 'linear-gradient(90deg, #F2A900 0%, #ffcc33 100%)',
                    boxShadow: '0 1px 4px rgba(242,169,0,0.4)',
                  }}
                />
              </div>

              {/* Steps */}
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}>
                {steps.map(step => (
                  <div key={step.label} className="flex flex-col items-center gap-1.5">
                    {step.done ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                    )}
                    <span className={`text-[10px] font-semibold text-center leading-tight ${step.done ? 'text-green-600' : 'text-gray-400'}`}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact cards */}
            <div className="mt-4 p-3 rounded-2xl" style={{ background: 'linear-gradient(135deg, #001020 0%, #002855 100%)' }}>
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2.5">¿Necesita ayuda?</p>
              <div className="grid grid-cols-2 gap-2">
                <a href="https://wa.me/12677874365" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(242,169,0,0.15)' }}>
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#F2A900]"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Diana</p>
                    <p className="text-[9px] text-white/40">Asesora Legal</p>
                  </div>
                </a>
                <a href="https://wa.me/51908765016" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(0,212,255,0.15)' }}>
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#00d4ff]"><path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/></svg>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Giuseppe</p>
                    <p className="text-[9px] text-white/40">Soporte Técnico</p>
                  </div>
                </a>
              </div>
            </div>

            {/* Ver contrato firmado — solo si el cliente ya firmó */}
            {hasSignedContract && (
              <button
                type="button"
                onClick={() => setContractOpen(true)}
                className="mt-3 w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl transition-all hover:shadow-lg text-left"
                style={{ background: 'linear-gradient(135deg, #F2A900 0%, #D4940A 100%)' }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#001020] leading-tight">Ver contrato firmado</p>
                    <p className="text-[10px] text-[#001020]/70 mt-0.5">Previsualiza tu copia del contrato</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-[#001020]/80 uppercase tracking-wider">Abrir</span>
              </button>
            )}
          </div>
        </div>

        {/* ════════════════════════════════
            TABS + CONTENT
        ════════════════════════════════ */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">

          {/* Tab bar */}
          <div className="tab-bar flex overflow-x-auto" style={{ borderBottom: '1px solid #f0f1f3' }}>
            {visibleTabs.map(tabId => {
              const { shortLabel, icon: Icon } = TABS[tabId]
              const isActive = activeTab === tabId
              return (
                <button
                  key={tabId}
                  onClick={() => setActiveTab(tabId)}
                  className="relative flex flex-col items-center gap-1.5 px-4 py-4 flex-shrink-0 min-w-[72px] transition-all"
                  style={{
                    color: isActive ? '#002855' : '#9ca3af',
                    background: isActive ? 'rgba(242,169,0,0.05)' : 'transparent',
                    borderBottom: isActive ? '2.5px solid #F2A900' : '2.5px solid transparent',
                  }}
                >
                  <Icon className="w-[18px] h-[18px]" />
                  <span className="text-[11px] font-bold whitespace-nowrap">{shortLabel}</span>
                  {/* Badge para consultor */}
                  {tabId === 'consultor' && henryDocuments.length > 0 && (
                    <span
                      className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center text-white leading-none"
                      style={{ background: '#F2A900' }}
                    >
                      {henryDocuments.length}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Content */}
          <div key={activeTab} className="tab-content p-5 sm:p-7">
            {activeTab === 'cita' && (
              <AppointmentBooking token={token} appointments={appointments} zoomLink={zoomLink} />
            )}
            {activeTab === 'documentos' && (
              <DocumentUploadSection
                token={token}
                uploadedDocuments={uploadedDocuments.filter(d => !d.direction || d.direction === 'client_to_admin')}
                serviceSlug={serviceSlug}
              />
            )}
            {activeTab === 'historia' && isVisaJuvenil && (
              <ClientStoryWizard token={token} clientName={clientName} declarationDocs={declarationDocs} />
            )}
            {activeTab === 'i360' && isVisaJuvenil && (
              <I360Wizard token={token} clientName={clientName} />
            )}
            {activeTab === 'i589' && isAsilo && (
              <I589Wizard token={token} clientName={clientName} />
            )}
            {activeTab === 'consultor' && (
              <HenryDocuments token={token} documents={henryDocuments} />
            )}
            {activeTab === 'comunidad' && (
              <CommunityPortal
                token={token}
                clientId={clientId}
                posts={communityPosts}
                reactions={communityReactions}
                schedulingDays={schedulingDays}
              />
            )}
          </div>
        </div>

      </div>

      {/* Modal de previsualización del contrato firmado */}
      {contractOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
          style={{ background: 'rgba(0, 8, 20, 0.85)' }}
          onClick={() => setContractOpen(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-4xl h-[92vh] sm:h-[88vh] shadow-2xl flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header del modal */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-gray-200">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #F2A900 0%, #D4940A 100%)' }}
                >
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 leading-tight truncate">Contrato firmado</p>
                  <p className="text-[11px] text-gray-500 truncate">{clientName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <a
                  href={`/api/cita/${token}/signed-contract`}
                  download
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors"
                  style={{ background: '#002855' }}
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar PDF
                </a>
                <a
                  href={`/api/cita/${token}/signed-contract`}
                  download
                  className="sm:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg text-white"
                  style={{ background: '#002855' }}
                  aria-label="Descargar"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setContractOpen(false)}
                  className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                  aria-label="Cerrar"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Preview del PDF embed */}
            <div className="flex-1 bg-gray-100 overflow-hidden">
              <iframe
                src={`/api/cita/${token}/signed-contract#toolbar=0&navpanes=0`}
                className="w-full h-full border-0"
                title="Contrato firmado"
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
