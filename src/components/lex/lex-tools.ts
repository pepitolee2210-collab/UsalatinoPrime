/**
 * Tools que Vanessa puede invocar por voz desde Lex en /employee/contratos.
 *
 * Filosofía: Lex prepara, Vanessa revisa. Cualquier acción que muta datos
 * (crear contrato, enviar link de firma, cambiar status, borrar) DEBE pedir
 * confirmación verbal explícita en el prompt antes de invocar la tool.
 *
 * Las tools que solo CONSULTAN (listar, buscar, resumen) pueden ejecutarse
 * directamente. Las que mutan o navegan UI piden confirmación.
 */

import { Type, type FunctionDeclaration } from '@google/genai'
import { dispatchLexEvent } from './lex-events'

export const LEX_TOOLS: FunctionDeclaration[] = [
  // ── Consulta (sin confirmación) ──────────────────────────────────────
  {
    name: 'listContracts',
    description:
      'Lista los contratos del sistema filtrados por status. Úsala cuando Vanessa pregunta "¿qué contratos hay pendientes?" o "muéstrame los firmados de esta semana". Retorna un resumen verbal — Vanessa también los ve en la lista en pantalla.',
    parametersJsonSchema: {
      type: Type.OBJECT,
      properties: {
        status: {
          type: Type.STRING,
          description:
            'Status a filtrar. Opciones: "borrador" (no enviado), "pendiente_firma" (link enviado, cliente no firmó), "firmado" (firmado por cliente), "activo" (caso en curso), "completado", "cancelado". Si vacío, retorna todos.',
          enum: ['borrador', 'pendiente_firma', 'firmado', 'activo', 'completado', 'cancelado', 'all'],
        },
        limit: {
          type: Type.NUMBER,
          description: 'Cantidad máxima a retornar. Default 10.',
        },
      },
    },
  },
  {
    name: 'searchContract',
    description:
      'Busca un contrato por nombre del cliente o teléfono. Úsala cuando Vanessa dice "busca el contrato de María Pérez" o "trae el de teléfono +1 555 123".',
    parametersJsonSchema: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'Nombre completo, parcial, o teléfono del cliente.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'summarizeContracts',
    description:
      'Resumen ejecutivo: cuántos contratos hay por status, ingreso pendiente, etc. Úsala cuando Vanessa dice "dime cómo va el día" o "qué tengo hoy".',
    parametersJsonSchema: { type: Type.OBJECT, properties: {} },
  },

  // ── UI helpers (sin mutar datos) ─────────────────────────────────────
  {
    name: 'highlightContract',
    description:
      'Resalta visualmente un contrato en la lista y hace scroll a él. Úsala después de searchContract para que Vanessa vea cuál es.',
    parametersJsonSchema: {
      type: Type.OBJECT,
      properties: {
        contractId: { type: Type.STRING, description: 'UUID del contrato.' },
      },
      required: ['contractId'],
    },
  },
  {
    name: 'openNewContract',
    description:
      'Abre el formulario de nuevo contrato con datos pre-cargados (si Vanessa ya dictó algunos). Úsala cuando ella dice "hagamos uno nuevo para María, visa juvenil, $2500".',
    parametersJsonSchema: {
      type: Type.OBJECT,
      properties: {
        clientName: { type: Type.STRING, description: 'Nombre completo del cliente si Vanessa lo dio.' },
        clientPhone: { type: Type.STRING, description: 'Teléfono del cliente si Vanessa lo dio.' },
        serviceSlug: {
          type: Type.STRING,
          description:
            'Servicio: visa-juvenil, asilo-politico, cambio-corte, cambio-estatus, ajuste-estatus, taxes, itin, licencia, mociones.',
        },
        totalAmount: { type: Type.NUMBER, description: 'Monto total acordado.' },
      },
    },
  },

  // ── Mutaciones (SOLO después de confirmación verbal de Vanessa) ──────
  {
    name: 'sendSigningLink',
    description:
      'Genera y envía el link de firma electrónica al cliente del contrato indicado. SOLO invoca esta tool DESPUÉS de que Vanessa confirme verbalmente con "sí, envíalo" o "confirma". Antes de invocar, REPITE el nombre del cliente y el monto para que ella pueda confirmar o corregir.',
    parametersJsonSchema: {
      type: Type.OBJECT,
      properties: {
        contractId: { type: Type.STRING, description: 'UUID del contrato.' },
      },
      required: ['contractId'],
    },
  },
  {
    name: 'updateContractStatus',
    description:
      'Cambia el status del contrato (ej. marcarlo como firmado, activo, completado, cancelado). SOLO después de confirmación verbal. Antes de invocar, di "voy a marcar el contrato de [cliente] como [status], ¿confirmas?".',
    parametersJsonSchema: {
      type: Type.OBJECT,
      properties: {
        contractId: { type: Type.STRING, description: 'UUID del contrato.' },
        newStatus: {
          type: Type.STRING,
          enum: ['firmado', 'activo', 'completado', 'cancelado'],
          description: 'Nuevo status. NO se puede usar para borrar — para eso usa deleteContract.',
        },
      },
      required: ['contractId', 'newStatus'],
    },
  },

  // ── Cierre del agente ────────────────────────────────────────────────
  {
    name: 'closeAgent',
    description:
      'Cierra el panel de Lex. Úsala cuando Vanessa diga "gracias eso es todo" o "puedes cerrarte".',
    parametersJsonSchema: { type: Type.OBJECT, properties: {} },
  },
]

