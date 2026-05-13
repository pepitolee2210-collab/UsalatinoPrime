import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { logActivity, SUBCATEGORIES } from '@/lib/activity/log-activity'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, employee_type')
    .eq('id', user.id)
    .single()

  // Admin o contracts_manager (Andrium). Antes solo admin podía marcar
  // pagos; el contracts_manager necesita esto para su trabajo diario
  // de actualizar cobros desde el dashboard.
  const isAdmin = profile?.role === 'admin'
  const isContractsManager =
    profile?.role === 'employee' && profile?.employee_type === 'contracts_manager'
  if (!isAdmin && !isContractsManager) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json()
  const { payment_id, payment_method, notes } = body

  if (!payment_id) {
    return NextResponse.json({ error: 'payment_id requerido' }, { status: 400 })
  }

  const { data: payment, error } = await supabase
    .from('payments')
    .update({
      status: 'completed',
      payment_method: payment_method || 'manual',
      paid_at: new Date().toISOString(),
      notes,
    })
    .eq('id', payment_id)
    .eq('status', 'pending')
    .select('*, case:cases(client_id)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!payment) return NextResponse.json({ error: 'Pago no encontrado o ya completado' }, { status: 404 })

  // Auto-grant access when any payment is marked as completed
  if (payment.case_id) {
    await supabase
      .from('cases')
      .update({ access_granted: true })
      .eq('id', payment.case_id)
  }

  // Notify client
  const clientId = (payment as any).case?.client_id
  if (clientId) {
    await supabase.from('notifications').insert({
      user_id: clientId,
      case_id: payment.case_id,
      title: 'Pago Registrado',
      message: `Su pago de cuota ${payment.installment_number}/${payment.total_installments} por $${payment.amount} ha sido registrado.`,
      type: 'payment',
    })
  }

  if (payment.case_id) {
    await logActivity({
      caseId: payment.case_id,
      category: 'payment',
      subcategory: SUBCATEGORIES.PAYMENT_MARKED_PAID,
      description: `Pago marcado como recibido — cuota ${payment.installment_number}/${payment.total_installments} ($${payment.amount})`,
      metadata: {
        payment_id: payment.id,
        amount: payment.amount,
        installment_number: payment.installment_number,
        total_installments: payment.total_installments,
        payment_method: payment.payment_method,
      },
      visibleToClient: true,
      actor: { kind: 'session', supabase },
    })
  }

  return NextResponse.json({ payment })
}
