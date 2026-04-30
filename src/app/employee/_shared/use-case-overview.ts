'use client'

import { useCallback, useEffect, useState } from 'react'
import type { CaseOverview } from './phase-types'

export function useCaseOverview(caseId: string | null) {
  const [overview, setOverview] = useState<CaseOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOverview = useCallback(async () => {
    if (!caseId) {
      setOverview(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/cases/${caseId}/case-overview`, { cache: 'no-store' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Error al cargar el caso')
      }
      const data: CaseOverview = await res.json()
      setOverview(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [caseId])

  useEffect(() => {
    fetchOverview()
  }, [fetchOverview])

  return { overview, loading, error, refresh: fetchOverview }
}
