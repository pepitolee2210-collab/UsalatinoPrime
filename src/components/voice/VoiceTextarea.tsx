'use client'

import { useRef, useState } from 'react'
import { Mic, Square, Loader2, Undo2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useVoiceRecorder } from './use-voice-recorder'

interface Props {
  /** Token de la cita (validado server-side por el endpoint /api/cita/[token]/transcribe). */
  token: string
  /** Valor controlado del textarea. */
  value: string
  /** Callback al cambiar el valor (escritura manual o transcripción agregada). */
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  required?: boolean
  /** Texto opcional debajo del textarea (ej. ayuda, contador, etc). */
  hint?: string
  /** ID del campo (para label/htmlFor). */
  id?: string
  /** Color de marca para el botón de grabación; por defecto azul cliente. */
  micAccentClass?: string
  className?: string
}

const DEFAULT_HINT = 'Puedes escribir o grabar tu voz tocando el botón del micrófono. La grabación se transcribe automáticamente.'

export function VoiceTextarea({
  token,
  value,
  onChange,
  placeholder,
  rows = 6,
  required = false,
  hint,
  id,
  micAccentClass = 'text-[#002855] hover:text-[#001d3d]',
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
        if (!res.ok) {
          throw new Error(data.error || 'No se pudo transcribir')
        }
        const newText = (data.text || '').trim()
        if (!newText) {
          toast.warning('No detectamos voz en la grabación. Intenta de nuevo más cerca del micrófono.')
          recorder.reset()
          return
        }
        // Append al valor actual con un espacio, sin perder lo escrito
        previousValueRef.current = value
        const next = value.trim().length === 0
          ? newText
          : `${value.trimEnd()} ${newText}`
        onChange(next)
        setLastAppendedLength(next.length - value.length)
        recorder.reset()
        toast.success('Transcripción agregada')
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

  // Format mm:ss
  const minutes = Math.floor(recorder.elapsedMs / 60000)
  const seconds = Math.floor((recorder.elapsedMs % 60000) / 1000)
  const timer = `${minutes}:${seconds.toString().padStart(2, '0')}`

  // 6 barras de nivel de audio
  const bars = Array.from({ length: 6 }).map((_, i) => {
    const level = recorder.audioLevel
    const threshold = (i + 1) / 6
    return level >= threshold ? 1 : level / threshold
  })

  return (
    <div className={`relative ${className}`}>
      <textarea
        ref={taRef}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        required={required}
        disabled={isRecording || isProcessing}
        className="w-full rounded-xl border border-gray-300 px-3 py-2 pb-12 text-sm focus:border-[#002855] focus:ring-2 focus:ring-[#002855]/20 outline-none disabled:bg-gray-50 disabled:text-gray-500"
      />

      {/* Botón flotante de micrófono / panel de grabación */}
      <div className="absolute bottom-2 right-2 left-2 flex items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-2 text-[11px] text-gray-400 pointer-events-auto">
          {isRecording && (
            <>
              <span className="inline-flex items-center gap-1.5 text-red-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                Grabando · {timer}
              </span>
              <span className="inline-flex items-end gap-0.5 h-3">
                {bars.map((v, i) => (
                  <span
                    key={i}
                    className="w-0.5 bg-red-500 rounded-full transition-all"
                    style={{ height: `${4 + Math.round(v * 8)}px`, opacity: 0.4 + v * 0.6 }}
                  />
                ))}
              </span>
            </>
          )}
          {isProcessing && (
            <span className="inline-flex items-center gap-1.5 text-blue-600 font-medium">
              <Loader2 className="w-3 h-3 animate-spin" />
              Transcribiendo…
            </span>
          )}
          {isRequesting && (
            <span className="inline-flex items-center gap-1.5 text-gray-500">
              <Loader2 className="w-3 h-3 animate-spin" />
              Pidiendo permiso…
            </span>
          )}
          {recorder.state === 'idle' && lastAppendedLength > 0 && (
            <button
              type="button"
              onClick={undoLastAppend}
              className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-900 font-medium pointer-events-auto"
            >
              <Undo2 className="w-3 h-3" />
              Deshacer última grabación
            </button>
          )}
        </div>

        <div className="pointer-events-auto">
          {!isRecording ? (
            <button
              type="button"
              onClick={recorder.start}
              disabled={isProcessing || isRequesting}
              className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-full bg-white border border-gray-200 shadow-sm text-xs font-semibold transition-colors disabled:opacity-50 ${micAccentClass}`}
            >
              <Mic className="w-3.5 h-3.5" />
              {isProcessing ? '…' : 'Grabar'}
            </button>
          ) : (
            <button
              type="button"
              onClick={recorder.stop}
              className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-sm"
            >
              <Square className="w-3 h-3 fill-white" />
              Listo
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-red-700">
          <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!error && (hint || DEFAULT_HINT) && (
        <p className="mt-1.5 text-[11px] text-gray-500 leading-relaxed">
          {hint || DEFAULT_HINT}
        </p>
      )}
    </div>
  )
}
