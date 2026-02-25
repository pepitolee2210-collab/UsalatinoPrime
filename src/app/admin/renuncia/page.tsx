import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, Clock, CheckCircle, XCircle, Search } from 'lucide-react'
import { RenunciaRow } from '@/components/admin/RenunciaRow'

export default async function RenunciaCustodiaAdminPage() {
  const supabase = await createClient()

  const { data: submissions } = await supabase
    .from('renuncia_submissions')
    .select('*')
    .order('created_at', { ascending: false })

  const all = submissions || []
  const nuevo = all.filter(s => s.status === 'nuevo')
  const enRevision = all.filter(s => s.status === 'en_revision')
  const aprobado = all.filter(s => s.status === 'aprobado')
  const rechazado = all.filter(s => s.status === 'rechazado')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600" />
            Renuncia de Custodia
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Formularios de renuncia voluntaria de custodia parental
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-amber-100 text-amber-800">{nuevo.length} nuevo{nuevo.length !== 1 ? 's' : ''}</Badge>
          <Badge className="bg-blue-100 text-blue-800">{enRevision.length} en revisi&oacute;n</Badge>
          <Badge className="bg-green-100 text-green-800">{aprobado.length} aprobado{aprobado.length !== 1 ? 's' : ''}</Badge>
          <Badge className="bg-gray-100 text-gray-600">{all.length} total</Badge>
        </div>
      </div>

      {/* Nuevos */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-3">
          <Clock className="w-5 h-5 text-amber-500" />
          Nuevos
        </h2>
        {nuevo.length > 0 ? (
          <div className="space-y-3">
            {nuevo.map((sub: any) => (
              <RenunciaRow key={sub.id} submission={sub} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center text-gray-500 text-sm">
              No hay formularios nuevos
            </CardContent>
          </Card>
        )}
      </div>

      {/* En Revision */}
      {enRevision.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-3">
            <Search className="w-5 h-5 text-blue-500" />
            En Revisi&oacute;n
          </h2>
          <div className="space-y-3">
            {enRevision.map((sub: any) => (
              <RenunciaRow key={sub.id} submission={sub} />
            ))}
          </div>
        </div>
      )}

      {/* Aprobados */}
      {aprobado.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Aprobados
          </h2>
          <div className="space-y-3">
            {aprobado.map((sub: any) => (
              <RenunciaRow key={sub.id} submission={sub} />
            ))}
          </div>
        </div>
      )}

      {/* Rechazados */}
      {rechazado.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-3">
            <XCircle className="w-5 h-5 text-red-500" />
            Rechazados
          </h2>
          <div className="space-y-3">
            {rechazado.map((sub: any) => (
              <RenunciaRow key={sub.id} submission={sub} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
