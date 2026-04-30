'use client'

import { useRef, useState } from 'react'
import { Languages, FileUp, FileText, Trash2, Loader2, Download, Sparkles, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import type { TranslatedDoc } from '@/lib/translation/schema'

interface Props {
  /** Nombre del traductor por defecto (se puede editar en la UI). */
  defaultTranslatorName?: string
}

const MAX_BYTES = 8 * 1024 * 1024

export function TranslationTool({ defaultTranslatorName = '' }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [doc, setDoc] = useState<TranslatedDoc | null>(null)
  const [translatorName, setTranslatorName] = useState(defaultTranslatorName)
  const [translatorDate, setTranslatorDate] = useState<string>(() =>
    new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  )
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(picked: File | null | undefined) {
    if (!picked) return
    if (picked.size > MAX_BYTES) {
      toast.error('El archivo supera el límite de 8 MB')
      return
    }
    const ok = picked.type.startsWith('application/pdf') || picked.type.startsWith('image/')
    if (!ok) {
      toast.error('Solo se permiten PDF o imágenes')
      return
    }
    setFile(picked)
    setDoc(null) // si había una traducción previa, la limpiamos al cambiar archivo
  }

  async function handleTranslate() {
    if (!file) return toast.error('Selecciona un archivo primero')
    setTranslating(true)
    setDoc(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/translation/translate-document', {
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
      setDoc(data.doc as TranslatedDoc)
      toast.success('Traducción lista. Revisa antes de descargar.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error de red')
    } finally {
      setTranslating(false)
    }
  }

  async function handleDownload() {
    if (!doc) return
    setGeneratingPdf(true)
    try {
      // Lazy-load para no bundlear jsPDF en el primer paint
      const { buildTranslationPDF } = await import('@/lib/translation/build-pdf')
      const blob = buildTranslationPDF({
        doc,
        translatorName: translatorName.trim(),
        translatorDate: translatorDate.trim(),
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const fileName = `${doc.title.replace(/[^a-zA-Z0-9]+/g, '_')}_TRANSLATION.pdf`
      a.download = fileName
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
    <div className="space-y-5 max-w-3xl">
      {/* Header explicativo */}
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Languages className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Traductor de documentos civiles</h2>
            <p className="text-sm text-gray-600 mt-0.5">
              Sube un acta de nacimiento, matrimonio, cédula o cualquier documento oficial en español.
              Gemini lo traduce al inglés con formato certificado y descargas el PDF listo para firma.
            </p>
          </div>
        </div>
      </div>

      {/* Upload */}
      <div>
        <Label className="text-xs font-medium text-gray-700 block mb-2">
          Documento original (PDF o imagen, máx. 8 MB)
        </Label>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/*"
          onChange={e => handleFile(e.target.files?.[0])}
          className="sr-only"
          aria-hidden="true"
        />

        {!file ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault()
              setDragOver(false)
              handleFile(e.dataTransfer.files?.[0])
            }}
            className={`w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-10 px-4 transition-colors text-center ${
              dragOver
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/30'
            }`}
          >
            <FileUp className="w-9 h-9 text-blue-500" />
            <div>
              <p className="text-sm font-semibold text-gray-900">Haz click para seleccionar el documento</p>
              <p className="text-[11px] text-gray-500 mt-0.5">o arrastra y suelta aquí · PDF o imagen · máx. 8 MB</p>
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
                setDoc(null)
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

      {/* Datos del traductor (van en la página de Translation Certification) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium text-gray-700 block mb-1">
            Nombre del traductor
          </Label>
          <Input
            value={translatorName}
            onChange={e => setTranslatorName(e.target.value)}
            placeholder="Ej. Andrew Sonny Navarro"
          />
        </div>
        <div>
          <Label className="text-xs font-medium text-gray-700 block mb-1">
            Fecha (texto libre)
          </Label>
          <Input
            value={translatorDate}
            onChange={e => setTranslatorDate(e.target.value)}
            placeholder="Ej. April 30, 2026"
          />
        </div>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          onClick={handleTranslate}
          disabled={!file || translating}
          className="bg-[#F2A900] hover:bg-[#D4940A] text-[#001020] font-bold"
        >
          {translating ? (
            <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Traduciendo con Gemini...</>
          ) : doc ? (
            <><Sparkles className="w-4 h-4 mr-1.5" /> Volver a traducir</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-1.5" /> Traducir documento</>
          )}
        </Button>
        {doc && (
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

      {/* Preview de la traducción */}
      {doc && <TranslationPreview doc={doc} />}
    </div>
  )
}

function TranslationPreview({ doc }: { doc: TranslatedDoc }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4 shadow-sm">
      <div className="flex items-start justify-between gap-3 pb-3 border-b">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Vista previa</p>
          <h3 className="text-2xl font-bold text-blue-600 leading-tight mt-0.5">{doc.title}</h3>
        </div>
        <div className="text-[11px] text-gray-400 italic flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" />
          Revisa antes de descargar
        </div>
      </div>

      {/* Header */}
      {doc.header?.length > 0 && (
        <div className="space-y-0.5">
          {doc.header.map((line, i) => (
            <p key={i} className="text-sm font-semibold text-gray-900">{line}</p>
          ))}
        </div>
      )}

      {/* Bloques */}
      <div className="space-y-3 text-sm text-gray-800">
        {doc.blocks.map((block, i) => {
          if (block.type === 'paragraph') {
            return <p key={i} className="leading-relaxed">{block.text}</p>
          }
          if (block.type === 'fields') {
            return (
              <div key={i} className="space-y-0.5">
                {block.items.map((it, j) => (
                  <p key={j}><span className="font-semibold">{it.label}:</span> {it.value}</p>
                ))}
              </div>
            )
          }
          if (block.type === 'section') {
            return (
              <div key={i}>
                <p className="font-bold text-gray-900 mb-1.5">
                  {block.number != null ? `${block.number}. ${block.heading}` : block.heading}
                </p>
                {block.items?.map((it, j) => (
                  <p key={j}><span className="font-semibold">{it.label}:</span> {it.value}</p>
                ))}
                {block.paragraph && <p className="leading-relaxed">{block.paragraph}</p>}
              </div>
            )
          }
          if (block.type === 'note') {
            return <p key={i} className="italic text-gray-600 text-xs">{block.text}</p>
          }
          return null
        })}
      </div>

      {doc.footer_paragraph && (
        <p className="text-sm text-gray-800 leading-relaxed pt-3 border-t">{doc.footer_paragraph}</p>
      )}
      {doc.signature_label && (
        <p className="text-sm font-bold text-gray-900">{doc.signature_label}</p>
      )}
    </div>
  )
}
