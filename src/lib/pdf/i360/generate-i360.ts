import { PDFDocument, PDFName, PDFDict, PDFBool } from 'pdf-lib'
import bwipjs from 'bwip-js/browser'

// ============================================================================
// HELPERS
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const digitsOnly = (v: any): string => String(v ?? '').replace(/\D/g, '')

/** yyyy-mm-dd → mm/dd/yyyy (formato USCIS). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatDate(v: any): string {
  const s = String(v ?? '')
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return `${m[2]}/${m[3]}/${m[1]}`
  return s
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isYes(v: any): boolean {
  if (v === true || v === 1) return true
  const s = String(v ?? '').trim().toLowerCase()
  return s === 'sí' || s === 'si' || s === 'yes' || s === 'true' || s === '1'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isNo(v: any): boolean {
  if (v === false || v === 0) return true
  const s = String(v ?? '').trim().toLowerCase()
  return s === 'no' || s === 'false' || s === '0'
}

// ============================================================================
// MAPEO TEXT FIELDS — wizardKey → nombre XFA del PDF oficial USCIS I-360
// ============================================================================
//
// El PDF base ahora es el oficial USCIS normalizado (510 fields). Mapeamos
// solo los keys del wizard a sus nombres XFA-style correspondientes; los
// otros ~440 campos del PDF quedan editables vacíos para que Henry/Diana los
// llenen a mano.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TextEntry = { pdfName: string; dataKey: string; transform?: (v: any) => string }

const TEXT_FIELDS: TextEntry[] = [
  // Part 1 — Peticionario (página 1)
  { pdfName: 'form1[0].#subform[0].Pt1Line1_FamilyName[0]',                       dataKey: 'petitioner_last_name' },
  { pdfName: 'form1[0].#subform[0].Pt1Line1_GivenName[0]',                        dataKey: 'petitioner_first_name' },
  { pdfName: 'form1[0].#subform[0].Pt1Line1_MiddleName[0]',                       dataKey: 'petitioner_middle_name' },
  { pdfName: 'form1[0].#subform[0].#area[1].Pt1Line3_SSN[0]',                     dataKey: 'petitioner_ssn',      transform: digitsOnly },
  { pdfName: 'form1[0].#subform[0].#area[2].Pt1Line4_AlienNumber[0]',             dataKey: 'petitioner_a_number', transform: digitsOnly },
  { pdfName: 'form1[0].#subform[0].Pt1Line6_StreetNumberName[0]',                 dataKey: 'petitioner_address' },
  { pdfName: 'form1[0].#subform[0].Pt1Line6_CityOrTown[0]',                       dataKey: 'petitioner_city' },
  { pdfName: 'form1[0].#subform[0].Pt1Line6_ZipCode[0]',                          dataKey: 'petitioner_zip' },
  // Safe Mailing (Part 1 Line 7, página 2)
  { pdfName: 'form1[0].#subform[1].Pt1Line7_InCareofName[0]',                     dataKey: 'safe_mailing_name' },
  { pdfName: 'form1[0].#subform[1].Pt1Line7_StreetNumberName[0]',                 dataKey: 'safe_mailing_address' },
  { pdfName: 'form1[0].#subform[1].Pt1Line7_CityOrTown[0]',                       dataKey: 'safe_mailing_city' },
  { pdfName: 'form1[0].#subform[1].Pt1Line7_ZipCode[0]',                          dataKey: 'safe_mailing_zip' },
  // Part 3 — Beneficiario (página 3)
  { pdfName: 'form1[0].#subform[2].Pt3Line1_FamilyName[0]',                       dataKey: 'beneficiary_last_name' },
  { pdfName: 'form1[0].#subform[2].Pt3Line1_GivenName[0]',                        dataKey: 'beneficiary_first_name' },
  { pdfName: 'form1[0].#subform[2].Pt3Line1_MiddleName[0]',                       dataKey: 'beneficiary_middle_name' },
  { pdfName: 'form1[0].#subform[2].Pt3Line3_DateOfBirth[0]',                      dataKey: 'beneficiary_dob',               transform: formatDate },
  { pdfName: 'form1[0].#subform[2].#area[3].Pt3Line5_SSN[0]',                     dataKey: 'beneficiary_ssn',               transform: digitsOnly },
  { pdfName: 'form1[0].#subform[2].Pt3Line4_CountryOfBirth[0]',                   dataKey: 'beneficiary_country_birth' },
  { pdfName: 'form1[0].#subform[2].Line3_ANumber[0].Pt3Line6_AlienNumber[0]',     dataKey: 'beneficiary_a_number',          transform: digitsOnly },
  { pdfName: 'form1[0].#subform[2].Pt3Line8_DateOfLastArrival[0]',                dataKey: 'beneficiary_last_arrival_date', transform: formatDate },
  { pdfName: 'form1[0].#subform[2].#area[5].Pt3Line9_I94[0]',                     dataKey: 'beneficiary_i94_number',        transform: digitsOnly },
  { pdfName: 'form1[0].#subform[2].Pt3Line10_Passport[0]',                        dataKey: 'beneficiary_passport_number' },
  { pdfName: 'form1[0].#subform[2].Pt3Line12_CountryOfIssuanceDocument[0]',       dataKey: 'beneficiary_passport_country' },
  { pdfName: 'form1[0].#subform[2].Pt3Line13_ExpDate[0]',                         dataKey: 'beneficiary_passport_expiry',   transform: formatDate },
  { pdfName: 'form1[0].#subform[2].Pt3Line14_CurrentUSCISStatus[0]',              dataKey: 'beneficiary_nonimmigrant_status' },
  { pdfName: 'form1[0].#subform[2].Pt3Line15_DateOfExpired[0]',                   dataKey: 'beneficiary_i94_expiry',        transform: formatDate },
  { pdfName: 'form1[0].#subform[2].Pt3Line2_StreetNumberName[0]',                 dataKey: 'beneficiary_address' },
  { pdfName: 'form1[0].#subform[2].Pt3Line2_CityOrTown[0]',                       dataKey: 'beneficiary_city' },
  { pdfName: 'form1[0].#subform[2].Pt3Line2_ZipCode[0]',                          dataKey: 'beneficiary_zip' },
  { pdfName: 'form1[0].#subform[2].Pt4Line1a_CityOrTown[0]',                      dataKey: 'beneficiary_city_birth' },
  // Part 4 — Padre extranjero (página 4)
  { pdfName: 'form1[0].#subform[3].Pt4Line2a_FamilyName[0]',                      dataKey: 'foreign_parent_last_name' },
  { pdfName: 'form1[0].#subform[3].Pt4Line2a_GivenName[0]',                       dataKey: 'foreign_parent_first_name' },
  { pdfName: 'form1[0].#subform[3].Pt4Line2a_MiddleName[0]',                      dataKey: 'foreign_parent_middle_name' },
  { pdfName: 'form1[0].#subform[3].Pt4Line2b_StreetNumberName[0]',                dataKey: 'foreign_parent_address' },
  { pdfName: 'form1[0].#subform[3].Pt4Line2b_CityOrTown[0]',                      dataKey: 'foreign_parent_city' },
  { pdfName: 'form1[0].#subform[3].Pt4Line2b_PostalCode[0]',                      dataKey: 'foreign_parent_postal' },
  { pdfName: 'form1[0].#subform[3].Pt4Line2b_Country[0]',                         dataKey: 'foreign_parent_country' },
  { pdfName: 'form1[0].#subform[3].Pt4Line2b_Province[0]',                        dataKey: 'foreign_parent_province' },
  // Part 8 — SIJS (página 8)
  { pdfName: 'form1[0].#subform[7].Pt8Line2b_Name[0]',                            dataKey: 'state_agency_name' },
  // Part 11 — Contacto del peticionario
  { pdfName: 'form1[0].#subform[15].Pt11Line3_DaytimePhoneNumber1[0]',            dataKey: 'petitioner_phone',   transform: digitsOnly },
  { pdfName: 'form1[0].#subform[15].Pt11Line4_MobileNumber1[0]',                  dataKey: 'petitioner_mobile',  transform: digitsOnly },
  { pdfName: 'form1[0].#subform[15].Pt11Line5_Email[0]',                          dataKey: 'petitioner_email' },
  { pdfName: 'form1[0].#subform[14].Pt11Line1b_Language[0]',                      dataKey: 'language_understood' },
  // Part 14 — Información adicional
  { pdfName: 'form1[0].#subform[20].Pt14Line3d_AdditionalInfo[0]',                dataKey: 'additional_info' },
]

// ============================================================================
// MAPEO DROPDOWN STATES — wizardKey → nombre XFA del PDF oficial
// ============================================================================

const STATE_DROPDOWNS: { pdfName: string; dataKey: string }[] = [
  { pdfName: 'form1[0].#subform[0].Pt1Line6_State[0]', dataKey: 'petitioner_state' },
  { pdfName: 'form1[0].#subform[1].Pt1Line7_State[0]', dataKey: 'safe_mailing_state' },
  { pdfName: 'form1[0].#subform[2].Pt3Line2_State[0]', dataKey: 'beneficiary_state' },
]

// ============================================================================
// MAPEO CHECKBOXES — wizardKey → nombre XFA del PDF oficial
// ============================================================================
//
// Pattern: Yes/No checkboxes están agrupados como Pt#Line#[0]=Yes, [1]=No
// Multi-option checkboxes (sexo, estado civil) usan índices fijos.

const YES_NO_CHECKBOXES: { yesName: string; noName: string; dataKey: string }[] = [
  // Part 4 — Procesamiento (página 4)
  { yesName: 'form1[0].#subform[3].Pt4Line4a[0]', noName: 'form1[0].#subform[3].Pt4Line4a[1]', dataKey: 'in_removal_proceedings' },
  { yesName: 'form1[0].#subform[3].Pt4Line5[0]',  noName: 'form1[0].#subform[3].Pt4Line5[1]',  dataKey: 'other_petitions' },
  { yesName: 'form1[0].#subform[3].Pt4Line6[0]',  noName: 'form1[0].#subform[3].Pt4Line6[1]',  dataKey: 'worked_without_permission' },
  { yesName: 'form1[0].#subform[3].Pt4Line7[0]',  noName: 'form1[0].#subform[3].Pt4Line7[1]',  dataKey: 'adjustment_attached' },
  // Part 5 — Cónyuge/Hijos (página 4)
  { yesName: 'form1[0].#subform[3].Pt5Line1_Checkbox[0]', noName: 'form1[0].#subform[3].Pt5Line1_Checkbox[1]', dataKey: 'children_filed_separate' },
  // Part 8 — SIJS (páginas 8-9)
  { yesName: 'form1[0].#subform[7].Pt8Line2a[0]',  noName: 'form1[0].#subform[7].Pt8Line2a[1]',  dataKey: 'declared_dependent_court' },
  { yesName: 'form1[0].#subform[7].Pt8Line2c[0]',  noName: 'form1[0].#subform[7].Pt8Line2c[1]',  dataKey: 'currently_under_jurisdiction' },
  { yesName: 'form1[0].#subform[8].Pt8Line3a[0]',  noName: 'form1[0].#subform[8].Pt8Line3a[1]',  dataKey: 'in_court_ordered_placement' },
  { yesName: 'form1[0].#subform[8].Pt8Line4a[0]',  noName: 'form1[0].#subform[8].Pt8Line4a[1]',  dataKey: 'best_interest_not_return' },
  { yesName: 'form1[0].#subform[8].Pt8Line6a[0]',  noName: 'form1[0].#subform[8].Pt8Line6a[1]',  dataKey: 'previously_hhs_custody' },
  // Part 11 — Intérprete (página 14)
  { yesName: 'form1[0].#subform[14].Pt11Line1_Checkbox[0]', noName: 'form1[0].#subform[14].Pt11Line1_Checkbox[1]', dataKey: 'interpreter_needed' },
]

// Sexo: 0=Male, 1=Female (Pt4Line3_Sex)
const SEX_CHECKBOX: Record<string, string> = {
  Masculino: 'form1[0].#subform[3].Pt4Line3_Sex[0]',
  Femenino:  'form1[0].#subform[3].Pt4Line3_Sex[1]',
}

// Estado civil: 0=Single, 1=Married, 2=Divorced, 3=Widowed (Pt3Line7_MaritalStatus)
const MARITAL_CHECKBOX: Record<string, string> = {
  'Soltero/a':    'form1[0].#subform[2].Pt3Line7_MaritalStatus[0]',
  'Casado/a':     'form1[0].#subform[2].Pt3Line7_MaritalStatus[1]',
  'Divorciado/a': 'form1[0].#subform[2].Pt3Line7_MaritalStatus[2]',
  'Viudo/a':      'form1[0].#subform[2].Pt3Line7_MaritalStatus[3]',
}

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================

export async function generateI360PDF(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData: Record<string, any>,
): Promise<Uint8Array> {
  const response = await fetch('/forms/i-360.pdf')
  if (!response.ok) {
    throw new Error(`No se pudo cargar la plantilla I-360: ${response.statusText}`)
  }

  const pdfDoc = await PDFDocument.load(await response.arrayBuffer())
  const form = pdfDoc.getForm()

  // --- 1. Text fields ---
  for (const entry of TEXT_FIELDS) {
    const raw = formData[entry.dataKey]
    if (raw == null || raw === '') continue
    const value = entry.transform ? entry.transform(raw) : String(raw)
    if (!value) continue
    try {
      const field = form.getTextField(entry.pdfName)
      const maxLength = field.getMaxLength()
      field.setText(maxLength != null ? value.substring(0, maxLength) : value)
    } catch (err) {
      console.warn(`I-360: no se llenó text "${entry.pdfName}":`, err instanceof Error ? err.message : err)
    }
  }

  // --- 2. State dropdowns (USCIS use uppercase 2-letter codes) ---
  for (const entry of STATE_DROPDOWNS) {
    const raw = formData[entry.dataKey]
    if (raw == null || raw === '') continue
    const value = String(raw).trim().toUpperCase()
    if (!value || value.length !== 2) continue
    try {
      const dd = form.getDropdown(entry.pdfName)
      const options = dd.getOptions()
      if (options.includes(value)) dd.select(value)
    } catch (err) {
      console.warn(`I-360: no se llenó dropdown "${entry.pdfName}":`, err instanceof Error ? err.message : err)
    }
  }

  // --- 3. Yes/No checkboxes ---
  for (const entry of YES_NO_CHECKBOXES) {
    const raw = formData[entry.dataKey]
    if (raw == null || raw === '') continue
    let target: string | null = null
    if (isYes(raw)) target = entry.yesName
    else if (isNo(raw)) target = entry.noName
    if (!target) continue
    try {
      form.getCheckBox(target).check()
    } catch (err) {
      console.warn(`I-360: no se marcó checkbox "${target}":`, err instanceof Error ? err.message : err)
    }
  }

  // --- 4. Sex checkbox ---
  const sexName = SEX_CHECKBOX[formData.beneficiary_sex]
  if (sexName) {
    try { form.getCheckBox(sexName).check() } catch (err) {
      console.warn(`I-360: no se marcó sex "${sexName}":`, err instanceof Error ? err.message : err)
    }
  }

  // --- 5. Marital status checkbox ---
  const maritalName = MARITAL_CHECKBOX[formData.beneficiary_marital_status]
  if (maritalName) {
    try { form.getCheckBox(maritalName).check() } catch (err) {
      console.warn(`I-360: no se marcó marital "${maritalName}":`, err instanceof Error ? err.message : err)
    }
  }

  // --- 6. Rendear PDF417 barcodes ---
  // El PDF oficial USCIS es XFA-híbrido — el XFA original rendea los barcodes
  // visualmente, pero pdf-lib elimina el XFA al cargar. Sin esto, USCIS puede
  // rechazar el formulario (el barcode codifica I-360|MM/DD/YY|page y se usa
  // para escanear/clasificar el documento).
  await renderBarcodes(pdfDoc, form)

  // --- 7. Guardar manteniendo el AcroForm editable ---
  // No flattenear: la firma necesita poder corregir manualmente campos mal
  // autocompletados o que aún no estén mapeados al wizard. NeedAppearances=true
  // le dice al viewer que regenere appearances al abrir (los valores se ven y
  // los fields siguen editables).
  const acroForm = pdfDoc.catalog.lookup(PDFName.of('AcroForm'))
  if (acroForm instanceof PDFDict) {
    acroForm.set(PDFName.of('NeedAppearances'), PDFBool.True)
  }
  return pdfDoc.save()
}

// ============================================================================
// PDF417 BARCODES
// ============================================================================

/**
 * Localiza todos los widgets cuyo nombre contiene "BarCode" (PDF417 generados
 * por el XFA original, perdido al cargar con pdf-lib) y los reemplaza por una
 * imagen PNG del PDF417 generada con bwip-js. Sin esto USCIS puede rechazar el
 * formulario porque el barcode contiene metadata que sus escáneres leen.
 */
