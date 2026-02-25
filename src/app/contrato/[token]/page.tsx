import { createServiceClient } from '@/lib/supabase/service'
import { ContractHTMLViewer } from '@/components/shared/ContractHTMLViewer'
import { SigningForm } from './SigningForm'
import { FileText, CheckCircle, XCircle } from 'lucide-react'

export default async function ContractSigningPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = createServiceClient()

  const { data: contract, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('signing_token', token)
    .single()

  // Token not found
  if (error || !contract) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#002855] via-[#003366] to-[#001d3d] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-gray-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Enlace no v&aacute;lido</h1>
          <p className="text-sm text-gray-500">
            Este enlace de contrato no existe o ya fue utilizado.
            Contacte a su consultor para obtener un nuevo enlace.
          </p>
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 font-medium">UsaLatinoPrime</p>
            <p className="text-sm text-gray-500">Tel&eacute;fono: 801-941-3479</p>
          </div>
        </div>
      </div>
    )
  }

  // Already signed
  if (contract.status === 'firmado' || contract.status === 'activo' || contract.status === 'completado') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#002855] via-[#003366] to-[#001d3d] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Contrato ya firmado</h1>
          <p className="text-sm text-gray-500">
            Este contrato ya fue firmado el{' '}
            {contract.signed_at
              ? new Date(contract.signed_at).toLocaleDateString('es-US', { day: 'numeric', month: 'long', year: 'numeric' })
              : ''
            }.
          </p>
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 font-medium">UsaLatinoPrime</p>
            <p className="text-sm text-gray-500">Tel&eacute;fono: 801-941-3479</p>
          </div>
        </div>
      </div>
    )
  }

  // Show contract for signing
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#002855] via-[#003366] to-[#001d3d]">
      {/* Header */}
      <div className="bg-[#002855]/80 backdrop-blur border-b border-white/10 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#F2A900]/20 flex items-center justify-center">
            <FileText className="w-4 h-4 text-[#F2A900]" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">UsaLatinoPrime</p>
            <p className="text-white/60 text-xs">Contrato de Prestaci&oacute;n de Servicios</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Contract content */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8">
          <ContractHTMLViewer contract={contract} />
        </div>

        {/* Signing section */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8">
          <SigningForm
            token={token}
            clientName={contract.client_full_name}
            contractData={contract}
          />
        </div>
      </div>
    </div>
  )
}
