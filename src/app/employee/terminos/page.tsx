import { redirect } from 'next/navigation'
import { getStaffUser } from '@/lib/auth/require-staff'
import { TermsAcceptancesRegistry } from '@/components/staff/terms-acceptances-registry'

export default async function EmployeeTerminosPage() {
  const auth = await getStaffUser()
  if (!auth.ok) redirect('/login')
  return <TermsAcceptancesRegistry role="employee" />
}
