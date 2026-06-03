// Generador de la Carta de Cambio de Corte (Motion to Change Venue) — 6 págs.
//
// Extraído desde `src/components/admin/CambioCorteRow.tsx:122-578` para
// hacerlo importable desde el dashboard del caso y desde el endpoint
// /api/admin/cases/[id]/carta-cambio-corte.
//
// El layout y el contenido textual se mantienen IDÉNTICOS al sistema legacy
// (cambio_corte_submissions) — la única diferencia es que ahora la data viene
// del caso enlazado, no de un row standalone.
//
// Salida: Uint8Array con un PDF Letter (US Letter, portrait, 6 páginas).
// jsPDF funciona en browser y Node ≥ 18 sin DOM.

import jsPDF from 'jspdf'

export interface CartaCambioCorteData {
  client_full_name: string
  client_phone: string
  client_address_street: string
  client_address_city: string
  client_address_state: string
  client_address_zip: string
  file_number: string
  judge_name: string
  next_hearing_date: string // YYYY-MM-DD
  next_hearing_time: string // HH:MM (24h)
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
  document_date: string // YYYY-MM-DD
  residence_proof_docs: string[]
  beneficiaries: Array<{ full_name: string; file_number: string }>
  // Fiscal Principal (Chief Counsel) de la NUEVA corte — referencia sugerida por
  // IA a partir de la nueva dirección. NO se imprime en la moción: el Certificate
  // of Service (pág 6) se sirve al Chief Counsel de la corte ACTUAL
  // (chief_counsel_address). Se guarda solo para que el staff lo tenga a mano.
  new_court_chief_counsel_address?: string
  // Contexto adicional sobre los documentos anexados (ej. contrato de alquiler a
  // nombre del cónyuge). Texto libre redactado por el staff o propuesto por IA.
  // SÍ se imprime como párrafo en la pág 2 de la moción.
  additional_context?: string
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

/**
 * Genera el PDF de 6 páginas de la Moción de Cambio de Venue para EOIR.
 * Layout idéntico al sistema legacy (CambioCorteRow.handleDownloadPDF).
 */
export function generateCambioCorteLetter(s: CartaCambioCorteData): Uint8Array {
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

  // Court names formatted as "Immigration Court – [City]"
  const currentCourtFormatted = s.current_court_name.match(/immigration court/i)
    ? s.current_court_name.replace(/-/g, '–')
    : `Immigration Court – ${s.current_court_name}`
  const newCourtFormatted = s.new_court_name.match(/immigration court/i)
    ? s.new_court_name.replace(/-/g, '–')
    : `Immigration Court – ${s.new_court_name}`

  // Extract current court city — fallback to court name if city_state_zip has no comma
  const currentCourtCity = s.current_court_city_state_zip.includes(',')
    ? s.current_court_city_state_zip.split(',')[0].trim()
    : s.current_court_name.replace(/Immigration Court\s*[-–]\s*/i, '').trim()

  // Short names for body text (e.g. "Seattle Immigration Court")
  const currentCourtShort = currentCourtCity + ' Immigration Court'
  const newCourtShort = s.new_court_name.replace(/Immigration Court\s*[-–]\s*/i, '').trim()
    ? s.new_court_name.replace(/Immigration Court\s*[-–]\s*/i, '').trim() + ' Immigration Court'
    : s.new_court_name + ' Immigration Court'

  // ============================================
  // PAGE 1 - COVER PAGE
  // ============================================
  resetY()

  bold(12); left(s.client_full_name.toUpperCase()); y += 6
  normal(12); left(`${s.client_address_street.toUpperCase()} ${s.client_address_city.toUpperCase()}, ${s.client_address_state.toUpperCase()} -${s.client_address_zip}`); y += 5
  left(s.client_phone); y += 6
  bold(12); left('NOT DETAINED'); y += 18

  bold(13); center('UNITED STATES DEPARTMENT OF JUSTICE'); y += 7
  bold(12); center('EXECUTIVE OFFICE FOR IMMIGRATION REVIEW'); y += 12

  bold(12)
  underlineCenter(s.current_court_street, 12); y += 6
  center(s.current_court_city_state_zip); y += 7
  bold(13); center('IMMIGRATION COURTS'); y += 12

  bold(12); center('OFFICE OF THE IMMIGRATION JUDGE'); y += 28

  const bens = (s.beneficiaries || []).filter(b => b.full_name.trim())
  normal(12); left('In the Matter of:'); y += 9

  bold(12); left(s.client_full_name.toUpperCase())
  normal(12)
  doc.text('File No: ', pw - mr - doc.getTextWidth(`File No: ${s.file_number}`), y)
  bold(12)
  doc.text(s.file_number, pw - mr - doc.getTextWidth(s.file_number), y)
  y += 9

  normal(12); left('Respondent(s)'); y += 5
  italic(12); left('In removal proceedings.'); y += 16

  for (const ben of bens) {
    bold(12); left(ben.full_name.toUpperCase())
    normal(12)
    doc.text('File No: ', pw - mr - doc.getTextWidth(`File No: ${ben.file_number}`), y)
    bold(12)
    doc.text(ben.file_number, pw - mr - doc.getTextWidth(ben.file_number), y)
    y += 7
  }
  y += 12

  normal(12); left('Immigration Judge:')
  const nhLabel = 'Next Hearing: '
  const nhDate = formatHearingDateLong(s.next_hearing_date, s.next_hearing_time)
  normal(12); doc.text(nhLabel, pw / 2, y)
  bold(12); doc.text(nhDate, pw / 2 + doc.getTextWidth(nhLabel), y); y += 6
  bold(12); left(`Hon. ${s.judge_name}`); y += 20

  bold(13)
  underlineCenter("RESPONDENT’S MOTION TO CHANGE VENUE", 13)

  // ============================================
  // PAGE 2 - MOTION LETTER BODY
  // ============================================
  doc.addPage()
  resetY()

  bold(14); center('MOTION TO CHANGE VENUE'); y += 8

  normal(11)
  left(`Date: ${formatDateEnglish(s.document_date)}`); y += 5
  left(currentCourtFormatted); y += 4
  bold(11)
  left(s.current_court_street); y += 4
  left(s.current_court_city_state_zip); y += 6

  normal(11)
  left('Re: Motion to Change Venue'); y += 5
  left(`Applicant: ${s.client_full_name.toUpperCase()}`); y += 5
  left(`A#: ${s.file_number}`); y += 5

  for (let i = 0; i < bens.length; i++) {
    normal(11)
    left(`Dependent ${i + 1}: ${bens[i].full_name.toUpperCase()}`)
    if (bens[i].file_number) {
      y += 4
      left(`A#: ${bens[i].file_number}`)
    }
    y += 5
  }
  if (bens.length > 0) y += 2

  paragraph('Honorable Immigration Judge,', 11)
  y += 1

  paragraph(
    `I respectfully request that the Court transfer my removal proceedings from the ${currentCourtShort} to the ${newCourtShort}, as I have permanently relocated to the State of ${s.new_address_state}.`,
    11,
  )

  paragraph('My current address is:', 11)
  y -= 1
  bold(11)
  left(s.new_address_street, ml + 6); y += 5
  left(`${s.new_address_city}, ${s.new_address_state} ${s.new_address_zip}`, ml + 6); y += 5
  normal(11)
  left(`Phone: ${s.client_phone}`, ml + 6); y += 6

  paragraph(
    `I have permanently relocated to ${s.new_address_state} for employment and stability reasons. My residence is now established in ${s.new_address_city}, ${s.new_address_state}, and traveling to ${currentCourtCity}, ${s.current_court_city_state_zip.split(',')[1]?.trim().split(' ')[0] || ''} for future hearings would create significant financial and logistical hardship.`,
    11,
  )

  const proofDocs = s.residence_proof_docs || []
  if (proofDocs.length > 0) {
    const docLabels: Record<string, string> = {
      pay_stub: 'Pay Stub',
      lease_agreement: 'Lease Agreement',
      tax_return: 'Tax Return',
      utility_bills: 'Utility Bills proving my new address',
    }
    const docList = proofDocs.map(k => docLabels[k] || k).join(', ')
    paragraph(`To accredit my new residence, I attach the following: ${docList}.`, 11)
  }

  // Contexto adicional sobre los documentos anexados (caso "Elio": contrato de
  // alquiler a nombre del cónyuge, constancia de trabajo, etc.). Se imprime tal
  // cual lo redactó el staff / propuso la IA, en inglés legal.
  const additionalContext = (s.additional_context ?? '').trim()
  if (additionalContext) {
    paragraph(additionalContext, 11)
  }

  paragraph(
    `Because my current residence falls within the jurisdiction of the ${newCourtShort}, transferring venue will allow me to fully comply with all court hearings and continue participating properly in these proceedings.`,
    11,
  )

  paragraph(
    `For these reasons, I respectfully request that this Motion to Change Venue be granted and that my case be transferred to:`,
    11,
  )

  y += 1
  bold(11)
  left(newCourtFormatted, ml + 6); y += 5
  normal(11)
  left(s.new_court_street, ml + 6); y += 4
  left(s.new_court_city_state_zip, ml + 6); y += 8

  const hearingDateFormatted = formatDateEnglish(s.next_hearing_date)
  const courtCityName = s.current_court_city_state_zip.split(',')[0]?.trim() || s.current_court_city_state_zip

  paragraph(
    `In the alternative, if the Court does not grant this Motion to Change Venue prior to the hearing currently scheduled for ${hearingDateFormatted}, Respondent respectfully requests permission to appear remotely, via WebEx or telephonically, due to Respondent’s residence in the State of ${s.new_address_state} and the significant hardship that travel to ${courtCityName} would impose. Respondent remains willing to appear in person if so ordered by the Court.`,
    11,
  )

  paragraph(
    `Additionally, Respondent respectfully requests that any future hearings be conducted remotely, if permitted by the Court.`,
    11,
  )

  y += 2
  paragraph('Respectfully submitted,', 11)
  y += 10

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
  // PAGE 3 - FORMAL EOIR MOTION
  // ============================================
  doc.addPage()
  resetY()

  bold(12); left('PRO-SE'); right('NOT DETAINED'); y += 7

  bold(12); left(s.client_full_name.toUpperCase()); y += 6
  normal(12)
  left(s.client_address_street.toUpperCase()); y += 5
  left(`${s.client_address_city.toUpperCase()} ${s.client_address_state.toUpperCase()} -${s.client_address_zip}`); y += 5
  left(s.client_phone); y += 10

  bold(13); center('UNITED STATES DEPARTMENT OF JUSTICE'); y += 5
  bold(12); center('EXECUTIVE OFFICE FOR IMMIGRATION REVIEW'); y += 8

  bold(12)
  underlineCenter(s.current_court_street, 12); y += 5
  center(s.current_court_city_state_zip); y += 5
  bold(13); center('IMMIGRATION COURTS'); y += 10

  dashedLine(ml, ml + cw * 0.6); y += 10

  normal(12); left('In Matter (s) of:'); y += 7

  bold(12); left(s.client_full_name.toUpperCase())
  normal(12)
  const fnLabel3 = 'File No.: '
  doc.text(fnLabel3, pw - mr - doc.getTextWidth(fnLabel3 + s.file_number), y)
  bold(12); doc.text(s.file_number, pw - mr - doc.getTextWidth(s.file_number), y)
  y += 8

  normal(12); left('Respondent'); y += 5
  italic(12); left('In Removal Proceedings'); y += 8

  for (const ben of bens) {
    bold(12); left(ben.full_name.toUpperCase())
    normal(12)
    doc.text(fnLabel3, pw - mr - doc.getTextWidth(fnLabel3 + ben.file_number), y)
    bold(12); doc.text(ben.file_number, pw - mr - doc.getTextWidth(ben.file_number), y)
    y += 6
  }
  y += 8

  dashedLine(ml, ml + cw * 0.65); y += 8

  italic(12)
  left('Immigration Judge:', ml + 6)
  right('Next Hearing:')
  y += 6
  bold(12); left(s.judge_name.toUpperCase(), ml + 6)
  doc.text(formatHearingDateShort(s.next_hearing_date, s.next_hearing_time), pw - mr, y, { align: 'right' })

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
  // PAGE 4 - RESPONDENT'S MOTION
  // ============================================
  doc.addPage()
  resetY()

  bold(14); center("RESPONDENT’S MOTION TO"); y += 6
  bold(14); center('CHANGE VENUE'); y += 12

  paragraph(
    `Respondent, ${s.client_full_name.toUpperCase()}, moves this Honorable Court to change the venue of the removal proceedings from ${s.current_court_street}, ${s.current_court_city_state_zip} to ${s.new_court_city_state_zip}. I seek this change of venue pursuant to 8 CFR § 1003.20.`,
    11,
  )

  paragraph('In support of this motion, I state as follows:', 11)

  y += 80

  normal(11); left('Respectfully submitted,'); y += 15
  left('-'.repeat(35)); y += 6
  bold(11); left(s.client_full_name.toUpperCase())

  // ============================================
  // PAGE 5 - ORDER OF THE IMMIGRATION JUDGE
  // ============================================
  doc.addPage()
  resetY()

  bold(12); left('PRO-SE'); right('NOT DETAINED'); y += 7

  bold(12); left(s.client_full_name.toUpperCase()); y += 6
  normal(12)
  left(s.client_address_street.toUpperCase()); y += 5
  left(`${s.client_address_city.toUpperCase()} ${s.client_address_state.toUpperCase()} -${s.client_address_zip}`); y += 5
  left(s.client_phone); y += 10

  bold(13); center('UNITED STATES DEPARTMENT OF JUSTICE'); y += 5
  bold(12); center('EXECUTIVE OFFICE FOR IMMIGRATION REVIEW'); y += 8

  bold(12)
  underlineCenter(s.current_court_street, 12); y += 5
  center(s.current_court_city_state_zip); y += 5
  bold(13); center('IMMIGRATION COURTS'); y += 10

  bold(13); underlineCenter('ORDER OF THE IMMIGRATION JUDGE', 13); y += 10

  normal(11)
  const orderText = doc.splitTextToSize(
    'Upon consideration of the respondent’s Motion to Change Venue, it is HEREBY ORDERED that the motion be:',
    cw,
  )
  doc.text(orderText, ml, y); y += orderText.length * 4.5 + 4

  bold(11)
  drawCb(ml); left('GRANTED', ml + 5)
  drawCb(ml + 40); left('DENIED because:', ml + 45)
  y += 8

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

  normal(11)
  left('Date: ____________')
  doc.text('Immigration Judge: ____________', pw / 2 + 10, y)

  // ============================================
  // PAGE 6 - CERTIFICATE OF SERVICE
  // ============================================
  doc.addPage()
  resetY()

  bold(14); center('CERTIFICATE OF SERVICE'); y += 12

  paragraph(
    `On ${certDateStr}, I ${s.client_full_name.toUpperCase()}, hereby certify that a true and correct copy of this RESPONDENT’S MOTION TO CHANGE VENUE was delivered to the Office of Chief Counsel by USPS at:`,
    11,
  )

  y += 2
  normal(11)
  left('Office of the Principal Legal Advisor,', ml + 10); y += 5
  const ccParts = s.chief_counsel_address.split('\n')
  for (const part of ccParts) {
    if (part.trim()) { left(part.trim(), ml + 10); y += 5 }
  }

  y += 20

  center('________________________'); y += 6
  bold(11); center(s.client_full_name.toUpperCase()); y += 8
  normal(11)
  center(s.client_address_street); y += 5
  center(`${s.client_address_city}, ${s.client_address_state} -${s.client_address_zip}`); y += 5
  center(s.client_phone)

  const arrayBuffer = doc.output('arraybuffer')
  return new Uint8Array(arrayBuffer)
}
