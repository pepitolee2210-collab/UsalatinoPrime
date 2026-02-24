import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Check if already active member
  const { data: membership } = await supabase
    .from('community_memberships')
    .select('status, stripe_customer_id')
    .eq('user_id', user.id)
    .single()

  if (membership?.status === 'active') {
    return NextResponse.json({ error: 'Ya tiene membresía activa' }, { status: 400 })
  }

  // Reuse or create Stripe customer
  let customerId = membership?.stripe_customer_id

  if (!customerId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name, email, phone')
      .eq('id', user.id)
      .single()

    const customer = await stripe.customers.create({
      email: profile?.email || user.email,
      name: profile ? `${profile.first_name} ${profile.last_name}` : undefined,
      phone: profile?.phone || undefined,
      metadata: { user_id: user.id },
    })

    customerId = customer.id
  }

  // Create Stripe Checkout in subscription mode
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Comunidad UsaLatinoPrime',
            description: 'Membresía mensual - Sesiones en vivo, videos exclusivos, comunidad',
          },
          unit_amount: 2500, // $25.00
          recurring: { interval: 'month' },
        },
        quantity: 1,
      },
    ],
    metadata: {
      user_id: user.id,
      type: 'community_subscription',
    },
    subscription_data: {
      metadata: {
        user_id: user.id,
        type: 'community_subscription',
      },
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/comunidad?activated=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/comunidad/pagar`,
  })

  return NextResponse.json({ url: session.url })
}
