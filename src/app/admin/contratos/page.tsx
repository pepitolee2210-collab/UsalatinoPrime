'use client'

// Admin-only page; never statically prerendered. Avoids the Next CSR-bailout
// error that useSearchParams() would otherwise trigger at build time.
export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { QuickContractGenerator } from '@/components/admin/QuickContractGenerator'
import { FileText, Plus, Pencil, Download, Trash2, ChevronLeft, Send, Link2, CheckCircle, Search } from 'lucide-react'
import { toast } from 'sonner'

interface ContractRow {
  id: string
  created_at: string
  updated_at: string
  service_name: string
  service_slug: string
  variant_index: number
  addon_services: any[]
  client_full_name: string
  client_passport: string
  client_phone: string | null
  client_dob: string
  client_signature: string
  minors: any[]
  total_price: number
  initial_payment: number
  installment_count: number
  monthly_amount: number
  use_custom_monthly: boolean
  contract_start_date: string
  has_installments: boolean
  use_custom_price: boolean
  use_custom_installments: boolean
  payment_schedule: any[]
  objeto_del_contrato: string
  etapas: string[]
  status: string
  signing_token: string | null
  client_signature_image: string | null
  signed_at: string | null
}

const statusLabels: Record<string, string> = {
  borrador: 'Borrador',
  pendiente_firma: 'Pendiente Firma',
  firmado: 'Firmado',
  activo: 'Activo',
  completado: 'Completado',
}

const statusColors: Record<string, string> = {
  borrador: 'bg-gray-100 text-gray-700',
  pendiente_firma: 'bg-amber-100 text-amber-800',
  firmado: 'bg-blue-100 text-blue-800',
  activo: 'bg-green-100 text-green-800',
  completado: 'bg-emerald-100 text-emerald-800',
}

export default function ContratosPageWrapper() {
  // Suspense is required because ContratosPageInner reads useSearchParams.
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">Cargando contratos...</p>}>
      <ContratosPageInner />
    </Suspense>
  )
}

