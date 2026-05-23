import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { FormulariosView } from './formularios-view'
import { PageHeader, AdminKeyframes } from '@/components/admin-ui'

export default async function FormulariosPage() {
  const supabase = await createClient()
  const service = createServiceClient()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://usalatino-prime-ofew.vercel.app'

  const [visaRes, asiloRes, ajusteRes, renunciaRes, cambioRes, aiDocsRes] = await Promise.all([
    supabase.from('visa_juvenil_submissions').select('*').order('created_at', { ascending: false }),
    supabase.from('asilo_submissions').select('*').order('created_at', { ascending: false }),
    supabase.from('ajuste_submissions').select('*').order('created_at', { ascending: false }),
    supabase.from('renuncia_submissions').select('*').order('created_at', { ascending: false }),
    supabase.from('cambio_corte_submissions').select('*').order('created_at', { ascending: false }),
    service.from('case_form_submissions')
      .select('*, case:cases(case_number, client:profiles(first_name, last_name))')
      .order('updated_at', { ascending: false }),
  ])

  const totalForms = (visaRes.data?.length ?? 0) + (asiloRes.data?.length ?? 0) + (ajusteRes.data?.length ?? 0) + (renunciaRes.data?.length ?? 0) + (cambioRes.data?.length ?? 0)
  const aiDocsCount = aiDocsRes.data?.length ?? 0

  const allSubs = [
    ...(visaRes.data || []),
    ...(asiloRes.data || []),
    ...(ajusteRes.data || []),
    ...(renunciaRes.data || []),
    ...(cambioRes.data || []),
  ]
  const pending = allSubs.filter((s: Record<string, unknown>) => s.status === 'pending' || s.status === 'nuevo').length

  return (
    <div className="space-y-6">
      <AdminKeyframes />
      <PageHeader
        eyebrow="Documentos · Formularios"
        title="Formularios"
        accentDot
        description="Todos los formularios recibidos de clientes. Comparte links públicos, filtra por servicio y estado, revisa cada submission."
        telemetry={[
          { label: 'Total', value: totalForms.toLocaleString() },
          { label: 'Pendientes', value: pending.toLocaleString() },
          { label: 'Docs IA', value: aiDocsCount.toLocaleString() },
        ]}
      />
      <FormulariosView
        visaJuvenil={visaRes.data || []}
        asilo={asiloRes.data || []}
        ajuste={ajusteRes.data || []}
        renuncia={renunciaRes.data || []}
        cambioCorte={cambioRes.data || []}
        aiDocuments={aiDocsRes.data || []}
        baseUrl={baseUrl}
      />
    </div>
  )
}
