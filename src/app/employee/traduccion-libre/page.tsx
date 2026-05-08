import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FreeTranslationTool } from '@/components/translation/free-translation-tool'

export const dynamic = 'force-dynamic'

export default async function EmployeeTraduccionLibrePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.role !== 'employee') redirect('/login')

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Traducción Libre</h1>
        <p className="text-sm text-gray-500">
          Traduce cualquier documento (PDF o imagen) entre español e inglés. Diferente del traductor de actas civiles —
          este es para declaraciones, court orders, cartas, anexos.
        </p>
      </div>
      <FreeTranslationTool />
    </div>
  )
}
