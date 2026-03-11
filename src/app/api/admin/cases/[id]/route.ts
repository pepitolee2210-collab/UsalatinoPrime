import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return null
  return service
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const service = await verifyAdmin()
    if (!service) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params

    // Verify case exists
    const { data: caseData } = await service
      .from('cases')
      .select('id, case_number')
      .eq('id', id)
      .single()

    if (!caseData) {
      return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
    }

    // Delete related data in order (foreign keys)
    // 1. Delete case form submissions
    await service.from('case_form_submissions').delete().eq('case_id', id)

    // 2. Delete documents records (storage files cleaned separately if needed)
    const { data: docs } = await service
      .from('documents')
      .select('file_path')
      .eq('case_id', id)

    if (docs && docs.length > 0) {
      const paths = docs.map(d => d.file_path).filter(Boolean)
      if (paths.length > 0) {
        await service.storage.from('case-documents').remove(paths)
      }
    }
    await service.from('documents').delete().eq('case_id', id)

    // 3. Delete the case itself
    const { error } = await service.from('cases').delete().eq('id', id)

    if (error) {
      return NextResponse.json({ error: 'Error al eliminar caso' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Caso eliminado', case_number: caseData.case_number })
  } catch {
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
