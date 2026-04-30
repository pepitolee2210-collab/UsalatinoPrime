'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Crown, LayoutGrid, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorBoundary } from '@/components/error-boundary'

/**
 * Layout del portal ejecutivo de Henry — sin sidebar lleno de tabs
 * operativas. Vista de comando, minimalista. Si quiere bajar al detalle
 * del día a día tiene un solo botón "Panel Operativo".
 */
export default function CeoLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b1730] via-[#0f1f3d] to-[#0b1730] text-white">
      <header className="sticky top-0 z-40 backdrop-blur-md bg-[#0b1730]/80 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-3 flex items-center justify-between gap-4">
          <Link href="/ceo" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#F2A900] to-[#D4940A] flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Crown className="w-5 h-5 text-[#0b1730]" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">UsaLatino Prime</p>
              <p className="text-[10px] text-white/60 leading-tight tracking-wide uppercase">Vista Ejecutiva</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link href="/admin/citas">
              <Button
                variant="outline"
                size="sm"
                className="bg-white/5 border-white/15 text-white hover:bg-white/10 hover:text-white hover:border-white/25"
              >
                <LayoutGrid className="w-4 h-4 mr-2" />
                Panel Operativo
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 lg:px-8 py-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </div>
  )
}
