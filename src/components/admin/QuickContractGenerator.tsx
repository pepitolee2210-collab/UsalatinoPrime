'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { getInstallmentCount } from '@/lib/contracts'
import {
  FileText, PenLine, Download, Plus, X, ChevronDown,
  User, Stamp, Calendar, Baby, PackagePlus, DollarSign, Hash, CalendarClock, Save,
} from 'lucide-react'

interface MinorData {
  fullName: string
  dob: string
  birthplace: string
  passport: string
}

interface AddonItem {
  slug: string
  label: string
  price: number
}

interface ContractForm {
  clientFullName: string
  clientPassport: string
  clientDOB: string
  clientSignature: string
}

const SERVICE_OPTIONS = [
  { slug: 'asilo-afirmativo', label: 'Asilo Afirmativo' },
  { slug: 'asilo-defensivo', label: 'Asilo Defensivo' },
  { slug: 'ajuste-de-estatus', label: 'Ajuste de Estatus' },
  { slug: 'visa-juvenil', label: 'Visa Juvenil (SIJS)' },
  { slug: 'cambio-de-estatus', label: 'Cambio de Estatus' },
  { slug: 'cambio-de-corte', label: 'Cambio de Corte' },
  { slug: 'mociones', label: 'Mociones' },
  { slug: 'itin-number', label: 'ITIN Number' },
  { slug: 'adelantos', label: 'Adelantos (Advance Parole)' },
  { slug: 'licencia-de-conducir', label: 'Licencia de Conducir' },
  { slug: 'taxes', label: 'Declaraci\u00f3n de Impuestos' },
]

interface QuickContractGeneratorProps {
  editData?: any | null
  onSaved?: () => void
}

const emptyMinor = (): MinorData => ({ fullName: '', dob: '', birthplace: '', passport: '' })

