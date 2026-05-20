import type { CasePhase } from '@/types/database'

export interface PriceVariant {
  label: string
  totalPrice: number
  installmentCount?: number
}

/**
 * Sub-servicio opcional dentro de un template. Permite vender alcances
 * parciales del servicio principal (ej. dentro de "Visa Juvenil" vender
 * solo I-360+I-485 para clientes que ya tienen la Orden de custodia).
 * Cuando el usuario elige un subservicio, sus etapas y objetoDelContrato
 * reemplazan los del template padre en el contrato generado.
 */
export interface ContractSubservice {
  slug: string
  label: string
  description?: string
  etapas: string[]
  objetoDelContrato: string
  variants: PriceVariant[]
  /**
   * Fase SIJS inicial cuando se firma este subservicio. `undefined` cae al
   * fallback del template padre. `null` explícito significa "este subservicio
   * no usa fases" y sobrescribe al padre. Hoy solo SIJS usa fases.
   */
  startingPhase?: CasePhase | null
}

export interface ContractTemplate {
  objetoDelContrato: string
  etapas: string[]
  requiresMinor: boolean
  installments: boolean
  variants: PriceVariant[]
  subservices?: ContractSubservice[]
  /**
   * Fase SIJS inicial cuando se firma el template sin elegir subservicio.
   * `undefined` o `null` → el case nace sin fase (servicios no-SIJS).
   * El resolver `resolveStartingPhase()` de `./starting-phase.ts` aplica
   * primero el subservicio elegido y solo cae aquí si no hay override.
   */
  startingPhase?: CasePhase | null
}

