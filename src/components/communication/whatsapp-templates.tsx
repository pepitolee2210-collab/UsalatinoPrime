'use client'

import { useState } from 'react'
import { MessageCircle, ChevronDown, Send, X } from 'lucide-react'

/**
 * Datos del cliente que rellenan los templates. Todos los campos son
 * opcionales — si falta uno, el template lo deja como placeholder
 * visible (ej. "{NOMBRE}") para que Andrium lo complete a mano antes
 * de enviar.
 */
export interface WhatsAppTemplateContext {
  client_name?: string
  client_first_name?: string
  client_phone?: string | null
  amount?: number
  due_date?: string
  signing_url?: string
  case_number?: string
  appointment_date?: string
  appointment_time?: string
  service_name?: string
}

interface TemplateDef {
  id: string
  icon: string
  label: string
  description: string
  build: (ctx: WhatsAppTemplateContext) => string
}

const TEMPLATES: TemplateDef[] = [
  {
    id: 'signing',
    icon: '📝',
    label: 'Recordatorio de firma',
    description: 'Para clientes que aún no firmaron su contrato',
    build: (ctx) => {
      const name = ctx.client_first_name || ctx.client_name || '{NOMBRE}'
      const service = ctx.service_name ? ` para ${ctx.service_name}` : ''
      const link = ctx.signing_url ? `\n\nAquí el link para firmarlo: ${ctx.signing_url}` : ''
      return `Hola ${name}, le escribe Andrium de UsaLatino Prime. Le recuerdo que tiene pendiente firmar su contrato${service}. Cuando lo firme, podemos avanzar con su caso.${link}\n\nQuedo atenta a cualquier duda. Gracias!`
    },
  },
  {
    id: 'overdue',
    icon: '💸',
    label: 'Cuota vencida',
    description: 'Para clientes con pagos atrasados',
    build: (ctx) => {
      const name = ctx.client_first_name || ctx.client_name || '{NOMBRE}'
      const amount = ctx.amount != null ? `$${ctx.amount.toLocaleString()}` : '{MONTO}'
      const dueLine = ctx.due_date ? ` (vencía el ${ctx.due_date})` : ''
      return `Hola ${name}, le escribe Andrium de UsaLatino Prime. Tiene una cuota pendiente de ${amount}${dueLine}.\n\nPor favor confírmeme cuándo podemos esperar el pago para no detener su caso. Si ya pagó, mándeme el comprobante y lo registro de inmediato.\n\nGracias!`
    },
  },
  {
    id: 'appointment',
    icon: '📅',
    label: 'Recordatorio de cita',
    description: 'Para confirmar una cita próxima',
    build: (ctx) => {
      const name = ctx.client_first_name || ctx.client_name || '{NOMBRE}'
      const date = ctx.appointment_date || '{FECHA}'
      const time = ctx.appointment_time ? ` a las ${ctx.appointment_time}` : ''
      return `Hola ${name}, le recuerdo su cita con UsaLatino Prime el ${date}${time}.\n\nPor favor confírmeme que asistirá. Si necesita reprogramar, dígamelo con anticipación.\n\nGracias!`
    },
  },
  {
    id: 'doc_ready',
    icon: '📄',
    label: 'Documento listo',
    description: 'Para avisar que hay docs nuevos en el portal',
    build: (ctx) => {
      const name = ctx.client_first_name || ctx.client_name || '{NOMBRE}'
      const caseInfo = ctx.case_number ? ` (caso ${ctx.case_number})` : ''
      return `Hola ${name}, le aviso que tenemos un documento listo para su caso${caseInfo}.\n\nPor favor ingrese al portal del cliente para descargarlo. Si tiene preguntas, quedo atenta.\n\nGracias!`
    },
  },
  {
    id: 'thanks',
    icon: '🙏',
    label: 'Agradecimiento de pago',
    description: 'Para confirmar pago recibido',
    build: (ctx) => {
      const name = ctx.client_first_name || ctx.client_name || '{NOMBRE}'
      const amount = ctx.amount != null ? ` por $${ctx.amount.toLocaleString()}` : ''
      return `Hola ${name}, ya recibimos su pago${amount}. ¡Gracias!\n\nEl pago quedó registrado en su cuenta. Continuamos avanzando con su caso.\n\nQue tenga buen día!`
    },
  },
]