export function QuickContractGenerator({ editData, onSaved }: QuickContractGeneratorProps) {
  const supabase = createClient()
  const [selectedSlug, setSelectedSlug] = useState('')
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0)
  const [contractForm, setContractForm] = useState<ContractForm>({
    clientFullName: '',
    clientPassport: '',
    clientDOB: '',
    clientSignature: '',
  })
  const [minors, setMinors] = useState<MinorData[]>([emptyMinor()])
  const [generating, setGenerating] = useState(false)
  const [template, setTemplate] = useState<any>(null)

  // Servicios adicionales
  const [addons, setAddons] = useState<AddonItem[]>([])
  const [showAddonSelector, setShowAddonSelector] = useState(false)

  // Precio y cuotas personalizables
  const [customPrice, setCustomPrice] = useState<string>('')
  const [customInstallments, setCustomInstallments] = useState<string>('')
  const [useCustomPrice, setUseCustomPrice] = useState(false)
  const [useCustomInstallments, setUseCustomInstallments] = useState(false)

  // Cuota inicial y fecha de inicio
  const [initialPayment, setInitialPayment] = useState<string>('')
  const [contractStartDate, setContractStartDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )
  const [customMonthlyAmount, setCustomMonthlyAmount] = useState<string>('')
  const [useCustomMonthly, setUseCustomMonthly] = useState(false)

  // Cargar datos cuando se edita un contrato existente
  useEffect(() => {
    if (!editData) return
    async function loadEditData() {
      const { getContractTemplate } = await import('@/lib/contracts/index')
      const t = getContractTemplate(editData.service_slug)
      setTemplate(t)
      setSelectedSlug(editData.service_slug)
      setSelectedVariantIndex(editData.variant_index || 0)
      setContractForm({
        clientFullName: editData.client_full_name || '',
        clientPassport: editData.client_passport || '',
        clientDOB: editData.client_dob || '',
        clientSignature: editData.client_signature || '',
      })
      setMinors(
        editData.minors?.length > 0
          ? editData.minors.map((m: any) => ({
              fullName: m.fullName || m.full_name || '',
              dob: m.dob || '',
              birthplace: m.birthplace || '',
              passport: m.passport || '',
            }))
          : [emptyMinor()]
      )
      setAddons(
        editData.addon_services?.length > 0
          ? editData.addon_services.map((a: any) => ({
              slug: a.slug || '',
              label: a.name || a.label || '',
              price: a.price || 0,
            }))
          : []
      )
      setUseCustomPrice(editData.use_custom_price || false)
      setCustomPrice(editData.use_custom_price ? String(editData.total_price) : '')
      setUseCustomInstallments(editData.use_custom_installments || false)
      setCustomInstallments(editData.use_custom_installments ? String(editData.installment_count) : '')
      setInitialPayment(editData.initial_payment > 0 ? String(editData.initial_payment) : '')
      setContractStartDate(editData.contract_start_date || new Date().toISOString().split('T')[0])
      setUseCustomMonthly(editData.use_custom_monthly || false)
      setCustomMonthlyAmount(editData.use_custom_monthly ? String(editData.monthly_amount) : '')
    }
    loadEditData()
  }, [editData])

  async function handleServiceChange(slug: string) {
    setSelectedSlug(slug)
    setSelectedVariantIndex(0)
    setUseCustomPrice(false)
    setCustomPrice('')
    setUseCustomInstallments(false)
    setCustomInstallments('')
    setInitialPayment('')
    setCustomMonthlyAmount('')
    setUseCustomMonthly(false)
    if (!slug) {
      setTemplate(null)
      return
    }
    const { getContractTemplate } = await import('@/lib/contracts/index')
    const t = getContractTemplate(slug)
    setTemplate(t)
    if (t?.requiresMinor && minors.length === 0) {
      setMinors([emptyMinor()])
    }
  }

  function addAddon(slug: string) {
    const svc = SERVICE_OPTIONS.find(s => s.slug === slug)
    if (!svc) return
    import('@/lib/contracts/index').then(({ getContractTemplate }) => {
      const t = getContractTemplate(slug)
      const price = t?.variants[0]?.totalPrice || 0
      setAddons(prev => [...prev, { slug, label: svc.label, price }])
      setShowAddonSelector(false)
    })
  }

  function removeAddon(index: number) {
    setAddons(prev => prev.filter((_, i) => i !== index))
  }

  function updateAddonPrice(index: number, price: number) {
    setAddons(prev => prev.map((a, i) => i === index ? { ...a, price } : a))
  }

  // Calcular precio total (servicio principal + addons)
  function getCalculatedTotal(): number {
    if (!template) return 0
    const variant = template.variants[selectedVariantIndex]
    const basePrice = variant.totalPrice
    const addonsTotal = addons.reduce((sum: number, a: AddonItem) => sum + a.price, 0)
    return basePrice + addonsTotal
  }

  // Precio final (custom o calculado)
  function getFinalPrice(): number {
    if (useCustomPrice && customPrice) return parseFloat(customPrice)
    return getCalculatedTotal()
  }

  // Cuota inicial
  function getInitialPayment(): number {
    return parseFloat(initialPayment) || 0
  }

  // Saldo restante después de cuota inicial
  function getRemainingBalance(): number {
    return getFinalPrice() - getInitialPayment()
  }

  // Cuotas finales
  function getFinalInstallments(): number {
    if (useCustomMonthly && customMonthlyAmount) {
      const monthly = parseFloat(customMonthlyAmount)
      if (monthly > 0) return Math.ceil(getRemainingBalance() / monthly)
    }
    if (useCustomInstallments && customInstallments) return parseInt(customInstallments)
    if (!template) return 10
    return getInstallmentCount(template.variants[selectedVariantIndex])
  }

  // Monto mensual final
  function getFinalMonthly(): number {
    if (useCustomMonthly && customMonthlyAmount) return parseFloat(customMonthlyAmount) || 0
    const installments = getFinalInstallments()
    if (installments <= 0) return 0
    return Math.round(getRemainingBalance() / installments)
  }

  function updateMinor(index: number, field: keyof MinorData, value: string) {
    setMinors(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m))
  }

  function addMinor() {
    setMinors(prev => [...prev, emptyMinor()])
  }

  function removeMinor(index: number) {
    setMinors(prev => prev.filter((_, i) => i !== index))
  }

  // Generar cronograma de pagos
  function buildPaymentSchedule(): { number: number; date: string; amount: number }[] {
    const schedule: { number: number; date: string; amount: number }[] = []
    const startDate = new Date(contractStartDate + 'T12:00:00')
    const numInstallments = getFinalInstallments()
    const monthly = getFinalMonthly()
    const remaining = getRemainingBalance()
    const initial = getInitialPayment()

    if (initial > 0) {
      schedule.push({ number: 0, date: contractStartDate, amount: initial })
    }

    for (let i = 0; i < numInstallments; i++) {
      const payDate = new Date(startDate)
      payDate.setMonth(payDate.getMonth() + i + (initial > 0 ? 1 : 0))
      const dateStr = `${payDate.getFullYear()}-${String(payDate.getMonth() + 1).padStart(2, '0')}-${String(payDate.getDate()).padStart(2, '0')}`

      // La última cuota ajusta el saldo restante
      const isLast = i === numInstallments - 1
      const prevPaid = monthly * i
      const thisAmount = isLast ? remaining - prevPaid : monthly

      schedule.push({ number: i + 1, date: dateStr, amount: thisAmount })
    }

    return schedule
  }

  async function handleGenerate() {
    if (!template || !selectedSlug) {
      toast.error('Seleccione un servicio')
      return
    }
    if (!contractForm.clientFullName.trim()) {
      toast.error('Ingrese el nombre del cliente')
      return
    }
    if (!contractForm.clientPassport.trim()) {
      toast.error('Ingrese el pasaporte del cliente')
      return
    }
    if (!contractForm.clientDOB) {
      toast.error('Ingrese la fecha de nacimiento')
      return
    }
    if (template.requiresMinor && minors.some(m => !m.fullName.trim())) {
      toast.error('Ingrese el nombre de todos los menores')
      return
    }

    setGenerating(true)
    try {
      const { generateContractPDF } = await import('@/lib/pdf/generate-contract-pdf')
      const { getServiceEtapas } = await import('@/lib/contracts/index')
      const serviceLabel = SERVICE_OPTIONS.find(s => s.slug === selectedSlug)?.label || selectedSlug

      const finalPrice = getFinalPrice()
      const hasInstallments = template.installments || useCustomInstallments || useCustomMonthly
      const paymentSchedule = hasInstallments ? buildPaymentSchedule() : undefined

      // Preparar servicios adicionales para el PDF
      const addonServices = addons.map(a => ({
        name: a.label,
        price: a.price,
        slug: a.slug,
        etapas: getServiceEtapas(a.slug),
      }))

      // Guardar en Supabase
      const contractData = {
        service_slug: selectedSlug,
        service_name: serviceLabel,
        variant_index: selectedVariantIndex,
        addon_services: addonServices,
        client_full_name: contractForm.clientFullName.trim(),
        client_passport: contractForm.clientPassport.trim(),
        client_dob: contractForm.clientDOB,
        client_signature: contractForm.clientSignature.trim(),
        minors: template.requiresMinor
          ? minors.map(m => ({
              fullName: m.fullName.trim(),
              dob: m.dob,
              birthplace: m.birthplace.trim(),
              passport: m.passport.trim(),
            }))
          : [],
        total_price: finalPrice,
        initial_payment: getInitialPayment(),
        installment_count: getFinalInstallments(),
        monthly_amount: getFinalMonthly(),
        use_custom_monthly: useCustomMonthly,
        contract_start_date: contractStartDate,
        has_installments: hasInstallments,
        use_custom_price: useCustomPrice,
        use_custom_installments: useCustomInstallments,
        payment_schedule: paymentSchedule || [],
        objeto_del_contrato: template.objetoDelContrato,
        etapas: template.etapas,
      }

      if (editData?.id) {
        const { error } = await supabase
          .from('contracts')
          .update(contractData)
          .eq('id', editData.id)
        if (error) {
          console.error('Error updating contract:', error)
          toast.error('Error al actualizar el contrato')
          return
        }
        toast.success('Contrato actualizado')
      } else {
        const { error } = await supabase
          .from('contracts')
          .insert(contractData)
        if (error) {
          console.error('Error saving contract:', error)
          toast.error('Error al guardar el contrato')
          return
        }
        toast.success('Contrato guardado')
      }

      const pdf = generateContractPDF({
        serviceName: serviceLabel,
        totalPrice: finalPrice,
        installments: hasInstallments,
        installmentCount: getFinalInstallments(),
        clientFullName: contractForm.clientFullName.trim(),
        clientPassport: contractForm.clientPassport.trim(),
        clientDOB: contractForm.clientDOB,
        clientSignature: contractForm.clientSignature.trim(),
        objetoDelContrato: template.objetoDelContrato,
        etapas: template.etapas,
        addonServices: addonServices.length > 0 ? addonServices : undefined,
        initialPayment: getInitialPayment() > 0 ? getInitialPayment() : undefined,
        paymentSchedule,
        ...(template.requiresMinor && {
          minors: minors.map(m => ({
            fullName: m.fullName.trim(),
            dob: m.dob,
            birthplace: m.birthplace.trim(),
            passport: m.passport.trim(),
          })),
        }),
      })

      const arrayBuffer = pdf.output('arraybuffer')
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Contrato-${selectedSlug}-${contractForm.clientFullName.replace(/\s+/g, '_')}.pdf`
      link.type = 'application/pdf'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(url), 1000)

      onSaved?.()
    } catch (error: any) {
      console.error('PDF generation error:', error)
      toast.error(`Error al generar el PDF: ${error.message}`)
    } finally {
      setGenerating(false)
    }
  }

  function handleReset() {
    setSelectedSlug('')
    setSelectedVariantIndex(0)
    setTemplate(null)
    setContractForm({ clientFullName: '', clientPassport: '', clientDOB: '', clientSignature: '' })
    setMinors([emptyMinor()])
    setAddons([])
    setShowAddonSelector(false)
    setCustomPrice('')
    setCustomInstallments('')
    setUseCustomPrice(false)
    setUseCustomInstallments(false)
    setInitialPayment('')
    setContractStartDate(new Date().toISOString().split('T')[0])
    setCustomMonthlyAmount('')
    setUseCustomMonthly(false)
  }

  const hasInstallments = template && (template.installments || useCustomInstallments || useCustomMonthly)

  return (
    <Card className="border-[#F2A900]/30 bg-gradient-to-br from-white to-[#FFFBF0]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-[#002855]">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#F2A900]/10">
            <FileText className="w-4 h-4 text-[#F2A900]" />
          </div>
          Generar Contrato R&aacute;pido
        </CardTitle>
        <p className="text-sm text-gray-500">
          Genere un contrato PDF sin necesidad de crear una cuenta de cliente
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Service selector */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-[#002855]">
            Servicio <span className="text-[#F2A900]">*</span>
          </Label>
          <div className="relative">
            <select
              value={selectedSlug}
              onChange={(e) => handleServiceChange(e.target.value)}
              className="w-full h-11 rounded-lg border border-gray-200 bg-white px-3 pr-10 text-sm focus:border-[#002855] focus:ring-1 focus:ring-[#002855]/20 appearance-none cursor-pointer"
            >
              <option value="">Seleccione un servicio...</option>
              {SERVICE_OPTIONS.map(s => (
                <option key={s.slug} value={s.slug}>{s.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Variant selector (if multiple) */}
        {template && template.variants.length > 1 && (
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-[#002855]">Variante</Label>
            <div className="flex gap-2">
              {template.variants.map((v: any, i: number) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => { setSelectedVariantIndex(i); setUseCustomPrice(false); setCustomPrice(''); }}
                  className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    selectedVariantIndex === i
                      ? 'border-[#002855] bg-[#002855] text-white'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {v.label} — ${v.totalPrice.toLocaleString()}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* === SERVICIOS ADICIONALES === */}
        {template && (
          <div className="space-y-2">
            {addons.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#002855] flex items-center gap-1.5">
                  <PackagePlus className="w-3.5 h-3.5 text-[#F2A900]" />
                  Servicios Adicionales
                </Label>
                {addons.map((addon, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#F2A900]/20 bg-[#FFFBF0]">
                    <span className="flex-1 text-sm text-[#002855]">{addon.label}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">$</span>
                      <input
                        type="number"
                        value={addon.price}
                        onChange={(e) => updateAddonPrice(i, parseFloat(e.target.value) || 0)}
                        className="w-20 h-7 text-sm text-right rounded border border-gray-200 px-2"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAddon(i)}
                      className="flex items-center justify-center w-6 h-6 rounded border border-red-200 bg-white text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {showAddonSelector ? (
              <div className="space-y-1.5">
                <div className="relative">
                  <select
                    onChange={(e) => { if (e.target.value) addAddon(e.target.value); }}
                    className="w-full h-9 rounded-lg border border-[#F2A900]/30 bg-[#FFFBF0] px-3 pr-10 text-sm appearance-none cursor-pointer"
                    defaultValue=""
                  >
                    <option value="">Seleccione servicio adicional...</option>
                    {SERVICE_OPTIONS.filter(s => s.slug !== selectedSlug && !addons.some(a => a.slug === s.slug)).map(s => (
                      <option key={s.slug} value={s.slug}>{s.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
                <button type="button" onClick={() => setShowAddonSelector(false)} className="text-xs text-gray-400 hover:text-gray-600">
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddonSelector(true)}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-[#F2A900]/30 hover:border-[#F2A900] bg-[#FFFBF0] hover:bg-[#FFF8E1] px-3 py-2 text-xs font-medium text-[#002855]/60 hover:text-[#002855] transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar Servicio Adicional
              </button>
            )}
          </div>
        )}

        {/* === PLAN FINANCIERO === */}
        {template && (
          <div className="space-y-3 rounded-lg border border-[#002855]/10 bg-[#002855]/5 p-3">
            <p className="text-xs font-bold text-[#002855] uppercase tracking-wide">Plan Financiero</p>

            {/* Desglose de servicios */}
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-[#002855]/70">{SERVICE_OPTIONS.find(s => s.slug === selectedSlug)?.label}:</span>
                <span className="font-medium text-[#002855]">${template.variants[selectedVariantIndex].totalPrice.toLocaleString()}</span>
              </div>
              {addons.map((a, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-[#002855]/70">{a.label}:</span>
                  <span className="font-medium text-[#002855]">${a.price.toLocaleString()}</span>
                </div>
              ))}
            </div>

            {/* Precio personalizado */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="customPrice"
                checked={useCustomPrice}
                onChange={(e) => { setUseCustomPrice(e.target.checked); if (!e.target.checked) setCustomPrice(''); }}
                className="rounded border-gray-300"
              />
              <label htmlFor="customPrice" className="text-xs text-[#002855]/70 flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                Precio total personalizado
              </label>
              {useCustomPrice && (
                <input
                  type="number"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  placeholder={getCalculatedTotal().toString()}
                  className="w-24 h-7 text-sm text-right rounded border border-[#002855]/20 px-2"
                />
              )}
            </div>

            {/* Total */}
            <div className="border-t border-[#002855]/20 pt-2 flex justify-between items-center">
              <span className="text-sm font-bold text-[#002855]">Total del contrato:</span>
              <span className="text-lg font-bold text-[#002855]">${getFinalPrice().toLocaleString()} USD</span>
            </div>

            {/* Fecha de inicio */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-[#002855]/70 flex items-center gap-1">
                  <CalendarClock className="w-3 h-3" />
                  Fecha de inicio del contrato
                </label>
                <Input
                  type="date"
                  value={contractStartDate}
                  onChange={(e) => setContractStartDate(e.target.value)}
                  className="h-8 text-sm rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[#002855]/70 flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  Cuota inicial (enganche)
                </label>
                <Input
                  type="number"
                  value={initialPayment}
                  onChange={(e) => setInitialPayment(e.target.value)}
                  placeholder="0"
                  min="0"
                  className="h-8 text-sm rounded-lg"
                />
              </div>
            </div>

            {/* Saldo restante */}
            {getInitialPayment() > 0 && (
              <div className="flex justify-between text-sm px-1">
                <span className="text-[#002855]/70">Saldo restante:</span>
                <span className="font-bold text-[#002855]">${getRemainingBalance().toLocaleString()} USD</span>
              </div>
            )}

            {/* Opciones de cuotas */}
            <div className="space-y-2 border-t border-[#002855]/10 pt-2">
              <p className="text-xs font-semibold text-[#002855]/70">Configurar cuotas mensuales:</p>

              {/* Opción 1: Número de cuotas */}
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="byInstallments"
                  name="paymentMode"
                  checked={!useCustomMonthly}
                  onChange={() => { setUseCustomMonthly(false); setCustomMonthlyAmount(''); }}
                  className="border-gray-300"
                />
                <label htmlFor="byInstallments" className="text-xs text-[#002855]/70 flex items-center gap-1">
                  <Hash className="w-3 h-3" />
                  Por n&uacute;mero de cuotas
                </label>
                {!useCustomMonthly && (
                  <input
                    type="number"
                    value={useCustomInstallments ? customInstallments : (template ? getInstallmentCount(template.variants[selectedVariantIndex]).toString() : '10')}
                    onChange={(e) => { setUseCustomInstallments(true); setCustomInstallments(e.target.value); }}
                    min="1"
                    max="36"
                    className="w-16 h-7 text-sm text-center rounded border border-[#002855]/20 px-2"
                  />
                )}
                {!useCustomMonthly && (
                  <span className="text-xs text-gray-500">= ${getFinalMonthly().toLocaleString()}/mes</span>
                )}
              </div>

              {/* Opción 2: Monto mensual fijo */}
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="byMonthly"
                  name="paymentMode"
                  checked={useCustomMonthly}
                  onChange={() => setUseCustomMonthly(true)}
                  className="border-gray-300"
                />
                <label htmlFor="byMonthly" className="text-xs text-[#002855]/70 flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  Por monto mensual fijo
                </label>
                {useCustomMonthly && (
                  <>
                    <input
                      type="number"
                      value={customMonthlyAmount}
                      onChange={(e) => setCustomMonthlyAmount(e.target.value)}
                      placeholder="250"
                      min="1"
                      className="w-20 h-7 text-sm text-right rounded border border-[#002855]/20 px-2"
                    />
                    {customMonthlyAmount && parseFloat(customMonthlyAmount) > 0 && (
                      <span className="text-xs text-gray-500">= {getFinalInstallments()} cuotas</span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Preview cronograma */}
            {hasInstallments && getFinalInstallments() > 0 && (
              <div className="border-t border-[#002855]/10 pt-2">
                <p className="text-xs font-semibold text-[#002855]/70 mb-1">Cronograma de pagos:</p>
                <div className="max-h-40 overflow-y-auto space-y-0.5">
                  {buildPaymentSchedule().map((p) => (
                    <div key={p.number} className="flex justify-between text-xs px-1 py-0.5 rounded hover:bg-[#002855]/5">
                      <span className="text-[#002855]/60">
                        {p.number === 0 ? 'Cuota inicial' : `Cuota ${p.number}`} — {new Date(p.date + 'T12:00:00').toLocaleDateString('es-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="font-medium text-[#002855]">${p.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Show form only when service is selected */}
        {template && (
          <>
            {/* Client info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-[#002855] flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-gray-400" />
                  Nombre completo <span className="text-[#F2A900]">*</span>
                </Label>
                <Input
                  placeholder="Nombre y apellidos"
                  value={contractForm.clientFullName}
                  onChange={(e) => setContractForm({ ...contractForm, clientFullName: e.target.value })}
                  className="h-10 rounded-lg"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-[#002855] flex items-center gap-1.5">
                  <Stamp className="w-3.5 h-3.5 text-gray-400" />
                  Pasaporte <span className="text-[#F2A900]">*</span>
                </Label>
                <Input
                  placeholder="Ej: A12345678"
                  value={contractForm.clientPassport}
                  onChange={(e) => setContractForm({ ...contractForm, clientPassport: e.target.value })}
                  className="h-10 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-[#002855] flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  Fecha de nacimiento <span className="text-[#F2A900]">*</span>
                </Label>
                <Input
                  type="date"
                  value={contractForm.clientDOB}
                  onChange={(e) => setContractForm({ ...contractForm, clientDOB: e.target.value })}
                  className="h-10 rounded-lg"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-[#002855] flex items-center gap-1.5">
                  <PenLine className="w-3.5 h-3.5 text-gray-400" />
                  Firma (nombre completo)
                </Label>
                <Input
                  placeholder="Escriba el nombre como firma"
                  value={contractForm.clientSignature}
                  onChange={(e) => setContractForm({ ...contractForm, clientSignature: e.target.value })}
                  className="h-10 rounded-lg font-serif italic"
                />
              </div>
            </div>

            {/* Minors section */}
            {template.requiresMinor && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <Baby className="w-4 h-4 text-[#002855]/50" />
                  <span className="text-sm font-semibold text-[#002855]/70">Menores Beneficiarios</span>
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#002855] text-white text-[10px] font-bold">
                    {minors.length}
                  </span>
                </div>

                {minors.map((minor, index) => (
                  <div key={index} className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-[#002855]">Hijo/a #{index + 1}</p>
                      {minors.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeMinor(index)}
                          className="flex items-center justify-center w-6 h-6 rounded border border-red-200 bg-white text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input placeholder="Nombre completo del menor *" value={minor.fullName} onChange={(e) => updateMinor(index, 'fullName', e.target.value)} className="h-9 rounded-lg text-sm bg-white" />
                      <Input type="date" placeholder="Fecha de nacimiento" value={minor.dob} onChange={(e) => updateMinor(index, 'dob', e.target.value)} className="h-9 rounded-lg text-sm bg-white" />
                      <Input placeholder="Lugar de nacimiento" value={minor.birthplace} onChange={(e) => updateMinor(index, 'birthplace', e.target.value)} className="h-9 rounded-lg text-sm bg-white" />
                      <Input placeholder="Pasaporte del menor" value={minor.passport} onChange={(e) => updateMinor(index, 'passport', e.target.value)} className="h-9 rounded-lg text-sm bg-white" />
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addMinor}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-[#F2A900]/30 hover:border-[#F2A900] bg-[#FFFBF0] hover:bg-[#FFF8E1] px-3 py-2 text-xs font-medium text-[#002855]/60 hover:text-[#002855] transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar otro hijo/a
                </button>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleGenerate}
                disabled={generating}
                className="flex-1 bg-[#F2A900] hover:bg-[#D4940A] text-white font-semibold h-11 rounded-lg"
              >
                {generating ? 'Guardando...' : (
                  <>
                    <Save className="w-4 h-4 mr-1.5" />
                    {editData ? 'Guardar y Descargar PDF' : 'Guardar y Descargar PDF'}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                className="h-11 rounded-lg"
              >
                Limpiar
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
