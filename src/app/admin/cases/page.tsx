import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { CasesView } from '@/components/admin/CasesView'

export default async function AdminCasesPage() {
  const supabase = await createClient()
  const service = createServiceClient()

  const [
    { data: cases },
    { data: documents },
    { data: submissions },
  ] = await Promise.all([
    supabase
      .from('cases')
      .select('*, service:service_catalog(name), client:profiles(first_name, last_name, email)')
      .order('created_at', { ascending: false }),
    service
      .from('documents')
      .select('case_id'),
    service
      .from('case_form_submissions')
      .select('case_id, status')
      .neq('status', 'draft'),
  ])

  // Build lookup maps: case_id -> counts
  const docCounts = new Map<string, number>()
  for (const d of documents || []) {
    docCounts.set(d.case_id, (docCounts.get(d.case_id) || 0) + 1)
  }

  const submissionMap = new Map<string, { total: number; submitted: number }>()
  for (const s of submissions || []) {
    const current = submissionMap.get(s.case_id) || { total: 0, submitted: 0 }
    current.total++
    if (s.status === 'submitted' || s.status === 'approved') current.submitted++
    submissionMap.set(s.case_id, current)
  }

  // Enrich cases with counts
  const enrichedCases = (cases || []).map((c: Record<string, unknown>) => ({
    ...c,
    doc_count: docCounts.get(c.id as string) || 0,
    submission_total: submissionMap.get(c.id as string)?.total || 0,
    submission_done: submissionMap.get(c.id as string)?.submitted || 0,
  }))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Todos los Casos</h1>
      <CasesView cases={enrichedCases} />
    </div>
  )
}
