import { createClient } from '@/lib/supabase/server'

export type StaffRole = 'admin' | 'employee'

export type StaffAuthResult =
  | { ok: true; userId: string; role: StaffRole }
  | { ok: false; status: 401 | 403 }

/**
 * Verifica que el caller sea staff (admin o employee). Patrón estándar del repo:
 * createClient() de sesión para `auth.getUser()` + leer `profiles.role`, y SOLO
 * entonces el caller pasa a service-role para datos. Cubre Henry (admin), Diana,
 * Vanessa y Andrium (employee). Usado por las rutas /api/staff/* y las páginas
 * /admin/terminos y /employee/terminos (defensa en profundidad).
 */
export async function getStaffUser(): Promise<StaffAuthResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401 }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.role !== 'employee') {
    return { ok: false, status: 403 }
  }
  return { ok: true, userId: user.id, role: profile.role as StaffRole }
}
