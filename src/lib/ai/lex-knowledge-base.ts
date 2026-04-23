import { readFile } from 'node:fs/promises'
import path from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { createLogger } from '@/lib/logger'

const log = createLogger('lex-kb')

/**
 * Base de conocimiento oficial de LEX. Cada entrada es un documento
 * PDF de USCIS (formulario vacío o instrucciones) que se inyecta como
 * contexto cuando el tema de conversación lo requiere.
 *
 * El prompt caching de Claude hace que estos PDFs solo se procesen
 * una vez por sesión cache (~5 min) y después se lean del cache al
 * 10% del costo — lo que hace viable cargar 5-10 MB de documentos
 * oficiales sin que cada consulta sea carísima.
 */
export interface KnowledgeDoc {
  slug: string
  label: string
  description: string
  filename: string
  /** Patrones que activan la carga automática de este doc. Case-insensitive. */
  triggers: RegExp[]
}

export const KNOWLEDGE_DOCS: KnowledgeDoc[] = [
  {
    slug: 'i-485',
    label: 'I-485 — Application to Register Permanent Residence or Adjust Status',
    description: 'Formulario oficial vacío de USCIS para ajuste de estatus.',
    filename: 'i-485.pdf',
    triggers: [/i[-\s]?485/i, /ajuste\s+de?\s+estatus/i, /adjust(ment)?\s+of\s+status/i, /residencia\s+permanente/i, /green\s+card/i],
  },
  {
    slug: 'i-485-instructions',
    label: 'I-485 Instructions (USCIS)',
    description: 'Instrucciones oficiales del I-485: 40+ páginas con requisitos por sección, documentos de soporte, elegibilidad por categoría.',
    filename: 'i-485-instructions.pdf',
    triggers: [/i[-\s]?485/i, /ajuste\s+de?\s+estatus/i, /adjust(ment)?\s+of\s+status/i, /residencia\s+permanente/i],
  },
  {
    slug: 'i-360',
    label: 'I-360 — Petition for Amerasian, Widow(er), or Special Immigrant',
    description: 'Formulario oficial de USCIS para la petición SIJS (Special Immigrant Juvenile Status).',
    filename: 'i-360.pdf',
    triggers: [/i[-\s]?360/i, /sijs/i, /special\s+immigrant\s+juvenil/i, /visa\s+juvenil/i, /special\s+findings/i],
  },
  {
    slug: 'i-589',
    label: 'I-589 — Application for Asylum',
    description: 'Formulario oficial de USCIS para la solicitud de asilo afirmativo o defensivo.',
    filename: 'i-589.pdf',
    triggers: [/i[-\s]?589/i, /asilo/i, /asylum/i, /credible\s+fear/i, /miedo\s+creíble/i],
  },
]

/**
 * Determina qué documentos oficiales cargar según la consulta del
 * usuario + los adjuntos que mandó. Si no detecta nada específico,
 * devuelve [] — LEX opera sin base de conocimiento adicional.
 */
export function selectRelevantDocs(
  userMessage: string,
  attachmentNames: string[] = []
): KnowledgeDoc[] {
  const corpus = [userMessage, ...attachmentNames].join(' ')
  const selected: KnowledgeDoc[] = []
  for (const doc of KNOWLEDGE_DOCS) {
    if (doc.triggers.some(rx => rx.test(corpus))) {
      selected.push(doc)
    }
  }
  return selected
}

/**
 * Lee un PDF oficial del filesystem (carpeta public/forms) y lo
 * codifica a base64 para pasarlo como content block a Claude.
 * Cachea los buffers en memoria para no leer del disco en cada
 * request — los PDFs oficiales no cambian.
 */
const _pdfCache = new Map<string, string>()

async function loadPdfAsBase64(filename: string): Promise<string> {
  const cached = _pdfCache.get(filename)
  if (cached) return cached
  const fullPath = path.join(process.cwd(), 'public', 'forms', filename)
  const buf = await readFile(fullPath)
  const b64 = buf.toString('base64')
  _pdfCache.set(filename, b64)
  log.info('loaded knowledge doc', { filename, sizeKB: Math.round(buf.length / 1024) })
  return b64
}

/**
 * Construye los content blocks de Claude (type: 'document') para los
 * docs seleccionados. Cada PDF va con cache_control ephemeral para
 * que se mantenga en el cache de la sesión ~5 min entre consultas.
 */
export async function buildKnowledgeContentBlocks(
  docs: KnowledgeDoc[]
): Promise<Anthropic.Messages.ContentBlockParam[]> {
  if (docs.length === 0) return []

  const blocks: Anthropic.Messages.ContentBlockParam[] = []

  // Primero un bloque de texto que introduce los documentos que vienen.
  // Esto ayuda al modelo a saber qué tiene disponible como referencia.
  blocks.push({
    type: 'text',
    text: `\n## BASE DE CONOCIMIENTO OFICIAL ADJUNTA\n\nTienes acceso a los siguientes documentos oficiales de USCIS como referencia autorizada. **Al revisar formularios o responder preguntas técnicas, SIEMPRE cita estos documentos** con el formato \`[según <label del doc> pág. X]\` cuando bases tu análisis en ellos. Nunca inventes criterios que no estén en estos documentos o en tu conocimiento general de inmigración; si un tema no está cubierto aquí y no estás segura, dilo explícitamente al paralegal ("no puedo confirmar este punto con los documentos oficiales disponibles").\n\nDocumentos cargados en esta conversación:\n${docs.map(d => `- **${d.label}** — ${d.description}`).join('\n')}\n`,
    cache_control: { type: 'ephemeral' },
  })

  // Después cada PDF como content block type: 'document'.
  // Claude los procesa nativamente con visión OCR + comprensión semántica.
  for (const doc of docs) {
    const base64 = await loadPdfAsBase64(doc.filename)
    blocks.push({
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: base64,
      },
      // Opcional: el título ayuda al modelo a referenciar el doc por nombre.
      title: doc.label,
      cache_control: { type: 'ephemeral' },
    } as Anthropic.Messages.ContentBlockParam)
  }

  return blocks
}
