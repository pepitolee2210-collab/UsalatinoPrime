'use client'

import { Video } from 'lucide-react'

interface ZoomCardProps {
  zoomUrl: string
  title?: string
  schedule?: string
}

export function ZoomCard({ zoomUrl, title, schedule }: ZoomCardProps) {
  return (
    <div className="rounded-2xl bg-gradient-to-r from-[#002855] to-[#003570] p-5 shadow-lg">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-[#F2A900]/20 flex items-center justify-center">
          <Video className="w-5 h-5 text-[#F2A900]" />
        </div>
        <div>
          <h3 className="text-white font-bold text-lg">
            {title || 'Sesión en Vivo'}
          </h3>
          {schedule && (
            <p className="text-blue-200/70 text-sm">{schedule}</p>
          )}
        </div>
      </div>
      <p className="text-blue-100/80 text-sm mb-4">
        Únase a la sesión en vivo con Henry. Toque el botón para entrar.
      </p>
      <a
        href={zoomUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full py-3.5 bg-[#F2A900] hover:bg-[#D4940A] text-white text-center font-bold text-lg rounded-xl transition-colors"
      >
        Entrar a la Sesión
      </a>
    </div>
  )
}
