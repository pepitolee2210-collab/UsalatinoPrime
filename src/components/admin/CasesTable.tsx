'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { statusLabels } from '@/lib/case-status'
import { Trash2, FileText, CheckCircle, Clock, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface CasesTableProps {
  cases: Array<Record<string, unknown>>
}

export function CasesTable({ cases }: CasesTableProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleDelete(id: string, caseNumber: string) {
    const confirmed = confirm(`¿Estás seguro de eliminar el caso #${caseNumber}?\n\nEsto eliminará todos los documentos y formularios asociados. Esta acción no se puede deshacer.`)
    if (!confirmed) return

    setDeleting(id)
    try {
      const res = await fetch(`/api/admin/cases/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Error al eliminar')
        return
      }
      toast.success(`Caso #${caseNumber} eliminado`)
      router.refresh()
    } catch {
      toast.error('Error al eliminar caso')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Caso</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Servicio</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Progreso</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cases.map((c) => {
              const status = statusLabels[(c.intake_status as string)] || statusLabels.in_progress
              const docCount = (c.doc_count as number) || 0
              const subTotal = (c.submission_total as number) || 0
              const subDone = (c.submission_done as number) || 0
              const client = c.client as { first_name?: string; last_name?: string; email?: string } | null
              const service = c.service as { name?: string } | null

              return (
                <TableRow key={c.id as string}>
                  <TableCell>
                    <Link href={`/admin/cases/${c.id}`} className="text-blue-600 hover:underline font-medium">
                      #{c.case_number as string}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{client?.first_name} {client?.last_name}</p>
                      <p className="text-xs text-gray-500">{client?.email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{service?.name}</TableCell>
                  <TableCell><Badge className={status.color}>{status.label}</Badge></TableCell>
                  <TableCell>
                    <ProgressIndicator docCount={docCount} subTotal={subTotal} subDone={subDone} />
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {format(new Date(c.created_at as string), 'd MMM yyyy', { locale: es })}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 p-0"
                      onClick={() => handleDelete(c.id as string, c.case_number as string)}
                      disabled={deleting === c.id}
                    >
                      {deleting === c.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
            {cases.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  No hay casos registrados
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function ProgressIndicator({ docCount, subTotal, subDone }: { docCount: number; subTotal: number; subDone: number }) {
  const hasDocs = docCount > 0
  const hasSubmissions = subTotal > 0
  const allSubmitted = subTotal > 0 && subDone === subTotal

  if (!hasDocs && !hasSubmissions) {
    return <span className="text-xs text-gray-400">Sin actividad</span>
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {hasDocs && (
        <Badge variant="outline" className="text-xs gap-1 border-blue-200 text-blue-700 bg-blue-50">
          <FileText className="w-3 h-3" />
          {docCount} doc{docCount !== 1 ? 's' : ''}
        </Badge>
      )}
      {hasSubmissions && (
        <Badge
          variant="outline"
          className={`text-xs gap-1 ${
            allSubmitted
              ? 'border-green-200 text-green-700 bg-green-50'
              : 'border-amber-200 text-amber-700 bg-amber-50'
          }`}
        >
          {allSubmitted ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
          {subDone}/{subTotal} historias
        </Badge>
      )}
    </div>
  )
}
