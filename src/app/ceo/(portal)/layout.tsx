'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LayoutGrid, LogOut } from 'lucide-react'
import { ErrorBoundary } from '@/components/error-boundary'
import { ChatWidgetAutoMount } from '@/components/employee/chat-widget-mount'

/**
 * Layout del portal ejecutivo de Henry. Minimalismo total — fondo carbón
 * `#0A0A0B`, sin gradientes decorativos, sin sidebar. Solo el dashboard.
 * Header sticky con marca a la izquierda y acciones operativas/logout a
 * la derecha. Estilo Linear/Vercel/Stripe Dashboard.
 */
export default function CeoLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen text-white" style={{ background: '#0A0A0B' }}>
      <header
        className="sticky top-0 z-40 backdrop-blur-md border-b"
        style={{
          background: 'rgba(10, 10, 11, 0.85)',
          borderColor: 'rgba(255, 255, 255, 0.06)',
        }}
      >
        <div className="mx-auto w-full max-w-[1240px] px-6 lg:px-10 py-4 flex items-center justify-between gap-4">
          <Link href="/ceo" className="flex items-center gap-3 group">
            {/* Marca minimalista: cuadrado dorado pequeño + wordmark */}
            <div className="flex items-center gap-2.5">
              <span
                className="block h-4 w-4"
                style={{ background: '#E8B84A', clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' }}
              />
              <span className="font-display text-base text-white font-medium tracking-tight">
                UsaLatino Prime
              </span>
              <span className="hidden sm:inline-block h-3 w-px bg-white/10 mx-1" />
              <span className="hidden sm:inline font-mono-ceo text-[10px] uppercase tracking-[0.22em] text-white/65 font-medium">
                Vista CEO
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-1">
            <Link
              href="/admin/citas"
              className="inline-flex items-center gap-2 px-3 h-9 text-xs font-medium text-white/85 hover:text-white border border-transparent hover:border-white/[0.08] rounded-md transition-colors"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Panel Operativo</span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-3 h-9 text-xs font-medium text-white/75 hover:text-white border border-transparent hover:border-white/[0.08] rounded-md transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      <main className="pb-[max(2rem,env(safe-area-inset-bottom))]">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
      <ChatWidgetAutoMount />
    </div>
  )
}
