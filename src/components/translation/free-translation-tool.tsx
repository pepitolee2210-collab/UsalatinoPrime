'use client'

import { useRef, useState } from 'react'
import {
  BookOpenText, FileUp, FileText, Trash2, Loader2, Download, Sparkles,
  AlertTriangle, ArrowRight, ArrowLeftRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type {
  FreeTranslationResult,
  TranslationDirection,
} from '@/lib/translation/free-translate'

const MAX_BYTES = 16 * 1024 * 1024
const SIGNATURE_PATH = '/translation-cert/signature.png'

export function FreeTranslationTool() {
  const [file, setFile] = useState<File | null>(null)
  const [direction, setDirection] = useState<TranslationDirection>('es-to-en')
  const [dragOver, setDragOver] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [result, setResult] = useState<FreeTranslationResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(picked: File | null | undefined) {
    if (!picked) return
    if (picked.size > MAX_BYTES) {
      toast.error(`El archivo supera el límite de ${MAX_BYTES / 1024 / 1024} MB`)
      return
    }
    const ok = picked.type.startsWith('application/pdf') || picked.type.startsWith('image/')
    if (!ok) {
      toast.error('Solo se permiten PDF o imágenes')
      return
    }
    setFile(picked)
    setResult(null)
  }

  async function handleTranslate() {
    if (!file) return toast.error('Selecciona un archivo primero')
    setTranslating(true)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('direction', direction)
      const res = await fetch('/api/translation/free-translate', {
        method: 'POST',
        body: fd,
        credentials: 'same-origin',
        cache: 'no-store',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || `Error HTTP ${res.status}`)
        return
      }
      setResult(data.result as FreeTranslationResult)
      toast.success('Traducción lista. Revisa antes de descargar.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error de red')
    } finally {
      setTranslating(false)
    }
  }

  async function handleDownload() {
    if (!result) return
    setGeneratingPdf(true)
    try {
      const signatureDataUrl = await loadImageAsDataUrl(SIGNATURE_PATH)
      const { buildFreeTranslationPDF } = await import('@/lib/translation/build-free-pdf')
      const certDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
      const blob = buildFreeTranslationPDF({
        result,
        certDate,
        signatureDataUrl,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const namePart = (result.document_title || 'TRANSLATION')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .toUpperCase()
        .slice(0, 60)
      const dirSuffix = direction === 'es-to-en' ? 'EN' : 'ES'
      a.download = `${namePart}_${dirSuffix}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('PDF descargado')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al generar PDF')
    } finally {
      setGeneratingPdf(false)
    }
  }

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Hero */}
      <div className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50 to-white p-5">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-purple-600 flex items-center justify-center flex-shrink-0">
            <BookOpenText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Traducción libre de documentos</h2>
            <p className="text-sm text-gray-600 mt-0.5">
              Sube cualquier PDF (declaraciones, cartas, anexos, court orders, etc.) y obtén una traducción
              en formato de 2 columnas (original ↔ traducción). El sello, firma o código del original
              se menciona descriptivamente en la traducción — el original no se altera y se entrega como
              archivo separado.
            </p>
            <p className="text-[11px] text-gray-500 mt-1.5">
              <span className="font-semibold">PDF</span>: hasta 10 páginas · <span className="font-semibold">Tamaño</span>: máx. 16 MB
            </p>
          </div>
        </div>
      </div>

      {/* Direction selector */}
      <div>
        <p className="text-xs font-medium text-gray-700 block mb-2">Dirección de la traducción</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <DirectionOption
            active={direction === 'es-to-en'}
            label="Español → Inglés"
            sub="Documento en español, traducir a inglés"
            onClick={() => setDirection('es-to-en')}
          />
          <DirectionOption
            active={direction === 'en-to-es'}
            label="Inglés → Español"
            sub="Documento en inglés, traducir a español"
            onClick={() => setDirection('en-to-es')}
          />
        </div>
        <button
          type="button"
          onClick={() => setDirection((d) => (d === 'es-to-en' ? 'en-to-es' : 'es-to-en'))}
          className="text-[11px] text-purple-600 hover:underline mt-1.5 inline-flex items-center gap-1"
        >
          <ArrowLeftRight className="w-3 h-3" />
          Invertir dirección
        </button>
      </div>

      {/* Upload */}
      <div>
        <label className="text-xs font-medium text-gray-700 block mb-2">
          Documento (PDF o imagen, máx. 10 páginas / 16 MB)
        </label>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/*"
          onChange={(e) => {
            handleFile(e.target.files?.[0])
            if (inputRef.current) inputRef.current.value = ''
          }}
          className="sr-only"
          aria-hidden="true"
        />

        {!file ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              handleFile(e.dataTransfer.files?.[0])
            }}
            className={`w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-10 px-4 transition-colors text-center ${
              dragOver
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-300 bg-gray-50 hover:border-purple-400 hover:bg-purple-50/30'
            }`}
          >
            <FileUp className="w-9 h-9 text-purple-500" />
            <div>
              <p className="text-sm font-semibold text-gray-900">Haz click para seleccionar el documento</p>
              <p className="text-[11px] text-gray-500 mt-0.5">o arrastra y suelta aquí · PDF o imagen · hasta 10 páginas · máx. 16 MB</p>
            </div>
          </button>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white border border-emerald-200 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-emerald-700" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 truncate">{file.name}</p>
              <p className="text-[11px] text-gray-500">
                {(file.size / 1024).toFixed(0)} KB · {file.type || 'archivo'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setFile(null)
                setResult(null)
                if (inputRef.current) inputRef.current.value = ''
              }}
              className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-600 transition-colors flex-shrink-0"
              title="Quitar archivo"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Aviso de sello */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-gray-700 space-y-1">
          <p className="font-semibold text-gray-900">¿Qué pasa con sellos, firmas y códigos QR?</p>
          <p>
            La traducción NO toca el documento original. Si el doc original tiene sello del notario,
            firma manuscrita, código QR o sello apostillado, en la traducción se cita
            descriptivamente (ej. <em className="not-italic">[Sello del Notario]</em>,
            <em className="not-italic"> [Firma de Juan Pérez]</em>) y el original se entrega
            junto con la traducción — el receptor verá ambos.
          </p>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          onClick={handleTranslate}
          disabled={!file || translating}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
        >
          {translating ? (
            <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Traduciendo con Gemini...</>
          ) : result ? (
            <><Sparkles className="w-4 h-4 mr-1.5" /> Volver a traducir</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-1.5" /> Traducir documento</>
          )}
        </Button>
        {result && (
          <Button
            onClick={handleDownload}
            disabled={generatingPdf}
            variant="outline"
            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          >
            {generatingPdf ? (
              <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Generando PDF...</>
            ) : (
              <><Download className="w-4 h-4 mr-1.5" /> Descargar PDF traducido</>
            )}
          </Button>
        )}
      </div>

      {result && <FreePreview result={result} />}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────

function DirectionOption({
  active, label, sub, onClick,
}: {
  active: boolean
  label: string
  sub: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl border-2 p-3 transition-colors ${
        active
          ? 'border-purple-500 bg-purple-50'
          : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50/30'
      }`}
    >
      <p className={`text-sm font-semibold ${active ? 'text-purple-900' : 'text-gray-900'}`}>
        {label}
      </p>
      <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>
    </button>
  )
}

async function loadImageAsDataUrl(src: string): Promise<string | null> {
  try {
    const res = await fetch(src, { cache: 'force-cache' })
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function FreePreview({ result }: { result: FreeTranslationResult }) {
  const sourceLabel = result.source_language === 'es' ? 'Original (Español)' : 'Original (English)'
  const targetLabel = result.target_language === 'es' ? 'Traducción (Español)' : 'Translation (English)'

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
            Vista previa
          </p>
          <h3 className="text-sm font-bold text-gray-900 leading-tight mt-0.5">
            {result.document_title}
          </h3>
        </div>
        <div className="text-[11px] text-gray-400 italic flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" />
          {result.pages.length} {result.pages.length === 1 ? 'página' : 'páginas'} · revisa antes de descargar
        </div>
      </div>

      <div className="divide-y">
        {result.pages.map((p, i) => (
          <div key={i} className="px-5 py-4">
            <div className="flex items-center gap-2 text-[11px] text-gray-500 mb-3">
              <span className="font-semibold text-gray-700">Página {i + 1}</span>
              <span>de {result.pages.length}</span>
              <ArrowRight className="w-3 h-3" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ColumnPreview label={sourceLabel} text={p.original} />
              <ColumnPreview label={targetLabel} text={p.translated} highlight />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ColumnPreview({ label, text, highlight }: { label: string; text: string; highlight?: boolean }) {
  return (
    <div>
      <p className={`text-[10px] uppercase tracking-wider font-bold mb-1.5 ${
        highlight ? 'text-purple-700' : 'text-gray-500'
      }`}>
        {label}
      </p>
      <div className={`rounded-lg border p-3 text-xs whitespace-pre-wrap leading-relaxed font-serif ${
        highlight ? 'border-purple-100 bg-purple-50/30 text-gray-900' : 'border-gray-200 bg-gray-50 text-gray-800'
      }`}>
        {text || <span className="italic text-gray-400">[vacío]</span>}
      </div>
    </div>
  )
}
