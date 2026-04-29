import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { AUTOMATED_FORMS } from '@/lib/legal/automated-forms-registry'
import { isFieldEditableByClient } from '@/lib/legal/field-policy'

/**
 * GET /api/admin/cases/[id]/forms-meta
 *
 * Lista resumida de case_form_instances del caso con metadata de progreso
 * del cliente: cuántos campos llenó, última edición, si está bloqueado.
 *
 * Útil para que la jurisdiction-panel muestre badges de estado al lado
 * de cada FormCard interactiva.
 */

interface MetaEntry {
  slug: string
  form_name: string
  total_user_fields: number
  filled_user_fields: number
  client_last_edit_at: string | null
  client_submitted_at: string | null
  locked_for_client: boolean
  status: string
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin' && profile?.role !== 'employee') {
    return NextResponse.json({ error: 'Solo staff' }, { status: 403 })
  }

  const { data: instances } = await service
    .from('case_form_instances')
    .select('form_name, filled_values, status, locked_for_client, client_last_edit_at, client_submitted_at')
    .eq('case_id', id)

  const metaList: MetaEntry[] = []
  for (const def of Object.values(AUTOMATED_FORMS)) {
    const inst = instances?.find((i) => i.form_name === def.formName)
    const userFields = Object.values(def.fieldByKey).filter((f) => isFieldEditableByClient(f))
    const total = userFields.length

    let filled = 0
    if (inst?.filled_values) {
      const fv = inst.filled_values as Record<string, unknown>
      for (const f of userFields) {
        const v = fv[f.semanticKey]
        if (v != null && (typeof v !== 'string' || v.trim() !== '')) filled++
      }
    }

    metaList.push({
      slug: def.slug,
      form_name: def.formName,
      total_user_fields: total,
      filled_user_fields: filled,
      client_last_edit_at: inst?.client_last_edit_at ?? null,
      client_submitted_at: inst?.client_submitted_at ?? null,
      locked_for_client: !!inst?.locked_for_client,
      status: inst?.status ?? 'pending',
    })
  }

  return NextResponse.json({ meta: metaList })
}
