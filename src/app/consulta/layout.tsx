import type { Metadata } from 'next'
import { Sora } from 'next/font/google'

const sora = Sora({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sora',
})

export const metadata: Metadata = {
  title: 'Consulta — UsaLatino Prime',
  description: 'Plataforma tecnológica de guía para tu expediente de Visa Juvenil. Evaluación de documentos gratuita con una consultora senior.',
}

export default function ConsultaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${sora.variable} min-h-screen bg-[#000a14] relative overflow-hidden`} style={{ fontFamily: 'var(--font-sora), sans-serif' }}>
      {/* Deep gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#000a14] via-[#001225] to-[#000a14]" />

      {/* Subtle radial accents */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[#0ea5e9]/[0.04] blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[#8b5cf6]/[0.03] blur-[100px]" />
        <div className="absolute top-[30%] right-[20%] w-[300px] h-[300px] rounded-full bg-[#F2A900]/[0.02] blur-[80px]" />
      </div>

      {/* Noise texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '256px 256px',
        }}
      />

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}
