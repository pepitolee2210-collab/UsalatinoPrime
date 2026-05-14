/**
 * Resolver de "miembros de familia" de un contrato — generaliza el patrón
 * pre-existente de SIJS (`contracts.minors[]`) a Asilo Político (que añade
 * solicitante + cónyuge además de hijos).
 *
 * Comportamiento por servicio:
 *   - Visa Juvenil (SIJS): retorna SOLO los minors. El solicitante NO entra
 *     porque en SIJS el cliente firmante (tutor) NO es beneficiario; los
 *     beneficiarios son los menores. Preserva el flujo original 1:1.
 *   - Asilo Político: retorna [applicant, spouse?, ...minors]. Solo cuando el
 *     contrato es Familiar+Casados o Familiar+Convivientes se añade spouse.
 *   - Otros servicios: retorna solo minors (legacy).
 *
 * El endpoint `/api/cita/[token]/required-documents` usa este helper para
 * expandir cada `document_types.is_per_member=true` por cada miembro y
 * mostrarle al cliente una card por persona (con sufijo "— Cónyuge (María)").
 */

export type MemberRole = 'applicant' | 'spouse' | 'minor'

export interface FamilyMember {
  role: MemberRole
  /** Índice 0-based en `contracts.minors[]`. NULL para applicant/spouse. */
  index: number | null
  fullName: string
  /** Primer nombre — usado para el sufijo "— María" en el name_es del doc. */
  shortLabel: string
}

export interface ContractLike {
  client_full_name?: string | null
  spouse?: { fullName?: string | null } | null
  minors?: Array<{ fullName?: string | null }> | null
  asylum_family_type?: string | null
}

export interface GetFamilyMembersOpts {
  /**
   * Slug del servicio del caso. Solo `'asilo-politico'` agrega applicant +
   * spouse al output. SIJS y otros servicios siguen el patrón legacy
   * (solo minors).
   */
  serviceSlug?: string | null
}

function firstName(s: string | null | undefined): string {
  if (!s) return ''
  return s.trim().split(/\s+/)[0] ?? s.trim()
}

export function getFamilyMembers(
  contract: ContractLike,
  opts: GetFamilyMembersOpts = {},
): FamilyMember[] {
  const isAsiloPolitico = opts.serviceSlug === 'asilo-politico'
  const out: FamilyMember[] = []

  if (isAsiloPolitico) {
    const applicantName = (contract.client_full_name ?? '').trim()
    if (applicantName) {
      out.push({
        role: 'applicant',
        index: null,
        fullName: applicantName,
        shortLabel: firstName(applicantName) || 'Solicitante',
      })
    }

    const includeSpouse =
      contract.asylum_family_type === 'married' ||
      contract.asylum_family_type === 'cohabiting_with_kids'
    const spouseName = contract.spouse?.fullName?.trim()
    if (includeSpouse && spouseName) {
      out.push({
        role: 'spouse',
        index: null,
        fullName: spouseName,
        shortLabel: firstName(spouseName) || 'Cónyuge',
      })
    }
  }

  ;(contract.minors ?? []).forEach((m, i) => {
    const name = m?.fullName?.trim()
    if (!name) return
    out.push({
      role: 'minor',
      index: i,
      fullName: name,
      shortLabel: firstName(name) || `Hijo ${i + 1}`,
    })
  })

  return out
}

/**
 * Sufijo legible que se concatena al nombre del documento para distinguir
 * a quién pertenece la card en la pestaña Documentos del cliente.
 *
 * Ej: "Pasaporte" + memberSuffix(applicant) = "Pasaporte — Solicitante (Hector)"
 */
export function memberSuffix(fm: FamilyMember): string {
  switch (fm.role) {
    case 'applicant':
      return ` — Solicitante (${fm.shortLabel})`
    case 'spouse':
      return ` — Cónyuge (${fm.shortLabel})`
    case 'minor':
      return ` — Hijo/a (${fm.shortLabel})`
  }
}