async function renderBarcodes(
  pdfDoc: PDFDocument,
  form: ReturnType<PDFDocument['getForm']>,
): Promise<void> {
  const pages = pdfDoc.getPages()
  const pageMap = new Map<string, number>()
  pages.forEach((p, i) => pageMap.set(p.ref.toString(), i))

  for (const field of form.getFields()) {
    if (!field.getName().includes('BarCode')) continue

    let textValue: string | null = null
    try { textValue = (field as { getText?: () => string }).getText?.() ?? null } catch { /* not a text field */ }
    if (!textValue) continue

    const widgets = field.acroField.getWidgets()
    for (const w of widgets) {
      const pRef = w.P()
      const pageIdx = pRef ? pageMap.get(pRef.toString()) ?? -1 : -1
      if (pageIdx < 0) continue
      const rect = w.getRectangle()
      if (!rect) continue

      try {
        // bwip-js corre client-side via canvas.toBlob().
        const png = await generatePdf417Png(textValue)
        const img = await pdfDoc.embedPng(png)
        pages[pageIdx].drawImage(img, {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        })
        // Limpiar el texto del field — el barcode visual lo cubre, pero si
        // el viewer regenera appearances, no queremos que se vea el texto plano.
        try { (field as { setText?: (v: string) => void }).setText?.('') } catch { /* ignore */ }
      } catch (err) {
        console.warn(`I-360: no se rendeó barcode "${field.getName()}":`, err instanceof Error ? err.message : err)
      }
    }
  }
}

/**
 * Genera un PNG con el barcode PDF417 codificando `text`. Funciona en browser
 * (toCanvas + canvas.toBlob). Las opciones específicas de PDF417 (eclevel,
 * columns) no están en la interface tipada de bwip-js, así que cast a `any`.
 */
async function generatePdf417Png(text: string): Promise<Uint8Array> {
  if (typeof document === 'undefined') {
    throw new Error('generatePdf417Png requiere un entorno browser con `document`')
  }
  const canvas = document.createElement('canvas')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bwipjs.toCanvas(canvas, {
    bcid: 'pdf417',
    text,
    scale: 2,
    eclevel: 2,
    columns: 8,
  } as any)
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob falló'))), 'image/png')
  })
  return new Uint8Array(await blob.arrayBuffer())
}
