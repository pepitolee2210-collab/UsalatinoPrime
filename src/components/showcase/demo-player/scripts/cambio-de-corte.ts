import type { DemoScript } from '../types'

const CLIENT_NAME = 'Andrea Solano Pérez'

export const cambioDeCorteScript: DemoScript = {
  serviceSlug: 'cambio-de-corte',
  serviceName: 'Cambio de Corte',
  totalDurationMs: 70_000,
  steps: [
    {
      id: 'intro',
      phase: 'cambio_de_corte',
      duration: 5_000,
      narration: 'Cambio de Corte — moción para mover el caso a otra jurisdicción cuando el cliente se mudó de estado.',
      scene: { kind: 'intro', title: 'Cambio de Corte (Venue)', subtitle: 'Moción EOIR-33 + carta de 6 páginas bidireccional' },
    },
    {
      id: 'register',
      phase: 'cambio_de_corte',
      duration: 6_500,
      narration: 'Andrea estaba en corte de Houston pero se mudó a Miami. Necesita mover su caso para no tener que viajar mensualmente.',
      scene: { kind: 'client-register', clientName: CLIENT_NAME, phone: '+1 (786) 555-0312', service: 'Cambio de Corte' },
    },
    {
      id: 'form-mudanza',
      phase: 'cambio_de_corte',
      duration: 10_500,
      narration: 'Llena los datos de la mudanza — corte actual, corte deseada y motivos de la solicitud.',
      scene: {
        kind: 'form-fill',
        title: 'Datos de la moción',
        section: 'Cambio de Corte · EOIR-33',
        fields: [
          { label: 'Corte actual', value: 'EOIR Houston · Texas' },
          { label: 'Corte solicitada', value: 'EOIR Miami · Florida' },
          { label: 'Fecha de mudanza', value: '12/02/2026' },
          { label: 'Motivo', value: 'Reunificación familiar · empleo en FL' },
        ],
      },
    },
    {
      id: 'docs',
      phase: 'cambio_de_corte',
      duration: 7_000,
      narration: 'Documentos que sustentan la mudanza: nuevo arrendamiento, oferta laboral, ID actualizado.',
      scene: {
        kind: 'document-upload',
        docs: [
          { label: 'Contrato de arrendamiento (FL)', type: 'PDF · firmado' },
          { label: 'Carta de oferta laboral', type: 'PDF · membretada' },
          { label: 'ID actualizado dirección', type: 'PDF · ambos lados' },
          { label: 'Factura de servicios (FL)', type: 'PDF · últimos 30 días' },
        ],
      },
    },
    {
      id: 'ai-carta',
      phase: 'cambio_de_corte',
      duration: 13_500,
      narration: 'La IA Claude genera la carta de moción completa — 6 páginas con argumentos legales, citas a EOIR rules y exhibits indexados.',
      scene: {
        kind: 'ai-generate',
        title: 'Moción de Cambio de Venue',
        engine: 'claude',
        output: 'Carta generada · 6 páginas con exhibits',
        previewLines: [
          'UNITED STATES IMMIGRATION COURT',
          'Houston, Texas',
          '',
          'In the Matter of: Andrea Solano Pérez',
          'A-Number: A-XXX-XXX-XXX',
          '',
          'MOTION FOR CHANGE OF VENUE',
          '',
          'Respondent, by and through self-representation,',
          'respectfully moves this Honorable Court for a change',
          'of venue from the Houston Immigration Court to the',
          'Miami Immigration Court, pursuant to 8 C.F.R. § 1003.20.',
          '',
          'In support thereof, Respondent states:',
          '   1. Respondent permanently relocated to Miami, FL...',
        ],
      },
    },
    {
      id: 'admin-review',
      phase: 'cambio_de_corte',
      duration: 6_000,
      narration: 'Henry revisa la moción y todos los exhibits. Lista para presentar ante la corte de Houston.',
      scene: {
        kind: 'admin-review',
        title: 'Moción · revisión final',
        items: [
          { label: 'Formulario EOIR-33', status: 'aprobado' },
          { label: 'Carta de moción (6 pp)', status: 'aprobado' },
          { label: 'Exhibits de mudanza (4)', status: 'aprobado' },
        ],
      },
    },
    {
      id: 'success',
      phase: 'cambio_de_corte',
      duration: 7_500,
      narration: 'Moción presentada. Andrea espera resolución — si se aprueba, su próxima audiencia será en Miami sin necesidad de viajar.',
      scene: {
        kind: 'success',
        title: 'Moción presentada en Houston',
        subtitle: 'Andrea evita los viajes mensuales · espera la resolución de cambio de venue.',
        deliverables: [
          'EOIR-33 firmada',
          'Carta de moción de 6 páginas (IA)',
          'Paquete de exhibits indexado',
        ],
      },
    },
  ],
}
