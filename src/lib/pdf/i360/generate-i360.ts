import { PDFDocument } from 'pdf-lib'

type FieldEntry = {
  dataKey: string
  transform?: (value: any) => string
}

/**
 * Helper: extrae solo los dígitos de un valor (para SSN, A-Number, etc.)
 */
const digitsOnly = (v: any): string => String(v ?? '').replace(/\D/g, '')

/**
 * Mapeo: nombre del campo AcroForm en el PDF → clave en form_data (I360Data)
 *
 * Las claves son los IDs actuales de los campos en el PDF template.
 * Los nombres aleatorios (text_XXyyyy) deberían ser renombrados en el PDF
 * a nombres descriptivos. Mientras tanto, este mapeo traduce los IDs al
 * campo de la base de datos correspondiente.
 */
const FIELD_MAP: Record<string, FieldEntry> = {
  // ==================== PÁGINA 1 — PART 1: PETICIONARIO ====================
  'last_name':   { dataKey: 'petitioner_last_name' },   // Family Name
  'first_name':  { dataKey: 'petitioner_first_name' },  // Given Name
  'middle_name': { dataKey: 'petitioner_middle_name' }, // Middle Name
  'ssn':         { dataKey: 'petitioner_ssn',      transform: digitsOnly }, // 9 dígitos
  'arn':         { dataKey: 'petitioner_a_number', transform: digitsOnly }, // 9 dígitos
  'text_6mtkf':  { dataKey: 'petitioner_address' },     // Dirección (street) - sugerido renombrar a "petitioner_address"
  'text_7aisj':  { dataKey: 'petitioner_city' },        // Ciudad - sugerido "petitioner_city"
  'text_8vdmy':  { dataKey: 'petitioner_state' },       // Estado (2 letras) - sugerido "petitioner_state"
  'text_9tisb':  { dataKey: 'petitioner_zip' },         // ZIP - sugerido "petitioner_zip"

  // ==================== PÁGINA 2 — PART 1 cont: DIRECCIÓN SEGURA ====================
  'text_10bvqh': { dataKey: 'safe_mailing_name' },    // "In Care Of Name" - sugerido "safe_mailing_name"
  'text_11uczc': { dataKey: 'safe_mailing_address' }, // Street address segura - sugerido "safe_mailing_address"
  'text_12jvrz': { dataKey: 'safe_mailing_city' },    // Ciudad segura - sugerido "safe_mailing_city"
  'text_13gtui': { dataKey: 'safe_mailing_state' },   // Estado seguro - sugerido "safe_mailing_state"
  'text_14gdza': { dataKey: 'safe_mailing_zip' },     // ZIP seguro - sugerido "safe_mailing_zip"

  // ==================== PÁGINA 3 — PART 3: BENEFICIARIO (MENOR) ====================
  'text_15icyi': { dataKey: 'beneficiary_last_name' },        // sugerido "beneficiary_last_name"
  'text_16ccgi': { dataKey: 'beneficiary_first_name' },       // sugerido "beneficiary_first_name"
  'text_17dfu':  { dataKey: 'beneficiary_middle_name' },      // sugerido "beneficiary_middle_name"
  'text_18ezby': { dataKey: 'other_names' },                  // Otros nombres usados - sugerido "other_names"
  'text_19oyca': { dataKey: 'beneficiary_address' },          // Dirección del menor - sugerido "beneficiary_address"
  'text_20jbkf': { dataKey: 'beneficiary_city' },             // Ciudad - sugerido "beneficiary_city"
  'text_23rdoo': { dataKey: 'beneficiary_state' },            // Estado - sugerido "beneficiary_state"
  'text_24ncxy': { dataKey: 'beneficiary_zip' },              // ZIP - sugerido "beneficiary_zip"
  'text_25wcdm': { dataKey: 'beneficiary_dob' },              // Fecha nac. - sugerido "beneficiary_dob"
  'text_26ibbd': { dataKey: 'beneficiary_country_birth' },    // País nac. - sugerido "beneficiary_country_birth"
  'text_27boat': { dataKey: 'beneficiary_ssn',      transform: digitsOnly }, // 9 dígitos - sugerido "beneficiary_ssn"
  'text_28xvqk': { dataKey: 'beneficiary_a_number', transform: digitsOnly }, // 9 dígitos - sugerido "beneficiary_a_number"
  'text_29bxao': { dataKey: 'beneficiary_city_birth' },       // Ciudad nac. - sugerido "beneficiary_city_birth"
  'text_30xece': { dataKey: 'beneficiary_i94_number', transform: digitsOnly }, // 11 dígitos - sugerido "beneficiary_i94_number"
  'text_31ubma': { dataKey: 'beneficiary_passport_number' },  // Núm. pasaporte - sugerido "beneficiary_passport_number"
  'text_32cidv': { dataKey: 'beneficiary_passport_country' }, // País pasaporte - sugerido "beneficiary_passport_country"
  'text_33trwg': { dataKey: 'beneficiary_nonimmigrant_status' }, // Status - sugerido "beneficiary_nonimmigrant_status"
  'text_34egnj': { dataKey: 'beneficiary_passport_expiry' },  // Exp. pasaporte - sugerido "beneficiary_passport_expiry"
  'text_35tgqr': { dataKey: 'beneficiary_status_expiry' },    // Exp. status - sugerido "beneficiary_status_expiry"

  // ==================== PÁGINA 4 — PART 4: PROCESAMIENTO (PADRE EXTRANJERO) ====================
  'text_36mxxm': { dataKey: 'foreign_parent_last_name' },   // sugerido "foreign_parent_last_name"
  'text_37gc':   { dataKey: 'foreign_parent_first_name' },  // sugerido "foreign_parent_first_name"
  'text_40byag': { dataKey: 'foreign_parent_middle_name' }, // sugerido "foreign_parent_middle_name"
  'text_41bdlw': { dataKey: 'foreign_parent_country' },     // País - sugerido "foreign_parent_country"
  'text_42ipfd': { dataKey: 'foreign_parent_address' },     // Dirección - sugerido "foreign_parent_address"
  'text_43insh': { dataKey: 'foreign_parent_city' },        // Ciudad - sugerido "foreign_parent_city"
  'text_44fqva': { dataKey: 'foreign_parent_province' },    // Provincia - sugerido "foreign_parent_province"
  'text_45mpsb': { dataKey: 'foreign_parent_postal' },      // Código postal - sugerido "foreign_parent_postal"

  // ==================== PÁGINA 8 — (sin usar aún) ====================
  // 'text_46ureh': ??? Campo por identificar - ver nota al final del archivo

  // ==================== PÁGINA 15 — PART 11/15: CONTACTO ====================
  'text_47jbv':  { dataKey: 'petitioner_phone' },  // Teléfono daytime - sugerido "petitioner_phone"
  'text_48pahb': { dataKey: 'petitioner_email' },  // Email - sugerido "petitioner_email"
  'text_49nltd': { dataKey: 'petitioner_mobile' }, // Celular - sugerido "petitioner_mobile"

  // ==================== PÁGINA 19 — INFORMACIÓN ADICIONAL ====================
  'textarea_50lmlg': { dataKey: 'additional_info' }, // sugerido "additional_info"
}

export async function generateI360PDF(
  formData: Record<string, any>,
): Promise<Uint8Array> {
  const response = await fetch('/forms/i-360.pdf')
  if (!response.ok) {
    throw new Error(`No se pudo cargar la plantilla I-360: ${response.statusText}`)
  }
  const templateBytes = await response.arrayBuffer()

  const pdfDoc = await PDFDocument.load(templateBytes)
  const form = pdfDoc.getForm()

  for (const [pdfFieldName, entry] of Object.entries(FIELD_MAP)) {
    const rawValue = formData[entry.dataKey]
    if (rawValue == null || rawValue === '') continue

    const value = entry.transform ? entry.transform(rawValue) : String(rawValue)
    if (!value) continue

    try {
      const textField = form.getTextField(pdfFieldName)
      // Respeta el maxLength del campo PDF para evitar errores
      const maxLength = textField.getMaxLength()
      const finalValue = maxLength != null ? value.substring(0, maxLength) : value
      textField.setText(finalValue)
    } catch (err: any) {
      console.warn(`No se pudo llenar el campo PDF "${pdfFieldName}": ${err.message}`)
    }
  }

  form.flatten()
  return pdfDoc.save()
}
