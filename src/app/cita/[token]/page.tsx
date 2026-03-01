import { createServiceClient } from '@/lib/supabase/service'
import { CalendarClock, XCircle } from 'lucide-react'
import { AppointmentBooking } from './appointment-booking'
import { DocumentUploadSection } from './document-upload-section'
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
          <h1 className="text-xl font-bold text-gray-900 mb-2">Enlace no v&aacute;lido</h1>
          <p className="text-sm text-gray-500">
            Este enlace de cita no existe o ya no est&aacute; activo.
            Contacte a su consultor para obtener un nuevo enlace.
          </p>
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 font-medium">UsaLatinoPrime</p>
            <p className="text-sm text-gray-500">Tel&eacute;fono: 801-941-3479</p>
          </div>
        </div>
      </div>
    )
  }

  // Fetch datos del cliente y caso
  const [profileRes, caseRes, appointmentsRes, documentsRes, settingsRes] = await Promise.all([
    supabase.from('profiles').select('first_name, last_name, email').eq('id', tokenData.client_id).single(),
    supabase.from('cases').select('id, case_number, service:service_catalog(name)').eq('id', tokenData.case_id).single(),
    supabase.from('appointments').select('*').eq('client_id', tokenData.client_id).order('scheduled_at', { ascending: false }),
    supabase.from('documents').select('id, document_key, name, file_size, status').eq('case_id', tokenData.case_id),
    supabase.from('scheduling_settings').select('*').single(),
  ])

  const profile = profileRes.data
  const caseData = caseRes.data
  const appointments = (appointmentsRes.data || []) as Appointment[]
  const documents = documentsRes.data || []
  const zoomLink = settingsRes.data?.zoom_link || ''

  const serviceRaw = caseData?.service as unknown
  const service = Array.isArray(serviceRaw)
    ? (serviceRaw[0] as { name: string } | undefined)
    : (serviceRaw as { name: string } | null)

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
            <p className="text-white/60 text-xs">Agendar Cita</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Info del cliente */}
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <h1 className="text-lg font-bold text-gray-900">
            Hola, {profile?.first_name} {profile?.last_name}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Caso #{caseData?.case_number} — {service?.name || 'Servicio'}
          </p>
        </div>

        {/* Sección de agendamiento */}
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <AppointmentBooking
            token={token}
            appointments={appointments}
            zoomLink={zoomLink}
          />
        </div>

        {/* Sección de documentos */}
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <DocumentUploadSection
            token={token}
            uploadedDocuments={documents}
          />
        </div>
      </div>
    </div>
  )
}
