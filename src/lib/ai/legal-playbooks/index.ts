import { VISA_JUVENIL_PLAYBOOK } from './visa-juvenil'
import { ASILO_PLAYBOOK } from './asilo'
import { RENUNCIA_PLAYBOOK } from './renuncia'

/**
 * Fallback playbook for service slugs that don't have a dedicated one yet.
 * Still gives Claude enough context to do a generic legal review — but
 * specialized playbooks (visa juvenil, asilo, renuncia) produce noticeably
 * better findings for those case types.
 */
const GENERIC_PLAYBOOK = `
# PLAYBOOK: REVISIÓN LEGAL GENÉRICA DE DOCUMENTOS DE INMIGRACIÓN

Este es un playbook general. Revisa los documentos contra buenas prácticas legales estándar para procedimientos de inmigración en EE.UU.

## ELEMENTOS GENERALES QUE DEBEN ESTAR PRESENTES

1. Identificación completa del cliente: nombre, fecha de nacimiento, país de origen, documento de identidad.
2. Información del estatus migratorio actual.
3. Evidencia documental que sustente cada afirmación de hecho.
4. Consistencia entre documentos (fechas, nombres, direcciones).
5. Firmas del cliente y/o representantes legales donde corresponda.
6. Traducciones certificadas al inglés para documentos en idiomas extranjeros.
7. Cumplimiento del "under penalty of perjury" para declaraciones juradas.

## ERRORES COMUNES QUE DEBES MARCAR

- Presencia de [FALTA: ...] o placeholders sin resolver.
- Inconsistencias entre nombres, fechas o hechos entre documentos.
- Secciones vacías o con lenguaje genérico.
- Documentos en idioma extranjero sin traducción certificada.
- Narrativas sin fechas ni lugares concretos.
- Menciones de honorarios o procesos internos que no deberían aparecer en documentos legales.

## CRITERIO DE PUNTUACIÓN

- **90-100**: Documentos completos, consistentes, con evidencia concreta.
- **70-89**: Base sólida con pulir menor.
- **50-69**: Faltan elementos importantes.
- **0-49**: Problemas críticos que impiden presentar ante la autoridad.
`

/**
 * Maps a service_catalog slug to the legal playbook the reviewer should use.
 * Keep slugs consistent with the service_catalog.slug column in Supabase.
 */
export function getPlaybookForService(serviceSlug: string | null | undefined): string {
  const slug = (serviceSlug || '').toLowerCase().trim()

  if (slug.includes('juvenil') || slug.includes('sijs') || slug.includes('visa-juvenil')) {
    return VISA_JUVENIL_PLAYBOOK
  }
  if (slug.includes('asilo') || slug.includes('asylum')) {
    return ASILO_PLAYBOOK
  }
  if (slug.includes('renuncia') || slug.includes('relinquish')) {
    return RENUNCIA_PLAYBOOK
  }

  return GENERIC_PLAYBOOK
}

/**
 * Human-readable label for the playbook being applied — shown in the UI so
 * Henry knows which set of rules was used for a given review.
 */
export function getPlaybookName(serviceSlug: string | null | undefined): string {
  const slug = (serviceSlug || '').toLowerCase().trim()
  if (slug.includes('juvenil') || slug.includes('sijs')) return 'Visa Juvenil (SIJS)'
  if (slug.includes('asilo') || slug.includes('asylum')) return 'Asilo'
  if (slug.includes('renuncia') || slug.includes('relinquish')) return 'Renuncia de Patria Potestad'
  return 'Revisión general'
}
