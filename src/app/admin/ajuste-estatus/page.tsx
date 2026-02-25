import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, Clock, CheckCircle, Archive } from 'lucide-react'
import { AjusteRow } from '@/components/admin/AjusteRow'

export default async function AjusteEstatusAdminPage() {
  const supabase = await createClient()

  const { data: submissions } = await supabase
    .from('ajuste_submissions')
    .select('*')
    .order('created_at', { ascending: false })

  const all = submissions || []
  const pending = all.filter(s => s.status === 'pending')
  const reviewed = all.filter(s => s.status === 'reviewed')
  const archived = all.filter(s => s.status === 'archived')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600" />
            Formularios de Ajuste de Estatus I-485
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Formularios enviados desde el link p&uacute;blico /ajuste-form
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-amber-100 text-amber-800">{pending.length} pendiente{pending.length !== 1 ? 's' : ''}</Badge>
          <Badge className="bg-green-100 text-green-800">{reviewed.length} revisado{reviewed.length !== 1 ? 's' : ''}</Badge>
          <Badge className="bg-gray-100 text-gray-600">{all.length} total</Badge>
        </div>
      </div>

      {/* Pending */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-3">
          <Clock className="w-5 h-5 text-amber-500" />
          Pendientes de Revisi&oacute;n
        </h2>
        {pending.length > 0 ? (
          <div className="space-y-3">
            {pending.map((sub: any) => (
              <AjusteRow key={sub.id} submission={sub} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center text-gray-500 text-sm">
              No hay formularios pendientes de revisi&oacute;n
            </CardContent>
          </Card>
        )}
      </div>

      {/* Reviewed */}
      {reviewed.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Revisados
          </h2>
          <div className="space-y-3">
            {reviewed.map((sub: any) => (
              <AjusteRow key={sub.id} submission={sub} />
            ))}
          </div>
        </div>
      )}

      {/* Archived */}
      {archived.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-3">
            <Archive className="w-5 h-5 text-gray-400" />
            Archivados
          </h2>
          <div className="space-y-3">
            {archived.map((sub: any) => (
              <AjusteRow key={sub.id} submission={sub} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
