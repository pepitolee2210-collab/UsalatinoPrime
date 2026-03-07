'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { CaseFormViewer } from '@/components/admin/CaseFormViewer'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { CheckCircle, AlertCircle, FileText, Download, ArrowLeft, Loader2, DollarSign, CreditCard, Plus, ShieldCheck, ShieldOff, Upload, Eye, Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { APPOINTMENT_DOCUMENT_KEYS } from '@/lib/appointments/constants'
import { uploadDirect } from '@/lib/upload-direct'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

interface AdminCaseViewProps {
  caseData: any
  documents: any[]
  activities: any[]
  payments: any[]
}

export function AdminCaseView({ caseData, documents, activities, payments }: AdminCaseViewProps) {
  const [correctionNotes, setCorrectionNotes] = useState('')
  const [henryNotes, setHenryNotes] = useState(caseData.henry_notes || '')
  const [loading, setLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [i589Loading, setI589Loading] = useState(false)
  const [markPaidLoading, setMarkPaidLoading] = useState<string | null>(null)
  const [planDialogOpen, setPlanDialogOpen] = useState(false)
  const [planLoading, setPlanLoading] = useState(false)
  const [accessLoading, setAccessLoading] = useState(false)
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)
  const [uploadingForClient, setUploadingForClient] = useState(false)
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)
  const [renamingDoc, setRenamingDoc] = useState<{ id: string; name: string } | null>(null)
  const [renameLoading, setRenameLoading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [planForm, setPlanForm] = useState({
    total_amount: String(caseData.total_cost || ''),
    num_installments: '10',
    payment_method: 'manual',
    first_payment_date: new Date().toISOString().split('T')[0],
    notes: '',
  })
  const router = useRouter()
  const supabase = createClient()

  const serviceSlug = caseData.service?.slug || ''
  const isAsylumService = serviceSlug === 'asilo-afirmativo' || serviceSlug === 'asilo-defensivo'

  async function updateStatus(newStatus: string, notes?: string) {
    setLoading(true)
    try {
      const updateData: any = { intake_status: newStatus }
      if (notes) updateData.correction_notes = notes
      if (henryNotes !== caseData.henry_notes) updateData.henry_notes = henryNotes

      await supabase.from('cases').update(updateData).eq('id', caseData.id)

      await supabase.from('case_activity').insert({
        case_id: caseData.id,
        action: 'status_change',
        description: `Estado cambiado a ${newStatus}${notes ? ': ' + notes : ''}`,
        visible_to_client: true,
      })

      // Create notification for client
      await supabase.from('notifications').insert({
        user_id: caseData.client_id,
        case_id: caseData.id,
        title: newStatus === 'approved_by_henry' ? 'Caso Aprobado' : newStatus === 'needs_correction' ? 'Correcciones Solicitadas' : 'Actualización de Caso',
        message: newStatus === 'approved_by_henry'
          ? 'Henry ha aprobado su caso y está listo para ser presentado.'
          : newStatus === 'needs_correction'
          ? notes || 'Se necesitan correcciones en su formulario.'
          : `El estado de su caso ha sido actualizado a ${newStatus}.`,
        type: newStatus === 'needs_correction' ? 'action_required' : 'success',
      })

      toast.success('Estado actualizado')
      router.refresh()
    } catch (error) {
      toast.error('Error al actualizar')
    } finally {
      setLoading(false)
    }
  }

  async function handleDownloadI589() {
    if (i589Loading) return
    setI589Loading(true)
    try {
      const { generateI589PDF } = await import('@/lib/pdf/i589')
      const pdfBytes = await generateI589PDF(caseData.form_data || {})
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `I-589-${caseData.case_number}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success('I-589 descargado')
    } catch (error: any) {
      console.error('I-589 generation error:', error)
      toast.error(`Error al generar I-589: ${error.message}`)
    } finally {
      setI589Loading(false)
    }
  }

  async function handleDownloadPDF() {
    if (pdfLoading) return
    setPdfLoading(true)
    try {
      const { generateCasePDF } = await import('@/lib/pdf/generate-case-pdf')
      const pdf = generateCasePDF({
        caseNumber: caseData.case_number,
        serviceName: caseData.service?.name || '',
        serviceSlug: caseData.service?.slug || '',
        clientName: `${caseData.client?.first_name || ''} ${caseData.client?.last_name || ''}`,
        clientEmail: caseData.client?.email || '',
        createdAt: caseData.created_at,
        formData: caseData.form_data || {},
      })
      const blob = pdf.output('blob')
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `caso-${caseData.case_number}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success('PDF descargado')
    } catch (error: any) {
      console.error('PDF generation error:', error)
      toast.error(`Error al generar el PDF: ${error.message}`)
    } finally {
      setPdfLoading(false)
    }
  }

  async function handleToggleAccess() {
    setAccessLoading(true)
    try {
      const newValue = !caseData.access_granted
      await supabase
        .from('cases')
        .update({ access_granted: newValue })
        .eq('id', caseData.id)

      await supabase.from('case_activity').insert({
        case_id: caseData.id,
        action: 'access_change',
        description: newValue
          ? 'Acceso otorgado al cliente para completar formularios'
          : 'Acceso revocado al cliente',
        visible_to_client: true,
      })

      await supabase.from('notifications').insert({
        user_id: caseData.client_id,
        case_id: caseData.id,
        title: newValue ? 'Acceso Otorgado' : 'Acceso Revocado',
        message: newValue
          ? 'Henry ha habilitado su acceso para completar los formularios de su caso.'
          : 'El acceso a los formularios de su caso ha sido temporalmente suspendido.',
        type: newValue ? 'success' : 'warning',
      })

      toast.success(newValue ? 'Acceso otorgado al cliente' : 'Acceso revocado')
      router.refresh()
    } catch (error) {
      toast.error('Error al cambiar acceso')
    } finally {
      setAccessLoading(false)
    }
  }

  async function handleMarkInstallmentPaid(paymentId: string) {
    setMarkPaidLoading(paymentId)
    try {
      const res = await fetch('/api/admin/payments/mark-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_id: paymentId, payment_method: 'manual' }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      toast.success('Pago marcado como completado')
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || 'Error al marcar pago')
    } finally {
      setMarkPaidLoading(null)
    }
  }

  async function handleCreatePaymentPlan() {
    if (!planForm.total_amount || !planForm.num_installments) {
      toast.error('Complete los campos requeridos')
      return
    }
    setPlanLoading(true)
    try {
      const res = await fetch('/api/admin/payments/create-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: caseData.id,
          total_amount: Number(planForm.total_amount),
          num_installments: Number(planForm.num_installments),
          payment_method: planForm.payment_method,
          first_payment_date: planForm.first_payment_date,
          notes: planForm.notes,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      toast.success('Plan de cuotas creado')
      setPlanDialogOpen(false)
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || 'Error al crear plan')
    } finally {
      setPlanLoading(false)
    }
  }

  const totalPaid = payments.filter(p => p.status === 'completed').reduce((s, p) => s + Number(p.amount), 0)
  const totalPending = payments.filter(p => p.status === 'pending').reduce((s, p) => s + Number(p.amount), 0)

  return (
    <div className="space-y-6">
      <Link href="/admin/cases" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4 mr-1" /> Volver a Casos
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Caso #{caseData.case_number}</h1>
          <p className="text-gray-600">{caseData.service?.name}</p>
          <p className="text-sm text-gray-500">
            {caseData.client?.first_name} {caseData.client?.last_name} &mdash; {caseData.client?.email}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleDownloadPDF}
            disabled={pdfLoading}
          >
            {pdfLoading ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-1" />
            )}
            {pdfLoading ? 'Generando...' : 'Descargar PDF'}
          </Button>
          {isAsylumService && (
            <Button
              variant="outline"
              onClick={handleDownloadI589}
              disabled={i589Loading}
            >
              {i589Loading ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 mr-1" />
              )}
              {i589Loading ? 'Generando I-589...' : 'Generar I-589'}
            </Button>
          )}
          {caseData.intake_status === 'submitted' && (
            <>
              <Button onClick={() => updateStatus('approved_by_henry')} disabled={loading}>
                <CheckCircle className="w-4 h-4 mr-1" /> Aprobar
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" disabled={loading}>
                    <AlertCircle className="w-4 h-4 mr-1" /> Pedir Correcciones
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Solicitar Correcciones</DialogTitle>
                  </DialogHeader>
                  <Textarea
                    placeholder="Describa qué necesita corregir el cliente..."
                    value={correctionNotes}
                    onChange={(e) => setCorrectionNotes(e.target.value)}
                    rows={4}
                  />
                  <Button
                    onClick={() => updateStatus('needs_correction', correctionNotes)}
                    disabled={!correctionNotes.trim() || loading}
                  >
                    Enviar Solicitud
                  </Button>
                </DialogContent>
              </Dialog>
            </>
          )}
          {caseData.intake_status === 'approved_by_henry' && (
            <Button onClick={() => updateStatus('filed')} disabled={loading}>
              Marcar como Presentado
            </Button>
          )}
          <Button
            variant={caseData.access_granted ? 'outline' : 'default'}
            onClick={handleToggleAccess}
            disabled={accessLoading}
            className={caseData.access_granted
              ? 'border-green-300 text-green-700 hover:bg-green-50'
              : 'bg-[#002855] hover:bg-[#003570]'}
          >
            {accessLoading ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : caseData.access_granted ? (
              <ShieldCheck className="w-4 h-4 mr-1" />
            ) : (
              <ShieldOff className="w-4 h-4 mr-1" />
            )}
            {caseData.access_granted ? 'Acceso Activo' : 'Dar Acceso'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="form">
        <TabsList>
          <TabsTrigger value="form">Formulario</TabsTrigger>
          <TabsTrigger value="payments">Pagos ({payments.length})</TabsTrigger>
          <TabsTrigger value="documents">Documentos ({documents.length})</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="notes">Notas</TabsTrigger>
        </TabsList>

        <TabsContent value="form" className="mt-4">
          <CaseFormViewer
            serviceSlug={caseData.service?.slug || ''}
            formData={caseData.form_data || {}}
          />
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-gray-500">Total del Servicio</p>
                  <p className="text-lg font-bold text-gray-900">${Number(caseData.total_cost || 0).toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-gray-500">Pagado</p>
                  <p className="text-lg font-bold text-green-600">${totalPaid.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-gray-500">Pendiente</p>
                  <p className="text-lg font-bold text-yellow-600">${totalPending.toLocaleString()}</p>
                </CardContent>
              </Card>
            </div>

            {/* Actions */}
            {payments.length === 0 && (
              <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-1" /> Crear Plan de Cuotas
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Crear Plan de Cuotas</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Monto Total ($)</Label>
                      <Input
                        type="number"
                        value={planForm.total_amount}
                        onChange={(e) => setPlanForm({ ...planForm, total_amount: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Numero de cuotas</Label>
                      <Select value={planForm.num_installments} onValueChange={(v) => setPlanForm({ ...planForm, num_installments: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 (pago unico)</SelectItem>
                          <SelectItem value="3">3 cuotas</SelectItem>
                          <SelectItem value="5">5 cuotas</SelectItem>
                          <SelectItem value="10">10 cuotas</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Fecha del primer pago</Label>
                      <Input
                        type="date"
                        value={planForm.first_payment_date}
                        onChange={(e) => setPlanForm({ ...planForm, first_payment_date: e.target.value })}
                      />
                      <p className="text-xs text-gray-500">Cuotas siguientes se calculan mensualmente desde esta fecha</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Metodo de pago</Label>
                      <Select value={planForm.payment_method} onValueChange={(v) => setPlanForm({ ...planForm, payment_method: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Manual</SelectItem>
                          <SelectItem value="zelle">Zelle</SelectItem>
                          <SelectItem value="efectivo">Efectivo</SelectItem>
                          <SelectItem value="transferencia">Transferencia</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleCreatePaymentPlan} disabled={planLoading} className="w-full">
                      {planLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                      Crear Plan
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {/* Payments Table */}
            {payments.length > 0 ? (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cuota</TableHead>
                        <TableHead>Monto</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Vencimiento</TableHead>
                        <TableHead>Pagado</TableHead>
                        <TableHead>Metodo</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((p: any) => {
                        const isOverdue = p.status === 'pending' && p.due_date && new Date(p.due_date) < new Date()
                        return (
                          <TableRow key={p.id} className={isOverdue ? 'bg-red-50/50' : ''}>
                            <TableCell className="text-sm font-medium">
                              {p.installment_number}/{p.total_installments}
                            </TableCell>
                            <TableCell className="text-sm font-semibold">
                              ${Number(p.amount).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Badge className={
                                isOverdue ? 'bg-red-100 text-red-800' :
                                p.status === 'completed' ? 'bg-green-100 text-green-800' :
                                p.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }>
                                {isOverdue ? 'Vencido' : p.status === 'completed' ? 'Pagado' : 'Pendiente'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-gray-500">
                              {p.due_date ? format(new Date(p.due_date), 'd MMM yyyy', { locale: es }) : '—'}
                            </TableCell>
                            <TableCell className="text-sm text-gray-500">
                              {p.paid_at ? format(new Date(p.paid_at), 'd MMM yyyy', { locale: es }) : '—'}
                            </TableCell>
                            <TableCell className="text-sm text-gray-500">
                              {p.payment_method || '—'}
                            </TableCell>
                            <TableCell>
                              {p.status === 'pending' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleMarkInstallmentPaid(p.id)}
                                  disabled={markPaidLoading === p.id}
                                >
                                  {markPaidLoading === p.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                  )}
                                  Pagado
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              <p className="text-sm text-gray-500">No hay pagos registrados. Cree un plan de cuotas para este caso.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <div className="space-y-6">
            {/* Documents grouped by category */}
            {APPOINTMENT_DOCUMENT_KEYS.map((docType) => {
              const categoryDocs = documents.filter(d => d.document_key === docType.key)
              return (
                <Card key={docType.key}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-500" />
                        {docType.label}
                        {categoryDocs.length > 0 && (
                          <Badge variant="outline" className="text-green-700 border-green-300 ml-1">
                            {categoryDocs.length}
                          </Badge>
                        )}
                      </CardTitle>
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-dashed rounded-md cursor-pointer text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
                        {uploadingKey === docType.key ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        {uploadingKey === docType.key ? 'Subiendo...' : 'Subir PDF'}
                        <input
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          disabled={uploadingKey !== null}
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            setUploadingKey(docType.key)
                            try {
                              await uploadDirect({
                                file,
                                documentKey: docType.key,
                                mode: 'admin',
                                caseId: caseData.id,
                                clientId: caseData.client_id,
                              })
                              toast.success(`${docType.label} subido correctamente`)
                              router.refresh()
                            } catch (err: any) {
                              toast.error(err.message || 'Error al subir documento')
                            } finally {
                              setUploadingKey(null)
                              e.target.value = ''
                            }
                          }}
                        />
                      </label>
                    </div>
                  </CardHeader>
                  {categoryDocs.length > 0 && (
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {categoryDocs.map((doc: any) => (
                          <div key={doc.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{doc.name}</p>
                                <p className="text-xs text-gray-400">{(doc.file_size / 1024).toFixed(0)} KB</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                title="Previsualizar"
                                onClick={async () => {
                                  const { data } = await supabase.storage
                                    .from('case-documents')
                                    .createSignedUrl(doc.file_path, 300)
                                  if (data?.signedUrl) {
                                    setPreviewUrl(data.signedUrl)
                                  } else {
                                    toast.error('Error al generar preview')
                                  }
                                }}
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                title="Renombrar"
                                onClick={() => setRenamingDoc({ id: doc.id, name: doc.name })}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                title="Descargar"
                                onClick={async () => {
                                  const { data } = await supabase.storage
                                    .from('case-documents')
                                    .createSignedUrl(doc.file_path, 300)
                                  if (data?.signedUrl) {
                                    const link = document.createElement('a')
                                    link.href = data.signedUrl
                                    link.download = doc.name
                                    link.click()
                                  } else {
                                    toast.error('Error al generar link de descarga')
                                  }
                                }}
                              >
                                <Download className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                title="Eliminar"
                                disabled={deletingDocId === doc.id}
                                onClick={async () => {
                                  if (!confirm('¿Eliminar este documento?')) return
                                  setDeletingDocId(doc.id)
                                  try {
                                    const res = await fetch('/api/admin/upload-document', {
                                      method: 'DELETE',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ document_id: doc.id }),
                                    })
                                    if (!res.ok) {
                                      const data = await res.json()
                                      throw new Error(data.error)
                                    }
                                    toast.success('Documento eliminado')
                                    router.refresh()
                                  } catch (err: any) {
                                    toast.error(err.message || 'Error al eliminar')
                                  } finally {
                                    setDeletingDocId(null)
                                  }
                                }}
                              >
                                {deletingDocId === doc.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )
            })}

            {/* Uncategorized documents */}
            {documents.filter(d => !APPOINTMENT_DOCUMENT_KEYS.some(k => k.key === d.document_key)).length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Otros Documentos</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {documents.filter(d => !APPOINTMENT_DOCUMENT_KEYS.some(k => k.key === d.document_key)).map((doc: any) => (
                      <div key={doc.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{doc.name}</p>
                            <p className="text-xs text-gray-400">{doc.document_key} &mdash; {(doc.file_size / 1024).toFixed(0)} KB</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Descargar"
                            onClick={async () => {
                              const { data } = await supabase.storage.from('case-documents').createSignedUrl(doc.file_path, 300)
                              if (data?.signedUrl) window.open(data.signedUrl, '_blank')
                            }}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Documents FOR the client (admin_to_client) */}
            <Card className="border-blue-200 bg-blue-50/30">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-800">
                    <Download className="w-4 h-4" />
                    Documentos para el Cliente
                    {documents.filter(d => d.direction === 'admin_to_client').length > 0 && (
                      <Badge variant="outline" className="text-blue-700 border-blue-300 ml-1">
                        {documents.filter(d => d.direction === 'admin_to_client').length}
                      </Badge>
                    )}
                  </CardTitle>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md cursor-pointer text-xs hover:bg-blue-700 transition-colors">
                    {uploadingForClient ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    {uploadingForClient ? 'Subiendo...' : 'Subir para el cliente'}
                    <input
                      type="file"
                      accept="application/pdf,.doc,.docx,.jpg,.jpeg,.png"
                      className="hidden"
                      disabled={uploadingForClient}
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setUploadingForClient(true)
                        try {
                          const res = await fetch('/api/admin/client-documents', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              case_id: caseData.id,
                              client_id: caseData.client_id,
                              file_name: file.name,
                              file_size: file.size,
                            }),
                          })
                          if (!res.ok) throw new Error((await res.json()).error)
                          const { signedUrl, token: uploadToken, filePath } = await res.json()

                          const supabase = createClient()
                          const { error: uploadErr } = await supabase.storage
                            .from('case-documents')
                            .uploadToSignedUrl(filePath, uploadToken, file)
                          if (uploadErr) throw uploadErr

                          await fetch('/api/admin/client-documents', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              case_id: caseData.id,
                              client_id: caseData.client_id,
                              file_path: filePath,
                              file_name: file.name,
                              file_size: file.size,
                            }),
                          })

                          toast.success('Documento subido para el cliente')
                          router.refresh()
                        } catch (err: any) {
                          toast.error(err.message || 'Error al subir')
                        } finally {
                          setUploadingForClient(false)
                          e.target.value = ''
                        }
                      }}
                    />
                  </label>
                </div>
              </CardHeader>
              {documents.filter(d => d.direction === 'admin_to_client').length > 0 && (
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {documents.filter(d => d.direction === 'admin_to_client').map((doc: any) => (
                      <div key={doc.id} className="flex items-center justify-between p-2 rounded-lg bg-white border">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{doc.name}</p>
                            <p className="text-xs text-gray-400">{(doc.file_size / 1024).toFixed(0)} KB</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Descargar"
                            onClick={async () => {
                              const { data } = await supabase.storage.from('case-documents').createSignedUrl(doc.file_path, 300)
                              if (data?.signedUrl) window.open(data.signedUrl, '_blank')
                            }}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400 hover:text-red-600" title="Eliminar"
                            onClick={async () => {
                              if (!confirm('Eliminar este documento?')) return
                              const res = await fetch('/api/admin/upload-document', {
                                method: 'DELETE',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ document_id: doc.id }),
                              })
                              if (res.ok) { toast.success('Eliminado'); router.refresh() }
                              else toast.error('Error al eliminar')
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
              {documents.filter(d => d.direction === 'admin_to_client').length === 0 && (
                <CardContent className="pt-0">
                  <p className="text-xs text-blue-600/60 text-center py-3">
                    Los documentos que subas aqui apareceran en el portal del cliente para que los descargue.
                  </p>
                </CardContent>
              )}
            </Card>
          </div>

          {/* Rename Dialog */}
          <Dialog open={renamingDoc !== null} onOpenChange={(open) => { if (!open) setRenamingDoc(null) }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Renombrar Documento</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  value={renamingDoc?.name || ''}
                  onChange={(e) => setRenamingDoc(prev => prev ? { ...prev, name: e.target.value } : null)}
                  placeholder="Nombre del documento"
                />
                <Button
                  className="w-full"
                  disabled={renameLoading || !renamingDoc?.name.trim()}
                  onClick={async () => {
                    if (!renamingDoc) return
                    setRenameLoading(true)
                    try {
                      const res = await fetch('/api/admin/upload-document', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ document_id: renamingDoc.id, name: renamingDoc.name }),
                      })
                      if (!res.ok) {
                        const data = await res.json()
                        throw new Error(data.error)
                      }
                      toast.success('Documento renombrado')
                      setRenamingDoc(null)
                      router.refresh()
                    } catch (err: any) {
                      toast.error(err.message || 'Error al renombrar')
                    } finally {
                      setRenameLoading(false)
                    }
                  }}
                >
                  {renameLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                  Guardar
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Preview Dialog */}
          <Dialog open={previewUrl !== null} onOpenChange={(open) => { if (!open) setPreviewUrl(null) }}>
            <DialogContent className="max-w-4xl h-[80vh]">
              <DialogHeader>
                <DialogTitle>Previsualizar Documento</DialogTitle>
              </DialogHeader>
              {previewUrl && (
                <iframe
                  src={previewUrl}
                  className="w-full flex-1 rounded-md border"
                  style={{ minHeight: 'calc(80vh - 80px)' }}
                />
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardContent className="p-6">
              {activities.length > 0 ? (
                <div className="space-y-4">
                  {activities.map((a: any) => (
                    <div key={a.id} className="flex gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0" />
                      <div>
                        <p className="text-sm">{a.description}</p>
                        <p className="text-xs text-gray-500">
                          {a.actor?.first_name ? `${a.actor.first_name} ${a.actor.last_name} \u2014 ` : ''}
                          {format(new Date(a.created_at), "d 'de' MMMM yyyy, h:mm a", { locale: es })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No hay actividad.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium">Notas internas (solo Henry)</label>
                <Textarea
                  value={henryNotes}
                  onChange={(e) => setHenryNotes(e.target.value)}
                  rows={4}
                  placeholder="Notas sobre este caso..."
                />
                <Button
                  size="sm"
                  className="mt-2"
                  onClick={async () => {
                    await supabase.from('cases').update({ henry_notes: henryNotes }).eq('id', caseData.id)
                    toast.success('Notas guardadas')
                  }}
                >
                  Guardar Notas
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
