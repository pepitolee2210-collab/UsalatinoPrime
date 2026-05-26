import { QuickContractGenerator } from '@/components/admin/QuickContractGenerator'
import { PageHeader, AdminKeyframes } from '@/components/admin-ui'

export default function EmployeeContractsPage() {
  return (
    <div className="space-y-6">
      <AdminKeyframes />
      <PageHeader
        eyebrow="CONTRATOS · GENERACIÓN"
        title="Generar Contratos"
        accentDot
        description="Crea contratos para nuevos clientes y envíalos para firma electrónica."
      />
      <div className="max-w-2xl">
        <QuickContractGenerator />
      </div>
    </div>
  )
}
