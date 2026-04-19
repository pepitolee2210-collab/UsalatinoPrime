import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Returns true if the caller of this request is authenticated as an admin
 * or employee. Used by the voice agent endpoints to bypass rate limiting
 * (so Henry/Diana can test without getting blocked by the IP quota that
 * protects against abuse from anonymous TikTok traffic).
 *
 * Returns false silently if not authenticated, if the profile row is
 * missing, or if the query fails — never throws, because callers treat
 * this as an optional bypass, not an auth gate.
 */
export async function isAdminOrEmployee(_request: NextRequest): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    return profile?.role === 'admin' || profile?.role === 'employee'
  } catch {
    return false
  }
}
