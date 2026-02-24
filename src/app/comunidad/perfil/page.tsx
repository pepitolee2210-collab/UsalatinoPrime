import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProfileForm } from './ProfileForm'

export default async function PerfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name, phone, email, avatar_url')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-[#002855] mb-6">Mi Perfil</h1>
      <ProfileForm
        userId={user.id}
        initialData={{
          firstName: profile.first_name,
          lastName: profile.last_name,
          phone: profile.phone,
          email: profile.email,
          avatarUrl: profile.avatar_url,
        }}
      />
    </div>
  )
}
