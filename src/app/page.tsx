import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: role } = await supabase.rpc('get_user_role', { user_id: user.id })

  if (role === 'admin') {
    redirect('/ceo')
  }

  if (role === 'employee') {
    redirect('/employee/contracts')
  }

  redirect('/portal/dashboard')
}
