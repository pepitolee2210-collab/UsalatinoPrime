import type { CasePhase } from '@/types/database'
import { getContractTemplate } from './index'

/**
 * Resuelve la fase SIJS inicial con la que debe nacer un case según el
 * servicio y subservicio del contrato firmado.
 *
 * Orden de resolución (override de adentro hacia afuera):
 *   1. Si el subservicio elegido declara `startingPhase` (incluso `null`
 *      explícito), gana — eso permite que un subservicio fuerce "sin fase"
 *      aunque el padre sí use fases.
 *   2. Si no, cae al `startingPhase` del template padre.
 *   3. Si tampoco, devuelve `null` (el case nace sin fase: el flujo
 *      legacy para servicios no-SIJS).
 *
 * **Por qué este helper existe**: antes el mapping (slug → fase) vivía
 * hardcoded en `register-client/route.ts` con un `switch` que solo conocía
 * `'visa-juvenil'`. Cada nuevo subservicio requería tocar dos archivos. Ahora
 * la declaración vive junto al template (`lib/contracts/index.ts`) y register
 * sólo consume este helper.
 *
 * Si en el futuro un servicio nuevo necesita arrancar en una fase distinta,
 * basta declarar `startingPhase` en su template — sin tocar este archivo.
 */
export function resolveStartingPhase(
  serviceSlug: string,
  subserviceSlug: string | null,
): CasePhase | null {
  const template = getContractTemplate(serviceSlug)
  if (!template) return null

  if (subserviceSlug && template.subservices) {
    const sub = template.subservices.find((s) => s.slug === subserviceSlug)
    if (sub && Object.prototype.hasOwnProperty.call(sub, 'startingPhase')) {
      return sub.startingPhase ?? null
    }
  }

  return template.startingPhase ?? null
}
