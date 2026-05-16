/**
 * Mapeo de los `key` del wizard cliente I-589 Parte A (definidos en
 * `src/components/i589/i589-part-a-questions.ts`) a los nombres reales
 * de fields AcroForm del PDF USCIS I-589 oficial (XFA edition).
 *
 * Fuente del PDF: USCIS Form I-589 (XFA), normalizado con mupdf.
 * Field names extraídos con `scripts/inspect-usa-i-589-asylum-fields.mjs`
 * → `scripts/usa-i-589-asylum-raw-fields.json` (460 fields totales).
 *
 * El mapeo de los TextField/DateTimeField "anónimos" se hizo
 * empíricamente con `scripts/i589-debug-fill.mjs` + `scripts/render-debug-pages.mjs`
 * (rellena cada field con su nombre, renderiza PNG por página, identifico
 * visualmente la posición en el formulario oficial).
 */

// ────────────────────────────────────────────────────────────────────────
//  PARTE A — Páginas 1-4
// ────────────────────────────────────────────────────────────────────────

/**
 * Map directo: `wizardKey` → `pdfFieldName` para campos de texto/date.
 * Cubre las 61 keys del wizard Parte A; los keys que el PDF USCIS oficial
 * no representa (como `native_language`, `speaks_english`, `travel_document_number`)
 * se omiten en comentarios.
 */