const contracts: Record<string, ContractTemplate> = {
  // Asilo Pol\u00edtico \u2014 reemplaza los legacy `asilo-afirmativo` y `asilo-defensivo`.
  // El servicio convive con 2 subservicios:
  //   - 'completo' \u2192 Fase 1 (Sustentos) + Fase 2 (Reforzar). `startingPhase = asilo_sustentos`.
  //   - 'solo-reforzar' \u2192 cliente ya tiene I-589 presentado, solo viene a reforzarlo.
  //     `startingPhase = asilo_reforzar`.
  // El template padre sin subservicio cae al flujo completo por compatibilidad.
  'asilo-politico': {
    installments: true,
    requiresMinor: false,
    startingPhase: 'asilo_sustentos',
    variants: [
      { label: 'Individual', totalPrice: 1500 },
      { label: 'Familiar', totalPrice: 2200 },
    ],
    objetoDelContrato:
      'El CONSULTOR se compromete a brindar asesor\u00eda y asistencia en el proceso de Asilo Pol\u00edtico ante el Servicio de Ciudadan\u00eda e Inmigraci\u00f3n de los Estados Unidos (USCIS), incluyendo la preparaci\u00f3n y presentaci\u00f3n del Formulario I-589 y la elaboraci\u00f3n del relato de Miedo Cre\u00edble.',
    etapas: [
      'Recopilaci\u00f3n de documentaci\u00f3n de identidad y estatus de ingreso',
      'Llenado guiado del Formulario I-589 (partes 1-5) con asistencia de IA',
      'Recopilaci\u00f3n de declaraci\u00f3n jurada y URLs de evidencias',
      'Generaci\u00f3n asistida por IA del relato de Miedo Cre\u00edble',
      'Llenado del Formulario I-589 (partes 6-14)',
      'Armado del expediente final ante USCIS',
      'Presentaci\u00f3n de la solicitud',
      'Preparaci\u00f3n y acompa\u00f1amiento a la entrevista',
    ],
    subservices: [
      {
        slug: 'completo',
        label: 'Proceso completo (Fase 1 + Fase 2)',
        description: 'Para clientes que inician el proceso desde cero. Cubre identidad, I-589 partes 1-5, declaraci\u00f3n jurada, Miedo Cre\u00edble y presentaci\u00f3n.',
        startingPhase: 'asilo_sustentos',
        variants: [
          { label: 'Individual', totalPrice: 1500 },
          { label: 'Familiar', totalPrice: 2200 },
        ],
        objetoDelContrato:
          'El CONSULTOR se compromete a brindar asesor\u00eda y asistencia en el proceso completo de Asilo Pol\u00edtico ante USCIS, desde la recopilaci\u00f3n de documentos de identidad hasta la presentaci\u00f3n del expediente final con el relato de Miedo Cre\u00edble.',
        etapas: [
          'Recopilaci\u00f3n de documentaci\u00f3n de identidad y estatus de ingreso',
          'Llenado guiado del Formulario I-589 (partes 1-5) con asistencia de IA',
          'Recopilaci\u00f3n de declaraci\u00f3n jurada y URLs de evidencias',
          'Generaci\u00f3n asistida por IA del relato de Miedo Cre\u00edble',
          'Llenado del Formulario I-589 (partes 6-14)',
          'Armado del expediente final ante USCIS',
          'Presentaci\u00f3n de la solicitud',
          'Preparaci\u00f3n y acompa\u00f1amiento a la entrevista',
        ],
      },
      {
        slug: 'solo-reforzar',
        label: 'Solo Reforzar Asilo (cliente ya present\u00f3 I-589)',
        description: 'Para clientes que ya presentaron su asilo y vienen a reforzar el caso con declaraci\u00f3n jurada, evidencias y Miedo Cre\u00edble generado por IA.',
        startingPhase: 'asilo_reforzar',
        variants: [
          { label: 'Individual', totalPrice: 900 },
          { label: 'Familiar', totalPrice: 1300 },
        ],
        objetoDelContrato:
          'El CONSULTOR se compromete a brindar asesor\u00eda y asistencia en el refuerzo del caso de Asilo Pol\u00edtico de un cliente con I-589 ya presentado, mediante la recopilaci\u00f3n de declaraci\u00f3n jurada, evidencias, y la generaci\u00f3n asistida por IA del relato de Miedo Cre\u00edble.',
        etapas: [
          'Recopilaci\u00f3n de declaraci\u00f3n jurada y URLs de evidencias',
          'Generaci\u00f3n asistida por IA del relato de Miedo Cre\u00edble',
          'Llenado del Formulario I-589 (partes 6-14)',
          'Acompa\u00f1amiento a la entrevista',
        ],
      },
    ],
  },
  'ajuste-de-estatus': {
    installments: true,
    requiresMinor: false,
    // Pol\u00edtica operativa: hoy "ajuste-de-estatus" se vende solo a clientes
    // SIJS que ya tienen I-360 aprobado (continuaci\u00f3n fase 3). El case nace
    // directamente en fase i485 para que el portal del cliente muestre los
    // documentos y formularios correspondientes desde el primer login.
    startingPhase: 'i485',
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
  'visa-juvenil': {
    installments: true,
    requiresMinor: true,
    // Proceso SIJS completo arranca en la fase de Custodia (corte estatal).
    // Subservicios individuales sobrescriben esto cuando aplica.
    startingPhase: 'custodia',
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
    subservices: [
      {
        slug: 'completa',
        label: 'Proceso completo (Custodia + I-360 + I-485)',
        description: 'Las 3 etapas: Corte estatal, petici\u00f3n federal y residencia.',
        startingPhase: 'custodia',
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
      {
        slug: 'i360-i485',
        label: 'I-360 + I-485 (ya tiene custodia emitida)',
        description: 'Para clientes que ya cuentan con la Orden de Hallazgos Especiales de la corte estatal.',
        startingPhase: 'i360',
        variants: [
          { label: 'Individual', totalPrice: 1500 },
          { label: 'Familiar', totalPrice: 2100, installmentCount: 10 },
        ],
        objetoDelContrato:
          'El CONSULTOR se compromete a brindar asesor\u00eda y asistencia en la preparaci\u00f3n y presentaci\u00f3n de la petici\u00f3n I-360 (SIJS) y del Ajuste de Estatus (I-485) ante USCIS, partiendo de la Orden de Hallazgos Especiales ya emitida por la Corte Estatal. El presente contrato no incluye la representaci\u00f3n ante la Corte Estatal para la obtenci\u00f3n de dicha orden.',
        etapas: [
          'Revisi\u00f3n de la Orden de Hallazgos Especiales (Special Findings Order) emitida por la Corte Estatal',
          'Preparaci\u00f3n del Formulario I-360 (Petition for Amerasian, Widow(er), or Special Immigrant)',
          'Presentaci\u00f3n de la petici\u00f3n I-360 ante USCIS',
          'Preparaci\u00f3n y presentaci\u00f3n del Ajuste de Estatus (I-485) cuando la visa est\u00e9 disponible',
          'Respuesta a solicitudes de evidencia adicional (RFE) si aplica',
          'Seguimiento del caso hasta la obtenci\u00f3n de la residencia permanente',
        ],
      },
      {
        slug: 'i360',
        label: 'Solo I-360 (petici\u00f3n federal)',
        description: 'Presentaci\u00f3n \u00fanica del I-360, sin incluir corte estatal ni ajuste de estatus.',
        startingPhase: 'i360',
        variants: [
          { label: 'Individual', totalPrice: 1200 },
        ],
        objetoDelContrato:
          'El CONSULTOR se compromete a brindar asesor\u00eda y asistencia en la preparaci\u00f3n y presentaci\u00f3n del Formulario I-360 (Petition for Amerasian, Widow(er), or Special Immigrant) ante USCIS, partiendo de la Orden de Hallazgos Especiales ya emitida. El presente contrato no incluye la representaci\u00f3n ante la Corte Estatal ni la presentaci\u00f3n del Ajuste de Estatus (I-485).',
        etapas: [
          'Revisi\u00f3n de la Orden de Hallazgos Especiales (Special Findings Order) emitida por la Corte Estatal',
          'Preparaci\u00f3n del Formulario I-360 y documentos de soporte',
          'Presentaci\u00f3n de la petici\u00f3n I-360 ante USCIS',
          'Respuesta a solicitudes de evidencia adicional (RFE) si aplica',
          'Seguimiento hasta la aprobaci\u00f3n de la petici\u00f3n I-360',
        ],
      },
      {
        slug: 'i485',
        label: 'Solo I-485 (ajuste con I-360 ya aprobado)',
        description: 'Ajuste de estatus para clientes con I-360 aprobado y visa disponible.',
        startingPhase: 'i485',
        variants: [
          { label: 'Individual', totalPrice: 1500 },
        ],
        objetoDelContrato:
          'El CONSULTOR se compromete a brindar asesor\u00eda y asistencia en la preparaci\u00f3n y presentaci\u00f3n del Formulario I-485 (Application to Register Permanent Residence or Adjust Status) ante USCIS, partiendo de la aprobaci\u00f3n previa del Formulario I-360. El presente contrato no incluye la representaci\u00f3n ante la Corte Estatal ni la presentaci\u00f3n del I-360.',
        etapas: [
          'Revisi\u00f3n de la aprobaci\u00f3n del Formulario I-360 y disponibilidad de visa',
          'Recopilaci\u00f3n de documentaci\u00f3n para el Ajuste de Estatus',
          'Preparaci\u00f3n del Formulario I-485 y formularios complementarios',
          'Presentaci\u00f3n de la solicitud ante USCIS',
          'Preparaci\u00f3n del cliente para la cita biom\u00e9trica',
          'Respuesta a solicitudes de evidencia adicional (RFE) si aplica',
          'Seguimiento hasta la obtenci\u00f3n de la residencia permanente',
        ],
      },
      // \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
      // PROMOCIONES (campa\u00f1as de Vanessa). Funcionan exactamente igual que
      // un subservice normal \u2014 aparecen en el selector, se firman igual,
      // crean profile/case igual. Lo \u00fanico que cambia es el array `etapas`
      // y el `objetoDelContrato` para reflejar el alcance acotado de la
      // promo. Para crear una nueva promo, copia este patr\u00f3n con un slug
      // \u00fanico tipo 'promo-<nombre>' y, si el alcance arranca en una fase
      // distinta a 'custodia', agrega el slug en resolveStartingPhase()
      // de src/app/api/contracts/register-client/route.ts.
      // \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
      {
        slug: 'promo-dia-madre',
        label: 'Promo D\u00eda de la Madre (Custodia + I-360)',
        description:
          'Oferta lanzada por Vanessa: las 2 primeras etapas del proceso (Corte Estatal + I-360). NO incluye Ajuste de Estatus (I-485).',
        startingPhase: 'custodia',
        variants: [
          { label: 'Individual', totalPrice: 1800 },
          { label: 'Familiar', totalPrice: 2500, installmentCount: 10 },
        ],
        objetoDelContrato:
          'El CONSULTOR se compromete a brindar asesor\u00eda y asistencia en las dos primeras etapas del proceso de Estatus Especial de Inmigrante Juvenil (SIJS) para el menor beneficiario: (1) la coordinaci\u00f3n con la Corte Estatal para la obtenci\u00f3n de la Orden de Hallazgos Especiales y (2) la preparaci\u00f3n y presentaci\u00f3n del Formulario I-360 ante USCIS. El presente contrato NO incluye la preparaci\u00f3n ni presentaci\u00f3n del Ajuste de Estatus (Formulario I-485); si el CLIENTE desea ese paso posteriormente, deber\u00e1 contratarlo por separado.',
        etapas: [
          'Evaluaci\u00f3n inicial del caso y determinaci\u00f3n de elegibilidad del menor',
          'Preparaci\u00f3n de la petici\u00f3n ante la Corte Estatal para hallazgos de SIJS',
          'Coordinaci\u00f3n y representaci\u00f3n en procedimientos de la Corte Estatal',
          'Obtenci\u00f3n de la Orden de Hallazgos Especiales (Special Findings Order)',
          'Preparaci\u00f3n del Formulario I-360 (Petition for Amerasian, Widow(er), or Special Immigrant)',
          'Presentaci\u00f3n de la petici\u00f3n I-360 ante USCIS',
          'Seguimiento hasta la aprobaci\u00f3n del I-360 (este contrato termina aqu\u00ed)',
        ],
      },
    ],
  },
  // Apelación — proceso de apelación ante la BIA (Junta de Apelaciones de
  // Inmigración) contra una decisión adversa de un Juez de Inmigración.
  // Servicio de UNA sola fase (`apelacion`), pago en cuotas opcional, sin
  // minor asociado (el apelante es el adulto cuya solicitud fue denegada).
  'apelacion': {
    installments: true,
    requiresMinor: false,
    startingPhase: 'apelacion',
    variants: [
      { label: 'Apelación', totalPrice: 500, installmentCount: 5 },
    ],
    objetoDelContrato:
      'El CONSULTOR se compromete a brindar asesoría y asistencia en la preparación y presentación de la Apelación ante la Junta de Apelaciones de Inmigración (BIA) mediante el Formulario EOIR-26 (Notice of Appeal) y, cuando aplique, el Formulario EOIR-26A (Fee Waiver Request), contra la decisión adversa emitida por el Juez de Inmigración.',
    etapas: [
      'Recopilación de documentación: pasaporte, solicitud de asilo completa y auto de denegación del juez',
      'Llenado guiado del Formulario EOIR-26 (Notice of Appeal)',
      'Llenado opcional del Formulario EOIR-26A (Fee Waiver Request) si el apelante solicita exención de tarifa',
      'Revisión legal y firma del paquete de apelación',
      'Presentación de la apelación ante la BIA dentro del plazo de 30 días desde la decisión',
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
    startingPhase: 'cambio_de_corte',
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
  'adelantos': {
    installments: false,
    requiresMinor: false,
    variants: [
      { label: 'Adelantos (Advance Parole)', totalPrice: 500 },
    ],
    objetoDelContrato:
      'El CONSULTOR se compromete a brindar asesor\u00eda y asistencia en la preparaci\u00f3n y presentaci\u00f3n de la solicitud de Advance Parole (Permiso de Viaje Anticipado) mediante el Formulario I-131 ante el Servicio de Ciudadan\u00eda e Inmigraci\u00f3n de los Estados Unidos (USCIS), permitiendo al CLIENTE viajar fuera de los Estados Unidos y regresar mientras su caso est\u00e1 pendiente.',
    etapas: [
      'Evaluaci\u00f3n de elegibilidad y revisi\u00f3n del caso pendiente ante USCIS',
      'Recopilaci\u00f3n de documentaci\u00f3n requerida (pasaporte, I-94, evidencia del caso pendiente)',
      'Preparaci\u00f3n del Formulario I-131 (Application for Travel Document)',
      'Preparaci\u00f3n de carta de justificaci\u00f3n del viaje y documentos de soporte',
      'Presentaci\u00f3n de la solicitud ante USCIS',
      'Seguimiento del caso hasta la emisi\u00f3n del documento de Advance Parole',
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

/** Sub-servicio por slug dentro de un template */
export function getSubservice(
  templateSlug: string,
  subserviceSlug: string
): ContractSubservice | null {
  const tpl = contracts[templateSlug]
  if (!tpl?.subservices) return null
  return tpl.subservices.find(s => s.slug === subserviceSlug) || null
}
