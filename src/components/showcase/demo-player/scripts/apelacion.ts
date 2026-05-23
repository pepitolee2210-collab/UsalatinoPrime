import type { DemoScript } from '../types'

const CLIENT_NAME = 'Diego Ramírez Salinas'

export const apelacionScript: DemoScript = {
  serviceSlug: 'apelacion',
  serviceName: 'Apelación',
  totalDurationMs: 80_000,
  steps: [
    {
      id: 'intro',
      phase: 'apelacion',
      duration: 5_000,
      narration: 'Apelación ante la BIA — cuando un juez de inmigración niega un caso, tenemos 30 días para apelar. El sistema lo automatiza casi todo.',
      scene: { kind: 'intro', title: 'Apelación · BIA', subtitle: 'Notice of Appeal (EOIR-26) + carta de exoneración (EOIR-26A) con IA' },
    },
    {
      id: 'register',
      phase: 'apelacion',
      duration: 6_500,
      narration: 'Diego recibió una decisión adversa hace 12 días. Llega a tiempo — pero el reloj corre.',
      scene: { kind: 'client-register', clientName: CLIENT_NAME, phone: '+1 (713) 555-0247', service: 'Apelación' },
    },
    {
      id: 'docs-decision',
      phase: 'apelacion',
      duration: 7_000,
      narration: 'Sube la decisión del juez. Aquí entra nuestra IA: extrae automáticamente la fecha de decisión y la jurisdicción.',
      scene: {
        kind: 'document-upload',
        docs: [
          { label: 'Decisión del juez (EOIR)', type: 'PDF · oficial' },
          { label: 'Notice of Hearing previo', type: 'PDF · escaneado' },
        ],
      },
    },
    {
      id: 'ai-extract',
      phase: 'apelacion',
      duration: 9_000,
      narration: 'Gemini lee la decisión y extrae automáticamente la fecha, juez, jurisdicción y motivos. Eso nos da el plazo de 30 días al segundo.',
      scene: {
        kind: 'ai-generate',
        title: 'Extracción automática · Decisión EOIR-26',
        engine: 'gemini',
        output: 'Datos extraídos · plazo de apelación calculado',
        previewLines: [
          'EXTRACCIÓN AUTOMÁTICA DE DECISIÓN EOIR',
          '',
          'Fecha de decisión: 10/05/2026',
          'Juez: Hon. Robert J. McKinley',
          'Corte: EOIR Houston, Texas',
          'Tipo de caso: Removal proceedings',
          'Resultado: Denied — withholding of removal',
          '',
          'PLAZO DE APELACIÓN:',
          '  Fecha límite: 09/06/2026',
          '  Días restantes: 18',
          '  Estado: ✓ Dentro del plazo',
        ],
      },
    },
    {
      id: 'form-apelacion',
      phase: 'apelacion',
      duration: 9_500,
      narration: 'Diego responde unas preguntas clave: motivos de la apelación, si representa él mismo (pro se) o con abogado.',
      scene: {
        kind: 'form-fill',
        title: 'Datos para EOIR-26',
        section: 'Apelación · Notice of Appeal',
        fields: [
          { label: 'Representación', value: 'Pro se (sin abogado)' },
          { label: 'Motivo principal de apelación', value: 'Error de derecho · violación al debido proceso' },
          { label: 'Solicita oral argument', value: 'Sí' },
        ],
      },
    },
    {
      id: 'ai-eoir26a',
      phase: 'apelacion',
      duration: 12_500,
      narration: 'La IA genera la carta de exoneración EOIR-26A — el documento más complejo del proceso. 8 páginas de argumentos legales.',
      scene: {
        kind: 'ai-generate',
        title: 'Carta de Exoneración · EOIR-26A',
        engine: 'claude',
        output: 'Documento generado · 8 páginas con argumentos legales',
        previewLines: [
          'BEFORE THE BOARD OF IMMIGRATION APPEALS',
          'Falls Church, Virginia',
          '',
          'In re: Diego Ramírez Salinas, A-XXX-XXX-XXX',
          'Appeal from the decision of the Immigration Judge',
          '',
          'BRIEF IN SUPPORT OF APPEAL',
          '',
          'STATEMENT OF THE CASE',
          'Respondent Diego Ramírez Salinas appeals the Immigration',
          'Judge\'s May 10, 2026 decision denying his application',
          'for withholding of removal and protection under the',
          'Convention Against Torture.',
        ],
      },
    },
    {
      id: 'admin-review',
      phase: 'apelacion',
      duration: 6_000,
      narration: 'Henry revisa la carta antes de enviarla a la BIA. Aprobada y lista para presentar.',
      scene: {
        kind: 'admin-review',
        title: 'Apelación · revisión final',
        items: [
          { label: 'EOIR-26 Notice of Appeal', status: 'aprobado' },
          { label: 'Carta EOIR-26A (IA)', status: 'aprobado' },
          { label: 'Decisión del juez adjunta', status: 'aprobado' },
        ],
      },
    },
    {
      id: 'success',
      phase: 'apelacion',
      duration: 8_500,
      narration: 'Apelación presentada ante la BIA dentro del plazo. Diego puede respirar — su caso sigue vivo.',
      scene: {
        kind: 'success',
        title: 'Apelación presentada a tiempo',
        subtitle: 'Diego mantiene su caso abierto · espera respuesta de la BIA.',
        deliverables: [
          'EOIR-26 Notice of Appeal',
          'EOIR-26A Carta de Exoneración (8 pp)',
          'Confirmación de presentación oficial',
        ],
      },
    },
  ],
}