export const I589_TEXT_FIELD_MAP: Record<string, string> = {
  // ── Página 1 — Parte A.I: Información del solicitante ─────────────────
  a_number: 'form1[0].#subform[0].PtAILine1_ANumber[0]',
  ssn: 'form1[0].#subform[0].TextField1[0]',
  uscis_account: 'form1[0].#subform[0].TextField1[1]',
  legal_last_name: 'form1[0].#subform[0].PtAILine4_LastName[0]',
  legal_first_name: 'form1[0].#subform[0].PtAILine5_FirstName[0]',
  legal_middle_name: 'form1[0].#subform[0].PtAILine6_MiddleName[0]',
  other_names: 'form1[0].#subform[0].TextField1[2]',

  // Residencia actual EE.UU. (Line 8)
  residence_address_street: 'form1[0].#subform[0].PtAILine8_StreetNumandName[0]',
  residence_address_city: 'form1[0].#subform[0].TextField1[3]',
  residence_address_state: 'form1[0].#subform[0].PtAILine8_State[0]',
  residence_address_zip: 'form1[0].#subform[0].PtAILine8_Zipcode[0]',
  // Teléfono completo en un solo field (TelephoneNumber); el wizard no
  // separa area code del número, va al field de teléfono principal.
  residence_phone: 'form1[0].#subform[0].PtAILine8_TelephoneNumber[0]',

  // Datos personales (Line 12-17)
  date_of_birth: 'form1[0].#subform[0].DateTimeField1[0]',
  city_of_birth: 'form1[0].#subform[0].TextField1[4]',
  country_of_birth: 'form1[0].#subform[0].TextField1[5]',
  nationality: 'form1[0].#subform[0].TextField1[6]',
  // `native_language` no existe como field en el PDF oficial → omitido.
  // `speaks_english` no existe como field en el PDF oficial → omitido.

  // ── Página 1, sección 19 — Historial de entrada a EE.UU. ──────────────
  // El wizard solo captura la última entrada; mapeamos a la primera fila
  // de la tabla de entry history.
  last_entry_date: 'form1[0].#subform[0].DateTimeField2[0]',
  entry_place: 'form1[0].#subform[0].TextField3[0]',
  entry_status: 'form1[0].#subform[0].TextField4[0]',
  i94_number: 'form1[0].#subform[0].TextField5[0]',
  // `status_expires`, `passport_*`, `travel_document_number` no tienen
  // fields nominados claros en el oficial — el cliente los entrega en
  // documentos adjuntos. Skipeo.

  // ── Página 2 — Parte A.II: Cónyuge (subform[1].NotMarried[0]) ─────────
  // El subform se llama "NotMarried" por convención XFA de USCIS;
  // contiene los datos del cónyuge.
  spouse_last_name: 'form1[0].#subform[1].NotMarried[0].PtAIILine5_LastName[0]',
  spouse_first_name: 'form1[0].#subform[1].NotMarried[0].PtAIILine6_FirstName[0]',
  spouse_dob: 'form1[0].#subform[1].NotMarried[0].DateTimeField8[0]',
  spouse_nationality: 'form1[0].#subform[1].NotMarried[0].TextField10[6]',
  marriage_date: 'form1[0].#subform[1].NotMarried[0].DateTimeField7[0]',
  marriage_place: 'form1[0].#subform[1].NotMarried[0].TextField10[3]',

  // ── Página 4 — Parte A.III: Sección 1 — Última dirección antes de EE.UU.
  // Patrón XFA: dentro de un grupo de 2 filas en una misma tabla, los
  // índices PARES van a la fila 1, IMPARES a la fila 2 (NOT secuencial).
  // Sección 1 tiene 2 filas en USCIS (1: last address general, 2: last
  // address en el país de persecución si distinto). Usamos solo la fila 1.
  last_address_before_us_street: 'form1[0].#subform[4].TextField13[0]',
  last_address_before_us_city: 'form1[0].#subform[4].TextField13[2]',
  last_address_before_us_state: 'form1[0].#subform[4].TextField13[4]',
  last_address_before_us_country: 'form1[0].#subform[4].TextField13[6]',
  last_address_before_us_from: 'form1[0].#subform[4].DateTimeField21[0]',
  last_address_before_us_to: 'form1[0].#subform[4].DateTimeField20[0]',

  // ── Página 4 — Sección 2: Residencias últimos 5 años (5 filas) ────────
  // Mismo patrón par/impar dentro de bloques de 2 filas:
  //   Fila 1 = pares [8,10,12,14], Fila 2 = impares [9,11,13,15]
  //   Fila 3 = pares [16,18,20,22], Fila 4 = impares [17,19,21,23]
  //   Fila 5 = pares [24,26,28,30]
  residence_1_street: 'form1[0].#subform[4].TextField13[8]',
  residence_1_city: 'form1[0].#subform[4].TextField13[10]',
  residence_1_state: 'form1[0].#subform[4].TextField13[12]',
  residence_1_country: 'form1[0].#subform[4].TextField13[14]',
  residence_1_from: 'form1[0].#subform[4].DateTimeField22[0]',
  residence_1_to: 'form1[0].#subform[4].DateTimeField23[0]',
  residence_2_street: 'form1[0].#subform[4].TextField13[9]',
  residence_2_city: 'form1[0].#subform[4].TextField13[11]',
  residence_2_state: 'form1[0].#subform[4].TextField13[13]',
  residence_2_country: 'form1[0].#subform[4].TextField13[15]',
  residence_2_from: 'form1[0].#subform[4].DateTimeField24[0]',
  residence_2_to: 'form1[0].#subform[4].DateTimeField25[0]',
  residence_3_street: 'form1[0].#subform[4].TextField13[16]',
  residence_3_city: 'form1[0].#subform[4].TextField13[18]',
  residence_3_state: 'form1[0].#subform[4].TextField13[20]',
  residence_3_country: 'form1[0].#subform[4].TextField13[22]',
  residence_3_from: 'form1[0].#subform[4].DateTimeField26[0]',
  residence_3_to: 'form1[0].#subform[4].DateTimeField27[0]',
  residence_4_street: 'form1[0].#subform[4].TextField13[17]',
  residence_4_city: 'form1[0].#subform[4].TextField13[19]',
  residence_4_state: 'form1[0].#subform[4].TextField13[21]',
  residence_4_country: 'form1[0].#subform[4].TextField13[23]',
  residence_4_from: 'form1[0].#subform[4].DateTimeField28[0]',
  residence_4_to: 'form1[0].#subform[4].DateTimeField29[0]',
  residence_5_street: 'form1[0].#subform[4].TextField13[24]',
  residence_5_city: 'form1[0].#subform[4].TextField13[26]',
  residence_5_state: 'form1[0].#subform[4].TextField13[28]',
  residence_5_country: 'form1[0].#subform[4].TextField13[30]',
  residence_5_from: 'form1[0].#subform[4].DateTimeField30[0]',
  residence_5_to: 'form1[0].#subform[4].DateTimeField31[0]',

  // ── Página 4 — Sección 3: Educación últimos 5 años ────────────────────
  // 5 filas: name_of_school / type_of_school / location / from / to.
  // Cada fila usa 3 TextField13 + 2 DateTimeField. Índices estimados
  // empíricamente del orden visual del PDF debug.
  education_1_school: 'form1[0].#subform[4].TextField13[24]',
  education_1_type: 'form1[0].#subform[4].TextField13[25]',
  education_1_location: 'form1[0].#subform[4].TextField13[26]',
  education_1_from: 'form1[0].#subform[4].DateTimeField32[0]',
  education_1_to: 'form1[0].#subform[4].DateTimeField33[0]',
  education_2_school: 'form1[0].#subform[4].TextField13[27]',
  education_2_type: 'form1[0].#subform[4].TextField13[28]',
  education_2_location: 'form1[0].#subform[4].TextField13[29]',
  education_2_from: 'form1[0].#subform[4].DateTimeField34[0]',
  education_2_to: 'form1[0].#subform[4].DateTimeField35[0]',
  education_3_school: 'form1[0].#subform[4].TextField13[30]',
  education_3_type: 'form1[0].#subform[4].TextField13[31]',
  education_3_location: 'form1[0].#subform[4].TextField13[32]',
  education_3_from: 'form1[0].#subform[4].DateTimeField36[0]',
  education_3_to: 'form1[0].#subform[4].DateTimeField37[0]',
  education_4_school: 'form1[0].#subform[4].TextField13[33]',
  education_4_type: 'form1[0].#subform[4].TextField13[34]',
  education_4_location: 'form1[0].#subform[4].TextField13[35]',
  education_4_from: 'form1[0].#subform[4].DateTimeField38[0]',
  education_4_to: 'form1[0].#subform[4].DateTimeField39[0]',
  education_5_school: 'form1[0].#subform[4].TextField13[36]',
  education_5_type: 'form1[0].#subform[4].TextField13[37]',
  education_5_location: 'form1[0].#subform[4].TextField13[38]',
  education_5_from: 'form1[0].#subform[4].DateTimeField40[0]',
  education_5_to: 'form1[0].#subform[4].DateTimeField41[0]',

  // ── Página 4 — Sección 4: Empleos últimos 5 años ──────────────────────
  // 5 filas: employer (name+address) / occupation / from / to.
  // El employer en USCIS oficial es UN solo bloque (name+address combined).
  employment_1_employer: 'form1[0].#subform[4].TextField13[39]',
  employment_1_occupation: 'form1[0].#subform[4].TextField13[40]',
  employment_1_from: 'form1[0].#subform[4].DateTimeField42[0]',
  employment_1_to: 'form1[0].#subform[4].DateTimeField43[0]',
  employment_2_employer: 'form1[0].#subform[4].TextField13[41]',
  employment_2_occupation: 'form1[0].#subform[4].TextField13[42]',
  employment_2_from: 'form1[0].#subform[4].DateTimeField44[0]',
  employment_2_to: 'form1[0].#subform[4].DateTimeField45[0]',
  employment_3_employer: 'form1[0].#subform[4].TextField13[43]',
  employment_3_occupation: 'form1[0].#subform[4].TextField13[44]',
  employment_3_from: 'form1[0].#subform[4].DateTimeField46[0]',
  employment_3_to: 'form1[0].#subform[4].DateTimeField47[0]',
  // Filas 4 y 5: el PDF parece tener solo 3 filas visibles de employment;
  // si hay más, USCIS pide Supplement B. Skip por ahora.

  // ── Página 4 — Sección 5: Padres (Line 5) ─────────────────────────────
  // TextField35[0..5] = Current Location de las 6 filas (mother, father,
  // 4 siblings). Full Name + City of Birth tendrían que mapearse a otros
  // TextField; por ahora solo current_location queda mapeado.
  mother_current_location: 'form1[0].#subform[4].TextField35[0]',
  father_current_location: 'form1[0].#subform[4].TextField35[1]',
  // mother_name, mother_country_of_birth, father_name, father_country_of_birth:
  // requieren mapeo visual adicional (TODO).

  // ── Página 3 — Hijo 1 (subform[1]) ────────────────────────────────────
  child_1_alien_number: 'form1[0].#subform[1].ChildAlien1[0]',
  child_1_passport: 'form1[0].#subform[1].ChildPassport1[0]',
  child_1_marital_status: 'form1[0].#subform[1].ChildMarital1[0]',
  child_1_ssn: 'form1[0].#subform[1].ChildSSN1[0]',
  child_1_last_name: 'form1[0].#subform[1].ChildLast1[0]',
  child_1_first_name: 'form1[0].#subform[1].ChildFirst1[0]',
  child_1_middle_name: 'form1[0].#subform[1].ChildMiddle1[0]',
  child_1_dob: 'form1[0].#subform[1].ChildDOB1[0]',
  child_1_city_of_birth: 'form1[0].#subform[1].ChildCity1[0]',
  child_1_nationality: 'form1[0].#subform[1].ChildNat1[0]',
  child_1_race: 'form1[0].#subform[1].ChildRace1[0]',

  // ── Página 3 — Hijos 2, 3, 4 (subform[3]) ─────────────────────────────
  child_2_alien_number: 'form1[0].#subform[3].ChildAlien2[0]',
  child_2_passport: 'form1[0].#subform[3].ChildPassport2[0]',
  child_2_marital_status: 'form1[0].#subform[3].ChildMarital2[0]',
  child_2_ssn: 'form1[0].#subform[3].ChildSSN2[0]',
  child_2_last_name: 'form1[0].#subform[3].ChildLast2[0]',
  child_2_first_name: 'form1[0].#subform[3].ChildFirst2[0]',
  child_2_middle_name: 'form1[0].#subform[3].ChildMiddle2[0]',
  child_2_dob: 'form1[0].#subform[3].ChildDOB2[0]',
  child_2_city_of_birth: 'form1[0].#subform[3].ChildCity2[0]',
  child_2_nationality: 'form1[0].#subform[3].ChildNat2[0]',
  child_3_alien_number: 'form1[0].#subform[3].ChildAlien3[0]',
  child_3_passport: 'form1[0].#subform[3].ChildPassport3[0]',
  child_3_marital_status: 'form1[0].#subform[3].ChildMarital3[0]',
  child_3_ssn: 'form1[0].#subform[3].ChildSSN3[0]',
  child_3_last_name: 'form1[0].#subform[3].ChildLast3[0]',
  child_3_first_name: 'form1[0].#subform[3].ChildFirst3[0]',
  child_3_middle_name: 'form1[0].#subform[3].ChildMiddle3[0]',
  child_3_dob: 'form1[0].#subform[3].ChildDOB3[0]',
  child_3_city_of_birth: 'form1[0].#subform[3].ChildCity3[0]',
  child_3_nationality: 'form1[0].#subform[3].ChildNat3[0]',
  child_3_race: 'form1[0].#subform[3].ChildRace3[0]',
  child_4_alien_number: 'form1[0].#subform[3].ChildAlien4[0]',
  child_4_passport: 'form1[0].#subform[3].ChildPassport4[0]',
  child_4_marital_status: 'form1[0].#subform[3].ChildMarital4[0]',
  child_4_ssn: 'form1[0].#subform[3].ChildSSN4[0]',
  child_4_last_name: 'form1[0].#subform[3].ChildLast4[0]',
  child_4_first_name: 'form1[0].#subform[3].ChildFirst4[0]',
  child_4_middle_name: 'form1[0].#subform[3].ChildMiddle4[0]',
  child_4_dob: 'form1[0].#subform[3].ChildDOB4[0]',
  child_4_city_of_birth: 'form1[0].#subform[3].ChildCity4[0]',
  child_4_nationality: 'form1[0].#subform[3].ChildNat4[0]',
  child_4_race: 'form1[0].#subform[3].ChildRace4[0]',
}

