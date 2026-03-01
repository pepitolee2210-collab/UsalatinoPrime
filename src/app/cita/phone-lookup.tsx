'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Phone, Loader2, AlertCircle, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

interface CaseOption {
  id: string
  case_number: string
  service_name: string
  token: string
}

interface LookupResult {
  found: boolean
  reason?: string
  clientName?: string
  cases?: CaseOption[]
}

export function PhoneLookup() {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<LookupResult | null>(null)

  async function handleLookup() {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length < 7) {
      toast.error('Ingrese un número de teléfono válido')
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/appointments/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })

      const data: LookupResult = await res.json()
      setResult(data)

      // If only 1 case, redirect directly
      if (data.found && data.cases?.length === 1) {
        window.location.href = `/cita/${data.cases[0].token}`
        return
      }
    } catch {
      toast.error('Error de conexión. Intente de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleLookup()
  }

  // Error states
  if (result && !result.found) {
    const messages: Record<string, { title: string; desc: string }> = {
      not_found: {
        title: 'No encontramos tu cuenta',
        desc: 'El número ingresado no está registrado en nuestro sistema.',
      },
      no_cases: {
        title: 'Sin casos activos',
        desc: 'Tu cuenta no tiene casos registrados. Contacta a Henry para más información.',
      },
    }

    const msg = messages[result.reason || 'not_found'] || messages.not_found

    return (
      <div className="text-center">
        <div className="w-14 h-14 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-7 h-7 text-yellow-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">{msg.title}</h2>
        <p className="text-sm text-gray-500 mb-4">{msg.desc}</p>
        <div className="p-4 bg-gray-50 rounded-lg mb-4">
          <p className="text-sm text-gray-600 font-medium">Contacta a Henry</p>
          <a href="tel:8019413479" className="text-sm text-[#002855] font-semibold hover:underline">
            801-941-3479
          </a>
        </div>
        <Button
          variant="outline"
          onClick={() => { setResult(null); setPhone('') }}
          className="w-full"
        >
          Intentar con otro número
        </Button>
      </div>
    )
  }

  // Case selection (multiple cases)
  if (result?.found && result.cases && result.cases.length > 1) {
    return (
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">
          Hola, {result.clientName}
        </h2>
        <p className="text-sm text-gray-500 mb-4">Selecciona el caso para tu cita:</p>
        <div className="space-y-2">
          {result.cases.map((c) => (
            <a
              key={c.id}
              href={`/cita/${c.token}`}
              className="flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-[#002855]/30 hover:bg-blue-50/50 transition-colors"
            >
              <div>
                <p className="font-medium text-gray-900">{c.service_name}</p>
                <p className="text-sm text-gray-500">Caso #{c.case_number}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </a>
          ))}
        </div>
        <Button
          variant="ghost"
          onClick={() => { setResult(null); setPhone('') }}
          className="w-full mt-4 text-gray-500"
        >
          Usar otro número
        </Button>
      </div>
    )
  }

  // Default: phone input
  return (
    <div>
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-full bg-[#002855]/10 flex items-center justify-center mx-auto mb-4">
          <Phone className="w-7 h-7 text-[#002855]" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Agendar Cita</h2>
        <p className="text-sm text-gray-500">
          Ingresa tu número de teléfono para continuar
        </p>
      </div>
      <div className="space-y-3">
        <Input
          type="tel"
          placeholder="(801) 555-1234"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={handleKeyDown}
          className="text-center text-lg h-12"
          autoFocus
        />
        <Button
          onClick={handleLookup}
          disabled={loading || phone.replace(/\D/g, '').length < 7}
          className="w-full h-12 bg-[#002855] hover:bg-[#001d3d] text-white text-base"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            'Buscar mi cuenta'
          )}
        </Button>
      </div>
    </div>
  )
}
