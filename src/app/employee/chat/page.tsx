import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ChatClient } from './chat-client'

export const dynamic = 'force-dynamic'

export default async function EmployeeChatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, first_name, last_name, employee_type')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.role !== 'employee') {
    redirect('/login')
  }

  return (
    <ChatClient
      currentUserId={user.id}
      currentUserName={`${profile.first_name || ''} ${profile.last_name || ''}`.trim()}
    />
  )
}