function ContratosPageInner() {
  const [contracts, setContracts] = useState<ContractRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editingContract, setEditingContract] = useState<ContractRow | null>(null)
  const [showGenerator, setShowGenerator] = useState(false)
  const [search, setSearch] = useState('')
  const supabase = createClient()
  const searchParams = useSearchParams()
  const router = useRouter()

  // If we arrived here from /admin/prospectos-citas via the "Convertir en
  // cliente" button, auto-open the generator with the client data already
  // filled in. Keeps Andriuw from retyping the name, phone, and service.
  const prefillFromVoice = useMemo(() => {
    const name = searchParams.get('prefill_name')
    const phone = searchParams.get('prefill_phone')
    const fromVoice = searchParams.get('from_voice')
    if (!name && !phone && !fromVoice) return null
    return {
      name: name || '',
      phone: phone || '',
      fromVoiceAppointmentId: fromVoice || null,
    }
  }, [searchParams])

  useEffect(() => {
    if (prefillFromVoice) {
      setShowGenerator(true)
    }
  }, [prefillFromVoice])

  const filteredContracts = contracts.filter(c => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return c.client_full_name.toLowerCase().includes(q) ||
      c.service_name.toLowerCase().includes(q) ||
      (c.client_passport || '').toLowerCase().includes(q)
  })

  async function loadContracts() {
    setLoading(true)
    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading contracts:', error)
      toast.error('Error al cargar contratos')
    } else {
      setContracts(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadContracts()
  }, [])

  async function handleDelete(id: string, clientName: string) {
    if (!confirm(`\u00bfEliminar el contrato de ${clientName}?`)) return
    const { error } = await supabase.from('contracts').delete().eq('id', id)
    if (error) {
      toast.error('Error al eliminar')
    } else {
      toast.success('Contrato eliminado')
      loadContracts()
    }
  }

  async function handleStatusChange(id: string, newStatus: string) {
    const { error } = await supabase.from('contracts').update({ status: newStatus }).eq('id', id)
    if (error) {
      toast.error('Error al actualizar estado')
    } else {
      loadContracts()
    }
  }

  async function handleSendToClient(contract: ContractRow) {
    try {
      const res = await fetch('/api/contracts/generate-signing-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ contract_id: contract.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Error al generar enlace')
        return
      }
      await navigator.clipboard.writeText(data.url)
      toast.success('Enlace copiado al portapapeles. Env\u00edeselo al cliente.')
      loadContracts()
    } catch {
      toast.error('Error de conexi\u00f3n')
    }
  }

  async function handleCopyLink(token: string) {
    const url = `${window.location.origin}/contrato/${token}`
    await navigator.clipboard.writeText(url)
    toast.success('Enlace copiado al portapapeles')
  }

  // Opens WhatsApp with a pre-built message so Henry/Andriuw don't have to
  // paste the link and type anything. 1-click send on the client's device.
  function handleWhatsApp(contract: ContractRow) {
    const phone = (contract.client_phone || '').replace(/\D/g, '')
    if (!phone) {
      toast.error('Este contrato no tiene teléfono registrado')
      return
    }
    // Assume US numbers: if missing country code, prepend 1.
    const normalized = phone.length === 10 ? `1${phone}` : phone
    if (!contract.signing_token) {
      toast.error('El contrato aún no tiene enlace de firma')
      return
    }
    const url = `${window.location.origin}/contrato/${contract.signing_token}`
    const firstName = contract.client_full_name.split(' ')[0] || ''
    const message =
      `Hola ${firstName}, soy del equipo de Henry Orellana (UsaLatino Prime). ` +
      `Aquí está tu contrato para que lo revises y firmes digitalmente: ${url}\n\n` +
      `Cualquier pregunta respóndeme por aquí. ¡Gracias!`
    const waUrl = `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
    window.open(waUrl, '_blank', 'noopener,noreferrer')
    toast.success('Abriendo WhatsApp...')
  }

  async function handleDownloadPDF(contract: ContractRow) {
    try {
      const { generateContractPDF } = await import('@/lib/pdf/generate-contract-pdf')

      const pdf = generateContractPDF({
        serviceName: contract.service_name,
        totalPrice: contract.total_price,
        installments: contract.has_installments,
        installmentCount: contract.installment_count,
        clientFullName: contract.client_full_name,
        clientPassport: contract.client_passport,
        clientDOB: contract.client_dob,
        clientSignature: contract.client_signature,
        objetoDelContrato: contract.objeto_del_contrato,
        etapas: contract.etapas || [],
        addonServices: contract.addon_services?.length > 0 ? contract.addon_services : undefined,
        initialPayment: contract.initial_payment > 0 ? contract.initial_payment : undefined,
        paymentSchedule: contract.payment_schedule?.length > 0 ? contract.payment_schedule : undefined,
        minors: contract.minors?.length > 0 ? contract.minors : undefined,
        clientSignatureImage: contract.client_signature_image || undefined,
      })

      const arrayBuffer = pdf.output('arraybuffer')
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Contrato-${contract.service_slug}-${contract.client_full_name.replace(/\s+/g, '_')}.pdf`
      link.type = 'application/pdf'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(url), 1000)

      toast.success('PDF descargado')
    } catch (error: any) {
      toast.error(`Error al generar PDF: ${error.message}`)
    }
  }

  function handleEdit(contract: ContractRow) {
    setEditingContract(contract)
    setShowGenerator(true)
  }

  function handleNewContract() {
    setEditingContract(null)
    setShowGenerator(true)
  }

  function handleGeneratorDone() {
    setShowGenerator(false)
    setEditingContract(null)
    loadContracts()
  }

  // Vista del generador
  if (showGenerator) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => {
            setShowGenerator(false)
            setEditingContract(null)
            // Clear the ?prefill_* query params so re-entering doesn't
            // re-open the generator with stale data.
            if (prefillFromVoice) router.replace('/admin/contratos')
          }}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Volver a la lista
        </button>
        {prefillFromVoice && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 flex items-start gap-2">
            <svg className="w-5 h-5 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <div>
              <p className="font-semibold">Cliente proveniente de auto-agenda con la IA</p>
              <p className="text-rose-700 mt-0.5">
                Datos pre-cargados desde la llamada. Ajusta servicio, cuotas y monto, guarda y envía el link por WhatsApp.
              </p>
            </div>
          </div>
        )}
        <h1 className="text-2xl font-bold text-gray-900">
          {editingContract ? 'Editar Contrato' : 'Nuevo Contrato'}
        </h1>
        <QuickContractGenerator
          editData={editingContract}
          onSaved={handleGeneratorDone}
          prefillName={prefillFromVoice?.name}
          prefillPhone={prefillFromVoice?.phone}
          prefillService={prefillFromVoice ? 'visa-juvenil' : undefined}
        />
      </div>
    )
  }

  // Vista de lista
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Contratos</h1>
        <Button onClick={handleNewContract} className="bg-[#F2A900] hover:bg-[#D4940A] text-white">
          <Plus className="w-4 h-4 mr-1.5" />
          Nuevo Contrato
        </Button>
      </div>

      {/* Buscador */}
      {contracts.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente por nombre, servicio o pasaporte..."
            className="w-full pl-10 pr-4 h-11 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]/40 focus:border-[#F2A900]"
          />
          {search && (
            <p className="text-xs text-gray-400 mt-2">
              {filteredContracts.length} resultado{filteredContracts.length !== 1 ? 's' : ''} de {contracts.length}
            </p>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Cargando contratos...</p>
      ) : contracts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No hay contratos guardados a&uacute;n.</p>
            <Button onClick={handleNewContract} className="bg-[#F2A900] hover:bg-[#D4940A] text-white">
              <Plus className="w-4 h-4 mr-1.5" />
              Crear primer contrato
            </Button>
          </CardContent>
        </Card>
      ) : filteredContracts.length === 0 ? (
        <p className="text-center text-gray-400 py-8 text-sm">No se encontraron contratos con &quot;{search}&quot;.</p>
      ) : (
        <div className="space-y-3">
          {filteredContracts.map((c) => (
            <Card key={c.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-semibold text-sm text-gray-900">{c.client_full_name}</p>
                      <Badge className={statusColors[c.status] || 'bg-gray-100 text-gray-700'}>
                        {statusLabels[c.status] || c.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500">
                      {c.service_name}
                      {c.addon_services?.length > 0 && ` + ${c.addon_services.map((a: any) => a.name).join(' + ')}`}
                    </p>
                    <div className="flex items-center gap-4 mt-1 flex-wrap">
                      <span className="text-sm font-bold text-[#002855]">${Number(c.total_price).toLocaleString()} USD</span>
                      {c.has_installments && (
                        <span className="text-xs text-gray-400">
                          {c.initial_payment > 0 && `Inicial $${Number(c.initial_payment).toLocaleString()} + `}
                          {c.installment_count} cuotas
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {new Date(c.created_at).toLocaleDateString('es-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      {c.signed_at && (
                        <span className="text-xs text-green-600 font-medium">
                          Firmado {new Date(c.signed_at).toLocaleDateString('es-US', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Status quick change */}
                    <select
                      value={c.status}
                      onChange={(e) => handleStatusChange(c.id, e.target.value)}
                      className="h-8 text-xs rounded border border-gray-200 bg-white px-2 cursor-pointer"
                    >
                      <option value="borrador">Borrador</option>
                      <option value="pendiente_firma">Pendiente Firma</option>
                      <option value="firmado">Firmado</option>
                      <option value="activo">Activo</option>
                      <option value="completado">Completado</option>
                    </select>

                    {/* Send to client / Copy link / WhatsApp */}
                    {c.signing_token ? (
                      <>
                        <Button variant="outline" size="sm" onClick={() => handleCopyLink(c.signing_token!)} title="Copiar enlace de firma" className="text-amber-600 hover:text-amber-800 hover:bg-amber-50">
                          <Link2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleWhatsApp(c)} title="Enviar enlace por WhatsApp" className="text-green-600 hover:text-green-800 hover:bg-green-50">
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                          </svg>
                        </Button>
                      </>
                    ) : c.status === 'firmado' || c.status === 'activo' || c.status === 'completado' ? (
                      <Button variant="outline" size="sm" disabled title="Ya firmado" className="text-green-600">
                        <CheckCircle className="w-3.5 h-3.5" />
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => handleSendToClient(c)} title="Enviar al cliente para firmar" className="text-[#F2A900] hover:text-[#D4940A] hover:bg-amber-50">
                        <Send className="w-3.5 h-3.5" />
                      </Button>
                    )}

                    <Button variant="outline" size="sm" onClick={() => handleDownloadPDF(c)} title="Descargar PDF">
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(c)} title="Editar">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(c.id, c.client_full_name)} title="Eliminar" className="text-red-500 hover:text-red-700 hover:bg-red-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
