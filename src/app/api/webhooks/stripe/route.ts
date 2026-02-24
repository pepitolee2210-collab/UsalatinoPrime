import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/service'
import Stripe from 'stripe'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // ===== COMMUNITY SUBSCRIPTION EVENTS =====

  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription
    const userId = subscription.metadata?.user_id
    const type = subscription.metadata?.type

    if (userId && type === 'community_subscription') {
      const status = subscription.status === 'active' ? 'active'
        : subscription.status === 'past_due' ? 'past_due'
        : subscription.status === 'canceled' ? 'cancelled'
        : 'free'

      await supabase
        .from('community_memberships')
        .upsert({
          user_id: userId,
          status,
          payment_method: 'stripe',
          stripe_subscription_id: subscription.id,
          stripe_customer_id: subscription.customer as string,
          current_period_start: new Date(((subscription as any).current_period_start ?? 0) * 1000).toISOString(),
          current_period_end: new Date(((subscription as any).current_period_end ?? 0) * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

      if (event.type === 'customer.subscription.created') {
        await supabase.from('notifications').insert({
          user_id: userId,
          title: '¡Bienvenido a la Comunidad!',
          message: 'Su membresía ha sido activada. Ahora tiene acceso completo a las sesiones en vivo, videos y toda la comunidad.',
          type: 'success',
        })
      }
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription
    const userId = subscription.metadata?.user_id

    if (userId && subscription.metadata?.type === 'community_subscription') {
      await supabase
        .from('community_memberships')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('user_id', userId)

      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Membresía Cancelada',
        message: 'Su membresía de la comunidad ha sido cancelada. Puede reactivarla en cualquier momento.',
        type: 'info',
      })
    }
  }

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as Stripe.Invoice
    const subscriptionId = (invoice as any).subscription as string

    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      const userId = subscription.metadata?.user_id

      if (userId && subscription.metadata?.type === 'community_subscription') {
        await supabase
          .from('community_memberships')
          .update({ status: 'past_due', updated_at: new Date().toISOString() })
          .eq('user_id', userId)

        await supabase.from('notifications').insert({
          user_id: userId,
          title: 'Problema con su Pago',
          message: 'No pudimos procesar el pago de su membresía. Por favor actualice su método de pago para mantener el acceso.',
          type: 'warning',
        })
      }
    }
  }

  // ===== EXISTING SERVICE PAYMENT EVENTS =====

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    // Skip community subscriptions (handled above)
    if (session.metadata?.type === 'community_subscription') {
      return NextResponse.json({ received: true })
    }

    const {
      case_id,
      client_id,
      installment_number,
      total_installments,
      total_price,
      service_name,
    } = session.metadata || {}

    if (!case_id || !client_id) {
      console.error('Missing metadata in Stripe session')
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 })
    }

    const numInstallments = Number(total_installments) || 1
    const numInstallment = Number(installment_number) || 1
    const totalPrice = Number(total_price) || 0
    const installmentAmount = numInstallments > 1
      ? Math.round(totalPrice / numInstallments)
      : totalPrice

    // Insert the completed payment
    const { error: paymentError } = await supabase.from('payments').insert({
      case_id,
      client_id,
      amount: installmentAmount,
      installment_number: numInstallment,
      total_installments: numInstallments,
      status: 'completed',
      payment_method: 'stripe',
      stripe_payment_intent_id: session.payment_intent as string,
      due_date: new Date().toISOString().split('T')[0],
      paid_at: new Date().toISOString(),
    })

    if (paymentError) {
      console.error('Error inserting payment:', paymentError)
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }

    // Auto-grant access to the case after payment
    await supabase
      .from('cases')
      .update({ access_granted: true })
      .eq('id', case_id)

    // If first payment of installment plan, create pending installments (2-N)
    if (numInstallment === 1 && numInstallments > 1) {
      const pendingPayments = []
      for (let i = 2; i <= numInstallments; i++) {
        const dueDate = new Date()
        dueDate.setMonth(dueDate.getMonth() + (i - 1))
        pendingPayments.push({
          case_id,
          client_id,
          amount: installmentAmount,
          installment_number: i,
          total_installments: numInstallments,
          status: 'pending',
          due_date: dueDate.toISOString().split('T')[0],
        })
      }

      const { error: pendingError } = await supabase
        .from('payments')
        .insert(pendingPayments)

      if (pendingError) {
        console.error('Error creating pending payments:', pendingError)
      }
    }

    // Notify client
    await supabase.from('notifications').insert({
      user_id: client_id,
      case_id,
      title: 'Pago Recibido',
      message: numInstallments > 1
        ? `Su pago de cuota ${numInstallment}/${numInstallments} por $${installmentAmount} para ${service_name || 'su servicio'} ha sido procesado exitosamente.`
        : `Su pago de $${installmentAmount} para ${service_name || 'su servicio'} ha sido procesado exitosamente.`,
      type: 'payment',
    })

    // Notify admin (Henry) - find admin user
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .limit(1)

    if (admins && admins.length > 0) {
      const { data: clientProfile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', client_id)
        .single()

      const clientName = clientProfile
        ? `${clientProfile.first_name} ${clientProfile.last_name}`
        : 'Cliente'

      await supabase.from('notifications').insert({
        user_id: admins[0].id,
        case_id,
        title: 'Nuevo Pago Recibido',
        message: `${clientName} ha pagado $${installmentAmount} (Stripe) - ${service_name || 'Servicio'}${numInstallments > 1 ? ` (cuota ${numInstallment}/${numInstallments})` : ''}.`,
        type: 'payment',
      })
    }
  }

  return NextResponse.json({ received: true })
}
