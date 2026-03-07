import { createServiceClient } from '@/lib/supabase/service'
import { CalendarClock, XCircle } from 'lucide-react'
import { ClientPortal } from './client-portal'
import type { Appointment } from '@/types/database'

export default async function CitaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = createServiceClient()

  // Validar token
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
          <h1 className="text-xl font-bold text-gray-900 mb-2">Enlace no valido</h1>
          <p className="text-sm text-gray-500">
            Este enlace de cita no existe o ya no esta activo.
            Contacte a su consultor para obtener un nuevo enlace.
          </p>
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 font-medium">UsaLatinoPrime</p>
            <p className="text-sm text-gray-500">Telefono: 801-941-3479</p>
          </div>
        </div>
      </div>
    )
  }

  // Fetch all data in parallel
  const [profileRes, caseRes, appointmentsRes, documentsRes, settingsRes, formSubmissionsRes] = await Promise.all([
    supabase.from('profiles').select('first_name, last_name, email').eq('id', tokenData.client_id).single(),
    supabase.from('cases').select('id, case_number, form_data, service:service_catalog(name, slug)').eq('id', tokenData.case_id).single(),
    supabase.from('appointments').select('*').eq('client_id', tokenData.client_id).order('scheduled_at', { ascending: false }),
    supabase.from('documents').select('id, document_key, name, file_size, status, direction').eq('case_id', tokenData.case_id),
    supabase.from('scheduling_settings').select('*').single(),
    supabase.from('case_form_submissions').select('id, form_type, status, updated_at').eq('case_id', tokenData.case_id).order('updated_at', { ascending: false }),
  ])

  const profile = profileRes.data
  const caseData = caseRes.data
  const appointments = (appointmentsRes.data || []) as Appointment[]
  const allDocuments = documentsRes.data || []
  const zoomLink = settingsRes.data?.zoom_link || ''
  const formSubmissions = formSubmissionsRes.data || []

  const serviceRaw = caseData?.service as unknown
  const service = Array.isArray(serviceRaw)
    ? (serviceRaw[0] as { name: string; slug: string } | undefined)
    : (serviceRaw as { name: string; slug: string } | null)

  // Separate client docs from Henry's docs
  const clientDocuments = allDocuments.filter(d => !d.direction || d.direction === 'client_to_admin')
  const henryDocuments = allDocuments.filter(d => d.direction === 'admin_to_client')

  // Extract minor data from case form_data for pre-filling
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
      {/* Header */}
      <div className="bg-[#002855]/80 backdrop-blur border-b border-white/10 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#F2A900]/20 flex items-center justify-center">
            <CalendarClock className="w-4 h-4 text-[#F2A900]" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">UsaLatinoPrime</p>
            <p className="text-white/60 text-xs">Portal del Cliente</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Client info */}
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <h1 className="text-lg font-bold text-gray-900">
            Hola, {profile?.first_name} {profile?.last_name}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Caso #{caseData?.case_number} — {service?.name || 'Servicio'}
          </p>
        </div>

        {/* Portal with tabs */}
        <ClientPortal
          token={token}
          appointments={appointments}
          zoomLink={zoomLink}
          uploadedDocuments={clientDocuments}
          henryDocuments={henryDocuments}
          formSubmissions={formSubmissions}
          serviceName={service?.name || 'Servicio'}
          serviceSlug={service?.slug || ''}
          clientName={clientName}
          minorData={minorData}
        />
      </div>
    </div>
  )
}
