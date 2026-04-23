import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Sidebar counts for the employee panel.
 * Currently only returns WhatsApp active conversations for senior_consultant
 * (Vanessa). Other employee types get zeroes to keep the payload shape stable.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, employee_type')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'employee') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  if (profile.employee_type !== 'senior_consultant') {
    return NextResponse.json({ whatsappActive: 0 })
  }

  const { count } = await supabase
    .from('whatsapp_conversations')
    .select('*', { count: 'exact', head: true })
    .in('status', ['active', 'filtered_in'])

  return NextResponse.json({ whatsappActive: count || 0 })
}
