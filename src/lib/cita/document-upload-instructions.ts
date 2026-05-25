export type InstructionRule = {
  kind: 'do' | 'dont'
  text: string
}

export type UploadInstructions = {
  eyebrow: string
  title: string
  subtitle: string
  rules: InstructionRule[]
  examplesTitle: string
  examples: string[]
  footnote: string
}

export const DOCUMENT_UPLOAD_INSTRUCTIONS: UploadInstructions = {
  eyebrow: 'IMPORTANTE',
  title: 'Antes de subir tus documentos',
  subtitle: 'Para evitar retrasos en la validación de tu trámite, sigue estas indicaciones:',
  rules: [
    { kind: 'do', text: 'Todos los documentos deben cargarse en formato PDF.' },
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
  footnote: 'Cada archivo debe contener únicamente un tipo de documento.',
}
