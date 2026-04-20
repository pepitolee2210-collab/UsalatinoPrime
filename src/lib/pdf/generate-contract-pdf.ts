import jsPDF from 'jspdf'
import { dancingScriptBase64 } from './dancing-script-base64'

interface MinorData {
  fullName: string
  dob?: string
  birthplace?: string
  passport?: string
}

interface AddonService {
  name: string
  price: number
  etapas: string[]
}

interface PaymentScheduleItem {
  number: number
  date: string
  amount: number
}

interface ContractPDFInput {
  serviceName: string
  totalPrice: number
  installments: boolean
  installmentCount?: number
  clientFullName: string
  clientPassport: string
  clientDOB: string
  clientSignature: string
  clientAddress?: string
  clientAddressUnit?: string
  clientCity?: string
  clientState?: string
  clientZip?: string
  minors?: MinorData[]
  objetoDelContrato: string
  etapas: string[]
  addonServices?: AddonService[]
  initialPayment?: number
  paymentSchedule?: PaymentScheduleItem[]
  clientSignatureImage?: string
}

function formatDateSpanish(dateStr: string): string {
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ]
  const d = new Date(dateStr + 'T12:00:00')
  if (isNaN(d.getTime())) return dateStr
  return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`
}

function todaySpanish(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return formatDateSpanish(`${yyyy}-${mm}-${dd}`)
}

// Consistent style constants
const NAVY = [0, 40, 85] as const
const BODY_COLOR = [40, 40, 40] as const
const BODY_SIZE = 9.5
const SECTION_TITLE_SIZE = 11
const FONT = 'helvetica'
const WEIGHT = 'normal'

export function generateContractPDF(input: ContractPDFInput): jsPDF {
  const {
    serviceName, totalPrice, installments, installmentCount = 10,
    clientFullName, clientPassport, clientDOB, clientSignature,
    clientAddress, clientAddressUnit, clientCity, clientState, clientZip,
    minors, objetoDelContrato, etapas, addonServices,
    initialPayment, paymentSchedule, clientSignatureImage,
  } = input

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })

  // Register cursive font for signature only
  doc.addFileToVFS('DancingScript-Bold.ttf', dancingScriptBase64)
  doc.addFont('DancingScript-Bold.ttf', 'DancingScript', 'normal')

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - margin * 2
  let y = margin

  // Reset to body style (call after any style change)
  function bodyStyle() {
    doc.setFont(FONT, WEIGHT)
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
    doc.setFont(FONT, WEIGHT)
    doc.setFontSize(7)
    doc.setTextColor(160, 160, 160)
    doc.text('UsaLatinoPrime - Contrato de Prestaci\u00f3n de Servicios', margin, pageHeight - 12)
    const genDate = new Date().toLocaleString('es-US')
    doc.text(`Generado: ${genDate}`, pageWidth - margin, pageHeight - 12, { align: 'right' })
    doc.setDrawColor(230, 230, 230)
    doc.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16)
  }

  function sectionTitle(text: string) {
    checkPageBreak(15)
    doc.setFont(FONT, WEIGHT)
    doc.setFontSize(SECTION_TITLE_SIZE)
    doc.setTextColor(...NAVY)
    doc.text(text, margin, y)
    y += 1.5
    doc.setDrawColor(229, 231, 235)
    doc.setLineWidth(0.3)
    doc.line(margin, y, pageWidth - margin, y)
    y += 6
    bodyStyle()
  }

  function fieldLine(label: string, value: string) {
    checkPageBreak(8)
    bodyStyle()
    doc.text(`${label}  ${value}`, margin + 2, y)
    y += 6
  }

  function paragraph(text: string) {
    bodyStyle()
    const lines = doc.splitTextToSize(text, contentWidth - 4)
    checkPageBreak(lines.length * 4 + 5)
    doc.text(lines, margin + 2, y)
    y += lines.length * 4 + 6
  }

  // === HEADER ===
  doc.setFont(FONT, WEIGHT)
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
  doc.setFont(FONT, WEIGHT)
  doc.setFontSize(13)
  doc.setTextColor(...NAVY)
  doc.text('CONTRATO DE PRESTACI\u00d3N DE SERVICIOS', pageWidth / 2, y, { align: 'center' })
  y += 7
  doc.setFontSize(11)
  const allServiceNames = addonServices && addonServices.length > 0
    ? `${serviceName.toUpperCase()} + ${addonServices.map(a => a.name.toUpperCase()).join(' + ')}`
    : serviceName.toUpperCase()
  const titleLines = doc.splitTextToSize(allServiceNames, contentWidth - 20)
  doc.text(titleLines, pageWidth / 2, y, { align: 'center' })
  y += titleLines.length * 5 + 5

  // Date
  bodyStyle()
  doc.text(`Fecha: ${todaySpanish()}`, margin, y)
  y += 10

  // === PARTES DEL CONTRATO ===
  sectionTitle('PARTES DEL CONTRATO')

  // Consultor
  bodyStyle()
  doc.text('EL CONSULTOR:', margin + 2, y)
  y += 6
  fieldLine('Empresa:', 'USA LATINO PRIME')
  fieldLine('Representante:', 'Jimy Henry Orellana Dom\u00ednguez')
  fieldLine('Tel\u00e9fono:', '801-941-3479')
  fieldLine('Zelle:', '801-941-3479')
  y += 4

  // Cliente
  doc.text('EL CLIENTE:', margin + 2, y)
  y += 6
  fieldLine('Nombre completo:', clientFullName)
  fieldLine('Pasaporte:', clientPassport)
  fieldLine('Fecha de nacimiento:', formatDateSpanish(clientDOB))
  if (clientAddress) {
    const streetLine = clientAddressUnit
      ? `${clientAddress}, ${clientAddressUnit}`
      : clientAddress
    fieldLine('Dirección:', streetLine)
    const cityState = [clientCity, clientState].filter(Boolean).join(', ')
    const cityStateZip = cityState + (clientZip ? ` ${clientZip}` : '')
    if (cityStateZip) fieldLine('Ciudad, estado, ZIP:', cityStateZip)
  }
  y += 4

  // Minors (if applicable)
  if (minors && minors.length > 0) {
    const title = minors.length === 1 ? 'MENOR BENEFICIARIO/A:' : 'MENORES BENEFICIARIOS/AS:'
    doc.text(title, margin + 2, y)
    y += 6

    minors.forEach((minor, i) => {
      if (minors.length > 1) {
        checkPageBreak(30)
        bodyStyle()
        doc.text(`Hijo/a #${i + 1}:`, margin + 4, y)
        y += 6
      }
      fieldLine('Nombre completo:', minor.fullName)
      if (minor.dob) fieldLine('Fecha de nacimiento:', formatDateSpanish(minor.dob))
      if (minor.birthplace) fieldLine('Lugar de nacimiento:', minor.birthplace)
      if (minor.passport) fieldLine('Pasaporte:', minor.passport)
      y += 3
    })
    y += 2
  }

  // === OBJETO DEL CONTRATO ===
  sectionTitle('OBJETO DEL CONTRATO')
  paragraph(objetoDelContrato)

  // === ALCANCE DEL SERVICIO ===
  sectionTitle('ALCANCE DEL SERVICIO')
  bodyStyle()
  doc.text('El servicio comprende las siguientes etapas:', margin + 2, y)
  y += 6

  etapas.forEach((etapa, i) => {
    bodyStyle()
    const etapaText = `${i + 1}. ${etapa}`
    const etapaLines = doc.splitTextToSize(etapaText, contentWidth - 8)
    checkPageBreak(etapaLines.length * 4 + 3)
    doc.text(etapaLines, margin + 4, y)
    y += etapaLines.length * 4 + 2
  })
  y += 4

  // === SERVICIOS ADICIONALES ===
  if (addonServices && addonServices.length > 0) {
    addonServices.forEach((addon) => {
      sectionTitle(`SERVICIO ADICIONAL: ${addon.name.toUpperCase()}`)
      bodyStyle()
      doc.text('El servicio adicional comprende las siguientes etapas:', margin + 2, y)
      y += 6
      addon.etapas.forEach((etapa, i) => {
        bodyStyle()
        const etapaText = `${i + 1}. ${etapa}`
        const etapaLines = doc.splitTextToSize(etapaText, contentWidth - 8)
        checkPageBreak(etapaLines.length * 4 + 3)
        doc.text(etapaLines, margin + 4, y)
        y += etapaLines.length * 4 + 2
      })
      y += 4
    })
  }

  // === HONORARIOS ===
  sectionTitle('HONORARIOS Y FORMA DE PAGO')
  if (installments) {
    const remaining = initialPayment ? totalPrice - initialPayment : totalPrice
    const monthly = Math.round(remaining / installmentCount)

    if (initialPayment && initialPayment > 0) {
      paragraph(
        `Los honorarios por los servicios descritos en este contrato ascienden a un total de $${totalPrice.toLocaleString()} USD. ` +
        `El CLIENTE realizar\u00e1 un pago inicial de $${initialPayment.toLocaleString()} USD al momento de la firma del contrato, ` +
        `y el saldo restante de $${remaining.toLocaleString()} USD ser\u00e1 pagadero en ${installmentCount} cuotas mensuales de $${monthly.toLocaleString()} USD cada una.`
      )
    } else {
      paragraph(
        `Los honorarios por los servicios descritos en este contrato ascienden a un total de $${totalPrice.toLocaleString()} USD, ` +
        `pagaderos en ${installmentCount} cuotas mensuales de $${monthly.toLocaleString()} USD cada una.`
      )
    }
  } else {
    paragraph(
      `Los honorarios por los servicios descritos en este contrato ascienden a un total de $${totalPrice.toLocaleString()} USD, ` +
      `pagaderos en un pago \u00fanico al momento de la contrataci\u00f3n del servicio.`
    )
  }
  bodyStyle()
  doc.text('M\u00e9todo de pago: Zelle al 801-941-3479', margin + 2, y)
  y += 8

  // === CRONOGRAMA DE PAGOS ===
  if (paymentSchedule && paymentSchedule.length > 0) {
    sectionTitle('CRONOGRAMA DE PAGOS')
    paragraph(
      'Las fechas de pago de cada cuota ser\u00e1n las indicadas a continuaci\u00f3n. El CLIENTE se compromete a realizar cada pago en la fecha establecida o antes de la misma.'
    )

    // Table header
    const col1X = margin + 2
    const col2X = margin + 45
    const col3X = margin + 115
    checkPageBreak(12)
    doc.setFont(FONT, 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...NAVY)
    doc.text('CUOTA', col1X, y)
    doc.text('FECHA DE PAGO', col2X, y)
    doc.text('MONTO', col3X, y)
    y += 2
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.2)
    doc.line(col1X, y, pageWidth - margin, y)
    y += 4

    // Table rows
    let runningTotal = 0
    paymentSchedule.forEach((item) => {
      checkPageBreak(7)
      bodyStyle()
      doc.setFontSize(8.5)
      const label = item.number === 0 ? 'Cuota inicial' : `Cuota ${item.number}`
      doc.text(label, col1X, y)
      doc.text(formatDateSpanish(item.date), col2X, y)
      doc.text(`$${item.amount.toLocaleString()} USD`, col3X, y)
      runningTotal += item.amount
      y += 5
    })

    // Total line
    doc.setDrawColor(200, 200, 200)
    doc.line(col1X, y, pageWidth - margin, y)
    y += 4
    doc.setFont(FONT, 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...NAVY)
    doc.text('TOTAL', col1X, y)
    doc.text(`$${runningTotal.toLocaleString()} USD`, col3X, y)
    y += 8
    bodyStyle()
  }

  // === GASTOS INCLUIDOS Y NO INCLUIDOS ===
  sectionTitle('GASTOS INCLUIDOS Y NO INCLUIDOS')
  paragraph(
    'Los honorarios descritos incluyen todos los costos de traducci\u00f3n, certificaci\u00f3n de documentos, ' +
    'env\u00edos postales y dem\u00e1s gastos operativos relacionados con la preparaci\u00f3n del caso. ' +
    'Dichos gastos son cubiertos en su totalidad por EL CONSULTOR como parte del servicio contratado.'
  )
  paragraph(
    'Los honorarios NO incluyen gastos gubernamentales (filing fees) que las agencias de gobierno ' +
    'requieran para procesar la solicitud. Dichos gastos ser\u00e1n responsabilidad del CLIENTE y se ' +
    'le informar\u00e1 oportunamente sobre los montos correspondientes.'
  )

  // === NATURALEZA DEL SERVICIO ===
  sectionTitle('NATURALEZA DEL SERVICIO')
  paragraph(
    'El CONSULTOR brinda servicios de asesor\u00eda y asistencia en la preparaci\u00f3n de documentos y tr\u00e1mites ' +
    'migratorios. El CONSULTOR no es abogado y no ofrece representaci\u00f3n legal ante ninguna agencia gubernamental ' +
    'ni tribunal. Los resultados del proceso dependen de las autoridades competentes y no pueden ser garantizados.'
  )

  // === OBLIGACIONES DEL CLIENTE ===
  sectionTitle('OBLIGACIONES DEL CLIENTE')
  const obligaciones = [
    'Proporcionar informaci\u00f3n veraz y completa para la preparaci\u00f3n de su caso.',
    'Entregar la documentaci\u00f3n solicitada en los plazos acordados.',
    'Realizar los pagos seg\u00fan el plan de cuotas establecido.',
    'Asistir puntualmente a todas las citas programadas.',
    'Informar al CONSULTOR de cualquier cambio en su situaci\u00f3n personal o migratoria.',
  ]
  obligaciones.forEach((obl) => {
    bodyStyle()
    const oblText = `- ${obl}`
    const oblLines = doc.splitTextToSize(oblText, contentWidth - 8)
    checkPageBreak(oblLines.length * 4 + 3)
    doc.text(oblLines, margin + 4, y)
    y += oblLines.length * 4 + 2
  })
  y += 6

  // === POLÍTICA DE CANCELACIÓN Y REEMBOLSO ===
  sectionTitle('POL\u00cdTICA DE CANCELACI\u00d3N Y REEMBOLSO')
  paragraph(
    'Una vez firmado el presente contrato, no se realizar\u00e1n devoluciones de dinero por los servicios contratados. ' +
    'Los pagos realizados corresponden al inicio y avance del trabajo de preparaci\u00f3n del caso, ' +
    'el cual comienza inmediatamente despu\u00e9s de la firma.'
  )
  paragraph(
    'Si EL CLIENTE desea dar por terminado este contrato, deber\u00e1 hacerlo \u00fanicamente por mutuo acuerdo ' +
    'con EL CONSULTOR. Para ello, EL CLIENTE enviar\u00e1 una carta escrita expresando su voluntad de ' +
    'terminar la relaci\u00f3n contractual. EL CONSULTOR evaluar\u00e1 la solicitud y ambas partes acordar\u00e1n ' +
    'los t\u00e9rminos de la terminaci\u00f3n.'
  )
  paragraph(
    'En ning\u00fan caso podr\u00e1 EL CLIENTE dar por terminado el contrato de forma unilateral sin el ' +
    'consentimiento escrito de EL CONSULTOR.'
  )

  // === CLAUSULA ESPECIAL VISA JUVENIL ===
  const isVisaJuvenil = serviceName.toLowerCase().includes('visa juvenil') || serviceName.toLowerCase().includes('sijs')
  if (isVisaJuvenil) {
    sectionTitle('CL\u00c1USULA ESPECIAL \u2013 VISA JUVENIL (SIJS)')
    paragraph(
      'El presente contrato se paralizar\u00e1 autom\u00e1ticamente, incluyendo la obligaci\u00f3n de pagos pendientes, ' +
      'en caso de que no se obtenga una resoluci\u00f3n favorable de custodia por parte del juez de la corte de Familia.'
    )
  }

  // === ACEPTACION Y FIRMAS ===
  sectionTitle('ACEPTACI\u00d3N')
  paragraph(
    'Ambas partes declaran haber le\u00eddo y comprendido el contenido de este contrato, y lo aceptan ' +
    'en todas sus partes, firmando a continuaci\u00f3n en se\u00f1al de conformidad.'
  )
  y += 8

  // Signature columns
  const colWidth = contentWidth / 2 - 10
  const leftX = margin
  const rightX = margin + contentWidth / 2 + 10

  // Calligraphy signatures above lines
  doc.setFont('DancingScript', 'normal')
  doc.setFontSize(22)
  doc.setTextColor(20, 20, 80)
  doc.text('Jimy Henry Orellana', leftX + 2, y)

  if (clientSignatureImage) {
    // Draw the real signature image from canvas
    try {
      const sigWidth = colWidth - 4
      const sigHeight = 18
      doc.addImage(clientSignatureImage, 'PNG', rightX + 2, y - 14, sigWidth, sigHeight)
    } catch {
      // Fallback to text if image fails
      if (clientSignature.trim()) {
        doc.text(clientSignature, rightX + 2, y)
      }
    }
  } else if (clientSignature.trim()) {
    doc.text(clientSignature, rightX + 2, y)
  }
  y += 8

  // Signature lines
  doc.setDrawColor(150, 150, 150)
  doc.setLineWidth(0.3)
  doc.line(leftX, y, leftX + colWidth, y)
  doc.line(rightX, y, rightX + colWidth, y)
  y += 5

  // Labels and names - same body style
  bodyStyle()
  doc.text('EL CONSULTOR', leftX, y)
  doc.text('EL CLIENTE', rightX, y)
  y += 5
  doc.text('Jimy Henry Orellana Dom\u00ednguez', leftX, y)
  doc.text(clientFullName, rightX, y)
  y += 4
  doc.text('USA LATINO PRIME', leftX, y)

  // Footer on last page
  addFooter()

  return doc
}
