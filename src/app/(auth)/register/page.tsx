'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { User, Phone, Mail, Lock, Shield, MessageCircle, Baby } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { getPromoConfig } from '@/lib/promo-config'

function RegisterForm() {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const searchParams = useSearchParams()

  const promoKey = searchParams.get('promo')
  const promoConfig = getPromoConfig(promoKey)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()

    if (formData.password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setLoading(true)

    // Crear usuario via API (auto-confirma email)
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: formData.email,
        password: formData.password,
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
      }),
    })

    const result = await res.json()

    if (!res.ok) {
      toast.error('Error al registrarse', { description: result.error })
      setLoading(false)
      return
    }

    // Auto-login inmediato
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: formData.email,
      password: formData.password,
    })

    if (loginError) {
      toast.success('Cuenta creada exitosamente', {
        description: 'Ahora puede iniciar sesión.',
      })
      router.push('/login')
      return
    }

    toast.success('Bienvenido a UsaLatinoPrime!')

    // Guardar redirect promo en localStorage antes de navegar
    if (promoConfig) {
      try {
        localStorage.setItem(
          'ulp_promo_redirect',
          JSON.stringify({ slug: promoConfig.serviceSlug, ts: Date.now() })
        )
      } catch {}
    }

    router.refresh()
    router.push(promoConfig ? `/portal/services/${promoConfig.serviceSlug}` : '/comunidad')
  }

  return (
    <>
      {/* Banner promocional */}
      {promoConfig && (
        <div className="mb-4 rounded-2xl bg-gradient-to-r from-[#002855] via-[#003570] to-[#002855] p-5 shadow-lg shadow-[#002855]/20 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Baby className="w-6 h-6 text-[#F2A900]" />
            <h2 className="text-lg font-bold text-white">{promoConfig.bannerTitle}</h2>
          </div>
          <p className="text-blue-200/70 text-sm mb-4">{promoConfig.bannerSubtitle}</p>
          <div className="flex items-center justify-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F2A900]/20 text-[#F2A900] font-semibold border border-[#F2A900]/30">
              ① Crear cuenta
            </span>
            <span className="text-white/40">→</span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-white/70 border border-white/10">
              ② Ver contrato
            </span>
            <span className="text-white/40">→</span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-white/70 border border-white/10">
              ③ Iniciar proceso
            </span>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-center">
            {promoConfig ? promoConfig.registerCardTitle : 'Crear Cuenta'}
          </CardTitle>
        </CardHeader>
        <form onSubmit={handleRegister}>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">Nombre</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    id="first_name"
                    name="first_name"
                    className="h-12 text-base pl-10"
                    placeholder="María"
                    value={formData.first_name}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Apellido</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    id="last_name"
                    name="last_name"
                    className="h-12 text-base pl-10"
                    placeholder="García"
                    value={formData.last_name}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  className="h-12 text-base pl-10"
                  placeholder="(801) 555-1234"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  className="h-12 text-base pl-10"
                  placeholder="ejemplo: maria@gmail.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  className="h-12 text-base pl-10"
                  placeholder="Mínimo 6 caracteres"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full h-12 text-base bg-[#F2A900] hover:bg-[#D4940A] text-white font-semibold"
              disabled={loading}
            >
              {loading ? 'Creando cuenta...' : 'Regístrese'}
            </Button>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Shield className="h-4 w-4" />
              <span>Sus datos están protegidos y son confidenciales</span>
            </div>
            <p className="text-sm text-gray-600 text-center">
              ¿Ya tiene cuenta?{' '}
              <Link href="/login" className="text-[#F2A900] hover:underline">
                Inicie Sesión
              </Link>
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <MessageCircle className="h-4 w-4" />
              <span>¿Necesita ayuda? Llámenos al (801) 941-3479</span>
            </div>
          </CardFooter>
        </form>
      </Card>
    </>
  )
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <Card>
          <CardHeader>
            <CardTitle className="text-center">Crear Cuenta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          </CardContent>
        </Card>
      }
    >
      <RegisterForm />
    </Suspense>
  )
}
