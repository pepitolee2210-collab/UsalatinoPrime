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

import { dispatchLexEvent } from './lex-events'

/**
 * Declaración compatible con FunctionDeclaration del SDK pero con tipos
 * en lowercase OpenAPI standard. El SDK enum `Type` serializa UPPERCASE
 * y la API de Gemini Live no las reconoce — toca usar strings literales.
 */
export interface LexFunctionDeclaration {
  name: string
  description: string
  parameters: unknown
}

export const LEX_TOOLS: LexFunctionDeclaration[] = [
  // ── Consulta (sin confirmación) ──────────────────────────────────────
  {
    name: 'listContracts',
    description:
      'Lista los contratos del sistema filtrados por status. Úsala cuando Vanessa pregunta "¿qué contratos hay pendientes?" o "muéstrame los firmados de esta semana". Retorna un resumen verbal — Vanessa también los ve en la lista en pantalla.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description:
            'Status a filtrar. Opciones: "borrador" (no enviado), "pendiente_firma" (link enviado, cliente no firmó), "firmado" (firmado por cliente), "activo" (caso en curso), "completado", "cancelado". Si vacío, retorna todos.',
          enum: ['borrador', 'pendiente_firma', 'firmado', 'activo', 'completado', 'cancelado', 'all'],
        },
        limit: {
          type: 'number',
          description: 'Cantidad máxima a retornar. Default 10.',
        },
      },
    },
  },
  {
    name: 'searchContract',
    description:
      'Busca un contrato por nombre del cliente o teléfono. Úsala cuando Vanessa dice "busca el contrato de María Pérez" o "trae el de teléfono +1 555 123".',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
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
    parameters: { type: 'object', properties: {} },
  },

  // ── UI helpers (sin mutar datos) ─────────────────────────────────────
  {
    name: 'highlightContract',
    description:
      'Resalta visualmente un contrato en la lista y hace scroll a él. Úsala después de searchContract para que Vanessa vea cuál es.',
    parameters: {
      type: 'object',
      properties: {
        contractId: { type: 'string', description: 'UUID del contrato.' },
      },
      required: ['contractId'],
    },
  },
  {
    name: 'openNewContractForm',
    description:
      'Abre el formulario "Nuevo Contrato" de la sección y lo PRE-RELLENA con los datos que Vanessa dictó. El form se ve en pantalla con los campos ya completos — Vanessa puede revisar visualmente. NO guarda nada todavía. Después llama a submitContractForm para guardar y generar el PDF. Antes de invocar esta tool, repite los datos y pide "¿confirmas que abro el formulario con estos datos?".',
    parameters: {
      type: 'object',
      properties: {
        clientFullName: {
          type: 'string',
          description: 'Nombre completo del cliente, ej "María Pérez González".',
        },
        clientPhone: {
          type: 'string',
          description: 'Teléfono del cliente, ej "+1 555 0000".',
        },
        serviceSlug: {
          type: 'string',
          description:
            'Slug del servicio. Opciones: visa-juvenil, asilo-politico, reforzar-asilo, cambio-de-corte, cambio-de-estatus, ajuste-de-estatus, taxes, itin-number, licencia-de-conducir, mociones, apelacion.',
        },
        totalPrice: {
          type: 'number',
          description:
            'Monto total acordado en USD. OPCIONAL — si no se dicta, usa el precio default del template.',
        },
        installmentCount: {
          type: 'number',
          description:
            'Número de cuotas. OPCIONAL — default es el del template (1 = pago único, normalmente 10 para servicios largos).',
        },
        clientPassport: {
          type: 'string',
          description: 'Número de pasaporte del cliente. OPCIONAL — se puede completar después.',
        },
        clientDob: {
          type: 'string',
          description: 'Fecha de nacimiento del cliente en formato YYYY-MM-DD. OPCIONAL.',
        },
        minors: {
          type: 'array',
          description:
            'Lista de menores para servicios SIJS (visa-juvenil). OPCIONAL — solo si Vanessa los menciona y el servicio los requiere.',
          items: {
            type: 'object',
            properties: {
              fullName: { type: 'string', description: 'Nombre completo del menor' },
              dob: { type: 'string', description: 'Fecha nacimiento YYYY-MM-DD' },
              passport: { type: 'string', description: 'Pasaporte si lo tiene' },
              birthplace: { type: 'string', description: 'Lugar de nacimiento' },
            },
            required: ['fullName'],
          },
        },
      },
      required: ['clientFullName', 'clientPhone', 'serviceSlug'],
    },
  },

  // ── Mutaciones (SOLO después de confirmación verbal de Vanessa) ──────
  {
    name: 'submitContractForm',
    description:
      'Hace click en el botón "Generar contrato" del formulario abierto. Equivale a Vanessa clickeando Guardar — persiste el contrato en la BD, genera el PDF y crea el case asociado. SOLO invoca DESPUÉS de que Vanessa revise visualmente y diga "guárdalo" / "está bien" / "envíalo". Si Vanessa pide cambiar algún campo, dile que lo ajuste manualmente o vuelve a llamar openNewContractForm con los datos corregidos.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'sendSigningLink',
    description:
      'Genera y envía el link de firma electrónica al cliente del contrato indicado. SOLO invoca esta tool DESPUÉS de que Vanessa confirme verbalmente con "sí, envíalo" o "confirma". Antes de invocar, REPITE el nombre del cliente y el monto para que ella pueda confirmar o corregir.',
    parameters: {
      type: 'object',
      properties: {
        contractId: { type: 'string', description: 'UUID del contrato.' },
      },
      required: ['contractId'],
    },
  },
  {
    name: 'updateContractStatus',
    description:
      'Cambia el status del contrato (ej. marcarlo como firmado, activo, completado, cancelado). SOLO después de confirmación verbal. Antes de invocar, di "voy a marcar el contrato de [cliente] como [status], ¿confirmas?".',
    parameters: {
      type: 'object',
      properties: {
        contractId: { type: 'string', description: 'UUID del contrato.' },
        newStatus: {
          type: 'string',
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
    parameters: { type: 'object', properties: {} },
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

      case 'openNewContractForm': {
        const detail = {
          clientName: args.clientFullName ? String(args.clientFullName).trim() : undefined,
          clientPhone: args.clientPhone ? String(args.clientPhone).trim() : undefined,
          serviceSlug: args.serviceSlug ? String(args.serviceSlug).trim() : undefined,
          clientPassport: args.clientPassport ? String(args.clientPassport).trim() : undefined,
          clientDob: args.clientDob ? String(args.clientDob).trim() : undefined,
          totalPrice: typeof args.totalPrice === 'number' ? args.totalPrice : undefined,
          installmentCount:
            typeof args.installmentCount === 'number' ? args.installmentCount : undefined,
          minors: Array.isArray(args.minors) ? args.minors : undefined,
        }
        if (!detail.clientName || !detail.clientPhone || !detail.serviceSlug) {
          return {
            ok: false,
            message: 'Faltan datos para abrir el formulario (nombre, teléfono o servicio).',
          }
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('lex:openNewContractForm', { detail }))
        }
        return {
          ok: true,
          message: `Formulario abierto y pre-rellenado para ${detail.clientName}. Revisa visualmente; cuando esté ok, dime "guárdalo" y lo genero.`,
        }
      }

      case 'submitContractForm': {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('lex:submitContractForm'))
        }
        return {
          ok: true,
          message: 'Disparé el botón Guardar. El sistema generará el PDF y creará el case automáticamente.',
        }
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
