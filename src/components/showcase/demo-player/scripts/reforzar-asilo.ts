import type { DemoScript } from '../types'

const CLIENT_NAME = 'Yenifer Pacheco Morales'

export const reforzarAsiloScript: DemoScript = {
  serviceSlug: 'reforzar-asilo',
  serviceName: 'Reforzar Asilo',
  totalDurationMs: 75_000,
  steps: [
    {
      id: 'intro',
      phase: 'asilo_reforzar',
      duration: 5_000,
      narration: 'Reforzar Asilo es para clientes que ya enviaron su I-589 pero necesitan fortalecer su caso antes de la entrevista.',
      scene: { kind: 'intro', title: 'Reforzar Asilo', subtitle: 'Declaración jurada + evidencias + preparación miedo creíble' },
    },
    {
      id: 'register',
      phase: 'asilo_reforzar',
      duration: 7_000,
      narration: 'Yenifer ya tiene su I-589 enviado. Llega buscando reforzar su caso porque tiene entrevista en 6 semanas.',
      scene: { kind: 'client-register', clientName: CLIENT_NAME, phone: '+1 (786) 555-0419', service: 'Reforzar Asilo' },
    },
    {
      id: 'form-relato',
      phase: 'asilo_reforzar',
      duration: 11_000,
      narration: 'Cuenta su historia con guía paso a paso. Detalles que muchas veces el cliente olvida — el sistema le pregunta uno por uno.',
      scene: {
        kind: 'form-fill',
        title: 'Mi historia · Reforzar Asilo',
        section: 'Relato detallado',
        fields: [
          { label: 'Tipo de persecución', value: 'Violencia de género · pandillas en El Salvador' },
          { label: 'Fechas de incidentes', value: '2021 (3 episodios) · 2023 (amenaza directa)' },
          { label: 'Denuncias hechas', value: 'PNC ignoró denuncia · sin protección estatal' },
        ],
      },
    },
    {
      id: 'docs',
      phase: 'asilo_reforzar',
      duration: 7_500,
      narration: 'Sube todas las evidencias de soporte: denuncias policiales, reportes médicos, fotos, testimonios escritos.',
      scene: {
        kind: 'document-upload',
        docs: [
          { label: 'Denuncia PNC original', type: 'PDF · traducida' },
          { label: 'Reporte médico (lesiones)', type: 'PDF · escaneado' },
          { label: 'Testimonio de testigo', type: 'PDF · firmado' },
          { label: 'Fotografías de incidente', type: 'JPG · 4 imágenes' },
        ],
      },
    },
    {
      id: 'ai-declaracion',
      phase: 'asilo_reforzar',
      duration: 12_500,
      narration: 'La IA Claude genera la Declaración Jurada reforzada — versión profesional del relato, lista para presentar como evidencia.',
      scene: {
        kind: 'ai-generate',
        title: 'Declaración Jurada Reforzada',
        engine: 'claude',
        output: 'Declaración generada · 9 páginas',
        previewLines: [
          'DECLARACIÓN JURADA · REFORZAMIENTO I-589',
          'Yenifer Pacheco Morales · A-Number A-XXX-XXX-XXX',
          '',
          'I, Yenifer Pacheco Morales, hereby declare under',
          'penalty of perjury under the laws of the United States:',
          '',
          '1. I am a citizen of El Salvador, born 22 November 1995.',
          '',
          '2. I fled El Salvador to seek refuge from severe',
          '   gender-based violence perpetrated by the MS-13 gang,',
          '   which operates with impunity in my home region of',
          '   Sonsonate.',
        ],
      },
    },
    {
      id: 'ai-miedo-creible',
      phase: 'asilo_reforzar',
      duration: 10_000,
      narration: 'Y la guía de preparación para la entrevista. Yenifer practica con su consultor antes del día oficial.',
      scene: {
        kind: 'ai-generate',
        title: 'Preparación · Miedo Creíble',
        engine: 'gemini',
        output: 'Guion · 28 preguntas oficiales con respuestas modeladas',
        previewLines: [
          'PREPARACIÓN ENTREVISTA · ASYLUM OFFICER',
          '',
          'Q1: Are you afraid of returning to El Salvador?',
          'A: Yes. The gang MS-13 has threatened to kill me...',
          '',
          'Q2: Did you report this to the police?',
          'A: Yes, I filed a denuncia at PNC station #42...',
          '',
          'Q3: What did the police do?',
          'A: Nothing. The officer told me there was no proof...',
        ],
      },
    },
    {
      id: 'success',
      phase: 'asilo_completado',
      duration: 8_500,
      narration: 'Caso reforzado y listo. Yenifer entra a su entrevista con un expediente sólido y preparación práctica.',
      scene: {
        kind: 'success',
        title: 'Caso reforzado y entregado',
        subtitle: 'Expediente robusto para presentar el día de la entrevista de asilo.',
        deliverables: [
          'Declaración Jurada de 9 páginas',
          'Paquete de evidencias indexado',
          'Guion de preparación con 28 preguntas modeladas',
          'Acceso continuo del cliente al expediente',
        ],
      },
    },
  ],
}
