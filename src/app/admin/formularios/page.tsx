import { createClient } from '@/lib/supabase/server'
import { FormulariosView } from './formularios-view'

export default async function FormulariosPage() {
  const supabase = await createClient()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://usalatino-prime-ofew.vercel.app'

  const [visaRes, asiloRes, ajusteRes, renunciaRes, cambioRes] = await Promise.all([
    supabase.from('visa_juvenil_submissions').select('*').order('created_at', { ascending: false }),
    supabase.from('asilo_submissions').select('*').order('created_at', { ascending: false }),
    supabase.from('ajuste_submissions').select('*').order('created_at', { ascending: false }),
    supabase.from('renuncia_submissions').select('*').order('created_at', { ascending: false }),
    supabase.from('cambio_corte_submissions').select('*').order('created_at', { ascending: false }),
  ])

  return (
    <FormulariosView
      visaJuvenil={visaRes.data || []}
      asilo={asiloRes.data || []}
      ajuste={ajusteRes.data || []}
      renuncia={renunciaRes.data || []}
      cambioCorte={cambioRes.data || []}
      baseUrl={baseUrl}
    />
  )
}
