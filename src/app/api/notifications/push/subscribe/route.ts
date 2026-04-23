import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/service'
import { createLogger } from '@/lib/logger'

const log = createLogger('push-subscribe')

/**
 * Registers a browser's Web Push subscription for the authenticated admin.
 *
 * Body shape: PushSubscription.toJSON() plus optional `deviceLabel`.
 */
export async function POST(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {},
      },
    },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, employee_type')
    .eq('id', user.id)
    .single()
  const isAdmin = profile?.role === 'admin'
  const isSeniorConsultant =
    profile?.role === 'employee' && profile?.employee_type === 'senior_consultant'
  if (!isAdmin && !isSeniorConsultant) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: {
    endpoint?: string
    keys?: { p256dh?: string; auth?: string }
    deviceLabel?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const endpoint = body.endpoint
  const p256dh = body.keys?.p256dh
  const auth = body.keys?.auth
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'missing endpoint or keys' }, { status: 400 })
  }

  const svc = createServiceClient()
  const userAgent = request.headers.get('user-agent') ?? null

  const { error } = await svc
    .from('push_subscriptions')
    .upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
        user_agent: userAgent,
        device_label: body.deviceLabel ?? null,
        last_used_at: new Date().toISOString(),
        failed_count: 0,
      },
      { onConflict: 'endpoint' },
    )
  if (error) {
    log.error('upsert subscription failed', error)
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {},
      },
    },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { endpoint?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }
  if (!body.endpoint) {
    return NextResponse.json({ error: 'missing endpoint' }, { status: 400 })
  }
  const svc = createServiceClient()
  await svc
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', body.endpoint)
  return NextResponse.json({ ok: true })
}
