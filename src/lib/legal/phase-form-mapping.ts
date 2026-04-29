import type { CasePhase } from '@/types/database'
import type { AutomatedFormDefinition } from './automated-forms-registry'

/**
 * Mapping fase SIJS → qué forms del registry aplican.
 *
 * - custodia: forms estatales (SAPCR, motion, affidavit, order). Sólo aplican
 *   los que matchean state_us del caso.
 * - i360 / i485: forms federales USCIS (cuando se agreguen al registry).
 *   Por ahora no hay forms registry de I-360/I-485 — los wizards legacy
 *   I360Wizard/I589Wizard cubren ese flujo en pestaña Más.
 */

interface PhasePolicy {
  packetTypes: Array<'intake' | 'merits'>
  slugMatches: (def: AutomatedFormDefinition) => boolean
}

export const PHASE_FORM_POLICY: Record<CasePhase, PhasePolicy> = {
  custodia: {
    packetTypes: ['merits'],
    slugMatches: (def) =>
      /sapcr|motion|affidavit|order|pr-gen-116|fm-|guardianship|custody|dependency|sij/i.test(def.slug),
  },
  i360: {
    packetTypes: ['intake', 'merits'],
    slugMatches: (def) => /i360|i-360|cover|g-?28/i.test(def.slug),
  },
  i485: {
    packetTypes: ['intake', 'merits'],
    slugMatches: (def) => /i485|i-485|i-693|i-765|i-131/i.test(def.slug),
  },
  completado: {
    packetTypes: [],
    slugMatches: () => false,
  },
}

/**
 * Determina si un form aplica para (phase, state). state vacío = multi-estado.
 */
export function formApplies(def: AutomatedFormDefinition, phase: CasePhase, stateUs: string | null): boolean {
  const policy = PHASE_FORM_POLICY[phase]
  if (!policy.packetTypes.includes(def.packetType)) return false
  if (!policy.slugMatches(def)) return false
  if (def.states.length === 0) return true  // multi-estado / federal
  if (!stateUs) return false
  return def.states.includes(stateUs.toUpperCase())
}
