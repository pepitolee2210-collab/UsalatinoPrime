/**
 * SIJS (Special Immigrant Juvenile Status) eligibility filter.
 *
 * Runs the four user-facing questions through a pure function so the worker,
 * the admin panel, and the tests all use the same verdict logic.
 *
 * State age limits (investigated from USCIS + state juvenile court rules):
 *   - Texas:    18 (juvenile court loses jurisdiction at 18)
 *   - Alabama:  19 (age of majority is 19)
 *   - Nebraska: 19 (age of majority is 19)
 *   - Everyone else: 21 (federal cap)
 *
 * The federal SIJS rule requires the petitioner to be <21 at filing, but the
 * predicate state-court order has its own jurisdictional cutoff — that is the
 * real binding constraint and it is what this map encodes.
 */

export const STATE_AGE_LIMITS: Record<string, number> = {
  TX: 18,
  AL: 19,
  NE: 19,
}

export const FEDERAL_SIJS_AGE_CAP = 21

export function getStateAgeLimit(state: string): number {
  return STATE_AGE_LIMITS[state.trim().toUpperCase()] ?? FEDERAL_SIJS_AGE_CAP
}

export interface SijsIntake {
  lives_in_usa: boolean | null
  age: number | null
  state_us: string | null
  suffered_abuse: boolean | null
}

export type RecommendedAction =
  | 'offer_free_consultation'
  | 'no_sijs_path'
  | 'human_review'

export interface EligibilityVerdict {
  verdict: 'eligible' | 'not_eligible' | 'requires_review'
  reasons: string[]
  state_age_limit: number
  recommended_action: RecommendedAction
}

/**
 * Evaluate a SIJS intake. Deterministic, no I/O. Pass null for unanswered
 * fields — the verdict will then be `requires_review` so a human can follow up.
 */
export function evaluateEligibility(intake: SijsIntake): EligibilityVerdict {
  const limit = intake.state_us ? getStateAgeLimit(intake.state_us) : FEDERAL_SIJS_AGE_CAP
  const unknowns: string[] = []

  // Hard no-go: must be physically present in the US.
  if (intake.lives_in_usa === false) {
    return {
      verdict: 'not_eligible',
      reasons: ['El menor debe estar físicamente en los Estados Unidos para calificar a SIJS.'],
      state_age_limit: limit,
      recommended_action: 'no_sijs_path',
    }
  }
  if (intake.lives_in_usa === null) unknowns.push('lives_in_usa')

  // Age vs state-specific jurisdictional cutoff.
  if (intake.age != null && intake.state_us) {
    if (intake.age >= limit) {
      // Edge case: state cutoff is lower than 21 but the person is still <21.
      // Sometimes a jurisdiction change (e.g. move to a state with a higher
      // cutoff) opens a path. Flag for human review rather than hard-reject.
      if (limit < FEDERAL_SIJS_AGE_CAP && intake.age < FEDERAL_SIJS_AGE_CAP) {
        return {
          verdict: 'requires_review',
          reasons: [
            `En ${intake.state_us.toUpperCase()} la corte juvenil pierde jurisdicción a los ${limit} años. ` +
              'Henry puede evaluar si aplica una estrategia alternativa (por ejemplo cambio de jurisdicción).',
          ],
          state_age_limit: limit,
          recommended_action: 'human_review',
        }
      }
      return {
        verdict: 'not_eligible',
        reasons: [`La edad declarada (${intake.age}) supera el límite aplicable (${limit}).`],
        state_age_limit: limit,
        recommended_action: 'no_sijs_path',
      }
    }
  } else if (intake.age == null) {
    unknowns.push('age')
  }

  // Abuse/neglect/abandonment finding is mandatory.
  if (intake.suffered_abuse === false) {
    return {
      verdict: 'not_eligible',
      reasons: [
        'SIJS requiere que exista abuso, negligencia o abandono por parte de uno o ambos padres.',
      ],
      state_age_limit: limit,
      recommended_action: 'no_sijs_path',
    }
  }
  if (intake.suffered_abuse === null) unknowns.push('suffered_abuse')

  if (unknowns.length > 0) {
    return {
      verdict: 'requires_review',
      reasons: [`Quedaron datos por aclarar: ${unknowns.join(', ')}.`],
      state_age_limit: limit,
      recommended_action: 'human_review',
    }
  }

  return {
    verdict: 'eligible',
    reasons: [
      `Vive en EE.UU.; edad ${intake.age} < ${limit} (${intake.state_us?.toUpperCase()}); ` +
        'abuso/negligencia/abandono confirmado.',
    ],
    state_age_limit: limit,
    recommended_action: 'offer_free_consultation',
  }
}
