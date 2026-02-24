'use client'

import { useState, useRef } from 'react'
import { CreditCard, Upload, CheckCircle, Loader2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import Link from 'next/link'

export default function PagarPage() {
  const [method, setMethod] = useState<'stripe' | 'zelle' | null>(null)
  const [loading, setLoading] = useState(false)
  const [zelleSent, setZelleSent] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleStripe() {
    setLoading(true)
    try {
      const res = await fetch('/api/community/create-subscription', { method: 'POST' })
      const data = await res.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error(data.error || 'Error al crear la suscripción')
        setLoading(false)
      }
    } catch {
      toast.error('Error de conexión')
      setLoading(false)
    }
  }

  async function handleZelleSubmit() {
    const file = fileRef.current?.files?.[0]
    if (!file) {
      toast.error('Debe subir el comprobante de pago')
      return
    }

    setLoading(true)
    const formData = new FormData()
    formData.append('screenshot', file)

    try {
      const res = await fetch('/api/community/zelle-submit', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        setZelleSent(true)
        toast.success('Comprobante enviado correctamente')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Error al enviar comprobante')
      }
    } catch {
      toast.error('Error de conexión')
    }
    setLoading(false)
  }

  if (zelleSent) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-[#002855] mb-2">
          ¡Comprobante Enviado!
        </h2>
        <p className="text-gray-600 mb-6 max-w-sm mx-auto">
          Estamos revisando su pago. Recibirá una notificación cuando sea aprobado.
          Esto normalmente toma menos de 24 horas.
        </p>
        <Link
          href="/comunidad"
          className="inline-flex items-center gap-2 text-[#F2A900] font-medium hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a la comunidad
        </Link>
      </div>
    )
  }

  // Method selection
  if (!method) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-[#002855] mb-2">
            Activar Membresía
          </h2>
          <p className="text-gray-500">
            Elija su método de pago preferido
          </p>
        </div>

        {/* Price card */}
        <div className="bg-white rounded-2xl border-2 border-[#F2A900]/30 p-5 text-center">
          <p className="text-4xl font-bold text-[#002855]">$25</p>
          <p className="text-gray-500">/mes</p>
          <div className="w-12 h-0.5 bg-[#F2A900] mx-auto my-3" />
          <p className="text-sm text-gray-600">
            Acceso completo a sesiones en vivo, videos, y toda la comunidad
          </p>
        </div>

        {/* Payment methods */}
        <div className="space-y-3">
          <button
            onClick={() => setMethod('stripe')}
            className="w-full flex items-center gap-4 p-5 bg-white rounded-2xl border-2 hover:border-[#F2A900]/50 transition-colors text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-lg">Tarjeta de Crédito/Débito</p>
              <p className="text-sm text-gray-500">Pago automático mensual con Stripe</p>
            </div>
          </button>

          <button
            onClick={() => setMethod('zelle')}
            className="w-full flex items-center gap-4 p-5 bg-white rounded-2xl border-2 hover:border-[#F2A900]/50 transition-colors text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">💸</span>
            </div>
            <div>
              <p className="font-bold text-gray-900 text-lg">Zelle</p>
              <p className="text-sm text-gray-500">Transferencia directa + comprobante</p>
            </div>
          </button>
        </div>

        <Link
          href="/comunidad"
          className="flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a la comunidad
        </Link>
      </div>
    )
  }

  // Stripe
  if (method === 'stripe') {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setMethod(null)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Cambiar método de pago
        </button>

        <div className="text-center">
          <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
            <CreditCard className="w-7 h-7 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-[#002855] mb-2">
            Pago con Tarjeta
          </h2>
          <p className="text-gray-500 mb-6">
            Se le cobrará $25/mes automáticamente. Puede cancelar en cualquier momento.
          </p>
          <Button
            onClick={handleStripe}
            disabled={loading}
            className="w-full h-14 text-lg bg-[#F2A900] hover:bg-[#D4940A] text-white font-bold rounded-xl"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Pagar $25/mes con Tarjeta'
            )}
          </Button>
          <p className="text-xs text-gray-400 mt-3">
            Procesado de forma segura por Stripe
          </p>
        </div>
      </div>
    )
  }

  // Zelle
  return (
    <div className="space-y-6">
      <button
        onClick={() => setMethod(null)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="w-4 h-4" />
        Cambiar método de pago
      </button>

      <div className="text-center">
        <span className="text-4xl block mb-3">💸</span>
        <h2 className="text-xl font-bold text-[#002855] mb-2">
          Pago con Zelle
        </h2>
      </div>

      {/* Instructions */}
      <div className="bg-white rounded-2xl border p-5 space-y-4">
        <h3 className="font-bold text-[#002855]">Instrucciones:</h3>
        <ol className="space-y-3 text-gray-700">
          <li className="flex gap-3">
            <span className="w-7 h-7 rounded-full bg-[#F2A900]/20 text-[#002855] font-bold text-sm flex items-center justify-center flex-shrink-0">1</span>
            <span>Abra su aplicación de Zelle en su banco</span>
          </li>
          <li className="flex gap-3">
            <span className="w-7 h-7 rounded-full bg-[#F2A900]/20 text-[#002855] font-bold text-sm flex items-center justify-center flex-shrink-0">2</span>
            <span>Envíe <strong>$25.00</strong> a este número o correo:</span>
          </li>
        </ol>
        <div className="bg-[#002855]/5 rounded-xl p-4 text-center">
          <p className="text-lg font-bold text-[#002855]">(801) 941-3479</p>
          <p className="text-sm text-gray-500 mt-1">UsaLatinoPrime</p>
        </div>
        <ol start={3} className="space-y-3 text-gray-700">
          <li className="flex gap-3">
            <span className="w-7 h-7 rounded-full bg-[#F2A900]/20 text-[#002855] font-bold text-sm flex items-center justify-center flex-shrink-0">3</span>
            <span>Tome una captura de pantalla del comprobante</span>
          </li>
          <li className="flex gap-3">
            <span className="w-7 h-7 rounded-full bg-[#F2A900]/20 text-[#002855] font-bold text-sm flex items-center justify-center flex-shrink-0">4</span>
            <span>Suba la captura aquí abajo</span>
          </li>
        </ol>
      </div>

      {/* Upload */}
      <div className="bg-white rounded-2xl border p-5">
        <label className="block mb-3 font-bold text-[#002855]">
          Subir comprobante de pago
        </label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-[#002855]/10 file:text-[#002855] hover:file:bg-[#002855]/20"
        />
        <Button
          onClick={handleZelleSubmit}
          disabled={loading}
          className="w-full h-14 text-lg mt-4 bg-[#F2A900] hover:bg-[#D4940A] text-white font-bold rounded-xl"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Upload className="w-5 h-5 mr-2" />
              Enviar Comprobante
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
