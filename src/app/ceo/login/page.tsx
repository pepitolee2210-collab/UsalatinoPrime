'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Crown, Mail, Lock, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export default function CeoLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) {
      toast.error('Credenciales inválidas', { description: error?.message })
      setLoading(false)
      return
    }

    // Verificar que sea admin antes de mandarlo al portal
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    if (profile?.role !== 'admin') {
      await supabase.auth.signOut()
      toast.error('Esta cuenta no tiene acceso al portal ejecutivo')
      setLoading(false)
      return
    }

    router.refresh()
    router.push('/ceo')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0b1730] via-[#0f1f3d] to-[#06101f] p-4 relative overflow-hidden">
      {/* Glows decorativos */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-blue-500/15 blur-3xl pointer-events-none" />
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="w-full max-w-md relative z-10">
        {/* Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#F2A900] to-[#D4940A] shadow-2xl shadow-amber-500/30 mb-4">
            <Crown className="w-8 h-8 text-[#0b1730]" />
          </div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-amber-300/80 font-semibold">
            Portal ejecutivo
          </p>
          <h1 className="text-4xl font-black text-white tracking-tight mt-1">
            UsaLatino Prime
          </h1>
          <p className="text-sm text-white/60 mt-2">Vista CEO — solo para directivos</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-7 shadow-2xl shadow-black/30">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wide text-white/70">
                Correo
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="ceo@usalatino.com"
                  className="w-full h-12 pl-10 pr-3 rounded-xl bg-white/[0.06] border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-amber-400/60 focus:bg-white/[0.08] transition"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wide text-white/70">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-12 pl-10 pr-3 rounded-xl bg-white/[0.06] border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-amber-400/60 focus:bg-white/[0.08] transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-gradient-to-br from-[#F2A900] to-[#D4940A] text-[#0b1730] font-bold shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 hover:brightness-110 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Ingresando…
                </>
              ) : (
                'Ingresar al portal'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-white/40 mt-6">
          ¿Necesitas el portal operativo? Ingresa en{' '}
          <a href="/login" className="text-white/70 hover:text-white underline">
            /login
          </a>
        </p>
      </div>
    </div>
  )
}
