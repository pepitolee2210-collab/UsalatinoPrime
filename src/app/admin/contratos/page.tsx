'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { QuickContractGenerator } from '@/components/admin/QuickContractGenerator'
import { FileText, Plus, Pencil, Download, Trash2, ChevronLeft } from 'lucide-react'
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
}

const statusLabels: Record<string, string> = {
  borrador: 'Borrador',
  firmado: 'Firmado',
  activo: 'Activo',
  completado: 'Completado',
}

const statusColors: Record<string, string> = {
  borrador: 'bg-gray-100 text-gray-700',
  firmado: 'bg-blue-100 text-blue-800',
  activo: 'bg-green-100 text-green-800',
  completado: 'bg-emerald-100 text-emerald-800',
}

export default function ContratosPage() {
  const [contracts, setContracts] = useState<ContractRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editingContract, setEditingContract] = useState<ContractRow | null>(null)
  const [showGenerator, setShowGenerator] = useState(false)
  const supabase = createClient()

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
          onClick={() => { setShowGenerator(false); setEditingContract(null); }}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Volver a la lista
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {editingContract ? 'Editar Contrato' : 'Nuevo Contrato'}
        </h1>
        <QuickContractGenerator
          editData={editingContract}
          onSaved={handleGeneratorDone}
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
      ) : (
        <div className="space-y-3">
          {contracts.map((c) => (
            <Card key={c.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-sm text-gray-900 truncate">{c.client_full_name}</p>
                      <Badge className={statusColors[c.status] || 'bg-gray-100 text-gray-700'}>
                        {statusLabels[c.status] || c.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500">
                      {c.service_name}
                      {c.addon_services?.length > 0 && ` + ${c.addon_services.map((a: any) => a.name).join(' + ')}`}
                    </p>
                    <div className="flex items-center gap-4 mt-1">
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
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Status quick change */}
                    <select
                      value={c.status}
                      onChange={(e) => handleStatusChange(c.id, e.target.value)}
                      className="h-8 text-xs rounded border border-gray-200 bg-white px-2 cursor-pointer"
                    >
                      <option value="borrador">Borrador</option>
                      <option value="firmado">Firmado</option>
                      <option value="activo">Activo</option>
                      <option value="completado">Completado</option>
                    </select>

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
