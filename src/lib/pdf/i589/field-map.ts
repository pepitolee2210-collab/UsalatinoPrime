// Mapa de coordenadas para el formulario I-589
// Coordenadas originales en mm (FPDF top-left origin)
// La conversion a pdf-lib (bottom-left, points) se hace en generate-i589.ts

export interface FieldMapping {
  formDataKey: string
  x: number  // mm from left
  y: number  // mm from top (FPDF coordinates)
  type: 'text' | 'checkbox'
  page: number  // 0-indexed
  fontSize?: number
  maxWidth?: number  // max width in mm - text auto-shrinks to fit
  transform?: (value: any, formData: Record<string, any>) => string
}

// Helper: format date from ISO or year-month to mm/dd/yyyy or mm/yyyy
function formatDate(val: any): string {
  if (!val) return ''
  if (typeof val === 'object' && val.year && val.month) {
    return `${String(val.month).padStart(2, '0')}/${val.year}`
  }
  if (typeof val === 'string') {
    const d = new Date(val)
    if (!isNaN(d.getTime())) {
      return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`
    }
  }
  return String(val)
}

function formatMonthYear(val: any): string {
  if (!val) return ''
  if (val === 'Presente' || val === 'Present') return 'Present'
  if (typeof val === 'object' && val.year && val.month) {
    return `${String(val.month).padStart(2, '0')}/${val.year}`
  }
  if (typeof val === 'string') {
    const d = new Date(val)
    if (!isNaN(d.getTime())) {
      return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
    }
  }
  return String(val)
}

function genderToCheckbox(gender: string, expected: string): string {
  const g = (gender || '').toLowerCase().trim()
  const map: Record<string, string[]> = {
    male: ['masculino', 'male', 'hombre'],
    female: ['femenino', 'female', 'mujer'],
  }
  return (map[expected] || []).some(v => g === v) ? 'X' : ''
}

function maritalStatusMatch(val: string, expected: string): string {
  const v = (val || '').toLowerCase().trim()
  const map: Record<string, string[]> = {
    single: ['soltero', 'single', 'soltero/a'],
    married: ['casado', 'married', 'casado/a'],
    divorced: ['divorciado', 'divorced', 'divorciado/a'],
    widowed: ['viudo', 'widowed', 'viudo/a'],
  }
  return (map[expected] || []).some(s => v === s) ? 'X' : ''
}

function booleanCheck(val: any): string {
  if (val === true || val === 1 || val === '1' || val === 'true' || val === 'yes' || val === 'Yes') return 'X'
  return ''
}

function booleanCheckInverse(val: any): string {
  return booleanCheck(val) ? '' : 'X'
}

function phoneArea(val: string): string {
  if (!val) return ''
  const digits = val.replace(/\D/g, '')
  return digits.substring(0, 3)
}

function phoneRest(val: string): string {
  if (!val) return ''
  const digits = val.replace(/\D/g, '')
  return digits.substring(3)
}

function otherNamesToString(val: any): string {
  if (Array.isArray(val)) return val.filter(Boolean).join(', ')
  return String(val || '')
}

// ====================================================================
// PAGE 0 - Personal Information (HOJA 01)
// ====================================================================
const page0Fields: FieldMapping[] = [
  // "X" mark for initial application type
  { formDataKey: '_static_x', x: 25, y: 57, type: 'checkbox', page: 0, transform: () => 'X' },

  // A-Number
  { formDataKey: 'a_number', x: 15, y: 73, type: 'text', page: 0 },
  // SSN placeholder (not available at this position in original - they wrote N/A)
  { formDataKey: 'ssn', x: 82, y: 73, type: 'text', page: 0 },
  // USCIS account
  { formDataKey: 'uscis_account', x: 133, y: 73, type: 'text', page: 0 },

  // Name fields
  { formDataKey: 'legal_last_name', x: 15, y: 83, type: 'text', page: 0, maxWidth: 81 },
  { formDataKey: 'legal_first_name', x: 98, y: 83, type: 'text', page: 0, maxWidth: 50 },
  { formDataKey: 'legal_middle_name', x: 155, y: 83, type: 'text', page: 0 },

  // Other names
  { formDataKey: 'other_names', x: 15, y: 94, type: 'text', page: 0, transform: (v) => otherNamesToString(v) },

  // Address
  { formDataKey: 'residence_address_street', x: 15, y: 110, type: 'text', page: 0, maxWidth: 130 },
  { formDataKey: 'residence_address_city', x: 15, y: 120.5, type: 'text', page: 0 },
  { formDataKey: 'residence_address_state', x: 79, y: 120.5, type: 'text', page: 0 },
  { formDataKey: 'residence_address_zip', x: 122, y: 120.5, type: 'text', page: 0 },

  // Phone
  { formDataKey: 'residence_phone', x: 154.5, y: 121.2, type: 'text', page: 0, transform: (v) => phoneArea(v) },
  { formDataKey: 'residence_phone', x: 166.5, y: 121.2, type: 'text', page: 0, transform: (v) => phoneRest(v) },

  // Mailing address - N/A if same
  { formDataKey: 'mailing_same_as_residence', x: 15, y: 142, type: 'text', page: 0, transform: (v, fd) => {
    if (v === true || v === 'true') return 'N/A'
    const ma = fd.mailing_address
    if (ma && typeof ma === 'object') return ma.street || ''
    return 'N/A'
  }},

  // Gender checkboxes
  { formDataKey: 'gender', x: 29.5, y: 168.5, type: 'checkbox', page: 0, transform: (v) => genderToCheckbox(v, 'male') },
  { formDataKey: 'gender', x: 48, y: 168.5, type: 'checkbox', page: 0, transform: (v) => genderToCheckbox(v, 'female') },

  // Marital status checkboxes
  { formDataKey: 'marital_status', x: 95.5, y: 168.5, type: 'checkbox', page: 0, transform: (v) => maritalStatusMatch(v, 'single') },
  { formDataKey: 'marital_status', x: 118, y: 168.5, type: 'checkbox', page: 0, transform: (v) => maritalStatusMatch(v, 'married') },
  { formDataKey: 'marital_status', x: 144.7, y: 168.5, type: 'checkbox', page: 0, transform: (v) => maritalStatusMatch(v, 'divorced') },
  { formDataKey: 'marital_status', x: 173.8, y: 168.5, type: 'checkbox', page: 0, transform: (v) => maritalStatusMatch(v, 'widowed') },

  // DOB
  { formDataKey: 'date_of_birth', x: 15, y: 178, type: 'text', page: 0, transform: (v) => formatDate(v) },

  // City/country of birth
  { formDataKey: 'city_of_birth', x: 72, y: 178, type: 'text', page: 0 },

  // Nationality current
  { formDataKey: 'nationality', x: 15, y: 188.5, type: 'text', page: 0 },
  // Country of birth (nationality at birth)
  { formDataKey: 'country_of_birth', x: 72, y: 188.5, type: 'text', page: 0 },
  // Race
  { formDataKey: 'race_ethnicity', x: 122, y: 188.5, type: 'text', page: 0 },
  // Religion
  { formDataKey: 'religion', x: 165, y: 188.5, type: 'text', page: 0 },

  // Court proceedings checkboxes
  { formDataKey: 'immigration_court_proceedings', x: 74.2, y: 194, type: 'checkbox', page: 0,
    transform: (v) => v === false || v === 'false' ? 'X' : '' },
  { formDataKey: 'immigration_court_proceedings', x: 22.8, y: 199.2, type: 'checkbox', page: 0,
    transform: (v) => v === true || v === 'true' ? 'X' : '' },

  // Last entry date
  { formDataKey: 'last_entry_date', x: 87, y: 209.5, type: 'text', page: 0, transform: (v) => formatDate(v) },
  // I-94
  { formDataKey: 'i94_number', x: 169, y: 209.5, type: 'text', page: 0 },

  // Passport country
  { formDataKey: 'passport_country', x: 15, y: 248.5, type: 'text', page: 0 },
  // Passport number
  { formDataKey: 'passport_number', x: 110.5, y: 243, type: 'text', page: 0 },
  // Travel document number
  { formDataKey: 'travel_document_number', x: 117, y: 249, type: 'text', page: 0 },
  // Passport expiry
  { formDataKey: 'passport_expiry', x: 161, y: 249, type: 'text', page: 0, transform: (v) => formatDate(v) },

  // Native language
  { formDataKey: 'native_language', x: 15, y: 259, type: 'text', page: 0 },
  // Speaks english yes/no
  { formDataKey: 'speaks_english', x: 99, y: 259, type: 'checkbox', page: 0, transform: (v) => booleanCheck(v) },
  { formDataKey: 'speaks_english', x: 116, y: 259, type: 'checkbox', page: 0, transform: (v) => booleanCheckInverse(v) },
  // Other languages
  { formDataKey: 'other_languages', x: 138.5, y: 259, type: 'text', page: 0 },
]

// ====================================================================
// PAGE 1 - Spouse + Child 1 (HOJA 02)
// ====================================================================
const page1Fields: FieldMapping[] = [
  // No spouse checkbox
  { formDataKey: 'has_spouse', x: 56, y: 57.2, type: 'checkbox', page: 1, transform: (v) => booleanCheckInverse(v) },

  // Spouse A-number
  { formDataKey: 'spouse_info.spouse_a_number', x: 15, y: 69.2, type: 'text', page: 1 },
  // Spouse passport (we don't have this field yet, but fill if available)
  { formDataKey: 'spouse_info.spouse_passport_number', x: 70, y: 69.2, type: 'text', page: 1 },
  // Spouse DOB
  { formDataKey: 'spouse_info.spouse_dob', x: 115, y: 68, type: 'text', page: 1, transform: (v) => formatDate(v) },
  // Spouse SSN
  { formDataKey: 'spouse_info.spouse_ssn', x: 158, y: 69.2, type: 'text', page: 1 },

  // Spouse name
  { formDataKey: 'spouse_info.spouse_last_name', x: 15, y: 79.8, type: 'text', page: 1 },
  { formDataKey: 'spouse_info.spouse_first_name', x: 70, y: 79.8, type: 'text', page: 1 },
  { formDataKey: 'spouse_info.spouse_middle_name', x: 115, y: 79.8, type: 'text', page: 1 },
  { formDataKey: 'spouse_info.spouse_other_names', x: 158, y: 81.3, type: 'text', page: 1 },

  // Marriage date and place
  { formDataKey: 'spouse_info.marriage_date', x: 15, y: 91.8, type: 'text', page: 1, transform: (v) => formatDate(v) },
  { formDataKey: 'spouse_info.marriage_place', x: 70, y: 91.8, type: 'text', page: 1, maxWidth: 80 },
  // Spouse birth city/country
  { formDataKey: 'spouse_info.spouse_nationality', x: 130, y: 91.8, type: 'text', page: 1 },

  // Spouse nationality (current)
  { formDataKey: 'spouse_info.spouse_nationality', x: 15, y: 102.5, type: 'text', page: 1 },
  // Spouse race (we don't have this field in wizard)
  // Spouse gender
  { formDataKey: 'spouse_info.spouse_gender', x: 156, y: 102.5, type: 'checkbox', page: 1, transform: (v) => genderToCheckbox(v, 'male') },
  { formDataKey: 'spouse_info.spouse_gender', x: 177.5, y: 102.5, type: 'checkbox', page: 1, transform: (v) => genderToCheckbox(v, 'female') },

  // Spouse in US - yes
  { formDataKey: 'spouse_info.spouse_in_us', x: 19, y: 113.2, type: 'checkbox', page: 1, transform: (v) => booleanCheck(v) },
  // Spouse in US - no
  { formDataKey: 'spouse_info.spouse_in_us', x: 68, y: 113.1, type: 'checkbox', page: 1, transform: (v) => booleanCheckInverse(v) },

  // Spouse immigration status
  { formDataKey: 'spouse_info.spouse_immigration_status', x: 15, y: 137.1, type: 'text', page: 1 },

  // Spouse include in application - yes
  { formDataKey: 'spouse_info.spouse_include_in_application', x: 16.8, y: 148.2, type: 'checkbox', page: 1, transform: (v) => booleanCheck(v) },
  // Spouse include in application - no
  { formDataKey: 'spouse_info.spouse_include_in_application', x: 16.8, y: 154.5, type: 'checkbox', page: 1, transform: (v) => booleanCheckInverse(v) },

  // Has children - yes
  { formDataKey: 'has_children', x: 13, y: 173, type: 'checkbox', page: 1, transform: (v) => booleanCheck(v) },
  // Has children - no
  { formDataKey: 'has_children', x: 13, y: 166.8, type: 'checkbox', page: 1, transform: (v) => booleanCheckInverse(v) },
  // Number of children
  { formDataKey: 'children', x: 83.5, y: 172.8, type: 'text', page: 1, transform: (v) => Array.isArray(v) ? String(v.length) : '' },

  // ---- CHILD 1 ----
  { formDataKey: 'children[0].child_a_number', x: 16, y: 193, type: 'text', page: 1 },
  { formDataKey: 'children[0].child_last_name', x: 16, y: 203.5, type: 'text', page: 1 },
  { formDataKey: 'children[0].child_first_name', x: 72, y: 203.5, type: 'text', page: 1 },
  { formDataKey: 'children[0].child_dob', x: 158, y: 203.5, type: 'text', page: 1, transform: (v) => formatDate(v) },
  { formDataKey: 'children[0].child_country_of_birth', x: 16, y: 213.6, type: 'text', page: 1 },
  { formDataKey: 'children[0].child_nationality', x: 72, y: 213.6, type: 'text', page: 1 },

  // Child 1 gender
  { formDataKey: 'children[0].child_gender', x: 157, y: 214.2, type: 'checkbox', page: 1, transform: (v) => genderToCheckbox(v, 'male') },
  { formDataKey: 'children[0].child_gender', x: 176, y: 214.2, type: 'checkbox', page: 1, transform: (v) => genderToCheckbox(v, 'female') },

  // Child 1 in US
  { formDataKey: 'children[0].child_in_us', x: 52, y: 219.5, type: 'checkbox', page: 1, transform: (v) => booleanCheck(v) },
  { formDataKey: 'children[0].child_in_us', x: 101.5, y: 220, type: 'checkbox', page: 1, transform: (v) => booleanCheckInverse(v) },

  // Child 1 include in application
  { formDataKey: 'children[0].child_include_in_application', x: 16.8, y: 255.5, type: 'checkbox', page: 1, transform: (v) => booleanCheck(v) },
  { formDataKey: 'children[0].child_include_in_application', x: 16.8, y: 261.5, type: 'checkbox', page: 1, transform: (v) => booleanCheckInverse(v) },
]

// ====================================================================
// PAGE 2 - Children 2-4 (HOJA 03)
// ====================================================================
const page2Fields: FieldMapping[] = [
  // ---- CHILD 2 ----
  { formDataKey: 'children[1].child_a_number', x: 15, y: 38, type: 'text', page: 2 },
  { formDataKey: 'children[1].child_last_name', x: 15, y: 48, type: 'text', page: 2 },
  { formDataKey: 'children[1].child_first_name', x: 71, y: 48, type: 'text', page: 2 },
  { formDataKey: 'children[1].child_dob', x: 157, y: 48, type: 'text', page: 2, transform: (v) => formatDate(v) },
  { formDataKey: 'children[1].child_country_of_birth', x: 15, y: 58.5, type: 'text', page: 2 },
  { formDataKey: 'children[1].child_nationality', x: 71, y: 58.5, type: 'text', page: 2 },
  { formDataKey: 'children[1].child_gender', x: 157, y: 59, type: 'checkbox', page: 2, transform: (v) => genderToCheckbox(v, 'male') },
  { formDataKey: 'children[1].child_gender', x: 175.8, y: 59, type: 'checkbox', page: 2, transform: (v) => genderToCheckbox(v, 'female') },
  { formDataKey: 'children[1].child_in_us', x: 51.7, y: 65.4, type: 'checkbox', page: 2, transform: (v) => booleanCheck(v) },
  { formDataKey: 'children[1].child_in_us', x: 100, y: 65.1, type: 'checkbox', page: 2, transform: (v) => booleanCheckInverse(v) },
  { formDataKey: 'children[1].child_include_in_application', x: 17, y: 100.2, type: 'checkbox', page: 2, transform: (v) => booleanCheck(v) },
  { formDataKey: 'children[1].child_include_in_application', x: 17, y: 106.4, type: 'checkbox', page: 2, transform: (v) => booleanCheckInverse(v) },

  // ---- CHILD 3 ----
  { formDataKey: 'children[2].child_a_number', x: 15, y: 118.5, type: 'text', page: 2 },
  { formDataKey: 'children[2].child_last_name', x: 15, y: 129, type: 'text', page: 2 },
  { formDataKey: 'children[2].child_first_name', x: 71, y: 129, type: 'text', page: 2 },
  { formDataKey: 'children[2].child_dob', x: 157, y: 129, type: 'text', page: 2, transform: (v) => formatDate(v) },
  { formDataKey: 'children[2].child_country_of_birth', x: 15, y: 139.5, type: 'text', page: 2 },
  { formDataKey: 'children[2].child_nationality', x: 71, y: 139.5, type: 'text', page: 2 },
  { formDataKey: 'children[2].child_gender', x: 157, y: 140, type: 'checkbox', page: 2, transform: (v) => genderToCheckbox(v, 'male') },
  { formDataKey: 'children[2].child_gender', x: 175.8, y: 140, type: 'checkbox', page: 2, transform: (v) => genderToCheckbox(v, 'female') },
  { formDataKey: 'children[2].child_in_us', x: 51.5, y: 146.1, type: 'checkbox', page: 2, transform: (v) => booleanCheck(v) },
  { formDataKey: 'children[2].child_in_us', x: 99.7, y: 145.5, type: 'checkbox', page: 2, transform: (v) => booleanCheckInverse(v) },
  { formDataKey: 'children[2].child_include_in_application', x: 17, y: 181, type: 'checkbox', page: 2, transform: (v) => booleanCheck(v) },
  { formDataKey: 'children[2].child_include_in_application', x: 17, y: 187.7, type: 'checkbox', page: 2, transform: (v) => booleanCheckInverse(v) },

  // ---- CHILD 4 ----
  { formDataKey: 'children[3].child_a_number', x: 15, y: 199.5, type: 'text', page: 2 },
  { formDataKey: 'children[3].child_last_name', x: 15, y: 210, type: 'text', page: 2 },
  { formDataKey: 'children[3].child_first_name', x: 71, y: 210, type: 'text', page: 2 },
  { formDataKey: 'children[3].child_dob', x: 157, y: 210, type: 'text', page: 2, transform: (v) => formatDate(v) },
  { formDataKey: 'children[3].child_country_of_birth', x: 15, y: 220.5, type: 'text', page: 2 },
  { formDataKey: 'children[3].child_nationality', x: 71, y: 220.5, type: 'text', page: 2 },
  { formDataKey: 'children[3].child_gender', x: 157.2, y: 220.5, type: 'checkbox', page: 2, transform: (v) => genderToCheckbox(v, 'male') },
  { formDataKey: 'children[3].child_gender', x: 175.8, y: 220.5, type: 'checkbox', page: 2, transform: (v) => genderToCheckbox(v, 'female') },
  { formDataKey: 'children[3].child_in_us', x: 52, y: 226.5, type: 'checkbox', page: 2, transform: (v) => booleanCheck(v) },
  { formDataKey: 'children[3].child_in_us', x: 101.7, y: 226.5, type: 'checkbox', page: 2, transform: (v) => booleanCheckInverse(v) },
  { formDataKey: 'children[3].child_include_in_application', x: 17, y: 261.6, type: 'checkbox', page: 2, transform: (v) => booleanCheck(v) },
  { formDataKey: 'children[3].child_include_in_application', x: 17, y: 267.5, type: 'checkbox', page: 2, transform: (v) => booleanCheckInverse(v) },
]

// ====================================================================
// PAGE 3 - Residences, Education, Employment, Family (HOJA 04)
// ====================================================================
const page3Fields: FieldMapping[] = [
  // Last address before coming to US
  { formDataKey: 'last_address_before_us.street', x: 15, y: 61, type: 'text', page: 3, maxWidth: 45 },
  { formDataKey: 'last_address_before_us.city', x: 62, y: 61, type: 'text', page: 3, maxWidth: 29 },
  { formDataKey: 'last_address_before_us.state', x: 93, y: 61, type: 'text', page: 3, maxWidth: 40 },
  { formDataKey: 'last_address_before_us.country', x: 135, y: 61, type: 'text', page: 3, maxWidth: 25 },
  { formDataKey: 'last_address_before_us.from', x: 162, y: 61, type: 'text', page: 3, transform: (v) => formatMonthYear(v) },
  { formDataKey: 'last_address_before_us.to', x: 183, y: 61, type: 'text', page: 3, transform: (v) => formatMonthYear(v) },

  // Residences in US (up to 5)
  // Residence 1
  { formDataKey: 'residences_last_5_years[0].res_address', x: 15, maxWidth: 45, y: 94, type: 'text', page: 3 },
  { formDataKey: 'residences_last_5_years[0].res_city', x: 62, y: 94, type: 'text', page: 3 },
  { formDataKey: 'residences_last_5_years[0].res_country', x: 135, y: 94, type: 'text', page: 3 },
  { formDataKey: 'residences_last_5_years[0].res_from', x: 162, y: 94, type: 'text', page: 3, transform: (v) => formatMonthYear(v) },
  { formDataKey: 'residences_last_5_years[0].res_to', x: 182, y: 94, type: 'text', page: 3, transform: (v) => formatMonthYear(v) },

  // Residence 2
  { formDataKey: 'residences_last_5_years[1].res_address', x: 15, maxWidth: 45, y: 101, type: 'text', page: 3 },
  { formDataKey: 'residences_last_5_years[1].res_city', x: 62, y: 101, type: 'text', page: 3 },
  { formDataKey: 'residences_last_5_years[1].res_country', x: 135, y: 101, type: 'text', page: 3 },
  { formDataKey: 'residences_last_5_years[1].res_from', x: 162, y: 101, type: 'text', page: 3, transform: (v) => formatMonthYear(v) },
  { formDataKey: 'residences_last_5_years[1].res_to', x: 182, y: 101, type: 'text', page: 3, transform: (v) => formatMonthYear(v) },

  // Residence 3
  { formDataKey: 'residences_last_5_years[2].res_address', x: 15, maxWidth: 45, y: 107, type: 'text', page: 3 },
  { formDataKey: 'residences_last_5_years[2].res_city', x: 62, y: 107, type: 'text', page: 3 },
  { formDataKey: 'residences_last_5_years[2].res_country', x: 135, y: 107, type: 'text', page: 3 },
  { formDataKey: 'residences_last_5_years[2].res_from', x: 162, y: 107, type: 'text', page: 3, transform: (v) => formatMonthYear(v) },
  { formDataKey: 'residences_last_5_years[2].res_to', x: 182, y: 107, type: 'text', page: 3, transform: (v) => formatMonthYear(v) },

  // Residence 4
  { formDataKey: 'residences_last_5_years[3].res_address', x: 15, maxWidth: 45, y: 113, type: 'text', page: 3 },
  { formDataKey: 'residences_last_5_years[3].res_city', x: 62, y: 113, type: 'text', page: 3 },
  { formDataKey: 'residences_last_5_years[3].res_country', x: 135, y: 113, type: 'text', page: 3 },
  { formDataKey: 'residences_last_5_years[3].res_from', x: 162, y: 113, type: 'text', page: 3, transform: (v) => formatMonthYear(v) },
  { formDataKey: 'residences_last_5_years[3].res_to', x: 182, y: 113, type: 'text', page: 3, transform: (v) => formatMonthYear(v) },

  // Residence 5
  { formDataKey: 'residences_last_5_years[4].res_address', x: 15, maxWidth: 45, y: 119.5, type: 'text', page: 3 },
  { formDataKey: 'residences_last_5_years[4].res_city', x: 62, y: 119.5, type: 'text', page: 3 },
  { formDataKey: 'residences_last_5_years[4].res_country', x: 135, y: 119.5, type: 'text', page: 3 },
  { formDataKey: 'residences_last_5_years[4].res_from', x: 162, y: 119.5, type: 'text', page: 3, transform: (v) => formatMonthYear(v) },
  { formDataKey: 'residences_last_5_years[4].res_to', x: 182, y: 119.5, type: 'text', page: 3, transform: (v) => formatMonthYear(v) },

  // Education (up to 4)
  // Education 1
  { formDataKey: 'education[0].edu_school', x: 15, maxWidth: 56, y: 147, type: 'text', page: 3 },
  { formDataKey: 'education[0].edu_type', x: 73, maxWidth: 40, y: 147, type: 'text', page: 3 },
  { formDataKey: 'education[0].edu_location', x: 115, maxWidth: 45, y: 147, type: 'text', page: 3 },
  { formDataKey: 'education[0].edu_from', x: 162, y: 147, type: 'text', page: 3, transform: (v) => formatMonthYear(v) },
  { formDataKey: 'education[0].edu_to', x: 182, y: 147, type: 'text', page: 3, transform: (v) => formatMonthYear(v) },

  // Education 2
  { formDataKey: 'education[1].edu_school', x: 15, maxWidth: 56, y: 153, type: 'text', page: 3 },
  { formDataKey: 'education[1].edu_type', x: 73, maxWidth: 40, y: 153, type: 'text', page: 3 },
  { formDataKey: 'education[1].edu_location', x: 115, maxWidth: 45, y: 153, type: 'text', page: 3 },
  { formDataKey: 'education[1].edu_from', x: 162, y: 153, type: 'text', page: 3, transform: (v) => formatMonthYear(v) },
  { formDataKey: 'education[1].edu_to', x: 182, y: 153, type: 'text', page: 3, transform: (v) => formatMonthYear(v) },

  // Education 3
  { formDataKey: 'education[2].edu_school', x: 15, maxWidth: 56, y: 159, type: 'text', page: 3 },
  { formDataKey: 'education[2].edu_type', x: 73, maxWidth: 40, y: 159, type: 'text', page: 3 },
  { formDataKey: 'education[2].edu_location', x: 115, maxWidth: 45, y: 159, type: 'text', page: 3 },
  { formDataKey: 'education[2].edu_from', x: 162, y: 159, type: 'text', page: 3, transform: (v) => formatMonthYear(v) },
  { formDataKey: 'education[2].edu_to', x: 182, y: 159, type: 'text', page: 3, transform: (v) => formatMonthYear(v) },

  // Education 4
  { formDataKey: 'education[3].edu_school', x: 15, maxWidth: 56, y: 165, type: 'text', page: 3 },
  { formDataKey: 'education[3].edu_type', x: 73, maxWidth: 40, y: 165, type: 'text', page: 3 },
  { formDataKey: 'education[3].edu_location', x: 115, maxWidth: 45, y: 165, type: 'text', page: 3 },
  { formDataKey: 'education[3].edu_from', x: 162, y: 165, type: 'text', page: 3, transform: (v) => formatMonthYear(v) },
  { formDataKey: 'education[3].edu_to', x: 182, y: 165, type: 'text', page: 3, transform: (v) => formatMonthYear(v) },

  // Employment (up to 3)
  // Employment 1
  { formDataKey: 'employment_last_5_years[0].emp_employer', x: 15, maxWidth: 91, y: 192, type: 'text', page: 3 },
  { formDataKey: 'employment_last_5_years[0].emp_occupation', x: 108, maxWidth: 52, y: 192, type: 'text', page: 3 },
  { formDataKey: 'employment_last_5_years[0].emp_from', x: 162, y: 192, type: 'text', page: 3, transform: (v) => formatMonthYear(v) },
  { formDataKey: 'employment_last_5_years[0].emp_to', x: 182, y: 192, type: 'text', page: 3, transform: (v) => formatMonthYear(v) },

  // Employment 2
  { formDataKey: 'employment_last_5_years[1].emp_employer', x: 15, maxWidth: 91, y: 198, type: 'text', page: 3 },
  { formDataKey: 'employment_last_5_years[1].emp_occupation', x: 108, maxWidth: 52, y: 198, type: 'text', page: 3 },
  { formDataKey: 'employment_last_5_years[1].emp_from', x: 162, y: 198, type: 'text', page: 3, transform: (v) => formatMonthYear(v) },
  { formDataKey: 'employment_last_5_years[1].emp_to', x: 182, y: 198, type: 'text', page: 3, transform: (v) => formatMonthYear(v) },

  // Employment 3
  { formDataKey: 'employment_last_5_years[2].emp_employer', x: 15, maxWidth: 91, y: 204, type: 'text', page: 3 },
  { formDataKey: 'employment_last_5_years[2].emp_occupation', x: 108, maxWidth: 52, y: 204, type: 'text', page: 3 },
  { formDataKey: 'employment_last_5_years[2].emp_from', x: 162, y: 204, type: 'text', page: 3, transform: (v) => formatMonthYear(v) },
  { formDataKey: 'employment_last_5_years[2].emp_to', x: 182, y: 204, type: 'text', page: 3, transform: (v) => formatMonthYear(v) },

  // Mother
  { formDataKey: 'mother_name', x: 25, maxWidth: 48, y: 229, type: 'text', page: 3 },
  { formDataKey: 'mother_country_of_birth', x: 75, y: 229, type: 'text', page: 3 },
  { formDataKey: 'mother_deceased', x: 136.5, y: 228.8, type: 'checkbox', page: 3, transform: (v) => booleanCheck(v) },
  { formDataKey: 'mother_current_location', x: 155, y: 229, type: 'text', page: 3 },

  // Father
  { formDataKey: 'father_name', x: 25, maxWidth: 48, y: 235, type: 'text', page: 3 },
  { formDataKey: 'father_country_of_birth', x: 75, y: 235, type: 'text', page: 3 },
  { formDataKey: 'father_deceased', x: 136.5, y: 234.7, type: 'checkbox', page: 3, transform: (v) => booleanCheck(v) },
  { formDataKey: 'father_current_location', x: 155, y: 235, type: 'text', page: 3 },

  // Siblings (up to 4)
  // Sibling 1
  { formDataKey: 'siblings[0].sibling_name', x: 25, maxWidth: 48, y: 241.5, type: 'text', page: 3 },
  { formDataKey: 'siblings[0].sibling_country_of_birth', x: 75, y: 241.5, type: 'text', page: 3 },
  { formDataKey: 'siblings[0].sibling_deceased', x: 136.5, y: 241.2, type: 'checkbox', page: 3, transform: (v) => booleanCheck(v) },
  { formDataKey: 'siblings[0].sibling_current_location', x: 155, y: 241.5, type: 'text', page: 3 },

  // Sibling 2
  { formDataKey: 'siblings[1].sibling_name', x: 25, maxWidth: 48, y: 248, type: 'text', page: 3 },
  { formDataKey: 'siblings[1].sibling_country_of_birth', x: 75, y: 248, type: 'text', page: 3 },
  { formDataKey: 'siblings[1].sibling_deceased', x: 136.5, y: 247.2, type: 'checkbox', page: 3, transform: (v) => booleanCheck(v) },
  { formDataKey: 'siblings[1].sibling_current_location', x: 155, y: 248, type: 'text', page: 3 },

  // Sibling 3
  { formDataKey: 'siblings[2].sibling_name', x: 25, maxWidth: 48, y: 254.2, type: 'text', page: 3 },
  { formDataKey: 'siblings[2].sibling_country_of_birth', x: 75, y: 254.2, type: 'text', page: 3 },
  { formDataKey: 'siblings[2].sibling_deceased', x: 136.5, y: 253.6, type: 'checkbox', page: 3, transform: (v) => booleanCheck(v) },
  { formDataKey: 'siblings[2].sibling_current_location', x: 155, y: 254.2, type: 'text', page: 3 },

  // Sibling 4
  { formDataKey: 'siblings[3].sibling_name', x: 25, maxWidth: 48, y: 260.6, type: 'text', page: 3 },
  { formDataKey: 'siblings[3].sibling_country_of_birth', x: 75, y: 260.6, type: 'text', page: 3 },
  { formDataKey: 'siblings[3].sibling_deceased', x: 136.5, y: 259.8, type: 'checkbox', page: 3, transform: (v) => booleanCheck(v) },
  { formDataKey: 'siblings[3].sibling_current_location', x: 155, y: 260.6, type: 'text', page: 3 },
]

export const i589FieldMap: FieldMapping[] = [
  ...page0Fields,
  ...page1Fields,
  ...page2Fields,
  ...page3Fields,
]
