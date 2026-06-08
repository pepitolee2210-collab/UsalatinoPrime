/**
 * Catálogo de la VITRINA de servicios del admin (`/admin/servicios`).
 *
 * Es la fuente de verdad ÚNICA de qué tarjetas se muestran en la vitrina y en
 * la página de detalle, en el orden de presentación. Está DESACOPLADO a
 * propósito del `SERVICE_REGISTRY` (que solo modela servicios con fases): la
 * vitrina muestra también servicios de `intake_status` plano (Ajuste I-485,
 * ITIN, Taxes) y un "paso" intermedio del proceso SIJS (Petición I-360) que no
 * tienen — ni deben tener — entrada en el registry de fases.
 *
 * Cómo se construye el DETALLE (`/admin/servicios/[slug]`):
 * - Demo en vivo: solo si `getDemoScript(slug)` existe (5 servicios).
 * - Etapas ("Cómo funciona"), en este orden de preferencia:
 *     1. `detailStages` definidas aquí (caso Petición I-360).
 *     2. Fases del `SERVICE_REGISTRY` si el servicio usa fases.
 *     3. Etapas de `service-info.ts` vía `infoSlug` (Ajuste, ITIN, Taxes).
 */

export interface ShowcaseStage {
  /** "Paso 1", "Fase 2"… */
  number: string
  title: string
  description: string
  /** Material Symbol outlined */
  icon: string
}

export interface ShowcaseService {
  /** Slug de la tarjeta. Para los servicios reales coincide con el slug del
   *  sistema; `i-360` es solo de vitrina (no toca BD ni registry). */
  slug: string
  shortName: string
  /** Etiqueta mono superior-derecha, ej. "I-485 · 03" */
  codename: string
  description: string
  /** Material Symbol outlined del header de la tarjeta */
  icon: string
  /** Stats mostradas en la tarjeta */
  fases: number
  formularios: number
  documentos: number
  generadoresIA: number
  /**
   * Slug a usar contra `service-info.ts` para las etapas del detalle cuando el
   * servicio NO usa fases del registry. Si se omite, se usa el propio `slug`.
   */
  infoSlug?: string
  /** Etapas propias del detalle (override total). Usado por Petición I-360. */
  detailStages?: ShowcaseStage[]
}

/**
 * Los 9 servicios en el orden de la vitrina pública. Los 5 primeros con fases
 * comparten slug con el `SERVICE_REGISTRY`; los 4 restantes son standalone.
 */
export const SHOWCASE_SERVICES: ShowcaseService[] = [
  {
    slug: 'visa-juvenil',
    shortName: 'Visa Juvenil',
    codename: 'SIJS · 01',
    description: 'Custodia estatal, I-360 y I-485. Proceso completo hasta la Green Card.',
    icon: 'family_restroom',
    fases: 3,
    formularios: 5,
    documentos: 24,
    generadoresIA: 2,
  },
  {
    slug: 'i-360',
    shortName: 'Petición I-360',
    codename: 'I-360 · 02',
    description: 'Petición SIJS ante USCIS tras obtener la orden de custodia estatal. Segunda fase de la Visa Juvenil.',
    icon: 'description',
    fases: 4,
    formularios: 1,
    documentos: 10,
    generadoresIA: 1,
    detailStages: [
      {
        number: 'Paso 1',
        icon: 'fact_check',
        title: 'Verificación de la orden de custodia',
        description: 'Confirmamos que la Special Findings Order de la corte estatal contiene los hallazgos SIJS de abuso, negligencia o abandono que exige USCIS.',
      },
      {
        number: 'Paso 2',
        icon: 'description',
        title: 'Preparación del Formulario I-360',
        description: 'Completamos la petición de Inmigrante Juvenil Especial con la orden judicial y todos los documentos de soporte del menor.',
      },
      {
        number: 'Paso 3',
        icon: 'send',
        title: 'Presentación ante USCIS',
        description: 'Presentamos el I-360 ante USCIS. Filing fee de $250 para peticiones SIJS (tarifa H.R. 1).',
      },
      {
        number: 'Paso 4',
        icon: 'verified',
        title: 'Aprobación del I-360',
        description: 'USCIS revisa y aprueba la petición. El menor queda clasificado como Inmigrante Juvenil Especial, listo para el ajuste I-485.',
      },
    ],
  },
  {
    slug: 'ajuste-de-estatus',
    shortName: 'Ajuste de Estatus',
    codename: 'I-485 · 03',
    description: 'Solicitud I-485 para la residencia permanente sin salir de EE.UU. Cónyuges de ciudadanos, peticionados y derivados.',
    icon: 'card_membership',
    fases: 8,
    formularios: 6,
    documentos: 20,
    generadoresIA: 1,
  },
  {
    slug: 'asilo-politico',
    shortName: 'Asilo Político',
    codename: 'I-589 · 04',
    description: 'Solicitud afirmativa ante USCIS con declaración jurada generada por IA.',
    icon: 'shield',
    fases: 2,
    formularios: 4,
    documentos: 18,
    generadoresIA: 3,
  },
  {
    slug: 'reforzar-asilo',
    shortName: 'Reforzar Asilo',
    codename: 'I-589 R · 05',
    description: 'Evidencias, declaración reforzada y preparación de miedo creíble.',
    icon: 'verified_user',
    fases: 1,
    formularios: 2,
    documentos: 12,
    generadoresIA: 2,
  },
  {
    slug: 'apelacion',
    shortName: 'Apelación BIA',
    codename: 'EOIR-26 · 06',
    description: 'Notice of Appeal con extracción IA y carta de exoneración argumentada.',
    icon: 'gavel',
    fases: 1,
    formularios: 3,
    documentos: 8,
    generadoresIA: 2,
  },
  {
    slug: 'cambio-de-corte',
    shortName: 'Cambio de Corte',
    codename: 'EOIR-33 · 07',
    description: 'Moción de Change of Venue para mover el caso a otra jurisdicción.',
    icon: 'my_location',
    fases: 1,
    formularios: 1,
    documentos: 6,
    generadoresIA: 1,
  },
  {
    slug: 'itin-number',
    shortName: 'ITIN Number',
    codename: 'W-7 · 08',
    description: 'Solicitud W-7 ante el IRS. Tu número de identificación fiscal para declarar impuestos sin Social Security.',
    icon: 'badge',
    fases: 5,
    formularios: 1,
    documentos: 5,
    generadoresIA: 1,
  },
  {
    slug: 'taxes',
    shortName: 'Declaración de Impuestos',
    codename: '1040 · 09',
    description: 'Declaración federal 1040 y estatal Utah TC-40. Clave para tu caso migratorio y para acceder a beneficios.',
    icon: 'receipt_long',
    fases: 5,
    formularios: 2,
    documentos: 6,
    generadoresIA: 1,
  },
]

export const SHOWCASE_BY_SLUG: Record<string, ShowcaseService> = Object.fromEntries(
  SHOWCASE_SERVICES.map((s) => [s.slug, s]),
)

export function getShowcaseService(slug: string | null | undefined): ShowcaseService | null {
  if (!slug) return null
  return SHOWCASE_BY_SLUG[slug] ?? null
}

/** Telemetría agregada del hero de la vitrina (se recalcula sola). */
export function getShowcaseTotals() {
  return {
    servicios: SHOWCASE_SERVICES.length,
    fases: SHOWCASE_SERVICES.reduce((acc, s) => acc + s.fases, 0),
    modulosIA: SHOWCASE_SERVICES.reduce((acc, s) => acc + s.generadoresIA, 0),
  }
}
