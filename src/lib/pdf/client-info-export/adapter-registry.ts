// Registry de adapters. El orden importa: el primer adapter cuyo `matches`
// devuelve true gana. El fallback va al final como red de seguridad.
//
// Para agregar un nuevo form_type:
//   1. Crear el adapter en ./adapters/<nombre>.ts implementando FormAdapter.
//   2. Importarlo aquí y añadirlo al array `ADAPTERS` en la posición correcta
//      (antes de fallbackUnknownAdapter).
//   3. Listo. No hay otros lugares que tocar — ni endpoint ni generator.

import type { FormAdapter, RawFormRecord } from './types'
import { i360SijsAdapter } from './adapters/i360-sijs'
import { clientWitnessesAdapter } from './adapters/client-witnesses'
import { tutorGuardianAdapter } from './adapters/tutor-guardian'
import { clientNarrativeAdapter } from './adapters/client-narrative'
import { i589PartsAdapter } from './adapters/i589-parts'
import { acroformInstanceAdapter } from './adapters/acroform-instance'
import { fallbackUnknownAdapter } from './adapters/fallback-unknown'

export const ADAPTERS: FormAdapter[] = [
  i360SijsAdapter,
  clientWitnessesAdapter,
  tutorGuardianAdapter,
  clientNarrativeAdapter,
  i589PartsAdapter,
  acroformInstanceAdapter,
  fallbackUnknownAdapter,
]

/** Devuelve el primer adapter cuyo `matches` retorna true. Siempre hay match (fallback). */
export function resolveAdapter(rec: RawFormRecord): FormAdapter {
  for (const adapter of ADAPTERS) {
    if (adapter.matches(rec)) return adapter
  }
  return fallbackUnknownAdapter
}
