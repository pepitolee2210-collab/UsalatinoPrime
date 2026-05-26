import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FreeTranslationTool } from '@/components/translation/free-translation-tool'
import { PageHeader, AdminKeyframes } from '@/components/admin-ui'

export const dynamic = 'force-dynamic'

export default async function EmployeeTraduccionLibrePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.role !== 'employee') redirect('/login')

  return (
    <div className="space-y-6">
      <AdminKeyframes />
      <PageHeader
        eyebrow="TRADUCTOR · LIBRE"
        title="Traducción Libre"
        accentDot
        description="Traduce cualquier documento (PDF o imagen) entre español e inglés. Distinto del traductor de actas — este es para declaraciones, court orders, cartas, anexos."
      />
      <div
        className="rounded-2xl p-7"
        style={{
          background: 'var(--admin-panel-grad)',
          border: '0.5px solid var(--admin-border)',
          boxShadow: 'var(--admin-shadow, 0 8px 24px rgba(11,31,58,0.06))',
        }}
      >
        <p
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.2em',
            color: 'var(--admin-blue)',
            fontFamily: 'var(--font-mono-tech)',
          }}
        >
          TRADUCTOR · DOCUMENTOS LIBRES
        </p>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--admin-fg)', marginTop: 4 }}>
          Traductor de documentos libres
        </h2>
        <p style={{ fontSize: 13, color: 'var(--admin-fg-muted)', marginTop: 8, marginBottom: 16 }}>
          Soporta PDF o imagen. Detecta el idioma de origen y traduce al opuesto.
        </p>
        <FreeTranslationTool />
      </div>
    </div>
  )
}
