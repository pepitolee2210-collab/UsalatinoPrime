import { redirect } from 'next/navigation'

// Ruta legacy. La Vista CEO ahora vive dentro del shell admin en /admin/ceo.
// Conservamos este redirect para no romper bookmarks ni accesos externos.
export default function LegacyCeoRedirect() {
  redirect('/admin/ceo')
}
