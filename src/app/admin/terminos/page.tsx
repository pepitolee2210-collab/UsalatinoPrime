import { redirect } from 'next/navigation'
import { getStaffUser } from '@/lib/auth/require-staff'
import { TermsAcceptancesRegistry } from '@/components/staff/terms-acceptances-registry'

export default async function AdminTerminosPage() {
  const auth = await getStaffUser()
  if (!auth.ok || auth.role !== 'admin') redirect('/login')
  return <TermsAcceptancesRegistry role="admin" />
}
