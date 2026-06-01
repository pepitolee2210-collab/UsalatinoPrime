'use client'

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
  created_by_name: string | null
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

interface Column {
  id: string
  label: string
  dot: string
  bg: string
  border: string
  text: string
}

const COLUMNS: Column[] = [
  { id: 'borrador',        label: 'Borrador',        dot: 'var(--admin-fg-muted)', bg: 'var(--admin-accent-soft)',  border: 'var(--admin-border-strong)',  text: 'var(--admin-fg-muted)' },
  { id: 'pendiente_firma', label: 'Pendiente Firma', dot: '#FACC15', bg: 'rgba(250,204,21,0.06)',   border: 'rgba(250,204,21,0.25)',  text: '#FDE68A' },
  { id: 'firmado',         label: 'Firmado',         dot: '#60A5FA', bg: 'rgba(96,165,250,0.06)',   border: 'rgba(96,165,250,0.25)',  text: '#93C5FD' },
  { id: 'activo',          label: 'Activo',          dot: '#4ADE80', bg: 'rgba(34,197,94,0.06)',    border: 'rgba(34,197,94,0.25)',   text: '#86EFAC' },
  { id: 'completado',      label: 'Completado',      dot: '#FFFFFF', bg: 'var(--admin-accent-soft)',  border: 'rgba(255,255,255,0.18)', text: '#FFFFFF' },
]

