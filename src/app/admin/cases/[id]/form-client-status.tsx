'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Lock, LockOpen, Loader2, Eye, Send, User } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface FormMetaEntry {
  slug: string
  form_name: string
  total_user_fields: number
  filled_user_fields: number
  client_last_edit_at: string | null
  client_submitted_at: string | null
  locked_for_client: boolean
  status: string
}

interface FormClientStatusProps {
  caseId: string
  slug: string
  refreshKey?: number
}

/**
 * Badge minimalista que muestra debajo de cada formulario interactivo en
 * jurisdiction-panel: "Cliente: 5/12 · hace 2h" + botón lock/unlock.
 *
 * Hace fetch de meta global del caso 1 vez al montar (se podría compartir
 * entre cards via context si fuera prioridad performance).
 */
export function FormClientStatus({ caseId, slug, refreshKey = 0 }: FormClientStatusProps) {
  const [meta, setMeta] = useState<FormMetaEntry | null>(null)
  const [toggling, setToggling] = useState(false)

  const load = useCallback(() => {
    fetch(`/api/admin/cases/${caseId}/forms-meta`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        const found = (j.meta as FormMetaEntry[] | undefined)?.find((m) => m.slug === slug)
        setMeta(found ?? null)
      })
      .catch(() => setMeta(null))
  }, [caseId, slug])

  useEffect(() => { load() }, [load, refreshKey])

  if (!meta) return null

  const hasClientActivity = meta.client_last_edit_at || meta.filled_user_fields > 0

  async function toggleLock() {
    if (!meta) return
    setToggling(true)
    try {
      const res = await fetch(`/api/admin/cases/${caseId}/forms/${slug}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locked: !meta.locked_for_client }),
      })
      if (!res.ok) throw new Error('Error')
      toast.success(meta.locked_for_client ? 'Edición del cliente desbloqueada' : 'Edición del cliente bloqueada')
      load()
    } catch {
      toast.error('Error al cambiar estado')
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 pt-1.5 border-t border-gray-100">
      <span className="inline-flex items-center gap-1 text-[10px] text-gray-600">
        <User className="w-3 h-3 text-blue-500" />
        Cliente:{' '}
        <strong className="tabular-nums text-gray-800">
          {meta.filled_user_fields}/{meta.total_user_fields}
        </strong>{' '}
        campos
      </span>

      {meta.client_last_edit_at && (
        <span
          className="inline-flex items-center gap-1 text-[10px] text-gray-500"
          title={format(new Date(meta.client_last_edit_at), "d MMM yyyy HH:mm", { locale: es })}
        >
          editó {formatDistanceToNow(new Date(meta.client_last_edit_at), { addSuffix: true, locale: es })}
        </span>
      )}

      {meta.client_submitted_at && (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
          <Send className="w-3 h-3" /> Enviado a revisión
        </span>
      )}

      {hasClientActivity && (
        <button
          type="button"
          onClick={toggleLock}
          disabled={toggling}
          className={`ml-auto inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors disabled:opacity-50 ${
            meta.locked_for_client
              ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {toggling ? (
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
          ) : meta.locked_for_client ? (
            <Lock className="w-2.5 h-2.5" />
          ) : (
            <LockOpen className="w-2.5 h-2.5" />
          )}
          {meta.locked_for_client ? 'Bloqueado' : 'Desbloqueado'}
        </button>
      )}
    </div>
  )
}
