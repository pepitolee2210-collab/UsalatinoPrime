'use client'

export const dynamic = 'force-dynamic'

import { ContratosView } from './contratos-view'
import { PageHeader, AdminKeyframes } from '@/components/admin-ui'

export default function ContratosPage() {
  return (
    <div className="space-y-6">
      <AdminKeyframes />
      <PageHeader
        eyebrow="Documentos · Contratos"
        title="Contratos"
        accentDot
        description="Gestiona los contratos de servicio: genera, firma, revisa y descarga. Cambia entre vista lista o kanban."
      />
      <ContratosView basePath="/admin/contratos" hideHeader />
    </div>
  )
}
