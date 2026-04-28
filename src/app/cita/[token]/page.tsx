import { createServiceClient } from '@/lib/supabase/service'
import { XCircle } from 'lucide-react'
import { ClientPortal } from './client-portal'
import { VoiceProvider } from '@/components/voice/voice-context'
import type { Appointment } from '@/types/database'

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

  const [profileRes, caseRes, appointmentsRes, documentsRes, settingsRes, formSubmissionsRes, communityPostsRes, communityReactionsRes, schedulingConfigRes, signedContractRes] = await Promise.all([
    supabase.from('profiles').select('first_name, last_name, email, avatar_url').eq('id', tokenData.client_id).single(),
    supabase.from('cases').select('id, case_number, form_data, service:service_catalog(name, slug)').eq('id', tokenData.case_id).single(),
    supabase.from('appointments').select('*').eq('client_id', tokenData.client_id).order('scheduled_at', { ascending: false }),
    supabase.from('documents').select('id, document_key, name, file_size, status, direction, declaration_number').eq('case_id', tokenData.case_id),
    supabase.from('scheduling_settings').select('*').single(),
    supabase.from('case_form_submissions').select('id, form_type, status, updated_at').eq('case_id', tokenData.case_id).order('updated_at', { ascending: false }),
    supabase.from('community_posts').select('id, type, title, content, video_url, zoom_url, pinned, created_at').order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(30),
    supabase.from('community_reactions').select('post_id, user_id, emoji'),
    supabase.from('scheduling_config').select('day_of_week, start_hour, end_hour').eq('is_available', true).order('day_of_week'),
    supabase.from('contracts').select('id').eq('client_id', tokenData.client_id).eq('status', 'firmado').limit(1).maybeSingle(),
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
  const hasSignedContract = !!signedContractRes.data

  const serviceRaw = caseData?.service as unknown
  const service = Array.isArray(serviceRaw)
    ? (serviceRaw[0] as { name: string; slug: string } | undefined)
    : (serviceRaw as { name: string; slug: string } | null)

  const clientDocuments = allDocuments.filter(d => !d.direction || d.direction === 'client_to_admin')
  const henryDocuments = allDocuments.filter(d => d.direction === 'admin_to_client')
  const declarationDocs = allDocuments
    .filter(d => d.declaration_number != null)
    .map(d => ({ id: d.id, name: d.name, file_size: d.file_size ?? 0, declaration_number: d.declaration_number as number }))

  const formData = (caseData?.form_data || {}) as Record<string, string>
  const clientName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()
  const minorData = {
    minor_full_name: formData.minor_first_name
      ? `${formData.minor_first_name} ${formData.minor_last_name || ''}`.trim()
      : undefined,
    minor_dob: formData.minor_dob || undefined,
    minor_country_of_birth: formData.minor_country_of_birth || undefined,
    mother_full_name: formData.mother_first_name
      ? `${formData.mother_first_name} ${formData.mother_last_name || ''}`.trim()
      : undefined,
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#002855] via-[#003366] to-[#001d3d]">
      {/* Sticky header */}
      <div className="bg-[#001428]/90 backdrop-blur-md border-b border-white/10 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'rgba(242,169,0,0.2)' }}>
            <span className="text-[#F2A900] font-black text-sm">U</span>
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">UsaLatinoPrime</p>
            <p className="text-white/50 text-[11px] mt-0.5">Portal del Cliente</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <VoiceProvider token={token}>
        <ClientPortal
          token={token}
          clientId={tokenData.client_id}
          clientName={clientName}
          caseNumber={caseData?.case_number || ''}
          avatarUrl={profile?.avatar_url || null}
          appointments={appointments}
          zoomLink={zoomLink}
          uploadedDocuments={clientDocuments}
          henryDocuments={henryDocuments}
          formSubmissions={formSubmissions}
          communityPosts={communityPosts}
          communityReactions={communityReactions}
          schedulingDays={schedulingDays}
          declarationDocs={declarationDocs}
          serviceName={service?.name || 'Servicio'}
          serviceSlug={service?.slug || ''}
          minorData={minorData}
          hasSignedContract={hasSignedContract}
        />
        </VoiceProvider>
      </div>
    </div>
  )
}
