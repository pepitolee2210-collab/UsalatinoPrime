'use client'

import { useRef, useState } from 'react'
import { Languages, FileUp, FileText, Trash2, Loader2, Download, Sparkles, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { TranslatedDoc } from '@/lib/translation/schema'

const MAX_BYTES = 8 * 1024 * 1024

// Path del PNG de la firma del traductor oficial. Se sirve como asset estático.
const SIGNATURE_PATH = '/translation-cert/signature.png'

export function TranslationTool() {
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [doc, setDoc] = useState<TranslatedDoc | null>(null)
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
    setDoc(null)
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
      // Cargar la firma como dataURL para que jsPDF la incruste
      const signatureDataUrl = await loadImageAsDataUrl(SIGNATURE_PATH)
      const { buildTranslationPDF } = await import('@/lib/translation/build-pdf')
      const certDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
      const blob = buildTranslationPDF({
        doc,
        certDate,
        signatureDataUrl,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const namePart = (doc.registered_person_name || doc.document_type || 'TRANSLATION')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .toUpperCase()
      a.download = `${namePart}_TRANSLATION.pdf`
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
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Languages className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Traductor de documentos civiles</h2>
            <p className="text-sm text-gray-600 mt-0.5">
              Sube un acta de nacimiento, matrimonio, cédula u otro documento oficial en español.
              Gemini lo traduce al inglés con el formato certificado de UsaLatino Prime, incluye
              la página de Translation Certification firmada por Andrew Sonny Navarro y descargas
              el PDF listo para entregar.
            </p>
          </div>
        </div>
      </div>

      {/* Upload */}
      <div>
        <label className="text-xs font-medium text-gray-700 block mb-2">
          Documento original (PDF o imagen, máx. 8 MB)
        </label>

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

      {/* Info de la página de certificación (no es editable, es fija) */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-gray-700 space-y-1">
          <p className="font-semibold text-gray-900">Página de certificación incluida automáticamente</p>
          <p>
            Cada PDF se genera con la página firmada por <span className="font-semibold">Andrew Sonny Navarro</span>{' '}
            y la fecha de hoy. No tienes que llenar nada — Henry pidió que sea siempre el mismo formato.
          </p>
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

      {doc && <TranslationPreview doc={doc} />}
    </div>
  )
}

async function loadImageAsDataUrl(src: string): Promise<string | null> {
  try {
    const res = await fetch(src, { cache: 'force-cache' })
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string>(resolve => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function TranslationPreview({ doc }: { doc: TranslatedDoc }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-3 shadow-sm font-serif">
      <div className="flex items-start justify-between gap-3 pb-3 border-b">
        <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Vista previa de la traducción</p>
        <div className="text-[11px] text-gray-400 italic flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" />
          Revisa antes de descargar
        </div>
      </div>

      <p className="text-center text-sm font-bold text-gray-900">CERTIFIED TRANSLATION FROM SPANISH INTO ENGLISH</p>

      {doc.jurisdiction_header?.length > 0 && (
        <div className="space-y-0.5 pt-1">
          {doc.jurisdiction_header.map((line, i) => (
            <p key={i} className="text-sm font-bold text-gray-900">{line}</p>
          ))}
        </div>
      )}

      {doc.document_type && <p className="text-sm font-bold text-gray-900 pt-1">{doc.document_type}</p>}

      {doc.registration_number && (
        <p className="text-sm text-gray-800"><span className="font-bold">Registration Number:</span> {doc.registration_number}</p>
      )}

      {doc.issuing_authority && (
        <p className="text-sm text-gray-800 leading-relaxed pt-1">{doc.issuing_authority}</p>
      )}

      {doc.certification_verb && <p className="text-sm font-bold text-gray-900 pt-1">{doc.certification_verb}</p>}

      {doc.certification_paragraph && (
        <p className="text-sm text-gray-800 leading-relaxed">{doc.certification_paragraph}</p>
      )}

      {doc.registered_person_name && (
        <p className="text-base font-bold text-gray-900 pt-2">{doc.registered_person_name}</p>
      )}

      <div className="space-y-0.5 text-sm text-gray-800">
        {doc.primary_fields?.map((f, i) => (
          <p key={i}><span className="font-bold">{f.label}:</span> {f.value}</p>
        ))}
      </div>

      {doc.parents?.length > 0 && (
        <div className="space-y-0.5 text-sm text-gray-800 pt-1">
          {doc.parents.map((p, i) => (
            <p key={i}><span className="font-bold">{p.label}:</span> {p.line}</p>
          ))}
        </div>
      )}

      {doc.registration_fields?.length > 0 && (
        <div className="space-y-0.5 text-sm text-gray-800 pt-1">
          {doc.registration_fields.map((f, i) => (
            <p key={i}><span className="font-bold">{f.label}:</span> {f.value}</p>
          ))}
        </div>
      )}

      {doc.validation_paragraph && (
        <p className="text-xs text-gray-700 leading-relaxed pt-2">{doc.validation_paragraph}</p>
      )}

      {doc.reference_codes?.length > 0 && (
        <div className="space-y-0.5 text-sm text-gray-800 pt-1">
          {doc.reference_codes.map((c, i) => (
            <p key={i}><span className="font-bold">{c.label}:</span> {c.value}</p>
          ))}
        </div>
      )}

      {(doc.signatory_name || doc.signatory_title) && (
        <div className="pt-3">
          {doc.signatory_name && <p className="text-sm font-bold text-gray-900">{doc.signatory_name}</p>}
          {doc.signatory_title && <p className="text-sm text-gray-800">{doc.signatory_title}</p>}
        </div>
      )}

      {doc.closing_fields?.length > 0 && (
        <div className="space-y-0.5 text-sm text-gray-800 pt-1">
          {doc.closing_fields.map((f, i) => (
            <p key={i}><span className="font-bold">{f.label}:</span> {f.value}</p>
          ))}
        </div>
      )}

      {doc.closing_note && (
        <p className="text-xs text-gray-700 leading-relaxed pt-1 italic">{doc.closing_note}</p>
      )}
    </div>
  )
}
