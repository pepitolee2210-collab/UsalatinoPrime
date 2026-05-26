'use client'

import { useRef, useState } from 'react'
import { Languages, FileUp, FileText, Trash2, Loader2, Download, Sparkles, AlertTriangle, Plus } from 'lucide-react'
import { toast } from 'sonner'
import type { TranslatedDoc } from '@/lib/translation/schema'

const MAX_BYTES = 8 * 1024 * 1024
const MAX_FILES = 2

const SIGNATURE_PATH = '/translation-cert/signature.png'

const BTN_PRIMARY =
  'inline-flex items-center gap-2 px-5 py-2.5 rounded-full transition-all duration-200 hover:opacity-90 active:scale-95 disabled:opacity-50 ' +
  'bg-white text-black text-[13px] font-semibold tracking-tight ' +
  'shadow-[0_4px_20px_rgba(255,255,255,0.18),0_0_0_0.5px_rgba(255,255,255,0.4)_inset]'

const BTN_SUCCESS =
  'inline-flex items-center gap-2 px-5 py-2.5 rounded-full transition-all duration-200 hover:bg-emerald-500/15 active:scale-95 disabled:opacity-50 ' +
  'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[13px] font-semibold tracking-tight'

export function TranslationTool() {
  const [files, setFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [doc, setDoc] = useState<TranslatedDoc | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function isPdf(f: File) {
    return (f.type || '').startsWith('application/pdf')
  }
  function isImage(f: File) {
    return (f.type || '').startsWith('image/')
  }

  function addFiles(picked: FileList | File[] | null | undefined) {
    if (!picked) return
    const incoming = Array.from(picked)
    if (incoming.length === 0) return

    setFiles(prev => {
      const merged: File[] = [...prev]
      for (const f of incoming) {
        if (!isPdf(f) && !isImage(f)) {
          toast.error(`"${f.name}" no es PDF ni imagen`)
          continue
        }
        if (f.size > MAX_BYTES) {
          toast.error(`"${f.name}" supera el límite de ${MAX_BYTES / 1024 / 1024} MB`)
          continue
        }
        if (merged.some(isPdf) || isPdf(f)) {
          if (merged.length >= 1) {
            toast.error(isPdf(f)
              ? 'Si subes un PDF debe ser el único archivo. Para 2 páginas, súbelas dentro del mismo PDF.'
              : 'Ya hay un PDF cargado. Quítalo primero si quieres subir imágenes.')
            continue
          }
        }
        if (merged.length >= MAX_FILES) {
          toast.error(`Máximo ${MAX_FILES} archivos.`)
          continue
        }
        merged.push(f)
      }
      return merged
    })
    setDoc(null)
  }

  function removeFile(idx: number) {
    setFiles(prev => prev.filter((_, i) => i !== idx))
    setDoc(null)
  }

  async function handleTranslate() {
    if (files.length === 0) return toast.error('Selecciona al menos un archivo')
    setTranslating(true)
    setDoc(null)
    try {
      const fd = new FormData()
      for (const f of files) fd.append('files', f)
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
      {/* Info card */}
      <div
        className="relative rounded-2xl p-5 overflow-hidden"
        style={{
          background: 'var(--admin-panel-grad)',
          border: '0.5px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <span
          aria-hidden
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(96,165,250,0.4), transparent)' }}
        />
        <div className="relative flex items-start gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(96,165,250,0.18), rgba(96,165,250,0.04))',
              border: '0.5px solid rgba(96,165,250,0.3)',
            }}
          >
            <Languages className="w-5 h-5" style={{ color: 'var(--admin-blue)' }} />
          </div>
          <div>
            <p style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 10, fontWeight: 500, letterSpacing: '0.2em', color: 'var(--admin-fg-subtle)' }}>
              TRADUCTOR · DOCUMENTOS CIVILES
            </p>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--admin-fg)', letterSpacing: '-0.018em', marginTop: 2 }}>
              Traductor de actas civiles
            </h2>
            <p style={{ fontSize: 13, color: 'var(--admin-fg-muted)', marginTop: 6, lineHeight: 1.55 }}>
              Sube un acta de nacimiento, matrimonio, cédula u otro documento oficial en español.
              Gemini lo traduce al inglés con el formato certificado de UsaLatino Prime, incluye la página de
              <span style={{ color: 'var(--admin-fg)', fontWeight: 600 }}> Translation Certification</span> firmada por
              <span style={{ color: 'var(--admin-fg)', fontWeight: 600 }}> Andrew Sonny Navarro</span> y descargas el PDF listo para entregar.
            </p>
            <p
              style={{
                fontSize: 10,
                color: 'var(--admin-fg-subtle)',
                marginTop: 8,
                fontFamily: 'var(--font-mono-tech)',
                letterSpacing: '0.05em',
              }}
            >
              IMÁGENES · HASTA 2 (FRENTE/REVERSO O 2 HOJAS) · JPG/PNG/HEIC/WEBP
              <br />
              PDF · 1 ARCHIVO MÁX 2 PÁGINAS · CADA UNO HASTA 8 MB
            </p>
          </div>
        </div>
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
            color: 'var(--admin-fg-muted)',
          }}
        >
          DOCUMENTO ORIGINAL
        </label>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/*"
          multiple
          onChange={e => {
            addFiles(e.target.files)
            if (inputRef.current) inputRef.current.value = ''
          }}
          className="sr-only"
          aria-hidden="true"
        />

        {files.length === 0 ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault()
              setDragOver(false)
              addFiles(e.dataTransfer.files)
            }}
            className="w-full flex flex-col items-center justify-center gap-3 rounded-2xl py-12 px-4 text-center transition-all duration-300"
            style={{
              background: dragOver ? 'rgba(96,165,250,0.06)' : 'rgba(255,255,255,0.02)',
              border: dragOver ? '2px dashed rgba(96,165,250,0.5)' : '2px dashed rgba(255,255,255,0.12)',
            }}
          >
            <div
              className="inline-flex items-center justify-center w-12 h-12 rounded-2xl"
              style={{
                background: 'var(--admin-blue-soft)',
                border: '0.5px solid rgba(96,165,250,0.25)',
              }}
            >
              <FileUp className="w-5 h-5" style={{ color: 'var(--admin-blue)' }} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--admin-fg)', letterSpacing: '-0.005em' }}>
                Click para seleccionar archivos
              </p>
              <p
                style={{
                  fontSize: 11,
                  color: 'var(--admin-fg-subtle)',
                  marginTop: 4,
                  fontFamily: 'var(--font-mono-tech)',
                  letterSpacing: '0.05em',
                }}
              >
                O ARRASTRA Y SUELTA · HASTA 2 IMÁGENES O 1 PDF · MÁX 8 MB
              </p>
            </div>
          </button>
        ) : (
          <div className="space-y-2">
            {files.map((f, i) => (
              <div
                key={`${f.name}-${i}`}
                className="rounded-xl p-3 flex items-center gap-3"
                style={{
                  background: 'var(--admin-green-soft)',
                  border: '0.5px solid rgba(34,197,94,0.25)',
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: 'var(--admin-green-soft)',
                    border: '0.5px solid rgba(34,197,94,0.25)',
                  }}
                >
                  <FileText className="w-4 h-4" style={{ color: 'var(--admin-green)' }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate"
                    style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-fg)', letterSpacing: '-0.005em' }}
                  >
                    {f.name}
                  </p>
                  <p
                    style={{
                      fontSize: 10,
                      color: 'var(--admin-green)',
                      fontFamily: 'var(--font-mono-tech)',
                      letterSpacing: '0.05em',
                      marginTop: 2,
                    }}
                  >
                    {(f.size / 1024).toFixed(0)} KB · {(f.type || 'ARCHIVO').toUpperCase()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-red-500/10"
                  style={{ color: 'var(--admin-red)' }}
                  title="Quitar archivo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {files.length < MAX_FILES && !files.some(isPdf) && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="w-full rounded-xl py-3 px-4 flex items-center justify-center gap-2 transition-all duration-200 hover:bg-white/5"
                style={{
                  background: 'var(--admin-accent-soft)',
                  border: '2px dashed rgba(255,255,255,0.12)',
                  color: 'var(--admin-fg-muted)',
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: '-0.005em',
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar otra imagen ({files.length}/{MAX_FILES})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Info de certificación */}
      <div
        className="rounded-xl p-4 flex items-start gap-3"
        style={{
          background: 'var(--admin-gold-soft)',
          border: '0.5px solid rgba(250,204,21,0.25)',
        }}
      >
        <Sparkles className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--admin-gold)' }} />
        <div className="space-y-1">
          <p style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--admin-gold)' }}>
            CERTIFICACIÓN AUTOMÁTICA
          </p>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-gold)' }}>
            Página firmada incluida en cada PDF
          </p>
          <p style={{ fontSize: 12, color: 'var(--admin-fg-muted)', lineHeight: 1.55 }}>
            Cada documento se genera con la página firmada por <span style={{ color: 'var(--admin-fg)', fontWeight: 600 }}>Andrew Sonny Navarro</span>{' '}
            y la fecha de hoy. No tienes que llenar nada — el formato es fijo según pidió Henry.
          </p>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={handleTranslate} disabled={files.length === 0 || translating} className={BTN_PRIMARY}>
          {translating ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Traduciendo con Gemini…</>
          ) : doc ? (
            <><Sparkles className="w-3.5 h-3.5" /> Volver a traducir</>
          ) : (
            <><Sparkles className="w-3.5 h-3.5" /> Traducir documento</>
          )}
        </button>
        {doc && (
          <button onClick={handleDownload} disabled={generatingPdf} className={BTN_SUCCESS}>
            {generatingPdf ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generando PDF…</>
            ) : (
              <><Download className="w-3.5 h-3.5" /> Descargar PDF traducido</>
            )}
          </button>
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
    <div
      className="rounded-2xl p-6 space-y-3"
      style={{
        background: 'var(--admin-panel-grad)',
        border: '0.5px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(20px)',
        fontFamily: 'Georgia, serif',
      }}
    >
      <div
        className="flex items-start justify-between gap-3 pb-3"
        style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}
      >
        <p
          style={{
            fontFamily: 'var(--font-mono-tech)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.2em',
            color: 'var(--admin-fg-subtle)',
          }}
        >
          VISTA PREVIA · TRADUCCIÓN
        </p>
        <div
          className="inline-flex items-center gap-1.5"
          style={{
            fontFamily: 'var(--font-mono-tech)',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.15em',
            color: 'var(--admin-gold)',
          }}
        >
          <AlertTriangle className="w-3 h-3" />
          REVISAR ANTES DE DESCARGAR
        </div>
      </div>

      <p style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--admin-fg)' }}>
        CERTIFIED TRANSLATION FROM SPANISH INTO ENGLISH
      </p>

      {doc.jurisdiction_header?.length > 0 && (
        <div className="space-y-0.5 pt-1">
          {doc.jurisdiction_header.map((line, i) => (
            <p key={i} style={{ fontSize: 13, fontWeight: 700, color: 'var(--admin-fg)' }}>{line}</p>
          ))}
        </div>
      )}

      {doc.document_type && (
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--admin-fg)', paddingTop: 4 }}>{doc.document_type}</p>
      )}

      {doc.registration_number && (
        <p style={{ fontSize: 13, color: 'var(--admin-fg-muted)' }}>
          <span style={{ fontWeight: 700, color: 'var(--admin-fg)' }}>Registration Number:</span> {doc.registration_number}
        </p>
      )}

      {doc.issuing_authority && (
        <p style={{ fontSize: 13, color: 'var(--admin-fg-muted)', lineHeight: 1.55, paddingTop: 4 }}>{doc.issuing_authority}</p>
      )}

      {doc.certification_verb && (
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--admin-fg)', paddingTop: 4 }}>{doc.certification_verb}</p>
      )}

      {doc.certification_paragraph && (
        <p style={{ fontSize: 13, color: 'var(--admin-fg-muted)', lineHeight: 1.55 }}>{doc.certification_paragraph}</p>
      )}

      {doc.registered_person_name && (
        <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--admin-fg)', paddingTop: 8 }}>{doc.registered_person_name}</p>
      )}

      <div className="space-y-0.5">
        {doc.primary_fields?.map((f, i) => (
          <p key={i} style={{ fontSize: 13, color: 'var(--admin-fg-muted)' }}>
            <span style={{ fontWeight: 700, color: 'var(--admin-fg)' }}>{f.label}:</span> {f.value}
          </p>
        ))}
      </div>

      {doc.parents?.length > 0 && (
        <div className="space-y-0.5 pt-2">
          {doc.parents.map((p, i) => (
            <p key={i} style={{ fontSize: 13, color: 'var(--admin-fg-muted)' }}>
              <span style={{ fontWeight: 700, color: 'var(--admin-fg)' }}>{p.label}:</span> {p.line}
            </p>
          ))}
        </div>
      )}

      {doc.registration_fields?.length > 0 && (
        <div className="space-y-0.5 pt-2">
          {doc.registration_fields.map((f, i) => (
            <p key={i} style={{ fontSize: 13, color: 'var(--admin-fg-muted)' }}>
              <span style={{ fontWeight: 700, color: 'var(--admin-fg)' }}>{f.label}:</span> {f.value}
            </p>
          ))}
        </div>
      )}

      {doc.validation_paragraph && (
        <p style={{ fontSize: 12, color: 'var(--admin-fg-muted)', lineHeight: 1.55, paddingTop: 6 }}>{doc.validation_paragraph}</p>
      )}

      {doc.reference_codes?.length > 0 && (
        <div className="space-y-0.5 pt-2">
          {doc.reference_codes.map((c, i) => (
            <p key={i} style={{ fontSize: 13, color: 'var(--admin-fg-muted)' }}>
              <span style={{ fontWeight: 700, color: 'var(--admin-fg)' }}>{c.label}:</span> {c.value}
            </p>
          ))}
        </div>
      )}

      {(doc.signatory_name || doc.signatory_title) && (
        <div className="pt-3">
          {doc.signatory_name && (
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--admin-fg)' }}>{doc.signatory_name}</p>
          )}
          {doc.signatory_title && (
            <p style={{ fontSize: 13, color: 'var(--admin-fg-muted)' }}>{doc.signatory_title}</p>
          )}
        </div>
      )}

      {doc.closing_fields?.length > 0 && (
        <div className="space-y-0.5 pt-2">
          {doc.closing_fields.map((f, i) => (
            <p key={i} style={{ fontSize: 13, color: 'var(--admin-fg-muted)' }}>
              <span style={{ fontWeight: 700, color: 'var(--admin-fg)' }}>{f.label}:</span> {f.value}
            </p>
          ))}
        </div>
      )}

      {doc.closing_note && (
        <p style={{ fontSize: 12, color: 'var(--admin-fg-muted)', lineHeight: 1.55, paddingTop: 4, fontStyle: 'italic' }}>
          {doc.closing_note}
        </p>
      )}
    </div>
  )
}
