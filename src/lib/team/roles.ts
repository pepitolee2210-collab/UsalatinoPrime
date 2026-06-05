// Títulos públicos del equipo — fuente ÚNICA de verdad para cómo se muestra cada
// rol al cliente y a cada empleado.
//
// IMPORTANTE (cumplimiento legal): NO usar "Asesora Legal" / "asesor legal" ni
// nada que implique asesoría legal. La firma NO es un bufete y NO da asesoría
// legal (ver Términos y Condiciones / src/lib/legal/terms-and-conditions.ts).
// Estos son los términos precisos que deben mostrarse:
//   - paralegal          → "Tramitadora"  (Diana)
//   - senior_consultant  → "Asesora"      (Vanessa)
//   - contracts_manager  → "Coordinador"  (Andrium)

export type EmployeeType = 'paralegal' | 'senior_consultant' | 'contracts_manager'

export const EMPLOYEE_ROLE_LABELS: Record<EmployeeType, string> = {
  paralegal: 'Tramitadora',
  senior_consultant: 'Asesora',
  contracts_manager: 'Coordinador',
}

/** Etiqueta pública del rol a partir del `employee_type`. Fallback genérico. */
export function employeeRoleLabel(type: string | null | undefined): string {
  return EMPLOYEE_ROLE_LABELS[type as EmployeeType] ?? 'Equipo'
}
