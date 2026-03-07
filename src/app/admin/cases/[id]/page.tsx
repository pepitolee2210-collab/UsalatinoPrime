import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { AdminCaseView } from './admin-case-view'

export default async function AdminCaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: caseData } = await supabase
    .from('cases')
    .select('*, service:service_catalog(name, slug), client:profiles(first_name, last_name, email, phone)')
    .eq('id', id)
    .single()

  if (!caseData) notFound()

  const [{ data: documents }, { data: activities }, { data: payments }, { data: aiSubmissions }] = await Promise.all([
    supabase.from('documents').select('*').eq('case_id', id),
    supabase
      .from('case_activity')
      .select('*, actor:profiles(first_name, last_name)')
      .eq('case_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('payments')
      .select('*')
      .eq('case_id', id)
      .order('installment_number', { ascending: true }),
    supabase
      .from('case_form_submissions')
      .select('*')
      .eq('case_id', id)
      .order('updated_at', { ascending: false }),
  ])

  return (
    <AdminCaseView
      caseData={caseData}
      documents={documents || []}
      activities={activities || []}
      payments={payments || []}
      aiSubmissions={aiSubmissions || []}
    />
  )
}
