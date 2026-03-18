'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Briefcase, Phone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function EmployeeLoginPage() {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/employee/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al iniciar sesión')
        return
      }

      // Set session on client side — this properly sets cookies
      const supabase = createClient()
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      })

      if (sessionError) {
        setError('Error al establecer sesión')
        return
      }

      // Full page navigation to ensure server picks up cookies
      window.location.href = '/employee/dashboard'
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg, #001d3d, #002855)' }}
          >
            <Briefcase className="w-8 h-8 text-[#F2A900]" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">UsaLatinoPrime</h1>
          <p className="text-sm text-gray-500 mt-1">Portal de Empleado</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4 shadow-sm">
          <div className="space-y-2">
            <Label htmlFor="phone">Número de teléfono</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="Ingrese su número"
                className="pl-10 h-12"
                required
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || !phone.trim()}
            className="w-full h-12 text-sm font-bold bg-[#002855] hover:bg-[#001d3d]"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ingresar'}
          </Button>
        </form>
      </div>
    </div>
  )
}
