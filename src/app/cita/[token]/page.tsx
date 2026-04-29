import { createServiceClient } from '@/lib/supabase/service'
import { XCircle } from 'lucide-react'
import { ClientPortal, type ClientPortalProps } from './client-portal'
import { VoiceProvider } from '@/components/voice/voice-context'
import type { Appointment, CasePhase } from '@/types/database'
import type { QuickContact, PhaseAsset } from './_components/screens/inicio-screen'

export default async function CitaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = createServiceClient()

  const { data: tokenData, error: tokenError } = await supabase
    .from('appointment_tokens')
    .select('client_id, case_id, is_active')
    .eq('token', token)
    .single()

  if (tokenError || !tokenData || !tokenData.is_active) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#002855] via-[#003366] to-[#001d3d] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-gray-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Enlace no válido</h1>
          <p className="text-sm text-gray-500">
            Este enlace de cita no existe o ya no está activo.
            Contacte a su consultor para obtener un nuevo enlace.
          </p>
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 font-medium">UsaLatinoPrime</p>
            <p className="text-sm text-gray-500">Teléfono: 801-941-3479</p>
          </div>
        </div>
      </div>
    )
  }

  // Queries paralelas existentes (sin cambio).
  const [
    profileRes,
    caseRes,
    appointmentsRes,
    documentsRes,
    settingsRes,
    formSubmissionsRes,
    communityPostsRes,
    communityReactionsRes,
    schedulingConfigRes,
  ] = await Promise.all([
    supabase.from('profiles').select('first_name, last_name, email, avatar_url').eq('id', tokenData.client_id).single(),
    supabase.from('cases').select('id, case_number, form_data, service:service_catalog(id, name, slug)').eq('id', tokenData.case_id).single(),
    supabase.from('appointments').select('*').eq('client_id', tokenData.client_id).order('scheduled_at', { ascending: false }),
    supabase.from('documents').select('id, document_key, name, file_size, status, direction, declaration_number').eq('case_id', tokenData.case_id),
    supabase.from('scheduling_settings').select('*').single(),
    supabase.from('case_form_submissions').select('id, form_type, status, updated_at').eq('case_id', tokenData.case_id).order('updated_at', { ascending: false }),
    supabase.from('community_posts').select('id, type, title, content, video_url, zoom_url, pinned, created_at').order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(30),
    supabase.from('community_reactions').select('post_id, user_id, emoji'),
    supabase.from('scheduling_config').select('day_of_week, start_hour, end_hour').eq('is_available', true).order('day_of_week'),
  ])

  const profile = profileRes.data
  const caseData = caseRes.data
  const appointments = (appointmentsRes.data || []) as Appointment[]
  const allDocuments = documentsRes.data || []
  const zoomLink = settingsRes.data?.zoom_link || ''
  const formSubmissions = formSubmissionsRes.data || []
  const communityPosts = communityPostsRes.data || []
  const communityReactions = communityReactionsRes.data || []
  const schedulingDays = (schedulingConfigRes.data || []) as { day_of_week: number; start_hour: number; end_hour: number }[]

  const serviceRaw = caseData?.service as unknown
  const service = Array.isArray(serviceRaw)
    ? (serviceRaw[0] as { id: string; name: string; slug: string } | undefined)
    : (serviceRaw as { id: string; name: string; slug: string } | null)

  const clientDocuments = allDocuments.filter(d => !d.direction || d.direction === 'client_to_admin')
  const henryDocuments = allDocuments.filter(d => d.direction === 'admin_to_client')
  const declarationDocs = allDocuments
    .filter(d => d.declaration_number != null)
    .map(d => ({ id: d.id, name: d.name, file_size: d.file_size ?? 0, declaration_number: d.declaration_number as number }))

  const clientName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()

  // ──────────────────────────────────────────────────────────────────
  // Sprint 0 — datos nuevos (tolerantes a migraciones no aplicadas).
  // Si las tablas/columnas no existen aún, devuelven null/[] sin romper.
  // ──────────────────────────────────────────────────────────────────

  const [phaseRes, phaseAssetRes, contactsRes] = await Promise.all([
    supabase.from('cases')
      .select('current_phase, process_start, state_us, parent_deceased, in_orr_custody, has_criminal_history, minor_close_to_21')
      .eq('id', tokenData.case_id)
      .maybeSingle(),
    service?.id
      ? supabase.from('service_phase_assets')
          .select('phase, welcome_video_url, welcome_video_poster, description_es')
          .eq('service_id', service.id)
      : Promise.resolve({ data: null, error: null }),
    supabase.from('quick_contacts')
      .select('id, name, role, phone_e164, whatsapp_e164, avatar_url, show_in_inicio, show_in_ayuda, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
  ])

  const phaseRow = phaseRes.error ? null : phaseRes.data
  const currentPhase: CasePhase | null = (phaseRow?.current_phase as CasePhase | null) ?? null

  const allPhaseAssets = (phaseAssetRes.error ? null : phaseAssetRes.data) as
    | { phase: CasePhase; welcome_video_url: string | null; welcome_video_poster: string | null; description_es: string | null }[]
    | null
  const phaseAsset: PhaseAsset | null =
    currentPhase && allPhaseAssets
      ? allPhaseAssets.find((a) => a.phase === currentPhase) ?? null
      : null

  const quickContacts: QuickContact[] = (contactsRes.error ? [] : (contactsRes.data || []))
    .filter((c: { show_in_inicio: boolean }) => c.show_in_inicio)
    .map((c: { id: number; name: string; role: string; phone_e164: string | null; whatsapp_e164: string | null; avatar_url: string | null }) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      phone_e164: c.phone_e164,
      whatsapp_e164: c.whatsapp_e164,
      avatar_url: c.avatar_url,
      is_online: undefined, // Pendiente: cruzar con consultant_availability_time_blocks (Sprint 0 fin)
    }))

  // Fallback de cortesía mientras la migración no esté aplicada y no haya seed.
  // Hardcodea Diana y Pepito (consistente con lo que el código actual mostraba)
  // para que la pantalla Inicio nunca se vea vacía.
  const effectiveQuickContacts: QuickContact[] = quickContacts.length > 0
    ? quickContacts
    : [
        { id: -1, name: 'Diana',  role: 'Asesora Legal',   phone_e164: '+12677874365', whatsapp_e164: '+12677874365', avatar_url: null },
        { id: -2, name: 'Pepito', role: 'Soporte Técnico', phone_e164: '+51908765016', whatsapp_e164: '+51908765016', avatar_url: null },
      ]

  const portalProps: ClientPortalProps = {
    token,
    clientId: tokenData.client_id,
    clientName,
    caseNumber: caseData?.case_number || '',
    avatarUrl: profile?.avatar_url || null,
    appointments,
    zoomLink,
    uploadedDocuments: clientDocuments,
    henryDocuments,
    formSubmissions,
    communityPosts,
    communityReactions,
    schedulingDays,
    declarationDocs,
    serviceName: service?.name || 'Servicio',
    serviceSlug: service?.slug || '',
    currentPhase,
    phaseAsset,
    quickContacts: effectiveQuickContacts,
  }

  return (
    <VoiceProvider token={token}>
      <ClientPortal {...portalProps} />
    </VoiceProvider>
  )
}
