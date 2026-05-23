import type { DemoScript } from '../types'
import { visaJuvenilScript } from './visa-juvenil'
import { asiloPoliticoScript } from './asilo-politico'
import { reforzarAsiloScript } from './reforzar-asilo'
import { apelacionScript } from './apelacion'
import { cambioDeCorteScript } from './cambio-de-corte'

const SCRIPTS: Record<string, DemoScript> = {
  'visa-juvenil': visaJuvenilScript,
  'asilo-politico': asiloPoliticoScript,
  'reforzar-asilo': reforzarAsiloScript,
  'apelacion': apelacionScript,
  'cambio-de-corte': cambioDeCorteScript,
}

export function getDemoScript(slug: string): DemoScript | null {
  return SCRIPTS[slug] ?? null
}
