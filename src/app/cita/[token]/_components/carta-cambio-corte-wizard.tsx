'use client'

// Wrapper cliente del CartaCambioCorteGenerator (componente compartido).
// Hace fetch al endpoint cliente /api/cita/[token]/carta-cambio-corte
// (no al admin) y oculta el botón "Generar PDF" — el PDF lo genera
// Diana/Henry desde su dashboard.

import { CartaCambioCorteGenerator } from '@/app/admin/cases/[id]/carta-cambio-corte-generator'

interface Props {
  token: string
  caseId: string
  clientName: string
}

export function CartaCambioCorteClientWizard({ token, caseId, clientName }: Props) {
  return (
    <div className="px-4 py-4">
      <CartaCambioCorteGenerator
        caseId={caseId}
        caseNumber=""
        clientName={clientName}
        apiUrl={`/api/cita/${encodeURIComponent(token)}/carta-cambio-corte`}
        showGenerateButton={false}
        clientMode
        headerSubtitle="Confirma tus datos y tu nueva dirección. Tu equipo legal determinará la nueva corte y generará el documento final."
      />
    </div>
  )
}
