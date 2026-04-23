import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WhatsappDetailView } from '@/app/admin/whatsapp/whatsapp-detail-view'

export const dynamic = 'force-dynamic'

export default async function EmployeeWhatsappConversationDetailPage({
  params,
}: {
  params: Promise<{ conversationId: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('employee_type')
    .eq('id', user.id)
    .single()

  if (profile?.employee_type !== 'senior_consultant') {
    redirect('/employee/dashboard')
  }

  const { conversationId } = await params
  return <WhatsappDetailView conversationId={conversationId} basePath="/employee/whatsapp" />
}
