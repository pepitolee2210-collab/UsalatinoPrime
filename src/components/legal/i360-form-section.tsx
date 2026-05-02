'use client'

// Sección compartida admin/employee para visualizar, editar e imprimir el
// formulario USCIS I-360 SIJS.
//
// Reutiliza:
// - I360WizardCore (mode='admin') para edición con prefill desde tutor_guardian + client_story
// - generateI360PDF() para imprimir el PDF rellenado
// - case_form_submissions con form_type='i360_sijs' como almacenamiento
//
// Patrón derivado del I360Review interno de admin-case-view.tsx (ahora extraído
// para que también lo use Diana en /employee/cases/[id]).

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { FileText, Loader2, Pencil, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { I360WizardCore, type I360FormData } from '@/components/i360/I360WizardCore'

interface FormSubmission {
  id?: string
  form_type: string
  form_data: Record<string, unknown>
  status: string
  updated_at: string
  minor_index?: number
}

interface I360FormSectionProps {
  caseId: string
  caseNumber: string
  clientName: string
  /** Submission existente (form_type='i360_sijs', minor_index=0). Puede ser undefined si el cliente aún no ha tocado el form. */
  submission?: FormSubmission
}

export function I360FormSection({ caseId, caseNumber, clientName, submission }: I360FormSectionProps) {
  const router = useRouter()
  const [sub, setSub] = useState<FormSubmission | undefined>(submission)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorData, setEditorData] = useState<{
    form_data: I360FormData
    status: string | null
    prefill_sources: Record<string, Record<string, unknown>>
  } | null>(null)
  const [editorLoading, setEditorLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)

  // Cuando el submission cambia desde el padre (ej. en employee, viene del fetchCaseOverview), actualizar.
  useEffect(() => { setSub(submission) }, [submission])

  const refreshSubmission = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('case_form_submissions')
        .select('id, form_type, form_data, status, updated_at, minor_index')
        .eq('case_id', caseId)
        .eq('form_type', 'i360_sijs')
        .eq('minor_index', 0)
        .maybeSingle()
      if (data) setSub(data as FormSubmission)
    } catch { /* silent */ }
  }, [caseId])

  async function openEditor() {
    setEditorLoading(true)
    try {
      const [adminRes, supabaseClient] = await Promise.all([
        fetch(`/api/admin/cases/${encodeURIComponent(caseId)}/i360-form`, { cache: 'no-store' }),
        Promise.resolve(createClient()),
      ])
      if (!adminRes.ok) throw new Error('No se pudo cargar el formulario')
      const json = await adminRes.json()

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

  async function handleDownload() {
    if (downloading) return
    setDownloading(true)
    try {
      // Si no hay submission o tiene form_data vacío, igual permitimos descargar
      // (mostrará PDF con campos vacíos pero rellenados con prefill si lo hay).
      const formData = (sub?.form_data as Record<string, unknown> | undefined) ?? {}
      if (!sub) {
        toast.error('No hay datos I-360 para descargar. Empieza a llenarlo primero.')
        return
      }
      const { generateI360PDF } = await import('@/lib/pdf/i360')
      const pdfBytes = await generateI360PDF(formData)
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `I-360-${caseNumber}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success('I-360 descargado')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      toast.error(`Error al generar I-360: ${msg}`)
    } finally {
      setDownloading(false)
    }
  }

  // Si no hay submission, mostrar CTA "Empezar a llenar"
  if (!sub) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 flex items-start gap-3">
          <FileText className="w-5 h-5 text-indigo-700 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-bold text-indigo-800 uppercase">Fase 2 — I-360 (Petición SIJS)</p>
            <p className="text-[12px] text-indigo-700 mt-0.5">
              Form I-360 — Petición especial de inmigración juvenil ante USCIS.
              Aún no se ha empezado a llenar. Puedes hacerlo en nombre del cliente — verá tus respuestas en su portal.
            </p>
          </div>
        </div>

        <div className="text-center py-8 rounded-xl border border-gray-200 bg-white">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">El cliente aún no ha llenado el formulario I-360.</p>
          <Button
            onClick={openEditor}
            disabled={editorLoading}
            className="mt-4 bg-indigo-600 hover:bg-indigo-700"
          >
            {editorLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Pencil className="w-4 h-4 mr-2" />}
            Empezar a llenar I-360
          </Button>
        </div>

        <Dialog open={editorOpen} onOpenChange={(open) => { setEditorOpen(open); if (!open) refreshSubmission() }}>
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
                onSaved={() => { router.refresh(); refreshSubmission() }}
                onClose={() => { setEditorOpen(false); router.refresh(); refreshSubmission() }}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    )
  }

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
      <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 flex items-start gap-3">
        <FileText className="w-5 h-5 text-indigo-700 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-xs font-bold text-indigo-800 uppercase">Fase 2 — I-360 (Petición SIJS)</p>
          <p className="text-[12px] text-indigo-700 mt-0.5">
            Form I-360 — Petición especial de inmigración juvenil ante USCIS. El cliente llena el wizard
            en su portal y aquí Diana o Henry pueden completarlo, editarlo e imprimir el PDF rellenado.
          </p>
        </div>
      </div>

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
            onClick={handleDownload}
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

      <Dialog open={editorOpen} onOpenChange={(open) => { setEditorOpen(open); if (!open) refreshSubmission() }}>
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
              onSaved={() => { router.refresh(); refreshSubmission() }}
              onClose={() => { setEditorOpen(false); router.refresh(); refreshSubmission() }}
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
