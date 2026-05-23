import Link from 'next/link'
import { Settings2 } from 'lucide-react'
import { ProspectosView } from './prospectos-view'
import { PageHeader, AdminKeyframes, PrimaryButton } from '@/components/admin-ui'

export default function ProspectosCitasPage() {
  return (
    <div className="space-y-6">
      <AdminKeyframes />
      <PageHeader
        eyebrow="Operación · Prospectos IA"
        title="Prospectos IA"
        accentDot
        description="Leads que agendaron evaluación gratuita con la consultora senior. Llámalos, marca decisión y conviértelos en clientes."
        action={
          <div className="flex items-center gap-2">
            <Link href="/admin/prospectos-citas/configuracion">
              <PrimaryButton variant="ghost" icon={<Settings2 className="w-3.5 h-3.5" />}>
                Configurar
              </PrimaryButton>
            </Link>
          </div>
        }
      />
      <ProspectosView mode="admin" hideHeader />
    </div>
  )
}
