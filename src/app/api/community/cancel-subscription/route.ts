import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data: membership } = await supabase
    .from('community_memberships')
    .select('stripe_subscription_id')
    .eq('user_id', user.id)
    .single()

  if (!membership?.stripe_subscription_id) {
    return NextResponse.json({ error: 'No tiene suscripción activa' }, { status: 400 })
  }

  // Cancel at period end (user keeps access until end of billing cycle)
  await stripe.subscriptions.update(membership.stripe_subscription_id, {
    cancel_at_period_end: true,
  })

  await supabase
    .from('community_memberships')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('user_id', user.id)

  return NextResponse.json({ success: true })
}