const ICON_BTN =
  'inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed'

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
              className="rounded-2xl p-3 flex flex-col gap-2 min-h-[220px]"
              style={{
                background: 'var(--admin-panel-grad)',
                border: `0.5px solid ${col.border}`,
                backdropFilter: 'blur(20px)',
              }}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-1 pb-2" style={{ borderBottom: `0.5px solid ${col.border}` }}>
                <div className="flex items-center gap-2">
                  <span className="rounded-full" style={{ width: 6, height: 6, background: col.dot, boxShadow: `0 0 6px ${col.dot}` }} />
                  <h3
                    style={{
                      fontFamily: 'var(--font-mono-tech)',
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.18em',
                      color: col.text,
                    }}
                  >
                    {col.label.toUpperCase()}
                  </h3>
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-mono-tech)',
                    fontSize: 10,
                    fontWeight: 700,
                    color: col.text,
                    background: col.bg,
                    padding: '2px 6px',
                    borderRadius: 4,
                    border: `0.5px solid ${col.border}`,
                  }}
                >
                  {items.length.toString().padStart(2, '0')}
                </span>
              </div>

              {items.length === 0 ? (
                <p
                  className="py-4 text-center"
                  style={{
                    fontFamily: 'var(--font-mono-tech)',
                    fontSize: 10,
                    color: 'var(--admin-fg-subtle)',
                    letterSpacing: '0.15em',
                    fontStyle: 'italic',
                  }}
                >
                  VACÍO
                </p>
              ) : (
                <div className="space-y-2">
                  {items.map((c) => (
                    <div
                      key={c.id}
                      className="relative rounded-xl p-3 cursor-pointer transition-all duration-300 hover:-translate-y-0.5"
                      onClick={() => onEdit(c.id)}
                      style={{
                        background: 'var(--admin-accent-soft)',
                        border: '0.5px solid var(--admin-border)',
                      }}
                    >
                      {/* Left accent */}
                      <span
                        aria-hidden
                        className="absolute top-2 bottom-2 left-0 w-[2px] rounded-full"
                        style={{ background: col.dot, opacity: 0.7 }}
                      />

                      <div className="pl-2 space-y-2">
                        <div>
                          <p
                            className="truncate"
                            style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-fg)', letterSpacing: '-0.005em' }}
                            title={c.client_full_name}
                          >
                            {c.client_full_name}
                          </p>
                          <p
                            className="truncate"
                            style={{ fontSize: 11, color: 'var(--admin-fg-muted)', marginTop: 1 }}
                            title={c.service_name}
                          >
                            {c.service_name}
                          </p>
                          {c.created_by_name && (
                            <span
                              className="inline-flex items-center px-1.5 py-0.5 rounded-full mt-1"
                              style={{
                                background: 'var(--admin-gold-soft)',
                                border: '0.5px solid var(--admin-gold-border, var(--admin-gold))',
                                fontFamily: 'var(--font-mono-tech)',
                                fontSize: 8,
                                fontWeight: 700,
                                letterSpacing: '0.08em',
                                color: 'var(--admin-gold)',
                              }}
                              title={`Contrato creado por ${c.created_by_name}`}
                            >
                              POR {c.created_by_name.split(' ')[0].toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span
                            style={{
                              fontFamily: 'var(--font-mono-tech)',
                              fontSize: 13,
                              fontWeight: 700,
                              color: 'var(--admin-fg)',
                              letterSpacing: '-0.005em',
                            }}
                          >
                            ${Number(c.total_price).toLocaleString()}
                          </span>
                          {c.has_installments && c.installment_count > 0 && (
                            <span
                              style={{
                                fontFamily: 'var(--font-mono-tech)',
                                fontSize: 9,
                                color: 'var(--admin-fg-subtle)',
                                letterSpacing: '0.1em',
                              }}
                            >
                              {c.installment_count} CUOTAS
                            </span>
                          )}
                        </div>
                        {c.signed_at && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full"
                            style={{
                              background: 'rgba(34,197,94,0.10)',
                              border: '0.5px solid rgba(34,197,94,0.3)',
                              fontFamily: 'var(--font-mono-tech)',
                              fontSize: 9,
                              fontWeight: 700,
                              color: 'var(--admin-green)',
                              letterSpacing: '0.1em',
                            }}
                          >
                            <CheckCircle className="w-2.5 h-2.5" />
                            {new Date(c.signed_at).toLocaleDateString('es-US', { day: 'numeric', month: 'short' }).toUpperCase()}
                          </span>
                        )}

                        {/* Quick actions */}
                        <div
                          className="flex items-center gap-0.5 pt-2"
                          style={{ borderTop: '0.5px solid var(--admin-accent-soft)' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {c.signing_token ? (
                            <>
                              <button
                                type="button"
                                onClick={() => onCopyLink(c.signing_token!)}
                                title="Copiar enlace"
                                className={ICON_BTN}
                                style={{ color: 'var(--admin-gold)' }}
                              >
                                <Link2 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onWhatsApp(c.id)}
                                title="WhatsApp"
                                className={ICON_BTN}
                                style={{ color: 'var(--admin-green)' }}
                                disabled={!c.client_phone}
                              >
                                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                </svg>
                              </button>
                            </>
                          ) : c.status === 'firmado' || c.status === 'activo' || c.status === 'completado' ? (
                            <span className={ICON_BTN} style={{ color: 'var(--admin-green)', opacity: 0.5 }}>
                              <CheckCircle className="w-3 h-3" />
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onSendToClient(c.id)}
                              title="Enviar para firma"
                              className={ICON_BTN}
                              style={{ color: 'var(--admin-gold)' }}
                            >
                              <Send className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onDownloadPDF(c.id)}
                            title="PDF"
                            className={ICON_BTN}
                            style={{ color: 'var(--admin-fg-muted)' }}
                          >
                            <Download className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEdit(c.id)}
                            title="Editar"
                            className={ICON_BTN}
                            style={{ color: 'var(--admin-fg-muted)' }}
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(c.id, c.client_full_name)}
                            title="Eliminar"
                            className={ICON_BTN + ' ml-auto'}
                            style={{ color: 'var(--admin-red)' }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {contracts.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--admin-fg-subtle)' }} />
          <p
            style={{
              fontFamily: 'var(--font-mono-tech)',
              fontSize: 11,
              color: 'var(--admin-fg-subtle)',
              letterSpacing: '0.15em',
            }}
          >
            SIN CONTRATOS PARA MOSTRAR
          </p>
        </div>
      )}
    </div>
  )
}
