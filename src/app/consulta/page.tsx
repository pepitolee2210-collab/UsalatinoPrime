'use client'

import { useState } from 'react'
import { MessageCircle, Phone } from 'lucide-react'
import { Chatbot } from './chatbot'
import { VoiceCall } from './voice-call'

type Mode = 'select' | 'chat' | 'voice'

export default function ConsultaPage() {
  const [mode, setMode] = useState<Mode>('select')

  if (mode === 'chat') {
    return <Chatbot onBack={() => setMode('select')} />
  }

  if (mode === 'voice') {
    return <VoiceCall onBack={() => setMode('select')} />
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      {/* Logo / Brand */}
      <div className="text-center mb-10">
        <div className="w-20 h-20 rounded-2xl bg-[#F2A900]/20 flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl font-bold text-[#F2A900]">U</span>
        </div>
        <h1 className="text-2xl font-bold text-white">UsaLatinoPrime</h1>
        <p className="text-white/60 text-sm mt-2 max-w-xs mx-auto">
          Asistente virtual de inmigración. Resuelve tus dudas o agenda una consulta con Henry.
        </p>
      </div>

      {/* Mode selection */}
      <div className="w-full max-w-sm space-y-4">
        <button
          onClick={() => setMode('chat')}
          className="w-full flex items-center gap-4 p-5 bg-white/10 backdrop-blur border border-white/20 rounded-2xl hover:bg-white/20 transition-all group"
        >
          <div className="w-14 h-14 rounded-xl bg-[#F2A900]/20 flex items-center justify-center group-hover:bg-[#F2A900]/30 transition-colors">
            <MessageCircle className="w-7 h-7 text-[#F2A900]" />
          </div>
          <div className="text-left">
            <p className="text-white font-semibold text-lg">Escríbeme</p>
            <p className="text-white/50 text-sm">Chat de texto y notas de voz</p>
          </div>
        </button>

        <button
          onClick={() => setMode('voice')}
          className="w-full flex items-center gap-4 p-5 bg-white/10 backdrop-blur border border-white/20 rounded-2xl hover:bg-white/20 transition-all group"
        >
          <div className="w-14 h-14 rounded-xl bg-green-500/20 flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
            <Phone className="w-7 h-7 text-green-400" />
          </div>
          <div className="text-left">
            <p className="text-white font-semibold text-lg">Llámame</p>
            <p className="text-white/50 text-sm">Conversación por voz en tiempo real</p>
          </div>
        </button>
      </div>

      {/* Footer */}
      <div className="mt-12 text-center">
        <p className="text-white/30 text-xs">
          Lunes a sábado, 8am - 8pm MT
        </p>
        <p className="text-white/30 text-xs mt-1">
          Urgencias: <a href="tel:8019413479" className="text-[#F2A900]/60 hover:text-[#F2A900]">801-941-3479</a>
        </p>
      </div>
    </div>
  )
}