/**
 * Resultado de invocar una tool — se envía al modelo como functionResponse.
 * Cada tool retorna un objeto serializable que describe lo que pasó.
 */
export interface ToolResult {
  ok: boolean
  message?: string
  data?: unknown
}

/**
 * Ejecuta una tool. Las que consultan el servidor son async; las de UI
 * dispatchan eventos custom para que el componente reaccione.
 */
export async function executeLexTool(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  try {
    switch (name) {
      case 'listContracts': {
        const status = (args.status as string | undefined) ?? 'all'
        const limit = (args.limit as number | undefined) ?? 10
        const res = await fetch(`/api/voice-agent/contracts/list?status=${encodeURIComponent(status)}&limit=${limit}`)
        if (!res.ok) {
          return { ok: false, message: `Error consultando contratos (${res.status})` }
        }
        const data = await res.json()
        return { ok: true, data, message: `Tengo ${data.count ?? 0} contratos en estado ${status}.` }
      }

      case 'searchContract': {
        const query = String(args.query || '').trim()
        if (!query) return { ok: false, message: 'Falta el nombre o teléfono a buscar.' }
        const res = await fetch(`/api/voice-agent/contracts/search?q=${encodeURIComponent(query)}`)
        if (!res.ok) return { ok: false, message: `Error buscando (${res.status})` }
        const data = await res.json()
        return { ok: true, data, message: `Encontré ${data.matches?.length ?? 0} coincidencia(s).` }
      }

      case 'summarizeContracts': {
        const res = await fetch('/api/voice-agent/contracts/summary')
        if (!res.ok) return { ok: false, message: 'Error obteniendo resumen' }
        const data = await res.json()
        return { ok: true, data }
      }

      case 'highlightContract': {
        const contractId = String(args.contractId || '')
        if (!contractId) return { ok: false, message: 'Falta contractId' }
        dispatchLexEvent('lex:scrollToContract', { contractId })
        dispatchLexEvent('lex:highlightContract', { contractId })
        return { ok: true, message: 'Contrato resaltado' }
      }

      case 'openNewContract': {
        dispatchLexEvent('lex:openNewContract', { prefill: args })
        return { ok: true, message: 'Formulario abierto con los datos pre-cargados. Vanessa puede revisar antes de guardar.' }
      }

      case 'sendSigningLink': {
        const contractId = String(args.contractId || '')
        if (!contractId) return { ok: false, message: 'Falta contractId' }
        const res = await fetch('/api/contracts/generate-signing-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contract_id: contractId }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          return { ok: false, message: err.error || `Error generando link (${res.status})` }
        }
        const data = await res.json()
        dispatchLexEvent('lex:refreshContracts')
        dispatchLexEvent('lex:notify', { kind: 'success', message: 'Link de firma enviado' })
        return { ok: true, data, message: 'Link generado y status actualizado a pendiente_firma.' }
      }

      case 'updateContractStatus': {
        const contractId = String(args.contractId || '')
        const newStatus = String(args.newStatus || '')
        if (!contractId || !newStatus) return { ok: false, message: 'Faltan contractId o newStatus' }
        const res = await fetch('/api/voice-agent/contracts/update-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contract_id: contractId, status: newStatus }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          return { ok: false, message: err.error || `Error actualizando (${res.status})` }
        }
        dispatchLexEvent('lex:refreshContracts')
        dispatchLexEvent('lex:notify', { kind: 'success', message: `Status cambiado a ${newStatus}` })
        return { ok: true, message: `Contrato marcado como ${newStatus}.` }
      }

      case 'closeAgent': {
        dispatchLexEvent('lex:close')
        return { ok: true, message: 'Cerrando.' }
      }

      default:
        return { ok: false, message: `Tool desconocida: ${name}` }
    }
  } catch (err) {
    console.error('[lex-tools] error executing', name, err)
    return { ok: false, message: 'Error interno ejecutando la acción.' }
  }
}
