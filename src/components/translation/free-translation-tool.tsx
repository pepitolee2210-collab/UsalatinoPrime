'use client'

import { useRef, useState } from 'react'
import {
  BookOpenText, FileUp, FileText, Trash2, Loader2, Download, Sparkles,
  AlertTriangle, ArrowRight, ArrowLeftRight,
} from 'lucide-react'
import { toast } from 'sonner'
import type {
  FreeTranslationResult,
  TranslationDirection,
} from '@/lib/translation/free-translate'

const MAX_BYTES = 16 * 1024 * 1024

const BTN_PRIMARY =
  'inline-flex items-center gap-2 px-5 py-2.5 rounded-full transition-all duration-200 hover:opacity-90 active:scale-95 disabled:opacity-50 ' +
  'bg-white text-black text-[13px] font-semibold tracking-tight ' +
  'shadow-[0_4px_20px_rgba(255,255,255,0.18),0_0_0_0.5px_rgba(255,255,255,0.4)_inset]'

const BTN_SUCCESS =
  'inline-flex items-center gap-2 px-5 py-2.5 rounded-full transition-all duration-200 hover:bg-emerald-500/15 active:scale-95 disabled:opacity-50 ' +
  'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[13px] font-semibold tracking-tight'

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
      const { buildFreeTranslationPDF } = await import('@/lib/translation/build-free-pdf')
      const blob = buildFreeTranslationPDF({ result })
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
      <div
        className="relative rounded-2xl p-5 overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(20,20,20,0.92), rgba(8,8,8,0.92))',
          border: '0.5px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <span
          aria-hidden
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.4), transparent)' }}
        />
        <div className="relative flex items-start gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(167,139,250,0.18), rgba(167,139,250,0.04))',
              border: '0.5px solid rgba(167,139,250,0.3)',
            }}
          >
            <BookOpenText className="w-5 h-5" style={{ color: '#A78BFA' }} />
          </div>
          <div>
            <p style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 10, fontWeight: 500, letterSpacing: '0.2em', color: '#525252' }}>
              TRADUCCIÓN · LIBRE
            </p>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: '#FFFFFF', letterSpacing: '-0.018em', marginTop: 2 }}>
              Traducción libre de documentos
            </h2>
            <p style={{ fontSize: 13, color: '#A1A1A1', marginTop: 6, lineHeight: 1.55 }}>
              Sube cualquier PDF (declaraciones, cartas, anexos, court orders, etc.) y obtén una traducción
              en formato de 2 columnas (original ↔ traducción). El sello, firma o código del original se
              menciona descriptivamente en la traducción — el original no se altera.
            </p>
            <p
              style={{
                fontSize: 10,
                color: '#525252',
                marginTop: 8,
                fontFamily: 'var(--font-mono-tech)',
                letterSpacing: '0.05em',
              }}
            >
              PDF · HASTA 10 PÁGINAS · TAMAÑO MÁX 16 MB
            </p>
          </div>
        </div>
      </div>

      {/* Direction selector */}
      <div>
        <p
          className="block mb-2"
          style={{
            fontFamily: 'var(--font-mono-tech)',
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: '0.18em',
            color: '#A1A1A1',
          }}
        >
          DIRECCIÓN DE LA TRADUCCIÓN
        </p>
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
          className="inline-flex items-center gap-1.5 mt-2 transition-opacity hover:opacity-80"
          style={{
            fontFamily: 'var(--font-mono-tech)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.15em',
            color: '#A78BFA',
          }}
        >
          <ArrowLeftRight className="w-3 h-3" />
          INVERTIR DIRECCIÓN
        </button>
      </div>

      {/* Upload */}
      <div>
        <label
          className="block mb-2"
          style={{
            fontFamily: 'var(--font-mono-tech)',
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: '0.18em',
            color: '#A1A1A1',
          }}
        >
          DOCUMENTO (PDF O IMAGEN · MÁX 10 PÁGINAS · 16 MB)
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
            className="w-full flex flex-col items-center justify-center gap-3 rounded-2xl py-12 px-4 text-center transition-all duration-300"
            style={{
              background: dragOver ? 'rgba(167,139,250,0.06)' : 'rgba(255,255,255,0.02)',
              border: dragOver ? '2px dashed rgba(167,139,250,0.5)' : '2px dashed rgba(255,255,255,0.12)',
            }}
          >
            <div
              className="inline-flex items-center justify-center w-12 h-12 rounded-2xl"
              style={{
                background: 'rgba(167,139,250,0.12)',
                border: '0.5px solid rgba(167,139,250,0.25)',
              }}
            >
              <FileUp className="w-5 h-5" style={{ color: '#A78BFA' }} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#FFFFFF', letterSpacing: '-0.005em' }}>
                Click para seleccionar el documento
              </p>
              <p
                style={{
                  fontSize: 11,
                  color: '#525252',
                  marginTop: 4,
                  fontFamily: 'var(--font-mono-tech)',
                  letterSpacing: '0.05em',
                }}
              >
                O ARRASTRA Y SUELTA · PDF O IMAGEN · MÁX 10 PÁGINAS / 16 MB
              </p>
            </div>
          </button>
        ) : (
          <div
            className="rounded-xl p-3 flex items-center gap-3"
            style={{
              background: 'rgba(34,197,94,0.06)',
              border: '0.5px solid rgba(34,197,94,0.25)',
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: 'rgba(34,197,94,0.12)',
                border: '0.5px solid rgba(34,197,94,0.25)',
              }}
            >
              <FileText className="w-4 h-4" style={{ color: '#4ADE80' }} />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="truncate"
                style={{ fontSize: 13, fontWeight: 600, color: '#FFFFFF', letterSpacing: '-0.005em' }}
              >
                {file.name}
              </p>
              <p
                style={{
                  fontSize: 10,
                  color: '#86EFAC',
                  fontFamily: 'var(--font-mono-tech)',
                  letterSpacing: '0.05em',
                  marginTop: 2,
                }}
              >
                {(file.size / 1024).toFixed(0)} KB · {(file.type || 'ARCHIVO').toUpperCase()}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setFile(null)
                setResult(null)
                if (inputRef.current) inputRef.current.value = ''
              }}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-red-500/10"
              style={{ color: '#FCA5A5' }}
              title="Quitar archivo"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Aviso de sello */}
      <div
        className="rounded-xl p-4 flex items-start gap-3"
        style={{
          background: 'rgba(250,204,21,0.06)',
          border: '0.5px solid rgba(250,204,21,0.25)',
        }}
      >
        <Sparkles className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#FACC15' }} />
        <div className="space-y-1">
          <p style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', color: '#FACC15' }}>
            CÓMO SE MANEJAN SELLOS Y FIRMAS
          </p>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#FDE68A' }}>
            La traducción NO toca el documento original
          </p>
          <p style={{ fontSize: 12, color: '#A1A1A1', lineHeight: 1.55 }}>
            Si el original tiene sello del notario, firma manuscrita, código QR o sello apostillado, en la traducción se cita
            descriptivamente (ej. <span style={{ color: '#D4D4D8', fontStyle: 'italic' }}>[Sello del Notario]</span>,{' '}
            <span style={{ color: '#D4D4D8', fontStyle: 'italic' }}>[Firma de Juan Pérez]</span>) y el original se entrega
            junto con la traducción.
          </p>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={handleTranslate} disabled={!file || translating} className={BTN_PRIMARY}>
          {translating ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Traduciendo con Gemini…</>
          ) : result ? (
            <><Sparkles className="w-3.5 h-3.5" /> Volver a traducir</>
          ) : (
            <><Sparkles className="w-3.5 h-3.5" /> Traducir documento</>
          )}
        </button>
        {result && (
          <button onClick={handleDownload} disabled={generatingPdf} className={BTN_SUCCESS}>
            {generatingPdf ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generando PDF…</>
            ) : (
              <><Download className="w-3.5 h-3.5" /> Descargar PDF traducido</>
            )}
          </button>
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
      className="text-left rounded-2xl p-4 transition-all duration-300 hover:-translate-y-0.5"
      style={{
        background: active
          ? 'linear-gradient(180deg, rgba(167,139,250,0.12), rgba(167,139,250,0.04))'
          : 'rgba(255,255,255,0.025)',
        border: active ? '0.5px solid rgba(167,139,250,0.4)' : '0.5px solid rgba(255,255,255,0.08)',
        boxShadow: active ? '0 0 16px rgba(167,139,250,0.15)' : 'none',
      }}
    >
      <p
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: active ? '#C4B5FD' : '#FFFFFF',
          letterSpacing: '-0.005em',
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: 11,
          color: '#A1A1A1',
          marginTop: 3,
        }}
      >
        {sub}
      </p>
    </button>
  )
}

