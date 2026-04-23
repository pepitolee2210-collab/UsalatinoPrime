import { redirect } from 'next/navigation'

// Login por teléfono deprecated. Todos los usuarios (clientes, empleados y
// admins) ahora entran por /login con email + password. Esta ruta queda
// como redirect suave para enlaces antiguos.
export default function EmployeeLoginRedirect() {
  redirect('/login')
}
