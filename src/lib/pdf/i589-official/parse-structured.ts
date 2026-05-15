/**
 * Extrae el bloque JSON estructurado que el prompt v3 del Miedo Creíble
 * embebe al final del `body_md` entre delimitadores HTML comment:
 *
 *   <!-- I589_STRUCTURED_START
 *   { "protected_grounds": [...], "b1_a": {...}, ... }
 *   I589_STRUCTURED_END -->
 *
 * Los HTML comments son invisibles en Word/HTML, y el parser docx ya
 * filtra líneas dentro de comments. El JSON se usa para llenar la
 * Parte B/C del PDF I-589 oficial.
 *
 * Si el draft es viejo (v2) o el JSON es inválido, devuelve defaults
 * conservadores (todo `{yes: false, explanation: ''}`) para que el PDF
 * Parte B se imprima vacío en lugar de romperse.
 */

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
