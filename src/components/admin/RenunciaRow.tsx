'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Download, CheckCircle, ChevronDown, ChevronUp,
  Loader2, User, Calendar, MessageSquare, FileText,
  Trash2, Search, XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import jsPDF from 'jspdf'

interface Submission {
  id: string
  created_at: string
  status: string
  admin_notes: string | null
  mother_full_name: string
  mother_nationality: string
  mother_dni: string
  mother_address: string
  daughter_full_name: string
  daughter_dob: string
  daughter_birth_certificate_municipality: string
  father_full_name: string
  father_passport: string
  father_country_state: string
  father_address_with_daughter: string
}

const statusConfig: Record<string, { label: string; class: string }> = {
  nuevo: { label: 'Nuevo', class: 'bg-amber-100 text-amber-800' },
  en_revision: { label: 'En Revision', class: 'bg-blue-100 text-blue-800' },
  aprobado: { label: 'Aprobado', class: 'bg-green-100 text-green-800' },
  rechazado: { label: 'Rechazado', class: 'bg-red-100 text-red-800' },
}

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function formatDateEnglish(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T12:00:00')
    if (isNaN(d.getTime())) return dateStr
    return `${MONTHS_EN[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
  } catch {
    return dateStr
  }
}

export function RenunciaRow({ submission }: { submission: Submission }) {
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState(submission.status)
  const [updating, setUpdating] = useState(false)
  const [notes, setNotes] = useState(submission.admin_notes || '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const statusInfo = statusConfig[status] || statusConfig.nuevo

  function handleDownloadPDF() {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 20
    const contentWidth = pageWidth - margin * 2
    let y = margin

    const NAVY: [number, number, number] = [0, 40, 85]
    const BODY_COLOR: [number, number, number] = [40, 40, 40]
    const BODY_SIZE = 9.5
    const FONT = 'helvetica'

    function bodyStyle() {
      doc.setFont(FONT, 'normal')
      doc.setFontSize(BODY_SIZE)
      doc.setTextColor(...BODY_COLOR)
    }

    function checkPageBreak(neededSpace: number) {
      if (y + neededSpace > pageHeight - 25) {
        addFooter()
        doc.addPage()
        y = margin
      }
    }

    function addFooter() {
      doc.setFont(FONT, 'normal')
      doc.setFontSize(7)
      doc.setTextColor(160, 160, 160)
      doc.text('UsaLatinoPrime - Voluntary Relinquishment of Parental Custody', margin, pageHeight - 12)
      const genDate = new Date().toLocaleString('es-US')
      doc.text(`Generated: ${genDate}`, pageWidth - margin, pageHeight - 12, { align: 'right' })
      doc.setDrawColor(230, 230, 230)
      doc.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16)
    }

    function paragraph(text: string) {
      bodyStyle()
      const lines = doc.splitTextToSize(text, contentWidth - 4)
      checkPageBreak(lines.length * 4.5 + 5)
      doc.text(lines, margin + 2, y)
      y += lines.length * 4.5 + 4
    }

    // === HEADER ===
    doc.setFont(FONT, 'normal')
    doc.setFontSize(18)
    doc.setTextColor(...NAVY)
    doc.text('UsaLatinoPrime', margin, y)
    y += 8

    // Gold line
    doc.setDrawColor(242, 169, 0)
    doc.setLineWidth(0.8)
    doc.line(margin, y, pageWidth - margin, y)
    y += 10

    // Title
    doc.setFont(FONT, 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...NAVY)
    doc.text('VOLUNTARY RELINQUISHMENT OF PARENTAL CUSTODY', pageWidth / 2, y, { align: 'center' })
    y += 7
    doc.setFontSize(10)
    doc.setFont(FONT, 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text('(For guardianship proceedings in the State of Utah, United States)', pageWidth / 2, y, { align: 'center' })
    y += 12

    // Date info
    const dobFormatted = formatDateEnglish(submission.daughter_dob)
    const now = new Date()
    const currentDay = now.getDate()
    const currentMonth = MONTHS_EN[now.getMonth()]
    const currentYear = now.getFullYear()

    // Main declaration paragraph
    paragraph(
      `I, ${submission.mother_full_name}, identified with Peruvian National Identity Document (DNI) No. ${submission.mother_dni}, ` +
      `born in ${submission.mother_nationality}, currently residing at ${submission.mother_address}, ` +
      `being of sound mind and acting voluntarily, knowingly, and without coercion, hereby state and affirm the following:`
    )

    y += 4

    // I DECLARE AND STATE
    doc.setFont(FONT, 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...NAVY)
    checkPageBreak(10)
    doc.text('I DECLARE AND STATE:', margin, y)
    y += 8

    // Point 1
    paragraph(
      `1. That I am the biological mother of ${submission.daughter_full_name}, born on ${dobFormatted}, ` +
      `in ${submission.daughter_birth_certificate_municipality}, as recorded in her birth certificate issued by the ` +
      `${submission.daughter_birth_certificate_municipality}.`
    )

    // Point 2
    paragraph(
      `2. That the biological father of my daughter is ${submission.father_full_name}, holder of Peruvian passport no. ` +
      `${submission.father_passport}, currently residing in the State of ${submission.father_country_state}.`
    )

    // Point 3
    paragraph(
      `3. That due to personal and family circumstances, I made the decision to leave Peru, leaving my daughter ` +
      `${submission.daughter_full_name} in the care and custody of her father, who has been her primary caregiver since ` +
      `${currentYear}. She currently resides with him at ${submission.father_address_with_daughter}.`
    )

    // Point 4
    paragraph(
      `4. I acknowledge that Mr. ${submission.father_full_name} has assumed exclusive legal guardianship and primary ` +
      `caregiver responsibilities for our daughter. I currently do not exercise, nor am I able to exercise, parental ` +
      `custody or responsibilities, as I reside outside the country and our family relationship has been irreparably severed.`
    )

    // Point 5
    paragraph(
      `5. I voluntarily and permanently relinquish all physical and legal custody rights over my daughter, ` +
      `${submission.daughter_full_name}, and do not object to her father petitioning the juvenile court of the State of Utah ` +
      `for exclusive legal guardianship, as part of a request for Special Immigrant Juvenile Status (SIJS).`
    )

    // Point 6
    paragraph(
      `6. That this decision is made in the best interest of my daughter, ensuring her protection, emotional stability, ` +
      `and continuity in her academic and personal development.`
    )

    y += 6

    // THEREFORE
    doc.setFont(FONT, 'bold')
    doc.setFontSize(BODY_SIZE)
    doc.setTextColor(...BODY_COLOR)
    checkPageBreak(10)
    paragraph(
      `THEREFORE, I sign this document in full understanding of its content and legal consequences, intending it to ` +
      `take effect before all appropriate authorities.`
    )

    y += 4
    bodyStyle()
    checkPageBreak(8)
    doc.text(`In the city of Lima, Peru, on the ${currentDay} of ${currentMonth}, ${currentYear}.`, margin + 2, y)
    y += 16

    // Signature area
    checkPageBreak(30)
    doc.text('Signature: _________________________', margin + 2, y)
    y += 8
    doc.setFont(FONT, 'bold')
    doc.text(submission.mother_full_name, margin + 2, y)
    y += 6
    bodyStyle()
    doc.text(`DNI: ${submission.mother_dni}`, margin + 2, y)

    // Footer
    addFooter()

    const safeName = submission.mother_full_name.replace(/[^a-zA-Z0-9]/g, '_')
    doc.save(`renuncia_custodia_${safeName}.pdf`)
    toast.success('PDF de renuncia descargado')
  }

  async function updateStatus(newStatus: string) {
    setUpdating(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('renuncia_submissions')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
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
        .from('renuncia_submissions')
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

  async function handleDelete() {
    if (!confirm('Esta seguro de eliminar este formulario? Esta accion no se puede deshacer.')) return
    setDeleting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('renuncia_submissions')
        .delete()
        .eq('id', submission.id)

      if (error) {
        toast.error('Error al eliminar')
        return
      }
      toast.success('Formulario eliminado')
      window.location.reload()
    } catch {
      toast.error('Error de conexion')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card className={status === 'nuevo' ? 'border-amber-200' : ''}>
      <CardContent className="p-0">
        {/* Header row */}
        <div
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 truncate">{submission.mother_full_name}</p>
              <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  Hija: {submission.daughter_full_name}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(submission.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                </span>
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
                onClick={handleDownloadPDF}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#002855] text-white rounded-lg hover:bg-[#001d3d] transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar PDF
              </button>
              {status !== 'en_revision' && (
                <button
                  onClick={() => updateStatus('en_revision')}
                  disabled={updating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  En Revision
                </button>
              )}
              {status !== 'aprobado' && (
                <button
                  onClick={() => updateStatus('aprobado')}
                  disabled={updating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  Aprobar
                </button>
              )}
              {status !== 'rechazado' && (
                <button
                  onClick={() => updateStatus('rechazado')}
                  disabled={updating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                  Rechazar
                </button>
              )}
              {status !== 'nuevo' && (
                <button
                  onClick={() => updateStatus('nuevo')}
                  disabled={updating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Volver a Nuevo
                </button>
              )}
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50 ml-auto"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Eliminar
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Datos de la Madre */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-[#002855] mb-3 flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  Datos de la Madre
                </h3>
                <dl className="space-y-2 text-sm">
                  <InfoField label="Nombre completo" value={submission.mother_full_name} />
                  <InfoField label="Nacionalidad" value={submission.mother_nationality} />
                  <InfoField label="DNI" value={submission.mother_dni} />
                  <InfoField label="Direccion" value={submission.mother_address} />
                </dl>
              </div>

              {/* Datos de la Hija */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-[#002855] mb-3 flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  Datos de la Hija
                </h3>
                <dl className="space-y-2 text-sm">
                  <InfoField label="Nombre completo" value={submission.daughter_full_name} />
                  <InfoField label="Fecha de nacimiento" value={formatDate(submission.daughter_dob)} />
                  <InfoField label="Municipalidad acta de nacimiento" value={submission.daughter_birth_certificate_municipality} />
                </dl>
              </div>

              {/* Datos del Padre */}
              <div className="bg-gray-50 rounded-lg p-4 md:col-span-2">
                <h3 className="text-sm font-semibold text-[#002855] mb-3 flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  Datos del Padre
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <dl className="space-y-2 text-sm">
                    <InfoField label="Nombre completo" value={submission.father_full_name} />
                    <InfoField label="Pasaporte" value={submission.father_passport} />
                  </dl>
                  <dl className="space-y-2 text-sm">
                    <InfoField label="Estado/Pais" value={submission.father_country_state} />
                    <InfoField label="Direccion con la hija" value={submission.father_address_with_daughter} />
                  </dl>
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

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-700">{value}</dd>
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
