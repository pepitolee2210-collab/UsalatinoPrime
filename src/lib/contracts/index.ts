export interface PriceVariant {
  label: string
  totalPrice: number
  installmentCount?: number
}

export interface ContractTemplate {
  objetoDelContrato: string
  etapas: string[]
  requiresMinor: boolean
  installments: boolean
  variants: PriceVariant[]
}

const contracts: Record<string, ContractTemplate> = {
  'asilo-defensivo': {
    installments: true,
    requiresMinor: false,
    variants: [
      { label: 'Individual', totalPrice: 1500 },
      { label: 'Familiar', totalPrice: 2200 },
    ],
    objetoDelContrato:
      'El CONSULTOR se compromete a brindar asesor\u00eda y representaci\u00f3n legal en el proceso de Asilo Defensivo ante la Corte de Inmigraci\u00f3n de los Estados Unidos, incluyendo la preparaci\u00f3n y presentaci\u00f3n de la solicitud de asilo como defensa ante procedimientos de deportaci\u00f3n.',
    etapas: [
      'Evaluaci\u00f3n inicial del caso y revisi\u00f3n de documentaci\u00f3n existente',
      'Preparaci\u00f3n y redacci\u00f3n de la declaraci\u00f3n jurada del solicitante',
      'Recopilaci\u00f3n y organizaci\u00f3n de evidencia de persecuci\u00f3n o temor fundado',
      'Preparaci\u00f3n del Formulario I-589 y documentos de soporte',
      'Presentaci\u00f3n de la solicitud ante la Corte de Inmigraci\u00f3n',
      'Preparaci\u00f3n del cliente para la audiencia individual ante el Juez de Inmigraci\u00f3n',
      'Representaci\u00f3n en audiencias ante la Corte de Inmigraci\u00f3n',
      'Seguimiento post-audiencia y tr\u00e1mites adicionales si corresponde',
    ],
  },
  'ajuste-de-estatus': {
    installments: true,
    requiresMinor: false,
    variants: [
      { label: 'Ajuste de Estatus', totalPrice: 2500 },
    ],
    objetoDelContrato:
      'El CONSULTOR se compromete a brindar asesor\u00eda y asistencia en el proceso de Ajuste de Estatus migratorio ante el Servicio de Ciudadan\u00eda e Inmigraci\u00f3n de los Estados Unidos (USCIS), para la obtenci\u00f3n de la residencia permanente legal.',
    etapas: [
      'Evaluaci\u00f3n de elegibilidad y revisi\u00f3n de historial migratorio',
      'Recopilaci\u00f3n de documentaci\u00f3n personal y evidencia de elegibilidad',
      'Preparaci\u00f3n del Formulario I-485 y formularios complementarios',
      'Preparaci\u00f3n del paquete de evidencia financiera (I-864 Affidavit of Support)',
      'Revisi\u00f3n y organizaci\u00f3n del paquete completo de solicitud',
      'Presentaci\u00f3n de la solicitud ante USCIS',
      'Preparaci\u00f3n del cliente para la cita biom\u00e9trica y entrevista',
      'Seguimiento del caso y respuesta a solicitudes de evidencia adicional (RFE)',
    ],
  },
  'asilo-afirmativo': {
    installments: true,
    requiresMinor: false,
    variants: [
      { label: 'Individual', totalPrice: 1500 },
      { label: 'Familiar', totalPrice: 2200 },
    ],
    objetoDelContrato:
      'El CONSULTOR se compromete a brindar asesor\u00eda y asistencia en el proceso de Asilo Afirmativo ante el Servicio de Ciudadan\u00eda e Inmigraci\u00f3n de los Estados Unidos (USCIS), incluyendo la preparaci\u00f3n y presentaci\u00f3n de la solicitud de asilo.',
    etapas: [
      'Evaluaci\u00f3n inicial del caso y determinaci\u00f3n de elegibilidad',
      'Preparaci\u00f3n y redacci\u00f3n de la declaraci\u00f3n jurada del solicitante',
      'Recopilaci\u00f3n y organizaci\u00f3n de evidencia de pa\u00eds y persecuci\u00f3n',
      'Preparaci\u00f3n del Formulario I-589 y documentos de soporte',
      'Revisi\u00f3n final y presentaci\u00f3n de la solicitud ante USCIS',
      'Preparaci\u00f3n del cliente para la entrevista con el Oficial de Asilo',
      'Acompa\u00f1amiento y representaci\u00f3n en la entrevista de asilo',
      'Seguimiento post-entrevista y tr\u00e1mites adicionales si corresponde',
    ],
  },
  'visa-juvenil': {
    installments: true,
    requiresMinor: true,
    variants: [
      { label: 'Individual', totalPrice: 2500 },
      { label: 'Familiar', totalPrice: 3500, installmentCount: 14 },
    ],
    objetoDelContrato:
      'El CONSULTOR se compromete a brindar asesor\u00eda y asistencia en el proceso de obtenci\u00f3n del Estatus Especial de Inmigrante Juvenil (SIJS) para el menor beneficiario, incluyendo la coordinaci\u00f3n con la corte estatal y la presentaci\u00f3n ante USCIS.',
    etapas: [
      'Evaluaci\u00f3n inicial del caso y determinaci\u00f3n de elegibilidad del menor',
      'Preparaci\u00f3n de la petici\u00f3n ante la Corte Estatal para hallazgos de SIJS',
      'Coordinaci\u00f3n y representaci\u00f3n en procedimientos de la Corte Estatal',
      'Obtenci\u00f3n de la Orden de Hallazgos Especiales (Special Findings Order)',
      'Preparaci\u00f3n del Formulario I-360 (Petition for Amerasian, Widow(er), or Special Immigrant)',
      'Presentaci\u00f3n de la petici\u00f3n I-360 ante USCIS',
      'Preparaci\u00f3n y presentaci\u00f3n del Ajuste de Estatus (I-485) cuando la visa est\u00e9 disponible',
      'Seguimiento del caso hasta la obtenci\u00f3n de la residencia permanente',
    ],
  },
  'mociones': {
    installments: false,
    requiresMinor: false,
    variants: [
      { label: 'Mociones', totalPrice: 400 },
    ],
    objetoDelContrato:
      'El CONSULTOR se compromete a brindar asesor\u00eda y asistencia en la preparaci\u00f3n y presentaci\u00f3n de una Moci\u00f3n ante la Corte de Inmigraci\u00f3n o la Junta de Apelaciones de Inmigraci\u00f3n (BIA), seg\u00fan corresponda al caso del CLIENTE.',
    etapas: [
      'Evaluaci\u00f3n del caso y determinaci\u00f3n del tipo de moci\u00f3n apropiada',
      'Investigaci\u00f3n legal y recopilaci\u00f3n de precedentes aplicables',
      'Redacci\u00f3n de la moci\u00f3n con argumentos legales y evidencia de soporte',
      'Revisi\u00f3n final y presentaci\u00f3n de la moci\u00f3n ante la autoridad correspondiente',
      'Seguimiento del caso y respuesta a cualquier solicitud adicional',
    ],
  },
  'cambio-de-corte': {
    installments: false,
    requiresMinor: false,
    variants: [
      { label: 'Cambio de Corte', totalPrice: 250 },
    ],
    objetoDelContrato:
      'El CONSULTOR se compromete a brindar asesor\u00eda y asistencia en el proceso de solicitud de Cambio de Venue (cambio de jurisdicci\u00f3n de la Corte de Inmigraci\u00f3n), para que el caso del CLIENTE sea transferido a una corte m\u00e1s conveniente.',
    etapas: [
      'Evaluaci\u00f3n de elegibilidad para el cambio de corte',
      'Recopilaci\u00f3n de documentaci\u00f3n que justifique el cambio de jurisdicci\u00f3n',
      'Preparaci\u00f3n de la moci\u00f3n de cambio de venue',
      'Presentaci\u00f3n de la moci\u00f3n ante la Corte de Inmigraci\u00f3n actual',
      'Seguimiento hasta la resoluci\u00f3n de la solicitud de transferencia',
    ],
  },
  'itin-number': {
    installments: false,
    requiresMinor: false,
    variants: [
      { label: 'ITIN Number', totalPrice: 250 },
    ],
    objetoDelContrato:
      'El CONSULTOR se compromete a brindar asesor\u00eda y asistencia en la obtenci\u00f3n del N\u00famero de Identificaci\u00f3n Personal del Contribuyente (ITIN) ante el Servicio de Impuestos Internos (IRS).',
    etapas: [
      'Evaluaci\u00f3n de elegibilidad y revisi\u00f3n de documentaci\u00f3n de identidad',
      'Preparaci\u00f3n del Formulario W-7 (Application for IRS Individual Taxpayer Identification Number)',
      'Certificaci\u00f3n o notarizaci\u00f3n de documentos de identidad requeridos',
      'Presentaci\u00f3n de la solicitud ante el IRS',
      'Seguimiento hasta la emisi\u00f3n del n\u00famero ITIN',
    ],
  },
  'licencia-de-conducir': {
    installments: false,
    requiresMinor: false,
    variants: [
      { label: 'Licencia de Conducir', totalPrice: 100 },
    ],
    objetoDelContrato:
      'El CONSULTOR se compromete a brindar asesor\u00eda y asistencia en el proceso de obtenci\u00f3n de la licencia de conducir en el estado correspondiente, incluyendo la preparaci\u00f3n de documentaci\u00f3n requerida.',
    etapas: [
      'Evaluaci\u00f3n de elegibilidad y requisitos del estado',
      'Recopilaci\u00f3n y preparaci\u00f3n de documentos de identidad y residencia',
      'Asistencia con la solicitud y programaci\u00f3n de citas',
      'Preparaci\u00f3n del cliente para los ex\u00e1menes requeridos',
      'Seguimiento hasta la obtenci\u00f3n de la licencia',
    ],
  },
  'taxes': {
    installments: false,
    requiresMinor: false,
    variants: [
      { label: 'Declaraci\u00f3n de Impuestos', totalPrice: 150 },
    ],
    objetoDelContrato:
      'El CONSULTOR se compromete a brindar asesor\u00eda y asistencia en la preparaci\u00f3n y presentaci\u00f3n de la declaraci\u00f3n de impuestos federales y/o estatales del CLIENTE ante el Servicio de Impuestos Internos (IRS).',
    etapas: [
      'Recopilaci\u00f3n de documentaci\u00f3n financiera y formularios W-2, 1099, etc.',
      'Evaluaci\u00f3n de deducciones y cr\u00e9ditos fiscales aplicables',
      'Preparaci\u00f3n de la declaraci\u00f3n de impuestos federal y/o estatal',
      'Revisi\u00f3n final con el cliente y firma electr\u00f3nica',
      'Presentaci\u00f3n electr\u00f3nica (e-file) ante el IRS y autoridad estatal',
    ],
  },
  'cambio-de-estatus': {
    installments: true,
    requiresMinor: false,
    variants: [
      { label: 'Individual', totalPrice: 1500 },
      { label: 'Familiar', totalPrice: 2200 },
    ],
    objetoDelContrato:
      'El CONSULTOR se compromete a brindar asesor\u00eda y asistencia en el proceso de Cambio de Estatus Migratorio (de Visa de Turismo B-1/B-2 a Visa de Estudiante F-1) ante el Servicio de Ciudadan\u00eda e Inmigraci\u00f3n de los Estados Unidos (USCIS), incluyendo la preparaci\u00f3n y presentaci\u00f3n del Formulario I-539 y la coordinaci\u00f3n con la instituci\u00f3n educativa para la obtenci\u00f3n del Formulario I-20.',
    etapas: [
      'Evaluaci\u00f3n de elegibilidad y revisi\u00f3n del estatus migratorio actual',
      'Asistencia en la solicitud de admisi\u00f3n a escuela certificada por SEVP y obtenci\u00f3n del Formulario I-20',
      'Orientaci\u00f3n para el pago de la tarifa SEVIS I-901',
      'Preparaci\u00f3n del Formulario I-539 y documentos de soporte (evidencia financiera, I-20, carta de admisi\u00f3n)',
      'Presentaci\u00f3n de la solicitud ante USCIS',
      'Seguimiento del caso, preparaci\u00f3n para biom\u00e9tricos y respuesta a solicitudes de evidencia adicional (RFE)',
      'Asistencia post-aprobaci\u00f3n para activaci\u00f3n del estatus F-1 y registro con el DSO de la escuela',
    ],
  },
}

export function getContractTemplate(slug: string): ContractTemplate | null {
  return contracts[slug] || null
}

/** N\u00famero de cuotas para una variante (default 10) */
export function getInstallmentCount(variant: PriceVariant): number {
  return variant.installmentCount ?? 10
}

/** Info b\u00e1sica de un servicio para add-ons */
export interface AddonServiceInfo {
  slug: string
  label: string
  defaultPrice: number
}

/** Lista de servicios disponibles como add-on con su precio base */
export function getAddonServices(): AddonServiceInfo[] {
  return Object.entries(contracts).map(([slug, template]) => ({
    slug,
    label: slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    defaultPrice: template.variants[0].totalPrice,
  }))
}

/** Obtener etapas de un servicio por slug */
export function getServiceEtapas(slug: string): string[] {
  return contracts[slug]?.etapas || []
}
