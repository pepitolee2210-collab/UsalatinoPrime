'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
// Card removed — replaced by dark-themed div wrapper below
import {
  Download, CheckCircle, Archive, ChevronDown, ChevronUp,
  Loader2, User, MapPin, Calendar, AlertTriangle, ShieldAlert, MessageSquare, Baby,
} from 'lucide-react'
import { toast } from 'sonner'
import { generateVisaJuvenilPDF, type VisaJuvenilPDFInput } from '@/lib/pdf/generate-visa-juvenil-pdf'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Submission {
  id: string
  created_at: string
  minor_first_name: string
  minor_last_name: string
  minor_middle_name: string | null
  minor_dob: string
  minor_age: number
  minor_gender: string
  minor_country_of_birth: string
  minor_nationality: string
  minor_native_language: string
  minor_speaks_english: boolean
  minor_current_address: string
  minor_city: string
  minor_state: string
  minor_zip: string
  minor_phone: string | null
  minor_email: string | null
  minor_entry_date: string
  minor_entry_manner: string
  minor_a_number: string | null
  minor_in_removal: boolean
  minor_current_guardian: string
  minor_guardian_relationship: string
  minor_school_enrolled: boolean
  minor_school_name: string | null
  minor_grade: string | null
  father_first_name: string | null
  father_last_name: string | null
  father_dob: string | null
  father_country_of_birth: string | null
  father_location: string | null
  father_relationship_status: string | null
  father_abuse_neglect: boolean
  father_abuse_details: string | null
  mother_first_name: string | null
  mother_last_name: string | null
  mother_dob: string | null
  mother_country_of_birth: string | null
  mother_location: string | null
  mother_relationship_status: string | null
  mother_abuse_neglect: boolean
  mother_abuse_details: string | null
  parents_marital_status: string | null
  reunification_viable: boolean
  reunification_explanation: string
  abuse_types: string
  abuse_narrative: string
  abuse_start_date: string
  abuse_ongoing: string
  abuse_reported: boolean
  abuse_report_details: string | null
  therapy_received: boolean
  therapy_details: string | null
  state_court_involved: boolean
  state_court_details: string | null
  state_court_state: string | null
  best_interest_in_us: string
  status: string
  admin_notes: string | null
}

const statusConfig: Record<string, { label: string; class: string }> = {
  pending: { label: 'Pendiente', class: 'bg-amber-100 text-amber-800' },
  reviewed: { label: 'Revisado', class: 'bg-green-100 text-green-800' },
  archived: { label: 'Archivado', class: 'bg-gray-100 text-gray-600' },
}

