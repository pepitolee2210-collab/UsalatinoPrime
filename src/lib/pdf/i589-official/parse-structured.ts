// Parser del JSON estructurado del Miedo Creíble.
//
// Dos modos de input:
//   1. Nuevo (v5): la fila `case_credible_fear_drafts.i589_field_values_json`
//      contiene directamente un objeto que matchea el schema canónico. Lo
//      mapeamos a la forma v4 que `generate-i589-part-b.ts` ya sabe
//      consumir (los nombres v4 están mal etiquetados pero apuntan a los
//      AcroForm fields correctos del PDF USCIS).
//   2. Legacy (v4): la fila tiene `body_md` con un bloque
//      `<!-- I589_STRUCTURED_START { ... } I589_STRUCTURED_END -->` que
//      extraemos con regex.
//
// Si ambos están vacíos, devolvemos DEFAULTS conservadores (todo no) para
// que el PDF se imprima vacío en lugar de romperse.

export interface StructuredI589BC {
  protected_grounds: string[]
  b1_a: { yes: boolean; explanation: string }
  b1_b: { yes: boolean; explanation: string }
  b2_torture: { yes: boolean; explanation: string }
  b3_a_prior_asylum: { yes: boolean; explanation: string }
  b3_b_family_asylum: { yes: boolean; explanation: string }
  b4_criminal: { yes: boolean; explanation: string }
  c1_filed_before: { yes: boolean; explanation: string }
  c2_a_third_country: { yes: boolean }
  c2_b_third_country: { yes: boolean; explanation: string }
  c3_other_apps: { yes: boolean; explanation: string }
  c4_family_filed: { yes: boolean }
  c5_military: { yes: boolean; explanation: string }
  c6_other_persecutor: { yes: boolean; explanation: string }
}

const DEFAULTS: StructuredI589BC = {
  protected_grounds: [],
  b1_a: { yes: false, explanation: '' },
  b1_b: { yes: false, explanation: '' },
  b2_torture: { yes: false, explanation: '' },
  b3_a_prior_asylum: { yes: false, explanation: '' },
  b3_b_family_asylum: { yes: false, explanation: '' },
  b4_criminal: { yes: false, explanation: '' },
  c1_filed_before: { yes: false, explanation: '' },
  c2_a_third_country: { yes: false },
  c2_b_third_country: { yes: false, explanation: '' },
  c3_other_apps: { yes: false, explanation: '' },
  c4_family_filed: { yes: false },
  c5_military: { yes: false, explanation: '' },
  c6_other_persecutor: { yes: false, explanation: '' },
}

const RE = /I589_STRUCTURED_START\s*([\s\S]*?)\s*I589_STRUCTURED_END/

/** Parser legacy v4 — extrae el JSON del HTML comment dentro del Markdown. */
export function parseStructuredI589(bodyMd: string | null | undefined): StructuredI589BC {
  if (!bodyMd) return { ...DEFAULTS }
  const m = bodyMd.match(RE)
  if (!m) return { ...DEFAULTS }
  try {
    const parsed = JSON.parse(m[1]) as Partial<StructuredI589BC>
    return { ...DEFAULTS, ...parsed }
  } catch {
    return { ...DEFAULTS }
  }
}

export function hasStructuredBlock(bodyMd: string | null | undefined): boolean {
  return !!bodyMd && RE.test(bodyMd)
}

/**
 * Schema del JSON v5 que la IA produce y que se persiste en
 * `case_credible_fear_drafts.i589_field_values_json`. Se mapea aquí a la
 * forma v4 que `generate-i589-part-b.ts` consume.
 */
interface YesNoText {
  answer_yes?: boolean
  summary_text?: string
}

