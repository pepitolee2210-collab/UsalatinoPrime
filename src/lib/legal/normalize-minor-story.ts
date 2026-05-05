/**
 * Normaliza el `form_data` de `case_form_submissions[form_type='client_story']`
 * a la shape estructurada del wizard nuevo (`minorBasic` / `minorAbuse` /
 * `minorBestInterest`), sin importar si el cliente llenó el wizard antes o
 * después de la migración del esquema.
 *
 * **Por qué existe:** hubo dos versiones del wizard `client_story`. La nueva
 * guarda en `minorBasic`, `minorAbuse`, `minorBestInterest` (ver
 * `cita/[token]/client-story-wizard.tsx`). La vieja guardaba `minor_info`
 * (solo `name`/`guardian_relation`) más campos planos de narrativa libre
 * (`who_brought`, `arrival_year`, `how_was_abandonment`, etc.).
 *
 * El endpoint de generación de declaraciones leía solo el shape nuevo, así
 * que para los 4 casos legacy en producción los prompts a Claude eran
 * idénticos para todos los menores (todos los campos vacíos), generando
 * cartas indistinguibles. Diana detectó el bug en el caso de Marian
 * (HF-2026-0098, 2 menores con cartas idénticas).
 */

const EMPTY: Record<string, string> = {}

export interface NormalizedMinorStory {
  /** Datos de identificación. Hidratado desde `supplementaryMinor` cuando el legacy no los tiene. */
  minorBasic: Record<string, string>
  /** Hechos de maltrato. Mapeo "best effort" desde campos legacy. */
  minorAbuse: Record<string, string>
  /** Mejor interés. Mapeo "best effort" desde campos legacy. */
  minorBestInterest: Record<string, string>
  /**
   * Narrativa libre tal como la dejó el cliente en el wizard viejo. Vacío
   * cuando el esquema es nuevo. Útil para inyectarla al prompt del LLM como
   * fuente primaria de la sección "Hechos" — es de donde Diana obtenía la
   * historia antes y donde está la información rica.
   */
  legacyNarrative: Record<string, string>
  /** `true` si el `form_data` venía del wizard viejo. Útil para logs. */
  isLegacy: boolean
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

/**
 * @param formData El `form_data` crudo del registro `case_form_submissions`
 *   (puede venir del wizard nuevo o del viejo).
 * @param supplementaryMinor Entrada correspondiente en
 *   `admin_supplementary.form_data.minors[index]` si Diana ya completó esos
 *   datos. Se usa para hidratar `dob`, `country`, `birth_city`, `id_number`
 *   en casos legacy donde el cliente no los capturó.
 */
export function normalizeMinorStory(
  formData: Record<string, unknown> | null | undefined,
  supplementaryMinor?: Record<string, string>,
): NormalizedMinorStory {
  const fd = formData || {}
  const hasNewShape = !!(fd.minorBasic || fd.minorAbuse || fd.minorBestInterest)

  if (hasNewShape) {
    return {
      minorBasic: asObject(fd.minorBasic) as Record<string, string>,
      minorAbuse: asObject(fd.minorAbuse) as Record<string, string>,
      minorBestInterest: asObject(fd.minorBestInterest) as Record<string, string>,
      legacyNarrative: EMPTY,
      isLegacy: false,
    }
  }

  const info = asObject(fd.minor_info) as { name?: string; guardian_relation?: string }
  const supp = supplementaryMinor || {}
  const legacyName = (info.name || '').trim()

  return {
    minorBasic: {
      full_name: legacyName || (supp.name || '').trim(),
      dob: supp.dob || '',
      country: supp.country || '',
      nationality: supp.country || '',
      birth_city: supp.birth_city || '',
      id_type: supp.id_type || '',
      id_number: supp.id_number || '',
      address: supp.address || '',
      civil_status: '',
      in_us: '',
      lives_with: '',
      lives_with_relationship: '',
      how_arrived: asString(fd.who_brought),
      arrival_date: asString(fd.arrival_year),
      accompanied_by: asString(fd.who_brought),
      detained_by_immigration: '',
      released_by_orr: '',
      orr_sponsor: '',
      a_number: '',
      ssn: '',
      i94_number: '',
      nonimmigrant_status: '',
      court_order_date: '',
    },
    minorAbuse: {
      abandonment: asString(fd.how_was_abandonment),
      abandonment_details: asString(fd.additional_details),
      abandoned_by: '',
      life_in_country: '',
      abuse_by_father: '',
      abuse_by_mother: '',
      physical_abuse: '',
      emotional_abuse: '',
      negligence: asString(fd.father_economic_support),
      parent_substance_abuse: '',
    },
    minorBestInterest: {
      reported_to_authorities: asString(fd.has_complaints),
      report_details: asString(fd.complaints_detail),
      physical_scars: '',
      therapy_received: '',
      therapy_details: '',
      fear_of_return: '',
      fear_details: '',
      gang_threats: '',
      gang_details: '',
      caretaker_in_country: asString(fd.who_took_care),
      current_life_us: '',
      attends_school: '',
      safe_home: '',
      legal_problems: '',
      wants_to_stay: '',
      why_stay: asString(fd.why_no_reunification),
    },
    legacyNarrative: {
      who_brought: asString(fd.who_brought),
      arrival_year: asString(fd.arrival_year),
      who_took_care: asString(fd.who_took_care),
      separation_date: asString(fd.separation_date),
      current_guardian: asString(fd.current_guardian),
      has_complaints: asString(fd.has_complaints),
      complaints_detail: asString(fd.complaints_detail),
      additional_details: asString(fd.additional_details),
      how_was_abandonment: asString(fd.how_was_abandonment),
      why_no_reunification: asString(fd.why_no_reunification),
      father_economic_support: asString(fd.father_economic_support),
      father_contact_with_child: asString(fd.father_contact_with_child),
    },
    isLegacy: true,
  }
}

/**
 * Render del `legacyNarrative` como bloque para el prompt. Devuelve string
 * vacío si todos los campos están vacíos (esquema nuevo o legacy sin datos).
 */
export function buildLegacyNarrativeBlock(narrative: Record<string, string>): string {
  const entries = Object.entries(narrative).filter(([, v]) => (v || '').trim().length > 0)
  if (entries.length === 0) return ''

  const lines = entries.map(([k, v]) => `- ${k}: ${v}`).join('\n')
  return `\n\n=== CLIENT STORY (legacy free-text — primary source for the abuse/neglect narrative) ===\n${lines}\nUSE these answers as the primary narrative source for sections describing the absent parent's behavior, the abandonment, and the reasons why reunification is not viable. Each menor (minor) has their own legacy narrative — do NOT mix narratives between siblings.`
}
