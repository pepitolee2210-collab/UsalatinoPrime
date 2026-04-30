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
import { CheckCircle, AlertCircle, FileText, Download, ArrowLeft, Loader2, DollarSign, CreditCard, Plus, ShieldCheck, ShieldOff, Upload, Eye, Pencil, Trash2, MessageSquare, Briefcase, Send, UserPlus, Scale } from 'lucide-react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { APPOINTMENT_DOCUMENT_KEYS, DOCUMENT_CATEGORIES } from '@/lib/appointments/constants'
import { CaseChat } from './case-chat'
import { ClientStoryReview } from './client-story-review'
import { I589Review } from './i589-review'
import { DeclarationGenerator } from './declaration-generator'
import { ParentalConsentGenerator } from './parental-consent-generator'
import { LegalReviewer } from './legal-reviewer'
import { SupplementaryDataForm } from './supplementary-data-form'
import { JurisdictionPanel } from './jurisdiction-panel'
import { PhaseStatusPanel } from './phase-status-panel'
import { PhaseHistoryTab } from './phase-history-tab'
import { CasePipeline } from '@/components/case-pipeline'
import { uploadDirect } from '@/lib/upload-direct'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

interface EmployeeAssignment {
  id: string
  status: string
  task_description: string | null
  assigned_at: string
  employee: { first_name: string; last_name: string }
  submissions: { id: string; title: string | null; content: string | null; file_url: string | null; file_name: string | null; status: string; admin_notes: string | null; created_at: string }[]
}

interface AdminCaseViewProps {
  caseData: any
  documents: any[]
  activities: any[]
  payments: any[]
  aiSubmissions?: any[]
  employeeAssignment?: EmployeeAssignment | null
  employees?: { id: string; first_name: string; last_name: string }[]
}

