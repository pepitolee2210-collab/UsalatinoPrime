'use client'

import { useState } from 'react'
import { SignatureCanvas } from '@/components/shared/SignatureCanvas'
import { CheckCircle, Download, Loader2, PenLine } from 'lucide-react'
import { toast } from 'sonner'

interface SigningFormProps {
  token: string
  clientName: string
  contractData: any
}

export function SigningForm({ token, clientName, contractData }: SigningFormProps) {
  const [signatureImage, setSignatureImage] = useState<string | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [signed, setSigned] = useState(false)
  const [downloading, setDownloading] = useState(false)

  async function handleSign() {
    if (!signatureImage) {
      toast.error('Debe firmar el contrato antes de enviar')
      return
    }
    if (!accepted) {
      toast.error('Debe aceptar los t\u00e9rminos del contrato')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/contracts/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, signature_image: signatureImage }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Error al firmar el contrato')
        return
      }

      setSigned(true)
      toast.success('Contrato firmado exitosamente')
    } catch {
      toast.error('Error de conexi\u00f3n. Intente de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDownloadPDF() {
    setDownloading(true)
    try {
      const { generateContractPDF } = await import('@/lib/pdf/generate-contract-pdf')

      const pdf = generateContractPDF({
        serviceName: contractData.service_name,
        totalPrice: contractData.total_price,
        installments: contractData.has_installments,
        installmentCount: contractData.installment_count,
        clientFullName: contractData.client_full_name,
        clientPassport: contractData.client_passport,
        clientDOB: contractData.client_dob,
        clientSignature: contractData.client_signature || contractData.client_full_name,
        objetoDelContrato: contractData.objeto_del_contrato,
        etapas: contractData.etapas || [],
        addonServices: contractData.addon_services?.length > 0 ? contractData.addon_services : undefined,
        initialPayment: contractData.initial_payment > 0 ? contractData.initial_payment : undefined,
        paymentSchedule: contractData.payment_schedule?.length > 0 ? contractData.payment_schedule : undefined,
        minors: contractData.minors?.length > 0 ? contractData.minors : undefined,
        clientSignatureImage: signatureImage || undefined,
      })

      const arrayBuffer = pdf.output('arraybuffer')
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Contrato-${contractData.client_full_name.replace(/\s+/g, '_')}.pdf`
      link.type = 'application/pdf'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(url), 1000)

      toast.success('PDF descargado')
    } catch (error: any) {
      toast.error(`Error al generar PDF: ${error.message}`)
    } finally {
      setDownloading(false)
    }
  }

  if (signed) {
    return (
      <div className="text-center py-8">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          &iexcl;Contrato Firmado!
        </h2>
        <p className="text-gray-500 mb-1">
          Su contrato ha sido firmado exitosamente.
        </p>
        <p className="text-gray-500 text-sm mb-6">
          Un consultor de UsaLatinoPrime se comunicar&aacute; con usted para los siguientes pasos.
        </p>

        <button
          onClick={handleDownloadPDF}
          disabled={downloading}
          className="w-full py-3.5 rounded-xl font-semibold text-white transition-all disabled:opacity-50 bg-[#002855] hover:bg-[#001d3d] active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {downloading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generando PDF...
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              Descargar Contrato Firmado (PDF)
            </>
          )}
        </button>

        <div className="mt-6 p-4 bg-[#002855]/5 rounded-xl">
          <p className="text-sm font-semibold text-[#002855]">UsaLatinoPrime</p>
          <p className="text-sm text-gray-500">Tel&eacute;fono / Zelle: 801-941-3479</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#002855] flex items-center gap-2 mb-1">
          <PenLine className="w-5 h-5 text-[#F2A900]" />
          Firma del Cliente
        </h2>
        <p className="text-sm text-gray-500">
          {clientName}, firme con su dedo o mouse en el recuadro de abajo.
        </p>
      </div>

      <SignatureCanvas onSignatureChange={setSignatureImage} />

      <label className="flex items-start gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 rounded border-gray-300 text-[#002855] focus:ring-[#002855]"
        />
        <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">
          He le&iacute;do y acepto los t&eacute;rminos y condiciones de este contrato de prestaci&oacute;n de servicios.
          Declaro que la informaci&oacute;n proporcionada es verdadera y correcta.
        </span>
      </label>

      <button
        onClick={handleSign}
        disabled={submitting || !signatureImage || !accepted}
        className="w-full py-3.5 rounded-xl font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-[#F2A900] hover:bg-[#D4940A] active:scale-[0.98]"
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Firmando...
          </span>
        ) : (
          'Firmar Contrato'
        )}
      </button>
    </div>
  )
}
