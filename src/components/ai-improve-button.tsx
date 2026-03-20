'use client'

import { useState } from 'react'
import { Sparkles, Loader2, Undo2 } from 'lucide-react'
import { toast } from 'sonner'

interface AIImproveButtonProps {
  question: string
  value: string
  context: 'tutor' | 'minor'
  onChange: (v: string) => void
}

export function AIImproveButton({ question, value, context, onChange }: AIImproveButtonProps) {
  const [loading, setLoading] = useState(false)
  const [original, setOriginal] = useState<string | null>(null)

  async function improve() {
    if (!value.trim() || value.trim().length < 10) {
      toast.error('Escribe al menos unas palabras para que la IA pueda mejorarlas')
      return
    }

    setLoading(true)
    setOriginal(value)

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
        toast.success('Respuesta mejorada con IA')
      }
    } catch {
      toast.error('Error al mejorar con IA. Intente de nuevo.')
      setOriginal(null)
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
    <div className="flex items-center gap-2 mt-1.5">
      <button
        type="button"
        onClick={improve}
        disabled={loading || !value.trim()}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-40"
        style={{
          background: loading ? '#e5e7eb' : 'linear-gradient(135deg, #F2A900, #ffca28)',
          color: loading ? '#9ca3af' : '#001020',
          boxShadow: loading ? 'none' : '0 2px 8px rgba(242,169,0,0.3)',
        }}
      >
        {loading ? (
          <><Loader2 className="w-3 h-3 animate-spin" /> Mejorando...</>
        ) : (
          <><Sparkles className="w-3 h-3" /> Mejorar con IA</>
        )}
      </button>
      {original && !loading && (
        <button
          type="button"
          onClick={revert}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          <Undo2 className="w-3 h-3" /> Deshacer
        </button>
      )}
    </div>
  )
}
