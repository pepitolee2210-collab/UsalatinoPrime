'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Download, CheckCircle, ChevronDown, ChevronUp,
  Loader2, User, Calendar, MessageSquare, FileText,
  Trash2, Search, XCircle, Building2, MapPin,
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
  client_full_name: string
  client_phone: string
  client_address_street: string
  client_address_city: string
  client_address_state: string
  client_address_zip: string
  file_number: string
  judge_name: string
  next_hearing_date: string
  next_hearing_time: string
  current_court_name: string
  current_court_street: string
  current_court_city_state_zip: string
  new_address_street: string
  new_address_city: string
  new_address_state: string
  new_address_zip: string
  new_court_name: string
  new_court_street: string
  new_court_city_state_zip: string
  chief_counsel_address: string
  document_date: string
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

function formatHearingDateLong(dateStr: string, timeStr: string): string {
  try {
    const d = new Date(dateStr + 'T12:00:00')
    if (isNaN(d.getTime())) return `${dateStr} at ${timeStr}`
    const [h, m] = timeStr.split(':').map(Number)
    const ampm = h >= 12 ? 'p.m.' : 'a.m.'
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
    return `${MONTHS_EN[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}, at ${h12}:${m.toString().padStart(2, '0')} ${ampm}`
  } catch {
    return `${dateStr} at ${timeStr}`
  }
}

function formatHearingDateShort(dateStr: string, timeStr: string): string {
  try {
    const d = new Date(dateStr + 'T12:00:00')
    if (isNaN(d.getTime())) return `${dateStr} - ${timeStr}`
    const mm = (d.getMonth() + 1).toString().padStart(2, '0')
    const dd = d.getDate().toString().padStart(2, '0')
    const yyyy = d.getFullYear()
    const [h, m] = timeStr.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
    return `${mm}/${dd}/${yyyy} - ${h12}:${m.toString().padStart(2, '0')} ${ampm}`
  } catch {
    return `${dateStr} - ${timeStr}`
  }
}

