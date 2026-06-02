export type InstructionRule = {
  kind: 'do' | 'dont'
  text: string
  /** Reglas críticas que se resaltan visualmente en el banner. */
  emphasis?: boolean
}

export type UploadInstructions = {
  eyebrow: string
  title: string
  subtitle: string
  /** Mensaje de máxima urgencia, destacado en un bloque de alerta propio. */
  criticalWarning: string
  rules: InstructionRule[]
  examplesTitle: string
  examples: string[]
  footnote: string
}

export const DOCUMENT_UPLOAD_INSTRUCTIONS: UploadInstructions = {
  eyebrow: 'IMPORTANTE · LÉELO ANTES DE SUBIR',
  title: 'Antes de subir tus documentos',
  subtitle:
    'Para evitar el rechazo de tus archivos y retrasos en tu trámite, sigue estas indicaciones obligatorias:',
  criticalWarning:
    'Tus documentos deben estar ESCANEADOS y en formato PDF. NO tomes fotos con el celular ni subas capturas de pantalla: esos archivos serán rechazados.',
  rules: [
    {
      kind: 'do',
      text: 'Escanea cada documento con una app de escáner (Adobe Scan, CamScanner, o la app Notas en iPhone) o con un escáner físico.',
      emphasis: true,
    },
    {
      kind: 'dont',
      text: 'No tomes fotos del documento con la cámara del celular ni subas capturas de pantalla.',
      emphasis: true,
    },
    {
      kind: 'do',
      text: 'Sube los documentos únicamente en formato PDF. No se aceptan imágenes (JPG, PNG) ni ningún otro formato.',
      emphasis: true,
    },
    { kind: 'do', text: 'El nombre del archivo debe indicar claramente qué documento es y de quién.' },
    { kind: 'do', text: 'Si el documento tiene varias páginas, súbelas juntas en un solo archivo PDF.' },
    { kind: 'dont', text: 'No dividas un mismo documento en varios archivos.' },
    { kind: 'dont', text: 'No mezcles diferentes documentos en un mismo PDF.' },
  ],
  examplesTitle: 'Ejemplos de buenos nombres',
  examples: [
    'PASAPORTE DE ANA PEREZ.pdf',
    'DUI DE JUAN MARTINEZ.pdf',
    'RECIBO DE SALARIO DE MARIA LOPEZ.pdf',
  ],
  footnote: 'Cada archivo debe ser un PDF escaneado y contener únicamente un tipo de documento.',
}