export interface I589FieldValuesV5 {
  part_b_q1_grounds?: {
    race?: boolean
    religion?: boolean
    nationality?: boolean
    political_opinion?: boolean
    particular_social_group?: boolean
    torture_convention?: boolean
  }
  part_b_q1a_past_persecution?: YesNoText
  part_b_q1b_future_fear?: YesNoText
  part_b_q2_legal_trouble?: YesNoText
  part_b_q3a_organizations?: YesNoText
  part_b_q3b_continued_participation?: YesNoText
  part_b_q4_torture_fear?: YesNoText
  part_c_q1_prior_applications?: YesNoText
  part_c_q2a_transit_countries?: YesNoText
  part_c_q2b_third_country_status?: YesNoText
  part_c_q3_persecutor_bar?: YesNoText
  part_c_q4_returned_to_country?: YesNoText
  part_c_q5_one_year_late?: YesNoText
  part_c_q6_us_crimes?: YesNoText
}

const V5_GROUND_TO_V4: Record<string, string> = {
  race: 'race',
  religion: 'religion',
  nationality: 'nationality',
  political_opinion: 'politica',
  particular_social_group: 'social',
  torture_convention: 'tortura',
}

/**
 * Mapea el JSON v5 (claves canónicas) al schema v4 (claves cortas que el
 * field-map y `buildPartBCValues` consumen). El field-map v4 tiene nombres
 * confusos (ej. `b2_torture` apunta al field Q2 de Legal Trouble, no a
 * torture) pero los AcroForm fields apuntados son correctos.
 */
export function mapV5ToStructured(v5: I589FieldValuesV5 | null | undefined): StructuredI589BC {
  if (!v5) return { ...DEFAULTS }
  const grounds = v5.part_b_q1_grounds ?? {}
  const protected_grounds: string[] = []
  for (const [k, on] of Object.entries(grounds)) {
    if (on && V5_GROUND_TO_V4[k]) protected_grounds.push(V5_GROUND_TO_V4[k])
  }
  const yn = (q: YesNoText | undefined) => ({
    yes: Boolean(q?.answer_yes),
    explanation: q?.summary_text ?? '',
  })
  return {
    protected_grounds,
    b1_a: yn(v5.part_b_q1a_past_persecution),
    b1_b: yn(v5.part_b_q1b_future_fear),
    // b2_torture en v4 apunta al field Q2 (Legal Trouble) — mapping correcto al v5.
    b2_torture: yn(v5.part_b_q2_legal_trouble),
    // b3_a_prior_asylum en v4 apunta al field Q3.A (Organizations).
    b3_a_prior_asylum: yn(v5.part_b_q3a_organizations),
    // b3_b_family_asylum en v4 apunta al field Q3.B (Continued Participation).
    b3_b_family_asylum: yn(v5.part_b_q3b_continued_participation),
    // b4_criminal en v4 apunta al field Q4 (CAT Torture Fear).
    b4_criminal: yn(v5.part_b_q4_torture_fear),
    c1_filed_before: yn(v5.part_c_q1_prior_applications),
    c2_a_third_country: { yes: Boolean(v5.part_c_q2a_transit_countries?.answer_yes) },
    c2_b_third_country: yn(v5.part_c_q2b_third_country_status),
    // c3_other_apps en v4 apunta al field Q3 (Persecutor Bar).
    c3_other_apps: yn(v5.part_c_q3_persecutor_bar),
    // c4_family_filed en v4 apunta al field Q4 (Returned to Country).
    c4_family_filed: { yes: Boolean(v5.part_c_q4_returned_to_country?.answer_yes) },
    // c5_military en v4 apunta al field Q5 (One Year Late).
    c5_military: yn(v5.part_c_q5_one_year_late),
    // c6_other_persecutor en v4 apunta al field Q6 (US Crimes).
    c6_other_persecutor: yn(v5.part_c_q6_us_crimes),
  }
}

/**
 * Helper unificado: prefiere v5 JSONB columnar, cae al body_md regex.
 */
export function loadStructured(
  i589FieldValuesJson: I589FieldValuesV5 | null | undefined,
  bodyMd: string | null | undefined,
): StructuredI589BC {
  if (i589FieldValuesJson && Object.keys(i589FieldValuesJson).length > 0) {
    return mapV5ToStructured(i589FieldValuesJson)
  }
  return parseStructuredI589(bodyMd)
}
