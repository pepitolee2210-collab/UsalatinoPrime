'use client'

import { useState } from 'react'
import { CalendarClock, FileText, FileUp, Download, CheckCircle, BookOpen } from 'lucide-react'
import { AppointmentBooking } from './appointment-booking'
import { DocumentUploadSection } from './document-upload-section'
import { HenryDocuments } from './henry-documents'
import { ClientStoryWizard } from './client-story-wizard'

import type { Appointment } from '@/types/database'

interface UploadedDoc {
  id: string
  document_key: string
  name: string
  file_size?: number
  status: string
  direction?: string
}

interface FormSubmission {
  id: string
  form_type: string
  status: string
  updated_at: string
}

interface ClientPortalProps {
  token: string
  appointments: Appointment[]
  zoomLink: string
  uploadedDocuments: UploadedDoc[]
  henryDocuments: UploadedDoc[]
  formSubmissions: FormSubmission[]
  serviceName: string
  serviceSlug: string
  clientName: string
  minorData?: {
    minor_full_name?: string
    minor_dob?: string
    minor_country_of_birth?: string
    mother_full_name?: string
  }
}

const BASE_TABS = [
  { id: 'cita', label: 'Cita', icon: CalendarClock },
  { id: 'documentos', label: 'Mis Documentos', icon: FileUp },
  { id: 'henry-docs', label: 'Docs del Consultor', icon: Download },
] as const

const STORY_TAB = { id: 'mi-historia', label: 'Mi Historia', icon: BookOpen } as const

type TabId = typeof BASE_TABS[number]['id'] | 'mi-historia'

export function ClientPortal({
  token,
  appointments,
  zoomLink,
  uploadedDocuments,
  henryDocuments,
  formSubmissions,
  serviceName,
  serviceSlug,
  clientName,
  minorData,
}: ClientPortalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('cita')

  const isVisaJuvenil = serviceSlug === 'visa-juvenil'

  // Progress indicators
  const hasAppointment = appointments.some(a => a.status === 'scheduled' || a.status === 'completed')
  const clientDocsCount = uploadedDocuments.filter(d => !d.direction || d.direction === 'client_to_admin').length
  const hasClientDocs = clientDocsCount >= 3
  const hasHenryDocs = henryDocuments.length > 0
  const hasSubmittedStory = formSubmissions.some(f =>
    f.form_type === 'client_story' && (f.status === 'submitted' || f.status === 'approved')
  )
  const stepsArray = isVisaJuvenil
    ? [hasAppointment, hasClientDocs, hasSubmittedStory, hasHenryDocs]
    : [hasAppointment, hasClientDocs, hasHenryDocs]
  const completedSteps = stepsArray.filter(Boolean).length
  const totalSteps = stepsArray.length

  const visibleTabs = isVisaJuvenil
    ? [...BASE_TABS.slice(0, 2), STORY_TAB, BASE_TABS[2]]
    : [...BASE_TABS]

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="bg-white rounded-2xl shadow-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Progreso de tu caso</h2>
          <span className="text-xs font-medium text-[#F2A900]">{completedSteps} de {totalSteps} completados</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5">
          <div
            className="bg-gradient-to-r from-[#F2A900] to-[#D4940A] h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${(completedSteps / totalSteps) * 100}%` }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <StepIndicator done={hasAppointment} label="Cita" />
          <StepIndicator done={hasClientDocs} label="Documentos" />
          {isVisaJuvenil && <StepIndicator done={hasSubmittedStory} label="Mi Historia" />}
          <StepIndicator done={hasHenryDocs} label="Docs Consultor" />
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex border-b overflow-x-auto">
          {visibleTabs.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                  isActive
                    ? 'border-[#F2A900] text-[#002855] bg-amber-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.id === 'henry-docs' && henryDocuments.length > 0 && (
                  <span className="bg-[#F2A900] text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {henryDocuments.length}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="p-6">
          {activeTab === 'cita' && (
            <AppointmentBooking
              token={token}
              appointments={appointments}
              zoomLink={zoomLink}
            />
          )}
          {activeTab === 'documentos' && (
            <DocumentUploadSection
              token={token}
              uploadedDocuments={uploadedDocuments.filter(d => !d.direction || d.direction === 'client_to_admin')}
            />
          )}
          {activeTab === 'mi-historia' && isVisaJuvenil && (
            <ClientStoryWizard token={token} clientName={clientName} />
          )}
          {activeTab === 'henry-docs' && (
            <HenryDocuments
              token={token}
              documents={henryDocuments}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function StepIndicator({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1">
      {done ? (
        <CheckCircle className="w-3.5 h-3.5 text-green-500" />
      ) : (
        <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300" />
      )}
      <span className={`text-[11px] ${done ? 'text-green-600 font-medium' : 'text-gray-400'}`}>{label}</span>
    </div>
  )
}
