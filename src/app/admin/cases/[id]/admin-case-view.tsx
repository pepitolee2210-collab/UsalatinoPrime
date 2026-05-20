'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { logActivity, SUBCATEGORIES } from '@/lib/activity/log-activity'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { CheckCircle, AlertCircle, FileText, Download, ArrowLeft, Loader2, ShieldCheck, ShieldOff, Pencil } from 'lucide-react'
import Link from 'next/link'
import { CaseChat } from './case-chat'
import { ClientStoryReview } from './client-story-review'
import { LegalReviewer } from './legal-reviewer'
import { PhaseStatusPanel } from './phase-status-panel'
import { CasePipeline } from '@/components/case-pipeline'
import { I360WizardCore, type I360FormData } from '@/components/i360/I360WizardCore'
import { CaseTabsByPhase, type TabId as DashboardTabId } from '@/app/employee/_shared/case-tabs-by-phase'
import { useCaseOverview } from '@/app/employee/_shared/use-case-overview'
import { PaymentsTab } from './payments-tab'

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
  const [accessLoading, setAccessLoading] = useState(false)
  const [renamingDoc, setRenamingDoc] = useState<{ id: string; name: string } | null>(null)
  const [renameLoading, setRenameLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Hook compartido con employee-case-view — case-overview lo expone tanto a
  // admin como a employee desde el mismo endpoint `/api/admin/cases/[id]/case-overview`.
  const { overview, loading: overviewLoading, refresh: refreshOverview } = useCaseOverview(caseData.id)

  const [currentUserId, setCurrentUserId] = useState<string>('')
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? ''))
  }, [supabase])

  const serviceSlug = caseData.service?.slug || ''
  const isAsylumService = serviceSlug === 'asilo-politico'
  const isVisaJuvenil = serviceSlug === 'visa-juvenil'
  const clientName = `${caseData.client?.first_name || ''} ${caseData.client?.last_name || ''}`.trim() || 'el cliente'

  async function updateStatus(newStatus: string, notes?: string) {
    setLoading(true)
    try {
      const updateData: any = { intake_status: newStatus }
      if (notes) updateData.correction_notes = notes
      if (henryNotes !== caseData.henry_notes) updateData.henry_notes = henryNotes

      await supabase.from('cases').update(updateData).eq('id', caseData.id)

      await logActivity({
        caseId: caseData.id,
        category: 'case',
        subcategory: SUBCATEGORIES.CASE_STATUS_CHANGED,
        description: `Estado cambiado a ${newStatus}${notes ? ': ' + notes : ''}`,
        metadata: { new_status: newStatus, notes: notes ?? null },
        visibleToClient: true,
        actor: { kind: 'session', supabase },
        client: supabase,
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

      await logActivity({
        caseId: caseData.id,
        category: 'system',
        subcategory: SUBCATEGORIES.SYSTEM_ACCESS_TOGGLED,
        description: newValue
          ? 'Acceso otorgado al cliente para completar formularios'
          : 'Acceso revocado al cliente',
        metadata: { access_granted: newValue },
        visibleToClient: true,
        actor: { kind: 'session', supabase },
        client: supabase,
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
            {caseData.client?.first_name} {caseData.client?.last_name}
          </p>
          <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
            {caseData.client?.phone && <span>{caseData.client.phone}</span>}
            {caseData.client?.email && !caseData.client.email.includes('@usalatinoprime.internal') && (
              <span>{caseData.client.email}</span>
            )}
          </div>
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
        serviceSlug={serviceSlug}
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

      <CaseTabsByPhase
        caseId={caseData.id}
        caseNumber={caseData.case_number}
        clientId={caseData.client_id}
        clientName={clientName}
        serviceSlug={serviceSlug}
        overview={overview}
        loading={overviewLoading}
        formSubmissions={(aiSubmissions ?? []) as any}
        henryNotes={henryNotes}
        currentUserId={currentUserId}
        isAdmin={true}
        extraTabs={[
          {
            id: 'cobranza' as DashboardTabId,
            label: `Pagos (${payments.length})`,
            content: (
              <PaymentsTab
                caseId={caseData.id}
                totalCost={caseData.total_cost ?? null}
                payments={payments}
              />
            ),
          },
          ...(isVisaJuvenil
            ? [{
                id: 'client-story' as DashboardTabId,
                label: 'Historia del Cliente',
                content: (
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
                ),
              }]
            : []),
          ...(isVisaJuvenil
            ? [{
                id: 'i360' as DashboardTabId,
                label: 'I-360',
                content: (
                  <I360Review
                    submissions={(aiSubmissions || []).filter((s: any) => s.form_type === 'i360_sijs')}
                    onDownload={handleDownloadI360}
                    downloading={i360Loading}
                    caseId={caseData.id}
                    clientName={clientName}
                  />
                ),
              }]
            : []),
          {
            id: 'bitacora' as DashboardTabId,
            label: 'Bitácora',
            content: (
              <CaseChat
                caseId={caseData.id}
                clientName={clientName}
                serviceName={caseData.service?.name ?? ''}
                documentCount={documents.length}
              />
            ),
          },
          {
            id: 'legal-review' as DashboardTabId,
            label: 'Revisión Legal',
            content: <LegalReviewer caseId={caseData.id} />,
          },
        ]}
        onRefresh={() => {
          refreshOverview();
          router.refresh();
        }}
      />
    </div>
  )

}

function I360Review({
  submissions,
  onDownload,
  downloading,
  caseId,
  clientName,
}: {
  submissions: any[]
  onDownload: () => void
  downloading: boolean
  caseId: string
  clientName: string
}) {
  const sub = submissions[0]
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorData, setEditorData] = useState<{
    form_data: I360FormData
    status: string | null
    prefill_sources: Record<string, Record<string, unknown>>
  } | null>(null)
  const [editorLoading, setEditorLoading] = useState(false)
  const router = useRouter()

  async function openEditor() {
    setEditorLoading(true)
    try {
      // Carga form_data + prefill sources del caso
      const [adminRes, supabaseClient] = await Promise.all([
        fetch(`/api/admin/cases/${encodeURIComponent(caseId)}/i360-form`, { cache: 'no-store' }),
        Promise.resolve(createClient()),
      ])
      if (!adminRes.ok) throw new Error('No se pudo cargar el formulario')
      const json = await adminRes.json()

      // Prefill sources: tutor_guardian, client_story, client_absent_parent
      const { data: prefillRows } = await supabaseClient
        .from('case_form_submissions')
        .select('form_type, form_data')
        .eq('case_id', caseId)
        .in('form_type', ['tutor_guardian', 'client_story', 'client_absent_parent'])
        .eq('minor_index', 0)

      const prefillSources: Record<string, Record<string, unknown>> = {}
      for (const row of prefillRows ?? []) {
        prefillSources[row.form_type] = (row.form_data as Record<string, unknown>) ?? {}
      }

      setEditorData({
        form_data: (json.form_data ?? {}) as I360FormData,
        status: json.status ?? null,
        prefill_sources: prefillSources,
      })
      setEditorOpen(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al abrir el editor')
    } finally {
      setEditorLoading(false)
    }
  }

  if (!sub) return (
    <div className="text-center py-12">
      <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
      <p className="text-sm text-gray-500">El cliente aún no ha llenado el formulario I-360.</p>
      <p className="text-xs text-gray-400 mt-1">
        Puedes empezar a llenarlo en nombre del cliente y guardar. El cliente verá tus respuestas en su portal.
      </p>
      <Button
        onClick={openEditor}
        disabled={editorLoading}
        className="mt-4 bg-indigo-600 hover:bg-indigo-700"
      >
        {editorLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Pencil className="w-4 h-4 mr-2" />}
        Empezar a llenar I-360
      </Button>
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-5 pb-2 border-b">
            <DialogTitle>Editar Form I-360 — {clientName}</DialogTitle>
          </DialogHeader>
          {editorData && (
            <I360WizardCore
              mode="admin"
              caseId={caseId}
              clientName={clientName}
              initialData={editorData.form_data}
              prefillSources={editorData.prefill_sources}
              initialStatus={editorData.status}
              onSaved={() => router.refresh()}
              onClose={() => { setEditorOpen(false); router.refresh() }}
            />
          )}
        </DialogContent>
      </Dialog>
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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-bold text-gray-900">Formulario I-360 — SIJS</h3>
          {sub.updated_at && (
            <p className="text-[11px] text-gray-500 mt-0.5">
              Última edición: {format(new Date(sub.updated_at), "d MMM yyyy 'a las' HH:mm", { locale: es })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={openEditor}
            disabled={editorLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
          >
            {editorLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pencil className="w-3.5 h-3.5" />}
            Editar I-360
          </button>
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

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-5 pb-2 border-b">
            <DialogTitle>Editar Form I-360 — {clientName}</DialogTitle>
          </DialogHeader>
          {editorData && (
            <I360WizardCore
              mode="admin"
              caseId={caseId}
              clientName={clientName}
              initialData={editorData.form_data}
              prefillSources={editorData.prefill_sources}
              initialStatus={editorData.status}
              onSaved={() => router.refresh()}
              onClose={() => { setEditorOpen(false); router.refresh() }}
            />
          )}
        </DialogContent>
      </Dialog>

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

