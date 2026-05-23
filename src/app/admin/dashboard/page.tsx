import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// Bookmark legacy: /admin/dashboard ya no existe como pantalla propia.
// Henry ahora aterriza en /admin/servicios al loguearse y la Vista CEO vive
// en /admin/ceo dentro del shell admin.
export default function AdminDashboardRedirect() {
  redirect('/admin/servicios')
}