function FreePreview({ result }: { result: FreeTranslationResult }) {
  const sourceLabel = result.source_language === 'es' ? 'Original (Español)' : 'Original (English)'
  const targetLabel = result.target_language === 'es' ? 'Traducción (Español)' : 'Translation (English)'

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, rgba(20,20,20,0.92), rgba(8,8,8,0.92))',
        border: '0.5px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <div
        className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap"
        style={{
          background: 'rgba(255,255,255,0.02)',
          borderBottom: '0.5px solid rgba(255,255,255,0.08)',
        }}
      >
        <div>
          <p
            style={{
              fontFamily: 'var(--font-mono-tech)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.2em',
              color: '#525252',
            }}
          >
            VISTA PREVIA
          </p>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.005em', marginTop: 2 }}>
            {result.document_title}
          </h3>
        </div>
        <div
          className="inline-flex items-center gap-1.5"
          style={{
            fontFamily: 'var(--font-mono-tech)',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.15em',
            color: '#FDE68A',
          }}
        >
          <AlertTriangle className="w-3 h-3" />
          {result.pages.length} {result.pages.length === 1 ? 'PÁGINA' : 'PÁGINAS'} · REVISA ANTES DE DESCARGAR
        </div>
      </div>

      <div>
        {result.pages.map((p, i) => (
          <div
            key={i}
            className="px-5 py-4"
            style={{ borderBottom: i < result.pages.length - 1 ? '0.5px solid rgba(255,255,255,0.06)' : 'none' }}
          >
            <div
              className="flex items-center gap-2 mb-3"
              style={{
                fontFamily: 'var(--font-mono-tech)',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.15em',
                color: '#A1A1A1',
              }}
            >
              <span style={{ color: '#FFFFFF' }}>PÁGINA {i + 1}</span>
              <span style={{ color: '#525252' }}>/ {result.pages.length}</span>
              <ArrowRight className="w-3 h-3" style={{ color: '#A78BFA' }} />
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
      <p
        style={{
          fontFamily: 'var(--font-mono-tech)',
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.2em',
          color: highlight ? '#A78BFA' : '#525252',
          marginBottom: 6,
        }}
      >
        {label.toUpperCase()}
      </p>
      <div
        className="rounded-xl p-3 whitespace-pre-wrap"
        style={{
          background: highlight ? 'rgba(167,139,250,0.06)' : 'rgba(255,255,255,0.03)',
          border: highlight ? '0.5px solid rgba(167,139,250,0.2)' : '0.5px solid rgba(255,255,255,0.08)',
          fontSize: 12,
          color: '#D4D4D8',
          fontFamily: 'Georgia, serif',
          lineHeight: 1.6,
        }}
      >
        {text || (
          <span style={{ color: '#525252', fontStyle: 'italic' }}>[vacío]</span>
        )}
      </div>
    </div>
  )
}