/**
 * Map para campos checkbox con selección entre múltiples valores.
 * Cada wizardKey mapea valor reportado → field PDF a marcar.
 */
export const I589_RADIO_FIELD_MAP: Record<string, Record<string, string>> = {
  gender: {
    Masculino: 'form1[0].#subform[0].PartALine9Sex[0]',
    Femenino: 'form1[0].#subform[0].PartALine9Sex[1]',
  },
  marital_status: {
    'Soltero/a': 'form1[0].#subform[0].Marital[0]',
    'Casado/a': 'form1[0].#subform[0].Marital[1]',
    'Divorciado/a': 'form1[0].#subform[0].Marital[2]',
    'Viudo/a': 'form1[0].#subform[0].Marital[3]',
  },
  // Sexo de cada hijo (CheckBox12_Sex[2/3] para hijo 1, CheckBox26/36/46 para hijos 2/3/4)
  child_1_gender: {
    Masculino: 'form1[0].#subform[1].CheckBox12_Sex[0]',
    Femenino: 'form1[0].#subform[1].CheckBox12_Sex[1]',
  },
  child_2_gender: {
    Masculino: 'form1[0].#subform[3].CheckBox26_Sex[0]',
    Femenino: 'form1[0].#subform[3].CheckBox26_Sex[1]',
  },
  child_3_gender: {
    Masculino: 'form1[0].#subform[3].CheckBox36_Sex[0]',
    Femenino: 'form1[0].#subform[3].CheckBox36_Sex[1]',
  },
  child_4_gender: {
    Masculino: 'form1[0].#subform[3].CheckBox46_Sex[0]',
    Femenino: 'form1[0].#subform[3].CheckBox46_Sex[1]',
  },
}

