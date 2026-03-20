'use client'

import { useState } from 'react'
import { Loader2, Undo2 } from 'lucide-react'
import { toast } from 'sonner'

const MAX_ATTEMPTS = 4

const LOADING_MESSAGES = [
  'Henry está analizando tu respuesta...',
  'Henry está mejorando tu declaración...',
  'Henry está optimizando los detalles...',
  'Henry está dando los toques finales...',
]

interface AIImproveButtonProps {
  question: string
  value: string
  context: 'tutor' | 'minor'
  onChange: (v: string) => void
}

export function AIImproveButton({ question, value, context, onChange }: AIImproveButtonProps) {
  const [loading, setLoading] = useState(false)
  const [original, setOriginal] = useState<string | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [loadingMsg, setLoadingMsg] = useState('')

  const remaining = MAX_ATTEMPTS - attempts

  async function improve() {
    if (!value.trim() || value.trim().length < 10) {
      toast.error('Escribe al menos unas palabras para que Henry pueda mejorarlas')
      return
    }
    if (remaining <= 0) {
      toast.error('Has usado los 4 intentos para esta pregunta')
      return
    }

    setLoading(true)
    setLoadingMsg(LOADING_MESSAGES[attempts % LOADING_MESSAGES.length])

    // Save original only on first attempt
    if (!original) setOriginal(value)

    try {
      const res = await fetch('/api/ai/improve-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, answer: value, context }),
      })

      if (!res.ok) throw new Error()
      const { improved } = await res.json()

      if (improved) {
        onChange(improved)
        setAttempts(prev => prev + 1)
        toast.success('¡Henry mejoró tu respuesta!')
      }
    } catch {
      toast.error('Error al conectar con Henry. Intente de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  function revert() {
    if (original) {
      onChange(original)
      setOriginal(null)
      toast.success('Respuesta original restaurada')
    }
  }

  return (
    <div className="mt-1.5">
      {/* Loading state — branded */}
      {loading && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#002855] mb-2 animate-pulse">
          <div className="w-8 h-8 rounded-lg bg-[#F2A900]/20 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-black text-[#F2A900]">H</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">{loadingMsg}</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-[#F2A900] rounded-full animate-[loading_2s_ease-in-out_infinite]"
                  style={{ width: '60%', animation: 'loading 1.5s ease-in-out infinite alternate' }} />
              </div>
              <Loader2 className="w-3 h-3 text-[#F2A900] animate-spin" />
            </div>
          </div>
          <style>{`@keyframes loading{0%{width:20%}100%{width:90%}}`}</style>
        </div>
      )}

      {/* Buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={improve}
          disabled={loading || !value.trim() || remaining <= 0}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-30"
          style={{
            background: remaining > 0 ? 'linear-gradient(135deg, #002855, #001d3d)' : '#e5e7eb',
            color: remaining > 0 ? '#F2A900' : '#9ca3af',
            boxShadow: remaining > 0 ? '0 2px 8px rgba(0,40,85,0.3)' : 'none',
          }}
        >
          <div className="w-5 h-5 rounded-md bg-[#F2A900]/20 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-black text-[#F2A900]">H</span>
          </div>
          {remaining > 0 ? 'Henry mejora tu respuesta' : 'Sin intentos disponibles'}
        </button>

        {original && !loading && (
          <button type="button" onClick={revert}
            className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors">
            <Undo2 className="w-3 h-3" /> Deshacer
          </button>
        )}

        {/* Attempts counter */}
        {attempts > 0 && (
          <span className="text-[10px] text-gray-400 ml-auto">
            {remaining > 0 ? `${remaining} intento${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''}` : 'Intentos agotados'}
          </span>
        )}
      </div>
    </div>
  )
}
