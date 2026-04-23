'use client'

import { useState } from 'react'
import { MessageCircle, Phone, ArrowRight, Shield, Clock } from 'lucide-react'
import { Chatbot } from './chatbot'
import { VoiceCall } from './voice-call'
import { SiriOrb } from './siri-orb'

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
      {/* Orb as hero — idle breathing */}
      <div className="consulta-fade-in mb-4" style={{ animationDelay: '0.1s' }}>
        <SiriOrb state="idle" size={120} />
      </div>

      {/* Brand */}
      <div className="text-center consulta-fade-in" style={{ animationDelay: '0.25s' }}>
        <h1 className="text-3xl font-semibold tracking-tight">
          <span className="text-white">Usa</span>
          <span className="text-[#F2A900]">Latino</span>
          <span className="text-white/80">Prime</span>
        </h1>
        <p className="text-white/40 text-sm mt-3 max-w-xs mx-auto leading-relaxed">
          Tu asistente de inmigración. Evalúa tu caso de Visa Juvenil ahora.
        </p>
      </div>

      {/* Mode selection cards */}
      <div className="w-full max-w-sm mt-10 space-y-3">
        <button
          onClick={() => setMode('chat')}
          className="consulta-card consulta-fade-in w-full flex items-center gap-4 p-5 bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-2xl hover:bg-white/[0.08] hover:border-white/[0.15] group"
          style={{ animationDelay: '0.4s' }}
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#F2A900]/20 to-[#F2A900]/5 flex items-center justify-center group-hover:from-[#F2A900]/30 group-hover:to-[#F2A900]/10 transition-all duration-300">
            <MessageCircle className="w-5 h-5 text-[#F2A900]" />
          </div>
          <div className="text-left flex-1">
            <p className="text-white font-medium">Escríbeme</p>
            <p className="text-white/35 text-xs mt-0.5">Chat de texto con notas de voz</p>
          </div>
          <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-[#F2A900]/60 group-hover:translate-x-0.5 transition-all duration-300" />
        </button>

        <button
          onClick={() => setMode('voice')}
          className="consulta-card consulta-fade-in w-full flex items-center gap-4 p-5 bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-2xl hover:bg-white/[0.08] hover:border-[#0ea5e9]/20 group"
          style={{ animationDelay: '0.55s' }}
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0ea5e9]/20 to-[#8b5cf6]/10 flex items-center justify-center group-hover:from-[#0ea5e9]/30 group-hover:to-[#8b5cf6]/15 transition-all duration-300">
            <Phone className="w-5 h-5 text-[#0ea5e9]" />
          </div>
          <div className="text-left flex-1">
            <p className="text-white font-medium">Llámame</p>
            <p className="text-white/35 text-xs mt-0.5">Conversación por voz con IA</p>
          </div>
          <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-[#0ea5e9]/60 group-hover:translate-x-0.5 transition-all duration-300" />
        </button>
      </div>

      {/* Trust signals */}
      <div className="consulta-fade-in mt-12 flex items-center gap-6 text-white/25 text-[11px]" style={{ animationDelay: '0.7s' }}>
        <span className="flex items-center gap-1.5">
          <Shield className="w-3 h-3" /> Confidencial
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="w-3 h-3" /> L-S 8am–8pm MT
        </span>
      </div>

      {/* Disclaimer — plataforma tecnológica */}
      <p className="consulta-fade-in text-white/20 text-[10px] mt-3 max-w-xs text-center leading-relaxed" style={{ animationDelay: '0.85s' }}>
        UsaLatino Prime es una plataforma tecnológica. No ofrecemos asesoría legal.
      </p>
    </div>
  )
}
