'use client'

import { useRef, useState } from 'react'
import { Languages, FileUp, FileText, Trash2, Loader2, Download, Sparkles, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import type { TranslatedDoc } from '@/lib/translation/schema'

interface Props {
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
  const [translatorAddress, setTranslatorAddress] = useState('')
  const [translatorContact, setTranslatorContact] = useState('')
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
      const { buildTranslationPDF } = await import('@/lib/translation/build-pdf')
      const blob = buildTranslationPDF({
        doc,
        translatorName: translatorName.trim(),
        translatorDate: translatorDate.trim(),
        translatorAddress: translatorAddress.trim(),
        translatorContact: translatorContact.trim(),
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
              Gemini lo traduce al inglés con el formato certificado de UsaLatino Prime y descargas el PDF
              listo para que el traductor lo firme.
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

      {/* Datos del traductor */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Datos del traductor (página de certificación)</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-medium text-gray-700 block mb-1">Translator's Name</Label>
            <Input
              value={translatorName}
              onChange={e => setTranslatorName(e.target.value)}
              placeholder="Andrew Sonny Navarro"
            />
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-700 block mb-1">Date</Label>
            <Input
              value={translatorDate}
              onChange={e => setTranslatorDate(e.target.value)}
              placeholder="April 30, 2026"
            />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs font-medium text-gray-700 block mb-1">Address (opcional)</Label>
            <Input
              value={translatorAddress}
              onChange={e => setTranslatorAddress(e.target.value)}
              placeholder="385 Address Lane, Salt Lake City, UT 84101"
            />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs font-medium text-gray-700 block mb-1">Phone / Email (opcional)</Label>
            <Input
              value={translatorContact}
              onChange={e => setTranslatorContact(e.target.value)}
              placeholder="(801) 941-3479 · translator@usalatino.com"
            />
          </div>
        </div>
        <p className="text-[11px] text-gray-500 italic">
          Si dejas Address o Phone/Email vacíos, el PDF deja una línea para escribirlos a mano.
        </p>
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

      {doc.original_document_title && (
        <p className="text-[11px] text-gray-400 italic pt-3 border-t">
          Documento original: <span className="font-medium">{doc.original_document_title}</span>
        </p>
      )}
    </div>
  )
}
