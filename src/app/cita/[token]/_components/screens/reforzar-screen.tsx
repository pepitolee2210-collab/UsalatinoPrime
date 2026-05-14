'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { EvidenceUrlsManager } from '../evidence-urls-manager'
import { UploadButton } from '../documents/upload-button'

interface ReforzarScreenProps {
  token: string
  clientName: string
}

interface AffidavitDoc {
  id: string
  name: string
  status: string
  uploaded_at: string
}

interface CredibleFearDraft {
  id: string
  version: number
  body_md: string
  sources: Array<{ url: string; title: string }>
  generated_at: string
  edited_by_diana: boolean
}

interface ScreenContext {
  affidavitDocTypeId: number | null
  affidavitUploads: AffidavitDoc[]
  draft: CredibleFearDraft | null
}

/**
 * Screen del cliente para Fase 2 (Reforzar Asilo) del servicio Asilo Político.
 *
 * Tres bloques verticales:
 *   1. Subir declaración jurada personal (.docx/.pdf) — alimenta la IA del
 *      Miedo Creíble.
 *   2. Agregar URLs de noticias/reportes que sustenten el caso — referencias
 *      externas que la IA cita.
 *   3. Previsualización del relato de Miedo Creíble cuando Diana lo genera.
 *
 * Diana / Henry son quienes pulsan el botón "Generar" — el cliente solo ve
 * el resultado para revisarlo. Esto está alineado con la separación de
 * roles del sistema: el cliente provee evidencia, la firma redacta.
 */
export function ReforzarScreen({ token, clientName }: ReforzarScreenProps) {
  const [loading, setLoading] = useState(true)
  const [ctx, setCtx] = useState<ScreenContext>({
    affidavitDocTypeId: null,
    affidavitUploads: [],
    draft: null,
  })

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      // Cargar required-documents (devuelve doc_type_id de affidavit) y draft current.
      const [reqRes, draftRes] = await Promise.all([
        fetch(`/api/cita/${encodeURIComponent(token)}/required-documents`, { cache: 'no-store' }),
        fetch(`/api/cita/${encodeURIComponent(token)}/credible-fear-current`, { cache: 'no-store' }),
      ])
      const reqJson = await reqRes.json().catch(() => ({}))
      const draftJson = await draftRes.json().catch(() => ({}))

      // Localizar el docItem del affidavit personal (code='asylum_personal_affidavit').
      type DocItem = {
        type_id: number
        code: string
        uploads?: Record<string, AffidavitDoc[]>
      }
      const categories: Array<{ docs?: DocItem[] }> = reqJson.categories ?? []
      let affidavitDocTypeId: number | null = null
      let affidavitUploads: AffidavitDoc[] = []
      for (const c of categories) {
        for (const d of c.docs ?? []) {
          if (d.code === 'asylum_personal_affidavit') {
            affidavitDocTypeId = d.type_id
            affidavitUploads = Object.values(d.uploads ?? {}).flat()
          }
        }
      }

      setCtx({
        affidavitDocTypeId,
        affidavitUploads,
        draft: draftJson.draft ?? null,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error cargando datos')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  if (loading) {
    return (
      <div className="ulp-screen px-6 py-6 max-w-2xl mx-auto space-y-4">
        <div className="h-32 rounded-2xl animate-pulse bg-gray-100" />
        <div className="h-48 rounded-2xl animate-pulse bg-gray-100" />
      </div>
    )
  }

  const hasAffidavit = ctx.affidavitUploads.length > 0

  return (
    <div className="ulp-screen px-6 py-6 max-w-2xl mx-auto space-y-6">
      <header>
        <p className="ulp-label" style={{ color: 'var(--color-ulp-outline)' }}>
          Fase 02
        </p>
        <h1 className="ulp-h1 italic mt-1" style={{ color: 'var(--color-ulp-on-secondary-fixed)' }}>
          Reforzar Asilo
        </h1>
        <p className="ulp-body-md mt-2" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
          Hola {clientName}. En esta fase recopilamos tu declaración personal y
          evidencias externas. Con esa información, nuestra IA legal redacta el
          relato formal de Miedo Creíble que va a USCIS.
        </p>
      </header>

      {/* 1. Declaración jurada */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
        <header className="flex items-start gap-3">
          <span
            className="material-symbols-outlined text-purple-700"
            data-fill="1"
            style={{ fontSize: 22 }}
          >
            description
          </span>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-gray-900">
              1. Declaración jurada personal
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Sube un Word o PDF con tu historia personal en detalle. La IA lee el
              archivo para construir el relato formal.
            </p>
          </div>
        </header>

        {hasAffidavit ? (
          <ul className="space-y-1.5">
            {ctx.affidavitUploads.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200"
              >
                <span className="material-symbols-outlined text-emerald-700" style={{ fontSize: 16 }}>
                  check_circle
                </span>
                <span className="flex-1 truncate text-emerald-900">{f.name}</span>
                <span className="text-[10px] text-emerald-700 uppercase font-bold">
                  {f.status}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
            ⚠ Aún no has subido tu declaración. Sin este archivo no se puede
            generar el Miedo Creíble.
          </p>
        )}

        {ctx.affidavitDocTypeId !== null && (
          <UploadButton
            token={token}
            documentTypeId={ctx.affidavitDocTypeId}
            label={hasAffidavit ? 'Reemplazar declaración' : 'Subir declaración jurada'}
            variant="primary"
            onUploaded={fetchAll}
            onError={(msg) => toast.error(msg)}
          />
        )}
      </section>

      {/* 2. URLs de evidencias */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
        <header className="flex items-start gap-3">
          <span
            className="material-symbols-outlined text-blue-700"
            data-fill="1"
            style={{ fontSize: 22 }}
          >
            link
          </span>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-gray-900">
              2. URLs de evidencia
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Agrega enlaces a noticias, reportes de DD.HH., publicaciones de
              redes o cualquier fuente externa que respalde tu caso. Máximo 20.
            </p>
          </div>
        </header>
        <EvidenceUrlsManager token={token} />
      </section>

      {/* 3. Preview Miedo Creíble */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
        <header className="flex items-start gap-3">
          <span
            className="material-symbols-outlined text-amber-700"
            data-fill="1"
            style={{ fontSize: 22 }}
          >
            shield_person
          </span>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-gray-900">
              3. Tu relato de Miedo Creíble
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Cuando la firma genere tu relato verás aquí la versión actual.
              Pasa a tu próxima cita con Diana para revisarlo juntos.
            </p>
          </div>
        </header>

        {ctx.draft ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider text-gray-500">
              <span>Versión {ctx.draft.version}</span>
              <span>·</span>
              <span>{new Date(ctx.draft.generated_at).toLocaleDateString('es-MX')}</span>
              {ctx.draft.edited_by_diana && (
                <span className="ml-auto text-emerald-700">Revisado por Diana</span>
              )}
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 max-h-96 overflow-y-auto whitespace-pre-wrap text-xs text-gray-800 leading-relaxed">
              {ctx.draft.body_md}
            </div>
            {ctx.draft.sources.length > 0 && (
              <div className="text-[10px] text-gray-500">
                <p className="font-bold uppercase mb-1">Fuentes citadas:</p>
                <ul className="space-y-0.5">
                  {ctx.draft.sources.map((s, i) => (
                    <li key={i} className="truncate">
                      [{i + 1}]{' '}
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">
            Aún no hay relato generado. Cuando subas tu declaración y URLs, la
            firma lo generará en tu próxima sesión.
          </p>
        )}
      </section>
    </div>
  )
}
