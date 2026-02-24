import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Verify admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { zelle_id, action, notes } = await request.json()

  if (!zelle_id || !action || !['approved', 'rejected'].includes(action)) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  // Get the zelle payment
  const { data: zelle } = await serviceClient
    .from('zelle_payments')
    .select('user_id')
    .eq('id', zelle_id)
    .single()

  if (!zelle) {
    return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })
  }

  // Update zelle payment
  await serviceClient
    .from('zelle_payments')
    .update({
      status: action,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      notes: notes || null,
    })
    .eq('id', zelle_id)

  if (action === 'approved') {
    // Activate membership for 30 days
    const periodStart = new Date()
    const periodEnd = new Date()
    periodEnd.setDate(periodEnd.getDate() + 30)

    await serviceClient
      .from('community_memberships')
      .upsert({
        user_id: zelle.user_id,
        status: 'active',
        payment_method: 'zelle',
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    // Notify user
    await serviceClient.from('notifications').insert({
      user_id: zelle.user_id,
      title: '¡Membresía Activada!',
      message: 'Su pago por Zelle ha sido aprobado. Ya tiene acceso completo a la comunidad UsaLatinoPrime.',
      type: 'success',
    })
  } else {
    // Notify user of rejection
    await serviceClient.from('notifications').insert({
      user_id: zelle.user_id,
      title: 'Pago Zelle No Aprobado',
      message: notes
        ? `Su comprobante de Zelle no fue aprobado. Motivo: ${notes}`
        : 'Su comprobante de Zelle no fue aprobado. Por favor intente nuevamente o contacte soporte.',
      type: 'warning',
    })
  }

  return NextResponse.json({ success: true })
}