export function AdminCaseView({ caseData, documents, activities, payments, aiSubmissions, employeeAssignment, employees = [] }: AdminCaseViewProps) {
  const [correctionNotes, setCorrectionNotes] = useState('')
  const [henryNotes, setHenryNotes] = useState(caseData.henry_notes || '')
  const [loading, setLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [i589Loading, setI589Loading] = useState(false)
  const [i360Loading, setI360Loading] = useState(false)
  const [markPaidLoading, setMarkPaidLoading] = useState<string | null>(null)
  const [planDialogOpen, setPlanDialogOpen] = useState(false)
  const [planLoading, setPlanLoading] = useState(false)
  const [accessLoading, setAccessLoading] = useState(false)
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)
  const [uploadingForClient, setUploadingForClient] = useState(false)
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)
  const [renamingDoc, setRenamingDoc] = useState<{ id: string; name: string } | null>(null)
  const [renameLoading, setRenameLoading] = useState(false)
  // Employee assignment
  const [empAssignment, setEmpAssignment] = useState(employeeAssignment || null)
  const [assignDialog, setAssignDialog] = useState(false)
  const [assignTask, setAssignTask] = useState('')
  const [assignEmployee, setAssignEmployee] = useState(employees[0]?.id || '')
  const [assignLoading, setAssignLoading] = useState(false)
  const [reviewingSubId, setReviewingSubId] = useState<string | null>(null)
  const [subNotes, setSubNotes] = useState('')
  const [subActionLoading, setSubActionLoading] = useState(false)
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
  const isVisaJuvenil = serviceSlug === 'visa-juvenil'

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

  async function handleDownloadI360() {
    if (i360Loading) return
    setI360Loading(true)
    try {
      const i360Sub = (aiSubmissions || []).find((s: any) => s.form_type === 'i360_sijs')
      if (!i360Sub) {
        toast.error('No hay datos I-360 para descargar')
        return
      }
      const { generateI360PDF } = await import('@/lib/pdf/i360')
      const pdfBytes = await generateI360PDF(i360Sub.form_data || {})
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `I-360-${caseData.case_number}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success('I-360 descargado')
    } catch (error: any) {
      console.error('I-360 generation error:', error)
      toast.error(`Error al generar I-360: ${error.message}`)
    } finally {
      setI360Loading(false)
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

      {/* SIJS Phase Panel */}
      <PhaseStatusPanel
        caseId={caseData.id}
        caseNumber={caseData.case_number}
        currentPhase={caseData.current_phase ?? null}
        processStart={caseData.process_start ?? null}
        stateUs={caseData.state_us ?? null}
        flags={{
          parent_deceased: !!caseData.parent_deceased,
          in_orr_custody: !!caseData.in_orr_custody,
          has_criminal_history: !!caseData.has_criminal_history,
          minor_close_to_21: !!caseData.minor_close_to_21,
        }}
        isVisaJuvenil={isVisaJuvenil}
      />

      {/* Pipeline Tracker */}
      {isVisaJuvenil && (
        <CasePipeline
          caseId={caseData.id}
          hasAppointment={true /* appointments loaded separately */}
          hasDocuments={documents.filter((d: any) => d.direction !== 'admin_to_client').length >= 3}
          hasHistory={(aiSubmissions || []).some((s: any) => s.form_type === 'client_story' && (s.status === 'submitted' || s.status === 'approved'))}
          hasDeclarations={(aiSubmissions || []).some((s: any) => s.form_type === 'tutor_guardian' && s.status === 'submitted')}
          hasClientDocs={documents.filter((d: any) => d.direction === 'admin_to_client').length > 0}
          hasI360={(aiSubmissions || []).some((s: any) => s.form_type === 'i360_sijs' && (s.status === 'submitted' || s.status === 'approved'))}
          manualStages={{
            henry_reviewed: !!(caseData.pipeline_status as any)?.henry_reviewed,
            presented_to_court: !!(caseData.pipeline_status as any)?.presented_to_court,
          }}
          canEdit={true}
        />
      )}

      <Tabs defaultValue="payments">
        <TabsList>
          <TabsTrigger value="payments">Pagos ({payments.length})</TabsTrigger>
          <TabsTrigger value="documents">Documentos ({documents.filter((d: any) => d.direction !== 'admin_to_client').length})</TabsTrigger>
          <TabsTrigger value="client-docs" className="flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5 text-blue-600" />
            Para el Cliente
          </TabsTrigger>
          <TabsTrigger value="notes">Notas</TabsTrigger>
          {isVisaJuvenil && (
            <TabsTrigger value="phase-history" className="flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-purple-600" />
              Histórico
            </TabsTrigger>
          )}
          {isVisaJuvenil && (
            <TabsTrigger value="client-story" className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#F2A900]" />
              Historia
              {(aiSubmissions || []).some((s: { form_type: string; status: string }) => s.form_type === 'client_story' && s.status === 'submitted') && (
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
              )}
            </TabsTrigger>
          )}
          {isAsylumService && (
            <TabsTrigger value="i589-review" className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#F2A900]" />
              I-589
              {(aiSubmissions || []).some((s: { form_type: string; status: string }) => s.form_type === 'i589_part_b1' && s.status === 'submitted') && (
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
              )}
            </TabsTrigger>
          )}
          {isVisaJuvenil && (
            <TabsTrigger value="declaraciones" className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#F2A900]" />
              Declaraciones
            </TabsTrigger>
          )}
          {isVisaJuvenil && (
            <TabsTrigger value="i360" className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-500" />
              I-360
              {(aiSubmissions || []).some((s: { form_type: string; status: string }) => s.form_type === 'i360_sijs' && s.status === 'submitted') && (
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value="legal-review" className="flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-[#F2A900]" />
            Revisión Legal
          </TabsTrigger>
        </TabsList>

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
            {/* Documents grouped by 3 categories */}
            {DOCUMENT_CATEGORIES.map(category => {
              const catDocKeys = category.docs.map(d => d.key)
              const catUploadedCount = documents.filter((d: any) => catDocKeys.includes(d.document_key)).length
              return (
                <div key={category.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className={`px-4 py-3 flex items-center justify-between ${catUploadedCount === category.docs.length ? 'bg-green-50' : 'bg-gray-50'}`}>
                    <span className="text-sm font-bold text-gray-900">{category.title}</span>
                    <span className="text-xs text-gray-400">{catUploadedCount}/{category.docs.length}</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {category.docs.map(docType => {
                      const categoryDocs = documents.filter((d: any) => d.document_key === docType.key)
                      return (
                        <div key={docType.key} className="px-4 py-3">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              {categoryDocs.length > 0
                                ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                : <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              }
                              <span className="text-sm font-medium text-gray-800">{docType.label}</span>
                              {categoryDocs.length > 0 && (
                                <Badge variant="outline" className="text-green-700 border-green-300 text-[10px]">{categoryDocs.length}</Badge>
                              )}
                            </div>
                            <label className="inline-flex items-center gap-1 px-2.5 py-1 border border-dashed rounded-md cursor-pointer text-[11px] text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
                              {uploadingKey === docType.key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                              {uploadingKey === docType.key ? 'Subiendo...' : 'Subir'}
                              <input type="file" accept="application/pdf" className="hidden" disabled={uploadingKey !== null}
                                onChange={async (e) => {
                                  const file = e.target.files?.[0]
                                  if (!file) return
                                  setUploadingKey(docType.key)
                                  try {
                                    await uploadDirect({ file, documentKey: docType.key, mode: 'admin', caseId: caseData.id, clientId: caseData.client_id })
                                    toast.success(`${docType.label} subido`)
                                    router.refresh()
                                  } catch (err: any) {
                                    toast.error(err.message || 'Error al subir')
                                  } finally { setUploadingKey(null); e.target.value = '' }
                                }}
                              />
                            </label>
                          </div>
                          {categoryDocs.map((doc: any) => (
                            <div key={doc.id} className="flex items-center justify-between p-2 ml-6 mt-1 rounded-lg bg-gray-50 border">
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs font-medium truncate">{doc.name}</p>
                                  <p className="text-[10px] text-gray-400">{(doc.file_size / 1024).toFixed(0)} KB</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Ver"
                                  onClick={async () => {
                                    const { data } = await supabase.storage.from('case-documents').createSignedUrl(doc.file_path, 300)
                                    if (data?.signedUrl) setPreviewUrl(data.signedUrl)
                                    else toast.error('Error al generar preview')
                                  }}><Eye className="w-3 h-3" /></Button>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Renombrar"
                                  onClick={() => setRenamingDoc({ id: doc.id, name: doc.name })}><Pencil className="w-3 h-3" /></Button>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Descargar"
                                  onClick={async () => {
                                    const { data } = await supabase.storage.from('case-documents').createSignedUrl(doc.file_path, 300)
                                    if (data?.signedUrl) { const l = document.createElement('a'); l.href = data.signedUrl; l.download = doc.name; l.click() }
                                  }}><Download className="w-3 h-3" /></Button>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" title="Eliminar"
                                  disabled={deletingDocId === doc.id}
                                  onClick={async () => {
                                    if (!confirm('¿Eliminar?')) return
                                    setDeletingDocId(doc.id)
                                    try {
                                      const res = await fetch('/api/admin/upload-document', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ document_id: doc.id }) })
                                      if (!res.ok) throw new Error()
                                      toast.success('Eliminado'); router.refresh()
                                    } catch { toast.error('Error al eliminar') } finally { setDeletingDocId(null) }
                                  }}>{deletingDocId === doc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}</Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {/* Uncategorized documents */}
            {documents.filter((d: any) => !APPOINTMENT_DOCUMENT_KEYS.some(k => k.key === d.document_key) && d.direction !== 'admin_to_client').length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Otros Documentos</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {documents.filter((d: any) => !APPOINTMENT_DOCUMENT_KEYS.some(k => k.key === d.document_key) && d.direction !== 'admin_to_client').map((doc: any) => (
                      <div key={doc.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{doc.name}</p>
                            <p className="text-xs text-gray-400">{doc.document_key} — {(doc.file_size / 1024).toFixed(0)} KB</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Ver"
                            onClick={async () => {
                              const { data } = await supabase.storage.from('case-documents').createSignedUrl(doc.file_path, 300)
                              if (data?.signedUrl) setPreviewUrl(data.signedUrl)
                              else toast.error('Error al generar preview')
                            }}><Eye className="w-3 h-3" /></Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Renombrar"
                            onClick={() => setRenamingDoc({ id: doc.id, name: doc.name })}><Pencil className="w-3 h-3" /></Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Descargar"
                            onClick={async () => {
                              const { data } = await supabase.storage.from('case-documents').createSignedUrl(doc.file_path, 300)
                              if (data?.signedUrl) { const l = document.createElement('a'); l.href = data.signedUrl; l.download = doc.name; l.click() }
                            }}><Download className="w-3 h-3" /></Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" title="Eliminar"
                            disabled={deletingDocId === doc.id}
                            onClick={async () => {
                              if (!confirm('¿Eliminar?')) return
                              setDeletingDocId(doc.id)
                              try {
                                const res = await fetch('/api/admin/upload-document', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ document_id: doc.id }) })
                                if (!res.ok) throw new Error()
                                toast.success('Eliminado'); router.refresh()
                              } catch { toast.error('Error al eliminar') } finally { setDeletingDocId(null) }
                            }}>{deletingDocId === doc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

          </div>
        </TabsContent>

        <TabsContent value="client-docs" className="mt-4">
            <div className="border-2 border-blue-200 rounded-xl bg-blue-50/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Download className="w-5 h-5 text-blue-800" />
                  <span className="text-sm font-bold text-blue-800">Documentos para el Cliente</span>
                  <Badge variant="outline" className="text-blue-700 border-blue-300">
                    {documents.filter(d => d.direction === 'admin_to_client').length}
                  </Badge>
                </div>
              </div>

              {[
                { key: 'parental_consent', label: '1. Carta de Renuncia', color: 'bg-blue-100 text-blue-700' },
                { key: 'petition_guardianship', label: '2. Petición de Tutela', color: 'bg-emerald-100 text-emerald-700' },
                { key: 'minor_declaration', label: '3. Declaración del Menor', color: 'bg-amber-100 text-amber-700' },
                { key: 'tutor_declaration', label: '4. Declaración del Tutor', color: 'bg-indigo-100 text-indigo-700' },
                { key: 'witness_declaration', label: '5. Declaración de Testigos', color: 'bg-purple-100 text-purple-700' },
              ].map(cat => {
                const catDocs = documents.filter((d: any) => d.direction === 'admin_to_client' && d.document_key?.includes(cat.key))
                return (
                  <div key={cat.key} className="bg-white rounded-xl border border-gray-200 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className={cat.color + ' text-[10px]'}>{cat.label}</Badge>
                        {catDocs.length > 0 && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                      </div>
                      <div className="flex gap-1">
                        {['EN', 'ES'].map(lang => (
                          <label key={lang} className={`inline-flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer text-[10px] font-bold ${lang === 'EN' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-amber-500 text-white hover:bg-amber-600'}`}>
                            <Upload className="w-3 h-3" /> {lang}
                            <input type="file" accept="application/pdf,.doc,.docx" multiple className="hidden"
                              disabled={uploadingForClient}
                              onChange={async (e) => {
                                const files = Array.from(e.target.files || [])
                                if (!files.length) return
                                setUploadingForClient(true)
                                const docKey = `${cat.key}_${lang.toLowerCase()}`
                                try {
                                  for (const file of files) {
                                    const res = await fetch('/api/admin/client-documents', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ case_id: caseData.id, client_id: caseData.client_id, file_name: file.name, file_size: file.size, document_key: docKey }),
                                    })
                                    if (!res.ok) throw new Error()
                                    const { token: uploadToken, filePath } = await res.json()
                                    const supabaseClient = createClient()
                                    await supabaseClient.storage.from('case-documents').uploadToSignedUrl(filePath, uploadToken, file)
                                    await fetch('/api/admin/client-documents', {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ case_id: caseData.id, client_id: caseData.client_id, file_path: filePath, file_name: file.name, file_size: file.size, document_key: docKey }),
                                    })
                                  }
                                  toast.success(`${lang} — ${files.length} archivo${files.length > 1 ? 's' : ''} subido${files.length > 1 ? 's' : ''}`)
                                  router.refresh()
                                } catch { toast.error('Error al subir') }
                                finally { setUploadingForClient(false); e.target.value = '' }
                              }}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                    {catDocs.map((doc: any) => (
                      <div key={doc.id} className="flex items-center justify-between py-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                          <p className="text-xs font-medium text-gray-800 truncate">{doc.name}</p>
                        </div>
                        <div className="flex gap-0.5">
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={async () => {
                            const { data } = await supabase.storage.from('case-documents').createSignedUrl(doc.file_path, 300)
                            if (data?.signedUrl) window.open(data.signedUrl, '_blank')
                          }}><Download className="w-3 h-3" /></Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400" onClick={async () => {
                            if (!confirm('¿Eliminar?')) return
                            await fetch('/api/admin/upload-document', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ document_id: doc.id }) })
                            toast.success('Eliminado'); router.refresh()
                          }}><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      </div>
                    ))}
                    {catDocs.length === 0 && <p className="text-[10px] text-gray-400 text-center">Sin documento</p>}
                  </div>
                )
              })}

            </div>
        </TabsContent>

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

        {isVisaJuvenil && (
          <TabsContent value="phase-history" className="mt-4">
            <PhaseHistoryTab caseId={caseData.id} />
          </TabsContent>
        )}

        {isVisaJuvenil && (
          <TabsContent value="client-story" className="mt-4">
            <ClientStoryReview
              caseId={caseData.id}
              submissions={(aiSubmissions || []).filter((s: { form_type: string }) =>
                ['client_story', 'client_witnesses', 'client_absent_parent', 'tutor_guardian'].includes(s.form_type)
              )}
              declarationDocs={(documents || [])
                .filter((d: { declaration_number?: number; direction?: string }) =>
                  d.declaration_number != null && (!d.direction || d.direction === 'client_to_admin')
                )
                .map((d: { id: string; name: string; file_size?: number; declaration_number: number }) => ({
                  id: d.id,
                  name: d.name,
                  file_size: d.file_size ?? 0,
                  declaration_number: d.declaration_number,
                }))
              }
            />
          </TabsContent>
        )}

        {isAsylumService && (
          <TabsContent value="i589-review" className="mt-4">
            <I589Review
              caseId={caseData.id}
              submissions={(aiSubmissions || []).filter((s: { form_type: string }) =>
                ['i589_part_b1', 'i589_part_b2', 'i589_part_c1', 'i589_part_c2'].includes(s.form_type)
              )}
            />
          </TabsContent>
        )}

        {isVisaJuvenil && (
          <TabsContent value="declaraciones" className="mt-4 space-y-6">
            {/* Jurisdiction detection (court + filing procedure from official sources) */}
            <JurisdictionPanel caseId={caseData.id} />

            {/* Supplementary data for filling [PENDING] fields */}
            <SupplementaryDataForm
              caseId={caseData.id}
              tutorData={(aiSubmissions || []).find((s: any) => s.form_type === 'tutor_guardian')?.form_data || null}
              minorStories={(aiSubmissions || [])
                .filter((s: any) => s.form_type === 'client_story')
                .sort((a: any, b: any) => (a.minor_index || 0) - (b.minor_index || 0))
                .map((s: any) => ({ minorIndex: s.minor_index || 0, formData: s.form_data }))
              }
              absentParents={(aiSubmissions || [])
                .filter((s: any) => s.form_type === 'client_absent_parent')
                .map((s: any) => ({ formData: s.form_data }))
              }
            />

            {/* 1. Parental Consent */}
            <ParentalConsentGenerator
              caseId={caseData.id}
              clientName={`${caseData.client?.first_name || ''} ${caseData.client?.last_name || ''}`.trim()}
            />

            <div className="border-t border-gray-200" />

            {/* 2-5. AI-generated declarations */}
            <DeclarationGenerator
              caseId={caseData.id}
              clientName={`${caseData.client?.first_name || ''} ${caseData.client?.last_name || ''}`.trim()}
              tutorData={(aiSubmissions || []).find((s: any) => s.form_type === 'tutor_guardian')?.form_data || null}
              clientWitnessesData={(aiSubmissions || []).find((s: any) => s.form_type === 'client_witnesses')?.form_data || null}
              minorStories={(aiSubmissions || [])
                .filter((s: any) => s.form_type === 'client_story')
                .sort((a: any, b: any) => (a.minor_index || 0) - (b.minor_index || 0))
                .map((s: any) => ({ minorIndex: s.minor_index || 0, formData: s.form_data }))
              }
              absentParents={(aiSubmissions || [])
                .filter((s: any) => s.form_type === 'client_absent_parent')
                .map((s: any) => ({ formData: s.form_data }))
              }
              supplementaryData={(aiSubmissions || []).find((s: any) => s.form_type === 'admin_supplementary')?.form_data || null}
            />

          </TabsContent>
        )}

        {/* I-360 Tab */}
        {isVisaJuvenil && (
          <TabsContent value="i360" className="mt-4">
            <I360Review submissions={(aiSubmissions || []).filter((s: any) => s.form_type === 'i360_sijs')} onDownload={handleDownloadI360} downloading={i360Loading} />
          </TabsContent>
        )}

        {/* Legal Review — super reviewer powered by Claude Opus 4.7 */}
        <TabsContent value="legal-review" className="mt-4">
          <LegalReviewer caseId={caseData.id} />
        </TabsContent>

      </Tabs>
    </div>
  )

}

