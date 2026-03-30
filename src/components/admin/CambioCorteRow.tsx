'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Download, CheckCircle, ChevronDown, ChevronUp,
  Loader2, User, Calendar, MessageSquare, FileText,
  Trash2, Search, XCircle, Building2, MapPin, Pencil,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
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
  residence_proof_docs: string[] | null
  beneficiaries: { full_name: string; file_number: string }[] | null
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

  // Extract current court city — fallback to court name if city_state_zip has no comma
  const currentCourtCity = s.current_court_city_state_zip.includes(',')
    ? s.current_court_city_state_zip.split(',')[0].trim()
    : s.current_court_name.replace(/Immigration Court\s*[-\u2013]\s*/i, '').trim()
  const newCourtCityState = `${s.new_address_city}, ${s.new_address_state}`

  function handleDownloadPDF() {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
    const pw = doc.internal.pageSize.getWidth()
    const ph = doc.internal.pageSize.getHeight()
    const ml = 25
    const mr = 25
    const cw = pw - ml - mr
    let y = 0
    const F = 'times'
    const BLACK: [number, number, number] = [0, 0, 0]

    function resetY() { y = 22 }
    function bold(sz: number = 12) { doc.setFont(F, 'bold'); doc.setFontSize(sz); doc.setTextColor(...BLACK) }
    function normal(sz: number = 12) { doc.setFont(F, 'normal'); doc.setFontSize(sz); doc.setTextColor(...BLACK) }
    function italic(sz: number = 12) { doc.setFont(F, 'italic'); doc.setFontSize(sz); doc.setTextColor(...BLACK) }
    function center(txt: string) { doc.text(txt, pw / 2, y, { align: 'center' }) }
    function left(txt: string, x: number = ml) { doc.text(txt, x, y) }
    function right(txt: string) { doc.text(txt, pw - mr, y, { align: 'right' }) }

    function underlineCenter(txt: string, sz: number = 12) {
      doc.setFontSize(sz)
      const tw = doc.getTextWidth(txt)
      const tx = (pw - tw) / 2
      doc.text(txt, pw / 2, y, { align: 'center' })
      doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3)
      doc.line(tx, y + 0.8, tx + tw, y + 0.8)
    }

    function underlineLeft(txt: string, x: number = ml) {
      const tw = doc.getTextWidth(txt)
      doc.text(txt, x, y)
      doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3)
      doc.line(x, y + 0.8, x + tw, y + 0.8)
    }

    function dashedLine(x1: number, x2: number) {
      doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3)
      const dashLen = 2; const gapLen = 1.5
      let cx = x1
      while (cx < x2) {
        const end = Math.min(cx + dashLen, x2)
        doc.line(cx, y, end, y)
        cx = end + gapLen
      }
    }

    function paragraph(txt: string, sz: number = 11, indent: number = 0) {
      normal(sz)
      const lines = doc.splitTextToSize(txt, cw - indent)
      if (y + lines.length * 4.5 > ph - 20) { doc.addPage(); resetY() }
      doc.text(lines, ml + indent, y)
      y += lines.length * 4.5 + 2
    }

    // Court name formatted as "Immigration Court – [City]"
    const currentCourtFormatted = s.current_court_name.match(/immigration court/i)
      ? s.current_court_name.replace(/-/g, '\u2013')
      : `Immigration Court \u2013 ${s.current_court_name}`
    const newCourtFormatted = s.new_court_name.match(/immigration court/i)
      ? s.new_court_name.replace(/-/g, '\u2013')
      : `Immigration Court \u2013 ${s.new_court_name}`

    // Short names for body text (e.g. "Seattle Immigration Court")
    const currentCourtShort = currentCourtCity + ' Immigration Court'
    const newCourtShort = s.new_court_name.replace(/Immigration Court\s*[-\u2013]\s*/i, '').trim()
      ? s.new_court_name.replace(/Immigration Court\s*[-\u2013]\s*/i, '').trim() + ' Immigration Court'
      : s.new_court_name + ' Immigration Court'

    // ============================================
    // PAGE 1 - COVER PAGE (matches 1.png exactly)
    // ============================================
    resetY()

    // Client info - top left
    bold(12); left(s.client_full_name.toUpperCase()); y += 6
    normal(12); left(`${s.client_address_street.toUpperCase()} ${s.client_address_city.toUpperCase()}, ${s.client_address_state.toUpperCase()} -${s.client_address_zip}`); y += 5
    left(s.client_phone); y += 6
    bold(12); left('NOT DETAINED'); y += 18

    // UNITED STATES DEPARTMENT OF JUSTICE
    bold(13); center('UNITED STATES DEPARTMENT OF JUSTICE'); y += 7
    bold(12); center('EXECUTIVE OFFICE FOR IMMIGRATION REVIEW'); y += 12

    // Court address - centered, bold, underlined
    bold(12)
    underlineCenter(s.current_court_street, 12); y += 6
    center(s.current_court_city_state_zip); y += 7
    bold(13); center('IMMIGRATION COURTS'); y += 12

    bold(12); center('OFFICE OF THE IMMIGRATION JUDGE'); y += 28

    // Case block
    const bens = (s.beneficiaries || []).filter(b => b.full_name.trim())
    normal(12); left('In the Matter of:'); y += 9

    // Main respondent (parent)
    bold(12); left(s.client_full_name.toUpperCase())
    normal(12)
    doc.text('File No: ', pw - mr - doc.getTextWidth(`File No: ${s.file_number}`), y)
    bold(12)
    doc.text(s.file_number, pw - mr - doc.getTextWidth(s.file_number), y)
    y += 9

    normal(12); left('Respondent(s)'); y += 5
    italic(12); left('In removal proceedings.'); y += 16

    // Beneficiaries (children/spouse) after Respondent(s)
    for (const ben of bens) {
      bold(12); left(ben.full_name.toUpperCase())
      normal(12)
      doc.text('File No: ', pw - mr - doc.getTextWidth(`File No: ${ben.file_number}`), y)
      bold(12)
      doc.text(ben.file_number, pw - mr - doc.getTextWidth(ben.file_number), y)
      y += 7
    }
    y += 12

    // Judge and hearing
    normal(12); left('Immigration Judge:')
    const nhLabel = 'Next Hearing: '
    const nhDate = formatHearingDateLong(s.next_hearing_date, s.next_hearing_time)
    normal(12); doc.text(nhLabel, pw / 2, y)
    bold(12); doc.text(nhDate, pw / 2 + doc.getTextWidth(nhLabel), y); y += 6
    bold(12); left(`Hon. ${s.judge_name}`); y += 20

    // Title - centered, bold, underlined
    bold(13)
    underlineCenter("RESPONDENT\u2019S MOTION TO CHANGE VENUE", 13)

    // ============================================
    // PAGE 2 - MOTION LETTER BODY (matches 2.png)
    // ============================================
    doc.addPage()
    resetY()

    // Title
    bold(14); center('MOTION TO CHANGE VENUE'); y += 8

    // Date & court info
    normal(11)
    left(`Date: ${formatDateEnglish(s.document_date)}`); y += 5
    left(currentCourtFormatted); y += 4
    bold(11)
    left(s.current_court_street); y += 4
    left(s.current_court_city_state_zip); y += 6

    // Re: line
    normal(11)
    left('Re: Motion to Change Venue'); y += 5
    left(`Applicant: ${s.client_full_name.toUpperCase()}`); y += 5
    left(`A#: ${s.file_number}`); y += 5

    // Beneficiaries / Dependents
    for (let i = 0; i < bens.length; i++) {
      normal(11)
      left(`It Depends ${i + 1}: ${bens[i].full_name.toUpperCase()}`)
      if (bens[i].file_number) {
        y += 4
        left(`A#: ${bens[i].file_number}`)
      }
      y += 5
    }
    if (bens.length > 0) y += 2

    // Letter body
    paragraph('Honorable Immigration Judge,', 11)
    y += 1

    paragraph(
      `I respectfully request that the Court transfer my removal proceedings from the ${currentCourtShort} to the ${newCourtShort}, as I have permanently relocated to the State of ${s.new_address_state}.`, 11
    )

    paragraph('My current address is:', 11)
    y -= 1
    bold(11)
    left(s.new_address_street, ml + 6); y += 5
    left(`${s.new_address_city}, ${s.new_address_state} ${s.new_address_zip}`, ml + 6); y += 5
    normal(11)
    left(`Phone: ${s.client_phone}`, ml + 6); y += 6

    paragraph(
      `I have permanently relocated to ${s.new_address_state} for employment and stability reasons. My residence is now established in ${s.new_address_city}, ${s.new_address_state}, and traveling to ${currentCourtCity}, ${s.current_court_city_state_zip.split(',')[1]?.trim().split(' ')[0] || ''} for future hearings would create significant financial and logistical hardship.`, 11
    )

    // Residence proof documents paragraph
    const proofDocs = s.residence_proof_docs || []
    if (proofDocs.length > 0) {
      const docLabels: Record<string, string> = {
        pay_stub: 'Pay Stub',
        lease_agreement: 'Lease Agreement',
        tax_return: 'Tax Return',
        utility_bills: 'Utility Bills proving my new address',
      }
      const docList = proofDocs.map(k => docLabels[k] || k).join(', ')
      paragraph(
        `To accredit my new residence, I attach the following: ${docList}.`, 11
      )
    }

    paragraph(
      `Because my current residence falls within the jurisdiction of the ${newCourtShort}, transferring venue will allow me to fully comply with all court hearings and continue participating properly in these proceedings.`, 11
    )

    paragraph(
      `For these reasons, I respectfully request that this Motion to Change Venue be granted and that my case be transferred to:`, 11
    )

    y += 1
    bold(11)
    left(newCourtFormatted, ml + 6); y += 5
    normal(11)
    left(s.new_court_street, ml + 6); y += 4
    left(s.new_court_city_state_zip, ml + 6); y += 8

    paragraph('Respectfully submitted,', 11)
    y += 10

    // Signature block
    normal(11)
    left('-'.repeat(35)); y += 6
    bold(11); left(s.client_full_name.toUpperCase()); y += 5
    normal(11)
    left(`A#: ${s.file_number}`); y += 5
    left(s.new_address_street); y += 4
    left(`${s.new_address_city}, ${s.new_address_state} ${s.new_address_zip}`); y += 4
    left(`Phone: ${s.client_phone}`); y += 8

    bold(11); left('PRO-SE')
    right('NOT DETAINED')

    // ============================================
    // PAGE 3 - FORMAL EOIR MOTION (matches 3.png)
    // ============================================
    doc.addPage()
    resetY()

    // PRO-SE / NOT DETAINED at top
    bold(12); left('PRO-SE'); right('NOT DETAINED'); y += 7

    // Client info
    bold(12); left(s.client_full_name.toUpperCase()); y += 6
    normal(12)
    left(s.client_address_street.toUpperCase()); y += 5
    left(`${s.client_address_city.toUpperCase()} ${s.client_address_state.toUpperCase()} -${s.client_address_zip}`); y += 5
    left(s.client_phone); y += 10

    // DOJ header
    bold(13); center('UNITED STATES DEPARTMENT OF JUSTICE'); y += 5
    bold(12); center('EXECUTIVE OFFICE FOR IMMIGRATION REVIEW'); y += 8

    // Court address centered, bold, underlined
    bold(12)
    underlineCenter(s.current_court_street, 12); y += 5
    center(s.current_court_city_state_zip); y += 5
    bold(13); center('IMMIGRATION COURTS'); y += 10

    // Dashed separator line
    dashedLine(ml, ml + cw * 0.6); y += 10

    // Case block
    normal(12); left('In Matter (s) of:'); y += 7

    // Main respondent
    bold(12); left(s.client_full_name.toUpperCase())
    normal(12)
    const fnLabel3 = 'File No.: '
    doc.text(fnLabel3, pw - mr - doc.getTextWidth(fnLabel3 + s.file_number), y)
    bold(12); doc.text(s.file_number, pw - mr - doc.getTextWidth(s.file_number), y)
    y += 8

    normal(12); left('Respondent'); y += 5
    italic(12); left('In Removal Proceedings'); y += 8

    // Beneficiaries (children/spouse) after Respondent
    for (const ben of bens) {
      bold(12); left(ben.full_name.toUpperCase())
      normal(12)
      doc.text(fnLabel3, pw - mr - doc.getTextWidth(fnLabel3 + ben.file_number), y)
      bold(12); doc.text(ben.file_number, pw - mr - doc.getTextWidth(ben.file_number), y)
      y += 6
    }
    y += 8

    // Dashed separator line
    dashedLine(ml, ml + cw * 0.65); y += 8

    // Judge and hearing
    italic(12)
    left('Immigration Judge:', ml + 6)
    right('Next Hearing:')
    y += 6
    bold(12); left(s.judge_name.toUpperCase(), ml + 6)
    doc.text(formatHearingDateShort(s.next_hearing_date, s.next_hearing_time), pw - mr, y, { align: 'right' })

    // Helpers for pages 4-6
    const drawCb = (xPos: number) => {
      doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3)
      doc.rect(xPos, y - 3, 3.5, 3.5)
    }
    const certDateStr = (() => {
      try {
        const d = new Date(s.document_date + 'T12:00:00')
        if (isNaN(d.getTime())) return s.document_date
        return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}/${d.getFullYear()}`
      } catch { return s.document_date }
    })()

    // ============================================
    // PAGE 4 - RESPONDENT'S MOTION (formal legal body)
    // ============================================
    doc.addPage()
    resetY()

    // Title
    bold(14); center("RESPONDENT\u2019S MOTION TO"); y += 6
    bold(14); center('CHANGE VENUE'); y += 12

    // Body
    paragraph(
      `Respondent, ${s.client_full_name.toUpperCase()}, moves this Honorable Court to change the venue of the removal proceedings from ${s.current_court_street}, ${s.current_court_city_state_zip} to ${s.new_court_city_state_zip}. I seek this change of venue pursuant to 8 CFR \u00A7 1003.20.`, 11
    )

    paragraph('In support of this motion, I state as follows:', 11)

    // Large empty space for handwritten notes
    y += 80

    // Signature block
    normal(11); left('Respectfully submitted,'); y += 15
    left('-'.repeat(35)); y += 6
    bold(11); left(s.client_full_name.toUpperCase())

    // ============================================
    // PAGE 5 - ORDER OF THE IMMIGRATION JUDGE
    // ============================================
    doc.addPage()
    resetY()

    // PRO-SE / NOT DETAINED header
    bold(12); left('PRO-SE'); right('NOT DETAINED'); y += 7

    // Client info
    bold(12); left(s.client_full_name.toUpperCase()); y += 6
    normal(12)
    left(s.client_address_street.toUpperCase()); y += 5
    left(`${s.client_address_city.toUpperCase()} ${s.client_address_state.toUpperCase()} -${s.client_address_zip}`); y += 5
    left(s.client_phone); y += 10

    // DOJ header
    bold(13); center('UNITED STATES DEPARTMENT OF JUSTICE'); y += 5
    bold(12); center('EXECUTIVE OFFICE FOR IMMIGRATION REVIEW'); y += 8

    // Court address
    bold(12)
    underlineCenter(s.current_court_street, 12); y += 5
    center(s.current_court_city_state_zip); y += 5
    bold(13); center('IMMIGRATION COURTS'); y += 10

    // Title
    bold(13); underlineCenter('ORDER OF THE IMMIGRATION JUDGE', 13); y += 10

    // Body text
    normal(11)
    const orderText = doc.splitTextToSize(
      'Upon consideration of the respondent\u2019s Motion to Change Venue, it is HEREBY ORDERED that the motion be:', cw
    )
    doc.text(orderText, ml, y); y += orderText.length * 4.5 + 4

    // GRANTED / DENIED checkboxes
    bold(11)
    drawCb(ml); left('GRANTED', ml + 5)
    drawCb(ml + 40); left('DENIED because:', ml + 45)
    y += 8

    // Checkbox items
    normal(11)
    const checkItems = [
      'DHS does not oppose the motion.',
      'The respondent does not oppose the motion.',
      'A response to the motion has not been filed with the court.',
      'Good cause has been established for the motion.',
      'The court agrees with the reasons stated in the opposition to the motion.',
      'The motion is untimely per ____________',
      'Other',
    ]
    for (const item of checkItems) {
      drawCb(ml + 4)
      const itemLines = doc.splitTextToSize(item, pw - mr - (ml + 10))
      doc.text(itemLines, ml + 10, y)
      y += itemLines.length * 4.5 + 1.5
    }

    y += 4
    bold(11); left('Deadlines:'); y += 6
    normal(11)
    drawCb(ml + 4)
    const dl1 = doc.splitTextToSize('The application(s) for relief must be filed by ____________', pw - mr - (ml + 10))
    doc.text(dl1, ml + 10, y); y += dl1.length * 4.5 + 1.5
    drawCb(ml + 4)
    const dl2 = doc.splitTextToSize('The respondent must comply with DHS biometrics instructions by ____________', pw - mr - (ml + 10))
    doc.text(dl2, ml + 10, y); y += dl2.length * 4.5 + 4

    // Date and Judge signature lines
    normal(11)
    left('Date: ____________')
    doc.text('Immigration Judge: ____________', pw / 2 + 10, y)

    // ============================================
    // PAGE 6 - CERTIFICATE OF SERVICE
    // ============================================
    doc.addPage()
    resetY()

    // Title
    bold(14); center('CERTIFICATE OF SERVICE'); y += 12

    // Body
    paragraph(
      `On ${certDateStr}, I ${s.client_full_name.toUpperCase()}, hereby certify that a true and correct copy of this RESPONDENT\u2019S MOTION TO CHANGE VENUE was delivered to the Office of Chief Counsel by USPS at:`, 11
    )

    y += 2
    normal(11)
    left('Office of the Principal Legal Advisor,', ml + 10); y += 5
    const ccParts = s.chief_counsel_address.split('\n')
    for (const part of ccParts) {
      if (part.trim()) { left(part.trim(), ml + 10); y += 5 }
    }

    y += 20

    // Signature block
    center('________________________'); y += 6
    bold(11); center(s.client_full_name.toUpperCase()); y += 8
    normal(11)
    center(s.client_address_street); y += 5
    center(`${s.client_address_city}, ${s.client_address_state} -${s.client_address_zip}`); y += 5
    center(s.client_phone)

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
              <Link
                href={`/admin/cambio-corte/${submission.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#F2A900] text-white rounded-lg hover:bg-[#D4940A] transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                Editar
              </Link>
              <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#002855] text-white rounded-lg hover:bg-[#001d3d] transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar PDF (6 págs)
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