export function VisaJuvenilRow({ submission }: { submission: Submission }) {
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState(submission.status)
  const [updating, setUpdating] = useState(false)
  const [notes, setNotes] = useState(submission.admin_notes || '')
  const [savingNotes, setSavingNotes] = useState(false)

  const statusInfo = statusConfig[status] || statusConfig.pending
  const minorName = `${submission.minor_first_name} ${submission.minor_last_name}`

  function handleDownloadPDF() {
    const pdfInput: VisaJuvenilPDFInput = {
      minor_first_name: submission.minor_first_name,
      minor_last_name: submission.minor_last_name,
      minor_middle_name: submission.minor_middle_name || '',
      minor_dob: submission.minor_dob,
      minor_age: submission.minor_age,
      minor_gender: submission.minor_gender,
      minor_country_of_birth: submission.minor_country_of_birth,
      minor_nationality: submission.minor_nationality,
      minor_native_language: submission.minor_native_language,
      minor_speaks_english: submission.minor_speaks_english,
      minor_current_address: submission.minor_current_address,
      minor_city: submission.minor_city,
      minor_state: submission.minor_state,
      minor_zip: submission.minor_zip,
      minor_phone: submission.minor_phone || '',
      minor_email: submission.minor_email || '',
      minor_entry_date: submission.minor_entry_date,
      minor_entry_manner: submission.minor_entry_manner,
      minor_a_number: submission.minor_a_number || '',
      minor_in_removal: submission.minor_in_removal,
      minor_current_guardian: submission.minor_current_guardian,
      minor_guardian_relationship: submission.minor_guardian_relationship,
      minor_school_enrolled: submission.minor_school_enrolled,
      minor_school_name: submission.minor_school_name || '',
      minor_grade: submission.minor_grade || '',
      father_first_name: submission.father_first_name || '',
      father_last_name: submission.father_last_name || '',
      father_dob: submission.father_dob || '',
      father_country_of_birth: submission.father_country_of_birth || '',
      father_location: submission.father_location || '',
      father_relationship_status: submission.father_relationship_status || '',
      father_abuse_neglect: submission.father_abuse_neglect,
      father_abuse_details: submission.father_abuse_details || '',
      mother_first_name: submission.mother_first_name || '',
      mother_last_name: submission.mother_last_name || '',
      mother_dob: submission.mother_dob || '',
      mother_country_of_birth: submission.mother_country_of_birth || '',
      mother_location: submission.mother_location || '',
      mother_relationship_status: submission.mother_relationship_status || '',
      mother_abuse_neglect: submission.mother_abuse_neglect,
      mother_abuse_details: submission.mother_abuse_details || '',
      parents_marital_status: submission.parents_marital_status || '',
      reunification_viable: submission.reunification_viable,
      reunification_explanation: submission.reunification_explanation,
      abuse_types: submission.abuse_types,
      abuse_narrative: submission.abuse_narrative,
      abuse_start_date: submission.abuse_start_date,
      abuse_ongoing: submission.abuse_ongoing,
      abuse_reported: submission.abuse_reported,
      abuse_report_details: submission.abuse_report_details || '',
      therapy_received: submission.therapy_received,
      therapy_details: submission.therapy_details || '',
      state_court_involved: submission.state_court_involved,
      state_court_details: submission.state_court_details || '',
      state_court_state: submission.state_court_state || '',
      best_interest_in_us: submission.best_interest_in_us,
      created_at: submission.created_at,
    }
    const doc = generateVisaJuvenilPDF(pdfInput)
    const safeName = minorName.replace(/[^a-zA-Z0-9]/g, '_')
    doc.save(`visa_juvenil_${safeName}.pdf`)
    toast.success('PDF descargado')
  }

  async function updateStatus(newStatus: string) {
    setUpdating(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('visa_juvenil_submissions')
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
        .from('visa_juvenil_submissions')
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
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Baby className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 truncate">{minorName}</p>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {submission.minor_country_of_birth}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(submission.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                </span>
                <span className="text-gray-400">{submission.minor_age} anos</span>
                {(submission.father_abuse_neglect || submission.mother_abuse_neglect) && (
                  <span className="flex items-center gap-1 text-red-600 font-medium">
                    <AlertTriangle className="w-3 h-3" />
                    Abuso reportado
                  </span>
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
            <div className="flex items-center gap-2 py-3 border-b mb-4">
              <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#002855] text-white rounded-lg hover:bg-[#001d3d] transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar PDF
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

            {/* 3 sections of info */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Section 1: Info del menor */}
              <div className="bg-gray-50 rounded-lg p-4 md:col-span-2">
                <h3 className="text-sm font-semibold text-[#002855] mb-3 flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  Informacion del Menor
                </h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <dl className="space-y-2 text-sm">
                    <InfoField label="Nombre completo" value={minorName} />
                    <InfoField label="Fecha de nacimiento" value={formatDate(submission.minor_dob)} />
                    <InfoField label="Edad" value={`${submission.minor_age} anos`} />
                    <InfoField label="Sexo" value={submission.minor_gender} />
                    <InfoField label="Pais de nacimiento" value={submission.minor_country_of_birth} />
                    <InfoField label="Nacionalidad" value={submission.minor_nationality} />
                    <InfoField label="Idioma nativo" value={submission.minor_native_language} />
                    <InfoField label="Habla ingles" value={submission.minor_speaks_english ? 'Si' : 'No'} />
                  </dl>
                  <dl className="space-y-2 text-sm">
                    <InfoField label="Direccion" value={`${submission.minor_current_address}, ${submission.minor_city}, ${submission.minor_state} ${submission.minor_zip}`} />
                    {submission.minor_phone && <InfoField label="Telefono" value={submission.minor_phone} />}
                    {submission.minor_email && <InfoField label="Email" value={submission.minor_email} />}
                    <InfoField label="Fecha de entrada" value={formatDate(submission.minor_entry_date)} />
                    <InfoField label="Manera de entrada" value={submission.minor_entry_manner} />
                    {submission.minor_a_number && <InfoField label="Numero A" value={submission.minor_a_number} />}
                    <InfoField label="En deportacion" value={submission.minor_in_removal ? 'Si' : 'No'} highlight={submission.minor_in_removal} />
                    <InfoField label="Guardian" value={`${submission.minor_current_guardian} (${submission.minor_guardian_relationship})`} />
                    {submission.minor_school_enrolled && (
                      <InfoField label="Escuela" value={`${submission.minor_school_name || ''} - ${submission.minor_grade || ''}`} />
                    )}
                  </dl>
                </div>
              </div>

              {/* Section 2: Padres */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-[#002855] mb-3 flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  Informacion del Padre
                </h3>
                <dl className="space-y-2 text-sm">
                  <InfoField label="Nombre" value={[submission.father_first_name, submission.father_last_name].filter(Boolean).join(' ') || 'No proporcionado'} />
                  {submission.father_dob && <InfoField label="Fecha de nacimiento" value={submission.father_dob} />}
                  {submission.father_country_of_birth && <InfoField label="Pais" value={submission.father_country_of_birth} />}
                  {submission.father_location && <InfoField label="Ubicacion" value={submission.father_location} />}
                  {submission.father_relationship_status && <InfoField label="Relacion" value={submission.father_relationship_status} />}
                  <InfoField label="Abuso/negligencia" value={submission.father_abuse_neglect ? `Si — ${submission.father_abuse_details || ''}` : 'No'} highlight={submission.father_abuse_neglect} />
                </dl>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-[#002855] mb-3 flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  Informacion de la Madre
                </h3>
                <dl className="space-y-2 text-sm">
                  <InfoField label="Nombre" value={[submission.mother_first_name, submission.mother_last_name].filter(Boolean).join(' ') || 'No proporcionado'} />
                  {submission.mother_dob && <InfoField label="Fecha de nacimiento" value={submission.mother_dob} />}
                  {submission.mother_country_of_birth && <InfoField label="Pais" value={submission.mother_country_of_birth} />}
                  {submission.mother_location && <InfoField label="Ubicacion" value={submission.mother_location} />}
                  {submission.mother_relationship_status && <InfoField label="Relacion" value={submission.mother_relationship_status} />}
                  <InfoField label="Abuso/negligencia" value={submission.mother_abuse_neglect ? `Si — ${submission.mother_abuse_details || ''}` : 'No'} highlight={submission.mother_abuse_neglect} />
                </dl>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 md:col-span-2">
                <dl className="space-y-2 text-sm">
                  {submission.parents_marital_status && <InfoField label="Estado civil padres" value={submission.parents_marital_status} />}
                  <InfoField label="Reunificacion viable" value={submission.reunification_viable ? 'Si' : 'No'} />
                  <div>
                    <p className="text-xs font-medium text-gray-500">Explicacion de reunificacion:</p>
                    <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">{submission.reunification_explanation}</p>
                  </div>
                </dl>
              </div>

              {/* Section 3: Abuso */}
              <div className={`bg-gray-50 rounded-lg p-4 md:col-span-2 ${(submission.father_abuse_neglect || submission.mother_abuse_neglect) ? 'ring-1 ring-red-200' : ''}`}>
                <h3 className="text-sm font-semibold text-[#002855] mb-3 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" />
                  Historia de Abuso / Negligencia
                </h3>
                <dl className="space-y-2 text-sm">
                  <InfoField label="Tipos de maltrato" value={submission.abuse_types} highlight />
                  <div>
                    <p className="text-xs font-medium text-gray-500">Narrativa del abuso:</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap bg-white rounded p-2 border mt-1">{submission.abuse_narrative}</p>
                  </div>
                  <InfoField label="Cuando comenzo" value={submission.abuse_start_date} />
                  <InfoField label="Estado actual" value={submission.abuse_ongoing} />
                  <InfoField label="Reportado" value={submission.abuse_reported ? `Si — ${submission.abuse_report_details || ''}` : 'No'} />
                  <InfoField label="Terapia" value={submission.therapy_received ? `Si — ${submission.therapy_details || ''}` : 'No'} />
                  <InfoField label="Tribunal estatal" value={submission.state_court_involved ? `Si — ${submission.state_court_details || ''} (${submission.state_court_state || ''})` : 'No'} />
                  <div>
                    <p className="text-xs font-medium text-gray-500">Mejor interes en EE.UU.:</p>
                    <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">{submission.best_interest_in_us}</p>
                  </div>
                </dl>
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
