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

  // ── Página 4 — Parte A.III: Última dirección antes de EE.UU. ─────────
  // La tabla "Residences during past 5 years" tiene 4 filas; fila 1 es
  // la dirección anterior a EE.UU. (la fila 0 es la actual de EE.UU.).
  // Cada fila = 4 TextField13 (street/city/state/country) + 2 dates (from/to).
  last_address_before_us_street: 'form1[0].#subform[4].TextField13[4]',
  last_address_before_us_city: 'form1[0].#subform[4].TextField13[5]',
  last_address_before_us_state: 'form1[0].#subform[4].TextField13[6]',
  last_address_before_us_country: 'form1[0].#subform[4].TextField13[7]',
  last_address_before_us_from: 'form1[0].#subform[4].DateTimeField22[0]',
  last_address_before_us_to: 'form1[0].#subform[4].DateTimeField23[0]',

  // ── Padres (Parte A.III, Line 5) ──────────────────────────────────────
  mother_name: 'form1[0].#subform[4].TextField35[0]',
  mother_country_of_birth: 'form1[0].#subform[4].TextField35[1]',
  mother_current_location: 'form1[0].#subform[4].TextField35[2]',
  father_name: 'form1[0].#subform[4].TextField35[3]',
  father_country_of_birth: 'form1[0].#subform[4].TextField35[4]',
  father_current_location: 'form1[0].#subform[4].TextField35[5]',
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
}

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