/**
 * Father/Mother deceased checkbox: si vienen como 'yes', necesitamos
 * marcar el deceased checkbox. Las posiciones específicas en el PDF
 * USCIS requieren mapeo adicional — por ahora skip (los campos
 * mother_deceased/father_deceased no llegan al PDF, info queda en wizard).
 */

/**
 * Map para checkboxes booleanas Yes/No. El generador marca el Yes-field
 * cuando el wizardKey reporta sí/yes/true, el No-field para no/false.
 */
export const I589_YESNO_FIELD_MAP: Record<string, { yes: string; no: string }> = {
  immigration_court_proceedings: {
    yes: 'form1[0].#subform[0].CheckBox4[0]',
    no: 'form1[0].#subform[0].CheckBox4[1]',
  },
  // PtAIILine22: Is your spouse in the U.S.?
  spouse_in_us: {
    yes: 'form1[0].#subform[1].NotMarried[0].PtAIILine22_Yes[0]',
    no: 'form1[0].#subform[1].NotMarried[0].PtAIILine22_No[0]',
  },
  // PtAIILine24: Is your spouse to be included in this application?
  spouse_include_in_application: {
    yes: 'form1[0].#subform[1].NotMarried[0].PtAIILine24_Yes[0]',
    no: 'form1[0].#subform[1].NotMarried[0].PtAIILine24_No[0]',
  },
  // ChildrenCheckbox controla "Do you have any children?"
  has_children: {
    yes: 'form1[0].#subform[1].ChildrenCheckbox[1]',
    no: 'form1[0].#subform[1].ChildrenCheckbox[0]',
  },
  // CheckBox17: Include children in this application?
  children_include_in_application: {
    yes: 'form1[0].#subform[1].CheckBox17[0]',
    no: 'form1[0].#subform[1].CheckBox17[1]',
  },
}

