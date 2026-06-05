'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { SignatureCanvas } from '@/components/shared/SignatureCanvas'
import {
  TERMS_SECTIONS,
  TERMS_VERSION,
  interpolate,
  type TermsTokens,
} from '@/lib/legal/terms-and-conditions'

interface TerminosScreenProps {
  token: string
  clientName: string
  caseNumber: string
  serviceName: string
  /** Notifica al shell que el cliente acaba de aceptar (limpia banner/badge sin recargar). */
  onAccepted?: () => void
}

interface AcceptanceState {
  id: string
  accepted_at: string
  document_id: string | null
}

function formatDateLong(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-US', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function TerminosScreen({ token, clientName, caseNumber, serviceName, onAccepted }: TerminosScreenProps) {
  const [loading, setLoading] = useState(true)
  const [acceptance, setAcceptance] = useState<AcceptanceState | null>(null)
  const [signature, setSignature] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  useEffect(() => {
    fetch(`/api/cita/${encodeURIComponent(token)}/terms-acceptance`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (j?.accepted && j?.acceptance) setAcceptance(j.acceptance)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  const tokens: TermsTokens = {
    clientName,
    serviceName,
    caseNumber,
    acceptedDate: formatDateLong(acceptance?.accepted_at ?? new Date().toISOString()),
  }

  async function handleSubmit() {
    if (!signature || !checked || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/cita/${encodeURIComponent(token)}/terms-acceptance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature_image: signature, accepted: true }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(j?.error || 'No se pudo registrar la aceptación. Intenta de nuevo.')
        return
      }
      const acc: AcceptanceState = j.acceptance ?? {
        id: 'ok',
        accepted_at: j.acceptedAt ?? new Date().toISOString(),
        document_id: j.documentId ?? null,
      }
      setAcceptance(acc)
      onAccepted?.()
    } catch {
      setError('Error de conexión. Verifica tu internet e intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <div
        className="rounded-2xl border p-8 text-center animate-pulse"
        style={{
          background: 'var(--color-ulp-surface-container-low)',
          borderColor: 'var(--color-ulp-outline-variant)',
        }}
      >
        <p className="ulp-body-sm" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
          Cargando términos y condiciones...
        </p>
      </div>
    )
  }

  // ── Aceptado ──
  if (acceptance) {
    const docUrl = acceptance.document_id
      ? `/api/client/preview-doc?token=${encodeURIComponent(token)}&id=${encodeURIComponent(acceptance.document_id)}&raw=1`
      : null
    return (
      <>
        <div className="space-y-4">
          <div
            className="rounded-2xl border p-6 text-center space-y-3"
            style={{
              background: 'var(--color-ulp-surface-container-lowest)',
              borderColor: 'var(--color-ulp-outline-variant)',
              borderLeftWidth: 3,
              borderLeftColor: 'var(--color-ulp-status-approved)',
            }}
          >
            <span
              className="material-symbols-outlined block mx-auto"
              data-fill="1"
              style={{ fontSize: 48, color: 'var(--color-ulp-status-approved)' }}
            >
              verified
            </span>
            <p className="ulp-body-md font-semibold" style={{ color: 'var(--color-ulp-on-surface)' }}>
              Términos y Condiciones aceptados
            </p>
            <p className="ulp-body-sm" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
              Aceptaste y firmaste el {formatDateLong(acceptance.accepted_at)}. Tu documento firmado quedó
              guardado y disponible para tu equipo legal.
            </p>
          </div>

          {docUrl && (
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border font-semibold transition-shadow hover:shadow-sm"
                style={{
                  background: 'var(--color-ulp-primary)',
                  borderColor: 'var(--color-ulp-primary)',
                  color: 'var(--color-ulp-on-primary)',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>visibility</span>
                Ver documento
              </button>
              <a
                href={docUrl}
                download="Terminos-y-Condiciones.pdf"
                className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border font-semibold transition-shadow hover:shadow-sm"
                style={{
                  background: 'var(--color-ulp-surface-container-lowest)',
                  borderColor: 'var(--color-ulp-outline-variant)',
                  color: 'var(--color-ulp-on-surface)',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>download</span>
                Descargar
              </a>
            </div>
          )}
        </div>

        {previewOpen && docUrl && <TerminosPreview url={docUrl} onClose={() => setPreviewOpen(false)} />}
      </>
    )
  }

  // ── Pendiente: leer + firmar + aceptar ──
  const canSubmit = !!signature && checked && !submitting

  return (
    <div className="space-y-5">
      <div
        className="rounded-2xl border p-4 flex gap-3"
        style={{
          background: 'var(--color-ulp-primary-fixed)',
          borderColor: 'var(--color-ulp-outline-variant)',
        }}
      >
        <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: 22, color: 'var(--color-ulp-primary)' }}>
          gavel
        </span>
        <p className="ulp-body-sm" style={{ color: 'var(--color-ulp-on-surface)' }}>
          Por favor lee con atención este documento. Resume qué hacemos y qué no hacemos como empresa.
          Al final, dibuja tu firma y confirma que lo aceptas.
        </p>
      </div>

      {/* Documento legible */}
      <div
        className="rounded-2xl border max-h-[55vh] overflow-y-auto p-5 space-y-5"
        style={{
          background: 'var(--color-ulp-surface-container-lowest)',
          borderColor: 'var(--color-ulp-outline-variant)',
        }}
      >
        {TERMS_SECTIONS.map((section) => (
          <section key={section.id} className="space-y-2">
            <h3 className="ulp-body-md font-semibold" style={{ color: 'var(--color-ulp-on-surface)' }}>
              {section.title}
            </h3>
            {section.paragraphs.map((p, i) => (
              <p
                key={i}
                className="ulp-body-sm leading-relaxed"
                style={{ color: 'var(--color-ulp-on-surface-variant)' }}
              >
                {interpolate(p, tokens)}
              </p>
            ))}
          </section>
        ))}
        <p className="text-[10px] pt-2" style={{ color: 'var(--color-ulp-outline)' }}>
          Versión del documento: {TERMS_VERSION}
        </p>
      </div>

      {/* Firma */}
      <div className="space-y-2">
        <p className="ulp-label" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
          Dibuja tu firma
        </p>
        <SignatureCanvas onSignatureChange={setSignature} />
      </div>

      {/* Aceptación */}
      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-1 w-5 h-5 flex-shrink-0 accent-[var(--color-ulp-primary)]"
        />
        <span className="ulp-body-sm" style={{ color: 'var(--color-ulp-on-surface)' }}>
          He leído, entendido y acepto estos Términos y Condiciones, y reconozco que mi firma electrónica
          tiene plena validez legal.
        </span>
      </label>

      {error && (
        <p className="ulp-body-sm" style={{ color: 'var(--color-ulp-error, #b3261e)' }}>
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl font-semibold transition-opacity"
        style={{
          background: 'var(--color-ulp-primary)',
          color: 'var(--color-ulp-on-primary)',
          opacity: canSubmit ? 1 : 0.5,
          cursor: canSubmit ? 'pointer' : 'not-allowed',
        }}
      >
        {submitting ? (
          'Registrando...'
        ) : (
          <>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>check_circle</span>
            Aceptar y firmar
          </>
        )}
      </button>
    </div>
  )
}

function TerminosPreview({ url, onClose }: { url: string; onClose: () => void }) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col"
      style={{
        background: 'rgba(0,0,0,0.85)',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      onClick={onClose}
    >
      <header className="flex items-center justify-between px-4 py-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <p className="text-white font-semibold text-sm truncate flex-1 mr-4">Términos y Condiciones</p>
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.12)' }}
          aria-label="Cerrar"
        >
          <span className="material-symbols-outlined text-white" style={{ fontSize: 20 }}>close</span>
        </button>
      </header>
      <div className="flex-1 px-4 pb-4" onClick={(e) => e.stopPropagation()}>
        <iframe src={url} className="w-full h-full rounded-xl bg-white" title="Términos y Condiciones" />
      </div>
    </div>,
    document.body,
  )
}