export function CambioCorteRow({ submission }: { submission: Submission }) {
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState(submission.status)
  const [updating, setUpdating] = useState(false)
  const [notes, setNotes] = useState(submission.admin_notes || '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const statusInfo = statusConfig[status] || statusConfig.nuevo

  const s = submission
  const clientOldAddr = `${s.client_address_street}\n${s.client_address_city}, ${s.client_address_state} ${s.client_address_zip}`
  const clientNewAddr = `${s.new_address_street}\n${s.new_address_city}, ${s.new_address_state} ${s.new_address_zip}`
  const currentCourtFull = `${s.current_court_street}\n${s.current_court_city_state_zip}`
  const newCourtFull = `${s.new_court_street}\n${s.new_court_city_state_zip}`

  // Extract current court city from city_state_zip (e.g. "Seattle, WA 98174" -> "Seattle")
  const currentCourtCity = s.current_court_city_state_zip.split(',')[0].trim()
  const newCourtCityState = `${s.new_address_city}, ${s.new_address_state}`

  function handleDownloadPDF() {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
    const pw = doc.internal.pageSize.getWidth()
    const ph = doc.internal.pageSize.getHeight()
    const ml = 20 // margin left
    const mr = 20
    const cw = pw - ml - mr
    let y = 0
    const F = 'helvetica'
    const NAVY: [number, number, number] = [0, 40, 85]
    const BLACK: [number, number, number] = [0, 0, 0]
    const GRAY: [number, number, number] = [80, 80, 80]

    function resetY() { y = 18 }

    function text(txt: string, x: number, yy: number, opts?: any) {
      doc.text(txt, x, yy, opts)
    }

    function bold(size: number = 10) { doc.setFont(F, 'bold'); doc.setFontSize(size) }
    function normal(size: number = 10) { doc.setFont(F, 'normal'); doc.setFontSize(size) }
    function italic(size: number = 10) { doc.setFont(F, 'italic'); doc.setFontSize(size) }
    function color(c: [number, number, number]) { doc.setTextColor(...c) }

    function paragraph(txt: string, size: number = 9.5) {
      normal(size); color(BLACK)
      const lines = doc.splitTextToSize(txt, cw)
      checkPage(lines.length * 4.2 + 3)
      doc.text(lines, ml, y)
      y += lines.length * 4.2 + 3
    }

    function line() {
      doc.setDrawColor(0, 0, 0)
      doc.setLineWidth(0.3)
      doc.line(ml, y, pw - mr, y)
      y += 3
    }

    function checkPage(need: number) {
      if (y + need > ph - 20) {
        doc.addPage()
        resetY()
      }
    }

    // ============================================
    // PAGE 1 - COVER LETTER / MOTION
    // ============================================
    resetY()

    // Header - Client info
    bold(10); color(BLACK)
    text(s.client_full_name.toUpperCase(), ml, y)
    y += 5
    normal(9); color(GRAY)
    text(s.client_address_street.toUpperCase(), ml, y); y += 4
    text(`${s.client_address_city.toUpperCase()}, ${s.client_address_state.toUpperCase()} ${s.client_address_zip}`, ml, y); y += 4
    text(s.client_phone, ml, y); y += 5
    normal(9); color(BLACK)
    text('NOT DETAINED', ml, y); y += 8

    // Court header
    bold(9); color(BLACK)
    text('UNITED STATES DEPARTMENT OF JUSTICE', pw / 2, y, { align: 'center' }); y += 4
    text('EXECUTIVE OFFICE FOR IMMIGRATION REVIEW', pw / 2, y, { align: 'center' }); y += 5
    normal(9); color(GRAY)
    text(s.current_court_street, pw / 2, y, { align: 'center' }); y += 4
    text(s.current_court_city_state_zip, pw / 2, y, { align: 'center' }); y += 4
    bold(9); color(BLACK)
    text('IMMIGRATION COURTS', pw / 2, y, { align: 'center' }); y += 5

    normal(9); color(BLACK)
    text('OFFICE OF THE IMMIGRATION JUDGE', pw / 2, y, { align: 'center' }); y += 8

    // Case block
    line()
    normal(9); color(BLACK)
    text('In the Matter of:', ml, y); y += 5
    bold(9)
    text(s.client_full_name.toUpperCase(), ml, y)
    text(`File No: ${s.file_number}`, pw - mr, y, { align: 'right' }); y += 5
    normal(9)
    text('Respondent(s)', ml, y); y += 4
    text('In removal proceedings.', ml, y); y += 5
    line()

    // Judge and hearing
    normal(9); color(BLACK)
    text('Immigration Judge:', ml, y)
    text(`Next Hearing: ${formatHearingDateLong(s.next_hearing_date, s.next_hearing_time)}`, pw - mr, y, { align: 'right' }); y += 5
    bold(9)
    text(`Hon. ${s.judge_name}`, ml, y); y += 8

    // Title
    bold(11); color(NAVY)
    text("RESPONDENT\u2019S MOTION TO CHANGE VENUE", pw / 2, y, { align: 'center' }); y += 10

    // Body
    bold(10); color(BLACK)
    text('MOTION TO CHANGE VENUE', ml, y); y += 5
    normal(9); color(GRAY)
    text(`Date: ${formatDateEnglish(s.document_date)}`, ml, y); y += 5
    text(`${s.current_court_name}`, ml, y); y += 4
    text(s.current_court_street, ml, y); y += 4
    text(s.current_court_city_state_zip, ml, y); y += 6
    normal(9); color(BLACK)
    text(`Re: Motion to Change Venue`, ml, y); y += 4
    text(`Applicant: ${s.client_full_name.toUpperCase()}`, ml, y); y += 4
    text(`A#: ${s.file_number}`, ml, y); y += 7

    paragraph(`Honorable Immigration Judge,`)
    y += 1

    // Extract new court short name (e.g. "Immigration Court – Salt Lake City" -> "Salt Lake City Immigration Court")
    const newCourtShort = s.new_court_name.replace(/Immigration Court\s*[-–]\s*/i, '') + ' Immigration Court'
    const currentCourtShort = currentCourtCity + ' Immigration Court'

    paragraph(
      `I respectfully request that the Court transfer my removal proceedings from the ${currentCourtShort} to the ${newCourtShort}, as I have permanently relocated to the State of ${s.new_address_state}.`
    )

    paragraph(`My current address is:`)
    y -= 1
    normal(9); color(BLACK)
    text(s.new_address_street, ml + 4, y); y += 4
    text(`${s.new_address_city}, ${s.new_address_state} ${s.new_address_zip}`, ml + 4, y); y += 4
    text(`Phone: ${s.client_phone}`, ml + 4, y); y += 6

    paragraph(
      `I have permanently relocated to ${s.new_address_state} for employment and stability reasons. My residence is now established in ${s.new_address_city}, ${s.new_address_state}, and traveling to ${currentCourtCity}, ${s.current_court_city_state_zip.split(',')[1]?.trim().split(' ')[0] || ''} for future hearings would create significant financial and logistical hardship.`
    )

    paragraph(
      `Because my current residence falls within the jurisdiction of the ${newCourtShort}, transferring venue will allow me to fully comply with all court hearings and continue participating properly in these proceedings.`
    )

    paragraph(
      `For these reasons, I respectfully request that this Motion to Change Venue be granted and that my case be transferred to:`
    )

    y -= 1
    normal(9); color(BLACK)
    bold(9)
    text(s.new_court_name, ml + 4, y); y += 4
    normal(9)
    text(s.new_court_street, ml + 4, y); y += 4
    text(s.new_court_city_state_zip, ml + 4, y); y += 8

    paragraph(`Respectfully submitted,`)
    y += 2
    text('-'.repeat(40), ml, y); y += 5
    bold(9); color(BLACK)
    text(s.client_full_name.toUpperCase(), ml, y); y += 4
    normal(9)
    text(`A#: ${s.file_number}`, ml, y); y += 4
    text(s.new_address_street, ml, y); y += 4
    text(`${s.new_address_city}, ${s.new_address_state} ${s.new_address_zip}`, ml, y); y += 4
    text(`Phone: ${s.client_phone}`, ml, y); y += 6

    normal(9); color(BLACK)
    text('PRO-SE', ml, y)
    text('NOT DETAINED', pw - mr, y, { align: 'right' })

    // ============================================
    // PAGE 2 - FORMAL EOIR MOTION
    // ============================================
    doc.addPage()
    resetY()

    // Header
    bold(10); color(BLACK)
    text(s.client_full_name.toUpperCase(), ml, y); y += 5
    normal(9); color(GRAY)
    text(s.client_address_street.toUpperCase(), ml, y); y += 4
    text(`${s.client_address_city.toUpperCase()}, ${s.client_address_state.toUpperCase()} ${s.client_address_zip}`, ml, y); y += 4
    text(s.client_phone, ml, y); y += 7

    bold(9); color(BLACK)
    text('UNITED STATES DEPARTMENT OF JUSTICE', pw / 2, y, { align: 'center' }); y += 4
    text('EXECUTIVE OFFICE FOR IMMIGRATION REVIEW', pw / 2, y, { align: 'center' }); y += 5
    normal(9); color(GRAY)
    text(s.current_court_street, pw / 2, y, { align: 'center' }); y += 4
    text(s.current_court_city_state_zip, pw / 2, y, { align: 'center' }); y += 4
    bold(9); color(BLACK)
    text('IMMIGRATION COURTS', pw / 2, y, { align: 'center' }); y += 5

    line()

    // Case block
    normal(9); color(BLACK)
    text('In Matter(s) of:', ml, y); y += 5
    bold(9)
    text(s.client_full_name.toUpperCase(), ml, y)
    text(`File No.: ${s.file_number}`, pw - mr, y, { align: 'right' }); y += 5
    normal(9)
    text('Respondent', ml, y); y += 4
    text('In Removal Proceedings', ml, y); y += 5

    // Judge
    normal(9)
    text('Immigration Judge:', ml, y)
    text('Next Hearing:', pw / 2 + 10, y); y += 5
    bold(9)
    text(s.judge_name.toUpperCase(), ml, y)
    text(formatHearingDateShort(s.next_hearing_date, s.next_hearing_time), pw / 2 + 10, y); y += 5

    line()
    y += 3

    // Title
    bold(11); color(NAVY)
    text("RESPONDENT\u2019S MOTION TO", pw / 2, y, { align: 'center' }); y += 5
    text('CHANGE VENUE', pw / 2, y, { align: 'center' }); y += 8

    // Body
    paragraph(
      `Respondent, ${s.client_full_name.toUpperCase()}, moves this Honorable Court to change the venue of her removal proceedings from ${s.current_court_street}, ${s.current_court_city_state_zip} to ${s.new_court_city_state_zip.toUpperCase()}. I seek this change of venue pursuant to 8 CFR \u00A7 1003.20.`
    )

    paragraph(`In support of this motion, I state as follows:`)
    y += 2

    // Numbered points
    paragraph(`1. My name is ${s.client_full_name.toUpperCase()}. I am the respondent in the above-captioned proceedings.`)
    paragraph(`2. My hearing is currently scheduled before the ${currentCourtShort}.`)
    paragraph(`3. I have recently relocated to ${s.new_address_city}, ${s.new_address_state}, and my new address is ${s.new_address_street}, ${s.new_address_city}, ${s.new_address_state} ${s.new_address_zip}.`)
    paragraph(`4. My current residence falls within the jurisdiction of the ${s.new_court_name}.`)
    paragraph(`5. Traveling to ${currentCourtCity} for future hearings would create significant financial and logistical hardship.`)
    paragraph(`6. I respectfully request that this Court transfer my case to the ${s.new_court_name}, located at ${s.new_court_street}, ${s.new_court_city_state_zip}.`)

    y += 4
    paragraph(`Respectfully submitted,`)
    y += 1
    text('[FIRMA]', ml + 4, y); y += 6
    text('-'.repeat(40), ml, y); y += 6

    normal(9); color(BLACK)
    text('PRO-SE', ml, y)
    text('NOT DETAINED', pw - mr, y, { align: 'right' })

    // ============================================
    // PAGE 3 - CERTIFICATE OF SERVICE + ORDER
    // ============================================
    doc.addPage()
    resetY()

    // Header
    bold(10); color(BLACK)
    text(s.client_full_name.toUpperCase(), ml, y); y += 5
    normal(9); color(GRAY)
    text(s.client_address_street.toUpperCase(), ml, y); y += 4
    text(`${s.client_address_city.toUpperCase()}, ${s.client_address_state.toUpperCase()} ${s.client_address_zip}`, ml, y); y += 4
    text(s.client_phone, ml, y); y += 7

    bold(9); color(BLACK)
    text('UNITED STATES DEPARTMENT OF JUSTICE', pw / 2, y, { align: 'center' }); y += 4
    text('EXECUTIVE OFFICE FOR IMMIGRATION REVIEW', pw / 2, y, { align: 'center' }); y += 5
    normal(9); color(GRAY)
    text(s.current_court_street, pw / 2, y, { align: 'center' }); y += 4
    text(s.current_court_city_state_zip, pw / 2, y, { align: 'center' }); y += 5

    line()

    // Case block
    normal(9); color(BLACK)
    text('In the Matter(s) of:', ml, y); y += 5
    bold(9)
    text(s.client_full_name.toUpperCase(), ml, y)
    text(`File No.: ${s.file_number}`, pw - mr, y, { align: 'right' }); y += 6

    // ORDER section
    y += 4
    bold(11); color(NAVY)
    text('ORDER OF THE IMMIGRATION JUDGE', pw / 2, y, { align: 'center' }); y += 8

    normal(9); color(BLACK)
    // Checkbox items
    text('\u25A1', ml, y)
    const grantedLines = doc.splitTextToSize(
      `The respondent\u2019s Motion to Change Venue is GRANTED. The case is transferred to: _______________`,
      cw - 8
    )
    doc.text(grantedLines, ml + 6, y)
    y += grantedLines.length * 4.2 + 4

    text('\u25A1', ml, y)
    const deniedLines = doc.splitTextToSize(
      `The respondent\u2019s Motion to Change Venue is DENIED for the following reason(s): _______________`,
      cw - 8
    )
    doc.text(deniedLines, ml + 6, y)
    y += deniedLines.length * 4.2 + 8

    text('Date: ___________________________', ml, y); y += 6
    text('Immigration Judge: ___________________________', ml, y); y += 12

    // Separator
    line()
    y += 4

    // Certificate of Service
    bold(11); color(NAVY)
    text('CERTIFICATE OF SERVICE', pw / 2, y, { align: 'center' }); y += 8

    paragraph(
      `I hereby certify that on ${formatDateEnglish(s.document_date)}, a copy of the foregoing Respondent\u2019s Motion to Change Venue was served upon the Office of the Chief Counsel at:`
    )

    y += 1
    normal(9); color(BLACK)
    const counselLines = s.chief_counsel_address.split('\n')
    counselLines.forEach(ln => {
      text(ln, ml + 4, y); y += 4
    })
    y += 6

    text(`Date: ${formatDateEnglish(s.document_date)}`, ml, y); y += 6
    bold(9)
    text(s.client_full_name.toUpperCase(), ml, y)

    // Save
    const safeName = s.client_full_name.replace(/[^a-zA-Z0-9]/g, '_')
    doc.save(`cambio_corte_${safeName}.pdf`)
    toast.success('PDF de Cambio de Corte descargado')
  }

  async function updateStatus(newStatus: string) {
    setUpdating(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('cambio_corte_submissions')
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
        .from('cambio_corte_submissions')
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
        .from('cambio_corte_submissions')
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
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 truncate">{submission.client_full_name}</p>
              <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                <span className="flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  A#: {submission.file_number}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {currentCourtCity} → {s.new_address_city}
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
                Descargar PDF (3 pags)
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
              {/* Datos del cliente */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-[#002855] mb-3 flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  Datos del Cliente
                </h3>
                <dl className="space-y-2 text-sm">
                  <InfoField label="Nombre completo" value={s.client_full_name} />
                  <InfoField label="Telefono" value={s.client_phone} />
                  <InfoField label="Direccion actual" value={`${s.client_address_street}, ${s.client_address_city}, ${s.client_address_state} ${s.client_address_zip}`} />
                </dl>
              </div>

              {/* Datos del caso */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-[#002855] mb-3 flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />
                  Datos del Caso
                </h3>
                <dl className="space-y-2 text-sm">
                  <InfoField label="A# (File No.)" value={s.file_number} />
                  <InfoField label="Juez" value={`Hon. ${s.judge_name}`} />
                  <InfoField label="Proxima audiencia" value={formatHearingDateLong(s.next_hearing_date, s.next_hearing_time)} />
                  <InfoField label="Fecha documento" value={formatDateEnglish(s.document_date)} />
                </dl>
              </div>

              {/* Corte actual */}
              <div className="bg-orange-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-orange-800 mb-3 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" />
                  Corte Actual (desde)
                </h3>
                <dl className="space-y-2 text-sm">
                  <InfoField label="Nombre" value={s.current_court_name} />
                  <InfoField label="Direccion" value={`${s.current_court_street}, ${s.current_court_city_state_zip}`} />
                </dl>
              </div>

              {/* Nueva corte */}
              <div className="bg-green-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  Nueva Corte (hacia)
                </h3>
                <dl className="space-y-2 text-sm">
                  <InfoField label="Nueva direccion" value={`${s.new_address_street}, ${s.new_address_city}, ${s.new_address_state} ${s.new_address_zip}`} />
                  <InfoField label="Nombre corte" value={s.new_court_name} />
                  <InfoField label="Direccion corte" value={`${s.new_court_street}, ${s.new_court_city_state_zip}`} />
                </dl>
              </div>

              {/* Fiscal */}
              <div className="bg-gray-50 rounded-lg p-4 md:col-span-2">
                <h3 className="text-sm font-semibold text-[#002855] mb-3 flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />
                  Fiscal Principal (Chief Counsel)
                </h3>
                <dl className="space-y-2 text-sm">
                  <InfoField label="Direccion" value={s.chief_counsel_address} />
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
      </CardContent>
    </Card>
  )
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-700 whitespace-pre-line">{value}</dd>
    </div>
  )
}