/**
 * Children total count va a TotalChild si has_children=yes.
 */
export const I589_CHILDREN_TOTAL_FIELD = 'form1[0].#subform[1].TotalChild[0]'

// ────────────────────────────────────────────────────────────────────────
//  PARTE B — Páginas 5-7 (motivos de persecución)
// ────────────────────────────────────────────────────────────────────────

/**
 * Los 5 protected grounds del INA Section 208 + tortura. Cada wizardKey
 * (que viene del JSON estructurado del Miedo Creíble v3) mapea al
 * checkbox específico en B.1.
 */
export const I589_PART_B_PROTECTED_GROUNDS: Record<string, string> = {
  race: 'form1[0].#subform[5].#subform[6].CheckBoxrace[0]',
  religion: 'form1[0].#subform[5].#subform[6].CheckBoxreligion[0]',
  nationality: 'form1[0].#subform[5].#subform[6].CheckBoxnationality[0]',
  politica: 'form1[0].#subform[5].#subform[6].CheckBoxpolitics[0]',
  social: 'form1[0].#subform[5].#subform[6].CheckBoxsocial[0]',
  tortura: 'form1[0].#subform[5].#subform[6].CheckBoxtorture[0]',
}

/**
 * Preguntas B.1.a, B.1.b, B.2, B.3.a, B.3.b, B.4 — cada una con dual
 * Yes/No checkbox + multiline textarea para explicación.
 */