function I360Review({ submissions, onDownload, downloading }: { submissions: any[]; onDownload: () => void; downloading: boolean }) {
  const sub = submissions[0]

  if (!sub) return (
    <div className="text-center py-12">
      <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
      <p className="text-sm text-gray-500">El cliente aún no ha llenado el formulario I-360.</p>
      <p className="text-xs text-gray-400 mt-1">Aparecerá aquí cuando lo complete desde su portal.</p>
    </div>
  )

  const d = sub.form_data as Record<string, string>
  const status = sub.status

  const sections = [
    { title: 'Part 1 — Peticionario', color: 'indigo', fields: [
      { label: 'Nombre', value: `${d.petitioner_first_name || ''} ${d.petitioner_middle_name || ''} ${d.petitioner_last_name || ''}`.trim() },
      { label: 'SSN', value: d.petitioner_ssn },
      { label: 'A-Number', value: d.petitioner_a_number },
      { label: 'Dirección', value: `${d.petitioner_address || ''}, ${d.petitioner_city || ''} ${d.petitioner_state || ''} ${d.petitioner_zip || ''}`.trim() },
      { label: 'Dir. segura', value: d.safe_mailing_address ? `${d.safe_mailing_name} — ${d.safe_mailing_address}, ${d.safe_mailing_city} ${d.safe_mailing_state} ${d.safe_mailing_zip}` : '' },
    ]},
    { title: 'Part 3 — Beneficiario (Menor)', color: 'blue', fields: [
      { label: 'Nombre', value: `${d.beneficiary_first_name || ''} ${d.beneficiary_middle_name || ''} ${d.beneficiary_last_name || ''}`.trim() },
      { label: 'Otros nombres', value: d.other_names },
      { label: 'DOB', value: d.beneficiary_dob },
      { label: 'País/Ciudad nacimiento', value: `${d.beneficiary_city_birth || ''}, ${d.beneficiary_country_birth || ''}` },
      { label: 'Sexo', value: d.beneficiary_sex },
      { label: 'Estado civil', value: d.beneficiary_marital_status },
      { label: 'Dirección', value: `${d.beneficiary_address || ''}, ${d.beneficiary_city || ''} ${d.beneficiary_state || ''} ${d.beneficiary_zip || ''}`.trim() },
      { label: 'SSN', value: d.beneficiary_ssn },
      { label: 'A-Number', value: d.beneficiary_a_number },
      { label: 'Pasaporte', value: `${d.beneficiary_passport_number || ''} (${d.beneficiary_passport_country || ''}) exp: ${d.beneficiary_passport_expiry || ''}` },
      { label: 'I-94', value: d.beneficiary_i94_number },
      { label: 'Última llegada', value: d.beneficiary_last_arrival_date },
      { label: 'Status migratorio', value: d.beneficiary_nonimmigrant_status },
      { label: 'Status expira', value: d.beneficiary_status_expiry },
      { label: 'I-94 expira', value: d.beneficiary_i94_expiry },
    ]},
    { title: 'Part 4 — Procesamiento', color: 'amber', fields: [
      { label: 'Padre/Madre extranjero', value: `${d.foreign_parent_first_name || ''} ${d.foreign_parent_last_name || ''}`.trim() },
      { label: 'Dir. extranjero', value: `${d.foreign_parent_address || ''}, ${d.foreign_parent_city || ''} ${d.foreign_parent_province || ''} ${d.foreign_parent_country || ''}`.trim() },
      { label: 'En removal proceedings', value: d.in_removal_proceedings },
      { label: 'Otras peticiones', value: d.other_petitions },
      { label: 'Trabajó sin permiso', value: d.worked_without_permission },
      { label: 'Ajuste de estatus adjunto', value: d.adjustment_attached },
    ]},
    { title: 'Part 5 — Cónyuge/Hijos', color: 'emerald', fields: [
      { label: 'Hijos presentaron peticiones separadas', value: d.children_filed_separate },
      { label: 'Persona 1', value: d.spouse_child_1_first_name ? `${d.spouse_child_1_first_name} ${d.spouse_child_1_last_name} — ${d.spouse_child_1_relationship} — DOB: ${d.spouse_child_1_dob}` : '' },
    ]},
    { title: 'Part 8 — SIJS', color: 'purple', fields: [
      { label: '2A. Dependiente de corte', value: d.declared_dependent_court },
      { label: '2B. Corte/Agencia', value: d.state_agency_name },
      { label: '2C. Bajo jurisdicción', value: d.currently_under_jurisdiction },
      { label: '3A. En placement ordenado', value: d.in_court_ordered_placement },
      { label: '4. Reunificación no viable', value: d.reunification_not_viable_reason },
      { label: '5. Mejor interés no regresar', value: d.best_interest_not_return },
      { label: '6A. Custodia HHS', value: d.previously_hhs_custody },
    ]},
    { title: 'Part 11/15 — Contacto', color: 'gray', fields: [
      { label: 'Teléfono', value: d.petitioner_phone },
      { label: 'Celular', value: d.petitioner_mobile },
      { label: 'Email', value: d.petitioner_email },
      { label: 'Idioma', value: d.language_understood },
      { label: 'Necesita intérprete', value: d.interpreter_needed },
      { label: 'Info adicional', value: d.additional_info },
    ]},
  ]

  const colorMap: Record<string, { bg: string; border: string; text: string }> = {
    indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-900' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-900' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-900' },
    gray: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-900' },
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-900">Formulario I-360 — SIJS</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={onDownload}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Descargar I-360
          </button>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            status === 'submitted' ? 'bg-purple-100 text-purple-700' :
            status === 'approved' ? 'bg-green-100 text-green-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {status === 'submitted' ? 'Enviado por el cliente' : status === 'approved' ? 'Aprobado' : status === 'draft' ? 'Borrador' : status}
          </span>
        </div>
      </div>

      {sections.map(section => {
        const c = colorMap[section.color] || colorMap.gray
        const filledFields = section.fields.filter(f => f.value && f.value.trim() && f.value.trim() !== ',' && f.value.trim() !== ', ,')
        if (filledFields.length === 0) return null
        return (
          <div key={section.title} className={`rounded-xl border ${c.border} overflow-hidden`}>
            <div className={`px-4 py-2.5 ${c.bg}`}>
              <span className={`text-xs font-bold ${c.text} uppercase`}>{section.title}</span>
            </div>
            <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-2">
              {filledFields.map(f => (
                <div key={f.label}>
                  <span className="text-[10px] text-gray-400 uppercase">{f.label}</span>
                  <p className="text-sm text-gray-900">{f.value}</p>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

