'use client'

import Link from 'next/link'
import { CheckCircle, Users, Video, Play } from 'lucide-react'

export function PaywallOverlay() {
  return (
    <div className="relative">
      {/* Blurred fake posts behind */}
      <div className="space-y-4 blur-sm pointer-events-none select-none" aria-hidden>
        {[1, 2].map(i => (
          <div key={i} className="bg-white rounded-2xl border p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-gray-200" />
              <div className="space-y-1">
                <div className="h-4 w-24 bg-gray-200 rounded" />
                <div className="h-3 w-16 bg-gray-100 rounded" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-4 w-full bg-gray-100 rounded" />
              <div className="h-4 w-3/4 bg-gray-100 rounded" />
              <div className="h-4 w-1/2 bg-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* CTA overlay */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border-2 border-[#F2A900]/30 p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#002855] flex items-center justify-center mx-auto mb-4">
            <span className="text-[#F2A900] font-bold text-2xl font-serif">U</span>
          </div>

          <h2 className="text-xl font-bold text-[#002855] mb-1">
            Únase a la Comunidad
          </h2>
          <p className="text-gray-500 text-sm mb-5">
            La comunidad de inmigrantes más grande de Estados Unidos
          </p>

          <div className="space-y-3 text-left mb-6">
            <div className="flex items-center gap-3">
              <Video className="w-5 h-5 text-[#F2A900] flex-shrink-0" />
              <span className="text-sm text-gray-700">Sesiones en vivo todos los días con Henry</span>
            </div>
            <div className="flex items-center gap-3">
              <Play className="w-5 h-5 text-[#F2A900] flex-shrink-0" />
              <span className="text-sm text-gray-700">Videos exclusivos de TikTok y YouTube</span>
            </div>
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-[#F2A900] flex-shrink-0" />
              <span className="text-sm text-gray-700">Comunidad activa de apoyo mutuo</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-[#F2A900] flex-shrink-0" />
              <span className="text-sm text-gray-700">Acceso a servicios migratorios</span>
            </div>
          </div>

          <Link
            href="/comunidad/pagar"
            className="block w-full py-3.5 bg-[#F2A900] hover:bg-[#D4940A] text-white text-center font-bold text-lg rounded-xl transition-colors"
          >
            Activar por $25/mes
          </Link>

          <p className="text-xs text-gray-400 mt-3">
            Cancele en cualquier momento
          </p>
        </div>
      </div>
    </div>
  )
}