export const I589_PART_B_QUESTIONS: Record<
  string,
  { yes: string; no: string; text: string }
> = {
  b1_a: {
    yes: 'form1[0].#subform[5].#subform[6].ckboxyn1a[0]',
    no: 'form1[0].#subform[5].#subform[6].ckboxyn1a[1]',
    text: 'form1[0].#subform[5].#subform[6].TextField14[0]',
  },
  b1_b: {
    yes: 'form1[0].#subform[5].#subform[6].ckboxyn1b[0]',
    no: 'form1[0].#subform[5].#subform[6].ckboxyn1b[1]',
    text: 'form1[0].#subform[5].#subform[6].TextField15[0]',
  },
  b2_torture: {
    yes: 'form1[0].#subform[7].ckboxyn2[0]',
    no: 'form1[0].#subform[7].ckboxyn2[1]',
    text: 'form1[0].#subform[7].PBL2_TextField[0]',
  },
  b3_a_prior_asylum: {
    yes: 'form1[0].#subform[7].ckboxyn3a[0]',
    no: 'form1[0].#subform[7].ckboxyn3a[1]',
    text: 'form1[0].#subform[7].PBL3A_TextField[0]',
  },
  b3_b_family_asylum: {
    yes: 'form1[0].#subform[7].ckboxyn3b[0]',
    no: 'form1[0].#subform[7].ckboxyn3b[1]',
    text: 'form1[0].#subform[7].PBL3B_TextField[0]',
  },
  b4_criminal: {
    yes: 'form1[0].#subform[7].ckboxyn4[0]',
    no: 'form1[0].#subform[7].ckboxyn4[1]',
    text: 'form1[0].#subform[7].PB4_TextField[0]',
  },
}

// ────────────────────────────────────────────────────────────────────────
//  PARTE C — Páginas 8-9 (preguntas adicionales)
// ────────────────────────────────────────────────────────────────────────

/**
 * Preguntas C.1 a C.6. Algunas tienen textarea, otras solo Y/N.
 */
export const I589_PART_C_QUESTIONS: Record<
  string,
  { yes: string; no: string; text?: string }
> = {
  c1_filed_before: {
    yes: 'form1[0].#subform[8].ckboxync1[0]',
    no: 'form1[0].#subform[8].ckboxync1[1]',
    text: 'form1[0].#subform[8].PCL1_TextField[0]',
  },
  c2_a_third_country: {
    yes: 'form1[0].#subform[8].ckboxync2a[0]',
    no: 'form1[0].#subform[8].ckboxync2a[1]',
  },
  c2_b_third_country: {
    yes: 'form1[0].#subform[8].ckboxync2b[0]',
    no: 'form1[0].#subform[8].ckboxync2b[1]',
    text: 'form1[0].#subform[8].PCL2B_TextField[0]',
  },
  c3_other_apps: {
    yes: 'form1[0].#subform[8].ckboxync3[0]',
    no: 'form1[0].#subform[8].ckboxync3[1]',
    text: 'form1[0].#subform[8].PCL3_TextField[0]',
  },
  c4_family_filed: {
    yes: 'form1[0].#subform[9].PCckboxyn4[0]',
    no: 'form1[0].#subform[9].PCckboxyn4[1]',
    text: 'form1[0].#subform[9].PCL4_TextField[0]',
  },
  c5_military: {
    yes: 'form1[0].#subform[9].ckboxync5[0]',
    no: 'form1[0].#subform[9].ckboxync5[1]',
    text: 'form1[0].#subform[9].PCL5_TextField[0]',
  },
  c6_other_persecutor: {
    yes: 'form1[0].#subform[9].ckboxync6[0]',
    no: 'form1[0].#subform[9].ckboxync6[1]',
    text: 'form1[0].#subform[9].PCL6_TextField[0]',
  },
}
