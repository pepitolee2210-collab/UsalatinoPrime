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

interface ContractPDFInput {
  serviceName: string
  totalPrice: number
  installments: boolean
  installmentCount?: number
  clientFullName: string
  clientPassport: string
  clientDOB: string
  clientSignature: string
  minors?: MinorData[]
  objetoDelContrato: string
  etapas: string[]
  addonServices?: AddonService[]
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
    minors, objetoDelContrato, etapas, addonServices,
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
    doc.text('UsaLatinoPrime - Contrato de Prestacion de Servicios', margin, pageHeight - 12)
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
  doc.text('CONTRATO DE PRESTACION DE SERVICIOS', pageWidth / 2, y, { align: 'center' })
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
  fieldLine('Representante:', 'Jimy Henry Orellana Dominguez')
  fieldLine('Telefono:', '801-941-3479')
  fieldLine('Zelle:', '801-941-3479')
  y += 4

  // Cliente
  doc.text('EL CLIENTE:', margin + 2, y)
  y += 6
  fieldLine('Nombre completo:', clientFullName)
  fieldLine('Pasaporte:', clientPassport)
  fieldLine('Fecha de nacimiento:', formatDateSpanish(clientDOB))
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
    const monthly = Math.round(totalPrice / installmentCount)
    paragraph(
      `Los honorarios por los servicios descritos en este contrato ascienden a un total de $${totalPrice.toLocaleString()} USD, ` +
      `pagaderos en ${installmentCount} cuotas mensuales de $${monthly.toLocaleString()} USD cada una.`
    )
  } else {
    paragraph(
      `Los honorarios por los servicios descritos en este contrato ascienden a un total de $${totalPrice.toLocaleString()} USD, ` +
      `pagaderos en un pago unico al momento de la contratacion del servicio.`
    )
  }
  bodyStyle()
  doc.text('Metodo de pago: Zelle al 801-941-3479', margin + 2, y)
  y += 8

  // === GASTOS INCLUIDOS Y NO INCLUIDOS ===
  sectionTitle('GASTOS INCLUIDOS Y NO INCLUIDOS')
  paragraph(
    'Los honorarios descritos incluyen todos los costos de traduccion, certificacion de documentos, ' +
    'envios postales y demas gastos operativos relacionados con la preparacion del caso. ' +
    'Dichos gastos son cubiertos en su totalidad por EL CONSULTOR como parte del servicio contratado.'
  )
  paragraph(
    'Los honorarios NO incluyen gastos gubernamentales (filing fees) que las agencias de gobierno ' +
    'requieran para procesar la solicitud. Dichos gastos seran responsabilidad del CLIENTE y se ' +
    'le informara oportunamente sobre los montos correspondientes.'
  )

  // === NATURALEZA DEL SERVICIO ===
  sectionTitle('NATURALEZA DEL SERVICIO')
  paragraph(
    'El CONSULTOR brinda servicios de asesoria y asistencia en la preparacion de documentos y tramites ' +
    'migratorios. El CONSULTOR no es abogado y no ofrece representacion legal ante ninguna agencia gubernamental ' +
    'ni tribunal. Los resultados del proceso dependen de las autoridades competentes y no pueden ser garantizados.'
  )

  // === OBLIGACIONES DEL CLIENTE ===
  sectionTitle('OBLIGACIONES DEL CLIENTE')
  const obligaciones = [
    'Proporcionar informacion veraz y completa para la preparacion de su caso.',
    'Entregar la documentacion solicitada en los plazos acordados.',
    'Realizar los pagos segun el plan de cuotas establecido.',
    'Asistir puntualmente a todas las citas programadas.',
    'Informar al CONSULTOR de cualquier cambio en su situacion personal o migratoria.',
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

  // === ACEPTACION Y FIRMAS ===
  sectionTitle('ACEPTACION')
  paragraph(
    'Ambas partes declaran haber leido y comprendido el contenido de este contrato, y lo aceptan ' +
    'en todas sus partes, firmando a continuacion en senal de conformidad.'
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
  if (clientSignature.trim()) {
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
  doc.text('Jimy Henry Orellana Dominguez', leftX, y)
  doc.text(clientFullName, rightX, y)
  y += 4
  doc.text('USA LATINO PRIME', leftX, y)

  // Footer on last page
  addFooter()

  return doc
}
