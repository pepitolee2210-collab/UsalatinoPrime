'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Download, CheckCircle, Archive, ChevronDown, ChevronUp,
  Loader2, User, MapPin, Calendar, ShieldAlert, MessageSquare, FileText,
  Briefcase, GraduationCap,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import jsPDF from 'jspdf'

interface Submission {
  id: string
  created_at: string
  applicant_name: string
  country_of_birth: string
  form_data: Record<string, any>
  status: string
  admin_notes: string | null
}

const statusConfig: Record<string, { label: string; class: string }> = {
  pending: { label: 'Pendiente', class: 'bg-amber-100 text-amber-800' },
  reviewed: { label: 'Revisado', class: 'bg-green-100 text-green-800' },
  archived: { label: 'Archivado', class: 'bg-gray-100 text-gray-600' },
}

export function AjusteRow({ submission }: { submission: Submission }) {
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState(submission.status)
  const [updating, setUpdating] = useState(false)
  const [notes, setNotes] = useState(submission.admin_notes || '')
  const [savingNotes, setSavingNotes] = useState(false)

  const statusInfo = statusConfig[status] || statusConfig.pending
  const fd = submission.form_data

  function handleDownloadResumen() {
    const doc = new jsPDF()
    const margin = 15
    let y = 20

    function addTitle(text: string) {
      if (y > 260) { doc.addPage(); y = 20 }
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 40, 85)
      doc.text(text, margin, y)
      y += 8
    }

    function addSubtitle(text: string) {
      if (y > 265) { doc.addPage(); y = 20 }
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(60, 60, 60)
      doc.text(text, margin, y)
      y += 6
    }

    function addField(label: string, value: any) {
      if (y > 270) { doc.addPage(); y = 20 }
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(100, 100, 100)
      doc.text(label + ':', margin, y)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(30, 30, 30)
      const val = value == null ? '' : String(value)
      const lines = doc.splitTextToSize(val, 170)
      doc.text(lines, margin + 2, y + 4)
      y += 4 + lines.length * 4
    }

    function addLongText(label: string, value: string) {
      if (y > 270) { doc.addPage(); y = 20 }
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(100, 100, 100)
      doc.text(label + ':', margin, y)
      y += 5
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(30, 30, 30)
      const lines = doc.splitTextToSize(value || 'N/A', 180)
      for (const line of lines) {
        if (y > 280) { doc.addPage(); y = 20 }
        doc.text(line, margin, y)
        y += 4
      }
      y += 2
    }

    // Header
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 40, 85)
    doc.text('Resumen de Ajuste de Estatus I-485', margin, y)
    y += 8
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(`Generado: ${format(new Date(), "d 'de' MMMM yyyy, HH:mm", { locale: es })}`, margin, y)
    y += 4
    doc.text(`Enviado: ${format(new Date(submission.created_at), "d 'de' MMMM yyyy, HH:mm", { locale: es })}`, margin, y)
    y += 10

    // Section 1: Personal
    addTitle('1. Informacion Personal')
    addField('Nombre', `${fd.legal_first_name} ${fd.legal_middle_name || ''} ${fd.legal_last_name}`)
    addField('Fecha de nacimiento', fd.date_of_birth)
    addField('Lugar de nacimiento', `${fd.city_of_birth}, ${fd.country_of_birth}`)
    addField('Nacionalidad', fd.nationality)
    addField('Sexo', fd.gender)
    addField('Estado civil', fd.marital_status)
    if (fd.ssn) addField('SSN', fd.ssn)
    if (fd.a_number) addField('Numero A', fd.a_number)
    if (fd.uscis_online_account) addField('Cuenta USCIS', fd.uscis_online_account)
    addField('Direccion', `${fd.residence_address_street}, ${fd.residence_address_city}, ${fd.residence_address_state} ${fd.residence_address_zip}`)
    addField('Telefono', fd.residence_phone)
    if (fd.email) addField('Email', fd.email)
    y += 4

    // Section 2: Immigration
    addTitle('2. Informacion de Inmigracion')
    addField('Estatus actual', fd.current_immigration_status)
    if (fd.current_status_other) addField('Otro estatus', fd.current_status_other)
    addField('Fecha ultima entrada', fd.date_of_last_entry)
    addField('Lugar de entrada', fd.place_of_last_entry)
    if (fd.i94_number) addField('I-94', fd.i94_number)
    if (fd.passport_number) addField('Pasaporte', `${fd.passport_number} (${fd.passport_country || ''})`)
    if (fd.passport_expiry) addField('Vencimiento pasaporte', fd.passport_expiry)
    if (fd.entry_status_at_arrival) addField('Estatus al llegar', fd.entry_status_at_arrival)
    if (fd.current_status_expires) addField('Estatus vence', fd.current_status_expires)
    addField('Procedimientos de remocion', fd.ever_in_removal_proceedings ? 'Si' : 'No')
    if (fd.ever_in_removal_proceedings && fd.removal_proceedings_details) addLongText('Detalles remocion', fd.removal_proceedings_details)
    addField('Visa/entrada denegada', fd.ever_denied_visa_or_entry ? 'Si' : 'No')
    if (fd.ever_denied_visa_or_entry && fd.denial_details) addLongText('Detalles denegacion', fd.denial_details)
    y += 4

    // Section 3: Petitioner
    addTitle('3. Peticionario')
    addField('Tipo', fd.petitioner_type)
    addField('Nombre', fd.petitioner_full_name)
    addField('Relacion', fd.petitioner_relationship)
    if (fd.petitioner_a_number) addField('Numero A del peticionario', fd.petitioner_a_number)
    if (fd.petitioner_date_of_birth) addField('Fecha de nacimiento', fd.petitioner_date_of_birth)
    if (fd.petitioner_country_of_birth) addField('Pais de nacimiento', fd.petitioner_country_of_birth)
    if (fd.petition_receipt_number) addField('Numero de recibo', fd.petition_receipt_number)
    if (fd.petition_priority_date) addField('Fecha de prioridad', fd.petition_priority_date)
    if (fd.petition_category) addField('Categoria', fd.petition_category)
    y += 4

    // Section 4: Family
    addTitle('4. Familia')
    addField('Tiene conyuge', fd.has_spouse ? 'Si' : 'No')
    if (fd.has_spouse && fd.spouse_info) {
      const sp = fd.spouse_info
      addField('Conyuge', sp.spouse_full_name)
      if (sp.spouse_dob) addField('DOB conyuge', sp.spouse_dob)
      if (sp.spouse_country_of_birth) addField('Pais nacimiento conyuge', sp.spouse_country_of_birth)
      if (sp.spouse_a_number) addField('Numero A conyuge', sp.spouse_a_number)
      if (sp.spouse_immigration_status) addField('Estatus conyuge', sp.spouse_immigration_status)
      addField('Incluido en solicitud', sp.spouse_included_in_application ? 'Si' : 'No')
      if (sp.marriage_date) addField('Fecha matrimonio', sp.marriage_date)
      if (sp.marriage_city || sp.marriage_state) addField('Lugar matrimonio', `${sp.marriage_city || ''}, ${sp.marriage_state || ''}`)
    }
    addField('Tiene hijos', fd.has_children ? 'Si' : 'No')
    if (fd.children?.length > 0) {
      fd.children.forEach((c: any, i: number) => {
        addField(`Hijo/a ${i + 1}`, `${c.child_full_name} - ${c.child_country_of_birth || ''} - DOB: ${c.child_dob || ''} - En US: ${c.child_in_us ? 'Si' : 'No'} - Incluido: ${c.child_included ? 'Si' : 'No'}`)
      })
    }
    y += 4

    // Section 5: Employment/Education
    if (y > 240) { doc.addPage(); y = 20 }
    addTitle('5. Empleo y Educacion')
    if (fd.employments?.length > 0) {
      addSubtitle('Empleos')
      fd.employments.forEach((e: any, i: number) => {
        addField(`Empleo ${i + 1}`, `${e.emp_employer} - ${e.emp_occupation || ''} - ${e.emp_city || ''}, ${e.emp_state || ''} (${e.emp_from || ''} - ${e.emp_to || ''})`)
      })
    }
    if (fd.education?.length > 0) {
      addSubtitle('Educacion')
      fd.education.forEach((e: any, i: number) => {
        addField(`Educacion ${i + 1}`, `${e.edu_school} - ${e.edu_type || ''} - ${e.edu_address || ''} (${e.edu_from || ''} - ${e.edu_to || ''})`)
      })
    }
    y += 4

    // Section 6: Admissibility
    if (y > 200) { doc.addPage(); y = 20 }
    addTitle('6. Admisibilidad (SECCION CRITICA)')
    addField('Arresto criminal', fd.criminal_arrest ? 'SI' : 'No')
    if (fd.criminal_arrest && fd.criminal_details) addLongText('Detalles arresto', fd.criminal_details)
    addField('Condena criminal', fd.criminal_conviction ? 'SI' : 'No')
    if (fd.criminal_conviction && fd.conviction_details) addLongText('Detalles condena', fd.conviction_details)
    addField('Drogas', fd.drug_related ? 'SI' : 'No')
    if (fd.drug_related && fd.drug_details) addLongText('Detalles drogas', fd.drug_details)
    addField('Fraude migratorio', fd.immigration_fraud ? 'SI' : 'No')
    if (fd.immigration_fraud && fd.fraud_details) addLongText('Detalles fraude', fd.fraud_details)
    addField('Falsa ciudadania', fd.false_us_citizen ? 'SI' : 'No')
    if (fd.false_us_citizen && fd.citizen_details) addLongText('Detalles ciudadania', fd.citizen_details)
    addField('Removido/deportado', fd.removed_deported ? 'SI' : 'No')
    if (fd.removed_deported && fd.deported_details) addLongText('Detalles deportacion', fd.deported_details)
    addField('Presencia ilegal', fd.unlawful_presence ? 'SI' : 'No')
    if (fd.unlawful_presence && fd.unlawful_details) addLongText('Detalles presencia', fd.unlawful_details)
    addField('Carga publica', fd.public_charge ? 'SI' : 'No')
    if (fd.public_charge && fd.public_charge_details) addLongText('Detalles carga publica', fd.public_charge_details)
    y += 4

    // Section 7: Documents
    if (y > 240) { doc.addPage(); y = 20 }
    addTitle('7. Documentos')
    addField('Examen medico (I-693)', fd.has_medical_exam ? 'Si' : 'No')
    addField('Declaracion de sostenimiento (I-864)', fd.has_affidavit_support ? 'Si' : 'No')
    if (fd.additional_info) addLongText('Informacion adicional', fd.additional_info)
    addField('Declaracion del solicitante', fd.applicant_declaration ? 'Aceptada' : 'No aceptada')

    const safeName = submission.applicant_name.replace(/[^a-zA-Z0-9]/g, '_')
    doc.save(`resumen_ajuste_${safeName}.pdf`)
    toast.success('Resumen PDF descargado')
  }

  async function updateStatus(newStatus: string) {
    setUpdating(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('ajuste_submissions')
        .update({ status: newStatus })
        .eq('id', submission.id)

      if (error) {
        toast.error('Error al actualizar')
        return
      }
      setStatus(newStatus)
      toast.success(`Marcado como ${statusConfig[newStatus]?.label || newStatus}`)
    } catch {
      toast.error('Error de conexion')
    } finally {
      setUpdating(false)
    }
  }

  async function saveNotes() {
    setSavingNotes(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('ajuste_submissions')
        .update({ admin_notes: notes })
        .eq('id', submission.id)

      if (error) {
        toast.error('Error al guardar notas')
        return
      }
      toast.success('Notas guardadas')
    } catch {
      toast.error('Error de conexion')
    } finally {
      setSavingNotes(false)
    }
  }

  // Helper to check if any admissibility flag is true
  const hasAdmissibilityIssues = fd.criminal_arrest || fd.criminal_conviction || fd.drug_related ||
    fd.immigration_fraud || fd.false_us_citizen || fd.removed_deported || fd.unlawful_presence || fd.public_charge

  return (
    <Card className={status === 'pending' ? 'border-amber-200' : ''}>
      <CardContent className="p-0">
        {/* Header row */}
        <div
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 truncate">{submission.applicant_name}</p>
              <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {submission.country_of_birth}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(submission.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                </span>
                {fd.petitioner_type && (
                  <Badge className="bg-blue-50 text-blue-700 text-[10px] px-1.5 py-0">
                    {fd.petitioner_type}
                  </Badge>
                )}
                {hasAdmissibilityIssues && (
                  <Badge className="bg-red-50 text-red-700 text-[10px] px-1.5 py-0">
                    Admisibilidad
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge className={statusInfo.class}>{statusInfo.label}</Badge>
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="border-t px-4 pb-4">
            {/* Action buttons */}
            <div className="flex items-center gap-2 py-3 border-b mb-4 flex-wrap">
              <button
                onClick={handleDownloadResumen}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#002855] text-white rounded-lg hover:bg-[#001d3d] transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar Resumen
              </button>
              {status !== 'reviewed' && (
                <button
                  onClick={() => updateStatus('reviewed')}
                  disabled={updating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  Marcar Revisado
                </button>
              )}
              {status !== 'archived' && (
                <button
                  onClick={() => updateStatus('archived')}
                  disabled={updating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                  Archivar
                </button>
              )}
              {status !== 'pending' && (
                <button
                  onClick={() => updateStatus('pending')}
                  disabled={updating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Volver a Pendiente
                </button>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Section 1: Personal Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-[#002855] mb-3 flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  Informacion Personal
                </h3>
                <dl className="space-y-2 text-sm">
                  <InfoField label="Nombre" value={`${fd.legal_first_name} ${fd.legal_middle_name || ''} ${fd.legal_last_name}`} />
                  {fd.other_names?.length > 0 && <InfoField label="Otros nombres" value={fd.other_names.join(', ')} />}
                  <InfoField label="Fecha de nacimiento" value={formatDate(fd.date_of_birth)} />
                  <InfoField label="Lugar de nacimiento" value={`${fd.city_of_birth}, ${fd.country_of_birth}`} />
                  <InfoField label="Nacionalidad" value={fd.nationality} />
                  <InfoField label="Sexo" value={fd.gender} />
                  <InfoField label="Estado civil" value={fd.marital_status} />
                  <InfoField label="Telefono" value={fd.residence_phone} />
                  {fd.email && <InfoField label="Email" value={fd.email} />}
                  <InfoField label="Direccion" value={`${fd.residence_address_street}, ${fd.residence_address_city}, ${fd.residence_address_state} ${fd.residence_address_zip}`} />
                  {fd.ssn && <InfoField label="SSN" value={fd.ssn} />}
                  {fd.a_number && <InfoField label="Numero A" value={fd.a_number} />}
                  {fd.uscis_online_account && <InfoField label="Cuenta USCIS" value={fd.uscis_online_account} />}
                </dl>
              </div>

              {/* Section 2: Immigration Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-[#002855] mb-3 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  Informacion de Inmigracion
                </h3>
                <dl className="space-y-2 text-sm">
                  <InfoField label="Estatus actual" value={fd.current_immigration_status} highlight />
                  {fd.current_status_other && <InfoField label="Otro estatus" value={fd.current_status_other} />}
                  <InfoField label="Fecha ultima entrada" value={formatDate(fd.date_of_last_entry)} highlight />
                  <InfoField label="Lugar de entrada" value={fd.place_of_last_entry} />
                  {fd.i94_number && <InfoField label="I-94" value={fd.i94_number} />}
                  {fd.passport_number && <InfoField label="Pasaporte" value={`${fd.passport_number} (${fd.passport_country || ''})`} />}
                  {fd.passport_expiry && <InfoField label="Vencimiento pasaporte" value={formatDate(fd.passport_expiry)} />}
                  {fd.entry_status_at_arrival && <InfoField label="Estatus al llegar" value={fd.entry_status_at_arrival} />}
                  {fd.current_status_expires && <InfoField label="Estatus vence" value={formatDate(fd.current_status_expires)} />}
                  <InfoField label="Procedimientos de remocion" value={fd.ever_in_removal_proceedings ? 'Si' : 'No'} highlight={fd.ever_in_removal_proceedings} />
                  {fd.ever_in_removal_proceedings && fd.removal_proceedings_details && (
                    <div>
                      <p className="text-xs font-medium text-gray-500">Detalles remocion:</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap bg-white rounded p-2 border mt-1">{fd.removal_proceedings_details}</p>
                    </div>
                  )}
                  <InfoField label="Visa/entrada denegada" value={fd.ever_denied_visa_or_entry ? 'Si' : 'No'} highlight={fd.ever_denied_visa_or_entry} />
                  {fd.ever_denied_visa_or_entry && fd.denial_details && (
                    <div>
                      <p className="text-xs font-medium text-gray-500">Detalles denegacion:</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap bg-white rounded p-2 border mt-1">{fd.denial_details}</p>
                    </div>
                  )}
                </dl>
              </div>

              {/* Section 3: Petitioner Info */}
              <div className="bg-gray-50 rounded-lg p-4 md:col-span-2">
                <h3 className="text-sm font-semibold text-[#002855] mb-3 flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  Informacion del Peticionario
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <dl className="space-y-2 text-sm">
                    <InfoField label="Tipo de peticionario" value={fd.petitioner_type} />
                    <InfoField label="Nombre completo" value={fd.petitioner_full_name} />
                    <InfoField label="Relacion" value={fd.petitioner_relationship} />
                    {fd.petitioner_a_number && <InfoField label="Numero A" value={fd.petitioner_a_number} />}
                    {fd.petitioner_date_of_birth && <InfoField label="Fecha de nacimiento" value={formatDate(fd.petitioner_date_of_birth)} />}
                    {fd.petitioner_country_of_birth && <InfoField label="Pais de nacimiento" value={fd.petitioner_country_of_birth} />}
                  </dl>
                  <dl className="space-y-2 text-sm">
                    {fd.petition_receipt_number && <InfoField label="Numero de recibo" value={fd.petition_receipt_number} />}
                    {fd.petition_priority_date && <InfoField label="Fecha de prioridad" value={formatDate(fd.petition_priority_date)} />}
                    {fd.petition_category && <InfoField label="Categoria de peticion" value={fd.petition_category} />}
                  </dl>
                </div>
              </div>

              {/* Section 4: Family */}
              <div className="bg-gray-50 rounded-lg p-4 md:col-span-2">
                <h3 className="text-sm font-semibold text-[#002855] mb-3 flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  Familia
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <InfoField label="Tiene conyuge" value={fd.has_spouse ? 'Si' : 'No'} />
                    {fd.has_spouse && fd.spouse_info && (
                      <dl className="space-y-2 text-sm mt-2 pl-3 border-l-2 border-blue-200">
                        <InfoField label="Nombre" value={fd.spouse_info.spouse_full_name} />
                        {fd.spouse_info.spouse_dob && <InfoField label="DOB" value={formatDate(fd.spouse_info.spouse_dob)} />}
                        {fd.spouse_info.spouse_country_of_birth && <InfoField label="Pais de nacimiento" value={fd.spouse_info.spouse_country_of_birth} />}
                        {fd.spouse_info.spouse_a_number && <InfoField label="Numero A" value={fd.spouse_info.spouse_a_number} />}
                        {fd.spouse_info.spouse_immigration_status && <InfoField label="Estatus migratorio" value={fd.spouse_info.spouse_immigration_status} />}
                        <InfoField label="Incluido en solicitud" value={fd.spouse_info.spouse_included_in_application ? 'Si' : 'No'} />
                        {fd.spouse_info.marriage_date && <InfoField label="Fecha matrimonio" value={formatDate(fd.spouse_info.marriage_date)} />}
                        {(fd.spouse_info.marriage_city || fd.spouse_info.marriage_state) && (
                          <InfoField label="Lugar matrimonio" value={`${fd.spouse_info.marriage_city || ''}, ${fd.spouse_info.marriage_state || ''}`} />
                        )}
                      </dl>
                    )}
                  </div>
                  <div>
                    <InfoField label="Tiene hijos" value={fd.has_children ? 'Si' : 'No'} />
                    {fd.children?.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {fd.children.map((c: any, i: number) => (
                          <div key={i} className="pl-3 border-l-2 border-blue-200 text-sm space-y-1">
                            <p className="font-medium text-gray-800">Hijo/a {i + 1}: {c.child_full_name}</p>
                            <p className="text-xs text-gray-500">
                              DOB: {c.child_dob || 'N/A'} | {c.child_country_of_birth || 'N/A'} | En US: {c.child_in_us ? 'Si' : 'No'} | Incluido: {c.child_included ? 'Si' : 'No'}
                            </p>
                            {c.child_a_number && <p className="text-xs text-gray-500">A#: {c.child_a_number}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 5: Employment/Education */}
              <div className="bg-gray-50 rounded-lg p-4 md:col-span-2">
                <h3 className="text-sm font-semibold text-[#002855] mb-3 flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4" />
                  Empleo y Educacion
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    {fd.employments?.length > 0 ? (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
                          <Briefcase className="w-3 h-3" />
                          Empleos:
                        </p>
                        {fd.employments.map((e: any, i: number) => (
                          <div key={i} className="pl-3 border-l-2 border-blue-200 mb-2 text-sm">
                            <p className="font-medium text-gray-800">{e.emp_employer || 'N/A'}</p>
                            <p className="text-xs text-gray-500">
                              {e.emp_occupation || ''} | {e.emp_address || ''}, {e.emp_city || ''}, {e.emp_state || ''} | {e.emp_from || ''} - {e.emp_to || 'Presente'}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">Sin empleos registrados</p>
                    )}
                  </div>
                  <div>
                    {fd.education?.length > 0 ? (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
                          <GraduationCap className="w-3 h-3" />
                          Educacion:
                        </p>
                        {fd.education.map((e: any, i: number) => (
                          <div key={i} className="pl-3 border-l-2 border-blue-200 mb-2 text-sm">
                            <p className="font-medium text-gray-800">{e.edu_school || 'N/A'}</p>
                            <p className="text-xs text-gray-500">
                              {e.edu_type || ''} | {e.edu_address || ''} | {e.edu_from || ''} - {e.edu_to || 'Presente'}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">Sin educacion registrada</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 6: Admissibility - HIGHLIGHTED */}
              <div className="bg-red-50 rounded-lg p-4 md:col-span-2 ring-1 ring-red-200">
                <h3 className="text-sm font-semibold text-red-800 mb-3 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" />
                  Admisibilidad (SECCION CRITICA)
                </h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-3">
                    <InfoField label="Arresto criminal" value={fd.criminal_arrest ? 'SI' : 'No'} highlight={fd.criminal_arrest} />
                    {fd.criminal_arrest && fd.criminal_details && (
                      <div>
                        <p className="text-xs font-medium text-gray-500">Detalles arresto:</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap bg-white rounded p-2 border mt-1">{fd.criminal_details}</p>
                      </div>
                    )}
                    <InfoField label="Condena criminal" value={fd.criminal_conviction ? 'SI' : 'No'} highlight={fd.criminal_conviction} />
                    {fd.criminal_conviction && fd.conviction_details && (
                      <div>
                        <p className="text-xs font-medium text-gray-500">Detalles condena:</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap bg-white rounded p-2 border mt-1">{fd.conviction_details}</p>
                      </div>
                    )}
                    <InfoField label="Relacionado con drogas" value={fd.drug_related ? 'SI' : 'No'} highlight={fd.drug_related} />
                    {fd.drug_related && fd.drug_details && (
                      <div>
                        <p className="text-xs font-medium text-gray-500">Detalles drogas:</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap bg-white rounded p-2 border mt-1">{fd.drug_details}</p>
                      </div>
                    )}
                    <InfoField label="Fraude migratorio" value={fd.immigration_fraud ? 'SI' : 'No'} highlight={fd.immigration_fraud} />
                    {fd.immigration_fraud && fd.fraud_details && (
                      <div>
                        <p className="text-xs font-medium text-gray-500">Detalles fraude:</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap bg-white rounded p-2 border mt-1">{fd.fraud_details}</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <InfoField label="Falsa ciudadania EE.UU." value={fd.false_us_citizen ? 'SI' : 'No'} highlight={fd.false_us_citizen} />
                    {fd.false_us_citizen && fd.citizen_details && (
                      <div>
                        <p className="text-xs font-medium text-gray-500">Detalles ciudadania:</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap bg-white rounded p-2 border mt-1">{fd.citizen_details}</p>
                      </div>
                    )}
                    <InfoField label="Removido/deportado" value={fd.removed_deported ? 'SI' : 'No'} highlight={fd.removed_deported} />
                    {fd.removed_deported && fd.deported_details && (
                      <div>
                        <p className="text-xs font-medium text-gray-500">Detalles deportacion:</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap bg-white rounded p-2 border mt-1">{fd.deported_details}</p>
                      </div>
                    )}
                    <InfoField label="Presencia ilegal" value={fd.unlawful_presence ? 'SI' : 'No'} highlight={fd.unlawful_presence} />
                    {fd.unlawful_presence && fd.unlawful_details && (
                      <div>
                        <p className="text-xs font-medium text-gray-500">Detalles presencia ilegal:</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap bg-white rounded p-2 border mt-1">{fd.unlawful_details}</p>
                      </div>
                    )}
                    <InfoField label="Carga publica" value={fd.public_charge ? 'SI' : 'No'} highlight={fd.public_charge} />
                    {fd.public_charge && fd.public_charge_details && (
                      <div>
                        <p className="text-xs font-medium text-gray-500">Detalles carga publica:</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap bg-white rounded p-2 border mt-1">{fd.public_charge_details}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 7: Documents */}
              <div className="bg-gray-50 rounded-lg p-4 md:col-span-2">
                <h3 className="text-sm font-semibold text-[#002855] mb-3 flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />
                  Documentos y Declaracion
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <dl className="space-y-2 text-sm">
                    <InfoField label="Examen medico (I-693)" value={fd.has_medical_exam ? 'Si, tiene' : 'No tiene'} />
                    <InfoField label="Declaracion de sostenimiento (I-864)" value={fd.has_affidavit_support ? 'Si, tiene' : 'No tiene'} />
                    <InfoField label="Declaracion del solicitante" value={fd.applicant_declaration ? 'Aceptada' : 'No aceptada'} />
                  </dl>
                  <div>
                    {fd.additional_info && (
                      <div>
                        <p className="text-xs font-medium text-gray-500">Informacion adicional:</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap bg-white rounded p-2 border mt-1">{fd.additional_info}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Admin Notes */}
            <div className="mt-4 bg-blue-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-[#002855] mb-2 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4" />
                Notas del Administrador
              </h3>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Agregar notas sobre este caso..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-blue-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#002855]/30 focus:border-[#002855] bg-white"
              />
              <button
                onClick={saveNotes}
                disabled={savingNotes}
                className="mt-2 px-4 py-1.5 text-xs font-medium bg-[#002855] text-white rounded-lg hover:bg-[#001d3d] transition-colors disabled:opacity-50"
              >
                {savingNotes ? 'Guardando...' : 'Guardar Notas'}
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function InfoField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className={`text-sm ${highlight ? 'text-red-700 font-medium' : 'text-gray-700'}`}>{value}</dd>
    </div>
  )
}

function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr + 'T12:00:00'), "d 'de' MMMM yyyy", { locale: es })
  } catch {
    return dateStr
  }
}
