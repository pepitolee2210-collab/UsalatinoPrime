import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TranslationTool } from '@/components/translation/translation-tool'
import { PageHeader, AdminKeyframes } from '@/components/admin-ui'

export const dynamic = 'force-dynamic'

export default async function AdminTraduccionesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/login')

  return (
    <div className="space-y-6">
      <AdminKeyframes />
      <PageHeader
        eyebrow="Documentos · Traducciones"
        title="Traducciones"
        accentDot
        description="Sube documentos en español y descarga la traducción certificada en PDF, lista para presentar."
      />
      <TranslationTool />
    </div>
  )
}
