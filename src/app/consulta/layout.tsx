import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Consulta — UsaLatinoPrime',
  description: 'Asistente virtual de inmigración. Resuelve tus dudas y agenda una consulta con Henry.',
}

export default function ConsultaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#002855] via-[#003366] to-[#001d3d]">
      {children}
    </div>
  )
}
