'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'

interface EvidenceUrl {
  id: string
  url: string
  title: string | null
  source_domain: string | null
  description: string | null
  reachable: boolean | null
  added_at: string
}

interface EvidenceUrlsManagerProps {
  token: string
}

/**
 * CRUD de URLs externas que el cliente agrega como evidencia en Fase 2
 * (Asilo Político — Reforzar). El generador de Miedo Creíble usa estas URLs
 * como fuentes verificables citables en el relato.
 *
 * Verificación de reachability se hace server-side (best-effort);
 * las URLs no alcanzables se muestran con badge gris pero NO se descartan
 * automáticamente para que el cliente pueda corregirlas.
 */
export function EvidenceUrlsManager({ token }: EvidenceUrlsManagerProps) {
  const [items, setItems] = useState<EvidenceUrl[]>([])
  const [loading, setLoading] = useState(true)
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchUrls = useCallback(async () => {
    try {
      const res = await fetch(`/api/cita/${encodeURIComponent(token)}/evidence-urls`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('Error al cargar evidencias')
      const j = await res.json()
      setItems(j.urls ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchUrls()
  }, [fetchUrls])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) return
    if (!/^https?:\/\//i.test(trimmed)) {
      toast.error('La URL debe empezar con http:// o https://')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/cita/${encodeURIComponent(token)}/evidence-urls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed, title: title.trim() || undefined }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Error al guardar')
      setUrl('')
      setTitle('')
      await fetchUrls()
      toast.success('URL agregada')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta URL?')) return
    try {
      const res = await fetch(`/api/cita/${encodeURIComponent(token)}/evidence-urls/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Error al eliminar')
      await fetchUrls()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleAdd} className="space-y-2">
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://reporte-derechos-humanos.org/..."
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]"
          disabled={saving}
        />
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título opcional (ej. 'Reporte sobre persecución en Tachira 2024')"
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#F2A900]"
          disabled={saving}
        />
        <button
          type="submit"
          disabled={saving || !url.trim()}
          className="w-full rounded-xl bg-[#002855] text-white text-sm font-semibold py-2.5 disabled:opacity-50"
        >
          {saving ? 'Agregando…' : 'Agregar URL de evidencia'}
        </button>
      </form>

      {loading ? (
        <p className="text-xs text-gray-400 text-center py-4">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">
          Todavía no agregaste URLs. La IA usa estas fuentes para respaldar tu relato.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li
              key={it.id}
              className="rounded-xl border border-gray-200 bg-white p-3 flex items-start gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate">
                  {it.title ?? it.source_domain ?? it.url}
                </p>
                <a
                  href={it.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-blue-700 break-all hover:underline"
                >
                  {it.url}
                </a>
                {it.reachable === false && (
                  <p className="text-[10px] mt-1 text-amber-700">
                    ⚠ No se pudo verificar — revisa la URL.
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDelete(it.id)}
                className="text-gray-400 hover:text-red-600 text-xs px-2 py-1"
                aria-label="Eliminar"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
