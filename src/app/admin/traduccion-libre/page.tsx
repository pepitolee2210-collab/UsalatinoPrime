import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FreeTranslationTool } from '@/components/translation/free-translation-tool'
import { PageHeader, AdminKeyframes } from '@/components/admin-ui'

export const dynamic = 'force-dynamic'

export default async function AdminTraduccionLibrePage() {
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
        eyebrow="Documentos · Traducción Libre"
        title="Traducción Libre"
        accentDot
        description="Traduce cualquier documento (PDF o imagen) entre español e inglés. Para declaraciones, court orders, cartas y anexos — no para actas civiles."
      />
      <FreeTranslationTool />
    </div>
  )
}
