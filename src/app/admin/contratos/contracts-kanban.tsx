'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, FileText, Send, Pencil, Link2, Download, Trash2 } from 'lucide-react'

interface KanbanContract {
  id: string
  client_full_name: string
  service_name: string
  total_price: number
  status: string
  signing_token: string | null
  signed_at: string | null
  created_at: string
  has_installments: boolean
  installment_count: number
  client_phone: string | null
}

interface Props {
  contracts: KanbanContract[]
  onEdit: (id: string) => void
  onSendToClient: (id: string) => void
  onCopyLink: (token: string) => void
  onWhatsApp: (id: string) => void
  onDownloadPDF: (id: string) => void
  onDelete: (id: string, name: string) => void
}

const COLUMNS: Array<{ id: string; label: string; color: string; bg: string; accent: string }> = [
  { id: 'borrador', label: 'Borrador', color: 'text-gray-700', bg: 'bg-gray-50', accent: 'border-l-gray-400' },
  { id: 'pendiente_firma', label: 'Pendiente firma', color: 'text-amber-800', bg: 'bg-amber-50/60', accent: 'border-l-amber-500' },
  { id: 'firmado', label: 'Firmado', color: 'text-blue-800', bg: 'bg-blue-50/60', accent: 'border-l-blue-500' },
  { id: 'activo', label: 'Activo', color: 'text-emerald-800', bg: 'bg-emerald-50/60', accent: 'border-l-emerald-500' },
  { id: 'completado', label: 'Completado', color: 'text-purple-800', bg: 'bg-purple-50/60', accent: 'border-l-purple-500' },
]

export function ContractsKanban({
  contracts, onEdit, onSendToClient, onCopyLink, onWhatsApp, onDownloadPDF, onDelete,
}: Props) {
  return (
    <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 min-w-[280px]">
        {COLUMNS.map((col) => {
          const items = contracts.filter((c) => c.status === col.id)
          return (
            <div
              key={col.id}
              className={`rounded-xl border border-gray-200 ${col.bg} p-3 flex flex-col gap-2 min-h-[200px]`}
            >
              <div className="flex items-baseline justify-between">
                <h3 className={`text-xs font-bold uppercase tracking-wider ${col.color}`}>
                  {col.label}
                </h3>
                <span className={`text-[10px] font-mono ${col.color} opacity-70`}>
                  {items.length}
                </span>
              </div>

              {items.length === 0 ? (
                <p className="text-[11px] text-gray-400 italic py-3 text-center">
                  Sin contratos en esta etapa
                </p>
              ) : (
                <div className="space-y-2">
                  {items.map((c) => (
                    <Card
                      key={c.id}
                      className={`border-l-2 ${col.accent} hover:shadow-md transition-shadow cursor-pointer`}
                      onClick={() => onEdit(c.id)}
                    >
                      <CardContent className="p-3 space-y-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-900 truncate" title={c.client_full_name}>
                            {c.client_full_name}
                          </p>
                          <p className="text-[11px] text-gray-500 truncate" title={c.service_name}>
                            {c.service_name}
                          </p>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-sm font-bold text-[#002855]">
                            ${Number(c.total_price).toLocaleString()}
                          </span>
                          {c.has_installments && c.installment_count > 0 && (
                            <span className="text-[10px] text-gray-500">
                              {c.installment_count} cuotas
                            </span>
                          )}
                        </div>
                        {c.signed_at && (
                          <Badge className="bg-emerald-100 text-emerald-700 text-[10px] font-normal">
                            Firmado {new Date(c.signed_at).toLocaleDateString('es-US', { day: 'numeric', month: 'short' })}
                          </Badge>
                        )}

                        {/* Acciones rápidas */}
                        <div
                          className="flex items-center gap-1 pt-1 border-t border-gray-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {c.signing_token ? (
                            <>
                              <button
                                type="button"
                                onClick={() => onCopyLink(c.signing_token!)}
                                title="Copiar enlace"
                                className="h-7 w-7 inline-flex items-center justify-center rounded text-amber-600 hover:bg-amber-50"
                              >
                                <Link2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onWhatsApp(c.id)}
                                title="WhatsApp"
                                className="h-7 w-7 inline-flex items-center justify-center rounded text-green-600 hover:bg-green-50"
                                disabled={!c.client_phone}
                              >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                </svg>
                              </button>
                            </>
                          ) : c.status === 'firmado' || c.status === 'activo' || c.status === 'completado' ? (
                            <span
                              title="Ya firmado"
                              className="h-7 w-7 inline-flex items-center justify-center rounded text-green-600 opacity-50"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onSendToClient(c.id)}
                              title="Enviar para firma"
                              className="h-7 w-7 inline-flex items-center justify-center rounded text-[#F2A900] hover:bg-amber-50"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onDownloadPDF(c.id)}
                            title="PDF"
                            className="h-7 w-7 inline-flex items-center justify-center rounded text-gray-600 hover:bg-gray-100"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEdit(c.id)}
                            title="Editar"
                            className="h-7 w-7 inline-flex items-center justify-center rounded text-gray-600 hover:bg-gray-100"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(c.id, c.client_full_name)}
                            title="Eliminar"
                            className="h-7 w-7 inline-flex items-center justify-center rounded text-red-500 hover:bg-red-50 ml-auto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {contracts.length === 0 && (
        <div className="text-center py-10">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Sin contratos para mostrar.</p>
        </div>
      )}
    </div>
  )
}
