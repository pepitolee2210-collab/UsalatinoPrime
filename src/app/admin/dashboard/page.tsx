import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * El CEO Dashboard se mudó a /ceo (portal ejecutivo independiente del
 * panel operativo). Este redirect existe para no romper bookmarks viejos.
 */
export default function AdminDashboardRedirect() {
  redirect('/ceo')
}
