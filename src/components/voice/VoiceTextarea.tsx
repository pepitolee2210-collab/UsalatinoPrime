'use client'

import { useRef, useState } from 'react'
import { Mic, Square, Loader2, Undo2, AlertCircle, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useVoiceRecorder } from './use-voice-recorder'

interface Props {
  /** Token de la cita (validado server-side por /api/cita/[token]/transcribe). */
  token: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  required?: boolean
  hint?: string
  id?: string
  micAccentClass?: string
  className?: string
}

const DEFAULT_HINT = 'Tip: si te cuesta escribir, toca el botón de micrófono y cuéntalo en voz alta. Lo transcribimos automáticamente.'

export function VoiceTextarea({
  token,
  value,
  onChange,
  placeholder,
  rows = 6,
  required = false,
  hint,
  id,
  className = '',
}: Props) {
  const [error, setError] = useState<string | null>(null)
  const [lastAppendedLength, setLastAppendedLength] = useState<number>(0)
  const previousValueRef = useRef<string>(value)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const recorder = useVoiceRecorder({
    onComplete: async (blob) => {
      try {
        recorder.setProcessing(true)
        const fd = new FormData()
        fd.append('audio', blob, 'voice.webm')
        const res = await fetch(`/api/cita/${encodeURIComponent(token)}/transcribe`, {
          method: 'POST',
          body: fd,
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'No se pudo transcribir')

        const newText = (data.text || '').trim()
        if (!newText) {
          toast.warning('No detectamos voz en la grabación. Intenta de nuevo más cerca del micrófono.')
          recorder.reset()
          return
        }
        previousValueRef.current = value
        const next = value.trim().length === 0
          ? newText
          : `${value.trimEnd()} ${newText}`
        onChange(next)
        setLastAppendedLength(next.length - value.length)
        recorder.reset()
        toast.success('Tu voz quedó transcrita ✨')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al transcribir'
        toast.error(msg)
        setError(msg)
        recorder.reset()
      }
    },
    onError: (msg) => setError(msg),
  })

  function undoLastAppend() {
    if (lastAppendedLength <= 0) return
    onChange(previousValueRef.current)
    setLastAppendedLength(0)
    toast.success('Última transcripción deshecha')
  }

  const isRecording = recorder.state === 'recording'
  const isProcessing = recorder.state === 'processing'
  const isRequesting = recorder.state === 'requesting'
  const isIdle = recorder.state === 'idle' || recorder.state === 'error'

  const minutes = Math.floor(recorder.elapsedMs / 60000)
  const seconds = Math.floor((recorder.elapsedMs % 60000) / 1000)
  const timer = `${minutes}:${seconds.toString().padStart(2, '0')}`

  // 14 barras de waveform — más fluido, con altura mínima para que siempre haya forma
  const bars = Array.from({ length: 14 }).map((_, i) => {
    const phase = (i / 14) * Math.PI * 2
    const wave = Math.sin(phase + recorder.elapsedMs / 100) * 0.5 + 0.5
    const level = recorder.audioLevel
    return Math.max(0.15, Math.min(1, wave * level * 1.4 + level * 0.4))
  })

  return (
    <div className={`relative ${className}`}>
      {/* Wrapper con borde animado en estado idle */}
      <div
        className={`relative rounded-2xl overflow-hidden transition-all ${
          isRecording
            ? 'ring-2 ring-[#F2A900]/60 shadow-[0_0_0_4px_rgba(242,169,0,0.08)]'
            : isProcessing
              ? 'ring-2 ring-blue-400/50'
              : 'ring-1 ring-gray-200 hover:ring-[#F2A900]/40 focus-within:ring-2 focus-within:ring-[#F2A900]/50 focus-within:shadow-[0_0_0_4px_rgba(242,169,0,0.06)]'
        }`}
      >
        <textarea
          ref={taRef}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          required={required}
          disabled={isRecording || isProcessing}
          className="w-full px-4 py-3 pb-14 text-sm text-gray-900 bg-white outline-none resize-none placeholder:text-gray-400 disabled:bg-amber-50/40 disabled:text-gray-600 transition-colors"
        />

        {/* Barra inferior con controles */}
        <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-white via-white to-white/80 backdrop-blur-sm border-t border-gray-100/80 flex items-center justify-between gap-2">
          {/* Lado izquierdo: estado */}
          <div className="flex items-center gap-2 text-[11px] min-w-0 flex-1">
            {isRecording && (
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex items-center gap-1.5 text-red-600 font-bold flex-shrink-0">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
                  </span>
                  {timer}
                </span>
                {/* Waveform animado */}
                <div className="flex items-center gap-[2px] h-5 flex-shrink-0">
                  {bars.map((v, i) => (
                    <span
                      key={i}
                      className="w-[2px] rounded-full bg-gradient-to-t from-[#F2A900] via-[#F2A900] to-[#FFD166] transition-all duration-75"
                      style={{ height: `${20 * v}%`, minHeight: '3px' }}
                    />
                  ))}
                </div>
              </div>
            )}
            {isProcessing && (
              <span className="inline-flex items-center gap-1.5 text-blue-700 font-semibold">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 bg-clip-text text-transparent bg-[length:200%_100%] animate-[shimmer_2s_linear_infinite]">
                  Transcribiendo tu voz…
                </span>
              </span>
            )}
            {isRequesting && (
              <span className="inline-flex items-center gap-1.5 text-gray-500">
                <Loader2 className="w-3 h-3 animate-spin" />
                Permitiendo micrófono…
              </span>
            )}
            {isIdle && lastAppendedLength > 0 && (
              <button
                type="button"
                onClick={undoLastAppend}
                className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-900 font-medium hover:bg-amber-50 px-2 py-1 -ml-2 rounded-lg transition-colors"
              >
                <Undo2 className="w-3 h-3" />
                Deshacer
              </button>
            )}
            {isIdle && lastAppendedLength === 0 && !error && (
              <span className="hidden sm:inline-flex items-center gap-1 text-gray-400 italic">
                <Sparkles className="w-3 h-3 text-[#F2A900]" />
                Habla en lugar de escribir
              </span>
            )}
          </div>

          {/* Botón principal */}
          <div className="flex-shrink-0">
            {isIdle && (
              <button
                type="button"
                onClick={recorder.start}
                disabled={isProcessing || isRequesting}
                className="group relative inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-xs font-bold text-white shadow-md hover:shadow-lg active:scale-95 transition-all disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, #F2A900 0%, #FFB72E 50%, #F2A900 100%)',
                  backgroundSize: '200% 100%',
                  backgroundPosition: '0% 50%',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundPosition = '100% 50%' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundPosition = '0% 50%' }}
              >
                <Mic className="w-3.5 h-3.5 drop-shadow-sm" />
                <span>Grabar voz</span>
                <span className="absolute inset-0 rounded-full ring-2 ring-[#F2A900]/40 opacity-0 group-hover:opacity-100 group-hover:scale-110 transition-all pointer-events-none" />
              </button>
            )}
            {isRequesting && (
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-xs font-bold text-white shadow-md bg-gradient-to-br from-gray-400 to-gray-500"
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>…</span>
              </button>
            )}
            {isRecording && (
              <button
                type="button"
                onClick={recorder.stop}
                className="group relative inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-xs font-bold text-white shadow-lg active:scale-95 transition-all"
                style={{ background: 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)' }}
              >
                <Square className="w-3 h-3 fill-white" />
                <span>Listo</span>
                {/* Halo pulsante */}
                <span className="absolute inset-0 rounded-full bg-red-500 opacity-30 animate-ping pointer-events-none" />
              </button>
            )}
            {isProcessing && (
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-xs font-bold text-white shadow-md"
                style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)' }}
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Procesando</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Hint o error */}
      {error ? (
        <div className="mt-2 flex items-start gap-1.5 text-[11px] text-red-700 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">
          <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-gray-500 leading-relaxed pl-1 flex items-start gap-1.5">
          <Sparkles className="w-3 h-3 text-[#F2A900] flex-shrink-0 mt-0.5" />
          <span>{hint || DEFAULT_HINT}</span>
        </p>
      )}
    </div>
  )
}
