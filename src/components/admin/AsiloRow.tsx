'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
// Card removed — replaced by dark wrapper
import {
  Download, CheckCircle, Archive, ChevronDown, ChevronUp,
  Loader2, User, MapPin, Calendar, ShieldAlert, MessageSquare, FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { generateI589PDF } from '@/lib/pdf/i589/generate-i589'
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

export function AsiloRow({ submission }: { submission: Submission }) {
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState(submission.status)
  const [updating, setUpdating] = useState(false)
  const [notes, setNotes] = useState(submission.admin_notes || '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [downloadingI589, setDownloadingI589] = useState(false)

  const statusInfo = statusConfig[status] || statusConfig.pending
  const fd = submission.form_data

  const persecutionGrounds: string[] = fd.persecution_grounds || []

  async function handleDownloadI589() {
    setDownloadingI589(true)
    try {
      const pdfBytes = await generateI589PDF(fd)
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const safeName = submission.applicant_name.replace(/[^a-zA-Z0-9]/g, '_')
      a.download = `I-589_${safeName}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('I-589 oficial descargado')
    } catch (err) {
      console.error('Error generating I-589:', err)
      toast.error('Error al generar el I-589')
    } finally {
      setDownloadingI589(false)
    }
  }

  function handleDownloadResumen() {
    const doc = new jsPDF()
    const margin = 15
    let y = 20

    function addTitle(text: string) {
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 40, 85)
      doc.text(text, margin, y)
      y += 8
    }

    function addSubtitle(text: string) {
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
    doc.text('Resumen de Solicitud de Asilo I-589', margin, y)
    y += 8
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(`Generado: ${format(new Date(), "d 'de' MMMM yyyy, HH:mm", { locale: es })}`, margin, y)
    y += 4
    doc.text(`Enviado: ${format(new Date(submission.created_at), "d 'de' MMMM yyyy, HH:mm", { locale: es })}`, margin, y)
    y += 10

    // Section 1
    addTitle('1. Informacion Personal')
    addField('Nombre', `${fd.legal_first_name} ${fd.legal_middle_name || ''} ${fd.legal_last_name}`)
    addField('Fecha de nacimiento', fd.date_of_birth)
    addField('Lugar de nacimiento', `${fd.city_of_birth}, ${fd.country_of_birth}`)
    addField('Nacionalidad', fd.nationality)
    addField('Sexo', fd.gender)
    addField('Estado civil', fd.marital_status)
    addField('Idioma nativo', fd.native_language)
    addField('Habla ingles', fd.speaks_english ? 'Si' : 'No')
    addField('Direccion', `${fd.residence_address_street}, ${fd.residence_address_city}, ${fd.residence_address_state} ${fd.residence_address_zip}`)
    addField('Telefono', fd.residence_phone)
    y += 4

    // Section 2
    addTitle('2. Informacion de Inmigracion')
    addField('Tribunal de inmigracion', fd.immigration_court_proceedings ? 'Si' : 'No')
    addField('Fecha ultima entrada', fd.last_entry_date)
    addField('Estatus de entrada', fd.entry_status)
    addField('Lugar de entrada', fd.entry_place)
    addField('Pasaporte', `${fd.passport_number} (${fd.passport_country})`)
    if (fd.a_number) addField('Numero A', fd.a_number)
    y += 4

    // Section 3
    addTitle('3. Conyuge e Hijos')
    addField('Tiene conyuge', fd.has_spouse ? 'Si' : 'No')
    if (fd.has_spouse && fd.spouse_info) {
      const sp = fd.spouse_info
      addField('Conyuge', `${sp.spouse_first_name} ${sp.spouse_last_name}`)
      addField('Fecha matrimonio', sp.marriage_date)
      addField('Incluir en solicitud', sp.spouse_include_in_application ? 'Si' : 'No')
    }
    addField('Tiene hijos', fd.has_children ? 'Si' : 'No')
    if (fd.children?.length > 0) {
      fd.children.forEach((c: any, i: number) => {
        addField(`Hijo/a ${i + 1}`, `${c.child_first_name} ${c.child_last_name} - ${c.child_country_of_birth} - DOB: ${c.child_dob}`)
      })
    }
    y += 4

    // Section 4
    if (y > 240) { doc.addPage(); y = 20 }
    addTitle('4. Historial')
    if (fd.residences_last_5_years?.length > 0) {
      addSubtitle('Residencias ultimos 5 anos')
      fd.residences_last_5_years.forEach((r: any, i: number) => {
        addField(`Residencia ${i + 1}`, `${r.res_address}, ${r.res_city}, ${r.res_country} (${r.res_from} - ${r.res_to})`)
      })
    }
    if (fd.employment_last_5_years?.length > 0) {
      addSubtitle('Empleos ultimos 5 anos')
      fd.employment_last_5_years.forEach((e: any, i: number) => {
        addField(`Empleo ${i + 1}`, `${e.emp_employer} - ${e.emp_occupation} (${e.emp_from} - ${e.emp_to})`)
      })
    }
    addField('Madre', `${fd.mother_name || 'N/A'} - ${fd.mother_country_of_birth || ''} ${fd.mother_deceased ? '(Fallecida)' : ''}`)
    addField('Padre', `${fd.father_name || 'N/A'} - ${fd.father_country_of_birth || ''} ${fd.father_deceased ? '(Fallecido)' : ''}`)
    y += 4

    // Section 5 - MOST IMPORTANT
    if (y > 200) { doc.addPage(); y = 20 }
    addTitle('5. Historia de Persecucion (SECCION PRINCIPAL)')
    addField('Bases de persecucion', persecutionGrounds.join(', '))
    addField('Sufrio dano pasado', fd.past_harm ? 'Si' : 'No')
    if (fd.past_harm) addLongText('Descripcion del dano', fd.past_harm_description)
    addField('Miedo de regresar', fd.fear_of_return ? 'Si' : 'No')
    if (fd.fear_of_return) addLongText('Descripcion del miedo', fd.fear_description)
    addLongText('Perpetradores', fd.harm_perpetrators)
    addField('Reporto a autoridades', fd.reported_to_authorities ? 'Si' : 'No')
    if (fd.reported_to_authorities) addLongText('Respuesta autoridades', fd.authority_response)
    if (!fd.reported_to_authorities) addLongText('Por que no reporto', fd.why_not_reported)
    y += 4

    // Section 6
    if (y > 240) { doc.addPage(); y = 20 }
    addTitle('6. Informacion Adicional')
    addField('Solicitud previa de asilo', fd.prior_asylum_application ? 'Si' : 'No')
    addField('Arrestado/detenido', fd.arrested_detained ? 'Si' : 'No')
    addField('Causo dano a otros', fd.caused_harm ? 'Si' : 'No')
    addField('Puede regresar a otro pais', fd.return_other_country ? 'Si' : 'No')
    addField('Convencion contra tortura', fd.convention_against_torture ? 'Si' : 'No')
    y += 4

    // Section 7
    if (y > 240) { doc.addPage(); y = 20 }
    addTitle('7. Historial de Viajes')
    addLongText('Viaje a EE.UU.', fd.travel_to_us)
    if (fd.countries_visited?.length > 0) {
      addSubtitle('Paises visitados')
      fd.countries_visited.forEach((cv: any, i: number) => {
        addField(`Pais ${i + 1}`, `${cv.country} - ${cv.duration} - ${cv.purpose}`)
      })
    }

    const safeName = submission.applicant_name.replace(/[^a-zA-Z0-9]/g, '_')
    doc.save(`resumen_asilo_${safeName}.pdf`)
    toast.success('Resumen PDF descargado')
  }

  async function updateStatus(newStatus: string) {
    setUpdating(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('asilo_submissions')
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
        .from('asilo_submissions')
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

  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: 'var(--admin-panel-grad)',
        border: status === 'pending' ? '0.5px solid rgba(250,204,21,0.3)' : '0.5px solid var(--admin-border-strong)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <div>
        {/* Header row */}
        <div
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate" style={{ color: 'var(--admin-fg)' }}>{submission.applicant_name}</p>
              <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: 'var(--admin-fg-muted)' }}>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {submission.country_of_birth}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(submission.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                </span>
                {persecutionGrounds.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {persecutionGrounds.map(g => (
                      <Badge key={g} className="bg-indigo-50 text-indigo-700 text-[10px] px-1.5 py-0">{g}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge className={statusInfo.class}>{statusInfo.label}</Badge>
            {expanded ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--admin-fg-subtle)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--admin-fg-subtle)' }} />}
          </div>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="border-t px-4 pb-4">
            {/* Action buttons */}
            <div className="flex items-center gap-2 py-3 border-b mb-4 flex-wrap">
              <button
                onClick={handleDownloadI589}
                disabled={downloadingI589}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {downloadingI589 ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Descargar I-589 Oficial
              </button>
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
              {/* Section 1-2: Info Personal + Inmigracion */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-[#002855] mb-3 flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  Informacion Personal
                </h3>
                <dl className="space-y-2 text-sm">
                  <InfoField label="Nombre" value={`${fd.legal_first_name} ${fd.legal_middle_name || ''} ${fd.legal_last_name}`} />
                  <InfoField label="Fecha de nacimiento" value={formatDate(fd.date_of_birth)} />
                  <InfoField label="Lugar de nacimiento" value={`${fd.city_of_birth}, ${fd.country_of_birth}`} />
                  <InfoField label="Nacionalidad" value={fd.nationality} />
                  <InfoField label="Sexo" value={fd.gender} />
                  <InfoField label="Estado civil" value={fd.marital_status} />
                  <InfoField label="Idioma nativo" value={fd.native_language} />
                  <InfoField label="Habla ingles" value={fd.speaks_english ? 'Si' : 'No'} />
                  <InfoField label="Religion" value={fd.religion || 'N/A'} />
                  <InfoField label="Raza/etnicidad" value={fd.race_ethnicity || 'N/A'} />
                  <InfoField label="Telefono" value={fd.residence_phone} />
                  <InfoField label="Direccion" value={`${fd.residence_address_street}, ${fd.residence_address_city}, ${fd.residence_address_state} ${fd.residence_address_zip}`} />
                </dl>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-[#002855] mb-3 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  Informacion de Inmigracion
                </h3>
                <dl className="space-y-2 text-sm">
                  <InfoField label="Tribunal de inmigracion" value={fd.immigration_court_proceedings ? 'Si' : 'No'} />
                  <InfoField label="Fecha ultima entrada" value={formatDate(fd.last_entry_date)} highlight />
                  <InfoField label="Estatus de entrada" value={fd.entry_status} />
                  <InfoField label="Lugar de entrada" value={fd.entry_place} />
                  <InfoField label="Pasaporte" value={`${fd.passport_number || 'N/A'} (${fd.passport_country || ''})`} />
                  {fd.a_number && <InfoField label="Numero A" value={fd.a_number} />}
                  {fd.ssn && <InfoField label="SSN" value={fd.ssn} />}
                  {fd.i94_number && <InfoField label="I-94" value={fd.i94_number} />}
                </dl>
              </div>

              {/* Section 3: Conyuge e Hijos */}
              <div className="bg-gray-50 rounded-lg p-4 md:col-span-2">
                <h3 className="text-sm font-semibold text-[#002855] mb-3 flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  Conyuge e Hijos
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <InfoField label="Tiene conyuge" value={fd.has_spouse ? 'Si' : 'No'} />
                    {fd.has_spouse && fd.spouse_info && (
                      <dl className="space-y-2 text-sm mt-2 pl-3 border-l-2 border-indigo-200">
                        <InfoField label="Nombre" value={`${fd.spouse_info.spouse_first_name} ${fd.spouse_info.spouse_last_name}`} />
                        <InfoField label="DOB" value={fd.spouse_info.spouse_dob} />
                        <InfoField label="Nacionalidad" value={fd.spouse_info.spouse_nationality} />
                        <InfoField label="En EE.UU." value={fd.spouse_info.spouse_in_us ? 'Si' : 'No'} />
                        <InfoField label="Incluir en solicitud" value={fd.spouse_info.spouse_include_in_application ? 'Si' : 'No'} />
                        <InfoField label="Matrimonio" value={`${fd.spouse_info.marriage_date} - ${fd.spouse_info.marriage_place}`} />
                      </dl>
                    )}
                  </div>
                  <div>
                    <InfoField label="Tiene hijos" value={fd.has_children ? 'Si' : 'No'} />
                    {fd.children?.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {fd.children.map((c: any, i: number) => (
                          <div key={i} className="pl-3 border-l-2 border-indigo-200 text-sm space-y-1">
                            <p className="font-medium text-gray-800">Hijo/a {i + 1}: {c.child_first_name} {c.child_last_name}</p>
                            <p className="text-xs text-gray-500">DOB: {c.child_dob} | {c.child_country_of_birth} | {c.child_gender} | En US: {c.child_in_us ? 'Si' : 'No'} | Incluir: {c.child_include_in_application ? 'Si' : 'No'}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 4: Historial */}
              <div className="bg-gray-50 rounded-lg p-4 md:col-span-2">
                <h3 className="text-sm font-semibold text-[#002855] mb-3">Historial de Residencia, Empleo y Familia</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    {fd.last_address_before_us && (
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-gray-500 mb-1">Ultima direccion antes de EE.UU.:</p>
                        <p className="text-sm text-gray-700">{fd.last_address_before_us.street}, {fd.last_address_before_us.city}, {fd.last_address_before_us.country}</p>
                      </div>
                    )}
                    {fd.residences_last_5_years?.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-gray-500 mb-1">Residencias (5 anos):</p>
                        {fd.residences_last_5_years.map((r: any, i: number) => (
                          <p key={i} className="text-xs text-gray-600">{r.res_address}, {r.res_city}, {r.res_country} ({r.res_from} - {r.res_to})</p>
                        ))}
                      </div>
                    )}
                    {fd.employment_last_5_years?.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-gray-500 mb-1">Empleos (5 anos):</p>
                        {fd.employment_last_5_years.map((e: any, i: number) => (
                          <p key={i} className="text-xs text-gray-600">{e.emp_employer} - {e.emp_occupation} ({e.emp_from} - {e.emp_to})</p>
                        ))}
                      </div>
                    )}
                    {fd.education?.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-gray-500 mb-1">Educacion:</p>
                        {fd.education.map((e: any, i: number) => (
                          <p key={i} className="text-xs text-gray-600">{e.edu_school} - {e.edu_type} ({e.edu_from} - {e.edu_to})</p>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">Familia:</p>
                    <dl className="space-y-1.5 text-sm">
                      <InfoField label="Madre" value={`${fd.mother_name || 'N/A'} - ${fd.mother_country_of_birth || ''} ${fd.mother_deceased ? '(Fallecida)' : fd.mother_current_location ? `- ${fd.mother_current_location}` : ''}`} />
                      <InfoField label="Padre" value={`${fd.father_name || 'N/A'} - ${fd.father_country_of_birth || ''} ${fd.father_deceased ? '(Fallecido)' : fd.father_current_location ? `- ${fd.father_current_location}` : ''}`} />
                    </dl>
                    {fd.siblings?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-gray-500 mb-1">Hermanos/as:</p>
                        {fd.siblings.map((s: any, i: number) => (
                          <p key={i} className="text-xs text-gray-600">{s.sibling_name} - {s.sibling_country_of_birth} {s.sibling_deceased ? '(Fallecido/a)' : `- ${s.sibling_current_location}`}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 5: Persecucion - MOST IMPORTANT */}
              <div className="bg-red-50 rounded-lg p-4 md:col-span-2 ring-1 ring-red-200">
                <h3 className="text-sm font-semibold text-red-800 mb-3 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" />
                  Historia de Persecucion (SECCION PRINCIPAL)
                </h3>
                <div className="flex gap-2 mb-3 flex-wrap">
                  {persecutionGrounds.map(g => (
                    <Badge key={g} className="bg-red-100 text-red-800">{g}</Badge>
                  ))}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-3">
                    <InfoField label="Sufrio dano pasado" value={fd.past_harm ? 'Si' : 'No'} />
                    {fd.past_harm && (
                      <div>
                        <p className="text-xs font-medium text-gray-500">Descripcion del dano:</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap bg-white rounded p-2 border mt-1">{fd.past_harm_description}</p>
                      </div>
                    )}
                    <InfoField label="Miedo de regresar" value={fd.fear_of_return ? 'Si' : 'No'} />
                    {fd.fear_of_return && (
                      <div>
                        <p className="text-xs font-medium text-gray-500">Descripcion del miedo:</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap bg-white rounded p-2 border mt-1">{fd.fear_description}</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-gray-500">Perpetradores:</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap bg-white rounded p-2 border mt-1">{fd.harm_perpetrators}</p>
                    </div>
                    <InfoField label="Reporto a autoridades" value={fd.reported_to_authorities ? 'Si' : 'No'} />
                    {fd.reported_to_authorities && fd.authority_response && (
                      <div>
                        <p className="text-xs font-medium text-gray-500">Respuesta de autoridades:</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap bg-white rounded p-2 border mt-1">{fd.authority_response}</p>
                      </div>
                    )}
                    {!fd.reported_to_authorities && fd.why_not_reported && (
                      <div>
                        <p className="text-xs font-medium text-gray-500">Por que no reporto:</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap bg-white rounded p-2 border mt-1">{fd.why_not_reported}</p>
                      </div>
                    )}
                    {fd.organization_membership && <InfoField label="Membresia organizaciones" value={fd.organization_membership} />}
                  </div>
                </div>
              </div>

              {/* Section 6-7: Adicional + Viajes */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-[#002855] mb-3">Informacion Adicional</h3>
                <dl className="space-y-2 text-sm">
                  <InfoField label="Solicitud previa asilo" value={fd.prior_asylum_application ? `Si — ${fd.prior_asylum_details || ''}` : 'No'} />
                  <InfoField label="Arrestado/detenido" value={fd.arrested_detained ? `Si — ${fd.arrested_details || ''}` : 'No'} highlight={fd.arrested_detained} />
                  <InfoField label="Causo dano a otros" value={fd.caused_harm ? `Si — ${fd.caused_harm_details || ''}` : 'No'} highlight={fd.caused_harm} />
                  <InfoField label="Regresar a otro pais" value={fd.return_other_country ? 'Si' : 'No'} />
                  <InfoField label="CAT" value={fd.convention_against_torture ? 'Si' : 'No'} />
                  <InfoField label="Afiliacion gov EE.UU." value={fd.us_government_affiliation ? `Si — ${fd.us_government_details || ''}` : 'No'} />
                </dl>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-[#002855] mb-3">Historial de Viajes</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-xs font-medium text-gray-500">Viaje a EE.UU.:</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap mt-0.5">{fd.travel_to_us}</p>
                  </div>
                  {fd.countries_visited?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mt-2">Paises visitados:</p>
                      {fd.countries_visited.map((cv: any, i: number) => (
                        <p key={i} className="text-xs text-gray-600">{cv.country} - {cv.duration} - {cv.purpose}</p>
                      ))}
                    </div>
                  )}
                  <InfoField label="Asilo en otro pais" value={fd.applied_asylum_other_country ? `Si — ${fd.other_country_asylum_details || ''}` : 'No'} />
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
      </div>
    </div>
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