interface Props {
  context: WhatsAppTemplateContext
  /** Variante visual del botón inicial */
  variant?: 'compact' | 'button'
  /** Texto del trigger button (default: "WhatsApp") */
  triggerLabel?: string
}

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 0) return null
  if (digits.length === 10) return `1${digits}`
  return digits
}

/**
 * Botón con templates pre-armados. Click → dropdown con templates →
 * preview/edit del mensaje → "Enviar por WhatsApp" abre wa.me con el
 * texto codificado. Si el cliente no tiene teléfono, el botón queda
 * disabled.
 */
export function WhatsAppTemplates({
  context, variant = 'compact', triggerLabel = 'WhatsApp',
}: Props) {
  const [open, setOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDef | null>(null)
  const [editedMessage, setEditedMessage] = useState('')

  const phone = normalizePhone(context.client_phone)
  const hasPhone = !!phone

  function selectTemplate(tpl: TemplateDef) {
    setSelectedTemplate(tpl)
    setEditedMessage(tpl.build(context))
  }

  function reset() {
    setSelectedTemplate(null)
    setEditedMessage('')
  }

  function close() {
    setOpen(false)
    reset()
  }

  function sendWhatsApp() {
    if (!phone) return
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(editedMessage)}`
    window.open(url, '_blank', 'noopener,noreferrer')
    close()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!hasPhone}
        className={`inline-flex items-center gap-1.5 transition-colors ${
          variant === 'button'
            ? 'rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-semibold px-3 py-2'
            : 'rounded-md bg-white border border-green-200 hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed text-green-700 text-[11px] font-semibold px-2.5 py-1.5'
        }`}
        title={hasPhone ? 'WhatsApp con plantilla' : 'Cliente sin teléfono'}
      >
        <MessageCircle className="w-3.5 h-3.5" />
        {triggerLabel}
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={close}
          />
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-gray-200">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-5">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-600">
                  WhatsApp · plantilla
                </p>
                <h2 className="mt-1 text-lg font-bold text-gray-900 leading-tight">
                  {context.client_name || 'Cliente'}
                </h2>
                {context.client_phone && (
                  <p className="text-[11px] text-gray-500 mt-0.5 font-mono">
                    {context.client_phone}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={close}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 py-5">
              {!selectedTemplate ? (
                // Paso 1: seleccionar template
                <div>
                  <p className="text-xs text-gray-600 mb-4">
                    Elige una plantilla. Se rellena automáticamente con los datos del cliente.
                  </p>
                  <div className="space-y-2">
                    {TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => selectTemplate(tpl)}
                        className="w-full text-left rounded-lg border border-gray-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40 px-4 py-3 transition-colors group"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-xl flex-shrink-0">{tpl.icon}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 group-hover:text-emerald-900">
                              {tpl.label}
                            </p>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              {tpl.description}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                // Paso 2: editar mensaje y enviar
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                      <span>{selectedTemplate.icon}</span>
                      {selectedTemplate.label}
                    </p>
                    <button
                      type="button"
                      onClick={reset}
                      className="text-[11px] text-gray-500 hover:text-gray-700 underline"
                    >
                      ← Cambiar
                    </button>
                  </div>
                  <textarea
                    value={editedMessage}
                    onChange={(e) => setEditedMessage(e.target.value)}
                    rows={8}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm leading-relaxed resize-y focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                  <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                    Edita el mensaje si quieres antes de enviarlo. Se abrirá WhatsApp Web con este
                    texto listo para mandar.
                  </p>
                </div>
              )}
            </div>

            {selectedTemplate && (
              <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={sendWhatsApp}
                  disabled={!hasPhone || !editedMessage.trim()}
                  className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-semibold px-4 py-2 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  Enviar por WhatsApp
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
