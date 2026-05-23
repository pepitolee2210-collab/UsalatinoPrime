import { redirect } from 'next/navigation'

// Login alternativo legacy. Ahora todos los logins pasan por /login.
export default function LegacyCeoLoginRedirect() {
  redirect('/login')
}
