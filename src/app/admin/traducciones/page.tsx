import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TranslationTool } from '@/components/translation/translation-tool'

export const dynamic = 'force-dynamic'

export default async function AdminTraduccionesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, first_name, last_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/login')

  const fullName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Traducciones</h1>
        <p className="text-sm text-gray-500">Sube documentos en español y descarga la traducción certificada en PDF.</p>
      </div>
      <TranslationTool defaultTranslatorName={fullName} />
    </div>
  )
}
