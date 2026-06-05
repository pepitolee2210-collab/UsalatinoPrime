'use client'

import { useEffect, useState } from 'react'
import { AppShell } from './_components/app-shell'
import { TopBar } from './_components/top-bar'
import { BottomNav, type ScreenId } from './_components/bottom-nav'
import { SideNav } from './_components/side-nav'
import { InicioScreen, type QuickContact, type PhaseAsset } from './_components/screens/inicio-screen'
import { CitasScreen } from './_components/screens/citas-screen'
import { DocumentosScreen } from './_components/screens/documentos-screen'
import { FasesScreen } from './_components/screens/fases-screen'
import { MasScreen } from './_components/screens/mas-screen'
import type { Appointment, CasePhase } from '@/types/database'
import type { TzSource } from '@/lib/appointments/resolve-tz'

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

interface CommunityPost {
  id: string
  type: string
  title: string | null
  content: string | null
  video_url: string | null
  zoom_url: string | null
  pinned: boolean
  created_at: string
}

interface CommunityReaction {
  post_id: string
  user_id: string
  emoji: string
}

interface SchedulingDay {
  day_of_week: number
  start_hour: number
  end_hour: number
}

interface DeclarationDoc {
  id: string
  name: string
  file_size: number
  declaration_number: number
}

export interface ClientPortalProps {
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

  // ── Phase 0 nuevos campos ──
  currentPhase: CasePhase | null
  phaseAsset: PhaseAsset | null
  quickContacts: QuickContact[]

  /** Timezone IANA resuelta server-side para mostrar las citas al cliente. */
  clientTimezone: string
  /** De dónde vino la TZ — solo para mostrar el "hint" en el selector. */
  clientTimezoneSource: TzSource

  /** ¿El cliente ya aceptó la versión vigente de los Términos y Condiciones? */
  termsAccepted: boolean
}

const SCREENS: ScreenId[] = ['inicio', 'citas', 'documentos', 'fases', 'mas']
const SS_KEY_PREFIX = 'ulp-active-screen:'

function isScreenId(value: unknown): value is ScreenId {
  return typeof value === 'string' && (SCREENS as string[]).includes(value)
}

export function ClientPortal(props: ClientPortalProps) {
  const {
    token, clientId, clientName, caseNumber, avatarUrl,
    appointments, zoomLink, uploadedDocuments: _uploadedDocuments, henryDocuments,
    communityPosts, communityReactions, schedulingDays,
    serviceName, serviceSlug, currentPhase, phaseAsset, quickContacts,
    clientTimezone, clientTimezoneSource, termsAccepted: initialTermsAccepted,
  } = props

  const [activeScreen, setActiveScreen] = useState<ScreenId>('inicio')
  const [hydrated, setHydrated] = useState(false)
  // Estado vivo de aceptación de T&C: inicializa del server y se actualiza al
  // aceptar (sin recargar) para limpiar el banner de Inicio y el badge de Más.
  const [termsAccepted, setTermsAccepted] = useState(initialTermsAccepted)
  // Deep-link a una sub-vista de "Más" (ej. desde el banner de Inicio).
  const [masRequestedView, setMasRequestedView] = useState<'terminos' | null>(null)

  function goToTerms() {
    setMasRequestedView('terminos')
    setActiveScreen('mas')
  }

  // Restaurar pantalla activa de sessionStorage (per-token)
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = window.sessionStorage.getItem(SS_KEY_PREFIX + token)
      if (isScreenId(stored)) {
        setActiveScreen(stored)
      }
    } catch {
      /* sessionStorage puede fallar en modo incógnito o políticas estrictas */
    } finally {
      setHydrated(true)
    }
  }, [token])

  // Persistir cambios
  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return
    try {
      window.sessionStorage.setItem(SS_KEY_PREFIX + token, activeScreen)
    } catch {
      /* idem */
    }
  }, [activeScreen, hydrated, token])

  const badges: Partial<Record<ScreenId, number>> = {
    mas: henryDocuments.length || undefined,
  }

  return (
    <AppShell
      topBar={<TopBar clientName={clientName} avatarUrl={avatarUrl} />}
      bottomNav={
        <BottomNav
          activeScreen={activeScreen}
          onChange={setActiveScreen}
          badges={badges}
        />
      }
      sideNav={
        <SideNav
          activeScreen={activeScreen}
          onChange={setActiveScreen}
          badges={badges}
          clientName={clientName}
          avatarUrl={avatarUrl}
        />
      }
    >
      {activeScreen === 'inicio' && (
        <InicioScreen
          clientName={clientName}
          currentPhase={currentPhase}
          serviceName={serviceName}
          serviceSlug={serviceSlug}
          phaseAsset={phaseAsset}
          quickContacts={quickContacts.filter((c) => c.is_online !== false)}
          termsAccepted={termsAccepted}
          onGoToTerms={goToTerms}
        />
      )}
      {activeScreen === 'citas' && (
        <CitasScreen
          token={token}
          appointments={appointments}
          zoomLink={zoomLink}
          initialTimezone={clientTimezone}
          initialTimezoneSource={clientTimezoneSource}
        />
      )}
      {activeScreen === 'documentos' && (
        <DocumentosScreen token={token} serviceSlug={serviceSlug} />
      )}
      {activeScreen === 'fases' && (
        // FasesScreen es la fuente única de verdad para la pestaña Formularios.
        // Para Asilo Político Fase 2 inyecta el FormCard `__evidence_urls__`
        // (handler abre EvidenceUrlsManager en modal). El antiguo
        // ReforzarScreen se mantuvo accidentalmente como redirect — eliminarlo
        // hace que la pestaña Formularios funcione coherentemente en todas las
        // fases del Asilo Político.
        <FasesScreen token={token} clientName={clientName} currentPhase={currentPhase} />
      )}
      {activeScreen === 'mas' && (
        <MasScreen
          token={token}
          clientId={clientId}
          clientName={clientName}
          caseNumber={caseNumber}
          serviceName={serviceName}
          henryDocuments={henryDocuments}
          communityPosts={communityPosts}
          communityReactions={communityReactions}
          schedulingDays={schedulingDays}
          quickContacts={quickContacts}
          termsAccepted={termsAccepted}
          requestedView={masRequestedView}
          onViewConsumed={() => setMasRequestedView(null)}
          onTermsAccepted={() => setTermsAccepted(true)}
        />
      )}
    </AppShell>
  )
}
