/**
 * Mapeo de los `key` del wizard cliente I-589 Parte A (definidos en
 * `src/components/i589/i589-part-a-questions.ts`) a los nombres reales
 * de fields AcroForm del PDF USCIS I-589 oficial.
 *
 * Fuente del PDF: USCIS Form I-589 (XFA edition).
 * Field names extraídos con `scripts/inspect-usa-i-589-asylum-fields.mjs`
 * → `scripts/usa-i-589-asylum-raw-fields.json` (460 fields totales, ~140
 * relevantes para Parte A en páginas 1-4).
 *
 * Cubrimos los fields que el PDF nombra explícitamente con convención USCIS
 * (`PtAILineN_<Name>[0]`, `PartALine9Sex`, `Marital`, `PtAIILineN_<Name>[0]`).
 * Los fields anónimos del XFA (`TextField1[N]`, `DateTimeField1[N]`,
 * `CheckBox3[N]`) quedan sin mapear en este MVP — Diana puede llenarlos a
 * mano cuando imprima el formulario. En iteración posterior se mapean por
 * orden empírico después de smoke-tests con casos reales.
 *
 * Solo Parte A (páginas 1-4). Partes B/C se llenan vía Miedo Creíble.
 */

/**
 * Map directo: `wizardKey` → `pdfFieldName` para campos de texto/date.
 * Solo se incluyen las claves donde la correspondencia es clara y unívoca.
 */
export const I589_TEXT_FIELD_MAP: Record<string, string> = {
  // ── Página 1 — Parte A.I: Información del solicitante ─────────────────
  a_number: 'form1[0].#subform[0].PtAILine1_ANumber[0]',
  legal_last_name: 'form1[0].#subform[0].PtAILine4_LastName[0]',
  legal_first_name: 'form1[0].#subform[0].PtAILine5_FirstName[0]',
  legal_middle_name: 'form1[0].#subform[0].PtAILine6_MiddleName[0]',

  // Domicilio en EE.UU. (Line 8). El wizard tiene una sola dirección;
  // la mapeamos al residence address. Mailing address (Line 9) queda vacía.
  residence_address_street: 'form1[0].#subform[0].PtAILine8_StreetNumandName[0]',
  residence_address_state: 'form1[0].#subform[0].PtAILine8_State[0]',
  residence_address_zip: 'form1[0].#subform[0].PtAILine8_Zipcode[0]',

  // ── Página 2 — Parte A.II: Cónyuge ────────────────────────────────────
  // OJO: USCIS bautizó el subform como "NotMarried" aunque contiene los
  // datos del cónyuge. Es un quirk del XFA template; el field name real
  // es ese y debemos respetarlo.
  spouse_last_name: 'form1[0].#subform[1].NotMarried[0].PtAIILine5_LastName[0]',
  spouse_first_name: 'form1[0].#subform[1].NotMarried[0].PtAIILine6_FirstName[0]',

  // ── Hijo 1 (subform[1]) ───────────────────────────────────────────────
  // El wizard no captura nombre de cada hijo individualmente (solo el
  // total y cuántos están en EE.UU.). Estos fields quedan en blanco;
  // Diana los completa manualmente. Documentamos los nombres para
  // habilitar la extensión futura.
  // child1_last_name: 'form1[0].#subform[1].ChildLast1[0]',
  // child1_first_name: 'form1[0].#subform[1].ChildFirst1[0]',
  // child1_middle_name: 'form1[0].#subform[1].ChildMiddle1[0]',
  // child1_dob: 'form1[0].#subform[1].ChildDOB1[0]',
}

/**
 * Map para campos checkbox que NO son Yes/No (selección entre múltiples
 * valores). Cada wizardKey mapea a un objeto donde la clave es el valor
 * que reporta el wizard y el valor es el nombre del field PDF a marcar.
 *
 * Ejemplo: si `gender === 'Masculino'`, marcamos `PartALine9Sex[0]`.
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
 * Map para checkboxes booleanas con dos opciones (Yes/No). El generador
 * marca el Yes-field cuando el wizardKey reporta 'sí'/'yes'/true, y el
 * No-field en caso contrario.
 *
 * Solo poblamos los Yes/No claramente identificables. Resto queda manual.
 */
export const I589_YESNO_FIELD_MAP: Record<string, { yes: string; no: string }> = {
  // PtAIILine22 controla "Is your spouse in the U.S.?" — wizard usa `spouse_in_us`
  spouse_in_us: {
    yes: 'form1[0].#subform[1].NotMarried[0].PtAIILine22_Yes[0]',
    no: 'form1[0].#subform[1].NotMarried[0].PtAIILine22_No[0]',
  },
  // PtAIILine24 controla "Is your spouse to be included in this application?"
  spouse_include_in_application: {
    yes: 'form1[0].#subform[1].NotMarried[0].PtAIILine24_Yes[0]',
    no: 'form1[0].#subform[1].NotMarried[0].PtAIILine24_No[0]',
  },
}

/**
 * Lista de PDF field names que pertenecen a las páginas 1-4 (Parte A).
 * Se usa para verificar que el generador no toca campos de páginas 5+.
 * Solo informativo — el generador truncará a páginas 1-4 después de
 * llenar todo, así que aunque se rellene algo de página 5+ no aparecerá
 * en el PDF final.
 */
export const I589_PART_A_SUBFORMS = ['#subform[0]', '#subform[1]', '#subform[2]', '#subform[3]'] as const
